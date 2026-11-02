#!/usr/bin/env python3
"""Apply the Image2 per-model frame/aspect-ratio fix to a local repository.

Run from the repository root:
    python apply_image2_frame_fix.py

The script refuses to patch if any expected source anchor is missing/ambiguous,
creates .bak.image2-frame-fix backups, compiles changed Python files, and rolls
back all edits if Python compilation fails. It does not touch Git or GitHub.
"""
from __future__ import annotations

import ast
import sys
from pathlib import Path

ROOT = Path.cwd()


def read(path: str) -> str:
    file_path = ROOT / path
    if not file_path.is_file():
        raise RuntimeError(f"Required file not found: {path}. Run this script from the repository root.")
    return file_path.read_text(encoding="utf-8")


def replace_once(content: str, old: str, new: str, label: str) -> str:
    count = content.count(old)
    if count != 1:
        raise RuntimeError(f"Patch anchor '{label}' expected exactly once; found {count} occurrence(s). No files were changed.")
    return content.replace(old, new, 1)


# ---------- Prepare every change in memory first (no partial writes). ----------
changes: dict[str, str] = {}

# The patch is intentionally safe to run again after a successful first run.
# Check the complete set of output markers before evaluating the original
# source anchors, which no longer exist once the patch has been applied.
already_applied = (
    (ROOT / "worker/frame_ratio.py").is_file()
    and "frame_ratios: tuple[str, ...] = ()" in read("worker/catalog.py")
    and '"frameRatios": list(c.frame_ratios)' in read("worker/catalog.py")
    and "filter_candidates_by_frame" in read("worker/workflows/image_render.py")
    and "output_validator=None" in read("worker/workflows/engine.py")
    and "frameRatios?: string[];" in read("web/components/studio/image2-workspace.tsx")
)
if already_applied:
    print("Image2 frame fix is already applied; no files were changed.")
    sys.exit(0)

