"""Adaptateur Tripo3D — API officielle v2 de génération 3D.

Supporte text-to-3D et image-to-3D. Retourne un modèle au format GLB.

Schéma (v2) :
- POST /v2/openapi/upload/sts -> { data: { image_token } }
- POST /v2/openapi/task -> { data: { task_id } }
- GET  /v2/openapi/task/{task_id} -> status + output.model

Env : TRIPO_API_KEY (https://platform.tripo3d.ai) — lue à l'appel.
"""
import httpx

from providers.http_helpers import ProviderError, get_json, poll_until_done, post_json, require_env

BASE_URL = "https://api.tripo3d.ai/v2/openapi"


def _headers() -> dict:
    return {"Authorization": f"Bearer {require_env('TRIPO_API_KEY')}"}


def _upload_image(image_url: str) -> str:
    """Tripo attend un fichier uploadé en multipart. Les data URIs et chemins
    locaux sont convertis en bytes puis uploadés."""
    from pathlib import Path

    from providers.http_helpers import parse_data_uri
    import storage

    mime = "image/png"
    parsed = parse_data_uri(image_url)
    if parsed:
        mime, data = parsed
        content = __import__("base64").b64decode(data)
        ext = {"image/jpeg": "jpg", "image/png": "png", "image/webp": "webp"}.get(mime)
        if not ext:
            raise ProviderError(f"tripo: unsupported image type {mime}")
        filename = f"source.{ext}"
    elif image_url.startswith("/storage/"):
        path = storage.resolve(image_url)
        content = Path(path).read_bytes()
        filename = path.name
        ext = path.suffix.lower().lstrip(".")
        mime = {"jpg": "image/jpeg", "jpeg": "image/jpeg", "png": "image/png", "webp": "image/webp"}.get(ext, "")
    else:
        response = httpx.get(image_url, timeout=120)
        response.raise_for_status()
        content = response.content
        mime = response.headers.get("content-type", "").split(";", 1)[0].lower()
        ext = {"image/jpeg": "jpg", "image/png": "png", "image/webp": "webp"}.get(mime)
        if not ext:
            raise ProviderError(f"tripo: unsupported image type {mime or 'unknown'}")
        filename = f"source.{ext}"

    if not mime:
        raise ProviderError(f"tripo: unsupported image file {filename}")

    response = httpx.post(
        f"{BASE_URL}/upload/sts",
        headers=_headers(),
        files={"file": (filename, content, mime)},
        timeout=120,
    )
    if response.status_code >= 400:
        raise ProviderError(f"tripo upload failed ({response.status_code}): {response.text[:300]}")
    payload = response.json()
    data = payload.get("data") or {}
    image_token = data.get("image_token") or data.get("file_token")
    if not image_token:
        raise ProviderError("tripo upload: no image token")
    return image_token


def generate(model_id: str, input_: dict, timeout_ms: int) -> dict:
    """Contrat provider : retourne { "3d_model": { "url": ..., "format": "glb" } }."""
    prompt = input_.get("prompt")
    image_urls = input_.get("imageUrls")
    image_url = input_.get("imageUrl")
    has_image = bool(image_urls) or bool(image_url)

    if has_image:
        if isinstance(image_urls, dict):
            source = image_urls.get("front") or next(iter(image_urls.values()), None)
        else:
            source = image_url
        if not source:
            raise ProviderError("tripo: no image provided")
        image_token = _upload_image(str(source))
        task = post_json(
            f"{BASE_URL}/task",
            _headers(),
            {
                "type": "image_to_model",
                "model_version": "v2.5-20250123",
                "file": {"type": "image", "file_token": image_token},
            },
        )
        data = task.get("data") or {}
        task_id = data.get("task_id") or data.get("id")
        if not task_id:
            raise ProviderError("tripo: no task id in image submit response")
    else:
        if not isinstance(prompt, str) or not prompt.strip():
            raise ProviderError("tripo: missing prompt")
        task = post_json(
            f"{BASE_URL}/task",
            _headers(),
            {
                "type": "text_to_model",
                "model_version": "v2.5-20250123",
                "prompt": prompt.strip(),
            },
        )
        data = task.get("data") or {}
        task_id = data.get("task_id") or data.get("id")
        if not task_id:
            raise ProviderError("tripo: no task id in submit response")

    def fetch_status():
        return get_json(f"{BASE_URL}/task/{task_id}", _headers())

    def extract_done(status):
        data = status.get("data") or {}
        if data.get("status") == "success":
            output = data.get("output") or {}
            return output.get("model")
        return None

    def extract_error(status):
        data = status.get("data") or {}
        state = data.get("status")
        if state in ("failed", "banned", "cancelled", "expired"):
            return f"tripo task {state}: {data.get('error') or 'unknown'}"
        return None

    model_url = poll_until_done(fetch_status, extract_done, extract_error, timeout_ms, interval_ms=5000)
    if not model_url:
        raise ProviderError("tripo: no model url in completed task")
    return {"3d_model": {"url": model_url, "format": "glb"}}
