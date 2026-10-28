"""Runway Magnific video upscaling workflow; user credits debit only after output is stored."""
import logging

import db
import storage
from providers import hitpaw, magichour, runway_video_upscale
from workflows.common import complete_job, fail_job, insert_asset, mark_processing, store_output
from moviepy import VideoFileClip

log = logging.getLogger("workflows")


def run(job: dict) -> None:
    input_ = job["input"]
    provider = input_.get("provider", "runway_magnific")
    options = {
        "resolution": input_.get("resolution", "2k"),
        "creativity": input_.get("creativity", 25),
        "sharpen": input_.get("sharpen", 25),
        "smartGrain": input_.get("smartGrain", 0),
        "flavor": input_.get("flavor", "natural"),
        "fpsBoost": input_.get("fpsBoost", False),
    }
    with db.connect() as conn:
        mark_processing(conn, job["id"])
    try:
        with db.connect() as conn:
            row = conn.execute(
                "SELECT storage_path FROM assets WHERE id = %s AND user_id = %s AND type = 'video'",
                (input_["assetId"], job["user_id"]),
            ).fetchone()
        if not row:
            raise ValueError("Source video is unavailable.")
        source_path = storage.resolve(row["storage_path"])
        with VideoFileClip(str(source_path)) as clip:
            duration = float(clip.duration or 0)
            original_width, original_height = int(clip.w), int(clip.h)
            max_duration = {"runway_magnific": 30, "magichour": 133, "hitpaw": 3600}.get(provider)
            if not duration:
                raise ValueError("Video duration could not be determined.")
            if max_duration is not None and duration > max_duration:
                raise ValueError(f"Video must be {max_duration} seconds or shorter for this AI provider.")
        if provider == "runway_magnific":
            result = runway_video_upscale.upscale(source_path, options)
            model_used = runway_video_upscale.MODEL
        elif provider == "magichour":
            result = magichour.upscale_video(row["storage_path"], duration, "1080p" if options["resolution"] == "1k" else options["resolution"])
            model_used = "magichour-video-upscaler"
        elif provider == "hitpaw":
            result = hitpaw.upscale(
                str(source_path), options["resolution"], original_width, original_height
            )
            model_used = result.get("model") or "general_restore"
        else:
            raise ValueError("Unsupported video upscaling provider.")
        stored, _ = store_output(result["url"])
        with db.connect() as conn:
            asset_id = insert_asset(conn, job, "video", stored)
            complete_job(conn, job, asset_id, int(input_.get("creditCost") or 0), model_used=model_used)
    except Exception as err:
        log.exception("video upscale job %s failed", job["id"])
        with db.connect() as conn:
            fail_job(conn, job, err)
