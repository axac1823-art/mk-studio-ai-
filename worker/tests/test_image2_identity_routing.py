"""Mandatory regression tests for Image2 identity routing, reference roles, object limits, and model fallback."""
import base64
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from catalog import (
    MODEL_CATALOG,
    TEXT_TO_IMAGE_CANDIDATES,
    filter_text_to_image_candidates,
    image2_identity_object_count,
    list_feature_models,
    normalize_image2_reference_roles,
    text_to_image_candidates_for_tier,
    text_to_image_identity_locked,
    text_to_image_images,
)
from prompts import add_image_reference_map, build_text_to_image_prompt
import providers.openai as openai_provider
import workflows.image_render as image_render


def test_primary_image_url_locks_identity():
    # 1. Primary imageUrl locks identity
    req = {
        "feature": "text_to_image",
        "imageUrl": "data:image/png;base64,PRIMARY",
        "referenceUrls": [],
    }
    assert text_to_image_identity_locked(req) is True
    assert image2_identity_object_count(req) == 1


def test_element_and_base_roles_lock_routing():
    # 2. element and base lock routing
    req_element = {
        "feature": "text_to_image",
        "referenceUrls": ["ref1"],
        "referenceRoles": ["element"],
    }
    assert text_to_image_identity_locked(req_element) is True
    assert image2_identity_object_count(req_element) == 1

    req_base = {
        "feature": "text_to_image",
        "referenceUrls": ["ref1"],
        "referenceRoles": ["base"],
    }
    assert text_to_image_identity_locked(req_base) is True
    # Base is the destination scene, not counted as an object in identity_object_count
    assert image2_identity_object_count(req_base) == 0


def test_style_only_and_detail_only_do_not_lock_identity_alone():
    # 3. style only and detail only do not lock element identity alone
    req_style = {
        "feature": "text_to_image",
        "referenceUrls": ["ref1"],
        "referenceRoles": ["style"],
    }
    assert text_to_image_identity_locked(req_style) is False
    assert image2_identity_object_count(req_style) == 0

    req_detail = {
        "feature": "text_to_image",
        "referenceUrls": ["ref1"],
        "referenceRoles": ["detail"],
    }
    assert text_to_image_identity_locked(req_detail) is False
    assert image2_identity_object_count(req_detail) == 0

    req_style_and_detail = {
        "feature": "text_to_image",
        "styleReferenceUrl": "style-ref",
        "referenceUrls": ["detail-ref"],
        "referenceRoles": ["detail"],
    }
    assert text_to_image_identity_locked(req_style_and_detail) is False
    assert image2_identity_object_count(req_style_and_detail) == 0


def test_missing_or_invalid_reference_roles_default_to_element():
    # 4. Absence of referenceRoles or invalid role defaults to element
    req_missing = {
        "feature": "text_to_image",
        "referenceUrls": ["ref1", "ref2"],
    }
    assert normalize_image2_reference_roles(req_missing) == ["element", "element"]
    assert text_to_image_identity_locked(req_missing) is True
    assert image2_identity_object_count(req_missing) == 2

    req_invalid = {
        "feature": "text_to_image",
        "referenceUrls": ["ref1", "ref2", "ref3"],
        "referenceRoles": ["unknown", None, 123],
    }
    assert normalize_image2_reference_roles(req_invalid) == ["element", "element", "element"]
    assert text_to_image_identity_locked(req_invalid) is True
    assert image2_identity_object_count(req_invalid) == 3


def test_locked_identity_candidates_must_support_identity_edit():
    # 5. In locked mode, all resulting candidates must have supports_identity_edit=True
    candidates = filter_text_to_image_candidates(
        TEXT_TO_IMAGE_CANDIDATES,
        input_count=1,
        has_style_reference=False,
        identity_locked=True,
        identity_object_count=1,
    )
    assert len(candidates) > 0
    for candidate in candidates:
        assert candidate.supports_identity_edit is True
    # Magic Hour and Flux do not declare supports_identity_edit and must not be present
    keys = {c.key for c in candidates}
    assert "magichour-flux-2-klein-text" not in keys
    assert "flux-pro" not in keys
    assert "flux-dev" not in keys


def test_candidates_without_sufficient_capacity_are_excluded():
    # 6. Any candidate without sufficient capacity (max_references < input_count) is excluded
    candidates_15 = filter_text_to_image_candidates(
        TEXT_TO_IMAGE_CANDIDATES,
        input_count=15,
        has_style_reference=False,
        identity_locked=False,
        identity_object_count=0,
    )
    # Gemini has max_references=14, so it must be excluded for 15 inputs. Only OpenAI (16) can handle 15.
    keys_15 = {c.key for c in candidates_15}
    assert "gemini-2.5-flash" not in keys_15
    assert "gpt-image-1.5" in keys_15

    candidates_17 = filter_text_to_image_candidates(
        TEXT_TO_IMAGE_CANDIDATES,
        input_count=17,
        has_style_reference=False,
        identity_locked=False,
        identity_object_count=0,
    )
    assert len(candidates_17) == 0


