#!/usr/bin/env python3
"""Safely patch only Image2 reference identity handling in a local mk-studio-ai checkout.

Run from the repository root:
    python fix_image2_reference_fidelity.py --dry-run
    python fix_image2_reference_fidelity.py

The script makes no network requests and never runs git, installs packages, or edits
anything outside the listed source/test files. It first validates every expected
source fragment in memory; if one fragment differs, it aborts before writing.
Original files are backed up outside the repository under the system temp directory.
"""
from __future__ import annotations

import argparse
import ast
import os
import shutil
import sys
import tempfile
from datetime import datetime
from pathlib import Path
from typing import Iterable


class PatchError(RuntimeError):
    pass


def replace_exact(text: str, old: str, new: str, *, label: str, count: int = 1) -> str:
    """Replace an exact source fragment or accept an already-applied replacement."""
    # Some insertions intentionally retain the old anchor inside the new block
    # (e.g. inserting a helper immediately before an existing function). Remove
    # complete new blocks before deciding whether an old anchor is still pending.
    if new in text and old not in text.replace(new, ""):
        return text
    found = text.count(old)
    if found == count:
        return text.replace(old, new, count)
    if found == 0 and text.count(new) >= 1:
        # Idempotency: if the exact replacement is already present, do not reapply.
        return text
    raise PatchError(
        f"Cannot safely patch {label}: expected {count} exact old fragment(s), found {found}. "
        "No files have been written. Check that the checkout is the expected codex version."
    )


