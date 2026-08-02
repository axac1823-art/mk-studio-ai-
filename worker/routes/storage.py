"""Upload de fichiers sources : /web verse ici les images uploadées par
l'utilisateur pour en faire des assets réutilisables (page Uploads) —
le worker est le SEUL à écrire dans le stockage."""
from fastapi import APIRouter, File, HTTPException, UploadFile

import storage

router = APIRouter()

ALLOWED_TYPES = {"image/png": "png", "image/jpeg": "jpg", "image/webp": "webp"}
MAX_SIZE = 10 * 1024 * 1024


@router.post("/storage/upload")
async def upload(file: UploadFile = File(...)):
    """Stocke une image source et retourne son chemin public relatif."""
    ext = ALLOWED_TYPES.get(file.content_type or "")
    if not ext:
        raise HTTPException(400, "unsupported content type (PNG, JPEG or WebP)")
    data = await file.read()
    if not data or len(data) > MAX_SIZE:
        raise HTTPException(400, "invalid file (10 MB max)")
    return {"path": storage.save_file(data, ext)}


@router.delete("/storage/{name}")
def delete(name: str):
    """Supprime un fichier stocké (purge des assets trashés > 30 j, lancée
    par le script web/scripts/purge-trash.ts). Nom strictement validé par
    storage.resolve — aucun path traversal possible."""
    storage.delete_file(f"/storage/{name}")
    return {"ok": True}
