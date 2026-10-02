"""Adaptateur Trellis — via Replicate.

Supporte l'image-to-3D via le modèle Replicate wtybill/trellis.
Retourne un modèle au format GLB.

Schéma Replicate :
- POST /v1/models/{owner}/{name}/predictions -> { id }
- GET  /v1/predictions/{id} -> status + output

Env : TRELLIS_API_KEY (clé API Replicate)
      https://replicate.com/account/api-tokens

NOTE : le nom de modèle `wtybill/trellis` est indicatif ; vérifier
le modèle exact sur Replicate avant la première utilisation en production.
"""
import httpx

import storage
from providers.http_helpers import ProviderError, get_json, poll_until_done, post_json, require_env

BASE_URL = "https://api.replicate.com/v1"


def _headers() -> dict:
    return {"Authorization": f"Token {require_env('TRELLIS_API_KEY')}"}


def _resolve_image_url(image_url: str) -> str:
    """Replicate attend une URL http(s) publique. Les chemins /storage/...
    sont convertis en URL absolue via WORKER_PUBLIC_URL."""
    if image_url.startswith("/storage/"):
        return storage.get_url(image_url)
    return image_url


def _extract_output_url(data: dict) -> str | None:
    output = data.get("output")
    if isinstance(output, str):
        return output
    if isinstance(output, list) and output:
        first = output[0]
        if isinstance(first, str):
            return first
        if isinstance(first, dict):
            return first.get("url") or first.get("mesh") or first.get("model")
    return None


def generate(model_id: str, input_: dict, timeout_ms: int) -> dict:
    """Contrat provider : retourne { "3d_model": { "url": ..., "format": "glb" } }.

    `model_id` est le chemin Replicate (ex: wtybill/trellis).
    Accepte `imageUrl` (str) ou `imageUrls` (dict vue -> URL).
    """
    image_url = input_.get("imageUrl")
    image_urls = input_.get("imageUrls")
    if isinstance(image_urls, dict):
        source = image_urls.get("front") or next(iter(image_urls.values()), None)
    else:
        source = image_url
    if not source:
        raise ProviderError("trellis: no image provided")

    prediction = post_json(
        f"{BASE_URL}/models/{model_id}/predictions",
        _headers(),
        {"input": {"image": _resolve_image_url(str(source))}},
    )
    prediction_id = prediction.get("id")
    if not prediction_id:
        raise ProviderError("trellis: no prediction id")

    def fetch_status():
        return get_json(f"{BASE_URL}/predictions/{prediction_id}", _headers())

    def extract_done(status):
        if status.get("status") == "succeeded":
            return _extract_output_url(status)
        return None

    def extract_error(status):
        state = status.get("status")
        if state in ("failed", "canceled"):
            error = status.get("error") or status.get("detail") or "unknown"
            return f"trellis prediction {state}: {error}"
        return None

    model_url = poll_until_done(fetch_status, extract_done, extract_error, timeout_ms, interval_ms=5000)
    if not model_url:
        raise ProviderError("trellis: no model url in completed prediction")
    return {"3d_model": {"url": model_url, "format": "glb"}}