def test_exceeding_max_identity_objects_excludes_candidate():
    # 7. Exceeding max_identity_objects excludes the candidate with that limit
    # Gemini Nano Banana has max_identity_objects = 10, max_references = 14
    gemini = next(c for c in TEXT_TO_IMAGE_CANDIDATES if c.key == "gemini-2.5-flash")
    assert gemini.max_identity_objects == 10

    # 10 element objects: Gemini eligible
    candidates_10 = filter_text_to_image_candidates(
        [gemini],
        input_count=10,
        has_style_reference=False,
        identity_locked=True,
        identity_object_count=10,
    )
    assert len(candidates_10) == 1

    # 11 element objects: Gemini excluded because 11 > 10
    candidates_11 = filter_text_to_image_candidates(
        [gemini],
        input_count=11,
        has_style_reference=False,
        identity_locked=True,
        identity_object_count=11,
    )
    assert len(candidates_11) == 0


def test_image_input_order_matches_reference_map_and_adapters():
    # 8. Images order: styleReferenceUrl, imageUrl, then referenceUrls
    req = {
        "styleReferenceUrl": "data:image/png;base64,STYLE",
        "imageUrl": "data:image/png;base64,PRIMARY",
        "referenceUrls": ["data:image/png;base64,REF1", "data:image/png;base64,REF2"],
        "referenceTags": ["@img1", "@img2"],
        "referenceRoles": ["element", "base"],
        "feature": "text_to_image",
    }
    ordered = text_to_image_images(req)
    assert ordered == [
        "data:image/png;base64,STYLE",
        "data:image/png;base64,PRIMARY",
        "data:image/png;base64,REF1",
        "data:image/png;base64,REF2",
    ]

    manifest = add_image_reference_map("Base prompt", req)
    assert "Input image 1 is @style" in manifest
    assert "Input image 2 is @element" in manifest
    assert "@img1 is content/reference image 1 (provider input image 3)" in manifest
    assert "@img2 is content/reference image 2 (provider input image 4)" in manifest


def test_style_only_request_retains_magic_hour_if_eligible():
    # 9. Style-only request does not exclude Magic Hour just because it doesn't declare supports_identity_edit
    req = {
        "referenceUrls": ["style-ref"],
        "referenceRoles": ["style"],
    }
    identity_locked = text_to_image_identity_locked(req)
    assert identity_locked is False

    candidates = filter_text_to_image_candidates(
        TEXT_TO_IMAGE_CANDIDATES,
        input_count=1,
        has_style_reference=True,
        identity_locked=identity_locked,
        identity_object_count=image2_identity_object_count(req),
    )
    keys = {c.key for c in candidates}
    assert "magichour-flux-2-klein-text" in keys


def test_no_valid_candidates_raises_clear_error_without_low_fidelity_fallback(monkeypatch):
    # 10. If no candidates remain, error is raised without low-fidelity fallback
    job = {
        "id": "00000000-0000-0000-0000-000000000001",
        "input": {
            "feature": "text_to_image",
            "referenceUrls": ["ref1"],
            "referenceRoles": ["element"],
            "model": "auto",
        },
    }
    # Unconfigure all providers so no configured model meets requirements
    monkeypatch.setattr(image_render, "is_provider_configured", lambda p: False)
    monkeypatch.setattr(image_render, "mark_processing", lambda conn, job_id: None)
    failed_reasons = []
    monkeypatch.setattr(image_render, "fail_job", lambda conn, j, err: failed_reasons.append(str(err)))

    image_render.run(job)
    assert len(failed_reasons) == 1
    assert "No configured Image2 model meets the source-image editing" in failed_reasons[0]
    assert "No low-fidelity fallback was used" in failed_reasons[0]


def test_explicit_selection_of_ineligible_model_fails_clearly(monkeypatch):
    # 11. Explicit manual selection of an ineligible model is rejected, no silent fallback
    job = {
        "id": "00000000-0000-0000-0000-000000000002",
        "input": {
            "feature": "text_to_image",
            "referenceUrls": ["ref1"],
            "referenceRoles": ["element"],
            # magichour does not support identity edit
            "model": "magichour-flux-2-klein-text",
        },
    }
    monkeypatch.setattr(image_render, "is_provider_configured", lambda p: True)
    monkeypatch.setattr(image_render, "mark_processing", lambda conn, job_id: None)
    failed_reasons = []
    monkeypatch.setattr(image_render, "fail_job", lambda conn, j, err: failed_reasons.append(str(err)))

    image_render.run(job)
    assert len(failed_reasons) == 1
    assert "The selected model is not eligible for Image2 element/base-scene editing" in failed_reasons[0]


