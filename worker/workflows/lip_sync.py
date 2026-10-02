"""Workflow Lip Sync — synchronise une vidéo (ou photo d'une personne)
avec une piste audio via Magic Hour.

Entrée : job type "lip_sync" avec input JSON { videoUrl, audioUrl, creditCost }.
Sortie : asset vidéo, job complete, crédits débités.
"""
import db
import storage
from catalog import MODEL_CATALOG
from providers import PROVIDERS
from providers.http_helpers import data_uri_to_bytes
from workflows.common import complete_job, fail_job, insert_asset, mark_processing
from workflows.engine import AllModelsFailedError, execute_with_fallback


FEATURE = "lip_sync"


def _store_output(url: str) -> str:
    """Stocke le résultat provider et retourne un chemin /storage/..."""
    if url.startswith("/storage/"):
        return url
    if url.startswith("data:"):
        data, mime = data_uri_to_bytes(url)
        ext = "mp4" if mime.startswith("video/") else "bin"
        return storage.save_file(data, ext)
    import providers.http_helpers as hh
    data, mime = hh.get_bytes(url)
    ext = "mp4" if mime.startswith("video/") else "bin"
    return storage.save_file(data, ext)


def run(job: dict) -> None:
    """Exécute un job lip_sync : vidéo + audio -> synchronisation."""
    input_ = job["input"]
    with db.connect() as conn:
        mark_processing(conn, job["id"])

    try:
        candidates = MODEL_CATALOG.get(FEATURE, [])
        if not candidates:
            raise AllModelsFailedError(FEATURE, [{"candidateKey": "none", "ok": False, "error": "no lip_sync provider configured"}])

        req = {
            "videoUrl": input_.get("videoUrl"),
            "audioUrl": input_.get("audioUrl"),
            "quality": input_.get("quality") or "standard",
        }
        ordered = candidates  # un seul provider en V1
        outcome = execute_with_fallback(FEATURE, ordered, req)
        winner = outcome["winner"]
        video_url = outcome["output_urls"][0]
        storage_path = _store_output(video_url)

        with db.connect() as conn:
            asset_id = insert_asset(conn, job, "video", storage_path)
            complete_job(
                conn,
                job,
                asset_id,
                int(input_.get("creditCost") or 0),
                model_used=winner.key,
                provider_cost_cents=winner.cost_per_generation,
            )
    except Exception as err:
        with db.connect() as conn:
            fail_job(conn, job, err)
