"""Endpoint audio / Voice Generator — démarre un job voice_generator."""
from fastapi import APIRouter, BackgroundTasks, HTTPException

from providers import elevenlabs as elevenlabs_provider
from routes.generate import StartJob, _load_pending_job
from workflows import audio as audio_workflow

router = APIRouter()


@router.post("/audio/generate")
def generate_audio(payload: StartJob, background: BackgroundTasks):
    """Démarre un job voice_generator (ElevenLabs)."""
    if not elevenlabs_provider.is_configured():
        raise HTTPException(503, "no audio provider configured on worker")
    job = _load_pending_job(payload.job_id)
    if job["type"] != "voice_generator":
        raise HTTPException(400, f"not an audio job: {job['type']}")
    background.add_task(audio_workflow.run, job)
    return {"ok": True}
