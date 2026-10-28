#!/usr/bin/env python3
"""Guarded local Image2 fidelity/resolution patch applicator.

Default behavior is read-only validation. Pass --apply to create backups and
modify the current working tree. Targeted at CODEX commit a5909b75... only.
"""
from __future__ import annotations

import argparse
import difflib
import subprocess
import sys
from pathlib import Path

BASE_COMMIT = "a5909b75c2ba0507463f20efb174bbcd02a47d9"
BACKUP_SUFFIX = ".pre-image2-fidelity.bak"

class PatchMismatch(RuntimeError):
    pass


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise PatchMismatch(f"{label}: expected one matching code block; found {count}")
    return text.replace(old, new, 1)


def insert_after_candidate(text: str, key: str, additions: str) -> str:
    marker = f'        "{key}",'
    # Some candidate constructors use the same string for key and provider model_id
    # (e.g. Flux Pro), so select the first occurrence, which is the candidate key.
    if text.count(marker) < 1:
        raise PatchMismatch(f"catalog candidate {key}: candidate key not found")
    start = text.index(marker)
    candidate_start = text.rfind("    Candidate(", 0, start)
    end = text.find("    ),", start)
    if candidate_start < 0 or (text.find("    Candidate(", start, end) >= 0 if end >= 0 else True):
        raise PatchMismatch(f"catalog candidate {key}: ambiguous candidate block")
    if end < 0:
        raise PatchMismatch(f"catalog candidate {key}: candidate ending not found")
    block = text[start:end]
    ending = "        extract_image_urls,\n"
    if block.count(ending) != 1:
        raise PatchMismatch(f"catalog candidate {key}: expected extract_output exactly once")
    block = block.replace(ending, ending + additions, 1)
    return text[:start] + block + text[end:]


def set_candidate_tiers(text: str, key: str, old_tiers: str, new_tiers: str) -> str:
    """Change quality tiers inside one candidate block without touching other models."""
    marker = f'        "{key}",'
    if text.count(marker) < 1:
        raise PatchMismatch(f"catalog candidate {key}: candidate key not found")
    start = text.index(marker)
    end = text.find("    ),", start)
    if end < 0 or text.find("    Candidate(", start, end) >= 0:
        raise PatchMismatch(f"catalog candidate {key}: candidate block is ambiguous")
    before, block, after = text[:start], text[start:end], text[end:]
    block = replace_once(block, old_tiers, new_tiers, f"{key} quality tiers")
    return before + block + after


