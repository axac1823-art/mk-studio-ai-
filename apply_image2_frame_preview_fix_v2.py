#!/usr/bin/env python3
"""Apply the local-only Image2 frame/AUTO, capability and Preview-group fix.

Run from any directory:
  python apply_image2_frame_preview_fix.py --repo PATH_TO_REPO

The script validates every expected source fragment in memory before writing
any file. It creates a .before-image2-frame-preview-fix.bak backup for each
changed file. It never calls GitHub and never runs git commands.
"""
from __future__ import annotations

import argparse
import os
import re
import shutil
import sys
import tempfile
from pathlib import Path
from typing import Callable

BRANCH_HINT = "upload/image2-preview-frame-context"


class PatchError(RuntimeError):
    pass


def replace_once(source: str, old: str, new: str, label: str) -> str:
    count = source.count(old)
    if count != 1:
        raise PatchError(f"{label}: expected exactly one match, found {count}; no files were written")
    return source.replace(old, new, 1)


def patch_generate_route(s: str) -> str:
    return replace_once(
        s,
        '''  const rawAspect = form.get("aspectRatio");
  const aspectRatio: AspectRatio = ASPECT_RATIOS.includes(rawAspect as AspectRatio)
    ? (rawAspect as AspectRatio)
    : "1:1";''',
        '''  const rawAspect = form.get("aspectRatio");
  const aspectRatio: AspectRatio | "auto" = rawAspect === "auto"
    ? "auto"
    : ASPECT_RATIOS.includes(rawAspect as AspectRatio)
      ? (rawAspect as AspectRatio)
      : "1:1";''',
        "Image2 AUTO ratio validation",
    )


def patch_db_queries(s: str) -> str:
    s = replace_once(
        s,
        '''  generation_id: string | null;\n  storage_path: string;\n  is_favorite: boolean;\n  is_trashed: boolean;\n  trashed_at: string | null;\n  created_at: string;\n}\n\nexport interface DbJob''',
        '''  generation_id: string | null;\n  storage_path: string;\n  is_favorite: boolean;\n  is_trashed: boolean;\n  trashed_at: string | null;\n  created_at: string;\n  // Joined from the durable jobs.input JSON for generation-aware gallery groups.\n  generation_feature?: string | null;\n  generation_prompt?: string | null;\n  generation_aspect_ratio?: string | null;\n  generation_quality?: string | null;\n  generation_resolution?: string | null;\n  generation_selected_model?: string | null;\n  generation_model_used?: string | null;\n  generation_created_at?: string | null;\n}\n\nexport interface DbJob''',
        "DbAsset metadata fields",
    )
    s = replace_once(
        s,
        '''  return sql<DbAsset[]>`\n    SELECT * FROM assets\n    WHERE user_id = ${userId}''',
        '''  return sql<DbAsset[]>`\n    SELECT assets.*,\n      (SELECT j.input->>'feature' FROM jobs j WHERE j.id = assets.generation_id LIMIT 1) AS generation_feature,\n      (SELECT COALESCE(NULLIF(j.input->>'sceneDetails', ''), NULLIF(j.input->>'description', ''), NULLIF(j.input->>'prompt', ''))\n        FROM jobs j WHERE j.id = assets.generation_id LIMIT 1) AS generation_prompt,\n      (SELECT j.input->>'aspectRatio' FROM jobs j WHERE j.id = assets.generation_id LIMIT 1) AS generation_aspect_ratio,\n      (SELECT j.input->>'quality' FROM jobs j WHERE j.id = assets.generation_id LIMIT 1) AS generation_quality,\n      (SELECT j.input->>'resolution' FROM jobs j WHERE j.id = assets.generation_id LIMIT 1) AS generation_resolution,\n      (SELECT NULLIF(j.input->>'model', '') FROM jobs j WHERE j.id = assets.generation_id LIMIT 1) AS generation_selected_model,\n      (SELECT j.model_used FROM jobs j WHERE j.id = assets.generation_id LIMIT 1) AS generation_model_used,\n      (SELECT j.created_at FROM jobs j WHERE j.id = assets.generation_id LIMIT 1) AS generation_created_at\n    FROM assets\n    WHERE assets.user_id = ${userId}''',
        "listAssets metadata query",
    )
    # Qualify the base table fields because the SELECT now explicitly names assets.
    for old, new, label in [
        ('AND (${filters.projectId ?? null}::uuid IS NULL OR project_id = ${filters.projectId ?? null}::uuid)', 'AND (${filters.projectId ?? null}::uuid IS NULL OR assets.project_id = ${filters.projectId ?? null}::uuid)', 'project filter qualification'),
        ('AND (${filters.type ?? null}::text IS NULL OR type = ${filters.type ?? null})', 'AND (${filters.type ?? null}::text IS NULL OR assets.type = ${filters.type ?? null})', 'type filter qualification'),
        ('AND (${filters.favorite ?? null}::boolean IS NULL OR is_favorite = ${filters.favorite ?? null})', 'AND (${filters.favorite ?? null}::boolean IS NULL OR assets.is_favorite = ${filters.favorite ?? null})', 'favorite filter qualification'),
        ('AND is_trashed = ${filters.trashed ?? false}', 'AND assets.is_trashed = ${filters.trashed ?? false}', 'trash filter qualification'),
        ('(generation_id IS NULL AND video_job_id IS NULL)', '(assets.generation_id IS NULL AND assets.video_job_id IS NULL)', 'uploads filter qualification'),
        ('(generation_id IS NOT NULL OR video_job_id IS NOT NULL)', '(assets.generation_id IS NOT NULL OR assets.video_job_id IS NOT NULL)', 'generated filter qualification'),
        ('ORDER BY created_at DESC`;\n}\n\n/** Bascule favori', 'ORDER BY assets.created_at DESC`;\n}\n\n/** Bascule favori', 'asset sort qualification'),
    ]:
        s = replace_once(s, old, new, label)
    # Feature filtering uses assets.generation_id; qualify only that outer reference.
    s = replace_once(
        s,
        'WHERE j.id = assets.generation_id\n          AND (',
        'WHERE j.id = assets.generation_id\n          AND (',
        "feature filter outer relation",
    )
    return s


