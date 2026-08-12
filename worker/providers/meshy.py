"""Adaptateur Meshy — API officielle de génération 3D.

Supporte text-to-3D et image-to-3D. Retourne un modèle au format GLB.

Schéma (v2) :
- POST /v2/text-to-3d -> { id }
- POST /v2/image-to-3d -> { id }
- GET  /v2/text-to-3d/{id} -> status + model_urls.glb
- GET  /v2/image-to-3d/{id} -> status + model_urls.glb

Les images sources sont uploadées sur le stockage Meshy via
POST /v1/files (multipart), ou passées comme data URI/URL http si elles
sont déjà publiques.

Env : MESHY_API_KEY (https://www.meshy.ai/api) — lue à l'appel.
"""
import base64
import time

import httpx

from providers.http_helpers import ProviderError, get_json, poll_until_done, post_json, require_env

BASE_URL = "https://api.meshy.ai"


def _headers() -> dict:
    return {"Authorization": f"Bearer {require_env('MESHY_API_KEY')}"}


def _upload_image_if_needed(image_url: str) -> str:
    """Meshy image-to-3D attend une URL http(s) publique. Les data URIs et
    fichiers locaux sont uploadés sur le stockage Meshy."""
    from providers.http_helpers import parse_data_uri
    from pathlib import Path
    import storage

    parsed = parse_data_uri(image_url)
    if parsed:
        mime, data = parsed
        ext = mime.split("/")[1] if "/" in mime else "png"
        content = base64.b64decode(data)
    elif image_url.startswith("/storage/"):
        path = storage.resolve(image_url)
        content = Path(path).read_bytes()
        ext = path.suffix.lstrip(".") or "png"
    else:
        return image_url

    response = httpx.post(
        f"{BASE_URL}/v1/files",
        headers=_headers(),
        files={"file": (f"source.{ext}", content, f"image/{ext}")},
        timeout=120,
    )
    if response.status_code >= 400:
        raise ProviderError(f"meshy upload failed ({response.status_code}): {response.text[:300]}")
    data = response.json()
    url = data.get("url") or data.get("image_url")
    if not url:
        raise ProviderError("meshy upload: no url in response")
    return url


def generate(model_id: str, input_: dict, timeout_ms: int) -> dict:
    """Contrat provider : retourne { "3d_model": { "url": ..., "format": "glb" } }.

    `model_id` est ignoré en V1 (Meshy gère le modèle côté serveur).
    Accepte `imageUrl` (str) ou `imageUrls` (dict vue -> chemin/URL).
    """
    prompt = input_.get("prompt")
    image_url = input_.get("imageUrl")
    image_urls = input_.get("imageUrls")
    is_text_to_3d = not image_url and not image_urls

    if is_text_to_3d:
        if not isinstance(prompt, str) or not prompt.strip():
            raise ProviderError("meshy: missing prompt for text-to-3d")
        task = post_json(
            f"{BASE_URL}/v2/text-to-3d",
            _headers(),
            {
                "mode": "preview",
                "prompt": prompt.strip(),
                "art_style": "realistic",
                "negative_prompt": "low poly, blurry, distorted",
            },
        )
    else:
        # Meshy image-to-3D prend une seule image : on utilise la vue front
        # si disponible, sinon la première image fournie.
        if isinstance(image_urls, dict):
            source = image_urls.get("front") or next(iter(image_urls.values()), None)
        else:
            source = image_url
        if not source:
            raise ProviderError("meshy: no image provided for image-to-3d")
        public_image_url = _upload_image_if_needed(str(source))
        task = post_json(
            f"{BASE_URL}/v2/image-to-3d",
            _headers(),
            {
                "mode": "preview",
                "image_url": public_image_url,
            },
        )

    task_id = task.get("id") or task.get("task_id")
    if not task_id:
        raise ProviderError("meshy: no task id in submit response")

    endpoint = "text-to-3d" if is_text_to_3d else "image-to-3d"

    def fetch_status():
        return get_json(f"{BASE_URL}/v2/{endpoint}/{task_id}", _headers())

    def extract_done(status):
        if status.get("status") == "SUCCEEDED":
            urls = status.get("model_urls") or {}
            return urls.get("glb")
        return None

    def extract_error(status):
        state = status.get("status")
        if state in ("FAILED", "CANCELLED", "EXPIRED"):
            return f"meshy task {state.lower()}: {status.get('error') or 'unknown'}"
        return None

    glb_url = poll_until_done(fetch_status, extract_done, extract_error, timeout_ms, interval_ms=5000)
    if not glb_url:
        raise ProviderError("meshy: no glb url in completed task")
    return {"3d_model": {"url": glb_url, "format": "glb"}}
