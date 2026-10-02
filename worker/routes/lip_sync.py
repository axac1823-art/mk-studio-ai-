"""Endpoint Lip Sync — démarre un job lip_sync."""
from fastapi import APIRouter, BackgroundTasks, HTTPException

from catalog import MODEL_CATALOG
from providers import is_provider_configured
from routes.generate import StartJob, _load_pending_job
from workflows import lip_sync as lip_sync_workflow

router = APIRouter()


def _has_lip_sync_provider() -> bool:
    return any(
        is_provider_configured(c.provider)
        for c in MODEL_CATALOG.get("lip_sync", [])
    )


@router.post("/lip-sync/generate")
def generate_lip_sync(payload: StartJob, background: BackgroundTasks):
    """Démarre un job lip_sync (Magic Hour)."""
    if not _has_lip_sync_provider():
        raise HTTPException(503, "no lip-sync provider configured on worker")
    job = _load_pending_job(payload.job_id)
    if job["type"] != "lip_sync":
        raise HTTPException(400, f"not a lip-sync job: {job['type']}")
    background.add_task(lip_sync_workflow.run, job)
    return {"ok": True}
