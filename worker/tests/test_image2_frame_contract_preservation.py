import base64
import io
import sys
from pathlib import Path

import pytest
from PIL import Image, ImageChops, ImageDraw

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import storage
from frame_ratio import normalize_image_output_frame, validate_image_output_frame


def _png_data_uri(width: int, height: int) -> tuple[str, Image.Image]:
    source = Image.new("RGB", (width, height), "white")
    draw = ImageDraw.Draw(source)
    draw.rectangle((97, 0, 105, height - 1), fill="black")
    buffer = io.BytesIO()
    source.save(buffer, format="PNG")
    encoded = base64.b64encode(buffer.getvalue()).decode("ascii")
    return "data:image/png;base64," + encoded, source


def test_small_frame_correction_pads_canvas_and_preserves_every_source_pixel():
    source_uri, source = _png_data_uri(640, 384)
    normalized_uri = normalize_image_output_frame([source_uri], "16:9")[0]
    normalized_bytes = base64.b64decode(normalized_uri.split(",", 1)[1])

    with Image.open(io.BytesIO(normalized_bytes)) as normalized:
        normalized = normalized.convert("RGB")
        assert normalized.size == (683, 384)
        preserved_source = normalized.crop((21, 0, 661, 384))
        assert ImageChops.difference(preserved_source, source).getbbox() is None

    validate_image_output_frame([normalized_uri], "16:9")


def test_worker_storage_image_url_is_resolved_even_when_host_is_a_lan_ip(tmp_path, monkeypatch):
    monkeypatch.setattr(storage, "STORAGE_DIR", tmp_path)
    monkeypatch.setattr(storage, "PUBLIC_BASE_URL", "http://192.168.1.4:8000")
    source_path = tmp_path / "source.png"
    source_path.write_bytes(b"local-image-bytes")

    result = storage.image_data_uri_if_local(
        "http://192.168.1.4:8000/storage/source.png"
    )

    assert result == "data:image/png;base64," + base64.b64encode(b"local-image-bytes").decode("ascii")


def test_large_frame_mismatch_is_not_cropped_or_rewritten_and_is_rejected():
    square_uri, _source = _png_data_uri(384, 384)
    normalized = normalize_image_output_frame([square_uri], "16:9")

    assert normalized == [square_uri]
    with pytest.raises(ValueError, match="not the requested 16:9 frame"):
        validate_image_output_frame(normalized, "16:9")
