"""RenderStudio worker — service Python propriétaire de TOUTE la logique IA.

/web (Next.js) ne parle jamais aux providers : il crée une ligne `jobs` en
DB et appelle ces endpoints HTTP. Le worker exécute le workflow en
BackgroundTasks (pas de queue externe à ce stade) et met à jour la ligne
`jobs` dans la DB partagée — /web la lit pour le polling client.
"""
from fastapi import Depends, FastAPI
from fastapi.staticfiles import StaticFiles

from config import STORAGE_DIR
from dependencies import require_worker_key
from providers import is_any_provider_configured
from routes import audio, generate, jobs, models, upscale, video_edit, video_upscale
from routes import storage as storage_routes

app = FastAPI(title="RenderStudio Worker")

_protected = dict(dependencies=[Depends(require_worker_key)])

app.include_router(generate.router, **_protected)
app.include_router(jobs.router)
app.include_router(models.router)
app.include_router(upscale.router, **_protected)
app.include_router(audio.router, **_protected)
app.include_router(video_edit.router, **_protected)
app.include_router(video_upscale.router, **_protected)
app.include_router(storage_routes.router, **_protected)


@app.get("/health")
def health() -> dict:
    """Sonde de vie utilisée par /web : signale AUSSI si au moins un
    provider est configuré (sinon /web refuse les générations en 503)."""
    return {"status": "ok", "providers_configured": is_any_provider_configured()}


# Fichiers générés (images, vidéos) servis statiquement en dev.
STORAGE_DIR.mkdir(parents=True, exist_ok=True)
app.mount("/storage", StaticFiles(directory=STORAGE_DIR), name="storage")
