
"""Adaptateur Magic Hour — API de la PLATEFORME.

Magic Hour est un agrégateur de modèles tiers.
Image2 utilise Flux 2 Klein pour rester compatible avec le catalogue
actuel du projet.

Routage image :
- Sans images d'entrée : POST /v1/ai-image-generator.
- Avec une ou plusieurs images : POST /v1/ai-image-editor.

Les data URIs et fichiers du stockage local sont d'abord téléversés
vers le stockage Magic Hour. Les URLs externes passent telles quelles.

Env : MAGIC_HOUR_API_KEY — lue à l'appel, jamais à l'import.
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

# The current Magic Hour Image Generator API documents only these ratios.
_IMAGE_GENERATOR_RATIOS = {
    "1:1",
    "16:9",
    "9:16",
}

# The current Magic Hour Image Editor API accepts these ratios.
_IMAGE_EDITOR_RATIOS = {
    "auto",
    "1:1",
    "16:9",
    "9:16",
    "4:3",
    "3:2",
    "2:3",
    "4:5",
}


def account_tier() -> str:
    """Return the tier attached to the configured API key."""
    account = get_json(
        f"{BASE_URL}/v1/account",
        _headers(),
        timeout_s=8,
    )
    tier = account.get("tier")
    return tier.lower() if isinstance(tier, str) else "free"


def _headers() -> dict:
    return {
        "Authorization": f"Bearer {require_env('MAGIC_HOUR_API_KEY')}"
    }


def _ensure_file_path(uri: str) -> str:
    """Upload a local image/video to Magic Hour storage when required.

    Magic Hour accepts external HTTP URLs and its own file_path values.
    Data URIs and worker-local storage assets are uploaded first.
    """
    if not isinstance(uri, str) or not uri.strip():
        raise ProviderError("magichour: empty asset input")

    parsed = parse_data_uri(uri)

    if parsed:
        mime, data = parsed
        if "/" not in mime:
            raise ProviderError("magichour: invalid data URI MIME type")
        ext = mime.split("/", 1)[1].lower()
        content = base64.b64decode(data)

    elif local_path := storage.local_path_from_url(uri):
        if not local_path.is_file():
            raise ProviderError("magichour: local asset file does not exist")

        content = local_path.read_bytes()
        ext = local_path.suffix.lstrip(".").lower()
        mime = _MIME_TYPES_BY_EXTENSION.get(ext)

        if not mime:
            raise ProviderError(
                f"magichour: unsupported local file extension '.{ext}'"
            )

    else:
        # Public HTTPS URLs can be consumed directly by Magic Hour.
        return uri

    if not content:
        raise ProviderError("magichour: empty asset file")

    if not mime.startswith(("image/", "video/")):
        raise ProviderError(
            f"magichour: unsupported asset MIME type '{mime}'"
        )

    media_type = "video" if mime.startswith("video/") else "image"

    grant = post_json(
        f"{BASE_URL}/v1/files/upload-urls",
        _headers(),
        {
            "items": [
                {
                    "type": media_type,
                    "extension": ext,
                }
            ]
        },
    )

    items = grant.get("items") or []
    item = items[0] if items else {}

    upload_url = item.get("upload_url")
    file_path = item.get("file_path")

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
        raise ProviderError(
            f"magichour upload failed ({response.status_code})",
            response.status_code,
        )

    return file_path


def _poll_project(kind: str, project_id: str, timeout_ms: int) -> str:
    """Poll an image/video project until completion."""

    def fetch_status():
        return get_json(
            f"{BASE_URL}/v1/{kind}-projects/{project_id}",
            _headers(),
        )

    def extract_done(status):
        downloads = status.get("downloads") or []
        url = (
            downloads[0].get("url")
            if status.get("status") == "complete" and downloads
            else None
        )
        return url if url else None

    def extract_error(status):
        if status.get("status") in ("error", "canceled"):
            return (
                f"magichour {kind} failed: "
                f"{(status.get('error') or {}).get('message') or status.get('status')}"
            )
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
        raise ValueError(
            "Magic Hour supports 720p, 1080p, 2K, and 4K output."
        )

    if not 0 < duration <= 133:
        raise ValueError("Magic Hour accepts videos up to 133 seconds.")

    video_file_path = _ensure_file_path(storage_path)

    project = post_json(
        f"{BASE_URL}/v1/ai-video-upscaler",
        _headers(),
        {
            "name": "RenderStudio Video Upscale",
            "start_seconds": 0,
            "end_seconds": duration,
            "resolution": resolution,
            "assets": {
                "video_file_path": video_file_path
            },
        },
    )

    project_id = project.get("id")
    if not project_id:
        raise ProviderError("magichour upscale: no project id in response")

    return {
        "url": _poll_project(
            "video",
            project_id,
            timeout_ms=3_600_000,
        ),
        "task_id": project_id,
    }


def _image_resolution(input_: dict) -> str:
    """Return a resolution supported by this project's Magic Hour adapter."""
    resolution = str(
        input_.get("resolution") or "640px"
    ).strip().lower()

    allowed = {
        "640px",
        "1k",
        "2k",
    }

    if resolution not in allowed:
        raise ProviderError(
            f"magichour: unsupported image resolution '{resolution}'. "
            "Supported values: 640px, 1k, 2k."
        )

    return resolution


