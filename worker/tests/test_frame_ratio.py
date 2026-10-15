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
    MAGICHOUR_FRAMES,
    check_delivered_ratio,
    filter_by_frame,
)


def _request(ratio: str) -> dict:
    return {
        "prompt": "A contemporary villa",
        "aspectRatio": ratio,
        "quality": "standard",
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


def test_bfl_reference_uses_documented_api_field():
    request = _request("4:3")
    request["referenceUrls"] = ["data:image/png;base64,ZmFrZQ=="]
    payload = bfl_text_to_image_input(request)
    assert payload["image_prompt"] == "ZmFrZQ=="
    assert "input_image" not in payload


def test_bfl_does_not_guess_auto_dimensions():
    try:
        bfl_text_to_image_input(_request("auto"))
    except ValueError as error:
        assert "explicit frame" in str(error)
    else:
        raise AssertionError("BFL must not silently turn Auto into a guessed ratio")


def test_openai_only_maps_documented_native_sizes():
    assert GPT_IMAGE_1_SIZES == {
        "1:1": "1024x1024",
        "3:2": "1536x1024",
        "2:3": "1024x1536",
    }
    assert openai_text_to_image_input(_request("1:1"))["size"] == "1024x1024"
    assert openai_text_to_image_input(_request("3:2"))["size"] == "1536x1024"
    assert openai_text_to_image_input(_request("2:3"))["size"] == "1024x1536"
    assert openai_text_to_image_input(_request("auto"))["size"] == "auto"
    for ratio in ("4:3", "16:9", "21:9"):
        try:
            openai_text_to_image_input(_request(ratio))
        except ValueError:
            pass
        else:
            raise AssertionError(f"GPT Image 1 must not approximate {ratio}")


def test_google_receives_the_requested_native_ratio():
    assert google_text_to_image_input(_request("16:9"))["aspectRatio"] == "16:9"
    assert google_text_to_image_input(_request("3:2"))["aspectRatio"] == "3:2"
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
    assert _candidate("gpt-image-1").frame_ratios == ("auto", "1:1", "3:2", "2:3")
    assert _candidate("magichour-flux-2-klein-text").frame_ratios == MAGICHOUR_FRAMES
    capable = filter_by_frame(candidates, "21:9", None)
    assert all("21:9" in candidate.frame_ratios for candidate in capable)
    assert _candidate("gpt-image-1") not in capable
    assert filter_by_frame(candidates, "16:9", "magichour-flux-2-klein-text") == [
        _candidate("magichour-flux-2-klein-text")
    ]
    try:
        filter_by_frame(candidates, "16:9", "gpt-image-1")
    except ValueError as error:
        assert "cannot generate a 16:9" in str(error)
    else:
        raise AssertionError("Explicit unsupported model choice must fail clearly")


def test_model_catalog_exposes_only_declared_frames():
    models = {item["key"]: item for item in list_feature_models("text_to_image")}
    assert models["gpt-image-1"]["frameRatios"] == ("auto", "1:1", "3:2", "2:3")
    assert models["magichour-flux-2-klein-text"]["frameRatios"] == MAGICHOUR_FRAMES


def test_output_validation_never_crops_and_allows_documented_dimension_grid():
    assert check_delivered_ratio(1184, 864, "4:3") is True
    assert check_delivered_ratio(1536, 1024, "16:9") is False
    assert check_delivered_ratio(1000, 700, "auto") is True
