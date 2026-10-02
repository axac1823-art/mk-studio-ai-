"""Endpoints de démarrage idempotent des Audio Jobs ElevenLabs."""
from fastapi import APIRouter, BackgroundTasks, HTTPException

import db
from providers import elevenlabs as elevenlabs_provider
from providers.http_helpers import ProviderError
from routes.generate import StartJob
from workflows import audio as audio_workflow

router = APIRouter()

_AUDIO_JOB_TYPES = {"voice_generator", "dialogue_generator"}


def _claim_audio_job(job_id: str) -> tuple[dict, bool]:
    """Atomically claim pending -> processing so duplicate starts run once."""
    with db.connect() as conn:
        job = conn.execute(
            """UPDATE jobs SET status = 'processing'
               WHERE id = %s AND status = 'pending'
               RETURNING *""",
            (job_id,),
        ).fetchone()
        if job:
            return job, True
        existing = conn.execute("SELECT * FROM jobs WHERE id = %s", (job_id,)).fetchone()
    if not existing:
        raise HTTPException(404, "job not found")
    if existing["type"] not in _AUDIO_JOB_TYPES:
        raise HTTPException(400, f"not an audio job: {existing['type']}")
    return existing, False


def _validate_job(job: dict) -> None:
    input_ = job.get("input") or {}
    try:
        if job["type"] == "voice_generator":
            _text, voice_id, _model = elevenlabs_provider.validate_single_input(input_)
            voice_ids = {voice_id} if input_.get("voiceId") or input_.get("voice_id") else set()
        elif job["type"] == "dialogue_generator":
            turns = elevenlabs_provider.normalize_dialogue_inputs(input_.get("inputs"))
            voice_ids = {turn["voice_id"] for turn in turns}
            language_code = input_.get("languageCode") or input_.get("language_code")
            if language_code and (not isinstance(language_code, str) or len(language_code) != 2 or not language_code.isalpha()):
                raise ProviderError("elevenlabs: language code must be a two-letter ISO code")
            seed = input_.get("seed")
            if seed is not None and (isinstance(seed, bool) or not isinstance(seed, int) or not 0 <= seed <= 4_294_967_295):
                raise ProviderError("elevenlabs: seed must be between 0 and 4294967295")
        else:
            raise HTTPException(400, f"not an audio job: {job['type']}")
        elevenlabs_provider.validate_voice_ids(voice_ids)
    except ProviderError as err:
        raise HTTPException(422, "Invalid audio generation input.") from err


@router.post("/audio/generate")
def generate_audio(payload: StartJob, background: BackgroundTasks):
    """Claim an audio job once and run it in FastAPI's existing background task."""
    if not elevenlabs_provider.is_configured():
        raise HTTPException(503, "no audio provider configured on worker")

    with db.connect() as conn:
        job = conn.execute("SELECT * FROM jobs WHERE id = %s", (payload.job_id,)).fetchone()
    if not job:
        raise HTTPException(404, "job not found")
    if job["type"] not in _AUDIO_JOB_TYPES:
        raise HTTPException(400, f"not an audio job: {job['type']}")
    if job["status"] != "pending":
        # A retry after a lost HTTP response receives the same accepted result;
        # it never schedules a second provider generation.
        return {"ok": True, "already_started": True}

    _validate_job(job)
    claimed_job, claimed = _claim_audio_job(payload.job_id)
    if claimed:
        background.add_task(audio_workflow.run, claimed_job)
    return {"ok": True, "already_started": not claimed}
