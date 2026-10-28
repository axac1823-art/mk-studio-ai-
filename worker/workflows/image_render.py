"""Workflow image (print_render, mood_swap, exterior_to_interior,
plan_to_render, multi_angle) — exécute UN job image de bout en bout.

Entrée : la ligne `jobs` (input JSON construit par /web : feature, imageUrl,
referenceUrls, quality, aspectRatio, resolution, quantity, ids de presets,
creditCost). Sortie : un asset par image produite (fichier dans storage +
ligne en DB), puis job -> complete (crédits débités, idempotent) ou failed.
"""
import base64
import logging
import mimetypes

import db
import storage
from PIL import Image
from frame_ratio import check_delivered_ratio, check_delivered_resolution, filter_by_frame, filter_by_resolution
from catalog import (
    MODEL_CATALOG,
    filter_text_to_image_candidates,
    image2_identity_object_count,
    normalize_image2_reference_roles,
    text_to_image_candidates_for_tier,
    text_to_image_identity_locked,
    text_to_image_images,
)
from providers import is_provider_configured, magichour
from prompts import add_image_reference_map, build_feature_prompt
from workflows.common import (
    complete_job,
    fail_job,
    insert_asset,
    mark_processing,
    store_output,
)
from workflows.engine import execute_with_fallback, order_candidates

log = logging.getLogger("workflows.image_render")


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


def _stage_text_to_image_outputs(output_urls: list[str], requested_ratio: str, requested_resolution: str = "1K") -> list[str]:
    """Télécharge et valide les sorties avant de déclarer un modèle gagnant.

    Une image au mauvais ratio invalide la tentative complète afin que le
    moteur puisse essayer le prochain candidat Auto.
    """
    paths: list[str] = []
    try:
        for url in output_urls:
            path, _ext = store_output(url)
            paths.append(path)
            with Image.open(storage.resolve(path)) as delivered:
                width, height = delivered.width, delivered.height
            if not check_delivered_ratio(width, height, requested_ratio):
                raise ValueError(
                    f"frame mismatch: requested {requested_ratio}, returned {width}x{height}"
                )
            if not check_delivered_resolution(width, height, requested_resolution):
                raise ValueError(
                    f"resolution mismatch: requested {requested_resolution}, returned {width}x{height}"
                )
        return paths
    except Exception:
        for path in paths:
            try:
                storage.resolve(path).unlink(missing_ok=True)
            except OSError:
                pass
        raise


