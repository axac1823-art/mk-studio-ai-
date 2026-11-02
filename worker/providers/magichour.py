"""Adaptateur Magic Hour — API de la PLATEFORME (port de magichour.ts).

⚠️ EXCEPTION au principe "aucun agrégateur" (AGENTS.md §1) : Magic Hour
n'édite aucun modèle fondamental — il revend un accès unifié à des modèles
tiers (Kling, Veo, Sora, Nano Banana, Seedream...). Ajouté à la demande
explicite du propriétaire du produit. Image : `flux-2-klein` ÉPINGLÉ
(seul modèle d'édition éligible au free tier) ; vidéo : routage `default`
(~ltx-2.3 en gratuit, kling-3.0 en payant) — le modèle réellement servant
n'est donc pas garanti d'un appel à l'autre, contrairement aux
fournisseurs directs.

Schéma : soumission JSON (POST /v1/ai-image-editor ou /v1/image-to-video)
-> { id }, polling GET /v1/{image|video}-projects/{id} -> "complete" ->
downloads[0].url (URL pré-signée, expirante). Les data URIs ne sont pas
acceptées en entrée : elles sont d'abord versées sur le stockage Magic
Hour (POST /v1/files/upload-urls -> PUT des octets -> file_path) ; les URL
http passent telles quelles. Une image par requête : la quantité est
servie par requêtes parallèles.

Env : MAGIC_HOUR_API_KEY (https://magichour.ai/developer?tab=api-keys) —
lue à l'appel, jamais à l'import (échec vite -> fallback).
"""
import base64
import logging
from concurrent.futures import ThreadPoolExecutor

import httpx

import storage

from providers.http_helpers import (
    ProviderError,
    get_json,
    parse_data_uri,
    poll_until_done,
    post_json,
    require_env,
)

BASE_URL = "https://api.magichour.ai"
logger = logging.getLogger(__name__)
_MIME_TYPES_BY_EXTENSION = {
    "png": "image/png",
    "jpg": "image/jpeg",
    "jpeg": "image/jpeg",
    "webp": "image/webp",
    "avif": "image/avif",
    "heic": "image/heic",
    "heif": "image/heif",
    "bmp": "image/bmp",
    "tif": "image/tiff",
    "tiff": "image/tiff",
    "mp4": "video/mp4",
    "m4v": "video/mp4",
    "mov": "video/quicktime",
    "webm": "video/webm",
}


def account_tier() -> str:
    """Return the tier attached to the configured API key for entitlement checks."""
    account = get_json(f"{BASE_URL}/v1/account", _headers(), timeout_s=8)
    tier = account.get("tier")
    return tier.lower() if isinstance(tier, str) else "free"


def _headers() -> dict:
    return {"Authorization": f"Bearer {require_env('MAGIC_HOUR_API_KEY')}"}


def _ensure_file_path(uri: str) -> str:
    """Magic Hour n'accepte que des URL http ou des `file_path` de SON
    stockage : les data URIs et les fichiers du stockage local (y compris
    leurs URLs publiques) sont versés au préalable. Les URLs externes passent
    telles quelles."""
    parsed = parse_data_uri(uri)
    if parsed:
        mime, data = parsed
        ext = mime.split("/")[1] if "/" in mime else "png"
        content = base64.b64decode(data)
    elif local_path := storage.local_path_from_url(uri):
        content = local_path.read_bytes()
        ext = local_path.suffix.lstrip(".").lower()
        mime = _MIME_TYPES_BY_EXTENSION.get(ext)
        if not mime:
            raise ProviderError(f"magichour: unsupported local file extension '.{ext}'")
    else:
        return uri

    media_type = "video" if mime.startswith("video/") else "image"
    grant = post_json(
        f"{BASE_URL}/v1/files/upload-urls",
        _headers(),
        {"items": [{"type": media_type, "extension": ext}]},
    )
    items = grant.get("items") or []
    item = items[0] if items else {}
    upload_url, file_path = item.get("upload_url"), item.get("file_path")
    if not upload_url or not file_path:
        raise ProviderError("magichour: no upload url in response")
    response = httpx.put(
        upload_url,
        headers={"Content-Type": mime},
        content=content,
        timeout=60,
        follow_redirects=True,
    )
    if response.status_code >= 400:
        raise ProviderError(f"magichour upload failed ({response.status_code})", response.status_code)
    return file_path


