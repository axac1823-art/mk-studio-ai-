"""Image2 source roles, provider payloads and resolution routing regression tests."""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from catalog import (  # noqa: E402
    TEXT_TO_IMAGE_CANDIDATES, google_text_to_image_input, openai_text_to_image_input,
    magichour_text_to_image_input, text_to_image_images, list_feature_models,
)
from frame_ratio import (  # noqa: E402
    ALL_FRAMES, GEMINI_RESOLUTION_RATIOS, GPT_IMAGE_RESOLUTION_RATIOS,
    GPT_IMAGE_SIZES_BY_RESOLUTION, check_delivered_resolution, filter_by_resolution,
)
from prompts import add_image_reference_map, build_feature_prompt  # noqa: E402


def req(**overrides):
    value = {
        "feature": "text_to_image", "prompt": "Add @img1 to @img2", "sceneDetails": "Add @img1 to @img2",
        "aspectRatio": "16:9", "resolution": "2K", "quality": "standard", "quantity": 1,
        "referenceUrls": ["data:image/png;base64,OBJECT", "data:image/png;base64,BASE"],
        "referenceTags": ["@img1", "@img2"], "referenceRoles": ["element", "base"],
    }
    value.update(overrides)
    return value


def test_image_order_is_stable_and_roles_do_not_reorder_payload():
    value = req(styleReferenceUrl="data:image/png;base64,STYLE", imageUrl="data:image/png;base64,PRIMARY")
    assert text_to_image_images(value) == [value["styleReferenceUrl"], value["imageUrl"], *value["referenceUrls"]]


def test_reference_map_declares_each_role_and_historical_lighting_rules():
    value = req()
    prompt = add_image_reference_map(build_feature_prompt("text_to_image", value), value)
    assert "role: element" in prompt
    assert "role: base" in prompt
    assert "BASE SCENE/BACKGROUND" in prompt
    assert "HISTORICAL IMAGE2 LIGHTING DISCIPLINE" not in prompt  # no style reference was supplied
    style_value = req(referenceRoles=["style", "base"])
    style_prompt = add_image_reference_map(build_feature_prompt("text_to_image", style_value), style_value)
    assert "role: style" in style_prompt
    assert "HISTORICAL IMAGE2 LIGHTING DISCIPLINE" in style_prompt
    assert "Do not silently ignore any attachment, including the third and later images" in style_prompt


def test_provider_payloads_receive_selected_native_resolution():
    value = req()
    openai = openai_text_to_image_input(value)
    google = google_text_to_image_input(value)
    assert openai["size"] == "2560x1440"
    assert openai["quality"] == "high"
    assert openai["output_format"] == "png"
    assert google["resolution"] == "2K"
    assert google["aspectRatio"] == "16:9"


def test_magichour_builder_passes_only_documented_resolution_buckets():
    value = req(aspectRatio="1:1", resolution="1K")
    assert magichour_text_to_image_input(value)["resolution"] == "1k"
    assert magichour_text_to_image_input({**value, "resolution": "640px"})["resolution"] == "640px"
    assert magichour_text_to_image_input({**value, "resolution": "2K"})["resolution"] == "2k"


def test_every_declared_openai_size_obeys_pixel_grid_and_requested_frame():
    frame_values = {frame: int(frame.split(":")[0]) / int(frame.split(":")[1]) for frame in ALL_FRAMES}
    for resolution, sizes in GPT_IMAGE_SIZES_BY_RESOLUTION.items():
        for frame, size in sizes.items():
            if size == "auto":
                continue
            width, height = (int(value) for value in size.split("x"))
            assert width % 16 == 0 and height % 16 == 0
            assert max(width, height) <= 3840
            assert abs((width / height) - frame_values[frame]) / frame_values[frame] <= 0.02


def test_model_capability_matrices_do_not_advertise_unsupported_combinations():
    assert GPT_IMAGE_RESOLUTION_RATIOS["1:1"] == ("1K", "2K")
    assert GEMINI_RESOLUTION_RATIOS["1:1"] == ("1K", "2K", "4K")
    models = {item["key"]: item for item in list_feature_models("text_to_image")}
    assert models["gpt-image-1.5"]["resolutionRatios"]["1:1"] == ("1K", "2K")
    assert models["gemini-2.5-flash"]["supportsIdentityEdit"] is True
    assert models["flux-pro"]["supportsIdentityEdit"] is False


def test_pro_quality_is_only_advertised_by_candidates_declaring_pro():
    assert "pro" not in next(candidate for candidate in TEXT_TO_IMAGE_CANDIDATES if candidate.key == "magichour-flux-2-klein-text").tiers
    assert any("pro" in candidate.tiers for candidate in TEXT_TO_IMAGE_CANDIDATES)


def test_resolution_router_filters_and_respects_explicit_model():
    capable = filter_by_resolution(TEXT_TO_IMAGE_CANDIDATES, "16:9", "4K", None)
    assert all("4K" in dict(item.resolution_ratios).get("16:9", ()) for item in capable)
    assert {item.key for item in capable} == {"gpt-image-1.5", "gemini-2.5-flash"}
    try:
        filter_by_resolution(TEXT_TO_IMAGE_CANDIDATES, "1:1", "4K", "gpt-image-1.5")
    except ValueError as error:
        assert "does not support 4K" in str(error)
    else:
        raise AssertionError("Unsupported model resolution must fail clearly")


def test_delivery_resolution_guard_rejects_silent_downgrade():
    assert check_delivered_resolution(1024, 1024, "1K") is True
    assert check_delivered_resolution(1024, 1024, "2K") is False
    assert check_delivered_resolution(3840, 2160, "4K") is True