catalog = read("worker/catalog.py")
catalog = replace_once(
    catalog,
    '    resolutions: tuple[str, ...] = ("1K",)\n',
    '    resolutions: tuple[str, ...] = ("1K",)\n    # Native output aspect ratios accepted by this candidate adapter. Empty means unverified.\n    frame_ratios: tuple[str, ...] = ()\n',
    "catalog Candidate.frame_ratios",
)
catalog = replace_once(
    catalog,
    '            "resolutions": c.resolutions,\n',
    '            "resolutions": c.resolutions,\n            "frameRatios": list(c.frame_ratios),\n',
    "catalog model serialization frameRatios",
)
old_magic = '''def magichour_text_to_image_input(req: dict) -> dict:
    """Magic Hour image generation/editing : gère à la fois le text-to-image
    pur et les générations avec images de référence / Style."""
    ratio = (
        "auto"
        if req["aspectRatio"] == "auto"
        else "16:9"
        if req["aspectRatio"] in ("16:9", "4:3", "3:2", "21:9")
        else "9:16"
        if req["aspectRatio"] in ("9:16", "3:4", "2:3")
        else "1:1"
    )
'''
new_magic = '''def magichour_text_to_image_input(req: dict) -> dict:
    """Magic Hour Flux 2 Klein: pass only ratios supported by this model's generator API."""
    ratio = req.get("aspectRatio") or "auto"
    if ratio not in {"auto", "1:1", "16:9", "9:16"}:
        raise ValueError(
            f"Magic Hour Flux 2 Klein does not support {ratio}; use auto, 1:1, 16:9, or 9:16."
        )
'''
catalog = replace_once(catalog, old_magic, new_magic, "Magic Hour ratio mapping")
old_bfl_dims = '''    width, height = {
        "1:1": (1024, 1024),
        "16:9": (1024, 576),
        "9:16": (576, 1024),
        "4:3": (1024, 768),
        "3:4": (768, 1024),
        "3:2": (1024, 683),
        "2:3": (683, 1024),
        "21:9": (1024, 439),
    }.get(ratio, (1024, 768))
'''
new_bfl_dims = '''    # FLUX.1 Pro 1.1 / Dev endpoints require dimensions in multiples of 32.
    # These pairs preserve each requested ratio exactly and remain below 1440 px.
    width, height = {
        "1:1": (1024, 1024),
        "16:9": (1024, 576),
        "9:16": (576, 1024),
        "4:3": (1024, 768),
        "3:4": (768, 1024),
        "3:2": (960, 640),
        "2:3": (640, 960),
        "21:9": (1344, 576),
    }.get(ratio, (1024, 768))
'''
catalog = replace_once(catalog, old_bfl_dims, new_bfl_dims, "BFL exact dimensions")
old_openai = '''def openai_text_to_image_input(req: dict) -> dict:
    """OpenAI image generation/edit with a dedicated Style input when supplied."""
    size = (
        "auto"
        if req["aspectRatio"] == "auto"
        else "1536x1024"
        if req["aspectRatio"] in ("16:9", "4:3", "3:2", "21:9")
        else "1024x1536"
        if req["aspectRatio"] in ("9:16", "3:4", "2:3")
        else "1024x1024"
    )
    images: list[str] = []
    style_image = req.get("styleReferenceUrl")
    if isinstance(style_image, str) and style_image:
        images.append(style_image)
    images.extend(req.get("referenceUrls") or [])
    return {
        "prompt": req["prompt"],
        "images": images,
        "size": size,
        "quality": "high" if req["quality"] == "pro" else "medium",
        "quantity": req["quantity"],
    }
'''
new_openai = '''def openai_text_to_image_input(req: dict) -> dict:
    """GPT Image 2: send dimensions matching the selected frame exactly."""
    ratio = req.get("aspectRatio") or "auto"
    size = {
        "1:1": "1024x1024",
        "16:9": "1024x576",
        "9:16": "576x1024",
        "4:3": "1024x768",
        "3:4": "768x1024",
        "3:2": "960x640",
        "2:3": "640x960",
        "21:9": "1008x432",
    }.get(ratio, "auto")
    images: list[str] = []
    style_image = req.get("styleReferenceUrl")
    if isinstance(style_image, str) and style_image:
        images.append(style_image)
    images.extend(req.get("referenceUrls") or [])
    return {
        "prompt": req["prompt"],
        "images": images,
        "size": size,
        "quality": "high" if req["quality"] == "pro" else "medium",
        "quantity": req["quantity"],
    }
'''
catalog = replace_once(catalog, old_openai, new_openai, "OpenAI GPT Image 2 dimensions")
old_candidates = '''TEXT_TO_IMAGE_CANDIDATES: list[Candidate] = [
    Candidate("flux-pro", "Flux Pro", "High quality text-to-image photorealistic renders; supports one reference image", "bfl", "flux-pro", 7, 5, 1, IMAGE_TIMEOUT_MS, ("standard", "pro"), bfl_text_to_image_input, extract_image_urls),
    Candidate("flux-dev", "Flux Dev", "Fast text-to-image generation; supports one reference image", "bfl", "flux-dev", 5, 3, 1, IMAGE_TIMEOUT_MS, ("standard",), bfl_text_to_image_input, extract_image_urls),
    Candidate("gpt-image-1", "GPT Image 1", "Versatile OpenAI text-to-image with Style and content references", "openai", "gpt-image-1", 6, 8, 13, IMAGE_TIMEOUT_MS, ("standard", "pro"), openai_text_to_image_input, extract_image_urls, supports_style_reference=True),
    Candidate("gemini-3.1-flash-lite", "Gemini 3.1 Flash Lite Image", "Cost-efficient 1K text-to-image with Style and content references", "google", "gemini-3.1-flash-lite-image", 3, 4, 13, IMAGE_TIMEOUT_MS, ("standard",), google_text_to_image_input, extract_image_urls, supports_style_reference=True),
    Candidate("gemini-3.1-flash", "Nano Banana 2", "High-quality 1K text-to-image with Style and content references", "google", "gemini-3.1-flash-image", 3, 7, 13, IMAGE_TIMEOUT_MS, ("standard", "pro"), google_text_to_image_input, extract_image_urls, supports_style_reference=True),
    # Agrégateur (exception assumée, AGENTS.md §1) : utilisable quand une
    # image de référence est fournie, car l'API Magic Hour exige une image
    # d'entrée.
    Candidate("magichour-flux-2-klein-text", "Magic Hour Flux 2 Klein", "Free tier friendly text-to-image and style reference edits", "magichour", "flux-2-klein", 5, 1, 5, IMAGE_TIMEOUT_MS, ("standard", "pro"), magichour_text_to_image_input, extract_image_urls, supports_style_reference=True),
]
'''
new_candidates = '''IMAGE2_FRAME_RATIOS = ("1:1", "16:9", "9:16", "4:3", "3:4", "3:2", "2:3", "21:9")

TEXT_TO_IMAGE_CANDIDATES: list[Candidate] = [
    Candidate("flux-pro", "Flux Pro 1.1", "High quality text-to-image photorealistic renders; supports one reference image", "bfl", "flux-pro-1.1", 7, 5, 1, IMAGE_TIMEOUT_MS, ("standard", "pro"), bfl_text_to_image_input, extract_image_urls, frame_ratios=IMAGE2_FRAME_RATIOS),
    Candidate("flux-dev", "Flux Dev", "Fast text-to-image generation; supports one reference image", "bfl", "flux-dev", 5, 3, 1, IMAGE_TIMEOUT_MS, ("standard",), bfl_text_to_image_input, extract_image_urls, frame_ratios=IMAGE2_FRAME_RATIOS),
    Candidate("gpt-image-2", "GPT Image 2", "OpenAI image generation with exact custom dimensions, Style and content references", "openai", "gpt-image-2", 6, 8, 13, IMAGE_TIMEOUT_MS, ("standard", "pro"), openai_text_to_image_input, extract_image_urls, supports_style_reference=True, frame_ratios=IMAGE2_FRAME_RATIOS),
    Candidate("gemini-3.1-flash-lite", "Gemini 3.1 Flash Lite Image", "Cost-efficient 1K text-to-image with Style and content references", "google", "gemini-3.1-flash-lite-image", 3, 4, 13, IMAGE_TIMEOUT_MS, ("standard",), google_text_to_image_input, extract_image_urls, supports_style_reference=True, frame_ratios=IMAGE2_FRAME_RATIOS),
    Candidate("gemini-3.1-flash", "Nano Banana 2", "High-quality 1K text-to-image with Style and content references", "google", "gemini-3.1-flash-image", 3, 7, 13, IMAGE_TIMEOUT_MS, ("standard", "pro"), google_text_to_image_input, extract_image_urls, supports_style_reference=True, frame_ratios=IMAGE2_FRAME_RATIOS),
    # The current Flux 2 Klein generator endpoint exposes only these three ratios.
    Candidate("magichour-flux-2-klein-text", "Magic Hour Flux 2 Klein", "Free tier friendly text-to-image and style reference edits", "magichour", "flux-2-klein", 5, 1, 5, IMAGE_TIMEOUT_MS, ("standard", "pro"), magichour_text_to_image_input, extract_image_urls, supports_style_reference=True, frame_ratios=("1:1", "16:9", "9:16")),
]
'''
catalog = replace_once(catalog, old_candidates, new_candidates, "Text-to-image candidate capability matrix")
changes["worker/catalog.py"] = catalog

