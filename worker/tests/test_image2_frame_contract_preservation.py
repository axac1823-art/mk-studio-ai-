import base64
import io
import sys
from pathlib import Path

import pytest
from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import storage
from frame_ratio import validate_image_output_frame


def _png_data_uri(width: int, height: int):
    source = Image.new(
        "RGB",
        (width, height),
        (120, 140, 160),
    )

    buffer = io.BytesIO()
    source.save(buffer, format="PNG")

    encoded = base64.b64encode(
        buffer.getvalue()
    ).decode("ascii")

    return "data:image/png;base64," + encoded


def test_native_16_9_output_is_accepted_without_dimension_changes():
    source_uri = _png_data_uri(640, 360)

    # Validation does not return or rewrite an image.
    validate_image_output_frame(
        [source_uri],
        "16:9",
    )

    image_bytes = base64.b64decode(
        source_uri.split(",", 1)[1]
    )

    with Image.open(io.BytesIO(image_bytes)) as image:
        assert image.size == (640, 360)


def test_wrong_native_frame_is_rejected_without_padding_or_cropping():
    source_uri = _png_data_uri(640, 384)

    with pytest.raises(
        ValueError,
        match="not the requested 16:9 frame",
    ):
        validate_image_output_frame(
            [source_uri],
            "16:9",
        )

    image_bytes = base64.b64decode(
        source_uri.split(",", 1)[1]
    )

    with Image.open(io.BytesIO(image_bytes)) as image:
        # The original provider output remains untouched.
        assert image.size == (640, 384)


def test_worker_storage_image_url_is_resolved_even_when_host_is_a_lan_ip(
    tmp_path,
    monkeypatch,
):
    monkeypatch.setattr(storage, "STORAGE_DIR", tmp_path)
    monkeypatch.setattr(
        storage,
        "PUBLIC_BASE_URL",
        "http://192.168.1.4:8000",
    )

    source_path = tmp_path / "source.png"
    source_path.write_bytes(b"local-image-bytes")

    result = storage.image_data_uri_if_local(
        "http://192.168.1.4:8000/storage/source.png"
    )

    expected = (
        "data:image/png;base64,"
        + base64.b64encode(b"local-image-bytes").decode("ascii")
    )

    assert result == expected