def apply_frontend(text: str) -> str:
    # Model capability is served by worker/catalog.py through /api/models/text_to_image.
    text = replace_exact(
        text,
        "  costPerGeneration?: number;\n  service?: string;\n};\n\ninterface WorkspaceAsset {",
        "  costPerGeneration?: number;\n  service?: string;\n  referencePriority?: number;\n};\n\ninterface WorkspaceAsset {",
        label="Image2 model-option referencePriority",
    )
    text = replace_exact(
        text,
        "interface ImageInput {\n  id: string;\n  tag: string;\n  name: string;\n  previewUrl: string;\n  file?: File;\n  assetId?: string;\n  sizeBytes: number;\n}",
        'type ReferenceRole = "reference" | "background" | "exact_object";\n\n'
        "interface ImageInput {\n  id: string;\n  tag: string;\n  role: ReferenceRole;\n  name: string;\n  previewUrl: string;\n  file?: File;\n  assetId?: string;\n  sizeBytes: number;\n}",
        label="ImageInput role type",
    )
    text = replace_exact(
        text,
        '          tag: `@img${nextTagRef.current++}`,\n          name: "Project image",',
        '          tag: `@img${nextTagRef.current++}`,\n          role: "reference",\n          name: "Project image",',
        label="project asset default role",
    )
    text = replace_exact(
        text,
        '              tag: `@img${nextTagRef.current++}`,\n              name: "Project image",',
        '              tag: `@img${nextTagRef.current++}`,\n              role: "reference",\n              name: "Project image",',
        label="preselected project asset default role",
    )
    text = replace_exact(
        text,
        "  const removeReference = useCallback(\n",
        '''  const updateReferenceRole = useCallback(
    (id: string, role: ReferenceRole) => {
      setReferences((current) =>
        current.map((reference) => ({
          ...reference,
          role:
            reference.id === id
              ? role
              : role === "background" && reference.role === "background"
                ? "reference"
                : reference.role,
        })),
      );
    },
    [],
  );

  const removeReference = useCallback(
''',
        label="reference-role updater",
    )
    text = replace_exact(
        text,
        "  const imageInputCount = references.length;\n  const isCompatibleWithSelectedInputs = useCallback(\n    (model: Image2ModelOption) =>\n      model.configured && imageInputCount <= (model.maxReferences ?? 0),\n    [imageInputCount],\n  );\n  const compatibleConfiguredModels = useMemo(\n    () => modelOptions.filter(isCompatibleWithSelectedInputs),\n    [modelOptions, isCompatibleWithSelectedInputs],\n  );\n  // Keep Auto settings consistent with models that support the selected frame.\n  const frameCompatibleModels = useMemo(\n    () => compatibleConfiguredModels.filter((model) => model.frameRatios?.includes(aspectRatio)),\n    [compatibleConfiguredModels, aspectRatio],\n  );",
        '''  const imageInputCount = references.length;
  const identityLockedReferenceSelected = references.some(
    (reference) => reference.role === "background" || reference.role === "exact_object",
  );
  const isCompatibleWithSelectedInputs = useCallback(
    (model: Image2ModelOption) =>
      model.configured && imageInputCount <= (model.maxReferences ?? 0),
    [imageInputCount],
  );
  const compatibleConfiguredModels = useMemo(
    () => modelOptions.filter(isCompatibleWithSelectedInputs),
    [modelOptions, isCompatibleWithSelectedInputs],
  );
  const identityCompatibleConfiguredModels = useMemo(
    () =>
      compatibleConfiguredModels.filter(
        (model) => !identityLockedReferenceSelected || (model.referencePriority ?? 0) > 0,
      ),
    [compatibleConfiguredModels, identityLockedReferenceSelected],
  );
  // Keep Auto settings consistent with both the selected frame and reference-fidelity mode.
  const frameCompatibleModels = useMemo(
    () => identityCompatibleConfiguredModels.filter((model) => model.frameRatios?.includes(aspectRatio)),
    [identityCompatibleConfiguredModels, aspectRatio],
  );''',
        label="identity-aware compatible model filtering",
    )
    text = replace_exact(
        text,
        "  // Preview the worker's Auto order using the current frame and quality tier.\n  const resolvedAutoModel = useMemo<Image2ModelOption | null>(() => {\n    if (frameCompatibleModels.length === 0) return null;\n    const matchingTier = frameCompatibleModels.filter((model) =>\n      (model.tiers ?? [\"standard\"]).includes(quality),\n    );\n    const candidates = matchingTier.length > 0 ? matchingTier : frameCompatibleModels;\n    return candidates.reduce((best, model) =>\n      (model.costPerGeneration ?? Infinity) < (best.costPerGeneration ?? Infinity)\n        ? model\n        : best,\n    );\n  }, [frameCompatibleModels, quality]);",
        '''  // Mirror the worker's Auto ranking: quality tier first, then fidelity for locked references,
  // then estimated provider cost. Prompt-only and Guide-only jobs remain cost-first.
  const resolvedAutoModel = useMemo<Image2ModelOption | null>(() => {
    if (frameCompatibleModels.length === 0) return null;
    const matchingTier = frameCompatibleModels.filter((model) =>
      (model.tiers ?? ["standard"]).includes(quality),
    );
    const candidates = matchingTier.length > 0 ? matchingTier : frameCompatibleModels;
    return candidates.reduce((best, model) => {
      if (identityLockedReferenceSelected) {
        const priorityDifference =
          (model.referencePriority ?? 0) - (best.referencePriority ?? 0);
        if (priorityDifference !== 0) return priorityDifference > 0 ? model : best;
      }
      return (model.costPerGeneration ?? Infinity) < (best.costPerGeneration ?? Infinity)
        ? model
        : best;
    });
  }, [frameCompatibleModels, quality, identityLockedReferenceSelected]);''',
        label="Auto model preview ranking",
    )
    text = replace_exact(
        text,
        "  const supportedFrames = useMemo<Set<string> | null>(() => {\n    if (modelOptions.length === 0) return null;\n    const source = selectedModelOption ? [selectedModelOption] : compatibleConfiguredModels;\n    return new Set(source.flatMap((model) => model.frameRatios ?? []));\n  }, [modelOptions.length, selectedModelOption, compatibleConfiguredModels]);",
        "  const supportedFrames = useMemo<Set<string> | null>(() => {\n    if (modelOptions.length === 0) return null;\n    const source = selectedModelOption ? [selectedModelOption] : identityCompatibleConfiguredModels;\n    return new Set(source.flatMap((model) => model.frameRatios ?? []));\n  }, [modelOptions.length, selectedModelOption, identityCompatibleConfiguredModels]);",
        label="reference-aware output-frame capabilities",
    )
    text = replace_exact(
        text,
        "  const selectedModelCanHandleImages = selectedModelOption\n    ? isCompatibleWithSelectedInputs(selectedModelOption)\n    : !selectedModel;",
        "  const selectedModelCanHandleImages = selectedModelOption\n    ? isCompatibleWithSelectedInputs(selectedModelOption) &&\n      (!identityLockedReferenceSelected || (selectedModelOption.referencePriority ?? 0) > 0)\n    : !selectedModel;",
        label="manual model compatibility guard",
    )
    text = replace_exact(
        text,
        "      modelOptions.length === 0 ||\n      compatibleConfiguredModels.length > 0);",
        "      modelOptions.length === 0 ||\n      identityCompatibleConfiguredModels.length > 0);",
        label="Image2 generate-button model availability",
    )
    text = replace_exact(
        text,
        "    if (\n      selectedModelOption &&\n      imageInputCount > (selectedModelOption.maxReferences ?? 0)\n    ) {",
        '''    if (
      identityLockedReferenceSelected &&
      selectedModelOption &&
      (selectedModelOption.referencePriority ?? 0) <= 0
    ) {
      setError(
        "This model is not configured for identity-preserving references. Choose Auto or a model marked for high-fidelity references, or change the image role to Guide.",
      );
      return;
    }
    if (
      selectedModelOption &&
      imageInputCount > (selectedModelOption.maxReferences ?? 0)
    ) {''',
        label="manual model fidelity guard",
    )
    text = replace_exact(
        text,
        '          assetId: reference.assetId,\n          tag: reference.tag,\n        }),',
        '          assetId: reference.assetId,\n          tag: reference.tag,\n          role: reference.role,\n        }),',
        label="role metadata upload to API",
    )
    text = replace_exact(
        text,
        "    optionsPromptText,\n    imageInputCount,\n    quality,",
        "    optionsPromptText,\n    imageInputCount,\n    identityLockedReferenceSelected,\n    quality,",
        label="handleGenerate reference-role dependency",
    )
    text = replace_exact(
        text,
        "                    <p\n                      className=\"mt-1 truncate px-0.5 text-[9px] text-[#a6a8b1]\"\n                      title={reference.name}\n                    >\n                      {reference.name}\n                    </p>\n                  </div>",
        '''                    <p
                      className="mt-1 truncate px-0.5 text-[9px] text-[#a6a8b1]"
                      title={reference.name}
                    >
                      {reference.name}
                    </p>
                    <select
                      aria-label={`Role for ${reference.tag}`}
                      title={
                        reference.role === "background"
                          ? "Base scene: preserve this background and composition"
                          : reference.role === "exact_object"
                            ? "Exact element: preserve this item's shape and distinguishing details"
                            : "Guide: use this image as inspiration rather than an exact element"
                      }
                      value={reference.role}
                      onChange={(event) =>
                        updateReferenceRole(reference.id, event.target.value as ReferenceRole)
                      }
                      className="mt-1 w-full min-w-0 rounded border border-white/[0.10] bg-[#17181c] px-1 py-1 text-[8px] text-[#d6d5df] outline-none focus-visible:ring-1 focus-visible:ring-[#aaa7ff]"
                    >
                      <option value="reference">Guide / inspiration</option>
                      <option value="background">Base / background</option>
                      <option value="exact_object">Exact element</option>
                    </select>
                  </div>''',
        label="reference role selector UI",
    )
    text = replace_exact(
        text,
        "                  Use @img1, @img2… in your prompt.",
        "                  Use @img tags; select Base/background or Exact element when the original must be preserved.",
        label="reference role help text",
    )
    return text


