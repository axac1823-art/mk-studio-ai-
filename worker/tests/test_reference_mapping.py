"""Ensure description tags stay connected to the exact attached visual inputs."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from prompts import (
    IMAGE2_CAMERA_POSITION_PROMPTS,
    IMAGE2_STYLE_FILTER_PROMPTS,
    add_image_reference_map,
    build_feature_prompt,
    build_text_to_image_prompt,
)
from workflows.video import _reference_map


def test_image_description_tags_map_to_reference_order():
    prompt = add_image_reference_map(
        "Use @img2 for the facade material and @img1 for the garden style.",
        {
            "feature": "print_render",
            "referenceUrls": ["image-one", "image-two"],
            "referenceTags": ["@img1", "@img2"],
        },
    )

    assert "Use @img2 for the facade material" in prompt
    assert "@img1 is content/reference image 1" in prompt
    assert "@img2 is content/reference image 2" in prompt


def test_image_generator_source_is_separate_from_tagged_references():
    prompt = add_image_reference_map(
        "Use @img1 for the style.",
        {
            "feature": "text_to_image",
            "imageUrl": "source-image",
            "referenceUrls": ["visual-ref"],
            "referenceTags": ["@img1"],
        },
    )

    assert "CONTENT REFERENCE RULE" in prompt
    assert "@img1 is content/reference image 1" in prompt


def test_video_tags_are_preserved_and_explained_for_provider_prompt():
    prompt = "Move the building style from @img2 and use motion from @vid1."
    references = [
        {"tag": "@img2", "type": "image", "asset_url": "image-two"},
        {"tag": "@vid1", "type": "video", "asset_url": "video-one"},
    ]

    mapped = _reference_map(prompt, references)

    assert "@img2" in prompt
    assert "@img2 is the attached image" in mapped
    assert "@vid1 is the attached video" in mapped

def test_image2_style_filters_are_text_only_and_preserve_subject():
    prompt = build_text_to_image_prompt(
        scene_details="A compact two-storey house beside an olive grove.",
        style_filters=["inkprint", "dark"],
    )
    assert "#inkprint, #dark" in prompt
    assert "carved confident contour lines" in prompt
    assert "low-key treatment" in prompt
    assert "not source images" in prompt
    assert "backgrounds, overlays, or separate layers" in prompt


def test_image2_mock_filter_is_rough_concept_not_presentation_mockup():
    prompt = build_text_to_image_prompt(
        scene_details="A small courtyard house with a shaded loggia.",
        style_filters=["mock"],
    )
    assert "#mock" in prompt
    assert "early-stage rough concept draft" in prompt
    assert "not as a polished presentation mockup" in prompt
    assert "without redesigning the architecture" in prompt
    assert "device frame, poster, presentation board" in prompt


def test_unknown_image2_style_filter_ids_are_ignored():
    prompt = build_text_to_image_prompt(
        scene_details="A simple white massing model.",
        style_filters=["mockup", "not-a-real-filter"],
    )
    assert "#mockup" not in prompt
    assert "not-a-real-filter" not in prompt
    assert "Apply these text-only visual style filters" not in prompt


def test_image2_frame_size_prompts_are_included():
    from prompts import IMAGE2_FRAME_SIZE_PROMPTS, build_feature_prompt

    for ratio in ["16:9", "1:1", "9:16", "4:3", "3:4", "3:2", "2:3", "21:9", "auto"]:
        prompt = build_text_to_image_prompt(
            scene_details="A modern minimalist villa.",
            aspect_ratio=ratio,
        )
        expected = IMAGE2_FRAME_SIZE_PROMPTS[ratio]
        assert expected in prompt, f"Expected framing prompt for {ratio} to be in prompt"

    # Also test via build_feature_prompt
    feature_prompt = build_feature_prompt(
        "text_to_image",
        {"sceneDetails": "A glass pavilion.", "aspectRatio": "16:9"},
    )
    assert IMAGE2_FRAME_SIZE_PROMPTS["16:9"] in feature_prompt


def test_image2_camera_position_is_optional():
    prompt = build_text_to_image_prompt(
        scene_details="A modern two-storey architectural villa."
    )
    assert "CAMERA POSITION PRESET" not in prompt
    assert "Top-Down / Nadir" not in prompt


def test_image2_all_camera_presets_have_prompt_instructions():
    assert len(IMAGE2_CAMERA_POSITION_PROMPTS) == 9
    for preset_id, instruction in IMAGE2_CAMERA_POSITION_PROMPTS.items():
        prompt = build_text_to_image_prompt(
            scene_details="A modern architectural villa.",
            camera_preset_id=preset_id,
        )
        assert "CAMERA POSITION PRESET" in prompt
        assert instruction in prompt
        assert "user's written description has priority" in prompt


def test_image2_unknown_camera_preset_is_ignored():
    prompt = build_text_to_image_prompt(
        scene_details="A modern architectural villa.",
        camera_preset_id="unknown_camera",
    )
    assert "CAMERA POSITION PRESET" not in prompt
    assert "unknown_camera" not in prompt


def test_image2_camera_preset_passes_through_feature_prompt():
    prompt = build_feature_prompt(
        "text_to_image",
        {
            "sceneDetails": "A modern villa in a landscaped site.",
            "cameraPresetId": "high_aerial",
        },
    )
    assert "CAMERA POSITION PRESET" in prompt
    assert "high and distant aerial camera viewpoint" in prompt


def test_image2_camera_does_not_consume_style_filter_slots():
    assert not set(IMAGE2_CAMERA_POSITION_PROMPTS).intersection(
        IMAGE2_STYLE_FILTER_PROMPTS
    )
    prompt = build_text_to_image_prompt(
        scene_details="A modern architectural villa.",
        style_filters=["inkprint", "dark", "3d"],
        camera_preset_id="high_aerial",
    )
    assert "#inkprint, #dark, #3d" in prompt
    assert "CAMERA POSITION PRESET" in prompt