def test_gpt_image_sunburst_passes_all_images_and_no_input_fidelity(monkeypatch):
    # 12. GPT Image 2.5 Sunburst passes all images to /images/edits and does NOT send input_fidelity
    captured_payloads = []

    class FakeResponse:
        status_code = 200
        text = ""

        @staticmethod
        def json():
            return {"data": [{"b64_json": "aGVsbG8="}]}

    def fake_post(url, **kwargs):
        captured_payloads.append((url, kwargs))
        return FakeResponse()

    monkeypatch.setattr(openai_provider.httpx, "post", fake_post)

    dummy_b64 = base64.b64encode(b"fake-image-bytes").decode("ascii")
    images = [f"data:image/png;base64,{dummy_b64}" for _ in range(3)]
    openai_provider._run_image_edit(
        "gpt-image-2.5-sunburst",
        {
            "prompt": "Test architectural composition",
            "images": images,
            "size": "1024x1024",
            "quality": "high",
            "output_format": "png",
        },
    )

    assert len(captured_payloads) == 1
    url, kwargs = captured_payloads[0]
    assert "/images/edits" in url
    # Verify input_fidelity is NOT sent to gpt-image-2.5-sunburst
    assert "input_fidelity" not in kwargs["data"]
    # Verify all 3 images were attached in files under image[]
    files = kwargs["files"]
    image_files = [f for f in files if f[0] == "image[]"]
    assert len(image_files) == 3


def test_list_feature_models_exports_max_identity_objects():
    # Verify maxIdentityObjects is exported to the client
    models = {item["key"]: item for item in list_feature_models("text_to_image")}
    assert "maxIdentityObjects" in models["gemini-2.5-flash"]
    assert models["gemini-2.5-flash"]["maxIdentityObjects"] == 10
    assert models["gpt-image-1.5"]["maxIdentityObjects"] is None
    assert models["magichour-flux-2-klein-text"]["maxIdentityObjects"] is None


def test_prompts_primary_element_and_role_instructions():
    # Prompt tests verifying the 5 points in instruction 6:
    # 1. Primary imageUrl present -> PRIMARY ELEMENT IDENTITY section added
    prompt_with_primary = build_text_to_image_prompt(
        scene_details="Villa terrace",
        preserve_element_identity=True,
        has_reference_images=True,
    )
    assert "PRIMARY ELEMENT IDENTITY" in prompt_with_primary
    assert "@element" in prompt_with_primary

    # 2. referenceUrls with role element without imageUrl -> NO PRIMARY ELEMENT IDENTITY section
    prompt_without_primary = build_text_to_image_prompt(
        scene_details="Villa terrace",
        preserve_element_identity=False,
        has_reference_images=True,
    )
    assert "PRIMARY ELEMENT IDENTITY" not in prompt_without_primary

    # But @img1 element identity role instructions are in add_image_reference_map
    mapped = add_image_reference_map(
        prompt_without_primary,
        {
            "feature": "text_to_image",
            "referenceUrls": ["chair-img"],
            "referenceTags": ["@img1"],
            "referenceRoles": ["element"],
        },
    )
    assert "OBJECT TO INSERT/PRESERVE" in mapped
    assert "preserve its defining silhouette" in mapped
    assert "ELEMENT IDENTITY" in mapped

    # 3. base role instructions preserve base scene and unrequested areas
    mapped_base = add_image_reference_map(
        prompt_without_primary,
        {
            "feature": "text_to_image",
            "referenceUrls": ["scene-img"],
            "referenceTags": ["@img1"],
            "referenceRoles": ["base"],
        },
    )
    assert "BASE SCENE/BACKGROUND" in mapped_base
    assert "Preserve its viewpoint, framing, architecture and unrelated areas" in mapped_base
    assert "BASE IMAGE PRESERVATION: keep the designated base scene and all unrequested areas stable" in mapped_base

    # 4. style role guides lighting and color palette without copying subject
    mapped_style = add_image_reference_map(
        prompt_without_primary,
        {
            "feature": "text_to_image",
            "referenceUrls": ["mood-img"],
            "referenceTags": ["@img1"],
            "referenceRoles": ["style"],
        },
    )
    assert "STYLE ONLY: transfer lighting, tonal range, contrast, palette" in mapped_style
    assert "Do not copy this image's objects or composition" in mapped_style
    assert "HISTORICAL IMAGE2 LIGHTING DISCIPLINE" in mapped_style

    # 5. Legacy/missing/invalid roles default to element in filtering and add_image_reference_map
    mapped_legacy = add_image_reference_map(
        prompt_without_primary,
        {
            "feature": "text_to_image",
            "referenceUrls": ["img1"],
            "referenceTags": ["@img1"],
            "referenceRoles": ["invalid_role_name"],
        },
    )
    assert "user-declared role: element" in mapped_legacy
    assert "OBJECT TO INSERT/PRESERVE" in mapped_legacy