# New shared frame-capability and output-verification module.
frame_module = '''"""Per-model Image2 frame filtering and output-dimension verification.

No cropping is performed here: a provider that returns the wrong frame is
rejected so Auto can try the next compatible provider.
"""
from __future__ import annotations

import io
from urllib.parse import urlparse

from PIL import Image

import storage
from providers.http_helpers import data_uri_to_bytes, get_bytes

FRAME_RATIOS = {
    "1:1": 1.0,
    "16:9": 16 / 9,
    "9:16": 9 / 16,
    "4:3": 4 / 3,
    "3:4": 3 / 4,
    "3:2": 3 / 2,
    "2:3": 2 / 3,
    "21:9": 21 / 9,
}


def filter_candidates_by_frame(candidates, aspect_ratio: str):
    """Return only models whose catalog explicitly advertises this frame."""
    expected = FRAME_RATIOS.get(aspect_ratio)
    if expected is None:
        raise ValueError(f"Unsupported Image2 frame ratio: {aspect_ratio}")
    return [candidate for candidate in candidates if aspect_ratio in candidate.frame_ratios]


def _read_image_bytes(value: str) -> bytes:
    if value.startswith("data:"):
        data, _mime = data_uri_to_bytes(value)
        return data

    path_value = value
    if value.startswith(("http://", "https://")):
        parsed = urlparse(value)
        if parsed.path.startswith("/storage/") and parsed.hostname in {"localhost", "127.0.0.1"}:
            path_value = parsed.path

    if path_value.startswith("/storage/"):
        return storage.resolve(path_value).read_bytes()

    data, _mime = get_bytes(value)
    return data


def validate_image_output_frame(output_urls: list[str], aspect_ratio: str, tolerance: float = 0.025) -> None:
    """Raise if any output differs from the requested frame by >2.5%.

    This check protects users from silently receiving a different aspect ratio.
    The tolerance allows minor provider-side pixel rounding without masking a
    real frame mismatch.
    """
    expected = FRAME_RATIOS.get(aspect_ratio)
    if expected is None:
        raise ValueError(f"Unsupported Image2 frame ratio: {aspect_ratio}")

    for index, url in enumerate(output_urls, start=1):
        data = _read_image_bytes(url)
        try:
            with Image.open(io.BytesIO(data)) as image:
                actual = image.width / image.height
                width, height = image.size
        except Exception as exc:
            raise ValueError(f"Could not inspect output image {index} dimensions: {exc}") from exc

        if abs(actual / expected - 1.0) > tolerance:
            raise ValueError(
                f"Output image {index} returned {width}x{height} ({actual:.4f}:1), "
                f"not the requested {aspect_ratio} frame."
            )
'''
new_frame_path = ROOT / "worker/frame_ratio.py"
if new_frame_path.exists():
    raise RuntimeError("worker/frame_ratio.py already exists; refusing to overwrite an existing file.")