def apply_api_route(text: str) -> str:
    text = replace_exact(
        text,
        'const QUALITY_TIERS: QualityTier[] = ["standard", "pro"];',
        'const QUALITY_TIERS: QualityTier[] = ["standard", "pro"];\n\ntype ImageReferenceRole = "reference" | "background" | "exact_object";',
        label="API reference role type",
    )
    text = replace_exact(
        text,
        "  const referenceItems: Array<{\n    tag: string;\n    file?: File;\n    assetId?: string;\n    storagePath?: string;\n  }> = [];",
        "  const referenceItems: Array<{\n    tag: string;\n    role: ImageReferenceRole;\n    file?: File;\n    assetId?: string;\n    storagePath?: string;\n  }> = [];",
        label="API reference item shape",
    )
    text = replace_exact(
        text,
        "      let metadata: { index?: unknown; source?: unknown; assetId?: unknown; tag?: unknown };",
        "      let metadata: { index?: unknown; source?: unknown; assetId?: unknown; tag?: unknown; role?: unknown };",
        label="API parsed role metadata",
    )
    text = replace_exact(
        text,
        "      if (itemIndex < 0 || itemIndex >= MAX_REFERENCES) {\n        return NextResponse.json({ error: \"Invalid image input index.\" }, { status: 400 });\n      }\n\n      if (metadata.source === \"upload\") {",
        '''      if (itemIndex < 0 || itemIndex >= MAX_REFERENCES) {
        return NextResponse.json({ error: "Invalid image input index." }, { status: 400 });
      }

      let role: ImageReferenceRole;
      if (metadata.role === undefined || metadata.role === "reference") {
        // Requests from older studio tools did not send roles; preserve their behavior.
        role = "reference";
      } else if (metadata.role === "background" || metadata.role === "exact_object") {
        role = metadata.role;
      } else {
        return NextResponse.json({ error: "Invalid image reference role." }, { status: 400 });
      }

      if (metadata.source === "upload") {''',
        label="API role validation",
    )
    text = replace_exact(
        text,
        "        referenceItems.push({ tag, file });\n      } else if (metadata.source === \"asset\" && typeof metadata.assetId === \"string\") {",
        "        referenceItems.push({ tag, role, file });\n      } else if (metadata.source === \"asset\" && typeof metadata.assetId === \"string\") {",
        label="API upload role mapping",
    )
    text = replace_exact(
        text,
        "        referenceItems.push({ tag, assetId: metadata.assetId, storagePath: asset.storage_path });",
        "        referenceItems.push({ tag, role, assetId: metadata.assetId, storagePath: asset.storage_path });",
        label="API asset role mapping",
    )
    text = replace_exact(
        text,
        '      referenceItems.push({ tag: submittedTags[index] ?? `@img${index + 1}`, file });',
        '      referenceItems.push({ tag: submittedTags[index] ?? `@img${index + 1}`, role: "reference", file });',
        label="legacy API reference compatibility",
    )
    text = replace_exact(
        text,
        '  const referenceTags = referenceItems.map((item) => item.tag);\n  if (referenceTags.some((tag) => !/^@img[1-9]\\d*$/.test(tag)) || new Set(referenceTags).size !== referenceTags.length) {\n    return NextResponse.json({ error: "Invalid or repeated image input labels." }, { status: 400 });\n  }',
        '''  const referenceTags = referenceItems.map((item) => item.tag);
  const referenceRoles = referenceItems.map((item) => item.role);
  if (referenceTags.some((tag) => !/^@img[1-9]\\d*$/.test(tag)) || new Set(referenceTags).size !== referenceTags.length) {
    return NextResponse.json({ error: "Invalid or repeated image input labels." }, { status: 400 });
  }
  if (referenceRoles.filter((role) => role === "background").length > 1) {
    return NextResponse.json({ error: "Choose only one base/background image." }, { status: 400 });
  }''',
        label="API tag and role checks",
    )
    text = replace_exact(
        text,
        "      referenceUrls,\n      referenceTags,\n      styleReferenceUrl:",
        "      referenceUrls,\n      referenceTags,\n      referenceRoles,\n      styleReferenceUrl:",
        label="API worker job role propagation",
    )
    return text


