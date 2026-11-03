"""Regressions for Image2 source roles, identity prompts and provider ordering."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from catalog import (
    Candidate,
    bfl_text_to_image_input,
    MODEL_CATALOG,
    google_text_to_image_input,
    image2_identity_object_count,
    image2_frame_reference,
    candidate_resolutions,
    magichour_text_to_image_input,
    normalize_image2_reference_roles,
    openai_text_to_image_input,
    openai_text_to_image_25_input,
    text_to_image_identity_locked,
    text_to_image_images,
)
from prompts import add_image_reference_map, build_feature_prompt
from workflows.engine import (
    AllModelsFailedError,
    execute_with_fallback,
    order_text_to_image_candidates,
)


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


def test_saved_ui_roles_are_authoritative_over_prompt_text():
    req = {
        "referenceUrls": ["one.png", "two.png", "three.png", "four.png"],
        "referenceTags": ["@img1", "@img2", "@img3", "@img4"],
        "referenceRoles": ["detail", "element", "element", "style"],
        "sceneDetails": (
            "Use @img1 as the object to insert into @img2. "
            "Use @img3 for lighting and color treatment only. "
            "Borrow the material texture from @img4."
        ),
    }
    assert normalize_image2_reference_roles(req) == ["detail", "element", "element", "style"]


def test_legacy_requests_infer_roles_from_prompt_when_metadata_is_absent():
    req = {
        "referenceUrls": ["element.png", "base.png", "style.png", "detail.png"],
        "referenceTags": ["@img1", "@img2", "@img3", "@img4"],
        "sceneDetails": (
            "Use @img1 as the object to insert into @img2. "
            "Use @img3 for lighting and color treatment only. "
            "Borrow the material texture from @img4, "
            "but do not copy its objects or background."
        ),
    }
    assert normalize_image2_reference_roles(req) == ["element", "base", "style", "detail"]


def test_arabic_saved_ui_roles_are_authoritative():
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
    assert normalize_image2_reference_roles(req) == ["detail", "element", "element", "style"]


def test_arabic_legacy_role_inference_when_metadata_is_absent():
    req = {
        "referenceUrls": ["element.png", "background.png", "lighting.png", "material.png"],
        "referenceTags": ["@img1", "@img2", "@img3", "@img4"],
        "sceneDetails": (
            "استخدم @img1 كعنصر لإدخاله في @img2. "
            "استخدم @img3 للإضاءة والألوان فقط. "
            "استفد من خامة @img4 فقط."
        ),
    }
    assert normalize_image2_reference_roles(req) == ["element", "base", "style", "detail"]


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
    prompt = add_image_reference_map("Insert the object into the scene.", req)
    assert "COMPOSITING TASK" in prompt
    assert "contact shadows" in prompt
    assert "perspective" in prompt



def test_auto_frame_source_prefers_base_then_primary_then_element():
    req = {
        "imageUrl": "primary-element.png",
        "referenceUrls": ["style.png", "base.png", "element.png"],
        "referenceRoles": ["style", "base", "element"],
    }
    assert image2_frame_reference(req) == "base.png"

    without_base = {
        "imageUrl": "primary-element.png",
        "referenceUrls": ["style.png", "element.png"],
        "referenceRoles": ["style", "element"],
    }
    assert image2_frame_reference(without_base) == "primary-element.png"

    element_only = {
        "referenceUrls": ["style.png", "element.png"],
        "referenceRoles": ["style", "element"],
    }
    assert image2_frame_reference(element_only) == "element.png"


def test_style_and_detail_never_define_auto_frame():
    req = {
        "referenceUrls": ["style.png", "detail.png"],
        "referenceRoles": ["style", "detail"],
    }
    assert image2_frame_reference(req) is None


def test_magichour_builder_uses_resolved_frame_for_auto():
    payload = magichour_text_to_image_input(
        {
            "prompt": "Architectural visualization",
            "images": [],
            "aspectRatio": "auto",
            "resolvedAspectRatio": "16:9",
            "resolution": "640px",
            "quantity": 1,
        }
    )
    assert payload["aspectRatio"] == "16:9"


def test_native_adapters_honor_resolved_auto_frame():
    req = {
        "prompt": "Architectural visualization",
        "referenceUrls": [],
        "aspectRatio": "auto",
        "resolvedAspectRatio": "16:9",
        "resolution": "1K",
        "quality": "standard",
        "quantity": 1,
    }
    bfl = bfl_text_to_image_input(req)
    assert bfl["width"] == 1024
    assert bfl["height"] == 576

    openai = openai_text_to_image_25_input(req)
    assert openai["size"] == "1280x720"

    google = google_text_to_image_input(req)
    assert google["aspectRatio"] == "16:9"


def test_fallback_counts_the_separate_style_reference():
    candidate = Candidate(
        key="test-image2",
        name="Test Image2",
        description="Mock candidate",
        provider="openai",
        model_id="mock",
        cost_weight=1,
        cost_per_generation=1,
        max_references=0,
        timeout_ms=1000,
        tiers=("standard",),
        build_input=lambda req: req,
        extract_output=lambda data: [item["url"] for item in data.get("images", [])],
    )

    try:
        execute_with_fallback(
            "text_to_image",
            [candidate],
            {"styleReferenceUrl": "style.png", "prompt": "test", "quantity": 1},
            adapter_override=lambda _model, _input, _timeout: {"images": [{"url": "out.png"}]},
        )
    except AllModelsFailedError as error:
        assert "request contains 1" in error.attempts[0]["error"]
    else:
        raise AssertionError("A zero-reference candidate must reject a separate Style image")
