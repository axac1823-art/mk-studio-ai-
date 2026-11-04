
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

import db
import storage
from PIL import Image

from catalog import (
    MODEL_CATALOG,
    candidate_resolutions,
    candidate_text_to_image_frame_ratios,
    image2_frame_reference,
    image2_identity_object_count,
    normalize_image2_reference_roles,
    text_to_image_identity_locked,
    text_to_image_images,
)
from frame_ratio import normalize_image_output_frame, validate_image_output_frame
from providers import is_provider_configured
from providers.http_helpers import get_bytes
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
    """Convert a local worker storage asset to a provider-ready data URI.

    The storage helper handles relative /storage paths and local public URLs,
    including LAN hosts such as the development machine's IP address.
    External URLs and existing data URIs are kept unchanged.
    """
    if not isinstance(value, str) or not value.strip():
        return value
    return storage.image_data_uri_if_local(value)


def _infer_aspect_ratio(value: str | None) -> str:
    """Infer the nearest supported frame from a reference image; default to 4:3."""
    if not isinstance(value, str) or not value.strip():
        return "4:3"

    try:
        if value.startswith("data:") and "," in value:
            payload = value.split(",", 1)[1]
            image_bytes = base64.b64decode(payload)
        elif value.startswith("/storage/"):
            image_bytes = storage.resolve(value).read_bytes()
        elif value.startswith(("http://", "https://")):
            # Prefer the local file when this URL maps to worker storage.
            # Otherwise inspect the remote source rather than silently
            # assuming that every external reference is 4:3.
            local_path = storage.local_path_from_url(value)
            if local_path is not None and local_path.is_file():
                image_bytes = local_path.read_bytes()
            else:
                image_bytes, _content_type = get_bytes(value, timeout_s=30)
        else:
            return "4:3"

        with Image.open(io.BytesIO(image_bytes)) as image:
            width, height = image.size
            if width <= 0 or height <= 0:
                return "4:3"
            source_ratio = width / height

        ratios = {
            "1:1": 1.0,
            "16:9": 16 / 9,
            "9:16": 9 / 16,
            "4:3": 4 / 3,
            "3:4": 3 / 4,
            "3:2": 3 / 2,
            "2:3": 2 / 3,
            "21:9": 21 / 9,
        }
        return min(
            ratios,
            key=lambda key: abs(math.log(source_ratio / ratios[key])),
        )

    except Exception:
        # Keep Auto usable when a reference URL cannot be inspected.
        # The default is explicit and is still validated downstream.
        return "4:3"