def _run_image_generator(
    model_id: str,
    input_: dict,
    timeout_ms: int,
) -> str:
    """Generate an image from text when no input images are supplied.

    The Image Generator API does not define the assets.image_file_paths
    input used by the Image Editor API. Reference images must therefore
    be routed to _run_image_edit instead of being attached here.
    """
    images = input_.get("images")
    if isinstance(images, list) and any(
        isinstance(image, str) and image.strip()
        for image in images
    ):
        raise ProviderError(
            "magichour: image references must use the AI Image Editor endpoint"
        )

    aspect_ratio = str(
        input_.get("aspectRatio") or "auto"
    ).strip()

    if aspect_ratio == "auto":
        # Generator API defaults to square when aspect_ratio is omitted.
        # Auto must already have been resolved by image_render.py when
        # the Frame Contract requires a different target frame.
        aspect_ratio = "1:1"

    if aspect_ratio not in _IMAGE_GENERATOR_RATIOS:
        raise ProviderError(
            f"magichour generator does not support the requested "
            f"{aspect_ratio} frame. Supported frames: 1:1, 16:9, 9:16."
        )

    resolution = _image_resolution(input_)

    payload: dict = {
        "name": "renderstudio-image",
        "model": model_id,
        "image_count": 1,
        "resolution": resolution,
        "aspect_ratio": aspect_ratio,
        "style": {
            "prompt": str(input_.get("prompt") or "")
        },
    }

    logger.info(
        "Magic Hour image submit: endpoint=generator model=%s "
        "aspect_ratio=%s resolution=%s",
        model_id,
        aspect_ratio,
        resolution,
    )

    job = post_json(
        f"{BASE_URL}/v1/ai-image-generator",
        _headers(),
        payload,
    )

    job_id = job.get("id")

    if not job_id:
        raise ProviderError(
            "magichour: no image id in generator submit response"
        )

    logger.info(
        "Magic Hour image submitted: endpoint=generator project_id=%s",
        job_id,
    )

    return _poll_project("image", job_id, timeout_ms)


def _run_image_edit(
    model_id: str,
    input_: dict,
    timeout_ms: int,
) -> str:
    """Edit/compose with one or more uploaded input images."""
    images = input_.get("images")

    if not isinstance(images, list):
        images = []

    images = [
        image
        for image in images
        if isinstance(image, str) and image.strip()
    ]

    if not images:
        return _run_image_generator(
            model_id,
            input_,
            timeout_ms,
        )

    aspect_ratio = str(
        input_.get("aspectRatio") or "auto"
    ).strip()

    if aspect_ratio not in _IMAGE_EDITOR_RATIOS:
        raise ProviderError(
            f"magichour editor does not support the requested "
            f"{aspect_ratio} frame."
        )

    resolution = _image_resolution(input_)

    logger.info(
        "Magic Hour image submit: endpoint=editor model=%s "
        "aspect_ratio=%s resolution=%s image_count=%d",
        model_id,
        aspect_ratio,
        resolution,
        len(images),
    )

    # Preserve the input manifest order. The prompt's reference map uses
    # that same order to explain the intended role of each image.
    with ThreadPoolExecutor(
        max_workers=max(1, len(images))
    ) as pool:
        file_paths = list(
            pool.map(_ensure_file_path, images)
        )

    job = post_json(
        f"{BASE_URL}/v1/ai-image-editor",
        _headers(),
        {
            "model": model_id,
            "image_count": 1,
            "aspect_ratio": aspect_ratio,
            "resolution": resolution,
            "style": {
                "prompt": str(input_.get("prompt") or "")
            },
            "assets": {
                "image_file_paths": file_paths
            },
        },
    )

    job_id = job.get("id")

    if not job_id:
        raise ProviderError(
            "magichour: no image id in editor submit response"
        )

    logger.info(
        "Magic Hour image submitted: endpoint=editor project_id=%s",
        job_id,
    )

    return _poll_project("image", job_id, timeout_ms)


