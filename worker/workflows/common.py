"""Helpers partagés des workflows : normalisation des sorties providers en
fichiers stockés, et écritures DB communes (asset, completion, débit).

Règle non négociable : `error_message` côté job reste GÉNÉRIQUE (destiné
au client) — l'erreur réelle est loggée côté serveur (analytics interne).
"""
import json
import logging

import db
import storage
from providers.http_helpers import data_uri_to_bytes, get_bytes

log = logging.getLogger("workflows")

_MIME_EXT = {
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/webp": "webp",
    "video/mp4": "mp4",
    "video/webm": "webm",
    "audio/mpeg": "mp3",
}


def store_output(url: str) -> tuple[str, str]:
    """Normalise une sortie provider en (storage_path, ext).

    Trois formes acceptées : chemin "/storage/..." déjà local (renvoyé tel
    quel), data URI (décodée), URL http(s) (téléchargée).
    """
    if url.startswith("/storage/"):
        return url, url.rsplit(".", 1)[-1]
    if url.startswith("data:"):
        data, mime = data_uri_to_bytes(url)
    else:
        data, mime = get_bytes(url)
    mime = mime.split(";")[0].strip().lower()
    ext = _MIME_EXT.get(mime)
    if not ext:
        ext = "png" if mime.startswith("image/") else "mp4" if mime.startswith("video/") else "bin"
    return storage.save_file(data, ext), ext


def insert_asset(conn, job: dict, type_: str, storage_path: str) -> str:
    """Crée l'asset visible par l'utilisateur et retourne son id."""
    row = conn.execute(
        """INSERT INTO assets (project_id, user_id, type, generation_id, storage_path)
           VALUES (%s, %s, %s, %s, %s) RETURNING id""",
        (job["project_id"], job["user_id"], type_, job["id"], storage_path),
    ).fetchone()
    return str(row["id"])


def insert_video_asset(conn, job_id: str, user_id: str, project_id: str, type_: str, storage_path: str) -> str:
    """Crée un asset lié à un video_job."""
    row = conn.execute(
        """INSERT INTO assets (project_id, user_id, type, generation_id, video_job_id, storage_path)
           VALUES (%s, %s, %s, NULL, %s, %s) RETURNING id""",
        (project_id, user_id, type_, job_id, storage_path),
    ).fetchone()
    return str(row["id"])


def complete_job(conn, job: dict, result_asset_id: str, credits_charged: int, model_used: str | None = None) -> None:
    """Succès : job complete + modèle utilisé + débit IDEMPOTENT du coût
    calculé par /web (index partiel UNIQUE(ref_job_id, reason) WHERE
    ref_video_job_id IS NULL — jamais deux 'spend' pour le même job)."""
    conn.execute(
        "UPDATE jobs SET status = 'complete', result_asset_id = %s, credits_charged = %s, model_used = %s WHERE id = %s",
        (result_asset_id, credits_charged, model_used, job["id"]),
    )
    if credits_charged > 0:
        conn.execute(
            """INSERT INTO credit_ledger (user_id, delta, reason, ref_job_id, ref_video_job_id)
               VALUES (%s, %s, 'spend', %s, NULL)
               ON CONFLICT (ref_job_id, reason) WHERE ref_video_job_id IS NULL DO NOTHING""",
            (job["user_id"], -credits_charged, job["id"]),
        )


def complete_video_job(
    conn,
    job: dict,
    result_url: str,
    credits_charged: int,
    model_used: str | None = None,
) -> None:
    """Succès d'un video_job : complétion + débit idempotent via ref_video_job_id."""
    conn.execute(
        """UPDATE video_jobs
           SET status = 'complete', result_url = %s, credits_charged = %s, model_used = %s
           WHERE id = %s""",
        (result_url, credits_charged, model_used, job["id"]),
    )
    if credits_charged > 0:
        conn.execute(
            """INSERT INTO credit_ledger (user_id, delta, reason, ref_video_job_id, ref_job_id)
               VALUES (%s, %s, 'spend', %s, NULL)
               ON CONFLICT (ref_video_job_id, reason) WHERE ref_job_id IS NULL DO NOTHING""",
            (job["user_id"], -credits_charged, job["id"]),
        )


def fail_video_job(conn, job: dict, err: Exception) -> None:
    """Échec d'un video_job : message générique côté client."""
    log.error("video_job %s failed: %s", job["id"], err)
    conn.execute(
        "UPDATE video_jobs SET status = 'failed', error_message = %s WHERE id = %s",
        ("Generation failed, please try again.", job["id"]),
    )


def mark_video_processing(conn, job_id: str) -> None:
    """pending -> processing pour un video_job."""
    conn.execute(
        "UPDATE video_jobs SET status = 'processing' WHERE id = %s AND status = 'pending'",
        (job_id,),
    )


def set_video_progress(conn, job_id: str, progress: dict) -> None:
    """Met à jour le JSON de progression d'un video_job."""
    conn.execute(
        "UPDATE video_jobs SET progress = %s, updated_at = now() WHERE id = %s",
        (json.dumps(progress), job_id),
    )


def fail_job(conn, job: dict, err: Exception) -> None:
    """Échec : trace réelle côté serveur, message GÉNÉRIQUE côté client,
    AUCUN débit (les crédits ne partent qu'au succès)."""
    log.error("job %s (%s) failed: %s", job["id"], job.get("type"), err)
    conn.execute(
        "UPDATE jobs SET status = 'failed', error_message = %s WHERE id = %s",
        ("Generation failed, please try again.", job["id"]),
    )


def mark_processing(conn, job_id: str) -> None:
    """pending -> processing (sans écraser un état déjà avancé)."""
    conn.execute("UPDATE jobs SET status = 'processing' WHERE id = %s AND status = 'pending'", (job_id,))
