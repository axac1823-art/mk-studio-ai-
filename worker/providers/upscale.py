"""Provider upscale — Magic Hour AI Image Upscaler (agrégateur assumé,
voir AGENTS.md §1).

Interface : upscale(input, timeout_ms) -> {"images": [{"url": ...}]}
l'upscale n'est pas un candidat du catalogue, c'est une action dédiée.
"""
import base64
import os

import httpx

from providers.http_helpers import (
    ProviderError,
    get_json,
    parse_data_uri,
    poll_until_done,
    post_json,
    require_env,
)

UPSCALE_TIMEOUT_MS = 10 * 60 * 1000
_MAGICHOUR_BASE = "https://api.magichour.ai"


def is_configured() -> bool:
    """Au moins Magic Hour configuré (la route /upscale refuse en 503 sinon)."""
    return bool(os.environ.get("MAGIC_HOUR_API_KEY"))


def _magichour_upload(data_uri: str, api_key: str) -> str:
    """Verse une data URI chez Magic Hour (upload-urls -> PUT) -> file_path."""
    parsed = parse_data_uri(data_uri)
    if not parsed:
        # Une URL http passe telle quelle (Magic Hour la télécharge).
        return data_uri
    mime, data = parsed
    ext = mime.split("/")[1] if "/" in mime else "png"
    upload = post_json(
        f"{_MAGIC_HOUR_BASE}/v1/files/upload-urls",
        {"x-api-key": api_key},
        {"items": [{"extension": ext}]},
    )
    item = (upload.get("items") or [{}])[0]
    upload_url, file_path = item.get("upload_url"), item.get("file_path")
    if not upload_url or not file_path:
        raise ProviderError("magichour upscale: no upload url")
    response = httpx.put(
        upload_url,
        content=base64.b64decode(data),
        headers={"Content-Type": mime},
        timeout=120,
        follow_redirects=True,
    )
    if response.status_code >= 400:
        raise ProviderError(f"magichour upload failed ({response.status_code})", response.status_code)
    return file_path


def _upscale_magichour(input_: dict, timeout_ms: int) -> dict:
    """Magic Hour image upscaler."""
    api_key = require_env("MAGIC_HOUR_API_KEY")
    file_path = _magichour_upload(str(input_.get("image") or ""), api_key)
    submit = post_json(
        f"{_MAGIC_HOUR_BASE}/v1/ai-image-upscaler",
        {"x-api-key": api_key},
        {
            "image": file_path,
            "upscale_factor": int(input_.get("factor") or 2),
            "enhance": bool(input_.get("enhance")),
        },
    )
    project_id = submit.get("id")
    if not project_id:
        raise ProviderError(f"magichour upscale: no project id in response ({submit})")

    def fetch_status():
        return get_json(f"{_MAGIC_HOUR_BASE}/v1/image-projects/{project_id}", {"x-api-key": api_key})

    def extract_done(status):
        if status.get("status") == "complete":
            downloads = status.get("downloads") or []
            if downloads and downloads[0].get("url"):
                return downloads[0]["url"]
            raise ProviderError("magichour upscale: complete without download")
        return None

    def extract_error(status):
        return status.get("status") if status.get("status") in ("error", "canceled") else None

    url = poll_until_done(fetch_status, extract_done, extract_error, timeout_ms, interval_ms=3000)
    return {"images": [{"url": url}]}


def list_models() -> list[dict]:
    """Modèles upscalers disponibles côté worker."""
    if not is_configured():
        return []
    return [
        {
            "key": "magichour",
            "name": "Magic Hour AI Upscaler",
            "description": "Cloud AI upscaler with enhancement",
        }
    ]


def upscale(input_: dict, timeout_ms: int = UPSCALE_TIMEOUT_MS, provider: str | None = None) -> dict:
    """Upscale via Magic Hour.

    Si `provider` est fourni, il est ignoré (un seul provider disponible).
    """
    if provider and provider != "magichour":
        raise ProviderError(f"unknown upscale provider: {provider}")
    return _upscale_magichour(input_, timeout_ms)
