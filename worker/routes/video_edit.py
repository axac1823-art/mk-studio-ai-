"""Endpoint montage vidéo — démarre un job video_edit (trim/concat)."""
import shutil

from fastapi import APIRouter, BackgroundTasks, HTTPException

from routes.generate import StartJob, _load_pending_job
from workflows import video_edit as video_edit_workflow

router = APIRouter()


@router.post("/video/edit")
def edit_video(payload: StartJob, background: BackgroundTasks):
    """Démarre un job video_edit (trim ou concat). Requiert ffmpeg."""
    if not shutil.which("ffmpeg"):
        raise HTTPException(503, "video editing requires ffmpeg on the worker host")
    job = _load_pending_job(payload.job_id)
    if job["type"] != "video_edit":
        raise HTTPException(400, f"not a video edit job: {job['type']}")
    background.add_task(video_edit_workflow.run, job)
    return {"ok": True}