def _run_video(
    model_id: str,
    input_: dict,
    timeout_ms: int,
) -> dict:
    """Run Magic Hour image-to-video."""
    file_path = _ensure_file_path(
        str(input_.get("image") or "")
    )

    end_image_url = input_.get("endImage")
    assets: dict = {
        "image_file_path": file_path
    }

    if end_image_url:
        assets["end_image_file_path"] = _ensure_file_path(
            str(end_image_url)
        )

    try:
        end_seconds = float(
            input_.get("endSeconds")
        ) or 5
    except (TypeError, ValueError):
        end_seconds = 5

    job = post_json(
        f"{BASE_URL}/v1/image-to-video",
        _headers(),
        {
            "model": model_id,
            "end_seconds": end_seconds,
            "resolution": str(
                input_.get("resolution") or "720p"
            ),
            # Pas de piste audio générée côté Magic Hour (vidéo muette en V1).
            "audio": False,
            "style": {
                "prompt": str(input_.get("prompt") or "")
            },
            "assets": assets,
        },
    )

    job_id = job.get("id")
    if not job_id:
        raise ProviderError("magichour: no video id in submit response")

    return {
        "video": {
            "url": _poll_project("video", job_id, timeout_ms)
        }
    }


def _run_video_to_video(
    model_id: str,
    input_: dict,
    timeout_ms: int,
) -> dict:
    """Magic Hour video-to-video: shared endpoint for Modify Video and Relight."""
    job = post_json(
        f"{BASE_URL}/v1/video-to-video",
        _headers(),
        {
            "model": model_id,
            "assets": {
                "video_file_path": _ensure_file_path(
                    str(input_.get("videoUrl") or "")
                )
            },
            "style": {
                "prompt": str(input_.get("prompt") or "")
            },
        },
    )

    job_id = job.get("id")
    if not job_id:
        raise ProviderError(
            "magichour: no video-to-video id in response"
        )

    return {
        "video": {
            "url": _poll_project("video", job_id, timeout_ms)
        }
    }


def _run_lip_sync(
    _model_id: str,
    input_: dict,
    timeout_ms: int,
) -> dict:
    """Magic Hour lip-sync."""
    video_url = str(input_.get("videoUrl") or "")
    audio_url = str(input_.get("audioUrl") or "")

    if not video_url or not audio_url:
        raise ProviderError(
            "magichour lip-sync: missing videoUrl or audioUrl"
        )

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
        raise ProviderError(
            "magichour: no lip-sync id in response"
        )

    return {
        "video": {
            "url": _poll_project("video", job_id, timeout_ms)
        }
    }


def generate(
    model_id: str,
    input_: dict,
    timeout_ms: int,
) -> dict:
    """Route image, video and audio inputs to their dedicated endpoints.

    Text-to-image requests with actual reference images use the Editor API.
    Pure text-to-image requests use the Generator API.
    """
    images = input_.get("images")

    if isinstance(images, list):
        image_inputs = [
            image
            for image in images
            if isinstance(image, str) and image.strip()
        ]

        try:
            count = max(
                1,
                int(input_.get("quantity") or 1),
            )
        except (TypeError, ValueError):
            count = 1

        runner = (
            _run_image_edit
            if image_inputs
            else _run_image_generator
        )

        with ThreadPoolExecutor(max_workers=count) as pool:
            urls = list(
                pool.map(
                    lambda _: runner(model_id, input_, timeout_ms),
                    range(count),
                )
            )

        return {
            "images": [
                {"url": url}
                for url in urls
            ]
        }

    if input_.get("audioUrl"):
        return _run_lip_sync(
            model_id,
            input_,
            timeout_ms,
        )

    if input_.get("videoUrl"):
        return _run_video_to_video(
            model_id,
            input_,
            timeout_ms,
        )

    return _run_video(
        model_id,
        input_,
        timeout_ms,
    )
