
"""Regressions for Image2 source roles, identity prompts and provider ordering."""
import base64
import io
import sys
from pathlib import Path

from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from catalog import (
    MODEL_CATALOG,
    candidate_resolutions,
    candidate_text_to_image_frame_ratios,
    google_text_to_image_input,
    image2_frame_reference,
    image2_identity_object_count,
    image2_reference_role_conflicts,
    Image2AutoFrameError,
    Image2RoleConflictError,
    magichour_text_to_image_input,
    normalize_image2_reference_roles,
    openai_text_to_image_input,
    openai_text_to_image_25_input,
    text_to_image_identity_locked,
    text_to_image_images,
)
from prompts import add_image_reference_map, build_feature_prompt
from workflows.engine import order_text_to_image_candidates
from workflows.image_render import _infer_aspect_ratio, _resolve_image2_aspect_ratio
from workflows import image_render


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


def test_saved_role_metadata_is_authoritative_and_prompt_conflicts_are_reported():
    req = {
        "referenceUrls": ["base.png"],
        "referenceTags": ["@img1"],
        "referenceRoles": ["base"],
        "sceneDetails": "Use @img1 as an Element.",
    }

    assert normalize_image2_reference_roles(req) == ["base"]
    assert image2_reference_role_conflicts(req) == [
        {"tag": "@img1", "saved_role": "base", "prompt_role": "element"}
    ]


def test_identity_preservation_language_does_not_reassign_a_base_role():
    req = {
        "referenceUrls": ["base.png"],
        "referenceTags": ["@img1"],
        "referenceRoles": ["base"],
        "sceneDetails": "Preserve the identity, geometry and proportions of @img1.",
    }

    assert normalize_image2_reference_roles(req) == ["base"]
    assert image2_reference_role_conflicts(req) == []


def test_prompt_assigning_two_roles_to_one_tag_is_rejected_as_ambiguous():
    req = {
        "referenceUrls": ["base.png"],
        "referenceTags": ["@img1"],
        "referenceRoles": ["base"],
        "sceneDetails": "Use @img1 as Base and Element.",
    }

    assert normalize_image2_reference_roles(req) == ["base"]
    assert image2_reference_role_conflicts(req) == [
        {"tag": "@img1", "saved_role": "base", "prompt_role": "element"}
    ]


def test_negative_role_instruction_does_not_create_a_conflict():
    req = {
        "referenceUrls": ["base.png"],
        "referenceTags": ["@img1"],
        "referenceRoles": ["base"],
        "sceneDetails": "Do not use @img1 as an Element; preserve it as the Base scene.",
    }

    assert normalize_image2_reference_roles(req) == ["base"]
    assert image2_reference_role_conflicts(req) == []


def test_same_role_instruction_does_not_create_a_conflict():
    req = {
        "referenceUrls": ["base.png"],
        "referenceTags": ["@img1"],
        "referenceRoles": ["base"],
        "sceneDetails": "Use @img1 as the Base scene.",
    }

    assert normalize_image2_reference_roles(req) == ["base"]
    assert image2_reference_role_conflicts(req) == []


def test_legacy_missing_role_defaults_to_element_and_prompt_cannot_change_it():
    req = {
        "referenceUrls": ["reference.png"],
        "referenceTags": ["@img1"],
        "sceneDetails": "Use @img1 as the Base scene.",
    }

    assert normalize_image2_reference_roles(req) == ["element"]
    assert image2_reference_role_conflicts(req) == [
        {"tag": "@img1", "saved_role": "element", "prompt_role": "base"}
    ]


def test_role_conflict_fails_before_prompt_build_or_provider_execution(monkeypatch):
    failures = []

    class FakeConnection:
        def __enter__(self):
            return self

        def __exit__(self, exc_type, exc, traceback):
            return False

    def unexpected_call(*args, **kwargs):
        raise AssertionError("a role conflict must stop before provider execution")

    monkeypatch.setattr(image_render.db, "connect", lambda: FakeConnection())
    monkeypatch.setattr(image_render, "mark_processing", lambda conn, job_id: None)
    monkeypatch.setattr(image_render, "fail_job", lambda conn, job, err: failures.append(err))
    monkeypatch.setattr(image_render, "build_feature_prompt", unexpected_call)
    monkeypatch.setattr(image_render, "execute_with_fallback", unexpected_call)

    image_render.run(
        {
            "id": "test-job",
            "input": {
                "feature": "text_to_image",
                "referenceUrls": ["base.png"],
                "referenceTags": ["@img1"],
                "referenceRoles": ["base"],
                "sceneDetails": "Use @img1 as an Element.",
            },
        }
    )

    assert len(failures) == 1
    assert isinstance(failures[0], Image2RoleConflictError)


