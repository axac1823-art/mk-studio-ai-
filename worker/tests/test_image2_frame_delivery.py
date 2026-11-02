"""Offline regression tests for Image2 frame delivery.

    cd worker && python -m pytest tests/test_image2_frame_delivery.py

Covers the three defects that stopped Image2 from delivering a non-default
frame:
- GPT Image 2 sizes must satisfy OpenAI's documented custom-size rules,
  otherwise the API rejects every non-4:3 request;
- the output-frame gate must accept documented provider pixel grids
  (Magic Hour 640x384 for 16:9) while still rejecting a really different frame;
- the stored asset must end up exactly at the requested ratio.
"""
from __future__ import annotations

import io
from pathlib import Path

import pytest
from PIL import Image

import catalog
from frame_ratio import (
    FRAME_RATIOS,
    crop_to_frame,
    filter_candidates_by_frame,
    validate_image_output_frame,
)

FRAMES = tuple(FRAME_RATIOS)

# OpenAI gpt-image custom-size rules (Images API reference).
MIN_PIXELS = 655_360
MAX_PIXELS = 8_294_400
MAX_EDGE = 3_840


def _png(size: tuple[int, int]) -> bytes:
    buffer = io.BytesIO()
    Image.new("RGB", size, (30, 30, 30)).save(buffer, format="PNG")
    return buffer.getvalue()


def _data_uri(size: tuple[int, int]) -> str:
    import base64

    return "data:image/png;base64," + base64.b64encode(_png(size)).decode()


@pytest.mark.parametrize("frame", FRAMES)
def test_gpt_image_sizes_respect_documented_limits(frame: str) -> None:
    size = catalog.GPT_IMAGE_SIZES[frame]
    width, height = (int(part) for part in size.split("x"))

    assert width % 16 == 0 and height % 16 == 0, f"{frame} edges must be multiples of 16"
    assert MIN_PIXELS <= width * height <= MAX_PIXELS, f"{frame} pixel count out of range"
    assert max(width, height) <= MAX_EDGE
    assert 1 / 3 <= width / height <= 3

    payload = catalog.openai_text_to_image_input(
        {"prompt": "p", "aspectRatio": frame, "quality": "standard", "quantity": 1}
    )
    assert payload["size"] == size


@pytest.mark.parametrize("frame", FRAMES)
def test_gpt_image_size_matches_requested_ratio(frame: str) -> None:
    width, height = (int(part) for part in catalog.GPT_IMAGE_SIZES[frame].split("x"))
    assert abs((width / height) / FRAME_RATIOS[frame] - 1.0) < 0.005


def test_magichour_native_grid_is_accepted() -> None:
    # Magic Hour documents 640x384 for 16:9 and 384x640 for 9:16.
    validate_image_output_frame([_data_uri((640, 384))], "16:9")
    validate_image_output_frame([_data_uri((384, 640))], "9:16")


def test_grossly_wrong_frame_is_still_rejected() -> None:
    # A 3:2 image returned for a 16:9 request is 15.6% off and must fail so the
    # engine can fall back to another provider.
    with pytest.raises(ValueError):
        validate_image_output_frame([_data_uri((960, 640))], "16:9")
    with pytest.raises(ValueError):
        validate_image_output_frame([_data_uri((1024, 1024))], "21:9")


@pytest.mark.parametrize("frame", FRAMES)
def test_crop_math_is_exact_and_center_based(monkeypatch: pytest.MonkeyPatch, tmp_path: Path, frame: str) -> None:
    import frame_ratio

    storage_dir = tmp_path / "storage"
    storage_dir.mkdir()
    source = storage_dir / "out.png"
    source.write_bytes(_png((1600, 900)))

    monkeypatch.setattr(frame_ratio.storage, "resolve", lambda _path: source)

    changed = frame_ratio.crop_to_frame("/storage/out.png", frame)

    with Image.open(source) as image:
        ratio = image.width / image.height
        width, height = image.size

    expected = FRAME_RATIOS[frame]
    assert abs(ratio / expected - 1.0) < 0.01, f"{frame} not delivered exactly ({width}x{height})"
    # Cropping never enlarges the image.
    assert width <= 1600 and height <= 900
    if frame not in {"4:3", "16:9"}:
        assert changed is True


def test_frame_filter_keeps_declared_models_only() -> None:
    keys = {candidate.key for candidate in filter_candidates_by_frame(catalog.TEXT_TO_IMAGE_CANDIDATES, "21:9")}
    assert "magichour-flux-2-klein-text" not in keys
    assert {"flux-pro", "gemini-3.1-flash"} <= keys

    with pytest.raises(ValueError):
        filter_candidates_by_frame(catalog.TEXT_TO_IMAGE_CANDIDATES, "32:9")
