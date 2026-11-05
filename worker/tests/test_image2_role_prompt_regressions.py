
"""Regressions for Image2 source roles, identity prompts and provider ordering."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from catalog import (
    MODEL_CATALOG,
    candidate_resolutions,
    candidate_text_to_image_frame_ratios,
    google_text_to_image_input,
    image2_frame_reference,
    image2_identity_object_count,
    magichour_text_to_image_input,
    normalize_image2_reference_roles,
    openai_text_to_image_input,
    openai_text_to_image_25_input,
    text_to_image_identity_locked,
    text_to_image_images,
)
from prompts import add_image_reference_map, build_feature_prompt
from workflows.engine import order_text_to_image_candidates


def test_style_only_does_not_lock_object_identity():
    req = {
        "styleReferenceUrl": "style.png",
        "referenceUrls": [],
        "referenceRoles": [],
    }

    assert not text_to_image_identity_locked(req)
    assert image2_identity_object_count(req) == 0

    prompt = build_feature_prompt("text_to_image", req)
    mapped = add_image_reference_map(
        prompt,
        {**req, "feature": "text_to_image"},
    )

    assert "Style reference only" in mapped
    assert "ELEMENT IDENTITY" not in mapped
    assert "aesthetic guide" in mapped


def test_element_reference_locks_identity():
    req = {
        "referenceUrls": ["element.png"],
        "referenceRoles": ["element"],
    }

    assert text_to_image_identity_locked(req)
    assert image2_identity_object_count(req) == 1

    prompt = build_feature_prompt("text_to_image", req)

    assert "ELEMENT IDENTITY" in prompt
    assert "silhouette" in prompt
    assert "proportions" in prompt
    assert "logos" in prompt


def test_base_reference_locks_scene_without_counting_an_object():
    req = {
        "referenceUrls": ["base.png"],
        "referenceRoles": ["base"],
    }

    assert text_to_image_identity_locked(req)
    assert image2_identity_object_count(req) == 0

    prompt = add_image_reference_map(
        build_feature_prompt("text_to_image", req),
        {
            **req,
            "feature": "text_to_image",
            "referenceTags": ["@img1"],
        },
    )

    assert "BASE SCENE" in prompt
    assert "destination scene" in prompt
    assert "preserve its architecture" in prompt


def test_style_and_detail_roles_do_not_become_composition_sources():
    req = {
        "referenceUrls": ["style.png", "detail.png"],
        "referenceRoles": ["style", "detail"],
    }

    assert not text_to_image_identity_locked(req)
    assert image2_identity_object_count(req) == 0

    prompt = add_image_reference_map(
        build_feature_prompt("text_to_image", req),
        {
            **req,
            "feature": "text_to_image",
            "referenceTags": ["@img1", "@img2"],
        },
    )

    assert "COMPOSITING TASK" not in prompt
    assert "Style reference only" in prompt
    assert "Detail reference only" in prompt
    assert "do not copy its object silhouette" in prompt


def test_legacy_or_invalid_roles_default_to_element_one_per_reference():
    req = {
        "referenceUrls": ["one.png", "two.png"],
        "referenceRoles": ["detail", "invalid"],
    }

    assert normalize_image2_reference_roles(req) == [
        "detail",
        "element",
    ]

    assert normalize_image2_reference_roles(
        {
            "referenceUrls": ["one.png", "two.png"],
        }
    ) == [
        "element",
        "element",
    ]


def test_provider_image_order_matches_style_primary_and_tagged_references():
    req = {
        "styleReferenceUrl": "style.png",
        "imageUrl": "primary.png",
        "referenceUrls": ["one.png", "two.png"],
        "referenceRoles": ["element", "detail"],
    }

    assert text_to_image_images(req) == [
        "style.png",
        "primary.png",
        "one.png",
        "two.png",
    ]

    mapped = add_image_reference_map(
        "Use @img1 and @img2 as described.",
        {
            **req,
            "feature": "text_to_image",
            "referenceTags": ["@img1", "@img2"],
        },
    )

    assert "@img1 is provider input image 3 (ROLE: ELEMENT)" in mapped
    assert "@img2 is provider input image 4 (ROLE: DETAIL)" in mapped


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

    expected = [
        "style.png",
        "primary.png",
        "one.png",
        "two.png",
    ]

    assert magichour_text_to_image_input(req)["images"] == expected
    assert openai_text_to_image_input(req)["images"] == expected
    assert google_text_to_image_input(req)["images"] == expected


def test_explicit_prompt_roles_override_saved_metadata():
    req = {
        "referenceUrls": [
            "element.png",
            "base.png",
            "style.png",
            "detail.png",
        ],
        "referenceTags": [
            "@img1",
            "@img2",
            "@img3",
            "@img4",
        ],
        "referenceRoles": [
            "detail",
            "element",
            "element",
            "style",
        ],
        "sceneDetails": (
            "Use @img1 as the object to insert into @img2. "
            "Use @img3 for lighting and color treatment only. "
            "Borrow the material texture from @img4, "
            "but do not copy its objects or background."
        ),
    }

    assert normalize_image2_reference_roles(req) == [
        "element",
        "base",
        "style",
        "detail",
    ]


def test_arabic_prompt_roles_are_recognized():
    req = {
        "referenceUrls": [
            "element.png",
            "background.png",
            "lighting.png",
            "material.png",
        ],
        "referenceTags": [
            "@img1",
            "@img2",
            "@img3",
            "@img4",
        ],
        "referenceRoles": [
            "detail",
            "element",
            "element",
            "style",
        ],
        "sceneDetails": (
            "استخدم @img1 كعنصر لإدخاله في @img2. "
            "استخدم @img3 للإضاءة والألوان فقط. "
            "استفد من خامة @img4 فقط."
        ),
    }

    assert normalize_image2_reference_roles(req) == [
        "element",
        "base",
        "style",
        "detail",
    ]


def test_identity_compositing_auto_prefers_reference_fidelity():
    ordered = order_text_to_image_candidates(
        MODEL_CATALOG["text_to_image"],
        "standard",
        "auto",
        prioritize_reference_fidelity=True,
    )

    assert ordered[0].key == "gpt-image-2.5-sunburst"
    assert ordered[1].key == "gemini-3.1-flash"


def test_text_only_auto_keeps_cost_first_order():
    resolution_compatible = [
        candidate
        for candidate in MODEL_CATALOG["text_to_image"]
        if "1K" in candidate.resolutions
    ]

    ordered = order_text_to_image_candidates(
        resolution_compatible,
        "standard",
        "auto",
        prioritize_reference_fidelity=False,
    )

    assert ordered[0].key == "flux-dev"


def test_bfl_image2_flux_pro_and_flux_dev_are_text_only():
    candidates = {
        candidate.key: candidate
        for candidate in MODEL_CATALOG["text_to_image"]
    }

    assert candidates["flux-pro"].supports_image_input is False
    assert candidates["flux-dev"].supports_image_input is False
    assert candidates["gpt-image-2.5-sunburst"].supports_image_input is True
    assert candidates["gemini-3.1-flash"].supports_image_input is True


def test_gpt_image_25_gets_native_4k_dimensions_and_png():
    payload = openai_text_to_image_25_input(
        {
            "prompt": "Architectural visualization",
            "referenceUrls": [],
            "aspectRatio": "16:9",
            "resolution": "4K",
            "quality": "pro",
            "quantity": 1,
        }
    )

    assert payload["size"] == "3840x2160"
    assert payload["quality"] == "xhigh"
    assert payload["output_format"] == "png"


def test_google_payload_passes_requested_image_size_and_ratio():
    payload = google_text_to_image_input(
        {
            "prompt": "Architectural visualization",
            "images": [],
            "aspectRatio": "9:16",
            "resolution": "2K",
            "quantity": 1,
        }
    )

    assert payload["aspectRatio"] == "9:16"
    assert payload["resolution"] == "2K"


def test_role_manifest_explains_architectural_compositing():
    req = {
        "feature": "text_to_image",
        "referenceUrls": ["element.png", "base.png"],
        "referenceTags": ["@img1", "@img2"],
        "referenceRoles": ["element", "base"],
    }

    prompt = add_image_reference_map(
        "Insert the object into the scene.",
        req,
    )

    assert "COMPOSITING TASK" in prompt
    assert "contact shadows" in prompt
    assert "perspective" in prompt
    assert "BASE SCENE LOCK" in prompt
    assert "ELEMENT IDENTITY LOCK" in prompt


def test_auto_frame_prefers_base_reference():
    req = {
        "imageUrl": "primary.png",
        "referenceUrls": [
            "element.png",
            "base.png",
            "style.png",
        ],
        "referenceRoles": [
            "element",
            "base",
            "style",
        ],
    }

    assert image2_frame_reference(req) == "base.png"


def test_auto_frame_uses_primary_image_without_base():
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

    assert image2_frame_reference(req) == "primary.png"


def test_auto_frame_falls_back_to_first_element():
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


def test_style_and_detail_do_not_define_auto_frame():
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


def test_magic_hour_generator_and_editor_have_different_frame_capabilities():
    candidate = next(
        candidate
        for candidate in MODEL_CATALOG["text_to_image"]
        if candidate.key == "magichour-flux-2-klein-text"
    )

    assert candidate_text_to_image_frame_ratios(
        candidate,
        has_input_images=False,
    ) == (
        "1:1",
        "16:9",
        "9:16",
    )

    assert candidate_text_to_image_frame_ratios(
        candidate,
        has_input_images=True,
    ) == candidate.frame_ratios


def test_magic_hour_resolution_remains_pinned_to_640px():
    candidate = next(
        candidate
        for candidate in MODEL_CATALOG["text_to_image"]
        if candidate.key == "magichour-flux-2-klein-text"
    )

    assert candidate_resolutions(candidate) == ("640px",)
