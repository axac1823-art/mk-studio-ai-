"""Audio Jobs ElevenLabs : TTS mono-voix et dialogue structuré par le client."""
import logging

import db
import storage
from providers import elevenlabs
from workflows.common import (
    complete_job,
    consume_audio_reservation,
    fail_job,
    insert_asset,
    release_audio_reservation,
    store_audio_output,
)

log = logging.getLogger("workflows.audio")


def run(job: dict) -> None:
    """Generate, store and complete an already-claimed audio job once."""
    input_ = job.get("input") or {}
    storage_path: str | None = None
    try:
        if job["type"] == "voice_generator":
            result = elevenlabs.generate(
                {
                    "text": input_.get("text", ""),
                    "voice_id": input_.get("voiceId") or None,
                    "model_id": input_.get("model") or None,
                }
            )
        elif job["type"] == "dialogue_generator":
            result = elevenlabs.generate_dialogue(input_)
        else:
            raise ValueError("unsupported audio job type")

        storage_path, _extension = store_audio_output(
            result["audio_bytes"], result["mime_type"]
        )

        with db.connect() as conn:
            with conn.transaction():
                consume_audio_reservation(conn, job["id"])
                asset_id = insert_asset(conn, job, "audio", storage_path)
                complete_job(
                    conn,
                    job,
                    asset_id,
                    int(input_.get("creditCost") or 0),
                    model_used=result["model"],
                    provider_cost_cents=elevenlabs.COST_PER_GENERATION_CENTS,
                )
                if result.get("provider_request_id"):
                    conn.execute(
                        "UPDATE jobs SET provider_request_id = %s WHERE id = %s AND status = 'complete'",
                        (result["provider_request_id"], job["id"]),
                    )
    except Exception as err:
        if storage_path:
            storage.delete_file(storage_path)
        log.exception("audio job %s failed", job.get("id"))
        try:
            with db.connect() as conn:
                with conn.transaction():
                    fail_job(conn, job, err)
                    release_audio_reservation(conn, job["id"])
        except Exception:
            log.exception("could not finalize failed audio job %s", job.get("id"))