def apply_prompts(text: str) -> str:
    text = replace_exact(
        text,
        "    tags: list[str] = []\n    used_tags: set[str] = set()\n    for index in range(len(references)):\n        tag = raw_tags[index] if index < len(raw_tags) else None\n        if not isinstance(tag, str) or not tag.startswith(\"@img\") or tag in used_tags:\n            tag = f\"@img{index + 1}\"\n            suffix = index + 1\n            while tag in used_tags:\n                suffix += 1\n                tag = f\"@img{suffix}\"\n        tags.append(tag)\n        used_tags.add(tag)",
        '''    raw_roles = fields.get("referenceRoles") or []
    if not isinstance(raw_roles, (list, tuple)):
        raw_roles = []

    tags: list[str] = []
    roles: list[str] = []
    used_tags: set[str] = set()
    for index in range(len(references)):
        raw_role = raw_roles[index] if index < len(raw_roles) else "reference"
        role = raw_role if isinstance(raw_role, str) and raw_role in {"reference", "background", "exact_object"} else "reference"
        roles.append(role)

        tag = raw_tags[index] if index < len(raw_tags) else None
        if not isinstance(tag, str) or not tag.startswith("@img") or tag in used_tags:
            tag = f"@img{index + 1}"
            suffix = index + 1
            while tag in used_tags:
                suffix += 1
                tag = f"@img{suffix}"
        tags.append(tag)
        used_tags.add(tag)''',
        label="worker role-to-reference mapping",
    )
    text = replace_exact(
        text,
        '    for index, tag in enumerate(tags):\n        manifest.append(\n            f"{tag} is content/reference image {index + 1} (provider input image "\n            f"{provider_index + index}, attachment {index + 1} in the user\'s original attachment order)."\n        )',
        '''    role_labels = {
        "reference": "GUIDE / INSPIRATION",
        "background": "BASE / BACKGROUND — preserve this actual scene",
        "exact_object": "EXACT OBJECT SOURCE — preserve this actual item's identity",
    }
    for index, tag in enumerate(tags):
        entry = (
            f"{tag} is content/reference image {index + 1} (provider input image "
            f"{provider_index + index}, attachment {index + 1} in the user's original attachment order)."
        )
        # This role label is specific to Image2. Keep prompts for the other image tools unchanged.
        if fields.get("feature") == "text_to_image":
            entry = entry[:-1] + f"; user-assigned role: {role_labels[roles[index]]}."
        manifest.append(entry)''',
        label="worker reference manifest role labels",
    )
    text = replace_exact(
        text,
        '''        guidance.append(
            "NO DEFAULT THEME: the code supplies no default scene or visual theme. Follow the user's "
            "DESCRIPTION and explicitly selected filters only; if a role or aesthetic is not specified, "
            "do not invent one. If the intended source/background is ambiguous, do not pretend the role "
            "was specified."
        )''',
        '''        background_tags = [tag for tag, role in zip(tags, roles) if role == "background"]
        exact_object_tags = [tag for tag, role in zip(tags, roles) if role == "exact_object"]
        if background_tags:
            guidance.append(
                "USER-SELECTED BASE IMAGE LOCK (" + ", ".join(background_tags) + "): this is the "
                "actual destination scene, not inspiration. Preserve its architecture, layout, viewpoint, "
                "framing, horizon, object positions, materials, and all untouched regions. Do not replace "
                "the scene with a different but similar room, building, garden, or background. Only change "
                "the regions required by the user's request, as closely to the original pixels as the selected "
                "image model allows."
            )
        if exact_object_tags:
            guidance.append(
                "EXACT OBJECT IDENTITY LOCK (" + ", ".join(exact_object_tags) + "): each designated "
                "image contains the actual item to reuse, not merely an example of its category. Preserve "
                "its distinctive silhouette, proportions, geometry, contours, openings, component count, "
                "surface pattern, color placement, materials, hardware, markings, and recognizable small "
                "details. Do not substitute a generic, redesigned, beautified, or same-category lookalike. "
                "Do not invent missing design details. If extra decoration conflicts with matching the source "
                "item, prioritize the submitted item's identity."
            )
        guidance.append(
            "GUIDE ROLE: images marked GUIDE / INSPIRATION inform the requested visual direction; do not "
            "force them into the output as exact objects unless the description asks for that."
        )
        guidance.append(
            "NO DEFAULT THEME: the code supplies no default scene or visual theme. Follow the user's "
            "DESCRIPTION and explicitly selected filters only; if a role or aesthetic is not specified, "
            "do not invent one. If the intended source/background is ambiguous, do not pretend the role "
            "was specified."
        )''',
        label="worker identity-preserving prompt rules",
    )
    return text