# Update worker generation workflow.
render = read("worker/workflows/image_render.py")
render = replace_once(
    render,
    'from catalog import MODEL_CATALOG\n',
    'from catalog import MODEL_CATALOG\nfrom frame_ratio import filter_candidates_by_frame, validate_image_output_frame\n',
    "image_render frame module import",
)
render = replace_once(
    render,
    '        ratios = {"1:1": 1.0, "16:9": 16 / 9, "9:16": 9 / 16, "4:3": 4 / 3, "3:4": 3 / 4}\n',
    '        ratios = {"1:1": 1.0, "16:9": 16 / 9, "9:16": 9 / 16, "4:3": 4 / 3, "3:4": 3 / 4, "3:2": 3 / 2, "2:3": 2 / 3, "21:9": 21 / 9}\n',
    "auto frame inference ratios",
)
old_empty_candidates = '''                if not feature_candidates:
                    if has_style_reference:
                        raise ValueError(
                            "No configured Text-to-Image provider supports the selected Style and content inputs. "
                            "Configure a supported provider (for example OpenAI GPT Image 1 or Google Gemini 2.5 Flash Image), "
                            "reduce the number of images, or remove Style."
                        )
                    raise ValueError(
                        "No configured Text-to-Image provider supports the selected image inputs. Configure a provider or remove references."
                    )
'''
new_empty_candidates = '''                if not feature_candidates:
                    if has_style_reference:
                        raise ValueError(
                            "No configured Text-to-Image provider supports the selected Style and content inputs. "
                            "Configure a supported provider, reduce the number of images, or remove Style."
                        )
                    raise ValueError(
                        "No configured Text-to-Image provider supports the selected image inputs. Configure a provider or remove references."
                    )

                # Explicit frames are filtered before model ordering. Auto remains provider-selected.
                if requested_ratio != "auto":
                    selected_candidate = next(
                        (candidate for candidate in feature_candidates if candidate.key == selected_model),
                        None,
                    )
                    if selected_candidate and requested_ratio not in selected_candidate.frame_ratios:
                        supported = ", ".join(selected_candidate.frame_ratios) or "none reported"
                        raise ValueError(
                            f"{selected_candidate.name} does not support {requested_ratio}. Supported frames: {supported}."
                        )
                    feature_candidates = filter_candidates_by_frame(feature_candidates, requested_ratio)
                    if not feature_candidates:
                        raise ValueError(
                            f"No configured Text-to-Image model supports {requested_ratio}. Choose a supported frame or another model."
                        )
'''
render = replace_once(render, old_empty_candidates, new_empty_candidates, "image_render frame filtering")
render = replace_once(
    render,
    '            outcome = execute_with_fallback(feature, candidates, req)\n',
    '''            output_validator = None
            if feature == "text_to_image" and (input_.get("aspectRatio") or "4:3") != "auto":
                expected_frame = input_.get("aspectRatio") or "4:3"
                output_validator = lambda urls, _candidate: validate_image_output_frame(urls, expected_frame)
            outcome = execute_with_fallback(feature, candidates, req, output_validator=output_validator)
''',
    "image_render output-frame validation",
)
changes["worker/workflows/image_render.py"] = render

