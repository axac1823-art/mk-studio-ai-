"""Tests for Image2 native frame routing. No provider keys or real API calls required."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from catalog import (
    TEXT_TO_IMAGE_CANDIDATES,
    bfl_text_to_image_input,
    google_text_to_image_input,
    list_feature_models,
    magichour_text_to_image_input,
    openai_text_to_image_input,
)
from frame_ratio import (
    ALL_FRAMES,
    BFL_DIMENSIONS,
    GPT_IMAGE_1_SIZES,
    GPT_IMAGE_SIZES_BY_RESOLUTION,
    GPT_IMAGE_RESOLUTION_RATIOS,
    GEMINI_RESOLUTION_RATIOS,
    MAGICHOUR_FRAMES,
    check_delivered_ratio,
    check_delivered_resolution,
    filter_by_frame,
    filter_by_resolution,
)


def _request(ratio: str) -> dict:
    return {
        "prompt": "A contemporary villa",
        "aspectRatio": ratio,
        "quality": "standard",
        "resolution": "1K",
        "quantity": 1,
        "referenceUrls": [],
    }


def _ratio_value(value: str) -> float:
    width, height = value.split(":")
    return int(width) / int(height)


def test_bfl_frame_dimensions_are_native_and_valid():
    for ratio in ALL_FRAMES:
        width, height = BFL_DIMENSIONS[ratio]
        assert width / height == _ratio_value(ratio)
        assert width % 32 == 0 and height % 32 == 0
        assert 256 <= min(width, height) and max(width, height) <= 1440
        payload = bfl_text_to_image_input(_request(ratio))
        assert (payload["width"], payload["height"]) == (width, height)


def test_bfl_does_not_guess_auto_dimensions():
    try:
        bfl_text_to_image_input(_request("auto"))
    except ValueError as error:
        assert "explicit frame" in str(error)
    else:
        raise AssertionError("BFL must not silently turn Auto into a guessed ratio")


def test_openai_maps_supported_native_size_for_ratio_and_resolution():
    assert GPT_IMAGE_1_SIZES == {
        "1:1": "1024x1024",
        "3:2": "1536x1024",
        "2:3": "1024x1536",
    }
    assert openai_text_to_image_input(_request("1:1"))["size"] == "1024x1024"
    assert openai_text_to_image_input(_request("16:9"))["size"] == "1536x864"
    assert openai_text_to_image_input({**_request("16:9"), "resolution": "2K"})["size"] == "2560x1440"
    assert openai_text_to_image_input({**_request("16:9"), "resolution": "4K"})["size"] == "3840x2160"
    assert openai_text_to_image_input(_request("auto"))["size"] == "auto"
    assert openai_text_to_image_input(_request("1:1"))["quality"] == "high"
    assert openai_text_to_image_input({**_request("1:1"), "quality": "pro"})["quality"] == "xhigh"
    assert openai_text_to_image_input(_request("1:1"))["output_format"] == "png"
    try:
        openai_text_to_image_input({**_request("1:1"), "resolution": "4K"})
    except ValueError as error:
        assert "does not support 4K" in str(error)
    else:
        raise AssertionError("OpenAI must not advertise unsupported 4K square output")


def test_google_receives_the_requested_native_ratio():
    assert google_text_to_image_input(_request("16:9"))["aspectRatio"] == "16:9"
    assert google_text_to_image_input(_request("3:2"))["aspectRatio"] == "3:2"
    assert google_text_to_image_input({**_request("16:9"), "resolution": "2K"})["resolution"] == "2K"
    assert "aspectRatio" not in google_text_to_image_input(_request("auto"))


def test_magic_hour_never_silently_maps_unsupported_ratios():
    for ratio in MAGICHOUR_FRAMES:
        assert magichour_text_to_image_input(_request(ratio))["aspectRatio"] == ratio
    for ratio in ("auto", "4:3", "3:2", "2:3", "21:9"):
        try:
            magichour_text_to_image_input(_request(ratio))
        except ValueError:
            pass
        else:
            raise AssertionError(f"Magic Hour must not approximate {ratio}")


def _candidate(key: str):
    return next(candidate for candidate in TEXT_TO_IMAGE_CANDIDATES if candidate.key == key)


def test_frame_router_filters_capabilities_and_respects_explicit_model():
    candidates = TEXT_TO_IMAGE_CANDIDATES
    assert _candidate("gpt-image-1.5").frame_ratios == ("auto", *ALL_FRAMES)
    assert _candidate("magichour-flux-2-klein-text").frame_ratios == MAGICHOUR_FRAMES
    capable = filter_by_frame(candidates, "21:9", None)
    assert all("21:9" in candidate.frame_ratios for candidate in capable)
    assert _candidate("gpt-image-1.5") in capable
    assert filter_by_frame(candidates, "16:9", "magichour-flux-2-klein-text") == [
        _candidate("magichour-flux-2-klein-text")
    ]
    assert filter_by_frame(candidates, "16:9", "gpt-image-1.5") == [
        _candidate("gpt-image-1.5")
    ]


def test_model_catalog_exposes_only_declared_frames():
    models = {item["key"]: item for item in list_feature_models("text_to_image")}
    assert models["gpt-image-1.5"]["frameRatios"] == ("auto", *ALL_FRAMES)
    assert models["gpt-image-1.5"]["resolutionRatios"]["16:9"] == ("1K", "2K", "4K")
    assert models["gpt-image-1.5"]["supportsIdentityEdit"] is True
    assert models["magichour-flux-2-klein-text"]["frameRatios"] == MAGICHOUR_FRAMES


def test_output_validation_never_crops_and_allows_documented_dimension_grid():
    assert check_delivered_ratio(1184, 864, "4:3") is True
    assert check_delivered_ratio(1536, 1024, "16:9") is False
    assert check_delivered_ratio(1000, 700, "auto") is True