def apply_catalog(text: str) -> str:
    text = replace_exact(
        text,
        "    # Only frames confirmed for this exact model/adapter; empty means unknown.\n    frame_ratios: tuple[str, ...] = ()",
        "    # Only frames confirmed for this exact model/adapter; empty means unknown.\n    frame_ratios: tuple[str, ...] = ()\n    # Non-zero only for models selected for explicitly identity-sensitive Image2 jobs.\n    reference_priority: int = 0",
        label="Candidate reference_priority field (appended to preserve positional compatibility)",
    )
    text = replace_exact(
        text,
        '            "supportsStyleReference": c.supports_style_reference,\n            "resolutions": c.resolutions,',
        '            "supportsStyleReference": c.supports_style_reference,\n            "referencePriority": c.reference_priority,\n            "resolutions": c.resolutions,',
        label="model capability metadata exposure",
    )
    text = replace_exact(
        text,
        'def openai_text_to_image_input(req: dict) -> dict:\n    """OpenAI GPT Image 1: use only documented native output sizes."""\n    ratio = req.get("aspectRatio") or "auto"\n    size = "auto" if ratio == "auto" else exact_size(GPT_IMAGE_1_SIZES, ratio)',
        'def openai_text_to_image_input(req: dict) -> dict:\n    """OpenAI GPT Image 2.5: use documented native/custom output dimensions."""\n    ratio = req.get("aspectRatio") or "auto"\n    size = "auto" if ratio == "auto" else exact_size(GPT_IMAGE_25_SIZES, ratio)',
        label="Image2 OpenAI image size mapping",
    )
    text = replace_exact(
        text,
        '    Candidate("gpt-image-1", "GPT Image 1", "Versatile OpenAI text-to-image with Style and content references", "openai", "gpt-image-1", 6, 8, 14, IMAGE_TIMEOUT_MS, ("standard", "pro"), openai_text_to_image_input, extract_image_urls, supports_style_reference=True, frame_ratios=("auto", "1:1", "3:2", "2:3")),\n    Candidate("gemini-2.5-flash", "Gemini 2.5 Flash Image", "Fast text-to-image with Style and content references", "google", "gemini-2.5-flash-image", 3, 3, 3, IMAGE_TIMEOUT_MS, ("standard",), google_text_to_image_input, extract_image_urls, supports_style_reference=True, frame_ratios=("auto", *ALL_FRAMES)),',
        '''    # 22 cents is a conservative internal estimate, not a fixed provider tariff; calibrate against actual invoices.
    Candidate(
        "gpt-image-1", "GPT Image 2.5 Sunburst", "OpenAI precision-oriented image editing with content references",
        "openai", "gpt-image-2.5-sunburst", 9, 22, 14, IMAGE_TIMEOUT_MS,
        ("standard", "pro"), openai_text_to_image_input, extract_image_urls,
        supports_style_reference=True, frame_ratios=("auto", *ALL_FRAMES), reference_priority=3,
    ),
    Candidate(
        "gemini-3-pro-image", "Gemini 3 Pro Image", "High-fidelity image generation with multiple reference images",
        "google", "gemini-3-pro-image", 8, 16, 14, IMAGE_TIMEOUT_MS,
        ("standard", "pro"), google_text_to_image_input, extract_image_urls,
        supports_style_reference=True, frame_ratios=("auto", *ALL_FRAMES), reference_priority=2,
    ),
    Candidate("gemini-2.5-flash", "Gemini 2.5 Flash Image", "Fast text-to-image with Style and content references", "google", "gemini-2.5-flash-image", 3, 3, 3, IMAGE_TIMEOUT_MS, ("standard",), google_text_to_image_input, extract_image_urls, supports_style_reference=True, frame_ratios=("auto", *ALL_FRAMES), reference_priority=1),''',
        label="current Image2 high-fidelity provider candidates",
    )
    text = replace_exact(
        text,
        'from frame_ratio import ALL_FRAMES, BFL_DIMENSIONS, GPT_IMAGE_1_SIZES, MAGICHOUR_FRAMES, exact_size',
        'from frame_ratio import ALL_FRAMES, BFL_DIMENSIONS, GPT_IMAGE_1_SIZES, GPT_IMAGE_25_SIZES, MAGICHOUR_FRAMES, exact_size',
        label="catalog import for current GPT Image dimensions",
    )
    return text


