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
from concurrent.futures import ThreadPoolExecutor

import httpx

from providers.http_helpers import (
    ProviderError,
    get_json,
    parse_data_uri,
    poll_until_done,
    post_json,
    require_env,
)

BASE_URL = "https://api.magichour.ai"


def _headers() -> dict:
    return {"Authorization": f"Bearer {require_env('MAGIC_HOUR_API_KEY')}"}


def _ensure_file_path(uri: str) -> str:
    """Magic Hour n'accepte que des URL http ou des `file_path` de SON
    stockage : les data URIs (uploads utilisateur) y sont versées au
    préalable."""
    parsed = parse_data_uri(uri)
    if not parsed:
        return uri
    mime, data = parsed
    ext = mime.split("/")[1] if "/" in mime else "png"
    grant = post_json(
        f"{BASE_URL}/v1/files/upload-urls",
        _headers(),
        {"items": [{"type": "image", "extension": ext}]},
    )
    items = grant.get("items") or []
    item = items[0] if items else {}
    upload_url, file_path = item.get("upload_url"), item.get("file_path")
    if not upload_url or not file_path:
        raise ProviderError("magichour: no upload url in response")
    response = httpx.put(
        upload_url,
        headers={"Content-Type": mime},
        content=base64.b64decode(data),
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


def _run_image_edit(model_id: str, input_: dict, timeout_ms: int) -> str:
    images = input_.get("images")
    if not isinstance(images, list):
        images = []
    with ThreadPoolExecutor(max_workers=max(1, len(images))) as pool:
        file_paths = list(pool.map(_ensure_file_path, images))
    job = post_json(
        f"{BASE_URL}/v1/ai-image-editor",
        _headers(),
        {
            "model": model_id,
            "image_count": 1,
            "aspect_ratio": str(input_.get("aspectRatio") or "auto"),
            "resolution": str(input_.get("resolution") or "auto"),
            "style": {"prompt": str(input_.get("prompt") or "")},
            "assets": {"image_file_paths": file_paths},
        },
    )
    job_id = job.get("id")
    if not job_id:
        raise ProviderError("magichour: no image id in submit response")
    return _poll_project("image", job_id, timeout_ms)


def _run_video(model_id: str, input_: dict, timeout_ms: int) -> dict:
    file_path = _ensure_file_path(str(input_.get("image") or ""))
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
            "assets": {"image_file_path": file_path},
        },
    )
    job_id = job.get("id")
    if not job_id:
        raise ProviderError("magichour: no video id in submit response")
    return {"video": {"url": _poll_project("video", job_id, timeout_ms)}}


def generate(model_id: str, input_: dict, timeout_ms: int) -> dict:
    """Contrat provider : la FORME de l'input distingue l'endpoint (édition
    d'image vs vidéo) — pas le model_id (flux-2-klein en image, `default`
    en vidéo)."""
    if isinstance(input_.get("images"), list):
        try:
            count = max(1, int(input_.get("quantity") or 1))
        except (TypeError, ValueError):
            count = 1
        with ThreadPoolExecutor(max_workers=count) as pool:
            urls = list(pool.map(lambda _: _run_image_edit(model_id, input_, timeout_ms), range(count)))
        return {"images": [{"url": url} for url in urls]}
    return _run_video(model_id, input_, timeout_ms)