def run(job: dict) -> None:
    """Exécute le job image : prompt serveur -> candidats (filtré par modèle
    sélectionné si fourni) -> stockage des sorties -> assets + completion.
    Aucune exception ne sort : toute erreur termine le job en 'failed'."""
    input_ = job["input"]
    feature = input_["feature"]
    identity_locked = False
    if feature == "text_to_image":
        identity_locked = text_to_image_identity_locked(input_)
        # This flag describes only the primary imageUrl mapped to @element.
        # referenceUrls are handled by their @imgN role manifest.
        input_["preserveElementIdentity"] = bool(input_.get("imageUrl"))
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
                    _image_reference_to_data_uri(url)
                    if isinstance(url, str)
                    else url
                    for url in reference_urls
                ]

            style_reference = req.get("styleReferenceUrl")
            if isinstance(style_reference, str) and style_reference:
                req["styleReferenceUrl"] = _image_reference_to_data_uri(
                    style_reference
                )

            # Convert the primary Image2 element image when it is stored locally.
            if (
                feature == "text_to_image"
                and isinstance(req.get("imageUrl"), str)
            ):
                req["imageUrl"] = storage.image_data_uri_if_local(
                    req["imageUrl"]
                )

            if (
                feature == "background_remover"
                and isinstance(req.get("imageUrl"), str)
            ):
                # Les assets choisis dans la galerie sont des URLs du stockage
                # worker. Normaliser en data URI pour Magic Hour, remove.bg et
                # Gemini, qui n'acceptent pas tous une URL LAN privée.
                req["imageUrl"] = storage.image_data_uri_if_local(req["imageUrl"])
            feature_candidates = MODEL_CATALOG[feature]
            if feature == "text_to_image":
                magic_hour_tier = "basic"
                if is_provider_configured("magichour"):
                    try:
                        magic_hour_tier = magichour.account_tier()
                    except Exception:
                        magic_hour_tier = "basic"
                feature_candidates = text_to_image_candidates_for_tier(magic_hour_tier)
            if feature == "text_to_image":
                input_count = len(text_to_image_images(input_))
                reference_roles = normalize_image2_reference_roles(input_)
                has_style_reference = bool(input_.get("styleReferenceUrl")) or "style" in reference_roles
                has_image_inputs = input_count > 0
                selected_model = input_.get("model")

                if has_image_inputs:
                    feature_candidates = filter_text_to_image_candidates(
                        feature_candidates,
                        input_count=input_count,
                        has_style_reference=has_style_reference,
                        identity_locked=identity_locked,
                        identity_object_count=image2_identity_object_count(input_),
                    )

                    # An explicitly selected model must fail clearly if it is not eligible;
                    # never quietly run a different model for a manual model selection.
                    if (
                        selected_model
                        and selected_model != "auto"
                        and not any(candidate.key == selected_model for candidate in feature_candidates)
                    ):
                        if identity_locked:
                            raise ValueError(
                                "The selected model is not eligible for Image2 element/base-scene editing "
                                "with the current number and roles of input images. Choose a compatible edit model, "
                                "reduce the object references, or use Style/Detail roles only where appropriate."
                            )
                        raise ValueError(
                            "The selected model does not support the current Image2 references or Style role. "
                            "Choose a compatible model or remove unsupported references."
                        )

                # Preserve the existing provider-configuration filter for Auto.
                if not selected_model or selected_model == "auto":
                    feature_candidates = [
                        candidate for candidate in feature_candidates
                        if is_provider_configured(candidate.provider)
                    ]

                if not feature_candidates:
                    if identity_locked:
                        raise ValueError(
                            "No configured Image2 model meets the source-image editing, object-count, "
                            "reference-count, frame and resolution requirements. Configure an eligible provider "
                            "or reduce/change the input roles. No low-fidelity fallback was used."
                        )
                    if has_style_reference:
                        raise ValueError(
                            "No configured Text-to-Image provider supports the selected Style and content inputs. "
                            "Configure a supported provider, reduce the number of images, or remove Style."
                        )
                    raise ValueError(
                        "No configured Text-to-Image provider supports the selected image inputs. "
                        "Configure a compatible provider or remove references."
                    )
            if feature == "text_to_image":
                feature_candidates = filter_by_frame(
                    feature_candidates,
                    input_.get("aspectRatio"),
                    input_.get("model"),
                )
                feature_candidates = filter_by_resolution(
                    feature_candidates,
                    input_.get("aspectRatio"),
                    input_.get("resolution") or "1K",
                    input_.get("model"),
                )
            if feature == "multi_angle" and isinstance(input_.get("cameraState"), dict) and input_.get("referenceUrls"):
                # Le rendu caméra dépend de la vue-guide capturée dans l'éditeur.
                # Exclure les adaptateurs qui ne savent transmettre que l'image principale.
                feature_candidates = [candidate for candidate in feature_candidates if candidate.max_references > 0]
            requested_quality = input_.get("quality") or "standard"
            if feature == "text_to_image" and requested_quality == "pro":
                feature_candidates = [candidate for candidate in feature_candidates if "pro" in candidate.tiers]
                if not feature_candidates:
                    raise ValueError(
                        f"No compatible Image2 model supports Pro quality for {input_.get('aspectRatio') or 'auto'} "
                        f"at {input_.get('resolution') or '1K'}. Choose Standard or another frame/resolution."
                    )
            candidates = order_candidates(feature_candidates, requested_quality, input_.get("model"))
            if feature == "text_to_image" and (not input_.get("model") or input_.get("model") == "auto") and (
                input_.get("imageUrl") or input_.get("styleReferenceUrl") or input_.get("referenceUrls")
            ):
                priority = {"gpt-image-1.5": 0, "gemini-2.5-flash": 1}
                candidates = sorted(candidates, key=lambda candidate: (priority.get(candidate.key, 100), candidate.cost_per_generation))
            requested_ratio = input_.get("aspectRatio") or "auto"
            requested_resolution = input_.get("resolution") or "1K"

            def validate_text_to_image(candidate, output_urls):
                try:
                    return _stage_text_to_image_outputs(output_urls, requested_ratio, requested_resolution)
                except ValueError as err:
                    if str(err).startswith(("frame mismatch:", "resolution mismatch:")):
                        log.warning("Image2 candidate %s returned incompatible output: %s", candidate.key, err)
                    raise ValueError(f"{candidate.key}: {err}") from err

            outcome = execute_with_fallback(
                feature,
                candidates,
                req,
                output_validator=(validate_text_to_image if feature == "text_to_image" else None),
            )

            # Image2's outputs are already downloaded and validated inside
            # candidate fallback; other image features keep the normal path.
            stored_paths: list[str] = outcome.get("validated_output") or []
            if not stored_paths:
                stored_paths = [store_output(url)[0] for url in outcome["output_urls"]]

            result_asset_id = None
            for path in stored_paths:
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