def run(job: dict) -> None:
    """Exécute le job image : prompt serveur -> candidats (filtré par modèle
    sélectionné si fourni) -> stockage des sorties -> assets + completion.
    Aucune exception ne sort : toute erreur termine le job en 'failed'.
    """
    input_ = job["input"]
    feature = input_["feature"]

    if feature == "text_to_image":
        # Preserve the normalized role manifest in the job input so that
        # prompt mapping, identity counts and frame selection use the same roles.
        input_["referenceRoles"] = normalize_image2_reference_roles(input_)

    with db.connect() as conn:
        mark_processing(conn, job["id"])
        try:
            prompt = build_feature_prompt(feature, input_)
            prompt = add_image_reference_map(prompt, input_)

            req = {**input_, "prompt": prompt}

            # Convert local worker assets immediately before provider adapters
            # consume them. Keep the image manifest order unchanged.
            reference_urls = req.get("referenceUrls")
            if isinstance(reference_urls, list):
                req["referenceUrls"] = [
                    _image_reference_to_data_uri(url) if isinstance(url, str) else url
                    for url in reference_urls
                ]

            style_reference = req.get("styleReferenceUrl")
            if isinstance(style_reference, str) and style_reference.strip():
                req["styleReferenceUrl"] = _image_reference_to_data_uri(style_reference)

            if feature == "text_to_image":
                # The primary image is also a provider input and must be
                # converted using the same storage handling as the references.
                primary_image = req.get("imageUrl")
                if isinstance(primary_image, str) and primary_image.strip():
                    req["imageUrl"] = _image_reference_to_data_uri(primary_image)

            requested_ratio = input_.get("aspectRatio") or "4:3"

            if requested_ratio == "auto":
                frame_reference = image2_frame_reference(req)

                if frame_reference:
                    # A real destination frame always has priority.
                    req["resolvedAspectRatio"] = _infer_aspect_ratio(
                        frame_reference
                    )

                elif (
                    input_.get("model") == "magichour-flux-2-klein-text"
                    and not text_to_image_images(input_)
                ):
                    # Magic Hour text-only Generator defaults to square.
                    # Keep Auto compatible with its native output frame.
                    req["resolvedAspectRatio"] = "1:1"

                else:
                    # Preserve the existing project default for other cases.
                    req["resolvedAspectRatio"] = _infer_aspect_ratio(None)

            else:
                req["resolvedAspectRatio"] = requested_ratio

            if feature == "background_remover" and isinstance(req.get("imageUrl"), str):
                # Gallery assets may be local worker storage URLs.
                req["imageUrl"] = storage.image_data_uri_if_local(req["imageUrl"])

            feature_candidates = MODEL_CATALOG[feature]

            if feature == "text_to_image":
                has_style_reference = (
                    bool(input_.get("styleReferenceUrl"))
                    or "style" in input_["referenceRoles"]
                )

                # Count actual provider inputs, including the separate Style
                # image, the primary image and every tagged reference.
                input_count = len(text_to_image_images(input_))
                identity_count = image2_identity_object_count(input_)

                feature_candidates = [
                    candidate
                    for candidate in feature_candidates
                    if candidate.max_references >= input_count
                    and (
                        not has_style_reference
                        or candidate.supports_style_reference
                    )
                    and (
                        candidate.max_identity_objects is None
                        or identity_count <= candidate.max_identity_objects
                    )
                ]

                # Auto may use only providers that are actually configured.
                # A manually selected model remains explicit and is not
                # silently replaced by another provider.
                selected_model = input_.get("model")
                if not selected_model or selected_model == "auto":
                    feature_candidates = [
                        candidate
                        for candidate in feature_candidates
                        if is_provider_configured(candidate.provider)
                    ]

                if not feature_candidates:
                    if has_style_reference:
                        raise ValueError(
                            "No configured Text-to-Image provider supports the selected Style and content inputs. "
                            "Configure a supported provider, reduce the number of images, or remove Style."
                        )
                    raise ValueError(
                        "No configured Text-to-Image provider supports the selected image inputs. "
                        "Configure a provider or remove references."
                    )

                # Filter by the requested resolution before ranking. This
                # prevents Auto from choosing a model that cannot supply it.
                requested_resolution = str(input_.get("resolution") or "1K")

                selected_candidate = next(
                    (
                        candidate
                        for candidate in feature_candidates
                        if candidate.key == selected_model
                    ),
                    None,
                )

                if (
                    selected_candidate
                    and requested_resolution not in candidate_resolutions(selected_candidate)
                ):
                    supported = ", ".join(
                        candidate_resolutions(selected_candidate)
                    ) or "none reported"
                    raise ValueError(
                        f"{selected_candidate.name} does not support {requested_resolution}. "
                        f"Supported resolutions: {supported}."
                    )

                feature_candidates = [
                    candidate
                    for candidate in feature_candidates
                    if requested_resolution in candidate_resolutions(candidate)
                ]

                if not feature_candidates:
                    raise ValueError(
                        f"No configured Text-to-Image model supports {requested_resolution}. "
                        "Choose a supported resolution or another model."
                    )

                # Frame Contract applies to both explicit ratios and Auto.
                effective_frame = req.get("resolvedAspectRatio") or "4:3"
                # The same Magic Hour model may use two different endpoints:
                # generator for text-only requests, editor when images exist.
                # Their supported aspect-ratio sets are not identical.
                has_input_images = bool(text_to_image_images(input_))
                selected_candidate = next(
                    (
                        candidate
                        for candidate in feature_candidates
                        if candidate.key == selected_model
                    ),
                    None,
                )

                if selected_candidate:
                    selected_frame_ratios = candidate_text_to_image_frame_ratios(
                        selected_candidate,
                        has_input_images=has_input_images,
                    )
                    if effective_frame not in selected_frame_ratios:
                        supported = ", ".join(selected_frame_ratios) or "none reported"
                        raise ValueError(
                            f"{selected_candidate.name} does not support {effective_frame} "
                            f"for this input mode. Supported frames: {supported}."
                        )

                compatible_candidates = []
                for candidate in feature_candidates:
                    supported_ratios = candidate_text_to_image_frame_ratios(
                        candidate,
                        has_input_images=has_input_images,
                    )
                    if effective_frame in supported_ratios:
                        compatible_candidates.append(candidate)
                feature_candidates = compatible_candidates

                if not feature_candidates:
                    raise ValueError(
                        f"No configured Text-to-Image model supports {effective_frame} "
                        "for the selected input mode. Choose another model or frame."
                    )

            if (
                feature == "multi_angle"
                and isinstance(input_.get("cameraState"), dict)
                and input_.get("referenceUrls")
            ):
                # Le rendu caméra dépend de la vue-guide capturée dans l'éditeur.
                # Exclure les adaptateurs qui ne savent transmettre que l'image principale.
                feature_candidates = [
                    candidate
                    for candidate in feature_candidates
                    if candidate.max_references > 0
                ]

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




            if feature == "text_to_image":
                expected_frame = req.get("resolvedAspectRatio") or "4:3"

                # Pad only small provider deviations. Never crop away source
                # content or resize the original image to conceal a mismatch.
                output_transformer = (
                    lambda urls, _candidate: normalize_image_output_frame(
                        urls,
                        expected_frame,
                    )
                )
                output_validator = (
                    lambda urls, _candidate: validate_image_output_frame(
                        urls,
                        expected_frame,
                    )
                )

            outcome = execute_with_fallback(
                feature,
                candidates,
                req,
                output_validator=output_validator,
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
