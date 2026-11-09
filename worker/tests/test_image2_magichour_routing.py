
"""Image2 regressions for frame selection and Magic Hour endpoint routing."""
import sys
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import providers.magichour as magichour

from catalog import (
    MODEL_CATALOG,
    candidate_text_to_image_frame_ratios,
    image2_frame_reference,
)
from providers.http_helpers import ProviderError


def _magichour_candidate():
    return next(
        candidate
        for candidate in MODEL_CATALOG["text_to_image"]
        if candidate.key == "magichour-flux-2-klein-text"
    )


def test_auto_frame_does_not_use_primary_image_when_base_is_missing():
    req = {
        "imageUrl": "primary.png",
        "referenceUrls": [
            "style.png",
            "detail.png",
        ],
        "referenceRoles": [
            "style",
            "detail",
        ],
    }

    assert image2_frame_reference(req) is None

def test_auto_frame_prefers_base_over_primary_image():
    req = {
        "imageUrl": "primary-element.png",
        "referenceUrls": [
            "element.png",
            "base-scene.png",
            "style.png",
        ],
        "referenceRoles": [
            "element",
            "base",
            "style",
        ],
    }

    assert image2_frame_reference(req) == "base-scene.png"


def test_auto_frame_does_not_fall_back_to_element_when_base_is_missing():
    req = {
        "referenceUrls": [
            "style.png",
            "detail.png",
            "first-element.png",
            "second-element.png",
        ],
        "referenceRoles": [
            "style",
            "detail",
            "element",
            "element",
        ],
    }

    assert image2_frame_reference(req) is None

def test_auto_frame_falls_back_to_first_element_reference():
    req = {
        "referenceUrls": [
            "style.png",
            "detail.png",
            "first-element.png",
            "second-element.png",
        ],
        "referenceRoles": [
            "style",
            "detail",
            "element",
            "element",
        ],
    }

    assert image2_frame_reference(req) == "first-element.png"


def test_auto_frame_does_not_use_style_or_detail_as_destination():
    req = {
        "referenceUrls": [
            "style.png",
            "detail.png",
        ],
        "referenceRoles": [
            "style",
            "detail",
        ],
    }

    assert image2_frame_reference(req) is None


def test_magic_hour_generate_routes_image_inputs_to_editor():
    input_ = {
        "images": [
            "style.png",
            "element.png",
            "base.png",
            "detail.png",
        ],
        "quantity": 1,
    }

    with (
        patch.object(
            magichour,
            "_run_image_edit",
            return_value="https://example.com/edited.png",
        ) as editor,
        patch.object(
            magichour,
            "_run_image_generator",
        ) as generator,
    ):
        result = magichour.generate(
            "flux-2-klein",
            input_,
            timeout_ms=1000,
        )

    editor.assert_called_once()
    generator.assert_not_called()

    assert result == {
        "images": [
            {"url": "https://example.com/edited.png"}
        ]
    }


def test_magic_hour_generate_routes_empty_image_list_to_generator():
    input_ = {
        "images": [],
        "quantity": 1,
    }

    with (
        patch.object(
            magichour,
            "_run_image_generator",
            return_value="https://example.com/generated.png",
        ) as generator,
        patch.object(
            magichour,
            "_run_image_edit",
        ) as editor,
    ):
        result = magichour.generate(
            "flux-2-klein",
            input_,
            timeout_ms=1000,
        )

    generator.assert_called_once()
    editor.assert_not_called()

    assert result == {
        "images": [
            {"url": "https://example.com/generated.png"}
        ]
    }


def test_magic_hour_editor_preserves_reference_manifest_order():
    captured = {}

    def fake_post_json(url, headers, body, timeout_s=60):
        captured["url"] = url
        captured["headers"] = headers
        captured["body"] = body
        return {"id": "editor-job-1"}

    input_ = {
        "prompt": "Compose the architectural scene using the assigned image roles.",
        "images": [
            "style.png",
            "primary.png",
            "element.png",
            "base.png",
            "detail.png",
        ],
        "aspectRatio": "4:3",
        "resolution": "640px",
    }

    with (
        patch.object(magichour, "_headers", return_value={}),
        patch.object(
            magichour,
            "_ensure_file_path",
            side_effect=lambda value: f"uploaded:{value}",
        ),
        patch.object(
            magichour,
            "post_json",
            side_effect=fake_post_json,
        ),
        patch.object(
            magichour,
            "_poll_project",
            return_value="https://example.com/editor-output.png",
        ),
    ):
        result = magichour._run_image_edit(
            "flux-2-klein",
            input_,
            timeout_ms=1000,
        )

    assert captured["url"].endswith("/v1/ai-image-editor")

    assert captured["body"]["assets"]["image_file_paths"] == [
        "uploaded:style.png",
        "uploaded:primary.png",
        "uploaded:element.png",
        "uploaded:base.png",
        "uploaded:detail.png",
    ]

    assert captured["body"]["aspect_ratio"] == "4:3"
    assert captured["body"]["resolution"] == "640px"

    assert result == "https://example.com/editor-output.png"


def test_magic_hour_generator_forwards_all_native_frames():
    for aspect_ratio in ("1:1", "16:9", "9:16"):
        captured = {}

        def fake_post_json(url, headers, body, timeout_s=60):
            captured["url"] = url
            captured["body"] = body
            return {"id": "generator-job-1"}

        input_ = {
            "prompt": "A contemporary architectural exterior.",
            "aspectRatio": aspect_ratio,
            "resolution": "640px",
        }

        with (
            patch.object(magichour, "_headers", return_value={}),
            patch.object(
                magichour,
                "post_json",
                side_effect=fake_post_json,
            ),
            patch.object(
                magichour,
                "_poll_project",
                return_value="https://example.com/generated.png",
            ),
        ):
            result = magichour._run_image_generator(
                "flux-2-klein",
                input_,
                timeout_ms=1000,
            )

        assert captured["url"].endswith("/v1/ai-image-generator")

        # The exact selected frame must reach Magic Hour.
        assert captured["body"]["aspect_ratio"] == aspect_ratio

        # Text-only generation must not send Editor assets.
        assert "assets" not in captured["body"]

        assert result == "https://example.com/generated.png"

def test_magic_hour_generator_rejects_unsupported_frame_without_conversion():
    input_ = {
        "prompt": "Architectural visualization.",
        "aspectRatio": "4:3",
        "resolution": "640px",
    }

    try:
        magichour._run_image_generator(
            "flux-2-klein",
            input_,
            timeout_ms=1000,
        )
    except ProviderError as exc:
        assert "4:3" in str(exc)
    else:
        raise AssertionError(
            "Magic Hour Generator must not silently convert an unsupported frame."
        )


def test_magic_hour_editor_accepts_its_documented_landscape_frames():
    supported = {
        "auto",
        "1:1",
        "16:9",
        "9:16",
        "4:3",
        "3:2",
        "2:3",
        "4:5",
    }

    assert supported == magichour._IMAGE_EDITOR_RATIOS


def test_magic_hour_generator_uses_only_its_documented_frame_enum():
    assert magichour._IMAGE_GENERATOR_RATIOS == {
        "1:1",
        "16:9",
        "9:16",
    }