def apply_frame_ratio(text: str) -> str:
    text = replace_exact(
        text,
        '# Magic Hour Flux 2 Klein native frame options documented for generation.\nMAGICHOUR_FRAMES = ("1:1", "16:9", "9:16")',
        '''# GPT Image 2.5 accepts custom dimensions when each edge is a multiple of 16,
# the ratio is between 1:3 and 3:1, and the maximum edge is 3840 pixels.
GPT_IMAGE_25_SIZES: dict[str, str] = {
    "1:1": "1024x1024",
    "16:9": "1536x864",
    "9:16": "864x1536",
    "4:3": "1024x768",
    "3:4": "768x1024",
    "3:2": "1536x1024",
    "2:3": "1024x1536",
    "21:9": "1792x768",
}

# Magic Hour Flux 2 Klein native frame options documented for generation.
MAGICHOUR_FRAMES = ("1:1", "16:9", "9:16")''',
        label="GPT Image 2.5 supported custom output dimensions",
    )
    return text


def apply_engine(text: str) -> str:
    text = replace_exact(
        text,
        'def order_candidates(candidates: list[Candidate], quality: str, selected_key: str | None = None) -> list[Candidate]:\n    """Ordonne les candidats.\n\n    - `selected_key` (choix utilisateur) retourne UNIQUEMENT ce candidat\n      (pas de fallback silencieux).\n    - Mode "Auto" (`selected_key` vide) : parmi les candidats satisfaisant\n      le tier de qualité demandé, on choisit d\'abord le MOINS CHER\n      (cost_per_generation croissant), puis l\'ordre du catalogue en\n      tie-break. Les candidats hors tier arrivent après (fallback).\n    """\n    if selected_key and selected_key != "auto":\n        return [c for c in candidates if c.key == selected_key]\n\n    indexed = list(enumerate(candidates))\n\n    def rank(item):\n        index, candidate = item\n        tier_match = 0 if quality in candidate.tiers else 1\n        # Auto : coût réel croissant, avec l\'ordre catalogue en tie-break.\n        return (tier_match, candidate.cost_per_generation, index)\n\n    return [candidate for _, candidate in sorted(indexed, key=rank)]',
        '''def order_candidates(
    candidates: list[Candidate],
    quality: str,
    selected_key: str | None = None,
    *,
    prefer_reference_fidelity: bool = False,
) -> list[Candidate]:
    """Order models without changing explicit model selection.

    Auto remains cost-first for ordinary prompts. When the caller explicitly
    locks an image as a base background or exact object, candidates with a
    declared reference-fidelity priority are considered before provider cost.
    """
    if selected_key and selected_key != "auto":
        return [c for c in candidates if c.key == selected_key]

    indexed = list(enumerate(candidates))

    def rank(item):
        index, candidate = item
        tier_match = 0 if quality in candidate.tiers else 1
        if prefer_reference_fidelity:
            return (
                tier_match,
                -candidate.reference_priority,
                candidate.cost_per_generation,
                index,
            )
        return (tier_match, candidate.cost_per_generation, index)

    return [candidate for _, candidate in sorted(indexed, key=rank)]''',
        label="conditional Auto routing priority",
    )
    return text


def apply_image_render(text: str) -> str:
    text = replace_exact(
        text,
        '    input_ = job["input"]\n    feature = input_["feature"]\n    with db.connect() as conn:',
        '''    input_ = job["input"]
    feature = input_["feature"]
    reference_roles = input_.get("referenceRoles") or []
    identity_locked = feature == "text_to_image" and any(
        isinstance(role, str) and role in {"background", "exact_object"}
        for role in reference_roles
    )
    with db.connect() as conn:''',
        label="worker identity-sensitive job detection",
    )
    text = replace_exact(
        text,
        '            if feature == "multi_angle" and isinstance(input_.get("cameraState"), dict) and input_.get("referenceUrls"):',
        '''            if feature == "text_to_image" and identity_locked:
                # Never silently route a locked object/background to an adapter
                # that is not designated for identity-sensitive reference work.
                feature_candidates = [
                    candidate for candidate in feature_candidates
                    if candidate.reference_priority > 0
                ]
                if not feature_candidates:
                    raise ValueError(
                        "Exact item/background mode requires a configured, compatible high-fidelity reference model. "
                        "Choose Auto or a compatible model, reduce the image count, or change the role to Guide."
                    )
            if feature == "multi_angle" and isinstance(input_.get("cameraState"), dict) and input_.get("referenceUrls"):''',
        label="worker identity-only candidate filter",
    )
    text = replace_exact(
        text,
        '            candidates = order_candidates(feature_candidates, input_.get("quality") or "standard", input_.get("model"))',
        '''            candidates = order_candidates(
                feature_candidates,
                input_.get("quality") or "standard",
                input_.get("model"),
                prefer_reference_fidelity=identity_locked,
            )''',
        label="worker candidate ordering call",
    )
    return text


