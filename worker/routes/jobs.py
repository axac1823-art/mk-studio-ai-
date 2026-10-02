"""Lecture d'un job côté worker (debug/ops) — /web lit la DB directement
pour son polling, cet endpoint sert de vérification simple."""
from fastapi import APIRouter, HTTPException

import db

router = APIRouter()


@router.get("/jobs/{job_id}")
def get_job(job_id: str):
    """Statut public d'un job (pas de détail provider — jamais exposé)."""
    with db.connect() as conn:
        job = conn.execute(
            "SELECT id, type, status, error_message, credits_charged, created_at FROM jobs WHERE id = %s",
            (job_id,),
        ).fetchone()
    if not job:
        raise HTTPException(404, "job not found")
    job["created_at"] = job["created_at"].isoformat()
    return job
