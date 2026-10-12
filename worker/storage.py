"""Stockage fichiers local (dev) — remplacé par S3/Supabase Storage en prod
(l'interface save_file/get_url/resolve/delete_file restera la même).

save_file() écrit sous un nom unique dans STORAGE_DIR et retourne le chemin
PUBLIC relatif (/storage/<nom>) ; main.py monte ce dossier en statique.
"""
import base64
import mimetypes
import uuid
from pathlib import Path
from urllib.parse import unquote, urlsplit

from config import PUBLIC_BASE_URL, STORAGE_DIR


def save_file(data: bytes, ext: str) -> str:
    """Écrit `data` et retourne le chemin public relatif (/storage/<uuid>.<ext>)."""
    STORAGE_DIR.mkdir(parents=True, exist_ok=True)
    name = f"{uuid.uuid4()}.{ext.lstrip('.')}"
    (STORAGE_DIR / name).write_bytes(data)
    return f"/storage/{name}"


def get_url(storage_path: str) -> str:
    """Chemin public relatif -> URL absolue consommable par le navigateur."""
    return f"{PUBLIC_BASE_URL}{storage_path}"


def resolve(storage_path: str) -> Path:
    """Chemin public relatif -> chemin disque (validation anti-traversal :
    un seul segment de nom, aucun séparateur)."""
    name = storage_path.removeprefix("/storage/")
    if not name or "/" in name or "\\" in name or ".." in name:
        raise ValueError(f"invalid storage path: {storage_path!r}")
    return STORAGE_DIR / name


def local_path_from_url(uri: str) -> Path | None:
    """Retourne le fichier local correspondant à un chemin storage ou son URL publique."""
    if uri.startswith("/storage/"):
        return resolve(unquote(urlsplit(uri).path))

    parsed = urlsplit(uri)
    public = urlsplit(PUBLIC_BASE_URL)
    if parsed.scheme not in ("http", "https") or not parsed.path.startswith("/storage/"):
        return None

    path = resolve(unquote(parsed.path))
    if parsed.netloc == public.netloc or path.is_file():
        return path
    return None


def image_data_uri_if_local(uri: str) -> str:
    """Encode local storage images for providers that require inline image data."""
    path = local_path_from_url(uri)
    if path is None:
        return uri
    mime = mimetypes.guess_type(path.name)[0] or "image/png"
    if not mime.startswith("image/"):
        raise ValueError(f"storage asset is not an image: {path.name}")
    encoded = base64.b64encode(path.read_bytes()).decode("ascii")
    return f"data:{mime};base64,{encoded}"


def delete_file(storage_path: str) -> None:
    """Suppression best-effort (purge des assets trashés)."""
    try:
        resolve(storage_path).unlink(missing_ok=True)
    except ValueError:
        pass