engine = read("worker/workflows/engine.py")
engine = replace_once(
    engine,
    'def execute_with_fallback(feature: str, candidates: list[Candidate], req: dict, adapter_override=None) -> dict:\n',
    'def execute_with_fallback(feature: str, candidates: list[Candidate], req: dict, adapter_override=None, output_validator=None) -> dict:\n',
    "engine optional output validator parameter",
)
engine = replace_once(
    engine,
    '            if not output_urls:\n                raise ValueError("provider returned an empty output")\n',
    '            if not output_urls:\n                raise ValueError("provider returned an empty output")\n            if output_validator is not None:\n                output_validator(output_urls, candidate)\n',
    "engine validate before accepting provider output",
)
changes["worker/workflows/engine.py"] = engine

# Update Image2 UI capability type, derivation, notices, model cards and ratio selector.
ui = read("web/components/studio/image2-workspace.tsx")
ui = replace_once(
    ui,
    '  resolutions?: string[];\n  costPerGeneration?: number;\n',
    '  resolutions?: string[];\n  frameRatios?: string[];\n  costPerGeneration?: number;\n',
    "UI model frame capability type",
)
old_compat = '''  const compatibleConfiguredModels = useMemo(
    () => modelOptions.filter(isCompatibleWithSelectedInputs),
    [modelOptions, isCompatibleWithSelectedInputs],
  );
'''
new_compat = '''  const inputCompatibleModels = useMemo(
    () => modelOptions.filter((model) => imageInputCount <= (model.maxReferences ?? 0)),
    [modelOptions, imageInputCount],
  );
  const configuredInputCompatibleModels = useMemo(
    () => inputCompatibleModels.filter((model) => model.configured),
    [inputCompatibleModels],
  );
  const compatibleConfiguredModels = useMemo(
    () => configuredInputCompatibleModels.filter(
      (model) => aspectRatio === "auto" || (model.frameRatios ?? []).includes(aspectRatio),
    ),
    [configuredInputCompatibleModels, aspectRatio],
  );
  const frameCapabilityModels = useMemo(() => {
    if (selectedModelOption) return [selectedModelOption];
    return configuredInputCompatibleModels.length > 0
      ? configuredInputCompatibleModels
      : inputCompatibleModels;
  }, [selectedModelOption, configuredInputCompatibleModels, inputCompatibleModels]);
  const availableAspectRatios = useMemo<Image2AspectRatio[]>(() => {
    if (modelOptions.length === 0) return [...IMAGE2_ASPECT_RATIOS];
    return IMAGE2_ASPECT_RATIOS.filter(
      (ratio) => ratio === "auto" || frameCapabilityModels.some(
        (model) => (model.frameRatios ?? []).includes(ratio),
      ),
    );
  }, [modelOptions.length, frameCapabilityModels]);
'''
ui = replace_once(ui, old_compat, new_compat, "UI available model/frame intersections")
ui = replace_once(
    ui,
    '  const selectedModelCanHandleImages = selectedModelOption\n    ? isCompatibleWithSelectedInputs(selectedModelOption)\n    : !selectedModel;\n  const canGenerate =\n    prompt.trim().length > 0 &&\n    selectedModelCanHandleImages &&\n',
    '  const selectedModelCanHandleImages = selectedModelOption\n    ? isCompatibleWithSelectedInputs(selectedModelOption)\n    : !selectedModel;\n  const selectedModelCanHandleFrame = selectedModelOption\n    ? aspectRatio === "auto" || (selectedModelOption.frameRatios ?? []).includes(aspectRatio)\n    : true;\n  const canGenerate =\n    prompt.trim().length > 0 &&\n    selectedModelCanHandleImages &&\n    selectedModelCanHandleFrame &&\n',
    "UI generation guard for selected model frame",
)
old_model_summary = '''          <p className="mt-1.5 text-[9px] leading-4 text-[#737680]">
            {selectedModelOption
              ? `${selectedModelOption.service ?? "Text-to-image"} · up to ${selectedModelOption.maxReferences ?? 0} image inputs`
              : resolvedAutoModel
                ? `Auto will use ${resolvedAutoModel.name} · up to ${resolvedAutoModel.maxReferences ?? 0} image inputs`
                : "Select the AI model and provider used by this service."}
          </p>
          {selectedModelOption &&
            (!selectedModelOption.configured ||
              imageInputCount > (selectedModelOption.maxReferences ?? 0)) && (
              <p
                role="status"
                className="mt-2 rounded-md border border-amber-300/20 bg-amber-300/[0.06] px-2 py-1.5 text-[10px] leading-4 text-amber-200"
              >
                {!selectedModelOption.configured
                  ? `${selectedModelOption.name} is not configured on the worker.`
                  : `This model supports ${selectedModelOption.maxReferences ?? 0} content image inputs, but ${imageInputCount} are selected.`}
              </p>
            )}
'''
new_model_summary = '''          <p className="mt-1.5 text-[9px] leading-4 text-[#737680]">
            {selectedModelOption
              ? `${selectedModelOption.service ?? "Text-to-image"} · up to ${selectedModelOption.maxReferences ?? 0} image inputs · frames: ${(selectedModelOption.frameRatios ?? []).join(", ") || "not reported"}`
              : resolvedAutoModel
                ? `Auto will use ${resolvedAutoModel.name} · ${aspectRatio === "auto" ? "automatic frame" : `supports ${aspectRatio}`} `
                : "Select the AI model and provider used by this service."}
          </p>
          {selectedModelOption &&
            (!selectedModelOption.configured ||
              imageInputCount > (selectedModelOption.maxReferences ?? 0) ||
              !selectedModelCanHandleFrame) && (
              <p
                role="status"
                className="mt-2 rounded-md border border-amber-300/20 bg-amber-300/[0.06] px-2 py-1.5 text-[10px] leading-4 text-amber-200"
              >
                {!selectedModelOption.configured
                  ? `${selectedModelOption.name} is not configured on the worker.`
                  : imageInputCount > (selectedModelOption.maxReferences ?? 0)
                    ? `This model supports ${selectedModelOption.maxReferences ?? 0} content image inputs, but ${imageInputCount} are selected.`
                    : `This model does not support ${aspectRatio}. Supported frames: ${(selectedModelOption.frameRatios ?? []).join(", ") || "not reported"}.`}
              </p>
            )}
'''
ui = replace_once(ui, old_model_summary, new_model_summary, "selected-model supported frame summary")
old_ratio_btn = '''                    <button
                      key={ratio}
                      type="button"
                      onClick={() => {
                        setAspectRatio(ratio);
                        setAspectPickerOpen(false);
                      }}
                      className={cn(
                        "flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-[10px] transition-colors",
                        ratio === aspectRatio
                          ? "bg-[#aaa7ff]/15 text-[#d1cfff]"
                          : "text-[#d4d4db] hover:bg-white/[0.06]",
                      )}
                    >
'''
new_ratio_btn = '''                    <button
                      key={ratio}
                      type="button"
                      disabled={!availableAspectRatios.includes(ratio)}
                      title={availableAspectRatios.includes(ratio) ? undefined : "Not supported by the selected model or configured Auto models."}
                      onClick={() => {
                        setAspectRatio(ratio);
                        setAspectPickerOpen(false);
                      }}
                      className={cn(
                        "flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-[10px] transition-colors disabled:cursor-not-allowed disabled:opacity-35",
                        ratio === aspectRatio
                          ? "bg-[#aaa7ff]/15 text-[#d1cfff]"
                          : "text-[#d4d4db] hover:bg-white/[0.06]",
                      )}
                    >
'''
ui = replace_once(ui, old_ratio_btn, new_ratio_btn, "ratio menu disable unsupported")
old_card_fields = '''                    const provider = providerLabel(model.provider, model);
                    const maxRefs = model.maxReferences ?? 0;
                    const fitsReferences = imageInputCount <= maxRefs;
                    return (
'''
new_card_fields = '''                    const provider = providerLabel(model.provider, model);
                    const maxRefs = model.maxReferences ?? 0;
                    const fitsReferences = imageInputCount <= maxRefs;
                    const supportedFrames = model.frameRatios ?? [];
                    const supportsCurrentFrame = aspectRatio === "auto" || supportedFrames.includes(aspectRatio);
                    return (
'''
ui = replace_once(ui, old_card_fields, new_card_fields, "model cards compute frame capabilities")
old_badges = '''                            <span className="rounded bg-white/[0.06] px-1.5 py-0.5 text-[8px] text-[#acafb9]">
                              {maxRefs > 0
                                ? `${maxRefs} content images max`
                                : "Prompt only"}
                            </span>
'''
new_badges = '''                            <span className="rounded bg-white/[0.06] px-1.5 py-0.5 text-[8px] text-[#acafb9]">
                              {maxRefs > 0
                                ? `${maxRefs} content images max`
                                : "Prompt only"}
                            </span>
                            <span className="rounded bg-[#aaa7ff]/10 px-1.5 py-0.5 text-[8px] text-[#c2bfff]" title={`Supported output frames: ${supportedFrames.join(", ") || "not reported"}`}>
                              {supportedFrames.length > 0 ? `Frames: ${supportedFrames.join(" · ")}` : "Frames not reported"}
                            </span>
'''
ui = replace_once(ui, old_badges, new_badges, "model card frame badge")
old_fits_notice = '''                          {!fitsReferences && (
                            <span className="mt-1 block text-[9px] text-rose-200">
                              Needs fewer image inputs ({imageInputCount}{" "}
                              selected).
                            </span>
                          )}
'''
new_fits_notice = '''                          {!fitsReferences && (
                            <span className="mt-1 block text-[9px] text-rose-200">
                              Needs fewer image inputs ({imageInputCount}{" "}
                              selected).
                            </span>
                          )}
                          {!supportsCurrentFrame && (
                            <span className="mt-1 block text-[9px] text-amber-200">
                              Does not support {aspectRatio}. Choose: {supportedFrames.join(", ") || "no verified frame"}.
                            </span>
                          )}
'''
ui = replace_once(ui, old_fits_notice, new_fits_notice, "model card unsupported selected frame notice")
changes["web/components/studio/image2-workspace.tsx"] = ui

