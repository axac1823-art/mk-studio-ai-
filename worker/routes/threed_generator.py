"""Endpoint 3D Generator — démarre un job 3d_generator."""
from fastapi import APIRouter, BackgroundTasks, HTTPException

from catalog import MODEL_CATALOG
from providers import is_provider_configured
from routes.generate import StartJob, _load_pending_job
from workflows import threed_generator as threed_workflow

router = APIRouter()


def _has_3d_provider() -> bool:
    return any(
        is_provider_configured(c.provider)
        for c in MODEL_CATALOG.get("3d_generator", [])
    )


@router.post("/3d-generator/generate")
def generate_3d(payload: StartJob, background: BackgroundTasks):
    """Démarre un job 3d_generator (Meshy, Tripo, Hunyuan3D, Trellis)."""
    if not _has_3d_provider():
        raise HTTPException(503, "no 3d provider configured on worker")
    job = _load_pending_job(payload.job_id)
    if job["type"] != "3d_generator":
        raise HTTPException(400, f"not a 3d generator job: {job['type']}")
    background.add_task(threed_workflow.run, job)
    return {"ok": True}
