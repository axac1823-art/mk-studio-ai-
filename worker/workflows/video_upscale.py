"""Workflow de changement de vitesse vidéo avec MoviePy, sans API IA externe."""
from pathlib import Path

import db
import storage
from moviepy import VideoFileClip
from workflows.common import complete_job, fail_job, insert_asset, mark_processing


def _resolve_storage_path(asset_id: str, user_id: str) -> str:
    with db.connect() as conn:
        row = conn.execute(
            "SELECT storage_path FROM assets WHERE id = %s AND user_id = %s",
            (asset_id, user_id),
        ).fetchone()
    if not row:
        raise ValueError(f"asset not found: {asset_id}")
    return row["storage_path"]


def run(job: dict) -> None:
    """Génère une copie du clip avec la vitesse demandée et son audio ajusté."""
    input_ = job["input"]
    speed_factor = int(input_.get("speedFactor") or 1)
    if speed_factor not in (1, 2, 4, 8, 16, 32):
        raise ValueError("speedFactor must be 1, 2, 4, 8, 16 or 32")

    with db.connect() as conn:
        mark_processing(conn, job["id"])

    try:
        storage_path = _resolve_storage_path(input_["assetId"], job["user_id"])
        video_path = storage.resolve(storage_path)
        out_name = storage.save_file(b"", "mp4")
        out_path = storage.resolve(out_name)

        with VideoFileClip(str(video_path)) as clip:
            speed_clip = clip.with_speed_scaled(factor=speed_factor)
            try:
                speed_clip.write_videofile(
                    str(out_path),
                    fps=clip.fps or 24,
                    codec="libx264",
                    audio_codec="aac" if speed_clip.audio is not None else None,
                    logger=None,
                )
            finally:
                speed_clip.close()

        with db.connect() as conn:
            asset_id = insert_asset(conn, job, "video", out_name)
            complete_job(conn, job, asset_id, int(input_.get("creditCost") or 0))
    except Exception as err:
        with db.connect() as conn:
            fail_job(conn, job, err)
