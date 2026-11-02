"""Per-model Image2 frame filtering, delivery verification and exact-frame fit.

Two independent steps:

1. `filter_candidates_by_frame` keeps only models whose adapter declares the
   requested native frame, so a provider is never asked for a ratio it cannot
   produce.
2. After a provider answers, `validate_image_output_frame` rejects materially
   wrong frames (so Auto can try the next provider) and
   `crop_to_frame` trims the small provider-side approximation to the exact
   requested ratio. Cropping is center-based and never upscales, so the
   delivered asset always has the frame the user asked for.
"""
from __future__ import annotations

import io
from pathlib import Path
from urllib.parse import urlparse

from PIL import Image

import storage
from providers.http_helpers import data_uri_to_bytes, get_bytes

FRAME_RATIOS = {
    "1:1": 1.0,
    "16:9": 16 / 9,
    "9:16": 9 / 16,
    "4:3": 4 / 3,
    "3:4": 3 / 4,
    "3:2": 3 / 2,
    "2:3": 2 / 3,
    "21:9": 21 / 9,
}

# Providers document approximate pixel grids for some frames: Magic Hour's
# 16:9 output is 640x384 (6.25% away from 16:9) and its 9:16 output is 384x640
# (6.67% away), and Gemini's 21:9 profile is 4.5% away from 21:9 at 2K.
# A 2.5% tolerance treated those documented, usable outputs as hard failures,
# so the frame was never delivered. 8% accepts every documented grid while
# still rejecting a genuinely different frame (e.g. 3:2 for 16:9 is 15.6% away).
FRAME_TOLERANCE = 0.08


def filter_candidates_by_frame(candidates, aspect_ratio: str):
    """Return only models whose catalog explicitly advertises this frame."""
    expected = FRAME_RATIOS.get(aspect_ratio)
    if expected is None:
        raise ValueError(f"Unsupported Image2 frame ratio: {aspect_ratio}")
    return [candidate for candidate in candidates if aspect_ratio in candidate.frame_ratios]


def _read_image_bytes(value: str) -> bytes:
    if value.startswith("data:"):
        data, _mime = data_uri_to_bytes(value)
        return data

    path_value = value
    if value.startswith(("http://", "https://")):
        parsed = urlparse(value)
        if parsed.path.startswith("/storage/") and parsed.hostname in {"localhost", "127.0.0.1"}:
            path_value = parsed.path

    if path_value.startswith("/storage/"):
        return storage.resolve(path_value).read_bytes()

    data, _mime = get_bytes(value)
    return data


def frame_deviation(width: int, height: int, aspect_ratio: str) -> float:
    """Relative distance between the delivered frame and the requested one."""
    expected = FRAME_RATIOS.get(aspect_ratio)
    if expected is None:
        raise ValueError(f"Unsupported Image2 frame ratio: {aspect_ratio}")
    if height <= 0:
        raise ValueError("Output image has no height")
    return abs((width / height) / expected - 1.0)


def validate_image_output_frame(output_urls: list[str], aspect_ratio: str, tolerance: float = FRAME_TOLERANCE) -> None:
    """Raise if any output is further than `tolerance` from the requested frame.

    This gate only stops grossly wrong frames (a provider ignoring the ratio
    completely). Small provider-grid deviations pass and are corrected by
    `crop_to_frame` before the asset is stored.
    """
    if aspect_ratio not in FRAME_RATIOS:
        raise ValueError(f"Unsupported Image2 frame ratio: {aspect_ratio}")

    for index, url in enumerate(output_urls, start=1):
        data = _read_image_bytes(url)
        try:
            with Image.open(io.BytesIO(data)) as image:
                width, height = image.size
        except Exception as exc:
            raise ValueError(f"Could not inspect output image {index} dimensions: {exc}") from exc

        deviation = frame_deviation(width, height, aspect_ratio)
        if deviation > tolerance:
            raise ValueError(
                f"Output image {index} returned {width}x{height} ({width / height:.4f}:1), "
                f"not the requested {aspect_ratio} frame."
            )


def _save_options(image: Image.Image, image_format: str) -> dict:
    options: dict = {"format": image_format}
    if image_format.upper() in {"JPEG", "JPG"}:
        options["quality"] = 95
        options["optimize"] = True
    elif image_format.upper() == "WEBP":
        options["quality"] = 95
    return options


def crop_to_frame(storage_path: str, aspect_ratio: str) -> bool:
    """Center-crop a stored image to the exact requested frame, in place.

    Returns True when the file was rewritten. Never upscales: the shorter axis
    is kept and the longer axis is trimmed, so no pixels are invented and no
    content is stretched. Unknown/`auto` frames are left untouched.
    """
    target_ratio = FRAME_RATIOS.get(aspect_ratio)
    if target_ratio is None:
        return False

    path = Path(storage.resolve(storage_path))
    with Image.open(path) as original:
        image = original.copy()
        image_format = original.format or "PNG"

    current_ratio = image.width / image.height
    if abs(current_ratio / target_ratio - 1.0) < 0.002:
        return False

    if current_ratio > target_ratio:
        crop_width = max(1, min(image.width, round(image.height * target_ratio)))
        left = (image.width - crop_width) // 2
        image = image.crop((left, 0, left + crop_width, image.height))
    else:
        crop_height = max(1, min(image.height, round(image.width / target_ratio)))
        top = (image.height - crop_height) // 2
        image = image.crop((0, top, image.width, top + crop_height))

    if image_format.upper() in {"JPEG", "JPG"} and image.mode not in {"RGB", "L"}:
        image = image.convert("RGB")
    image.save(path, **_save_options(image, image_format))
    return True
