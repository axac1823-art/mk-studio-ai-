"""Regression tests for preserving explicit Image2 user requirements."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from prompts import build_text_to_image_prompt


def test_user_scene_specification_is_kept_as_its_own_section():
    details = "Exactly two red chairs, one round oak table, and a blue vase on the left."
    prompt = build_text_to_image_prompt(scene_details=details, aspect_ratio="4:3")

    assert "USER'S EXACT SCENE SPECIFICATION:\n" + details in prompt
    assert "Do not omit, replace, duplicate, merge, hide, or invent scene objects." in prompt
    assert "Preserve stated quantities, colors, materials, locations, directions, relative sizes and relationships." in prompt
    assert details in prompt


def test_style_filter_is_not_allowed_to_replace_requested_scene():
    details = "A small white house with exactly three front windows."
    prompt = build_text_to_image_prompt(
        scene_details=details,
        style_filters=["inkprint"],
        aspect_ratio="1:1",
    )

    assert details in prompt
    assert "#inkprint" in prompt
    assert "They must not change the requested subject, object inventory, object count" in prompt