def edits() -> dict[str, list[tuple[str, str, str]]]:
    """Each tuple is (old text, new text, label); changes are guarded and atomic."""
    frame_insert = '''
# GPT Image 2.5 Sunburst accepts arbitrary dimensions within the documented
# limits. Keep the supported frame/resolution pairs explicit so the UI and
# worker cannot promise a size the adapter cannot actually request.
GPT_IMAGE_SIZES_BY_RESOLUTION: dict[str, dict[str, str]] = {
    "1K": {
        "1:1": "1024x1024", "16:9": "1536x864", "9:16": "864x1536",
        "4:3": "1280x960", "3:4": "960x1280", "3:2": "1536x1024",
        "2:3": "1024x1536", "21:9": "1344x576",
    },
    "2K": {
        "1:1": "2048x2048", "16:9": "2048x1152", "9:16": "1152x2048",
        "4:3": "2048x1536", "3:4": "1536x2048", "3:2": "2016x1344",
        "2:3": "1344x2016", "21:9": "2016x864",
    },
    # Conservative 4K options. Other ratios are capped at the 2K option to
    # avoid advertising 4K when the direct OpenAI size limits cannot meet it.
    "4K": {
        "16:9": "3840x2160", "9:16": "2160x3840", "21:9": "3840x1648",
    },
}
GPT_IMAGE_RESOLUTION_RATIOS: dict[str, tuple[str, ...]] = {
    "auto": ("1K",),
    **{
        frame: tuple(resolution for resolution, sizes in GPT_IMAGE_SIZES_BY_RESOLUTION.items() if frame in sizes)
        for frame in ALL_FRAMES
    },
}
'''
    frame_size_function = '''
def gpt_image_size(ratio: str | None, resolution: str | None) -> str:
    """Return a documented size for GPT Image 2.5 Sunburst."""
    frame = ratio or "auto"
    requested_resolution = resolution or "1K"
    if frame == "auto":
        if requested_resolution != "1K":
            raise ValueError(
                "GPT Image 2.5 Sunburst supports explicit 2K/4K only with a selected frame. "
                "Choose a frame or use 1K Auto."
            )
        return "auto"
    try:
        return GPT_IMAGE_SIZES_BY_RESOLUTION[requested_resolution][frame]
    except KeyError:
        available = GPT_IMAGE_RESOLUTION_RATIOS.get(frame, ())
        raise ValueError(
            f"GPT Image 2.5 Sunburst does not support {requested_resolution} for {frame}. "
            f"Supported resolutions: {', '.join(available) or 'none'}."
        ) from None

'''
    filter_function = '''
def filter_by_resolution(
    candidates: list,
    requested_frame: str | None,
    requested_resolution: str | None,
    selected_model: str | None,
) -> list:
    """Keep only models that explicitly support this frame/resolution pair."""
    frame = requested_frame or "auto"
    resolution = requested_resolution or "1K"

    def supports(candidate) -> bool:
        matrix = dict(getattr(candidate, "resolution_ratios", ()) or ())
        if matrix:
            return resolution in matrix.get(frame, ())
        return resolution in getattr(candidate, "resolutions", ("1K",))

    if selected_model and selected_model != "auto":
        selected = next((item for item in candidates if item.key == selected_model), None)
        if selected is None:
            raise ValueError(
                "The selected model is not compatible with the chosen image inputs. "
                "Choose another model or adjust the references."
            )
        if not supports(selected):
            matrix = dict(getattr(selected, "resolution_ratios", ()) or ())
            available = matrix.get(frame, ()) if matrix else getattr(selected, "resolutions", ("1K",))
            raise ValueError(
                f"{selected.name} does not support {resolution} output for {frame}. "
                f"Supported resolutions: {', '.join(available) or 'none'}."
            )
        return [selected]

    capable = [candidate for candidate in candidates if supports(candidate)]
    if not capable:
        available = sorted({
            value
            for candidate in candidates
            for value in (
                dict(getattr(candidate, "resolution_ratios", ()) or ()).get(frame, ())
                if getattr(candidate, "resolution_ratios", ())
                else getattr(candidate, "resolutions", ("1K",))
            )
        })
        raise ValueError(
            f"No compatible configured model supports {resolution} output for {frame}. "
            f"Available resolutions: {', '.join(available) or 'none'}."
        )
    return capable


def check_delivered_resolution(width: int, height: int, requested: str | None) -> bool:
    """Reject output that silently falls materially below requested resolution."""
    minimum_edge = {"1K": 900, "2K": 1800, "4K": 3000}.get(requested or "1K")
    if minimum_edge is None:
        return True
    delivered_edge = max(width, height)
    matches = delivered_edge >= minimum_edge
    if not matches:
        logger.warning(
            "Image2 resolution mismatch: requested %s, provider returned %dx%d",
            requested, width, height,
        )
    return matches

'''
    catalog_import_old = "from frame_ratio import ALL_FRAMES, BFL_DIMENSIONS, GPT_IMAGE_1_SIZES, MAGICHOUR_FRAMES, exact_size"
    catalog_import_new = "from frame_ratio import ALL_FRAMES, BFL_DIMENSIONS, GPT_IMAGE_RESOLUTION_RATIOS, MAGICHOUR_FRAMES, gpt_image_size"
    candidate_tail_old = '''    # Current text-to-image adapters expose approximately 1K output only.
    # Do not advertise 2K/4K until an adapter really requests those sizes.
    resolutions: tuple[str, ...] = ("1K",)
    # Only frames confirmed for this exact model/adapter; empty means unknown.
    frame_ratios: tuple[str, ...] = ()
'''
    candidate_tail_new = '''    # Only advertise resolutions passed through a real provider adapter.
    resolutions: tuple[str, ...] = ("1K",)
    # Only frames confirmed for this exact model/adapter; empty means unknown.
    frame_ratios: tuple[str, ...] = ()
    # Optional per-frame resolution matrix; used by Image2's UI and worker.
    resolution_ratios: tuple[tuple[str, tuple[str, ...]], ...] = ()
'''
    openai_builder_old = '''def openai_text_to_image_input(req: dict) -> dict:
    """OpenAI image generation/editing with the requested frame and inputs."""
    ratio = req.get("aspectRatio") or "auto"
    size = "auto" if ratio == "auto" else exact_size(GPT_IMAGE_1_SIZES, ratio)
    images = text_to_image_images(req)
    return {
        "prompt": req["prompt"],
        "images": images,
        "require_images": bool(
            req.get("imageUrl")
            or req.get("styleReferenceUrl")
            or req.get("referenceUrls")
        ),
        "size": size,
        "quality": "high" if req["quality"] == "pro" else "medium",
        "quantity": req["quantity"],
    }
'''
    openai_builder_new = '''def openai_text_to_image_input(req: dict) -> dict:
    """OpenAI Image2 edit with native frame size, fidelity-oriented quality and PNG output."""
    ratio = req.get("aspectRatio") or "auto"
    resolution = req.get("resolution") or "1K"
    size = gpt_image_size(ratio, resolution)
    images = text_to_image_images(req)
    return {
        "prompt": req["prompt"],
        "images": images,
        "require_images": bool(
            req.get("imageUrl")
            or req.get("styleReferenceUrl")
            or req.get("referenceUrls")
        ),
        "size": size,
        # Keep baseline Image2 output at high quality; Pro opts into xhigh.
        "quality": "xhigh" if req.get("quality") == "pro" else "high",
        # PNG avoids the additional lossy JPEG step on detailed architectural/product edges.
        "output_format": "png",
        "quantity": req["quantity"],
    }
'''
    google_builder_old = '''    payload = {
        "prompt": req["prompt"],
        "images": images,
        "require_images": bool(
            req.get("imageUrl")
            or req.get("styleReferenceUrl")
            or req.get("referenceUrls")
        ),
        "quantity": req["quantity"],
    }
'''
    google_builder_new = '''    payload = {
        "prompt": req["prompt"],
        "images": images,
        "require_images": bool(
            req.get("imageUrl")
            or req.get("styleReferenceUrl")
            or req.get("referenceUrls")
        ),
        "quantity": req["quantity"],
        "resolution": req.get("resolution") or "1K",
    }
'''
    style_old = '''    if has_style:
        guidance.append(
            "STYLE REFERENCE: use @style for the visual treatment explicitly requested by the user, "
            "such as palette, contrast, texture, or rendering medium. Do not copy its subject, objects, "
            "architecture, or composition unless DESCRIPTION asks for that. If DESCRIPTION assigns "
            "@style another role, follow that explicit instruction instead."
        )
    elif fields.get("feature") != "text_to_image":
'''
    style_new = '''    if has_style:
        guidance.append(
            "STYLE REFERENCE: use @style for the visual treatment explicitly requested by the user, "
            "such as palette, contrast, texture, or rendering medium. Do not copy its subject, objects, "
            "architecture, or composition unless DESCRIPTION asks for that. If DESCRIPTION assigns "
            "@style another role, follow that explicit instruction instead."
        )
        if fields.get("feature") == "text_to_image":
            # Restore the historical Image2 lighting discipline rather than applying generic bright archviz.
            guidance.append(
                "HIGHEST-PRIORITY STYLE TRANSFER: @style controls the final image's actual visual "
                "signature. Match its luminance, exposure, highlight roll-off, shadow depth, contrast "
                "curve, saturation, palette, color temperature, texture character, material response, "
                "grain, edge treatment and rendering medium. Keep the requested scene and object inventory "
                "from DESCRIPTION and @img references, but render them using the same art direction as @style. "
                "Do not brighten, warm, whiten, increase exposure, soften shadows, boost saturation, add gloss, "
                "or turn the result into generic bright photorealistic architectural imagery unless those traits "
                "are visibly present in @style. If @style is dark, muted, low-key, cool, monochrome, matte, grainy, "
                "painterly, graphic, cinematic or high-contrast, preserve that character. Do not insert default "
                "lighting or color grading."
            )
    elif fields.get("feature") != "text_to_image":
'''
    return {
        "worker/frame_ratio.py": [
            ("# Magic Hour Flux 2 Klein native frame options documented for generation.", frame_insert + "\n# Magic Hour Flux 2 Klein native frame options documented for generation.", "add GPT Image 2.5 size matrix"),
            ("def exact_size(sizes: dict[str, str], ratio: str) -> str:\n", frame_size_function + "def exact_size(sizes: dict[str, str], ratio: str) -> str:\n", "add GPT Image size selector"),
            ("def check_delivered_ratio(width: int, height: int, requested: str | None) -> bool:\n", filter_function + "def check_delivered_ratio(width: int, height: int, requested: str | None) -> bool:\n", "add frame/resolution filter"),
        ],
        "worker/catalog.py": [
            (catalog_import_old, catalog_import_new, "update frame-ratio imports"),
            (candidate_tail_old, candidate_tail_new, "add per-frame resolution matrix"),
            ('''            "frameRatios": c.frame_ratios,\n''', '''            "frameRatios": c.frame_ratios,\n            "resolutionRatios": dict(c.resolution_ratios),\n''', "expose resolution matrix to UI"),
            (openai_builder_old, openai_builder_new, "wire OpenAI size, quality and PNG"),
            (google_builder_old, google_builder_new, "pass selected resolution to Google adapter"),
            ('''def magichour_text_to_image_input(req: dict) -> dict:\n    """Magic Hour Flux 2 Klein: pass only documented generation ratios."""\n    ratio = req.get("aspectRatio") or "auto"\n    if ratio not in MAGICHOUR_FRAMES:\n        raise ValueError(\n            f"Magic Hour Flux 2 Klein does not declare native support for {ratio}. "\n            f"Supported frames: {', '.join(MAGICHOUR_FRAMES)}."\n        )\n    return {\n        "prompt": req["prompt"],\n        "images": text_to_image_images(req),\n        "aspectRatio": ratio,\n        "resolution": "auto",\n        "quantity": req["quantity"],\n        "is_text_to_image": True,\n    }\n''', '''def magichour_text_to_image_input(req: dict) -> dict:\n    """Magic Hour Flux 2 Klein: pass only documented generation ratios and resolution."""\n    ratio = req.get("aspectRatio") or "auto"\n    if ratio not in MAGICHOUR_FRAMES:\n        raise ValueError(\n            f"Magic Hour Flux 2 Klein does not declare native support for {ratio}. "\n            f"Supported frames: {', '.join(MAGICHOUR_FRAMES)}."\n        )\n    resolution = str(req.get("resolution") or "1K")\n    if resolution not in {"1K", "2K"}:\n        raise ValueError("Magic Hour Flux 2 Klein supports only 1K or 2K in this adapter.")\n    return {\n        "prompt": req["prompt"],\n        "images": text_to_image_images(req),\n        "aspectRatio": ratio,\n        "resolution": {"1K": "1k", "2K": "2k"}[resolution],\n        "quantity": req["quantity"],\n        "is_text_to_image": True,\n    }\n''', "pass Magic Hour resolution setting"),
        ],
        "worker/providers/openai.py": [
            ('''        files.append(("image[]", (f"image.{ext}", base64.b64decode(data), mime)))\n\n    # PAS de Content-Type manuel''', '''        files.append(("image[]", (f"image.{ext}", base64.b64decode(data), mime)))\n\n    output_format = str(input_.get("output_format") or "jpeg")\n    if output_format not in {"png", "jpeg", "webp"}:\n        raise ProviderError(f"openai: unsupported image output format {output_format!r}")\n\n    # PAS de Content-Type manuel''', "select OpenAI output format safely"),
            ('''            "output_format": "jpeg",\n            **(\n                {"input_fidelity": "high"}''', '''            "output_format": output_format,\n            **(\n                {"input_fidelity": "high"}''', "send chosen OpenAI output format"),
            ('''    return f"data:image/jpeg;base64,{b64}"\n''', '''    mime_type = {"png": "image/png", "jpeg": "image/jpeg", "webp": "image/webp"}[output_format]\n    return f"data:{mime_type};base64,{b64}"\n''', "preserve MIME for the selected image format"),
        ],
        "worker/providers/google.py": [
            ('''    if aspect_ratio in supported_ratios:\n        response_format["aspect_ratio"] = aspect_ratio\n\n    response = post_json(\n''', '''    if aspect_ratio in supported_ratios:\n        response_format["aspect_ratio"] = aspect_ratio\n    image_size = input_.get("resolution")\n    if image_size in {"1K", "2K", "4K"}:\n        response_format["image_size"] = image_size\n\n    response = post_json(\n''', "pass documented Gemini image_size"),
        ],
        "worker/providers/magichour.py": [
            ('''        "aspect_ratio": str(input_.get("aspectRatio") or "auto"),\n        "resolution": "auto",\n        "style": {"prompt": str(input_.get("prompt") or "")},\n''', '''        "aspect_ratio": str(input_.get("aspectRatio") or "auto"),\n        "resolution": str(input_.get("resolution") or "auto"),\n        "style": {"prompt": str(input_.get("prompt") or "")},\n''', "pass native Magic Hour resolution instead of deprecated auto"),
        ],
        "worker/prompts.py": [
            (style_old, style_new, "restore detailed historical style/lighting guidance"),
        ],
        "worker/workflows/image_render.py": [
            ('                output_validator=(validate_text_to_image if feature == "text_to_image" and requested_ratio != "auto" else None),\n', '                output_validator=(validate_text_to_image if feature == "text_to_image" else None),\n', 'always validate resolution even with auto aspect ratio'),
            ('                    return _stage_text_to_image_outputs(output_urls, requested_ratio)\n', '                    return _stage_text_to_image_outputs(output_urls, requested_ratio, requested_resolution)\n', 'validate delivered resolution'),
            ('            if not check_delivered_ratio(width, height, requested_ratio):\n                raise ValueError(\n                    f"frame mismatch: requested {requested_ratio}, returned {width}x{height}"\n                )\n', '            if not check_delivered_ratio(width, height, requested_ratio):\n                raise ValueError(\n                    f"frame mismatch: requested {requested_ratio}, returned {width}x{height}"\n                )\n            if not check_delivered_resolution(width, height, requested_resolution):\n                raise ValueError(\n                    f"resolution mismatch: requested {requested_resolution}, returned {width}x{height}"\n                )\n', 'reject silent resolution downgrade'),
            ('def _stage_text_to_image_outputs(output_urls: list[str], requested_ratio: str) -> list[str]:\n', 'def _stage_text_to_image_outputs(output_urls: list[str], requested_ratio: str, requested_resolution: str = "1K") -> list[str]:\n', 'accept requested output resolution'),
            ('''from frame_ratio import check_delivered_ratio, filter_by_frame\n''', '''from frame_ratio import check_delivered_ratio, check_delivered_resolution, filter_by_frame, filter_by_resolution\n''', "import resolution filter"),
            ('''                feature_candidates = filter_by_frame(\n                    feature_candidates,\n                    input_.get("aspectRatio"),\n                    input_.get("model"),\n                )\n''', '''                feature_candidates = filter_by_frame(\n                    feature_candidates,\n                    input_.get("aspectRatio"),\n                    input_.get("model"),\n                )\n                feature_candidates = filter_by_resolution(\n                    feature_candidates,\n                    input_.get("aspectRatio"),\n                    input_.get("resolution") or "1K",\n                    input_.get("model"),\n                )\n''', "filter models by the requested resolution"),
            ('''            candidates = order_candidates(feature_candidates, input_.get("quality") or "standard", input_.get("model"))\n            requested_ratio = input_.get("aspectRatio") or "auto"\n''', '''            candidates = order_candidates(feature_candidates, input_.get("quality") or "standard", input_.get("model"))\n            # When images are supplied, prioritize the model documented for precise editing;\n            # keep the remaining candidates as fallbacks if the first attempt fails.\n            if (\n                feature == "text_to_image"\n                and (not input_.get("model") or input_.get("model") == "auto")\n                and (input_.get("imageUrl") or input_.get("styleReferenceUrl") or input_.get("referenceUrls"))\n            ):\n                fidelity_candidate = next(\n                    (candidate for candidate in candidates if candidate.model_id == "gpt-image-2.5-sunburst"),\n                    None,\n                )\n                if fidelity_candidate is not None:\n                    candidates = [fidelity_candidate] + [\n                        candidate for candidate in candidates if candidate.key != fidelity_candidate.key\n                    ]\n            requested_ratio = input_.get("aspectRatio") or "auto"\n''', "prefer fidelity when editing image inputs"),
            ('            requested_ratio = input_.get("aspectRatio") or "auto"\n', '            requested_ratio = input_.get("aspectRatio") or "auto"\n            requested_resolution = input_.get("resolution") or "1K"\n', 'record requested resolution'),
        ],
        "web/components/studio/image2-workspace.tsx": [
            ('  // Show only settings genuinely exposed by the selected model. Auto uses the\n  // intersection across configured models that can handle the selected inputs.\n  const availableQualityTiers = useMemo(() => {\n    const capabilityModels = selectedModelOption ? [selectedModelOption] : frameCompatibleModels;\n', '  // Filter by current frame and resolution before exposing output-quality choices.\n  const resolutionCompatibleModels = useMemo(() => {\n    const capabilityModels = selectedModelOption ? [selectedModelOption] : frameCompatibleModels;\n    return capabilityModels.filter((model) => {\n      const frameResolutions = model.resolutionRatios\n        ? (model.resolutionRatios[aspectRatio] ?? [])\n        : (model.resolutions ?? ["1K"]);\n      return frameResolutions.includes(resolution);\n    });\n  }, [selectedModelOption, frameCompatibleModels, aspectRatio, resolution]);\n\n  const availableQualityTiers = useMemo(() => {\n    const capabilityModels = resolutionCompatibleModels;\n', 'filter quality options by current resolution'),
            ('  }, [selectedModelOption, frameCompatibleModels]);\n  const availableResolutions = useMemo<Resolution[]>(() => {\n', '  }, [resolutionCompatibleModels]);\n  const availableResolutions = useMemo<Resolution[]>(() => {\n', 'update quality memo dependency'),
            ('''  frameRatios?: string[];\n  costPerGeneration?: number;\n''', '''  frameRatios?: string[];\n  resolutionRatios?: Record<string, string[]>;\n  costPerGeneration?: number;\n''', "add resolution matrix to client model type"),
            ('''    return RESOLUTIONS.filter((value) =>\n      capabilityModels.every((model) => (model.resolutions ?? ["1K"]).includes(value)),\n    );\n  }, [selectedModelOption, frameCompatibleModels]);\n''', '''    return RESOLUTIONS.filter((value) => capabilityModels.some((model) => {\n      const frameResolutions = model.resolutionRatios\n        ? (model.resolutionRatios[aspectRatio] ?? [])\n        : (model.resolutions ?? ["1K"]);\n      return frameResolutions.includes(value);\n    }));\n  }, [selectedModelOption, frameCompatibleModels, aspectRatio]);\n''', "filter UI resolutions by selected frame"),
            ('''  const resolvedAutoModel = useMemo<Image2ModelOption | null>(() => {\n    if (frameCompatibleModels.length === 0) return null;\n    const matchingTier = frameCompatibleModels.filter((model) =>\n''', '''  const resolvedAutoModel = useMemo<Image2ModelOption | null>(() => {\n    if (frameCompatibleModels.length === 0) return null;\n    if (imageInputCount > 0) {\n      const fidelityCandidate = frameCompatibleModels.find((model) => {\n        const frameResolutions = model.resolutionRatios\n          ? (model.resolutionRatios[aspectRatio] ?? [])\n          : (model.resolutions ?? ["1K"]);\n        return model.key === "gpt-image-1.5" && frameResolutions.includes(resolution);\n      });\n      if (fidelityCandidate) return fidelityCandidate;\n    }\n    const matchingTier = frameCompatibleModels.filter((model) =>\n''', "align Auto preview with fidelity-first routing"),
            ('''  }, [frameCompatibleModels, quality]);\n  // Auto offers the union of frames''', '''  }, [resolutionCompatibleModels, quality, imageInputCount]);\n  // Auto offers the union of frames''', "update Auto-preview dependencies"),
            ('''— cheapest configured model matching your inputs.`,\n''', '''— ${imageInputCount > 0 ? "prioritizes element fidelity for image inputs; this can cost more than the lowest-cost model" : "lowest-cost compatible model for this request"}.`,\n''', "clarify fidelity-first Auto tradeoff"),
            ('    const matchingTier = frameCompatibleModels.filter((model) =>\n', '    const matchingTier = resolutionCompatibleModels.filter((model) =>\n', 'rank Auto candidates by selected resolution'),
            ('    const candidates = matchingTier.length > 0 ? matchingTier : frameCompatibleModels;\n', '    const candidates = matchingTier.length > 0 ? matchingTier : resolutionCompatibleModels;\n', 'use resolution-capable fallback candidates'),
            ('    frameSupported(aspectRatio) &&\n    (Boolean(selectedModel) ||\n', '    frameSupported(aspectRatio) &&\n    resolutionCompatibleModels.length > 0 &&\n    (Boolean(selectedModel) ||\n', 'block generation for unsupported resolution'),
        ],
        "worker/tests/test_frame_ratio.py": [
            ('def test_output_validation_never_crops_and_allows_documented_dimension_grid():\n    assert check_delivered_ratio(1184, 864, "4:3") is True\n    assert check_delivered_ratio(1536, 1024, "16:9") is False\n    assert check_delivered_ratio(1000, 700, "auto") is True\n', 'def test_output_validation_never_crops_and_allows_documented_dimension_grid():\n    assert check_delivered_ratio(1184, 864, "4:3") is True\n    assert check_delivered_ratio(1536, 1024, "16:9") is False\n    assert check_delivered_ratio(1000, 700, "auto") is True\n    assert check_delivered_resolution(1024, 1024, "1K") is True\n    assert check_delivered_resolution(1024, 1024, "2K") is False\n    assert check_delivered_resolution(3840, 2160, "4K") is True\n', 'test output resolution validation'),
            ('''    GPT_IMAGE_1_SIZES,\n    MAGICHOUR_FRAMES,\n    check_delivered_ratio,\n    filter_by_frame,\n''', '''    GPT_IMAGE_1_SIZES,\n    GPT_IMAGE_SIZES_BY_RESOLUTION,\n    MAGICHOUR_FRAMES,\n    check_delivered_ratio,\n    check_delivered_resolution,\n    filter_by_frame,\n    filter_by_resolution,\n''', "import sizing and resolution tests"),
            ('''        "quality": "standard",\n        "quantity": 1,\n''', '''        "quality": "standard",\n        "resolution": "1K",\n        "quantity": 1,\n''', "default test request resolution"),
            ('''def test_openai_only_maps_documented_native_sizes():\n    assert GPT_IMAGE_1_SIZES == {\n        "1:1": "1024x1024",\n        "3:2": "1536x1024",\n        "2:3": "1024x1536",\n    }\n    assert openai_text_to_image_input(_request("1:1"))["size"] == "1024x1024"\n    assert openai_text_to_image_input(_request("3:2"))["size"] == "1536x1024"\n    assert openai_text_to_image_input(_request("2:3"))["size"] == "1024x1536"\n    assert openai_text_to_image_input(_request("auto"))["size"] == "auto"\n    for ratio in ("4:3", "16:9", "21:9"):\n        try:\n            openai_text_to_image_input(_request(ratio))\n        except ValueError:\n            pass\n        else:\n            raise AssertionError(f"GPT Image 1 must not approximate {ratio}")\n''', '''def test_openai_maps_documented_size_for_resolution_and_ratio():\n    assert GPT_IMAGE_1_SIZES == {\n        "1:1": "1024x1024",\n        "3:2": "1536x1024",\n        "2:3": "1024x1536",\n    }\n    assert openai_text_to_image_input(_request("1:1"))["size"] == GPT_IMAGE_SIZES_BY_RESOLUTION["1K"]["1:1"]\n    assert openai_text_to_image_input(_request("16:9"))["size"] == "1536x864"\n    assert openai_text_to_image_input({**_request("16:9"), "resolution": "4K"})["size"] == "3840x2160"\n    assert openai_text_to_image_input({**_request("21:9"), "resolution": "4K"})["size"] == "3840x1648"\n    assert openai_text_to_image_input(_request("1:1"))["quality"] == "high"\n    assert openai_text_to_image_input({**_request("1:1"), "quality": "pro"})["quality"] == "xhigh"\n    assert openai_text_to_image_input(_request("1:1"))["output_format"] == "png"\n    assert openai_text_to_image_input(_request("auto"))["size"] == "auto"\n    try:\n        openai_text_to_image_input({**_request("1:1"), "resolution": "4K"})\n    except ValueError as error:\n        assert "does not support 4K" in str(error)\n    else:\n        raise AssertionError("GPT Image 2.5 must not claim 4K square output")\n''', "replace size tests with model-specific resolution checks"),
            ('''    assert google_text_to_image_input(_request("3:2"))["aspectRatio"] == "3:2"\n    assert "aspectRatio" not in google_text_to_image_input(_request("auto"))\n''', '''    assert google_text_to_image_input(_request("3:2"))["aspectRatio"] == "3:2"\n    assert google_text_to_image_input({**_request("16:9"), "resolution": "2K"})["resolution"] == "2K"\n    assert "aspectRatio" not in google_text_to_image_input(_request("auto"))\n''', "test Google's resolution pass-through"),
            ('''    for ratio in MAGICHOUR_FRAMES:\n        assert magichour_text_to_image_input(_request(ratio))["aspectRatio"] == ratio\n''', '''    for ratio in MAGICHOUR_FRAMES:\n        assert magichour_text_to_image_input(_request(ratio))["aspectRatio"] == ratio\n    assert magichour_text_to_image_input({**_request("1:1"), "resolution": "2K"})["resolution"] == "2k"\n''', "test Magic Hour resolution pass-through"),
            ('''    assert _candidate("gpt-image-1.5").frame_ratios == ("auto", "1:1", "3:2", "2:3")\n''', '''    assert _candidate("gpt-image-1.5").frame_ratios == ("auto", *ALL_FRAMES)\n''', "test complete OpenAI frame capability"),
            ('''    assert _candidate("gpt-image-1.5") not in capable\n''', '''    assert _candidate("gpt-image-1.5") in capable\n''', "update supported 21:9 assertion"),
            ('''    try:\n        filter_by_frame(candidates, "16:9", "gpt-image-1.5")\n    except ValueError as error:\n        assert "cannot generate a 16:9" in str(error)\n    else:\n        raise AssertionError("Explicit unsupported model choice must fail clearly")\n''', '''    assert filter_by_frame(candidates, "16:9", "gpt-image-1.5") == [_candidate("gpt-image-1.5")]\n''', "update explicit OpenAI frame assertion"),
            ('''    assert models["gpt-image-1.5"]["frameRatios"] == ("auto", "1:1", "3:2", "2:3")\n    assert models["magichour-flux-2-klein-text"]["frameRatios"] == MAGICHOUR_FRAMES\n''', '''    assert models["gpt-image-1.5"]["frameRatios"] == ("auto", *ALL_FRAMES)\n    assert models["gpt-image-1.5"]["resolutionRatios"]["1:1"] == ("1K", "2K")\n    assert models["magichour-flux-2-klein-text"]["frameRatios"] == MAGICHOUR_FRAMES\n''', "test resolution matrix exposed to UI"),
        ],
    }


