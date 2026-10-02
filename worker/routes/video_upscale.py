"""Endpoint de changement de vitesse vidéo — démarre un job worker."""
from fastapi import APIRouter, BackgroundTasks, HTTPException

from routes.generate import StartJob, _load_pending_job
from workflows import video_upscale as video_upscale_workflow

router = APIRouter()


@router.post("/video/upscale")
def video_upscale(payload: StartJob, background: BackgroundTasks):
    """Démarre un job de changement de vitesse avec MoviePy."""
    job = _load_pending_job(payload.job_id)
    if job["type"] != "video_upscale":
        raise HTTPException(400, f"not a video upscale job: {job['type']}")
    background.add_task(video_upscale_workflow.run, job)
    return {"ok": True}
