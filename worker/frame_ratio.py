"""Filtrer les modèles Image2 et corriger les légers écarts de cadrage."""
from __future__ import annotations

import base64
import io
import logging
from urllib.parse import urlparse

from PIL import Image, ImageFilter, ImageOps

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

logger = logging.getLogger(__name__)


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


def normalize_image_output_frame(
    output_urls: list[str],
    aspect_ratio: str,
    max_relative_adjustment: float = 0.08,
) -> list[str]:
    """Compléter les petits écarts de cadrage sans recadrer ni rééchantillonner la source.

    L'image source reste centrée à sa taille de pixels originale. Un fond flouté
    complète la toile pour corriger les sorties proches du ratio demandé (par
    exemple 640x384 pour 16:9) sans perdre de contenu. Les grands écarts ne sont
    pas modifiés et restent refusés par le validateur strict.
    """
    expected = FRAME_RATIOS.get(aspect_ratio)
    if expected is None:
        raise ValueError(f"Unsupported Image2 frame ratio: {aspect_ratio}")

    normalized: list[str] = []
    for index, url in enumerate(output_urls, start=1):
        data = _read_image_bytes(url)
        try:
            with Image.open(io.BytesIO(data)) as source:
                image = ImageOps.exif_transpose(source).convert("RGBA")
        except Exception as exc:
            raise ValueError(f"Could not inspect output image {index} dimensions: {exc}") from exc

        width, height = image.size
        actual = width / height
        relative_adjustment = abs(actual / expected - 1.0)
        if relative_adjustment <= 0.025 or relative_adjustment > max_relative_adjustment:
            normalized.append(url)
            continue

        if actual < expected:
            canvas_width = max(width, round(height * expected))
            canvas_height = height
        else:
            canvas_width = width
            canvas_height = max(height, round(width / expected))

        background = ImageOps.fit(
            image.convert("RGB"),
            (canvas_width, canvas_height),
            method=Image.Resampling.LANCZOS,
        )
        blur_radius = max(8, round(min(canvas_width, canvas_height) * 0.025))
        background = background.filter(ImageFilter.GaussianBlur(radius=blur_radius)).convert("RGBA")
        offset = ((canvas_width - width) // 2, (canvas_height - height) // 2)
        background.alpha_composite(image, dest=offset)

        output = io.BytesIO()
        background.save(output, format="PNG", optimize=True)
        normalized.append("data:image/png;base64," + base64.b64encode(output.getvalue()).decode("ascii"))
        logger.info(
            "Image2 frame padded: requested=%s original=%dx%d output=%dx%d",
            aspect_ratio,
            width,
            height,
            canvas_width,
            canvas_height,
        )

    return normalized
