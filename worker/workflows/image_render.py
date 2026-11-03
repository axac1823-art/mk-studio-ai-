"""Workflow image (print_render, mood_swap, exterior_to_interior,
plan_to_render, multi_angle) — exécute UN job image de bout en bout.

Entrée : la ligne `jobs` (input JSON construit par /web : feature, imageUrl,
referenceUrls, quality, aspectRatio, resolution, quantity, ids de presets,
creditCost). Sortie : un asset par image produite (fichier dans storage +
ligne en DB), puis job -> complete (crédits débités, idempotent) ou failed.
"""
import base64
import io
import math
import mimetypes

import db
import storage
from PIL import Image
from catalog import (
    MODEL_CATALOG,
    candidate_resolutions,
    image2_identity_object_count,
    normalize_image2_reference_roles,
    text_to_image_identity_locked,
    text_to_image_images,
)
from frame_ratio import (
    filter_candidates_by_frame,
    normalize_image_output_frame,
    validate_image_output_frame,
)
from providers import is_provider_configured
from prompts import add_image_reference_map, build_feature_prompt
from workflows.common import (
    complete_job,
    fail_job,
    insert_asset,
    mark_processing,
    store_output,
)
from workflows.engine import (
    execute_with_fallback,
    order_candidates,
    order_text_to_image_candidates,
)


def _image_reference_to_data_uri(value: str) -> str:
    """Read a local /storage file and turn it into a provider-ready data URI."""
    path_value = value
    if value.startswith("http://") or value.startswith("https://"):
        from urllib.parse import urlparse
        parsed = urlparse(value)
        if parsed.path.startswith("/storage/") and parsed.hostname in {"localhost", "127.0.0.1"}:
            path_value = parsed.path
    if not path_value.startswith("/storage/"):
        return value
    file_path = storage.resolve(path_value)
    mime = mimetypes.guess_type(file_path.name)[0] or "image/png"
    encoded = base64.b64encode(file_path.read_bytes()).decode("ascii")
    return f"data:{mime};base64,{encoded}"


def _infer_aspect_ratio(value: str | None) -> str:
    """Infer the nearest supported frame from a reference image; default to 4:3."""
    if not isinstance(value, str) or not value:
        return "4:3"
    try:
        if value.startswith("data:") and "," in value:
            import base64 as _base64
            payload = value.split(",", 1)[1]
            with Image.open(io.BytesIO(_base64.b64decode(payload))) as image:
                source_ratio = image.width / image.height
        else:
            path_value = value
            if value.startswith("http://") or value.startswith("https://"):
                from urllib.parse import urlparse
                parsed = urlparse(value)
                path_value = parsed.path if parsed.path.startswith("/storage/") else ""
            if not path_value.startswith("/storage/"):
                return "4:3"
            with Image.open(storage.resolve(path_value)) as image:
                source_ratio = image.width / image.height
        ratios = {"1:1": 1.0, "16:9": 16 / 9, "9:16": 9 / 16, "4:3": 4 / 3, "3:4": 3 / 4, "3:2": 3 / 2, "2:3": 2 / 3, "21:9": 21 / 9}
        return min(ratios, key=lambda key: abs(math.log(source_ratio / ratios[key])))
    except Exception:
        return "4:3"


