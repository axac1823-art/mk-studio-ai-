"""Helpers partagés des workflows : normalisation des sorties providers en
fichiers stockés, et écritures DB communes (asset, completion, débit).

Les erreurs détaillées des fournisseurs restent dans les journaux serveur.
`error_message` contient une explication sûre et exploitable côté client.
"""
import json
import logging

import db
import storage
from providers.http_helpers import data_uri_to_bytes, get_bytes
from workflows.engine import AllModelsFailedError

log = logging.getLogger("workflows")

_MIME_EXT = {
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/webp": "webp",
    "video/mp4": "mp4",
    "video/webm": "webm",
    "audio/mpeg": "mp3",
    "audio/mp3": "mp3",
    "audio/wav": "wav",
    "audio/wave": "wav",
    "audio/x-wav": "wav",
    "audio/ogg": "ogg",
    "audio/webm": "webm",
    "audio/mp4": "mp4",
}


def _client_failure_message(err: Exception) -> str:
    """Traduit les erreurs providers en messages actionnables sans exposer
    les réponses brutes, URLs internes ou détails d'authentification."""
    if isinstance(err, AllModelsFailedError):
        errors = [str(attempt.get("error") or "").lower() for attempt in err.attempts]
    else:
        errors = [str(err).lower()]

    combined = "\n".join(errors)
    if not combined.strip():
        return "No AI model is available for this feature. Configure a provider and try again."

    if any(
        marker in combined
        for marker in (
            "insufficient_quota",
            "credit_balance_exhausted",
            "exceeded your current quota",
            "quota exceeded",
            "no credits remaining",
            "insufficient credits",
            "insufficient_credits",
        )
    ):
        return "The AI provider has reached its quota or billing limit. Check its usage and billing, or try another available model."

    if "failed (429)" in combined or "rate limit" in combined or "resource_exhausted" in combined:
        return "The AI provider rate limit was reached. Wait a moment, then try again."

    if any(
        marker in combined
        for marker in (
            "failed (401)",
            "failed (403)",
            "invalid api key",
            "invalid_api_key",
            "invalid_token",
            "invalid_grant",
            "token expired",
            "expired token",
            "key expired",
            "api key not valid",
            "unauthorized",
            "permission_denied",
        )
    ):
        return "The AI provider API key is invalid, expired, or lacks access. Update the provider configuration."

    if errors and all(
        any(
            marker in error
            for marker in ("not configured", "missing ", "no matching model", "no provider", "provider configured")
        )
        for error in errors
    ):
        return "No configured AI provider is available for this feature. Add a valid provider API key to the worker and restart it."

    if any(
        marker in combined
        for marker in (
            "failed (500)",
            "failed (502)",
            "failed (503)",
            "failed (504)",
            "timeout",
            "timed out",
            "connecterror",
            "connect timeout",
            "read timeout",
            "network error",
            "temporarily unavailable",
            "connection error",
            "service unavailable",
        )
    ):
        return "The AI provider is temporarily unavailable. Please try again in a few minutes."

    return "Generation failed because of an AI provider error. Check the provider configuration and try again."


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


def store_audio_output(data: bytes, mime_type: str) -> tuple[str, str]:
    """Save only known audio MIME types using a fixed extension allowlist."""
    mime = mime_type.split(";", 1)[0].strip().lower()
    extension = _MIME_EXT.get(mime)
    if not extension or not mime.startswith("audio/"):
        raise ValueError(f"unsupported audio MIME type: {mime}")
    if not data:
        raise ValueError("audio provider returned an empty file")
    return storage.save_file(data, extension), extension


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


def complete_job(conn, job: dict, result_asset_id: str, credits_charged: int, model_used: str | None = None, provider_cost_cents: int | None = None) -> None:
    """Succès : job complete + modèle utilisé + coût provider + débit
    IDEMPOTENT du coût calculé par /web (index partiel
    UNIQUE(ref_job_id, reason) WHERE ref_video_job_id IS NULL — jamais deux
    'spend' pour le même job)."""
    updated = conn.execute(
        """UPDATE jobs
           SET status = 'complete', result_asset_id = %s, credits_charged = %s,
               model_used = %s, provider_cost_cents = %s
           WHERE id = %s AND status = 'processing'""",
        (result_asset_id, credits_charged, model_used, provider_cost_cents, job["id"]),
    )
    if updated.rowcount != 1:
        raise RuntimeError(f"job {job['id']} is not processing; completion rejected")
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
    provider_cost_cents: int | None = None,
) -> None:
    """Succès d'un video_job : complétion + coût provider + débit idempotent via ref_video_job_id."""
    conn.execute(
        """UPDATE video_jobs
           SET status = 'complete', result_url = %s, credits_charged = %s, model_used = %s, provider_cost_cents = %s
           WHERE id = %s""",
        (result_url, credits_charged, model_used, provider_cost_cents, job["id"]),
    )
    if credits_charged > 0:
        conn.execute(
            """INSERT INTO credit_ledger (user_id, delta, reason, ref_video_job_id, ref_job_id)
               VALUES (%s, %s, 'spend', %s, NULL)
               ON CONFLICT (ref_video_job_id, reason) WHERE ref_job_id IS NULL DO NOTHING""",
            (job["user_id"], -credits_charged, job["id"]),
        )


def fail_video_job(conn, job: dict, err: Exception) -> None:
    """Échec d'un video_job : message client classé, détails providers
    conservés dans le journal serveur pour le diagnostic."""
    if isinstance(err, AllModelsFailedError):
        log.error("video_job %s failed: %s\nattempts=%s", job["id"], err, err.attempts)
    else:
        log.error("video_job %s failed: %s", job["id"], err)
    conn.execute(
        "UPDATE video_jobs SET status = 'failed', error_message = %s WHERE id = %s",
        (_client_failure_message(err), job["id"]),
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
    """Échec : détails provider uniquement dans le journal serveur, message
    client actionnable, AUCUN débit (les crédits ne partent qu'au succès)."""
    if isinstance(err, AllModelsFailedError):
        log.error("job %s (%s) failed: %s\nattempts=%s", job["id"], job.get("type"), err, err.attempts)
    else:
        log.error("job %s (%s) failed: %s", job["id"], job.get("type"), err)
    conn.execute(
        "UPDATE jobs SET status = 'failed', error_message = %s WHERE id = %s AND status = 'processing'",
        (_client_failure_message(err), job["id"]),
    )


def consume_audio_reservation(conn, job_id: str) -> None:
    """Atomically transition an audio credit hold before ledger consumption."""
    result = conn.execute(
        """UPDATE audio_credit_reservations
           SET status = 'consumed', updated_at = now()
           WHERE job_id = %s AND status = 'reserved'
           RETURNING job_id""",
        (job_id,),
    )
    if result.rowcount != 1:
        raise RuntimeError(f"audio credit reservation for job {job_id} is not active")


def release_audio_reservation(conn, job_id: str) -> None:
    """Release a hold after a failed audio job; repeated calls are harmless."""
    conn.execute(
        """UPDATE audio_credit_reservations
           SET status = 'released', updated_at = now()
           WHERE job_id = %s AND status = 'reserved'""",
        (job_id,),
    )


def mark_processing(conn, job_id: str) -> None:
    """pending -> processing (sans écraser un état déjà avancé)."""
    conn.execute("UPDATE jobs SET status = 'processing' WHERE id = %s AND status = 'pending'", (job_id,))