def apply_reference_tests(text: str) -> str:
    text = replace_exact(
        text,
        'from prompts import add_image_reference_map, build_text_to_image_prompt\nimport providers.magichour as magichour_provider',
        'from prompts import add_image_reference_map, build_text_to_image_prompt\nfrom workflows.engine import order_candidates\nimport providers.magichour as magichour_provider',
        label="routing test import",
    )
    text = replace_exact(
        text,
        "def test_openai_edit_requests_high_input_fidelity(monkeypatch):",
        "def test_gpt_image_25_edit_uses_reference_images_without_legacy_fidelity_flag(monkeypatch):",
        label="current GPT Image adapter test name",
    )
    text = replace_exact(
        text,
        '    openai_provider._run_image_edit(\n        "gpt-image-1",\n        {\n            "images": ["data:image/png;base64,aGVsbG8="],',
        '    openai_provider._run_image_edit(\n        "gpt-image-2.5-sunburst",\n        {\n            "images": ["data:image/png;base64,aGVsbG8="],',
        label="current GPT Image model in adapter test",
    )
    text = replace_exact(
        text,
        '    assert captured["data"]["input_fidelity"] == "high"',
        '    assert "input_fidelity" not in captured["data"]\n    assert captured["data"]["model"] == "gpt-image-2.5-sunburst"',
        label="current GPT Image supported edit parameters assertion",
    )
    text = replace_exact(
        text,
        '    # Image2\'s UI limit is 14; GPT Image 1\'s edit API supports up to 16 input images.\n    assert models["gpt-image-1"].max_references == 14\n    assert models["flux-pro"].max_references == 1',
        '''    # Preserve the old selector key for compatibility, but route it to the current OpenAI model.
    assert models["gpt-image-1"].model_id == "gpt-image-2.5-sunburst"
    assert models["gpt-image-1"].max_references == 14
    assert models["gpt-image-1"].reference_priority > 0
    assert models["gemini-3-pro-image"].max_references == 14
    assert models["gemini-3-pro-image"].reference_priority > 0
    assert models["flux-pro"].max_references == 1''',
        label="Image2 provider contract assertions",
    )
    text = replace_exact(
        text,
        'def test_bfl_candidate_uses_only_one_image_and_is_not_eligible_for_multi_image_requests():',
        '''def test_auto_prefers_identity_models_only_when_identity_is_requested():
    normal_order = order_candidates(TEXT_TO_IMAGE_CANDIDATES, "standard")
    locked_order = order_candidates(
        TEXT_TO_IMAGE_CANDIDATES,
        "standard",
        prefer_reference_fidelity=True,
    )

    # Prompt-only behavior remains cost-first.
    assert normal_order[0].key == "magichour-flux-2-klein-text"
    # Explicit identity-sensitive jobs prefer the designated high-fidelity routes.
    assert locked_order[0].key == "gpt-image-1"
    assert locked_order[1].key == "gemini-3-pro-image"
    assert locked_order[2].key == "gemini-2.5-flash"


def test_bfl_candidate_uses_only_one_image_and_is_not_eligible_for_multi_image_requests():''',
        label="identity-aware Auto routing test",
    )
    return text


def apply_prompt_tests(text: str) -> str:
    text = replace_exact(
        text,
        'def test_image2_style_filters_are_text_only_and_preserve_subject():',
        '''def test_image2_explicit_roles_lock_background_and_exact_object():
    prompt = add_image_reference_map(
        "Use @img1 as the base scene and place the exact chair from @img2 into it.",
        {
            "feature": "text_to_image",
            "referenceUrls": ["base-image", "chair-image"],
            "referenceTags": ["@img1", "@img2"],
            "referenceRoles": ["background", "exact_object"],
        },
    )

    assert "BASE / BACKGROUND" in prompt
    assert "EXACT OBJECT SOURCE" in prompt
    assert "USER-SELECTED BASE IMAGE LOCK (@img1)" in prompt
    assert "EXACT OBJECT IDENTITY LOCK (@img2)" in prompt
    assert "same-category lookalike" in prompt


def test_image2_style_filters_are_text_only_and_preserve_subject():''',
        label="identity prompt regression test",
    )
    return text


TRANSFORMS = {
    "web/components/studio/image2-workspace.tsx": apply_frontend,
    "web/app/api/generate/route.ts": apply_api_route,
    "worker/prompts.py": apply_prompts,
    "worker/catalog.py": apply_catalog,
    "worker/frame_ratio.py": apply_frame_ratio,
    "worker/workflows/engine.py": apply_engine,
    "worker/workflows/image_render.py": apply_image_render,
    "worker/tests/test_image2_multi_reference.py": apply_reference_tests,
    "worker/tests/test_reference_mapping.py": apply_prompt_tests,
}