def run(job: dict) -> None:
    """Exécute le job image : prompt serveur -> candidats (filtré par modèle
    sélectionné si fourni) -> stockage des sorties -> assets + completion.
    Aucune exception ne sort : toute erreur termine le job en 'failed'."""
    input_ = job["input"]
    feature = input_["feature"]
    if feature == "text_to_image":
        input_["referenceRoles"] = normalize_image2_reference_roles(input_)
    with db.connect() as conn:
        mark_processing(conn, job["id"])
        try:
            prompt = build_feature_prompt(feature, input_)
            prompt = add_image_reference_map(prompt, input_)
            req = {**input_, "prompt": prompt}
            # References are stored as worker asset URLs to keep large image data out of the jobs row.
            # Convert local worker assets to inline data URIs immediately before provider adapters consume them.
            reference_urls = req.get("referenceUrls")
            if isinstance(reference_urls, list):
                req["referenceUrls"] = [
                    _image_reference_to_data_uri(url) if isinstance(url, str) else url
                    for url in reference_urls
                ]
            style_reference = req.get("styleReferenceUrl")
            if isinstance(style_reference, str) and style_reference:
                req["styleReferenceUrl"] = _image_reference_to_data_uri(style_reference)
            if feature == "text_to_image":
                # OpenAI and Google need local primary assets converted just
                # like tagged references before they build provider payloads.
                primary_image = req.get("imageUrl")
                if isinstance(primary_image, str) and primary_image.strip():
                    req["imageUrl"] = _image_reference_to_data_uri(primary_image)
                requested_ratio = input_.get("aspectRatio") or "4:3"
                if requested_ratio == "auto":
                    source_for_ratio = req.get("imageUrl")
                    if not source_for_ratio:
                        references_for_ratio = req.get("referenceUrls") or []
                        reference_roles = input_.get("referenceRoles") or []
                        base_index = next(
                            (index for index, role in enumerate(reference_roles) if role == "base"),
                            None,
                        )
                        element_index = next(
                            (index for index, role in enumerate(reference_roles) if role == "element"),
                            None,
                        )
                        source_index = base_index if base_index is not None else element_index
                        if source_index is None:
                            source_index = 0 if references_for_ratio else None
                        source_for_ratio = (
                            references_for_ratio[source_index]
                            if source_index is not None and source_index < len(references_for_ratio)
                            else None
                        )
                    req["resolvedAspectRatio"] = _infer_aspect_ratio(source_for_ratio)
                else:
                    req["resolvedAspectRatio"] = requested_ratio

            if feature == "background_remover" and isinstance(req.get("imageUrl"), str):
                # Les assets choisis dans la galerie sont des URLs du stockage
                # worker. Normaliser en data URI pour Magic Hour, remove.bg et
                # Gemini, qui n'acceptent pas tous une URL LAN privée.
                req["imageUrl"] = storage.image_data_uri_if_local(req["imageUrl"])
            feature_candidates = MODEL_CATALOG[feature]
            if feature == "text_to_image":
                has_style_reference = bool(input_.get("styleReferenceUrl")) or "style" in input_["referenceRoles"]
                input_count = len(text_to_image_images(input_))
                identity_count = image2_identity_object_count(input_)
                feature_candidates = [
                    candidate for candidate in feature_candidates
                    if candidate.max_references >= input_count
                    and (not has_style_reference or candidate.supports_style_reference)
                    and (
                        candidate.max_identity_objects is None
                        or identity_count <= candidate.max_identity_objects
                    )
                ]
                # Real Auto: only configured providers are candidates. The normal
                # quality/cost ranking still applies to the providers that are ready.
                selected_model = input_.get("model")
                if not selected_model or selected_model == "auto":
                    feature_candidates = [
                        candidate for candidate in feature_candidates
                        if is_provider_configured(candidate.provider)
                    ]
                if not feature_candidates:
                    if has_style_reference:
                        raise ValueError(
                            "No configured Text-to-Image provider supports the selected Style and content inputs. "
                            "Configure a supported provider, reduce the number of images, or remove Style."
                        )
                    raise ValueError(
                        "No configured Text-to-Image provider supports the selected image inputs. Configure a provider or remove references."
                    )

                # Match candidates to the requested resolution so Auto never
                # selects a provider whose plan/model cannot supply that size.
                requested_resolution = str(input_.get("resolution") or "1K")
                selected_candidate = next(
                    (candidate for candidate in feature_candidates if candidate.key == selected_model),
                    None,
                )
                if selected_candidate and requested_resolution not in candidate_resolutions(selected_candidate):
                    supported = ", ".join(candidate_resolutions(selected_candidate)) or "none reported"
                    raise ValueError(
                        f"{selected_candidate.name} does not support {requested_resolution}. "
                        f"Supported resolutions: {supported}."
                    )
                feature_candidates = [
                    candidate for candidate in feature_candidates
                    if requested_resolution in candidate_resolutions(candidate)
                ]
                if not feature_candidates:
                    raise ValueError(
                        f"No configured Text-to-Image model supports {requested_resolution}. "
                        "Choose a supported resolution or another model."
                    )

                # Explicit frames are filtered before model ordering. Auto remains provider-selected.
                if requested_ratio != "auto":
                    selected_candidate = next(
                        (candidate for candidate in feature_candidates if candidate.key == selected_model),
                        None,
                    )
                    if selected_candidate and requested_ratio not in selected_candidate.frame_ratios:
                        supported = ", ".join(selected_candidate.frame_ratios) or "none reported"
                        raise ValueError(
                            f"{selected_candidate.name} does not support {requested_ratio}. Supported frames: {supported}."
                        )
                    feature_candidates = filter_candidates_by_frame(feature_candidates, requested_ratio)
                    if not feature_candidates:
                        raise ValueError(
                            f"No configured Text-to-Image model supports {requested_ratio}. Choose a supported frame or another model."
                        )
            if feature == "multi_angle" and isinstance(input_.get("cameraState"), dict) and input_.get("referenceUrls"):
                # Le rendu caméra dépend de la vue-guide capturée dans l'éditeur.
                # Exclure les adaptateurs qui ne savent transmettre que l'image principale.
                feature_candidates = [candidate for candidate in feature_candidates if candidate.max_references > 0]
            if feature == "text_to_image":
                candidates = order_text_to_image_candidates(
                    feature_candidates,
                    input_.get("quality") or "standard",
                    input_.get("model"),
                    prioritize_reference_fidelity=text_to_image_identity_locked(input_),
                )
            else:
                candidates = order_candidates(
                    feature_candidates,
                    input_.get("quality") or "standard",
                    input_.get("model"),
                )
            output_validator = None
            output_transformer = None
            if feature == "text_to_image" and (input_.get("aspectRatio") or "4:3") != "auto":
                expected_frame = input_.get("aspectRatio") or "4:3"
                output_transformer = lambda urls, _candidate: normalize_image_output_frame(urls, expected_frame)
                output_validator = lambda urls, _candidate: validate_image_output_frame(urls, expected_frame)
            outcome = execute_with_fallback(
                feature,
                candidates,
                req,
                output_validator=output_validator,
                output_transformer=output_transformer,
            )

            result_asset_id = None
            for url in outcome["output_urls"]:
                path, _ext = store_output(url)
                asset_id = insert_asset(conn, job, "image", path)
                result_asset_id = result_asset_id or asset_id

            complete_job(
                conn,
                job,
                result_asset_id,
                int(input_.get("creditCost") or 0),
                outcome["winner"].key,
                outcome["winner"].cost_per_generation,
            )
        except Exception as err:  # AllModelsFailedError incluse
            fail_job(conn, job, err)
