"""RenderStudio worker — service Python propriétaire de TOUTE la logique IA.

/web (Next.js) ne parle jamais aux providers : il crée une ligne `jobs` en
DB et appelle ces endpoints HTTP. Le worker exécute le workflow en
BackgroundTasks (pas de queue externe à ce stade) et met à jour la ligne
`jobs` dans la DB partagée — /web la lit pour le polling client.
"""
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

from config import STORAGE_DIR
from providers import is_any_provider_configured
from routes import generate, jobs, upscale
from routes import storage as storage_routes

app = FastAPI(title="RenderStudio Worker")

app.include_router(generate.router)
app.include_router(jobs.router)
app.include_router(upscale.router)
app.include_router(storage_routes.router)


@app.get("/health")
def health() -> dict:
    """Sonde de vie utilisée par /web : signale AUSSI si au moins un
    provider est configuré (sinon /web refuse les générations en 503)."""
    return {"status": "ok", "providers_configured": is_any_provider_configured()}


# Fichiers générés (images, vidéos) servis statiquement en dev.
STORAGE_DIR.mkdir(parents=True, exist_ok=True)
app.mount("/storage", StaticFiles(directory=STORAGE_DIR), name="storage")