def patch_assets_route(s: str) -> str:
    return replace_once(
        s,
        '''      generationId: asset.generation_id,\n      createdAt: asset.created_at,\n    })),''',
        '''      generationId: asset.generation_id,\n      createdAt: asset.created_at,\n      feature: asset.generation_feature ?? undefined,\n      generationPrompt: asset.generation_prompt ?? null,\n      generationAspectRatio: asset.generation_aspect_ratio ?? null,\n      generationQuality: asset.generation_quality ?? null,\n      generationResolution: asset.generation_resolution ?? null,\n      generationSelectedModel: asset.generation_selected_model ?? null,\n      generationModelUsed: asset.generation_model_used ?? null,\n      generationCreatedAt: asset.generation_created_at ?? null,\n    })),''',
        "assets API generation metadata",
    )


def patch_catalog(s: str) -> str:
    s = replace_once(
        s,
        '    supports_style_reference: bool = False\n',
        '    supports_style_reference: bool = False\n    # Current text-to-image adapters expose approximately 1K output only.\n    # Do not advertise 2K/4K until an adapter really requests those sizes.\n    resolutions: tuple[str, ...] = ("1K",)\n',
        "model resolution capabilities",
    )
    s = replace_once(
        s,
        '            "supportsStyleReference": c.supports_style_reference,\n            "configured": is_provider_configured(c.provider),',
        '            "supportsStyleReference": c.supports_style_reference,\n            "resolutions": c.resolutions,\n            "configured": is_provider_configured(c.provider),',
        "model list resolution capabilities",
    )
    s = replace_once(
        s,
        '''def bfl_text_to_image_input(req: dict) -> dict:\n    """BFL text-to-image with one optional image reference."""\n    payload: dict = {\n        "prompt": req["prompt"],\n        "output_format": "jpeg",\n        "safety_tolerance": 2,\n        "quantity": req["quantity"],\n    }''',
        '''def bfl_text_to_image_input(req: dict) -> dict:\n    """BFL text-to-image: pass actual dimensions so the selected frame is honored."""\n    ratio = req.get("resolvedAspectRatio") if req.get("aspectRatio") == "auto" else req.get("aspectRatio")\n    width, height = {\n        "1:1": (1024, 1024),\n        "16:9": (1024, 576),\n        "9:16": (576, 1024),\n        "4:3": (1024, 768),\n        "3:4": (768, 1024),\n    }.get(ratio, (1024, 768))\n    payload: dict = {\n        "prompt": req["prompt"],\n        "width": width,\n        "height": height,\n        "output_format": "jpeg",\n        "safety_tolerance": 2,\n        "quantity": req["quantity"],\n    }''',
        "BFL frame dimensions",
    )
    s = replace_once(
        s,
        '''def openai_text_to_image_input(req: dict) -> dict:\n    """OpenAI image generation/edit with a dedicated Style input when supplied."""\n    size = (\n        "1536x1024"\n        if req["aspectRatio"] in ("16:9", "4:3")\n        else "1024x1536"\n        if req["aspectRatio"] in ("9:16", "3:4")\n        else "1024x1024"\n    )''',
        '''def openai_text_to_image_input(req: dict) -> dict:\n    """OpenAI image generation/edit with a dedicated Style input when supplied."""\n    size = (\n        "auto"\n        if req["aspectRatio"] == "auto"\n        else "1536x1024"\n        if req["aspectRatio"] in ("16:9", "4:3")\n        else "1024x1536"\n        if req["aspectRatio"] in ("9:16", "3:4")\n        else "1024x1024"\n    )''',
        "OpenAI native AUTO size",
    )
    s = replace_once(
        s,
        '''def google_text_to_image_input(req: dict) -> dict:\n    """Google multimodal generation: keep Style explicit and ahead of content references."""\n    images: list[str] = []\n    style_image = req.get("styleReferenceUrl")\n    if isinstance(style_image, str) and style_image:\n        images.append(style_image)\n    images.extend(req.get("referenceUrls") or [])\n    return {\n        "prompt": req["prompt"],\n        "images": images,\n        "quantity": req["quantity"],\n    }''',
        '''def google_text_to_image_input(req: dict) -> dict:\n    """Google multimodal generation: preserve Style order and pass a native ratio when selected."""\n    images: list[str] = []\n    style_image = req.get("styleReferenceUrl")\n    if isinstance(style_image, str) and style_image:\n        images.append(style_image)\n    images.extend(req.get("referenceUrls") or [])\n    payload = {\n        "prompt": req["prompt"],\n        "images": images,\n        "quantity": req["quantity"],\n    }\n    if req.get("aspectRatio") not in (None, "auto"):\n        payload["aspectRatio"] = req["aspectRatio"]\n    return payload''',
        "Google text-to-image ratio input",
    )
    s = replace_once(
        s,
        '''    ratio = (\n        "16:9"\n        if req["aspectRatio"] in ("16:9", "4:3")\n        else "9:16"\n        if req["aspectRatio"] in ("9:16", "3:4")\n        else "1:1"\n    )\n    images: list[str] = []\n    style_image = req.get("styleReferenceUrl")''',
        '''    ratio = (\n        "auto"\n        if req["aspectRatio"] == "auto"\n        else "16:9"\n        if req["aspectRatio"] in ("16:9", "4:3")\n        else "9:16"\n        if req["aspectRatio"] in ("9:16", "3:4")\n        else "1:1"\n    )\n    images: list[str] = []\n    style_image = req.get("styleReferenceUrl")''',
        "Magic Hour native AUTO ratio",
    )
    return s


