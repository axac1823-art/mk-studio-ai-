"""Endpoint upscale — fin : vérifie la config upscale, charge le job,
dispatch en BackgroundTasks. La logique vit dans workflows/upscale.py."""
from fastapi import APIRouter, BackgroundTasks, HTTPException

from providers import upscale as upscale_provider
from routes.generate import StartJob, _load_pending_job
from workflows import upscale as upscale_workflow

router = APIRouter()


@router.post("/upscale")
def upscale(payload: StartJob, background: BackgroundTasks):
    """Démarre un job upscale sur un asset existant (image ou vidéo)."""
    if not upscale_provider.is_configured():
        raise HTTPException(503, "no upscale provider configured on worker")
    job = _load_pending_job(payload.job_id)
    if job["type"] != "upscale":
        raise HTTPException(400, f"not an upscale job: {job['type']}")
    background.add_task(upscale_workflow.run, job)
    return {"ok": True}