def apply_edits(root: Path) -> dict[str, str]:
    planned: dict[str, str] = {}
    for relative, substitutions in edits().items():
        path = root / relative
        if not path.is_file():
            raise PatchMismatch(f"Missing expected project file: {relative}")
        raw = path.read_bytes()
        try:
            decoded = raw.decode("utf-8")
        except UnicodeDecodeError as exc:
            raise PatchMismatch(f"{relative}: expected UTF-8 text") from exc
        has_crlf = b"\r\n" in raw
        if has_crlf and b"\n" in raw.replace(b"\r\n", b""):
            raise PatchMismatch(f"{relative}: mixed line endings; normalize this file first")
        # Normalize in memory for exact matching, then restore the original convention.
        text = decoded.replace("\r\n", "\n")
        for old, new, label in substitutions:
            text = replace_once(text, old, new, f"{relative} / {label}")
        if relative == "worker/catalog.py":
            text = replace_once(
                text,
                '''        "gpt-image-1.5",
        "GPT Image 2.5 Sunburst",
        "High-fidelity image generation with element and style references",
        "openai",
        "gpt-image-2.5-sunburst",
        7,
        15,
        16,
        IMAGE_TIMEOUT_MS,
        ("pro",),
        openai_text_to_image_input,
        extract_image_urls,
''',
                '''        "gpt-image-1.5",
        "GPT Image 2.5 Sunburst",
        "High-fidelity image generation with element and style references",
        "openai",
        "gpt-image-2.5-sunburst",
        7,
        15,
        16,
        IMAGE_TIMEOUT_MS,
        ("standard", "pro"),
        openai_text_to_image_input,
        extract_image_urls,
''',
                "allow Standard-high and Pro-xhigh quality settings",
            )
            text = insert_after_candidate(text, "flux-pro", '        resolutions=("1K",), frame_ratios=ALL_FRAMES,\n        resolution_ratios=tuple((ratio, ("1K",)) for ratio in ALL_FRAMES),\n')
            text = insert_after_candidate(text, "flux-dev", '        resolutions=("1K",), frame_ratios=ALL_FRAMES,\n        resolution_ratios=tuple((ratio, ("1K",)) for ratio in ALL_FRAMES),\n')
            text = replace_once(
                text,
                '        frame_ratios=("auto", "1:1", "3:2", "2:3"),\n',
                '        frame_ratios=("auto", *ALL_FRAMES),\n',
                "expand GPT native frame capability",
            )
            text = insert_after_candidate(text, "gpt-image-1.5", '        resolutions=("1K", "2K", "4K"),\n        resolution_ratios=tuple(GPT_IMAGE_RESOLUTION_RATIOS.items()),\n')
            text = insert_after_candidate(text, "gemini-2.5-flash", '        resolutions=("1K", "2K", "4K"),\n        resolution_ratios=tuple((ratio, ("1K", "2K", "4K")) for ratio in ("auto", *ALL_FRAMES)),\n')
            text = insert_after_candidate(text, "magichour-flux-2-klein-text", '        resolutions=("1K", "2K"),\n        resolution_ratios=tuple((ratio, ("1K", "2K")) for ratio in MAGICHOUR_FRAMES),\n')
            text = set_candidate_tiers(text, "flux-pro", '("standard", "pro"),', '("standard",),')
            text = set_candidate_tiers(text, "magichour-flux-2-klein-text", '("standard", "pro"),', '("standard",),')
        if relative == "worker/tests/test_frame_ratio.py":
            # Append a focused capability test once the existing tests are rewritten.
            addition = '''\n\ndef test_resolution_router_excludes_unsupported_models():\n    capable = filter_by_resolution(TEXT_TO_IMAGE_CANDIDATES, "16:9", "4K", None)\n    assert all("4K" in dict(candidate.resolution_ratios).get("16:9", ()) for candidate in capable)\n    assert _candidate("magichour-flux-2-klein-text") not in capable\n    assert _candidate("flux-pro").frame_ratios == ALL_FRAMES\n    assert _candidate("flux-dev").frame_ratios == ALL_FRAMES\n    try:\n        filter_by_resolution([_candidate("gpt-image-1.5")], "1:1", "4K", "gpt-image-1.5")\n    except ValueError as error:\n        assert "does not support 4K" in str(error)\n    else:\n        raise AssertionError("Unsupported model resolution must fail clearly")\n'''
            if "def test_resolution_router_excludes_unsupported_models" in text:
                raise PatchMismatch("resolution-router test already exists; refusing to duplicate it")
            text = text.rstrip() + addition + "\n"
        planned[relative] = text.replace("\n", "\r\n") if has_crlf else text
    return planned


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--apply", action="store_true", help="write changes after creating one-time backups")
    parser.add_argument("--show-diff", action="store_true", help="print a unified diff during the read-only dry run")
    parser.add_argument("--root", type=Path, default=Path.cwd(), help="project root; default is current directory")
    args = parser.parse_args()
    root = args.root.resolve()

    if not (root / "worker" / "catalog.py").exists() or not (root / "web" / "components" / "studio" / "image2-workspace.tsx").exists():
        print("ERROR: run this from the project root or pass --root PATH.", file=sys.stderr)
        return 2

    try:
        planned = apply_edits(root)
    except PatchMismatch as exc:
        print(f"CHECK FAILED: {exc}", file=sys.stderr)
        print("No files were changed. This script expects source blocks from the stated CODEX snapshot.", file=sys.stderr)
        return 2

    try:
        head = subprocess.run(["git", "rev-parse", "HEAD"], cwd=root, capture_output=True, text=True, check=False)
        if head.returncode == 0:
            sha = head.stdout.strip()
            print(f"Current HEAD: {sha}")
            if not sha.startswith(BASE_COMMIT[:8]):
                print(f"WARNING: patch base is {BASE_COMMIT}; current HEAD differs. Exact source blocks matched, but review diff carefully.")
        status = subprocess.run(["git", "status", "--short"], cwd=root, capture_output=True, text=True, check=False)
        if status.returncode == 0 and status.stdout.strip():
            print("WARNING: working tree already has changes. Review them and ensure affected files are backed up before --apply.")
    except OSError:
        pass

    print("\nMatched and prepared changes in these files:")
    for relative in planned:
        print(f"  - {relative}")
    if not args.apply:
        if args.show_diff:
            print("\nUnified diff (read-only; no source files changed):")
            for relative, after in planned.items():
                before = (root / relative).read_text(encoding="utf-8").replace("\r\n", "\n")
                normalized_after = after.replace("\r\n", "\n")
                diff = difflib.unified_diff(
                    before.splitlines(keepends=True),
                    normalized_after.splitlines(keepends=True),
                    fromfile=relative,
                    tofile=f"{relative} (proposed)",
                )
                print("".join(diff), end="")
        print("\nDry run only: no source files were changed. Re-run with --apply to write the patch.")
        return 0

    backups = {relative: root / (relative + BACKUP_SUFFIX) for relative in planned}
    existing = [str(path.relative_to(root)) for path in backups.values() if path.exists()]
    if existing:
        print("ERROR: backup file(s) already exist; not overwriting: " + ", ".join(existing), file=sys.stderr)
        return 2

    # Prepare all backups first; fail before writing source if any backup fails.
    try:
        for relative, backup in backups.items():
            source = root / relative
            backup.parent.mkdir(parents=True, exist_ok=True)
            backup.write_bytes(source.read_bytes())
        for relative, content in planned.items():
            path = root / relative
            temporary = path.with_name(path.name + ".image2-fidelity.tmp")
            temporary.write_text(content, encoding="utf-8", newline="")
            temporary.replace(path)
    except Exception as exc:  # pragma: no cover - environment-specific I/O failure
        print(f"ERROR writing files: {exc}", file=sys.stderr)
        print("Backups (if created) have been kept. Restore manually only after reviewing them.", file=sys.stderr)
        return 2

    print("\nApplied. One-time backups were created beside each modified file with suffix:")
    print(f"  {BACKUP_SUFFIX}")
    print("Next: run pytest, TypeScript/lint checks, then a real provider A/B test before production use.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
