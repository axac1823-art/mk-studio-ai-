"""Adaptateur OpenAI — API officielle (port de openai.ts).

Modèles servis : gpt-image-1.5 / gpt-image-1 (édition d'images) et
sora-2 / sora-2-pro (image->vidéo).

Images : POST /v1/images/edits en multipart (champ `image[]` répété pour
l'image principale + les références) ; la réponse rend `data[].b64_json`,
converti ici en data URI (les workflows les stockent ensuite sur disque).
Une image par requête : la quantité est servie par requêtes parallèles
(même schéma que l'adaptateur Google).

Vidéos : POST /v1/videos (JSON, image d'entrée en `input_reference.image_url`,
data URL acceptée) -> { id }, polling GET /v1/videos/{id} -> "completed",
puis téléchargement authentifié GET /v1/videos/{id}/content : Sora ne
publie PAS d'URL de sortie — le MP4 est écrit directement via storage.py
et le chemin "/storage/<nom>" est renvoyé (rôle de storeVideoBuffer côté TS).
⚠️ Surface d'API à re-vérifier contre la doc au premier branchement de clé
(le fallback absorbe un rejet, mais l'appel reste facturé s'il aboutit).

Env : OPENAI_API_KEY (https://platform.openai.com/api-keys) — lue à
l'appel, jamais à l'import (échec vite -> fallback).
"""
import base64
from concurrent.futures import ThreadPoolExecutor

import httpx

import storage
from providers.http_helpers import (
    ProviderError,
    get_bytes,
    get_json,
    parse_data_uri,
    poll_until_done,
    post_json,
    require_env,
)

BASE_URL = "https://api.openai.com/v1"


def _headers() -> dict:
    return {"Authorization": f"Bearer {require_env('OPENAI_API_KEY')}"}


def _run_image_edit(model_id: str, input_: dict) -> str:
    images = input_.get("images")
    if not isinstance(images, list):
        images = []

    files = []
    for uri in images:
        parsed = parse_data_uri(uri)
        if not parsed:
            raise ProviderError("openai: http image inputs are not supported, data URI expected")
        mime, data = parsed
        ext = mime.split("/")[1] if "/" in mime else "png"
        files.append(("image[]", (f"image.{ext}", base64.b64decode(data), mime)))

    # PAS de Content-Type manuel : httpx pose le boundary multipart lui-même.
    # Timeout large : la génération gpt-image dépasse couramment 60 s.
    response = httpx.post(
        f"{BASE_URL}/images/edits",
        headers=_headers(),
        data={
            "model": model_id,
            "prompt": str(input_.get("prompt") or ""),
            "size": str(input_.get("size") or "auto"),
            "quality": str(input_.get("quality") or "auto"),
            "output_format": "jpeg",
        },
        files=files,
        timeout=300,
    )
    if response.status_code >= 400:
        raise ProviderError(
            f"POST {BASE_URL}/images/edits failed ({response.status_code}): {response.text[:300]}",
            response.status_code,
        )
    data = response.json()
    items = data.get("data") or []
    b64 = items[0].get("b64_json") if items else None
    if not b64:
        raise ProviderError("openai: no image in images/edits response")
    return f"data:image/jpeg;base64,{b64}"


def _run_video(model_id: str, input_: dict, timeout_ms: int) -> dict:
    job = post_json(
        f"{BASE_URL}/videos",
        _headers(),
        {
            "model": model_id,
            "prompt": str(input_.get("prompt") or ""),
            "seconds": str(input_.get("seconds") or "4"),
            "size": str(input_.get("size") or "1280x720"),
            "input_reference": {"image_url": str(input_.get("image_url") or "")},
        },
    )
    job_id = job.get("id")
    if not job_id:
        raise ProviderError("openai: no video id in submit response")

    def fetch_status():
        return get_json(f"{BASE_URL}/videos/{job_id}", _headers())

    def extract_done(status):
        return status if status.get("status") == "completed" else None

    def extract_error(status):
        if status.get("status") == "failed":
            return f"openai video failed: {(status.get('error') or {}).get('message') or 'unknown'}"
        return None

    poll_until_done(fetch_status, extract_done, extract_error, timeout_ms, interval_ms=5000)

    # Sora ne publie pas d'URL de sortie : téléchargement authentifié du
    # MP4, stocké localement (les data URIs vidéo seraient trop lourdes).
    data, _mime = get_bytes(f"{BASE_URL}/videos/{job_id}/content", _headers())
    return {"video": {"url": storage.save_file(data, "mp4")}}


def generate(model_id: str, input_: dict, timeout_ms: int) -> dict:
    """Contrat provider : le model_id détermine l'endpoint officiel appelé
    (images vs vidéos) — garde-fou si le catalogue évolue."""
    if model_id.startswith("sora"):
        return _run_video(model_id, input_, timeout_ms)
    try:
        count = max(1, int(input_.get("quantity") or 1))
    except (TypeError, ValueError):
        count = 1
    with ThreadPoolExecutor(max_workers=count) as pool:
        urls = list(pool.map(lambda _: _run_image_edit(model_id, input_), range(count)))
    return {"images": [{"url": url} for url in urls]}