def _poll_project(kind: str, project_id: str, timeout_ms: int) -> str:
    """Polling commun image/vidéo : "complete" -> URL de téléchargement."""

    def fetch_status():
        return get_json(f"{BASE_URL}/v1/{kind}-projects/{project_id}", _headers())

    def extract_done(status):
        downloads = status.get("downloads") or []
        url = downloads[0].get("url") if status.get("status") == "complete" and downloads else None
        return url if url else None

    def extract_error(status):
        if status.get("status") in ("error", "canceled"):
            return f"magichour {kind} failed: {(status.get('error') or {}).get('message') or status.get('status')}"
        return None

    return poll_until_done(
        fetch_status,
        extract_done,
        extract_error,
        timeout_ms,
        interval_ms=5000 if kind == "video" else 3000,
    )


def upscale_video(storage_path: str, duration: float, resolution: str) -> dict:
    """Create a Magic Hour AI video upscaler project from a worker asset."""
    if resolution not in {"720p", "1080p", "2k", "4k"}:
        raise ValueError("Magic Hour supports 720p, 1080p, 2K, and 4K output.")
    if not 0 < duration <= 133:
        raise ValueError("Magic Hour accepts videos up to 133 seconds.")
    video_file_path = _ensure_file_path(storage_path)
    project = post_json(
        f"{BASE_URL}/v1/ai-video-upscaler",
        _headers(),
        {"name": "RenderStudio Video Upscale", "start_seconds": 0, "end_seconds": duration,
         "resolution": resolution, "assets": {"video_file_path": video_file_path}},
    )
    project_id = project.get("id")
    if not project_id:
        raise ProviderError("magichour upscale: no project id in response")
    return {"url": _poll_project("video", project_id, timeout_ms=3_600_000), "task_id": project_id}


def _image_resolution(input_: dict) -> str:
    """Return a documented Magic Hour image resolution."""
    resolution = str(input_.get("resolution") or "640px").strip().lower()

    allowed = {"640px", "1k", "2k"}

    if resolution not in allowed:
        raise ProviderError(
            f"magichour: unsupported image resolution '{resolution}'. "
            "Supported values: 640px, 1k, 2k."
        )

    return resolution

def _run_image_generator(model_id: str, input_: dict, timeout_ms: int) -> str:
    """Magic Hour image generator, including Image2 reference assets."""

    aspect_ratio = str(
        input_.get("aspectRatio") or "auto"
    ).strip()

    allowed_ratios = {"auto", "1:1", "16:9", "9:16"}

    if aspect_ratio not in allowed_ratios:
        raise ProviderError(
            f"magichour: unsupported image ratio '{aspect_ratio}'."
        )

    resolution = _image_resolution(input_)

    payload: dict = {
        "name": "renderstudio-image",
        "model": model_id,
        "image_count": 1,
        "aspect_ratio": aspect_ratio,
        "resolution": resolution,
        "style": {
            "prompt": str(input_.get("prompt") or "")
        },
    }

    images = input_.get("images")

    if isinstance(images, list) and images:
        with ThreadPoolExecutor(max_workers=max(1, len(images))) as pool:
            file_paths = list(pool.map(_ensure_file_path, images))

        payload["assets"] = {
            "image_file_paths": file_paths
        }

    logger.info(
        "Magic Hour image submit: endpoint=generator model=%s "
        "aspect_ratio=%s resolution=%s reference_count=%d",
        model_id,
        aspect_ratio,
        resolution,
        len(images) if isinstance(images, list) else 0,
    )

    job = post_json(
        f"{BASE_URL}/v1/ai-image-generator",
        _headers(),
        payload,
    )

    job_id = job.get("id")

    if not job_id:
        raise ProviderError(
            "magichour: no image id in submit response"
        )

    logger.info(
        "Magic Hour image submitted: endpoint=generator project_id=%s",
        job_id,
    )

    return _poll_project("image", job_id, timeout_ms)