# ---------- Verify patch preconditions for new file and all source files. ----------
for rel, updated in changes.items():
    original = read(rel)
    if original == updated:
        raise RuntimeError(f"Internal patch error: {rel} was not modified.")

# ---------- Write changes with backups; rollback if compilation fails. ----------
backups: dict[str, bytes] = {}
created: list[Path] = []
try:
    for rel, updated in changes.items():
        target = ROOT / rel
        backup = target.with_name(target.name + ".bak.image2-frame-fix")
        if backup.exists():
            raise RuntimeError(f"Backup already exists: {backup}. Move it aside before applying again.")
        backups[rel] = target.read_bytes()
        backup.write_bytes(backups[rel])
        target.write_text(updated, encoding="utf-8", newline="\n")
    new_frame_path.write_text(frame_module, encoding="utf-8", newline="\n")
    created.append(new_frame_path)

    python_files = [ROOT / "worker/catalog.py", ROOT / "worker/workflows/image_render.py", ROOT / "worker/workflows/engine.py", new_frame_path]
    for file_path in python_files:
        ast.parse(file_path.read_text(encoding="utf-8"), filename=str(file_path))
except Exception:
    for rel, raw in backups.items():
        target = ROOT / rel
        target.write_bytes(raw)
        backup = target.with_name(target.name + ".bak.image2-frame-fix")
        if backup.exists():
            backup.unlink()
    for path in created:
        if path.exists():
            path.unlink()
    raise

print("Image2 frame fix applied successfully.")
print("Modified files:")
for rel in changes:
    print(f"  - {rel}")
print("Created file:")
print("  - worker/frame_ratio.py")
print("Backups:")
for rel in changes:
    print(f"  - {rel}.bak.image2-frame-fix")
print("Python syntax checks: passed")
print("No Git commit, push, provider request, or database change was performed.")
