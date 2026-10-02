"""Endpoints de génération — volontairement FINS : validation minimale,
chargement du job, dispatch en BackgroundTasks (pas de queue externe à ce
stade — remplaçable par une vraie file plus tard sans toucher /web).
Toute la logique métier vit dans workflows/.
"""
from fastapi import APIRouter, BackgroundTasks, HTTPException
from pydantic import BaseModel

import db
from providers import is_any_provider_configured
from workflows import image_render, video

router = APIRouter()


class StartJob(BaseModel):
    """Corps des endpoints de démarrage : l'id du job créé par /web."""

    job_id: str


def _load_pending_job(job_id: str) -> dict:
    """Charge le job et vérifie qu'il est démarrable (existe + pending)."""
    with db.connect() as conn:
        job = conn.execute("SELECT * FROM jobs WHERE id = %s", (job_id,)).fetchone()
    if not job:
        raise HTTPException(404, "job not found")
    if job["status"] != "pending":
        raise HTTPException(409, "job already started")
    return job


def _load_pending_video_job(job_id: str) -> dict:
    """Charge un video_job et vérifie qu'il est démarrable."""
    with db.connect() as conn:
        job = conn.execute("SELECT * FROM video_jobs WHERE id = %s", (job_id,)).fetchone()
    if not job:
        raise HTTPException(404, "video job not found")
    if job["status"] != "pending":
        raise HTTPException(409, "video job already started")
    return job


@router.post("/generate/image")
def generate_image(payload: StartJob, background: BackgroundTasks):
    """Démarre un job image (5 features image du scope MVP)."""
    if not is_any_provider_configured():
        raise HTTPException(503, "no provider configured on worker")
    job = _load_pending_job(payload.job_id)
    if job["type"] in ("animate", "upscale"):
        raise HTTPException(400, f"not an image job: {job['type']}")
    background.add_task(image_render.run, job)
    return {"ok": True}


@router.post("/generate/video")
def generate_video(payload: StartJob, background: BackgroundTasks):
    """Démarre un job vidéo unifié (Video Generator)."""
    if not is_any_provider_configured():
        raise HTTPException(503, "no provider configured on worker")
    job = _load_pending_video_job(payload.job_id)
    background.add_task(video.run, job)
    return {"ok": True}