def validate_staged(staged: dict[Path, str], root: Path) -> None:
    required = {
        "web/components/studio/image2-workspace.tsx": [
            'type ReferenceRole = "reference" | "background" | "exact_object";',
            "identityLockedReferenceSelected",
            "referencePriority",
            "role: reference.role",
            "<option value=\"exact_object\">Exact element</option>",
        ],
        "web/app/api/generate/route.ts": [
            "type ImageReferenceRole =",
            "referenceRoles = referenceItems.map",
            "referenceRoles,",
        ],
        "worker/prompts.py": [
            "USER-SELECTED BASE IMAGE LOCK",
            "EXACT OBJECT IDENTITY LOCK",
            "same-category lookalike",
        ],
        "worker/catalog.py": [
            "reference_priority: int = 0",
            '"gpt-image-2.5-sunburst"',
            '"gemini-3-pro-image"',
            '"referencePriority": c.reference_priority',
        ],
        "worker/frame_ratio.py": [
            "GPT_IMAGE_25_SIZES",
            '"16:9": "1536x864"',
        ],
        "worker/workflows/engine.py": [
            "prefer_reference_fidelity: bool = False",
            "-candidate.reference_priority",
        ],
        "worker/workflows/image_render.py": [
            "identity_locked =",
            "candidate.reference_priority > 0",
            "prefer_reference_fidelity=identity_locked",
        ],
    }
    for rel, needles in required.items():
        path = root / rel
        content = staged[path]
        missing = [needle for needle in needles if needle not in content]
        if missing:
            raise PatchError(f"Validation failed for {rel}; missing expected code markers: {missing}")

    # Validate Python syntax in memory without writing __pycache__ files.
    for rel in (
        "worker/prompts.py",
        "worker/catalog.py",
        "worker/frame_ratio.py",
        "worker/workflows/engine.py",
        "worker/workflows/image_render.py",
        "worker/tests/test_image2_multi_reference.py",
        "worker/tests/test_reference_mapping.py",
    ):
        try:
            ast.parse(staged[root / rel], filename=rel)
        except SyntaxError as exc:
            raise PatchError(f"Python syntax validation failed in {rel}: {exc}") from exc


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--root",
        type=Path,
        default=Path.cwd(),
        help="Local repository root (default: current directory).",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Validate and list planned file changes without writing anything.",
    )
    args = parser.parse_args()
    root = args.root.resolve()

    paths = {root / rel: transform for rel, transform in TRANSFORMS.items()}
    missing_files = [str(path.relative_to(root)) for path in paths if not path.is_file()]
    if missing_files:
        print(
            "ERROR: this folder does not look like the expected mk-studio-ai repository root.\n"
            "Missing files:\n  - " + "\n  - ".join(missing_files),
            file=sys.stderr,
        )
        return 2

    originals: dict[Path, bytes] = {path: path.read_bytes() for path in paths}
    staged: dict[Path, str] = {}
    try:
        for path, transform in paths.items():
            try:
                current = originals[path].decode("utf-8")
            except UnicodeDecodeError as exc:
                raise PatchError(f"Could not decode {path.relative_to(root)} as UTF-8") from exc
            staged[path] = transform(current)
        validate_staged(staged, root)
    except PatchError as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        print("No project files were changed.", file=sys.stderr)
        return 3

    changed = [path for path in paths if staged[path] != originals[path].decode("utf-8")]
    if not changed:
        print("Image2 reference-fidelity fix already appears to be applied. No files changed.")
        return 0

    print("Validated the Image2-only patch. Files to change:")
    for path in changed:
        print(f"  - {path.relative_to(root).as_posix()}")
    print("Checks passed: exact source anchors, required code markers, Python syntax.")

    if args.dry_run:
        print("Dry run only: no files were written.")
        return 0

    backup_root = Path(tempfile.mkdtemp(prefix="image2-reference-fix-backup-"))
    for path in changed:
        backup = backup_root / path.relative_to(root)
        backup.parent.mkdir(parents=True, exist_ok=True)
        backup.write_bytes(originals[path])

    written: list[Path] = []
    try:
        for path in changed:
            temporary = path.with_name(path.name + ".image2-fix-tmp")
            temporary.write_text(staged[path], encoding="utf-8", newline="")
            os.replace(temporary, path)
            written.append(path)
    except Exception as exc:  # noqa: BLE001
        # Roll back any partially written set from the preflight snapshot.
        for path in written:
            path.write_bytes(originals[path])
        for path in changed:
            temporary = path.with_name(path.name + ".image2-fix-tmp")
            if temporary.exists():
                temporary.unlink()
        print(f"ERROR while writing files; originals were restored: {exc}", file=sys.stderr)
        return 4

    print("Applied successfully. Backups are outside the repository at:")
    print(f"  {backup_root}")
    print("No GitHub actions, commits, pushes, installs, or deployments were performed.")
    print("Next, run the two focused tests from the worker environment and your normal web lint/build.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
