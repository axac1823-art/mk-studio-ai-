"""Per-model Image2 frame filtering and output-dimension verification.

No cropping is performed here: a provider that returns the wrong frame is
rejected so Auto can try the next compatible provider.
"""
from __future__ import annotations

import io
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


def validate_image_output_frame(output_urls: list[str], aspect_ratio: str, tolerance: float = 0.025) -> None:
    """Raise if any output differs from the requested frame by >2.5%.

    This check protects users from silently receiving a different aspect ratio.
    The tolerance allows minor provider-side pixel rounding without masking a
    real frame mismatch.
    """
    expected = FRAME_RATIOS.get(aspect_ratio)
    if expected is None:
        raise ValueError(f"Unsupported Image2 frame ratio: {aspect_ratio}")

    for index, url in enumerate(output_urls, start=1):
        data = _read_image_bytes(url)
        try:
            with Image.open(io.BytesIO(data)) as image:
                actual = image.width / image.height
                width, height = image.size
        except Exception as exc:
            raise ValueError(f"Could not inspect output image {index} dimensions: {exc}") from exc

        if abs(actual / expected - 1.0) > tolerance:
            raise ValueError(
                f"Output image {index} returned {width}x{height} ({actual:.4f}:1), "
                f"not the requested {aspect_ratio} frame."
            )
