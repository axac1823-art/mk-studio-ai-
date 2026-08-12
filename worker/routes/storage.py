"""Upload de fichiers sources : /web verse ici les images et vidéos
uploadées par l'utilisateur pour en faire des assets réutilisables
(page Uploads) — le worker est le SEUL à écrire dans le stockage."""
from fastapi import APIRouter, File, HTTPException, UploadFile

import storage

router = APIRouter()

ALLOWED_TYPES = {
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/webp": "webp",
    "video/mp4": "mp4",
    "video/webm": "webm",
    "video/quicktime": "mov",
}
MAX_IMAGE_SIZE = 10 * 1024 * 1024
MAX_VIDEO_SIZE = 100 * 1024 * 1024


@router.post("/storage/upload")
async def upload(file: UploadFile = File(...)):
    """Stocke un fichier source (image ou vidéo) et retourne son chemin public relatif."""
    ext = ALLOWED_TYPES.get(file.content_type or "")
    if not ext:
        raise HTTPException(400, "unsupported content type (PNG, JPEG, WebP, MP4, WebM or QuickTime)")
    data = await file.read()
    if not data:
        raise HTTPException(400, "empty file")
    max_size = MAX_VIDEO_SIZE if file.content_type.startswith("video/") else MAX_IMAGE_SIZE
    if len(data) > max_size:
        raise HTTPException(400, f"file too large ({max_size // (1024 * 1024)} MB max)")
    return {"path": storage.save_file(data, ext)}


@router.delete("/storage/{name}")
def delete(name: str):
    """Supprime un fichier stocké (purge des assets trashés > 30 j, lancée
    par le script web/scripts/purge-trash.ts). Nom strictement validé par
    storage.resolve — aucun path traversal possible."""
    storage.delete_file(f"/storage/{name}")
    return {"ok": True}