def patch_google_provider(s: str) -> str:
    return replace_once(
        s,
        '''    response = post_json(\n        f"{BASE_URL}/{model_id}:generateContent",\n        {"x-goog-api-key": require_env("GOOGLE_API_KEY")},\n        {"contents": [{"parts": parts}], "generationConfig": {"responseModalities": ["IMAGE"]}},\n    )''',
        '''    generation_config: dict = {"responseModalities": ["IMAGE"]}\n    # Gemini supports native imageConfig.aspectRatio for explicit frames. For AUTO,\n    # omit the override and let the model choose its default framing.\n    aspect_ratio = input_.get("aspectRatio")\n    if aspect_ratio in {"1:1", "16:9", "9:16", "4:3", "3:4"}:\n        generation_config["imageConfig"] = {"aspectRatio": aspect_ratio}\n\n    response = post_json(\n        f"{BASE_URL}/{model_id}:generateContent",\n        {"x-goog-api-key": require_env("GOOGLE_API_KEY")},\n        {"contents": [{"parts": parts}], "generationConfig": generation_config},\n    )''',
        "Google native aspect configuration",
    )


def patch_image_render(s: str) -> str:
    s = replace_once(s, 'import base64\nimport mimetypes\n', 'import base64\nimport io\nimport math\nimport mimetypes\n', "image workflow imports")
    s = replace_once(s, 'import db\nimport storage\n', 'import db\nimport storage\nfrom PIL import Image\n', "Pillow import")
    marker = '''def run(job: dict) -> None:\n'''
    helpers = '''def _infer_aspect_ratio(value: str | None) -> str:\n    """Infer the nearest supported frame from a reference image; default to 4:3."""\n    if not isinstance(value, str) or not value:\n        return "4:3"\n    try:\n        if value.startswith("data:") and "," in value:\n            import base64 as _base64\n            payload = value.split(",", 1)[1]\n            with Image.open(io.BytesIO(_base64.b64decode(payload))) as image:\n                source_ratio = image.width / image.height\n        else:\n            path_value = value\n            if value.startswith("http://") or value.startswith("https://"):\n                from urllib.parse import urlparse\n                parsed = urlparse(value)\n                path_value = parsed.path if parsed.path.startswith("/storage/") else ""\n            if not path_value.startswith("/storage/"):\n                return "4:3"\n            with Image.open(storage.resolve(path_value)) as image:\n                source_ratio = image.width / image.height\n        ratios = {"1:1": 1.0, "16:9": 16 / 9, "9:16": 9 / 16, "4:3": 4 / 3, "3:4": 3 / 4}\n        return min(ratios, key=lambda key: abs(math.log(source_ratio / ratios[key])))\n    except Exception:\n        return "4:3"\n\n\ndef _crop_stored_image_to_ratio(storage_path: str, aspect_ratio: str) -> None:\n    """Center-crop stored image pixels to the chosen ratio without upscaling."""\n    ratios = {"1:1": 1.0, "16:9": 16 / 9, "9:16": 9 / 16, "4:3": 4 / 3, "3:4": 3 / 4}\n    target_ratio = ratios.get(aspect_ratio)\n    if target_ratio is None:\n        return\n    path = storage.resolve(storage_path)\n    with Image.open(path) as original:\n        image = original.copy()\n        image_format = original.format or "PNG"\n    current_ratio = image.width / image.height\n    if abs(current_ratio - target_ratio) < 0.002:\n        return\n    if current_ratio > target_ratio:\n        crop_width = max(1, min(image.width, round(image.height * target_ratio)))\n        left = (image.width - crop_width) // 2\n        image = image.crop((left, 0, left + crop_width, image.height))\n    else:\n        crop_height = max(1, min(image.height, round(image.width / target_ratio)))\n        top = (image.height - crop_height) // 2\n        image = image.crop((0, top, image.width, top + crop_height))\n    options = {"format": image_format}\n    if image_format.upper() in {"JPEG", "JPG"}:\n        if image.mode not in {"RGB", "L"}:\n            image = image.convert("RGB")\n        options["quality"] = 95\n        options["optimize"] = True\n    elif image_format.upper() == "WEBP":\n        options["quality"] = 95\n    image.save(path, **options)\n\n\n'''
    s = replace_once(s, marker, helpers + marker, "image framing helper insertion")
    normalize_marker = '''            if feature == "background_remover" and isinstance(req.get("imageUrl"), str):\n'''
    framing = '''            if feature == "text_to_image":\n                requested_ratio = input_.get("aspectRatio") or "4:3"\n                if requested_ratio == "auto":\n                    source_for_ratio = req.get("imageUrl")\n                    if not source_for_ratio:\n                        references_for_ratio = req.get("referenceUrls") or []\n                        source_for_ratio = references_for_ratio[0] if references_for_ratio else None\n                    req["resolvedAspectRatio"] = _infer_aspect_ratio(source_for_ratio)\n                else:\n                    req["resolvedAspectRatio"] = requested_ratio\n\n'''
    s = replace_once(s, normalize_marker, framing + normalize_marker, "AUTO source ratio resolution")
    s = replace_once(
        s,
        '''            for url in outcome["output_urls"]:\n                path, _ext = store_output(url)\n                asset_id = insert_asset(conn, job, "image", path)''',
        '''            for url in outcome["output_urls"]:\n                path, _ext = store_output(url)\n                requested_ratio = input_.get("aspectRatio")\n                if feature == "text_to_image" and requested_ratio in {"1:1", "16:9", "9:16", "4:3", "3:4"}:\n                    _crop_stored_image_to_ratio(path, requested_ratio)\n                asset_id = insert_asset(conn, job, "image", path)''',
        "crop each image to exact selected frame",
    )
    return s


