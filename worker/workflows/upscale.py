"""Workflow upscale — exécute UN job upscale sur un asset EXISTANT (image,
ou frame extraite d'une vidéo via ffmpeg).

Entrée : la ligne `jobs` (type "upscale", input JSON : assetId, factor 2|4,
enhance bool, creditCost ; colonne parent_generation_id = job source).
Sortie : un NOUVEL asset image dans le MÊME projet (l'original n'est JAMAIS
remplacé — avant/après comparable), puis job -> complete (crédits débités,
idempotent) ou failed.
"""
import base64
import shutil
import subprocess
import tempfile
from pathlib import Path

import db
import storage
from providers import upscale as upscale_provider
from providers.http_helpers import get_bytes
from workflows.common import (
    complete_job,
    fail_job,
    insert_asset,
    mark_processing,
    store_output,
)


def _extract_frame(mp4_path: Path) -> bytes:
    """Extrait la première frame d'un mp4 via ffmpeg — binaire OPTIONNEL :
    erreur claire si absent (pas d'échec silencieux)."""
    if not shutil.which("ffmpeg"):
        raise RuntimeError("ffmpeg binary not found in PATH (required to upscale a video frame)")
    with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as handle:
        out_path = Path(handle.name)
    try:
        subprocess.run(
            ["ffmpeg", "-y", "-i", str(mp4_path), "-frames:v", "1", str(out_path)],
            check=True,
            capture_output=True,
        )
        return out_path.read_bytes()
    finally:
        out_path.unlink(missing_ok=True)


def _load_source_as_data_uri(asset: dict) -> str:
    """Charge l'asset source en data URI pour les providers : disque local
    (/storage) ou téléchargement (URL distante). Vidéo -> frame ffmpeg."""
    path = asset["storage_path"]
    if path.startswith("/storage/"):
        local = storage.resolve(path)
        if asset["type"] == "video":
            data, mime = _extract_frame(local), "image/png"
        else:
            ext = path.rsplit(".", 1)[-1].lower()
            mime = {"jpg": "image/jpeg", "jpeg": "image/jpeg", "webp": "image/webp"}.get(ext, "image/png")
            data = local.read_bytes()
    else:
        # URL distante (ex. CDN d'un provider) — pas de frame pour une
        # vidéo distante en V1 (les vidéos sont stockées localement).
        if asset["type"] == "video":
            raise RuntimeError("upscaling a remote video frame is not supported yet")
        data, mime = get_bytes(path)
        mime = mime.split(";")[0].strip().lower()
    return f"data:{mime};base64,{base64.b64encode(data).decode()}"


def run(job: dict) -> None:
    """Exécute le job upscale : charge la source -> provider avec fallback
    -> NOUVEL asset -> completion. Aucune exception ne sort : toute erreur
    termine le job en 'failed' (message générique client)."""
    input_ = job["input"]
    with db.connect() as conn:
        mark_processing(conn, job["id"])
        try:
            asset = conn.execute(
                "SELECT * FROM assets WHERE id = %s AND user_id = %s",
                (input_.get("assetId"), job["user_id"]),
            ).fetchone()
            if not asset:
                raise ValueError("source asset not found or not owned by user")

            result = upscale_provider.upscale(
                {
                    "image": _load_source_as_data_uri(asset),
                    "factor": int(input_.get("factor") or 2),
                    "enhance": bool(input_.get("enhance")),
                },
                provider=input_.get("model"),
            )
            url = result["images"][0]["url"]
            path, _ext = store_output(url)
            asset_id = insert_asset(conn, job, "image", path)
            complete_job(conn, job, asset_id, int(input_.get("creditCost") or 0))
        except Exception as err:
            fail_job(conn, job, err)
