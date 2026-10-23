"""Regression tests for Image2 multi-reference prompts and provider routing."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from catalog import (
    TEXT_TO_IMAGE_CANDIDATES,
    bfl_text_to_image_input,
    openai_edit_input,
    google_text_to_image_input,
    magichour_text_to_image_input,
    openai_text_to_image_input,
)
from prompts import add_image_reference_map, build_image2_edit_prompt, build_text_to_image_prompt
import providers.magichour as magichour_provider
import providers.openai as openai_provider


def test_reference_manifest_maps_every_attachment_not_just_the_first_two():
    refs = [f"image-{i}" for i in range(1, 15)]
    tags = [f"@img{i}" for i in range(1, 15)]
    description = "Use @img1 as the background, add the tree from @img3, the house from @img8, and the car from @img14."
    prompt = add_image_reference_map(
        build_text_to_image_prompt(scene_details=description),
        {"feature": "text_to_image", "referenceUrls": refs, "referenceTags": tags},
    )
    for index, tag in enumerate(tags, start=1):
        assert f"{tag} is content/reference image {index}" in prompt
    assert "including the third and later images" in prompt
    assert description in prompt


def test_base_image_edit_prompt_maps_base_canvas_before_secondary_references():
    prompt = add_image_reference_map(
        build_image2_edit_prompt("Keep the building unchanged and add the tree from @img3."),
        {
            "feature": "text_to_image",
            "imageUrl": "base-canvas",
            "baseImageTag": "@img1",
            "referenceUrls": ["tree-reference"],
            "referenceTags": ["@img3"],
        },
    )
    assert "@img1, the PRIMARY BASE/CANVAS image to edit" in prompt
    assert "@img3 is content/reference image 1 (provider input image 2" in prompt
    assert "PRIMARY BASE IMAGE IS AUTHORITATIVE" in prompt
    assert "USER'S EXACT EDIT INSTRUCTION:\nKeep the building unchanged and add the tree from @img3." in prompt


def test_image2_base_edit_preserves_selected_style_filter():
    prompt = build_image2_edit_prompt("Keep the building the same.", ["dark"])
    assert "Keep the building the same." in prompt
    assert "#dark" in prompt
    assert "deliberate dark, low-key treatment" in prompt
    assert "Preserve every unrequested part of the base canvas." in prompt


def test_openai_edit_auto_ratio_does_not_force_square_output():
    payload = openai_edit_input({
        "prompt": "preserve the input framing",
        "imageUrl": "data:image/png;base64,YQ==",
        "referenceUrls": [],
        "aspectRatio": "auto",
        "quality": "standard",
        "quantity": 1,
    })
    assert payload["size"] == "auto"


def test_reference_map_preserves_gapped_ui_tags_after_removal():
    prompt = add_image_reference_map(
        "Use @img1 as the background and add the object from @img4.",
        {"feature": "text_to_image", "referenceUrls": ["a", "b"], "referenceTags": ["@img1", "@img4"]},
    )
    assert "@img1 is content/reference image 1" in prompt
    assert "@img4 is content/reference image 2" in prompt


def test_adapters_keep_all_supported_images_in_order():
    refs = [f"data:image/png;base64,REF{i}" for i in range(1, 6)]
    req = {"prompt": "compose using all references", "referenceUrls": refs, "aspectRatio": "1:1", "quality": "standard", "quantity": 1}

    assert openai_text_to_image_input(req)["images"] == refs
    assert google_text_to_image_input(req)["images"] == refs
    mh = magichour_text_to_image_input(req)
    assert mh["images"] == refs
    assert mh["is_text_to_image"] is True


def test_provider_reference_limits_reflect_fidelity_and_supported_count():
    models = {candidate.key: candidate for candidate in TEXT_TO_IMAGE_CANDIDATES}
    # Legacy Gemini 2.5 Flash is constrained to the vendor-recommended effective input count.
    assert models["gemini-2.5-flash"].max_references == 3
    # Image2's UI limit is 14; GPT Image 1's edit API supports up to 16 input images.
    assert models["gpt-image-1"].max_references == 14
    assert models["flux-pro"].max_references == 1
    assert models["flux-dev"].max_references == 1


def test_bfl_candidate_uses_only_one_image_and_is_not_eligible_for_multi_image_requests():
    model = next(candidate for candidate in TEXT_TO_IMAGE_CANDIDATES if candidate.key == "flux-pro")
    payload = bfl_text_to_image_input({
        "prompt": "test", "aspectRatio": "1:1", "quantity": 1,
        "referenceUrls": ["first-image", "second-image", "third-image"],
    })
    assert payload["image_prompt"] == "first-image"
    assert model.max_references == 1


def test_openai_edit_requests_high_input_fidelity(monkeypatch):
    captured = {}

    class FakeResponse:
        status_code = 200
        text = ""

        @staticmethod
        def json():
            return {"data": [{"b64_json": "aGVsbG8="}]}

    def fake_post(url, **kwargs):
        captured.update(kwargs)
        return FakeResponse()

    monkeypatch.setattr(openai_provider.httpx, "post", fake_post)
    openai_provider._run_image_edit(
        "gpt-image-1",
        {
            "images": ["data:image/png;base64,aGVsbG8="],
            "prompt": "use the exact reference",
            "size": "auto",
            "quality": "medium",
        },
    )

    assert captured["data"]["input_fidelity"] == "high"


def test_magichour_uses_editor_for_attached_images_and_generator_without_images(monkeypatch):
    calls = []
    monkeypatch.setattr(
        magichour_provider, "_run_image_edit",
        lambda model_id, input_, timeout_ms: calls.append("edit") or "edit-output",
    )
    monkeypatch.setattr(
        magichour_provider, "_run_image_generator",
        lambda model_id, input_, timeout_ms: calls.append("generate") or "generate-output",
    )

    edited = magichour_provider.generate(
        "flux-2-klein", {"images": ["img1", "img2", "img3"], "quantity": 1}, 1000
    )
    generated = magichour_provider.generate(
        "flux-2-klein", {"images": [], "is_text_to_image": True, "quantity": 1}, 1000
    )

    assert calls == ["edit", "generate"]
    assert edited["images"][0]["url"] == "edit-output"
    assert generated["images"][0]["url"] == "generate-output"