def test_arabic_prompt_role_conflicts_are_detected_without_mutating_metadata():
    req = {
        "referenceUrls": ["element.png", "base.png", "style.png", "detail.png"],
        "referenceTags": ["@img1", "@img2", "@img3", "@img4"],
        "referenceRoles": ["detail", "element", "element", "style"],
        "sceneDetails": (
            "استخدم @img1 كعنصر لإدخاله في @img2. "
            "استخدم @img3 للإضاءة والألوان فقط. "
            "استفد من خامة @img4 فقط."
        ),
    }

    assert normalize_image2_reference_roles(req) == [
        "detail", "element", "element", "style"
    ]
    assert image2_reference_role_conflicts(req) == [
        {"tag": "@img1", "saved_role": "detail", "prompt_role": "element"},
        {"tag": "@img2", "saved_role": "element", "prompt_role": "base"},
        {"tag": "@img3", "saved_role": "element", "prompt_role": "style"},
        {"tag": "@img4", "saved_role": "style", "prompt_role": "detail"},
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


def test_auto_frame_does_not_use_primary_image_without_base():
    req = {
        "imageUrl": "primary.png",
        "referenceUrls": ["style.png", "detail.png"],
        "referenceRoles": ["style", "detail"],
    }

    assert image2_frame_reference(req) is None


def test_auto_frame_does_not_use_element_without_base():
    req = {
        "referenceUrls": ["style.png", "detail.png", "element.png"],
        "referenceRoles": ["style", "detail", "element"],
    }

    assert image2_frame_reference(req) is None


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


def test_auto_frame_rejects_multiple_base_references():
    req = {
        "referenceUrls": ["base-one.png", "base-two.png", "element.png"],
        "referenceRoles": ["base", "base", "element"],
    }

    try:
        image2_frame_reference(req)
    except Image2AutoFrameError as exc:
        assert "exactly one Base" in str(exc)
    else:
        raise AssertionError("multiple Base references must fail Auto framing")


def test_auto_frame_rejects_a_missing_base_file():
    req = {"referenceUrls": [None], "referenceRoles": ["base"]}

    try:
        image2_frame_reference(req)
    except Image2AutoFrameError as exc:
        assert "Base reference" in str(exc)
    else:
        raise AssertionError("a missing Base file must not silently default to 4:3")


def test_auto_uses_four_by_three_without_base_even_when_primary_or_element_exists():
    request = {
        "imageUrl": "primary.png",
        "referenceUrls": ["style.png", "detail.png", "element.png"],
        "referenceRoles": ["style", "detail", "element"],
        "aspectRatio": "auto",
        "model": "gpt-image-2.5-sunburst",
    }

    assert _resolve_image2_aspect_ratio(request, request) == "4:3"


def test_auto_magic_hour_text_only_keeps_square_native_default():
    request = {
        "referenceUrls": [],
        "referenceRoles": [],
        "aspectRatio": "auto",
        "model": "magichour-flux-2-klein-text",
    }

    assert _resolve_image2_aspect_ratio(request, request) == "1:1"


def test_explicit_ratio_is_not_recomputed_from_base():
    request = {
        "referenceUrls": ["unreadable-base.png"],
        "referenceRoles": ["base"],
        "aspectRatio": "16:9",
        "model": "gpt-image-2.5-sunburst",
    }

    assert _resolve_image2_aspect_ratio(request, request) == "16:9"


def _jpeg_data_uri_with_orientation(width: int, height: int, orientation: int) -> tuple[str, bytes]:
    image = Image.new("RGB", (width, height), "white")
    exif = image.getexif()
    exif[274] = orientation
    buffer = io.BytesIO()
    image.save(buffer, format="JPEG", exif=exif.tobytes())
    original = buffer.getvalue()
    encoded = base64.b64encode(original).decode("ascii")
    return f"data:image/jpeg;base64,{encoded}", original


def test_auto_ratio_respects_exif_orientation_6_without_changing_source_bytes():
    data_uri, original_bytes = _jpeg_data_uri_with_orientation(1600, 900, 6)
    before_hash = __import__("hashlib").sha256(original_bytes).hexdigest()

    assert _infer_aspect_ratio(data_uri) == "9:16"
    after_bytes = base64.b64decode(data_uri.split(",", 1)[1])
    assert __import__("hashlib").sha256(after_bytes).hexdigest() == before_hash
    assert after_bytes == original_bytes


def test_auto_ratio_respects_exif_orientation_8_without_changing_source_bytes():
    data_uri, original_bytes = _jpeg_data_uri_with_orientation(900, 1600, 8)
    before_hash = __import__("hashlib").sha256(original_bytes).hexdigest()

    assert _infer_aspect_ratio(data_uri) == "16:9"
    after_bytes = base64.b64decode(data_uri.split(",", 1)[1])
    assert __import__("hashlib").sha256(after_bytes).hexdigest() == before_hash
    assert after_bytes == original_bytes


def test_auto_ratio_fails_clearly_when_selected_base_cannot_be_read():
    try:
        _infer_aspect_ratio("data:image/png;base64,not-a-valid-image")
    except Image2AutoFrameError as exc:
        assert "could not read" in str(exc).lower()
    else:
        raise AssertionError("an unreadable Base must not silently become 4:3")


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
