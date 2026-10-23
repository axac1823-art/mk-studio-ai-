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
from frame_ratio import check_delivered_ratio, filter_by_frame
from catalog import MODEL_CATALOG
from providers import is_provider_configured
from prompts import add_image_reference_map, build_feature_prompt, build_image2_edit_prompt
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


def _stage_text_to_image_outputs(output_urls: list[str], requested_ratio: str) -> list[str]:
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
    base_image_edit = (
        feature == "text_to_image"
        and bool(input_.get("baseImageTag"))
        and isinstance(input_.get("imageUrl"), str)
        and bool(input_.get("imageUrl"))
    )
    # Image2 base edits must go through the existing image-edit candidate catalogue.
    # The persisted feature and credit charge stay text_to_image; only provider routing changes.
    routing_feature = "print_render" if base_image_edit else feature
    with db.connect() as conn:
        mark_processing(conn, job["id"])
        try:
            prompt = (
                build_image2_edit_prompt(input_.get("sceneDetails"))
                if base_image_edit
                else build_feature_prompt(feature, input_)
            )
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
            if base_image_edit and isinstance(req.get("imageUrl"), str):
                req["imageUrl"] = _image_reference_to_data_uri(req["imageUrl"])
            if feature == "background_remover" and isinstance(req.get("imageUrl"), str):
                # Les assets choisis dans la galerie sont des URLs du stockage
                # worker. Normaliser en data URI pour Magic Hour, remove.bg et
                # Gemini, qui n'acceptent pas tous une URL LAN privée.
                req["imageUrl"] = storage.image_data_uri_if_local(req["imageUrl"])
            feature_candidates = MODEL_CATALOG[routing_feature]
            if feature == "text_to_image" and not base_image_edit:
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
                            "Configure a supported provider (for example OpenAI GPT Image 1 or Google Gemini 2.5 Flash Image), "
                            "reduce the number of images, or remove Style."
                        )
                    raise ValueError(
                        "No configured Text-to-Image provider supports the selected image inputs. Configure a provider or remove references."
                    )
            if feature == "text_to_image" and not base_image_edit:
                feature_candidates = filter_by_frame(
                    feature_candidates,
                    input_.get("aspectRatio"),
                    input_.get("model"),
                )
            if feature == "multi_angle" and isinstance(input_.get("cameraState"), dict) and input_.get("referenceUrls"):
                # Le rendu caméra dépend de la vue-guide capturée dans l'éditeur.
                # Exclure les adaptateurs qui ne savent transmettre que l'image principale.
                feature_candidates = [candidate for candidate in feature_candidates if candidate.max_references > 0]
            if base_image_edit and (not input_.get("model") or input_.get("model") == "auto"):
                feature_candidates = [
                    candidate for candidate in feature_candidates
                    if is_provider_configured(candidate.provider)
                ]
                if not feature_candidates:
                    raise ValueError("No configured image-edit provider is available for this base image.")
            candidates = order_candidates(feature_candidates, input_.get("quality") or "standard", input_.get("model"))
            requested_ratio = input_.get("aspectRatio") or "auto"

            def validate_text_to_image(candidate, output_urls):
                try:
                    return _stage_text_to_image_outputs(output_urls, requested_ratio)
                except ValueError as err:
                    if str(err).startswith("frame mismatch:"):
                        log.warning("Image2 candidate %s returned an incompatible frame: %s", candidate.key, err)
                    raise ValueError(f"{candidate.key}: {err}") from err

            outcome = execute_with_fallback(
                routing_feature,
                candidates,
                req,
                output_validator=(
                    validate_text_to_image
                    if feature == "text_to_image" and not base_image_edit and requested_ratio != "auto"
                    else None
                ),
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
