"""Stockage fichiers local (dev) — remplacé par S3/Supabase Storage en prod
(l'interface save_file/get_url/resolve/delete_file restera la même).

save_file() écrit sous un nom unique dans STORAGE_DIR et retourne le chemin
PUBLIC relatif (/storage/<nom>) ; main.py monte ce dossier en statique.
"""
import uuid
from pathlib import Path

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


def delete_file(storage_path: str) -> None:
    """Suppression best-effort (purge des assets trashés)."""
    try:
        resolve(storage_path).unlink(missing_ok=True)
    except ValueError:
        pass
