"""Adaptateur Tripo3D — API officielle v2 de génération 3D.

Supporte text-to-3D et image-to-3D. Retourne un modèle au format GLB.

Schéma (v2) :
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

    parsed = parse_data_uri(image_url)
    if parsed:
        mime, data = parsed
        ext = mime.split("/")[1] if "/" in mime else "png"
        content = __import__("base64").b64decode(data)
        filename = f"source.{ext}"
    elif image_url.startswith("/storage/"):
        path = storage.resolve(image_url)
        content = Path(path).read_bytes()
        filename = path.name
    else:
        response = httpx.get(image_url, timeout=120)
        response.raise_for_status()
        content = response.content
        filename = "source.png"

    response = httpx.post(
        f"{BASE_URL}/task",
        headers=_headers(),
        data={"type": "image_to_model"},
        files={"file": (filename, content, f"image/{filename.rsplit('.', 1)[-1]}")},
        timeout=120,
    )
    if response.status_code >= 400:
        raise ProviderError(f"tripo upload failed ({response.status_code}): {response.text[:300]}")
    payload = response.json()
    data = payload.get("data") or {}
    task_id = data.get("task_id") or data.get("id")
    if not task_id:
        raise ProviderError("tripo upload: no task id")
    return task_id


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
        task_id = _upload_image(str(source))
    else:
        if not isinstance(prompt, str) or not prompt.strip():
            raise ProviderError("tripo: missing prompt")
        task = post_json(
            f"{BASE_URL}/task",
            _headers(),
            {"type": "text_to_model", "prompt": prompt.strip()},
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
        if state in ("failed", "cancelled", "expired"):
            return f"tripo task {state}: {data.get('error') or 'unknown'}"
        return None

    model_url = poll_until_done(fetch_status, extract_done, extract_error, timeout_ms, interval_ms=5000)
    if not model_url:
        raise ProviderError("tripo: no model url in completed task")
    return {"3d_model": {"url": model_url, "format": "glb"}}
