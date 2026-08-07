"""Endpoint upscaling vidéo — démarre un job video_upscale."""
import shutil

from fastapi import APIRouter, BackgroundTasks, HTTPException

from providers import upscale as upscale_provider
from routes.generate import StartJob, _load_pending_job
from workflows import video_upscale as video_upscale_workflow

router = APIRouter()


@router.post("/video/upscale")
def video_upscale(payload: StartJob, background: BackgroundTasks):
    """Démarre un job video_upscale (frame par frame + ffmpeg)."""
    if not shutil.which("ffmpeg"):
        raise HTTPException(503, "video upscaling requires ffmpeg on the worker host")
    if not upscale_provider.is_configured():
        raise HTTPException(503, "no upscale provider configured on worker")
    job = _load_pending_job(payload.job_id)
    if job["type"] != "video_upscale":
        raise HTTPException(400, f"not a video upscale job: {job['type']}")
    background.add_task(video_upscale_workflow.run, job)
    return {"ok": True}
