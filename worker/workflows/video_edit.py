"""Workflow montage vidéo simple — trim, concat, speed, text overlay et
export résolution via ffmpeg.

Entrée : job type "video_edit" avec input JSON :
- trim : { operation: "trim", assetId, startSeconds, endSeconds }
- concat : { operation: "concat", assetIds: [...] }
- speed : { operation: "speed", assetId, speed: float }
- overlay : { operation: "overlay", assetId, text: str, position?: str }
- export : { operation: "export", assetId, width: int, height: int }

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


def _speed_video(input_path: Path, output_path: Path, speed: float) -> None:
    """Change la vitesse de lecture en conservant audio (si possible)."""
    _require_ffmpeg()
    if speed <= 0:
        raise ValueError("speed must be positive")
    # setpts modifie la vidéo ; atempo ne supporte que [0.5, 2.0] et est chaîné
    # pour couvrir un intervalle raisonnable (jusqu'à 4x).
    atempo = speed
    atempo_filters = []
    while atempo > 2.0:
        atempo_filters.append("atempo=2.0")
        atempo /= 2.0
    while atempo < 0.5:
        atempo_filters.append("atempo=0.5")
        atempo *= 2.0
    atempo_filters.append(f"atempo={atempo}")
    audio_filter = f"{','.join(atempo_filters)}" if atempo_filters else None
    vf = f"setpts={1 / speed}*PTS"
    cmd = [
        "ffmpeg",
        "-y",
        "-i",
        str(input_path),
        "-filter:v",
        vf,
    ]
    if audio_filter:
        cmd.extend(["-filter:a", audio_filter])
    else:
        cmd.extend(["-an"])
    cmd.extend([
        "-c:v",
        "libx264",
        "-preset",
        "fast",
        "-crf",
        "23",
        "-c:a",
        "aac",
        str(output_path),
    ])
    subprocess.run(cmd, check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)


def _overlay_video(input_path: Path, output_path: Path, text: str, position: str = "bottom") -> None:
    """Ajoute un texte en overlay avec drawtext."""
    _require_ffmpeg()
    if not text.strip():
        raise ValueError("overlay text is empty")
    positions = {
        "top": "x=(w-text_w)/2:y=24",
        "bottom": "x=(w-text_w)/2:y=h-text_h-24",
        "center": "x=(w-text_w)/2:y=(h-text_h)/2",
    }
    y_pos = positions.get(position, positions["bottom"])
    escape = text.replace("\\", "\\\\").replace(":", "\\:").replace("'", "\\'")
    drawtext = (
        f"drawtext=text='{escape}':fontcolor=white:fontsize=h/18:box=1:boxcolor=black@0.5:"
        f"boxborderw=4:{y_pos}"
    )
    subprocess.run(
        [
            "ffmpeg",
            "-y",
            "-i",
            str(input_path),
            "-vf",
            drawtext,
            "-c:a",
            "copy",
            "-c:v",
            "libx264",
            "-preset",
            "fast",
            "-crf",
            "23",
            str(output_path),
        ],
        check=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )


def _export_video(input_path: Path, output_path: Path, width: int, height: int) -> None:
    """Ré-encode une vidéo à une résolution cible."""
    _require_ffmpeg()
    if width <= 0 or height <= 0:
        raise ValueError("width and height must be positive")
    subprocess.run(
        [
            "ffmpeg",
            "-y",
            "-i",
            str(input_path),
            "-vf",
            f"scale={width}:{height}:force_original_aspect_ratio=decrease,pad={width}:{height}:(ow-iw)/2:(oh-ih)/2:black",
            "-c:a",
            "copy",
            "-c:v",
            "libx264",
            "-preset",
            "fast",
            "-crf",
            "23",
            str(output_path),
        ],
        check=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )


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

        elif operation == "speed":
            asset_id = input_["assetId"]
            speed = float(input_.get("speed", 1))
            storage_path = _resolve_storage_path(asset_id, job["user_id"])
            input_abs = storage.resolve(storage_path)
            out_name = storage.save_file(b"", "mp4")
            out_abs = storage.resolve(out_name)
            _speed_video(input_abs, out_abs, speed)
            result_path = out_name

        elif operation == "overlay":
            asset_id = input_["assetId"]
            text = str(input_.get("text") or "")
            position = str(input_.get("position") or "bottom")
            storage_path = _resolve_storage_path(asset_id, job["user_id"])
            input_abs = storage.resolve(storage_path)
            out_name = storage.save_file(b"", "mp4")
            out_abs = storage.resolve(out_name)
            _overlay_video(input_abs, out_abs, text, position)
            result_path = out_name

        elif operation == "export":
            asset_id = input_["assetId"]
            width = int(input_.get("width", 1920))
            height = int(input_.get("height", 1080))
            storage_path = _resolve_storage_path(asset_id, job["user_id"])
            input_abs = storage.resolve(storage_path)
            out_name = storage.save_file(b"", "mp4")
            out_abs = storage.resolve(out_name)
            _export_video(input_abs, out_abs, width, height)
            result_path = out_name

        else:
            raise ValueError(f"unknown video edit operation: {operation}")

        with db.connect() as conn:
            asset_id = insert_asset(conn, job, "video", result_path)
            complete_job(conn, job, asset_id, int(input_.get("creditCost") or 0))
    except Exception as err:
        with db.connect() as conn:
            fail_job(conn, job, err)
