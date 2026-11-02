"""Regressions for Image2 source roles, identity prompts and provider ordering."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from catalog import (
    google_text_to_image_input,
    image2_identity_object_count,
    magichour_text_to_image_input,
    normalize_image2_reference_roles,
    openai_text_to_image_input,
    text_to_image_identity_locked,
    text_to_image_images,
)
from prompts import add_image_reference_map, build_feature_prompt


def test_style_only_does_not_lock_object_identity():
    req = {"styleReferenceUrl": "style.png", "referenceUrls": [], "referenceRoles": []}
    assert not text_to_image_identity_locked(req)
    assert image2_identity_object_count(req) == 0
    prompt = build_feature_prompt("text_to_image", req)
    mapped = add_image_reference_map(prompt, {**req, "feature": "text_to_image"})
    assert "HIGHEST-PRIORITY STYLE TRANSFER" in mapped
    assert "ELEMENT IDENTITY" not in mapped


def test_element_reference_locks_identity():
    req = {"referenceUrls": ["element.png"], "referenceRoles": ["element"]}
    assert text_to_image_identity_locked(req)
    assert image2_identity_object_count(req) == 1
    prompt = build_feature_prompt("text_to_image", req)
    assert "IMAGE COMPOSITION TASK" in prompt
    assert "ELEMENT IDENTITY" in prompt


def test_base_reference_locks_scene_without_counting_an_object():
    req = {"referenceUrls": ["base.png"], "referenceRoles": ["base"]}
    assert text_to_image_identity_locked(req)
    assert image2_identity_object_count(req) == 0
    prompt = add_image_reference_map(
        build_feature_prompt("text_to_image", req),
        {**req, "feature": "text_to_image", "referenceTags": ["@img1"]},
    )
    assert "IMAGE COMPOSITION TASK" in prompt
    assert "BASE SCENE" in prompt


def test_style_and_detail_roles_do_not_become_composition_sources():
    req = {
        "referenceUrls": ["style.png", "detail.png"],
        "referenceRoles": ["style", "detail"],
    }
    assert not text_to_image_identity_locked(req)
    assert image2_identity_object_count(req) == 0
    prompt = add_image_reference_map(
        build_feature_prompt("text_to_image", req),
        {**req, "feature": "text_to_image", "referenceTags": ["@img1", "@img2"]},
    )
    assert "IMAGE COMPOSITION TASK" not in prompt
    assert "Style reference only" in prompt
    assert "Detail reference only" in prompt


def test_legacy_or_invalid_roles_default_to_element_one_per_reference():
    req = {"referenceUrls": ["one.png", "two.png"], "referenceRoles": ["detail", "invalid"]}
    assert normalize_image2_reference_roles(req) == ["detail", "element"]
    assert normalize_image2_reference_roles({"referenceUrls": ["one.png", "two.png"]}) == ["element", "element"]


def test_provider_image_order_matches_style_primary_and_tagged_references():
    req = {
        "styleReferenceUrl": "style.png",
        "imageUrl": "primary.png",
        "referenceUrls": ["one.png", "two.png"],
        "referenceRoles": ["element", "detail"],
    }
    assert text_to_image_images(req) == ["style.png", "primary.png", "one.png", "two.png"]
    mapped = add_image_reference_map(
        "Use @img1 and @img2 as described.",
        {**req, "feature": "text_to_image", "referenceTags": ["@img1", "@img2"]},
    )
    assert "@img1 is element reference image 3" in mapped
    assert "@img2 is detail reference image 4" in mapped


def test_image2_provider_payloads_share_the_manifest_image_order():
    req = {
        "prompt": "Compose a house scene.",
        "styleReferenceUrl": "style.png",
        "imageUrl": "primary.png",
        "referenceUrls": ["one.png", "two.png"],
        "referenceRoles": ["element", "detail"],
        "aspectRatio": "9:16",
        "resolution": "640px",
        "quality": "standard",
        "quantity": 1,
    }
    expected = ["style.png", "primary.png", "one.png", "two.png"]
    assert magichour_text_to_image_input(req)["images"] == expected
    assert openai_text_to_image_input(req)["images"] == expected
    assert google_text_to_image_input(req)["images"] == expected


def test_explicit_prompt_roles_override_saved_metadata():
    req = {
        "referenceUrls": ["element.png", "base.png", "style.png", "detail.png"],
        "referenceTags": ["@img1", "@img2", "@img3", "@img4"],
        "referenceRoles": ["detail", "element", "element", "style"],
        "sceneDetails": (
            "Use @img1 as the object to insert into @img2. "
            "Use @img3 for lighting and color treatment only. "
            "Borrow the material texture from @img4, "
            "but do not copy its objects or background."
        ),
    }
    assert normalize_image2_reference_roles(req) == ["element", "base", "style", "detail"]


def test_arabic_prompt_roles_are_recognized():
    req = {
        "referenceUrls": ["element.png", "background.png", "lighting.png", "material.png"],
        "referenceTags": ["@img1", "@img2", "@img3", "@img4"],
        "referenceRoles": ["detail", "element", "element", "style"],
        "sceneDetails": (
            "استخدم @img1 كعنصر لإدخاله في @img2. "
            "استخدم @img3 للإضاءة والألوان فقط. "
            "استفد من خامة @img4 فقط."
        ),
    }
    assert normalize_image2_reference_roles(req) == ["element", "base", "style", "detail"]