def patch_requirements(s: str) -> str:
    if "Pillow>=" in s:
        raise PatchError("worker/requirements.txt: Pillow is already present; inspect manually")
    return s.rstrip() + "\nPillow>=10.0\n"


def patch_workspace(s: str) -> str:
    s = replace_once(
        s,
        '''  tiers?: string[];\n  costPerGeneration?: number;\n  service?: string;''',
        '''  tiers?: string[];\n  resolutions?: string[];\n  costPerGeneration?: number;\n  service?: string;''',
        "model resolution type",
    )
    s = replace_once(
        s,
        '''const RATIO_DESCRIPTIONS: Record<AspectRatio, string> = {\n  "1:1": "Square",''',
        '''type Image2AspectRatio = AspectRatio | "auto";\n\nconst RATIO_DESCRIPTIONS: Record<Image2AspectRatio, string> = {\n  auto: "Automatic",\n  "1:1": "Square",''',
        "Image2-only aspect type and AUTO label",
    )
    s = replace_once(
        s,
        '''  "3:4": "Tall",\n};''',
        '''  "3:4": "Tall",\n};\n\n// AUTO is intentionally scoped to Image2; other workspaces keep their current ratio options.\nconst IMAGE2_ASPECT_RATIOS: readonly Image2AspectRatio[] = ["auto", ...ASPECT_RATIOS];''',
        "Image2-only AUTO frame options",
    )
    # Do not anchor this to the entire JSX onClick body: harmless formatting or
    # handler changes in local branches previously caused a false preflight failure.
    # Scope the replacement to the ratio map expression and require one unique match.
    ratio_map_pattern = re.compile(r"\bASPECT_RATIOS(?=\s*\.map\s*\(\s*\(\s*ratio\b[^)]*\)\s*=>)")
    ratio_map_matches = list(ratio_map_pattern.finditer(s))
    if len(ratio_map_matches) != 1:
        raise PatchError(
            "Image2-only frame dropdown options: expected one ASPECT_RATIOS.map((ratio) => expression, "
            f"found {len(ratio_map_matches)}; no files were written"
        )
    start = ratio_map_matches[0].start()
    s = s[:start] + "IMAGE2_ASPECT_RATIOS" + s[start + len("ASPECT_RATIOS"):]
    s = replace_once(
        s,
        '''const [aspectRatio, setAspectRatio] = useState<AspectRatio>("4:3");''',
        '''const [aspectRatio, setAspectRatio] = useState<Image2AspectRatio>("4:3");''',
        "Image2-only aspect ratio state type",
    )
    s = replace_once(
        s,
        '''  feature?: string;\n}\n\ninterface ImageInput''',
        '''  feature?: string;\n  generationId?: string | null;\n  generationPrompt?: string | null;\n  generationAspectRatio?: string | null;\n  generationQuality?: string | null;\n  generationResolution?: string | null;\n  generationSelectedModel?: string | null;\n  generationModelUsed?: string | null;\n  generationCreatedAt?: string | null;\n}\n\ninterface ImageInput''',
        "workspace asset group fields",
    )
    s = replace_once(
        s,
        '''interface CreationFeedItem {\n  id: string;\n  url: string;\n  name: string;\n  kind: "generated" | "project";\n  assetId?: string;\n  createdAt?: string;\n  feature?: string;\n  isFavorite?: boolean;\n}\n\ninterface MentionState''',
        '''interface CreationFeedItem {\n  id: string;\n  url: string;\n  name: string;\n  kind: "generated" | "project";\n  assetId?: string;\n  createdAt?: string;\n  feature?: string;\n  isFavorite?: boolean;\n  generationId?: string | null;\n  generationPrompt?: string | null;\n  generationAspectRatio?: string | null;\n  generationQuality?: string | null;\n  generationResolution?: string | null;\n  generationSelectedModel?: string | null;\n  generationModelUsed?: string | null;\n  generationCreatedAt?: string | null;\n}\n\ninterface CreationFeedGroup {\n  id: string;\n  generationId: string | null;\n  items: CreationFeedItem[];\n}\n\ntype CreationFeedEntry =\n  | { kind: "group"; key: string; item: CreationFeedItem }\n  | { kind: "asset"; key: string; item: CreationFeedItem };\n\ninterface LastGenerationMeta {\n  prompt: string;\n  modelLabel: string;\n  aspectRatio: Image2AspectRatio;\n  quality: QualityTier;\n  resolution: Resolution;\n  createdAt: string;\n}\n\ninterface MentionState''',
        "creation feed group types",
    )
    s = replace_once(
        s,
        '''  const [result, setResult] = useState<ResultState>({ status: "idle" });\n  const [error, setError] = useState<string | null>(null);''',
        '''  const [result, setResult] = useState<ResultState>({ status: "idle" });\n  const [lastGenerationMeta, setLastGenerationMeta] = useState<LastGenerationMeta | null>(null);\n  const [error, setError] = useState<string | null>(null);''',
        "last generation snapshot state",
    )
    capabilities = '''  const compatibleConfiguredModels = useMemo(\n    () => modelOptions.filter(isCompatibleWithSelectedInputs),\n    [modelOptions, isCompatibleWithSelectedInputs],\n  );\n'''
    capabilities_replacement = capabilities + '''  // Show only settings genuinely exposed by the selected model. Auto uses the\n  // intersection across configured models that can handle the selected inputs.\n  const availableQualityTiers = useMemo(() => {\n    const capabilityModels = selectedModelOption ? [selectedModelOption] : compatibleConfiguredModels;\n    if (capabilityModels.length === 0) return [QUALITY_TIERS[0]];\n    const supportedIds = new Set(capabilityModels.flatMap((model) => model.tiers ?? ["standard"]));\n    const supported = QUALITY_TIERS.filter((tier) => supportedIds.has(tier.id));\n    return supported.length > 0 ? supported : [QUALITY_TIERS[0]];\n  }, [selectedModelOption, compatibleConfiguredModels]);\n  const availableResolutions = useMemo<Resolution[]>(() => {\n    const capabilityModels = selectedModelOption ? [selectedModelOption] : compatibleConfiguredModels;\n    if (capabilityModels.length === 0) return ["1K"];\n    return RESOLUTIONS.filter((value) =>\n      capabilityModels.every((model) => (model.resolutions ?? ["1K"]).includes(value)),\n    );\n  }, [selectedModelOption, compatibleConfiguredModels]);\n\n  useEffect(() => {\n    if (!availableQualityTiers.some((tier) => tier.id === quality)) {\n      setQuality(availableQualityTiers[0]?.id ?? "standard");\n    }\n  }, [availableQualityTiers, quality]);\n\n  useEffect(() => {\n    if (!availableResolutions.includes(resolution)) {\n      setResolution(availableResolutions[0] ?? "1K");\n    }\n  }, [availableResolutions, resolution]);\n'''
    s = replace_once(s, capabilities, capabilities_replacement, "model-specific output capabilities")
    s = replace_once(
        s,
        '''  const creationItems = useMemo<CreationFeedItem[]>(() => {\n    const outputItems: CreationFeedItem[] = selectedOutputUrls.map((url, index) => ({\n      id: `generated-${index}-${url.slice(-20)}`,\n      url,\n      name: `Generated image ${index + 1}`,\n      kind: "generated",\n      feature: "text_to_image",\n    }));\n    const outputUrls = new Set(selectedOutputUrls);\n    const projectItems: CreationFeedItem[] = assets\n      .filter((asset) => asset.type === "image" && !outputUrls.has(asset.url))\n      .map((asset) => ({\n        id: asset.id,\n        url: asset.url,\n        name: "Project image",\n        kind: asset.feature ? "generated" : "project",\n        assetId: asset.id,\n        createdAt: asset.createdAt,\n        feature: asset.feature,\n        isFavorite: asset.isFavorite,\n      }));\n    return [...outputItems, ...projectItems];\n  }, [selectedOutputUrls, assets]);''',
        '''  // Durable gallery content comes from /api/assets. The currently selected\n  // result is rendered in its dedicated "Just created" group above; keeping it\n  // out of this list prevents duplicate tiles and lets saved groups survive reloads.\n  const creationItems = useMemo<CreationFeedItem[]>(() => assets\n    .filter((asset) => asset.type === "image")\n    .map((asset) => ({\n      id: asset.id,\n      url: asset.url,\n      name: "Project image",\n      kind: asset.generationId || asset.feature ? "generated" : "project",\n      assetId: asset.id,\n      createdAt: asset.createdAt,\n      feature: asset.feature,\n      isFavorite: asset.isFavorite,\n      generationId: asset.generationId ?? null,\n      generationPrompt: asset.generationPrompt ?? null,\n      generationAspectRatio: asset.generationAspectRatio ?? null,\n      generationQuality: asset.generationQuality ?? null,\n      generationResolution: asset.generationResolution ?? null,\n      generationSelectedModel: asset.generationSelectedModel ?? null,\n      generationModelUsed: asset.generationModelUsed ?? null,\n      generationCreatedAt: asset.generationCreatedAt ?? null,\n    })),\n  [assets]);''',
        "durable creation feed mapping",
    )
    filtered_marker = '''  }, [creationItems, feedSearch, feedFilter]);\n'''
    grouping = filtered_marker + '''\n  const creationGroups = useMemo<CreationFeedGroup[]>(() => {\n    const groups: CreationFeedGroup[] = [];\n    const byKey = new Map<string, CreationFeedGroup>();\n    for (const item of filteredCreationItems) {\n      const key = item.generationId ? `generation:${item.generationId}` : `asset:${item.id}`;\n      let group = byKey.get(key);\n      if (!group) {\n        group = { id: key, generationId: item.generationId ?? null, items: [] };\n        byKey.set(key, group);\n        groups.push(group);\n      }\n      group.items.push(item);\n    }\n    return groups;\n  }, [filteredCreationItems]);\n\n  const creationFeedEntries = useMemo<CreationFeedEntry[]>(() => {\n    const entries: CreationFeedEntry[] = [];\n    for (const group of creationGroups) {\n      if (group.generationId && group.items[0]) {\n        entries.push({ kind: "group", key: `group:${group.id}`, item: group.items[0] });\n      }\n      for (const item of group.items) {\n        entries.push({ kind: "asset", key: `asset:${item.id}`, item });\n      }\n    }\n    return entries;\n  }, [creationGroups]);\n'''
    s = replace_once(s, filtered_marker, grouping, "durable generation grouping")
    s = replace_once(
        s,
        '''    setError(null);\n    setResult({ status: "busy" });\n    const form = new FormData();''',
        '''    setError(null);\n    setLastGenerationMeta({\n      prompt: prompt.trim(),\n      modelLabel: selectedModelOption?.name ?? (resolvedAutoModel ? `Auto · ${resolvedAutoModel.name}` : "Auto"),\n      aspectRatio,\n      quality,\n      resolution,\n      createdAt: new Date().toISOString(),\n    });\n    setResult({ status: "busy" });\n    const form = new FormData();''',
        "snapshot submitted generation metadata",
    )
    # Include the values used in the snapshot callback dependencies.
    s = replace_once(
        s,
        '''  }, [prompt, isBusy, selectedModelOption, references, styleReference, imageInputCount, quality, aspectRatio, resolution, quantity, selectedProjectId, selectedModel, balance, stopAndPollJob]);''',
        '''  }, [prompt, isBusy, selectedModelOption, resolvedAutoModel, references, styleReference, imageInputCount, quality, aspectRatio, resolution, quantity, selectedProjectId, selectedModel, balance, stopAndPollJob]);''',
        "snapshot callback dependencies",
    )
    s = replace_once(
        s,
        '''<span className="max-w-full flex-1 truncate text-[#c5c6ce]" title={prompt}>{prompt || "Image creation"}</span><span className="rounded bg-[#1d1e23] px-1.5 py-1">{aspectRatio}</span><span className="rounded bg-[#1d1e23] px-1.5 py-1">{selectedModelOption?.name ?? "Auto"}</span><span className="ml-auto">Just created</span>''',
        '''<span className="max-w-full flex-1 truncate text-[#c5c6ce]" title={lastGenerationMeta?.prompt ?? prompt}>{(lastGenerationMeta?.prompt ?? prompt) || "Image creation"}</span><span className="rounded bg-[#1d1e23] px-1.5 py-1">{(lastGenerationMeta?.aspectRatio ?? aspectRatio) === "auto" ? "AUTO" : (lastGenerationMeta?.aspectRatio ?? aspectRatio)}</span><span className="rounded bg-[#1d1e23] px-1.5 py-1">{lastGenerationMeta?.quality ?? quality}</span><span className="rounded bg-[#1d1e23] px-1.5 py-1">{lastGenerationMeta?.resolution ?? resolution}</span><span className="rounded bg-[#1d1e23] px-1.5 py-1">{lastGenerationMeta?.modelLabel ?? selectedModelOption?.name ?? "Auto"}</span><span className="ml-auto">Just created</span>''',
        "latest generation metadata snapshot display",
    )
    s = replace_once(
        s,
        '''<Sparkles className="mr-1 inline h-2.5 w-2.5" />{resolution}''',
        '''<Sparkles className="mr-1 inline h-2.5 w-2.5" />{lastGenerationMeta?.resolution ?? resolution}''',
        "latest result resolution label",
    )
    s = replace_once(
        s,
        '''onClick={() => setAspectPickerOpen((open) => !open)} aria-expanded={aspectPickerOpen} className="flex h-8 w-full items-center justify-center gap-1 rounded-lg bg-[#17181c] px-1.5 text-[10px] hover:bg-[#2b2c31]">{aspectRatio}<ChevronDown''',
        '''onClick={() => setAspectPickerOpen((open) => !open)} aria-expanded={aspectPickerOpen} className="flex h-8 w-full items-center justify-center gap-1 rounded-lg bg-[#17181c] px-1.5 text-[10px] hover:bg-[#2b2c31]">{aspectRatio === "auto" ? "AUTO" : aspectRatio}<ChevronDown''',
        "frame selector AUTO label",
    )
    s = replace_once(
        s,
        '''<span>{ratio} <span className="ml-1 text-[#858893]">{RATIO_DESCRIPTIONS[ratio]}</span></span>''',
        '''<span>{ratio === "auto" ? "AUTO" : ratio} <span className="ml-1 text-[#858893]">{RATIO_DESCRIPTIONS[ratio]}</span></span>''',
        "frame dropdown AUTO label",
    )
    s = replace_once(
        s,
        '''{RESOLUTIONS.map((value) => <option key={value} value={value} className="bg-[#222328]">{value}</option>)}''',
        '''{RESOLUTIONS.map((value) => <option key={value} value={value} disabled={!availableResolutions.includes(value)} title={availableResolutions.includes(value) ? undefined : "This model does not expose this resolution"} className="bg-[#222328]">{value}{availableResolutions.includes(value) ? "" : " · unsupported"}</option>)}''',
        "model-aware resolution options",
    )
    s = replace_once(
        s,
        '''{QUALITY_TIERS.map((tier) => <option key={tier.id} value={tier.id} className="bg-[#222328]">{tier.label}</option>)}''',
        '''{QUALITY_TIERS.map((tier) => <option key={tier.id} value={tier.id} disabled={!availableQualityTiers.some((supported) => supported.id === tier.id)} title={availableQualityTiers.some((supported) => supported.id === tier.id) ? undefined : "This model does not expose this quality tier"} className="bg-[#222328]">{tier.label}{availableQualityTiers.some((supported) => supported.id === tier.id) ? "" : " · unsupported"}</option>)}''',
        "model-aware quality options",
    )
    # Replace the grid callback opener/closer with group headings while retaining each image card.
    s = replace_once(
        s,
        '''              {filteredCreationItems.map((item) => <article key={item.id} className="group/feed-item relative min-w-0 overflow-hidden rounded-xl bg-[#292a30]">''',
        '''              {creationFeedEntries.map((entry) => {\n                if (entry.kind === "group") {\n                  const groupItem = entry.item;\n                  const actualModel = modelOptions.find((model) => model.key === groupItem.generationModelUsed)?.name;\n                  const selectedModelName = modelOptions.find((model) => model.key === groupItem.generationSelectedModel)?.name;\n                  const dateValue = groupItem.generationCreatedAt ?? groupItem.createdAt;\n                  return <div key={entry.key} className="col-span-full flex min-w-0 flex-wrap items-start justify-between gap-2 border-b border-white/[0.08] pb-2 pt-1">\n                    <div className="min-w-0 flex-1">\n                      <p className="text-[10px] font-semibold text-[#d8d8e2]">Generation{dateValue ? ` · ${new Date(dateValue).toLocaleString()}` : ""}</p>\n                      <p className="mt-1 line-clamp-2 break-words text-[10px] leading-4 text-[#8f929d]" title={groupItem.generationPrompt ?? "Image creation"}>{groupItem.generationPrompt || "Image creation"}</p>\n                    </div>\n                    <div className="flex flex-wrap gap-1.5">\n                      <span className="rounded bg-[#17181c] px-1.5 py-1 text-[9px] text-[#bfc0ca]">{groupItem.generationAspectRatio === "auto" ? "AUTO" : groupItem.generationAspectRatio ?? "Frame n/a"}</span>\n                      {groupItem.generationQuality && <span className="rounded bg-[#17181c] px-1.5 py-1 text-[9px] text-[#bfc0ca]">{groupItem.generationQuality}</span>}\n                      {groupItem.generationResolution && <span className="rounded bg-[#17181c] px-1.5 py-1 text-[9px] text-[#bfc0ca]">{groupItem.generationResolution}</span>}\n                      <span className="rounded bg-[#17181c] px-1.5 py-1 text-[9px] text-[#bfc0ca]">{selectedModelName ?? (groupItem.generationSelectedModel ? groupItem.generationSelectedModel : actualModel ? `Auto · ${actualModel}` : "Auto")}</span>\n                    </div>\n                  </div>;\n                }\n                const item = entry.item;\n                return <article key={item.id} className="group/feed-item relative min-w-0 overflow-hidden rounded-xl bg-[#292a30]">''',
        "persisted Preview group heading",
    )
    s = replace_once(
        s,
        '''              </article>)}\n            </div> : !isBusy && <div className="flex min-h-[min(54vh,520px)] flex-col items-center justify-center px-5 py-12 text-center">''',
        '''              </article>; })}\n            </div> : !isBusy && <div className="flex min-h-[min(54vh,520px)] flex-col items-center justify-center px-5 py-12 text-center">''',
        "persisted Preview grouped map close",
    )
    return s