def _run_image_edit(model_id: str, input_: dict, timeout_ms: int) -> str:
    """Submit an image edit request using uploaded references."""
    images = input_.get("images")
    if not isinstance(images, list) or len(images) == 0:
        return _run_image_generator(model_id, input_, timeout_ms)
    aspect_ratio = str(input_.get("aspectRatio") or "auto")
    resolution = _image_resolution(input_)
    logger.info(
        "Magic Hour image submit: endpoint=editor model=%s aspect_ratio=%s resolution=%s image_count=%d",
        model_id,
        aspect_ratio,
        resolution,
        len(images),
    )
    with ThreadPoolExecutor(max_workers=max(1, len(images))) as pool:
        file_paths = list(pool.map(_ensure_file_path, images))
    job = post_json(
        f"{BASE_URL}/v1/ai-image-editor",
        _headers(),
        {
            "model": model_id,
            "image_count": 1,
            "aspect_ratio": aspect_ratio,
            "resolution": resolution,
            "style": {"prompt": str(input_.get("prompt") or "")},
            "assets": {"image_file_paths": file_paths},
        },
    )
    job_id = job.get("id")
    if not job_id:
        raise ProviderError("magichour: no image id in submit response")
    logger.info("Magic Hour image submitted: endpoint=editor project_id=%s", job_id)
    return _poll_project("image", job_id, timeout_ms)


def _run_video(model_id: str, input_: dict, timeout_ms: int) -> dict:
    file_path = _ensure_file_path(str(input_.get("image") or ""))
    end_image_url = input_.get("endImage")
    assets: dict = {"image_file_path": file_path}
    if end_image_url:
        assets["end_image_file_path"] = _ensure_file_path(str(end_image_url))
    try:
        end_seconds = float(input_.get("endSeconds")) or 5
    except (TypeError, ValueError):
        end_seconds = 5
    job = post_json(
        f"{BASE_URL}/v1/image-to-video",
        _headers(),
        {
            "model": model_id,
            "end_seconds": end_seconds,
            "resolution": str(input_.get("resolution") or "720p"),
            # Pas de piste audio générée côté Magic Hour (vidéo muette en V1).
            "audio": False,
            "style": {"prompt": str(input_.get("prompt") or "")},
            "assets": assets,
        },
    )
    job_id = job.get("id")
    if not job_id:
        raise ProviderError("magichour: no video id in submit response")
    return {"video": {"url": _poll_project("video", job_id, timeout_ms)}}


def _run_video_to_video(model_id: str, input_: dict, timeout_ms: int) -> dict:
    """Magic Hour video-to-video : même endpoint pour Modify Video et Relight."""
    job = post_json(
        f"{BASE_URL}/v1/video-to-video",
        _headers(),
        {
            "model": model_id,
            "assets": {"video_file_path": _ensure_file_path(str(input_.get("videoUrl") or ""))},
            "style": {"prompt": str(input_.get("prompt") or "")},
        },
    )
    job_id = job.get("id")
    if not job_id:
        raise ProviderError("magichour: no video-to-video id in submit response")
    return {"video": {"url": _poll_project("video", job_id, timeout_ms)}}


def _run_lip_sync(_model_id: str, input_: dict, timeout_ms: int) -> dict:
    """Magic Hour lip-sync : synchronise la bouche d'une vidéo avec une piste audio."""
    video_url = str(input_.get("videoUrl") or "")
    audio_url = str(input_.get("audioUrl") or "")
    if not video_url or not audio_url:
        raise ProviderError("magichour lip-sync: missing videoUrl or audioUrl")
    job = post_json(
        f"{BASE_URL}/v1/lip-sync",
        _headers(),
        {
            "assets": {
                "video_file_path": _ensure_file_path(video_url),
                "audio_file_path": _ensure_file_path(audio_url),
            },
        },
    )
    job_id = job.get("id")
    if not job_id:
        raise ProviderError("magichour: no lip-sync id in submit response")
    return {"video": {"url": _poll_project("video", job_id, timeout_ms)}}


def generate(model_id: str, input_: dict, timeout_ms: int) -> dict:
    """Route Image2 through the generator and other image edits through the editor."""
    if isinstance(input_.get("images"), list):
        try:
            count = max(1, int(input_.get("quantity") or 1))
        except (TypeError, ValueError):
            count = 1
        runner = _run_image_generator if input_.get("is_text_to_image") else _run_image_edit
        with ThreadPoolExecutor(max_workers=count) as pool:
            urls = list(pool.map(lambda _: runner(model_id, input_, timeout_ms), range(count)))
        return {"images": [{"url": url} for url in urls]}
    if input_.get("audioUrl"):
        return _run_lip_sync(model_id, input_, timeout_ms)
    if input_.get("videoUrl"):
        return _run_video_to_video(model_id, input_, timeout_ms)
    return _run_video(model_id, input_, timeout_ms)
