"""Workflow Voice Generator — génère un asset audio via ElevenLabs.

Entrée : job type "voice_generator" avec input JSON { text, voiceId?, model? }.
Sortie : nouvel asset type "audio", job complete, crédits débités.
"""
import db
import storage
from providers import elevenlabs
from providers.http_helpers import data_uri_to_bytes
from workflows.common import complete_job, fail_job, insert_asset, mark_processing


def run(job: dict) -> None:
    """Exécute un job voice_generator : TTS -> stockage -> completion."""
    input_ = job["input"]
    with db.connect() as conn:
        mark_processing(conn, job["id"])

    try:
        result = elevenlabs.generate(
            {
                "text": input_.get("text", ""),
                "voice_id": input_.get("voiceId") or None,
                "model_id": input_.get("model") or None,
            }
        )
        audio_url = result["audio"]["url"]
        data, mime = data_uri_to_bytes(audio_url)
        ext = "mp3" if mime == "audio/mpeg" else mime.split("/")[-1]
        storage_path = storage.save_file(data, ext)

        with db.connect() as conn:
            asset_id = insert_asset(conn, job, "audio", storage_path)
            complete_job(
                conn,
                job,
                asset_id,
                int(input_.get("creditCost") or 0),
                model_used="elevenlabs",
                provider_cost_cents=elevenlabs.COST_PER_GENERATION_CENTS,
            )
    except Exception as err:
        with db.connect() as conn:
            fail_job(conn, job, err)
