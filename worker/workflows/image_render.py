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
from catalog import MODEL_CATALOG
from frame_ratio import crop_to_frame, filter_candidates_by_frame, validate_image_output_frame
from providers import is_provider_configured
from prompts import add_image_reference_map, build_feature_prompt
from workflows.common import (
    complete_job,
    fail_job,
    insert_asset,
    mark_processing,
    store_output,
)
from workflows.engine import execute_with_fallback, order_candidates


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
                requested_ratio = input_.get("aspectRatio") or "4:3"
                if requested_ratio == "auto":
                    source_for_ratio = req.get("imageUrl")
                    if not source_for_ratio:
                        references_for_ratio = req.get("referenceUrls") or []
                        source_for_ratio = references_for_ratio[0] if references_for_ratio else None
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
                content_count = len(input_.get("referenceUrls") or [])
                has_style_reference = bool(input_.get("styleReferenceUrl"))
                input_count = content_count + (1 if has_style_reference else 0)
                feature_candidates = [
                    candidate for candidate in feature_candidates
                    if candidate.max_references >= input_count
                    and (not has_style_reference or candidate.supports_style_reference)
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
            candidates = order_candidates(feature_candidates, input_.get("quality") or "standard", input_.get("model"))
            output_validator = None
            if feature == "text_to_image" and (input_.get("aspectRatio") or "4:3") != "auto":
                expected_frame = input_.get("aspectRatio") or "4:3"
                output_validator = lambda urls, _candidate: validate_image_output_frame(urls, expected_frame)
            outcome = execute_with_fallback(feature, candidates, req, output_validator=output_validator)

            result_asset_id = None
            requested_frame = (
                input_.get("aspectRatio")
                if feature == "text_to_image" and input_.get("aspectRatio") not in (None, "", "auto")
                else None
            )
            for url in outcome["output_urls"]:
                path, _ext = store_output(url)
                if requested_frame:
                    # Providers document slightly rounded pixel grids for some
                    # frames (Magic Hour 640x384 for 16:9, ...). Trim that small
                    # approximation so the stored asset is the exact frame the
                    # user selected instead of failing the whole generation.
                    crop_to_frame(path, requested_frame)
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