PATCHES: dict[str, Callable[[str], str]] = {
    "web/app/api/generate/route.ts": patch_generate_route,
    "web/lib/db/queries.ts": patch_db_queries,
    "web/app/api/assets/route.ts": patch_assets_route,
    "worker/catalog.py": patch_catalog,
    "worker/providers/google.py": patch_google_provider,
    "worker/workflows/image_render.py": patch_image_render,
    "worker/requirements.txt": patch_requirements,
    "web/components/studio/image2-workspace.tsx": patch_workspace,
}


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--repo", default=".", help="Path to the local repository root")
    parser.add_argument("--check", action="store_true", help="Validate patch anchors without writing")
    args = parser.parse_args()

    root = Path(args.repo).expanduser().resolve()
    if not root.is_dir():
        print(f"ERROR: repository folder not found: {root}", file=sys.stderr)
        return 2

    staged: dict[Path, str] = {}
    errors: list[str] = []
    for relative, patch in PATCHES.items():
        path = root / relative
        if not path.is_file():
            errors.append(f"Missing required file: {relative}")
            continue
        try:
            original = path.read_text(encoding="utf-8")
            staged[path] = patch(original)
        except (OSError, UnicodeError, PatchError) as exc:
            errors.append(f"{relative}: {exc}")

    if errors:
        print("PRE-FLIGHT FAILED. No repository files were changed.\n", file=sys.stderr)
        for error in errors:
            print(f" - {error}", file=sys.stderr)
        print("\nThis patch expects the branch layout described in the task. Check out the matching branch or inspect the changed files before retrying.", file=sys.stderr)
        return 1

    changed = [path for path, updated in staged.items() if path.read_text(encoding="utf-8") != updated]
    print(f"Repository: {root}")
    print(f"Validated {len(staged)} source files; {len(changed)} file(s) would change.")
    if args.check:
        for path in changed:
            print(f" CHECK OK: {path.relative_to(root)}")
        print("Check-only mode: no files were written.")
        return 0

    backups: list[tuple[Path, Path]] = []
    try:
        # Back up every target before replacing any target.
        for path in changed:
            backup = path.with_name(path.name + ".before-image2-frame-preview-fix.bak")
            if backup.exists():
                backup = path.with_name(path.name + ".before-image2-frame-preview-fix.bak.2")
            shutil.copy2(path, backup)
            backups.append((path, backup))
        for path in changed:
            updated = staged[path]
            fd, temp_name = tempfile.mkstemp(prefix=path.name + ".", suffix=".tmp", dir=str(path.parent))
            try:
                with os.fdopen(fd, "w", encoding="utf-8", newline="") as handle:
                    handle.write(updated)
                shutil.copystat(path, temp_name)
                os.replace(temp_name, path)
            finally:
                if os.path.exists(temp_name):
                    os.unlink(temp_name)
    except Exception as exc:  # best-effort rollback on local write errors
        for path, backup in reversed(backups):
            try:
                shutil.copy2(backup, path)
            except OSError:
                pass
        print(f"ERROR while writing files: {exc}\nA rollback was attempted. Inspect the backup files before retrying.", file=sys.stderr)
        return 3

    for path, backup in backups:
        print(f"UPDATED: {path.relative_to(root)}")
        print(f" BACKUP: {backup.relative_to(root)}")
    print("\nPatch applied locally. No GitHub operations or commits were performed.")
    print("\nNext: install worker dependencies and run checks:")
    print("  python -m pip install -r .\\worker\\requirements.txt")
    print("  python -m compileall .\\worker")
    print("  cd .\\web; npm run build")
    print("  cd ..\\worker; python -m pytest")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
