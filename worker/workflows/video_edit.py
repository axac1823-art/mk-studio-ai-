"""Workflow montage vidéo simple — trim ou concat via ffmpeg.

Entrée : job type "video_edit" avec input JSON :
- trim : { operation: "trim", assetId, startSeconds, endSeconds }
- concat : { operation: "concat", assetIds: [...] }

Sortie : nouvel asset vidéo, job complete.
"""
import subprocess
import tempfile
from pathlib import Path

import db
import storage
from workflows.common import complete_job, fail_job, insert_asset, mark_processing


def _require_ffmpeg() -> None:
    import shutil

    if not shutil.which("ffmpeg"):
        raise RuntimeError("ffmpeg binary not found in PATH")


def _resolve_storage_path(asset_id: str, user_id: str) -> str:
    with db.connect() as conn:
        row = conn.execute(
            "SELECT storage_path FROM assets WHERE id = %s AND user_id = %s",
            (asset_id, user_id),
        ).fetchone()
    if not row:
        raise ValueError(f"asset not found: {asset_id}")
    return row["storage_path"]


def _trim_video(input_path: Path, output_path: Path, start: float, end: float) -> None:
    _require_ffmpeg()
    subprocess.run(
        [
            "ffmpeg",
            "-y",
            "-ss",
            str(start),
            "-to",
            str(end),
            "-i",
            str(input_path),
            "-c",
            "copy",
            str(output_path),
        ],
        check=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )


def _concat_videos(input_paths: list[Path], output_path: Path) -> None:
    _require_ffmpeg()
    with tempfile.NamedTemporaryFile(mode="w", suffix=".txt", delete=False) as list_file:
        for p in input_paths:
            list_file.write(f"file '{p.as_posix()}'\n")
        list_path = list_file.name

    try:
        subprocess.run(
            [
                "ffmpeg",
                "-y",
                "-f",
                "concat",
                "-safe",
                "0",
                "-i",
                list_path,
                "-c",
                "copy",
                str(output_path),
            ],
            check=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
        )
    finally:
        Path(list_path).unlink(missing_ok=True)


def run(job: dict) -> None:
    """Exécute un job video_edit (trim ou concat)."""
    input_ = job["input"]
    operation = input_.get("operation")

    with db.connect() as conn:
        mark_processing(conn, job["id"])

    try:
        if operation == "trim":
            asset_id = input_["assetId"]
            start = float(input_.get("startSeconds", 0))
            end = float(input_.get("endSeconds", 0))
            if end <= start:
                raise ValueError("endSeconds must be greater than startSeconds")
            storage_path = _resolve_storage_path(asset_id, job["user_id"])
            input_abs = storage.resolve(storage_path)
            out_name = storage.save_file(b"", "mp4")
            out_abs = storage.resolve(out_name)
            _trim_video(input_abs, out_abs, start, end)
            result_path = out_name

        elif operation == "concat":
            asset_ids = input_.get("assetIds") or []
            if len(asset_ids) < 2:
                raise ValueError("concat requires at least two assets")
            storage_paths = [_resolve_storage_path(aid, job["user_id"]) for aid in asset_ids]
            input_abs_paths = [storage.resolve(p) for p in storage_paths]
            out_name = storage.save_file(b"", "mp4")
            out_abs = storage.resolve(out_name)
            _concat_videos(input_abs_paths, out_abs)
            result_path = out_name

        else:
            raise ValueError(f"unknown video edit operation: {operation}")

        with db.connect() as conn:
            asset_id = insert_asset(conn, job, "video", result_path)
            complete_job(conn, job, asset_id, int(input_.get("creditCost") or 0))
    except Exception as err:
        with db.connect() as conn:
            fail_job(conn, job, err)
