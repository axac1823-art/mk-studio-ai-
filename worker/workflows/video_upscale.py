"""Workflow upscaling vidéo — frame par frame avec le provider upscale
existant, puis ré-encodage ffmpeg.

Entrée : job type "video_upscale" avec input JSON { assetId, factor, creditCost }.
Sortie : nouvel asset vidéo, job complete.
"""
import base64
import shutil
import subprocess
import tempfile
from pathlib import Path

import db
import storage
from providers import upscale as upscale_provider
from providers.http_helpers import data_uri_to_bytes, get_bytes
from workflows.common import complete_job, fail_job, insert_asset, mark_processing


def _require_binaries() -> None:
    if not shutil.which("ffmpeg"):
        raise RuntimeError("ffmpeg binary not found in PATH")


def _resolve_storage_path(asset_id: str) -> str:
    with db.connect() as conn:
        row = conn.execute("SELECT storage_path FROM assets WHERE id = %s", (asset_id,)).fetchone()
    if not row:
        raise ValueError(f"asset not found: {asset_id}")
    return row["storage_path"]


def _fps(video_path: Path) -> float:
    """Récupère le FPS nominal avec ffprobe ; fallback 24.0 si indisponible."""
    if not shutil.which("ffprobe"):
        return 24.0
    try:
        result = subprocess.run(
            [
                "ffprobe",
                "-v",
                "error",
                "-select_streams",
                "v:0",
                "-show_entries",
                "stream=r_frame_rate",
                "-of",
                "default=noprint_wrappers=1:nokey=1",
                str(video_path),
            ],
            check=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
        )
        rate = result.stdout.strip()
        if "/" in rate:
            num, den = rate.split("/")
            return float(num) / float(den)
        return float(rate)
    except Exception:
        return 24.0


def _frame_to_data_uri(frame_path: Path) -> str:
    data = frame_path.read_bytes()
    ext = frame_path.suffix.lower()
    mime = "image/jpeg" if ext in (".jpg", ".jpeg") else "image/png" if ext == ".png" else "image/webp"
    return f"data:{mime};base64,{base64.b64encode(data).decode()}"


def _extract_frames(video_path: Path, out_dir: Path) -> None:
    out_dir.mkdir(parents=True, exist_ok=True)
    subprocess.run(
        [
            "ffmpeg",
            "-y",
            "-i",
            str(video_path),
            "-q:v",
            "2",
            str(out_dir / "frame_%04d.jpg"),
        ],
        check=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )


def _upscale_frames(in_dir: Path, out_dir: Path, factor: int) -> None:
    out_dir.mkdir(parents=True, exist_ok=True)
    frames = sorted(in_dir.glob("frame_*.jpg"))
    if not frames:
        raise RuntimeError("no frames extracted")
    for idx, frame in enumerate(frames, start=1):
        result = upscale_provider.upscale(
            {
                "image": _frame_to_data_uri(frame),
                "factor": factor,
                "enhance": False,
            }
        )
        url = result["images"][0]["url"]
        if url.startswith("data:"):
            data, mime = data_uri_to_bytes(url)
        else:
            data, mime = get_bytes(url)
        ext = "jpg" if mime in ("image/jpeg", "image/jpg") else mime.split("/")[-1]
        (out_dir / f"upscaled_{idx:04d}.{ext}").write_bytes(data)


def _encode_video(upscaled_dir: Path, output_path: Path, fps: float) -> None:
    frames = sorted(upscaled_dir.glob("upscaled_*"))
    if not frames:
        raise RuntimeError("no upscaled frames")
    pattern = str(upscaled_dir / "upscaled_%04d.*")
    subprocess.run(
        [
            "ffmpeg",
            "-y",
            "-framerate",
            str(fps),
            "-i",
            pattern,
            "-c:v",
            "libx264",
            "-pix_fmt",
            "yuv420p",
            "-movflags",
            "+faststart",
            str(output_path),
        ],
        check=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )


def run(job: dict) -> None:
    """Exécute un job video_upscale : frames -> upscale -> ré-encodage."""
    input_ = job["input"]
    factor = int(input_.get("factor") or 2)
    if factor not in (2, 4):
        raise ValueError("factor must be 2 or 4")

    with db.connect() as conn:
        mark_processing(conn, job["id"])

    try:
        _require_binaries()
        if not upscale_provider.is_configured():
            raise RuntimeError("no upscale provider configured")

        storage_path = _resolve_storage_path(input_["assetId"])
        video_path = storage.resolve(storage_path)
        fps = _fps(video_path)

        with tempfile.TemporaryDirectory() as tmp:
            tmp_path = Path(tmp)
            in_dir = tmp_path / "in"
            up_dir = tmp_path / "up"
            out_name = storage.save_file(b"", "mp4")
            out_path = storage.resolve(out_name)

            _extract_frames(video_path, in_dir)
            _upscale_frames(in_dir, up_dir, factor)
            _encode_video(up_dir, out_path, fps)

        with db.connect() as conn:
            asset_id = insert_asset(conn, job, "video", out_name)
            complete_job(conn, job, asset_id, int(input_.get("creditCost") or 0))
    except Exception as err:
        with db.connect() as conn:
            fail_job(conn, job, err)
