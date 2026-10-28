#!/usr/bin/env python3
"""Guarded local patch for Image2 reference fidelity + native resolution support.

Default mode is read-only and prints a file/change summary. --diff prints unified
source diffs. --apply creates backups before writing. It never talks to GitHub.
Base source reference: axac1823-art/mk-studio-ai- @ a5909b75c2ba0507463f20efb174bbcd02a47d9.
"""
from __future__ import annotations

import argparse
import difflib
import subprocess
import sys
from pathlib import Path

BASE_COMMIT = "a5909b75c2ba0507463f20efb174bbcd02a47d9"
BACKUP_SUFFIX = ".pre-image2-complete.bak"

class PatchMismatch(RuntimeError):
    pass


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise PatchMismatch(f"{label}: expected one exact source match, found {count}")
    return text.replace(old, new, 1)


def replace_function(text: str, start: str, end: str, new_function: str, label: str) -> str:
    if text.count(start) != 1:
        raise PatchMismatch(f"{label}: function start anchor is missing or ambiguous")
    start_i = text.index(start)
    end_i = text.find(end, start_i + len(start))
    if end_i < 0 or text.find(start, start_i + len(start)) >= 0:
        raise PatchMismatch(f"{label}: function end anchor is missing or ambiguous")
    return text[:start_i] + new_function.rstrip() + "\n\n" + text[end_i:]


def candidate_block(text: str, key: str) -> tuple[int, int, str]:
    marker = f'        "{key}",'
    found = [i for i in range(len(text)) if text.startswith(marker, i)]
    if not found:
        raise PatchMismatch(f"catalog candidate {key}: key not found")
    # A model id can equal the key. Use the occurrence whose nearest Candidate( block
    # begins a top-level catalog entry, and whose closing `    ),` occurs before the next one.
    starts = []
    for pos in found:
        cstart = text.rfind("    Candidate(", 0, pos)
        close = text.find("\n    ),", pos)
        next_candidate = text.find("\n    Candidate(", pos)
        if cstart >= 0 and close >= 0 and (next_candidate < 0 or close < next_candidate):
            starts.append((cstart, close + len("\n    ),")))
    if not starts:
        raise PatchMismatch(f"catalog candidate {key}: cannot isolate candidate block")
    # Prefer the last matching block when key/model_id are duplicated; key is at the block start
    # in this catalog, while the provider model_id occurs later inside the same block.
    start, end = starts[0]
    return start, end, text[start:end]


def update_candidate(text: str, key: str, transform, label: str) -> str:
    start, end, block = candidate_block(text, key)
    changed = transform(block)
    if changed == block:
        raise PatchMismatch(f"{label}: candidate block was not changed")
    return text[:start] + changed + text[end:]


def edits(root: Path) -> dict[str, str]:
    targets = [
        "worker/frame_ratio.py",
        "worker/catalog.py",
        "worker/prompts.py",
        "worker/providers/openai.py",
        "worker/providers/google.py",
        "worker/providers/magichour.py",
        "worker/workflows/image_render.py",
        "web/app/api/generate/route.ts",
        "web/components/studio/image2-workspace.tsx",
        "worker/tests/test_frame_ratio.py",
        "worker/tests/test_image2_multi_reference.py",
    ]
    originals: dict[str, str] = {}
    normalized: dict[str, str] = {}
    crlf: dict[str, bool] = {}
    for rel in targets:
        path = root / rel
        if not path.is_file():
            raise PatchMismatch(f"Required project file is missing: {rel}")
        raw = path.read_bytes()
        try:
            source = raw.decode("utf-8")
        except UnicodeDecodeError as exc:
            raise PatchMismatch(f"{rel} is not UTF-8 text") from exc
        has_crlf = b"\r\n" in raw
        if has_crlf and b"\n" in raw.replace(b"\r\n", b""):
            raise PatchMismatch(f"{rel} has mixed line endings; normalize it before applying")
        originals[rel] = source
        normalized[rel] = source.replace("\r\n", "\n")
        crlf[rel] = has_crlf

    data = dict(normalized)

    def sub(rel: str, old: str, new: str, label: str) -> None:
        data[rel] = replace_once(data[rel], old, new, f"{rel}: {label}")

    # ------------------------------------------------------------------
    # frame_ratio.py: true provider/frame/resolution capability matrix.
    # ------------------------------------------------------------------
    frame_insert = '''
# Native output sizes verified against the providers' image-generation APIs.
# GPT Image 2.5 accepts arbitrary W×H sizes when each side is divisible by 16;
# sizes beyond 2560×1440 are experimental and the documented maximum is 3840×2160.
GPT_IMAGE_SIZES_BY_RESOLUTION: dict[str, dict[str, str]] = {
    "1K": {
        "auto": "auto", "1:1": "1024x1024", "16:9": "1536x864",
        "9:16": "864x1536", "4:3": "1200x896", "3:4": "896x1200",
        "3:2": "1264x848", "2:3": "848x1264", "21:9": "1584x672",
    },
    "2K": {
        "1:1": "2048x2048", "16:9": "2560x1440", "9:16": "1440x2560",
        "4:3": "2400x1792", "3:4": "1792x2400", "3:2": "2528x1696",
        "2:3": "1696x2528", "21:9": "2048x880",
    },
    "4K": {
        # Conservative 4K advertisement: only frames with a 3840px long edge.
        # Keep other ratios at 2K until provider A/B confirms a better native profile.
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
GEMINI_RESOLUTION_RATIOS: dict[str, tuple[str, ...]] = {
    "auto": ("1K", "2K", "4K"),
    **{frame: ("1K", "2K", "4K") for frame in ALL_FRAMES},
}


def gpt_image_size(ratio: str | None, resolution: str | None) -> str:
    """Resolve user ratio/resolution to a concrete documented OpenAI image size."""
    frame = ratio or "auto"
    tier = resolution or "1K"
    try:
        return GPT_IMAGE_SIZES_BY_RESOLUTION[tier][frame]
    except KeyError:
        supported = tuple(
            res for res, sizes in GPT_IMAGE_SIZES_BY_RESOLUTION.items() if frame in sizes
        )
        raise ValueError(
            f"GPT Image 2.5 Sunburst does not support {tier} for {frame}. "
            f"Supported resolutions for this frame: {', '.join(supported) or 'none'}."
        ) from None


def filter_by_resolution(
    candidates: list,
    requested_frame: str | None,
    requested_resolution: str | None,
    selected_model: str | None,
) -> list:
    """Filter candidates by the exact frame/resolution combination they advertise."""
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
            raise ValueError("The selected model is not compatible with the current Image2 inputs.")
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
            f"No configured model supports {resolution} for {frame}. "
            f"Available resolutions: {', '.join(available) or 'none'}."
        )
    return capable


def check_delivered_resolution(width: int, height: int, requested: str | None) -> bool:
    """Reject obvious silent resolution downgrades without resizing/cropping output."""
    minimum_edge = {"1K": 900, "2K": 2000, "4K": 3600}.get(requested or "1K")
    if minimum_edge is None:
        return True
    actual_edge = max(width, height)
    ok = actual_edge >= minimum_edge
    if not ok:
        logger.warning(
            "Image2 resolution mismatch: requested %s, provider returned %dx%d",
            requested, width, height,
        )
    return ok
'''
    sub("worker/frame_ratio.py",
        "# Magic Hour Flux 2 Klein native frame options documented for generation.\n",
        frame_insert + "\n# Magic Hour Flux 2 Klein native frame options documented for generation.\n",
        "add provider resolution matrix")

    # ------------------------------------------------------------------
    # catalog.py: capability metadata and adapter payloads.
    # ------------------------------------------------------------------
    sub("worker/catalog.py",
        "from frame_ratio import ALL_FRAMES, BFL_DIMENSIONS, GPT_IMAGE_1_SIZES, MAGICHOUR_FRAMES, exact_size",
        "from frame_ratio import (\n    ALL_FRAMES, BFL_DIMENSIONS, GPT_IMAGE_1_SIZES, GPT_IMAGE_RESOLUTION_RATIOS,\n    GEMINI_RESOLUTION_RATIOS, MAGICHOUR_FRAMES, exact_size, gpt_image_size,\n)",
        "import native size helpers")
    old_caps = '''    # Current text-to-image adapters expose approximately 1K output only.
    # Do not advertise 2K/4K until an adapter really requests those sizes.
    resolutions: tuple[str, ...] = ("1K",)
    # Only frames confirmed for this exact model/adapter; empty means unknown.
    frame_ratios: tuple[str, ...] = ()
'''
    new_caps = '''    # Advertise only resolutions actually passed to this provider's API adapter.
    resolutions: tuple[str, ...] = ("1K",)
    # Only frames confirmed for this exact model/adapter; empty means unknown.
    frame_ratios: tuple[str, ...] = ()
    # Map each frame to the resolution tiers this exact model/adapter accepts.
    resolution_ratios: tuple[tuple[str, tuple[str, ...]], ...] = ()
    # True only if the adapter sends source images to a true edit-capable model/API.
    supports_identity_edit: bool = False
'''
    sub("worker/catalog.py", old_caps, new_caps, "add resolution and identity capabilities")
    sub("worker/catalog.py",
        '            "frameRatios": c.frame_ratios,\n',
        '            "frameRatios": c.frame_ratios,\n            "resolutionRatios": dict(c.resolution_ratios),\n            "supportsIdentityEdit": c.supports_identity_edit,\n',
        "expose model capabilities to frontend")

    old_openai = '''def openai_text_to_image_input(req: dict) -> dict:
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
    new_openai = '''def openai_text_to_image_input(req: dict) -> dict:
    """OpenAI GPT Image 2.5 edit input with native size and high source fidelity."""
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
        # Preserve the old high-quality look in Standard; Pro opts into xhigh.
        "quality": "xhigh" if req.get("quality") == "pro" else "high",
        # PNG avoids adding a lossy JPEG encoding step to detailed product/archviz edges.
        "output_format": "png",
        "quantity": req["quantity"],
    }
'''
    sub("worker/catalog.py", old_openai, new_openai, "wire OpenAI size/quality/output format")

    old_google = '''def google_text_to_image_input(req: dict) -> dict:
    images = text_to_image_images(req)

    payload = {
        "prompt": req["prompt"],
        "images": images,
        "require_images": bool(
            req.get("imageUrl")
            or req.get("styleReferenceUrl")
            or req.get("referenceUrls")
        ),
        "quantity": req["quantity"],
    }

    if req.get("aspectRatio") not in (None, "auto"):
        payload["aspectRatio"] = req["aspectRatio"]

    return payload
'''
    new_google = '''def google_text_to_image_input(req: dict) -> dict:
    images = text_to_image_images(req)

    payload = {
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

    if req.get("aspectRatio") not in (None, "auto"):
        payload["aspectRatio"] = req["aspectRatio"]

    return payload
'''
    sub("worker/catalog.py", old_google, new_google, "pass selected resolution to Gemini")
    sub("worker/catalog.py",
        '''    return {
        "prompt": req["prompt"],
        "images": text_to_image_images(req),
        "aspectRatio": ratio,
        "resolution": "auto",
        "quantity": req["quantity"],
        "is_text_to_image": True,
    }
''',
        '''    resolution = str(req.get("resolution") or "1K")
    if resolution != "1K":
        raise ValueError("Magic Hour Flux 2 Klein exposes only the 1K tier in this adapter.")
    return {
        "prompt": req["prompt"],
        "images": text_to_image_images(req),
        "aspectRatio": ratio,
        "resolution": "1k",
        "quantity": req["quantity"],
        "is_text_to_image": True,
    }
''',
        "request native 1K resolution from Magic Hour")

    def add_candidate_metadata(key: str, additions: str, replace_old: tuple[str, str] | None = None) -> None:
        def transform(block: str) -> str:
            if replace_old:
                block = replace_once(block, replace_old[0], replace_old[1], f"{key} frame capabilities")
            if "resolution_ratios=" in block or "supports_identity_edit=True" in block:
                raise PatchMismatch(f"{key}: capability metadata already appears present")
            marker = "        extract_image_urls,\n"
            if block.count(marker) != 1:
                raise PatchMismatch(f"{key}: expected one extract_image_urls marker")
            return block.replace(marker, marker + additions, 1)
        data["worker/catalog.py"] = update_candidate(data["worker/catalog.py"], key, transform, f"add {key} capabilities")

    add_candidate_metadata(
        "flux-pro",
        '        resolutions=("1K",),\n        frame_ratios=ALL_FRAMES,\n        resolution_ratios=tuple((ratio, ("1K",)) for ratio in ALL_FRAMES),\n',
    )
    add_candidate_metadata(
        "flux-dev",
        '        resolutions=("1K",),\n        frame_ratios=ALL_FRAMES,\n        resolution_ratios=tuple((ratio, ("1K",)) for ratio in ALL_FRAMES),\n',
    )
    add_candidate_metadata(
        "gpt-image-1.5",
        '        supports_identity_edit=True,\n        resolutions=("1K", "2K", "4K"),\n        resolution_ratios=tuple(GPT_IMAGE_RESOLUTION_RATIOS.items()),\n',
        ('        frame_ratios=("auto", "1:1", "3:2", "2:3"),\n', '        frame_ratios=("auto", *ALL_FRAMES),\n'),
    )
    # GPT Image 2.5 can serve Standard at high quality as well as Pro at xhigh.
    data["worker/catalog.py"] = update_candidate(
        data["worker/catalog.py"], "gpt-image-1.5",
        lambda block: replace_once(block, '        ("pro",),\n', '        ("standard", "pro"),\n', "OpenAI quality tiers"),
        "enable OpenAI Standard/Pro tiers",
    )
    add_candidate_metadata(
        "gemini-2.5-flash",
        '        supports_identity_edit=True,\n        resolutions=("1K", "2K", "4K"),\n        resolution_ratios=tuple(GEMINI_RESOLUTION_RATIOS.items()),\n',
        ('        frame_ratios=("auto", *ALL_FRAMES),\n', '        frame_ratios=("auto", *ALL_FRAMES),\n'),
    )
    add_candidate_metadata(
        "magichour-flux-2-klein-text",
        '        resolutions=("1K",),\n        resolution_ratios=tuple((ratio, ("1K",)) for ratio in MAGICHOUR_FRAMES),\n',
        ('        frame_ratios=MAGICHOUR_FRAMES,\n', '        frame_ratios=MAGICHOUR_FRAMES,\n'),
    )
    data["worker/catalog.py"] = update_candidate(
        data["worker/catalog.py"], "magichour-flux-2-klein-text",
        lambda block: replace_once(block, '        ("standard", "pro"),\n', '        ("standard",),\n', "Magic Hour quality tier"),
        "limit Magic Hour to its declared quality tier",
    )

    # ------------------------------------------------------------------
    # providers: use correct output MIME and Gemini image_size parameter.
    # ------------------------------------------------------------------
    sub("worker/providers/openai.py",
        '        files.append(("image[]", (f"image.{ext}", base64.b64decode(data), mime)))\n\n    # PAS de Content-Type manuel : httpx pose le boundary multipart lui-même.',
        '        files.append(("image[]", (f"image.{ext}", base64.b64decode(data), mime)))\n\n    output_format = str(input_.get("output_format") or "jpeg")\n    if output_format not in {"png", "jpeg", "webp"}:\n        raise ProviderError(f"openai: unsupported image output format {output_format!r}")\n\n    # PAS de Content-Type manuel : httpx pose le boundary multipart lui-même.',
        "validate OpenAI output format")
    sub("worker/providers/openai.py",
        '            "output_format": "jpeg",\n            **(\n                {"input_fidelity": "high"}',
        '            "output_format": output_format,\n            **(\n                {"input_fidelity": "high"}',
        "send PNG format to OpenAI edit endpoint")
    sub("worker/providers/openai.py",
        '    return f"data:image/jpeg;base64,{b64}"\n',
        '    mime_type = {"png": "image/png", "jpeg": "image/jpeg", "webp": "image/webp"}[output_format]\n    return f"data:{mime_type};base64,{b64}"\n',
        "return correct output MIME")
    sub("worker/providers/google.py",
        '    if aspect_ratio in supported_ratios:\n        response_format["aspect_ratio"] = aspect_ratio\n\n    response = post_json(\n',
        '    if aspect_ratio in supported_ratios:\n        response_format["aspect_ratio"] = aspect_ratio\n    image_size = input_.get("resolution")\n    if image_size in {"1K", "2K", "4K"}:\n        response_format["image_size"] = image_size\n\n    response = post_json(\n',
        "pass image_size to Gemini Interactions API")
    sub("worker/providers/magichour.py",
        '        "name": "renderstudio-image",\n        "model": model_id,\n        "image_count": 1,\n        "aspect_ratio": str(input_.get("aspectRatio") or "auto"),\n        "resolution": "auto",\n        "style": {"prompt": str(input_.get("prompt") or "")},\n',
        '        "name": "renderstudio-image",\n        "model": model_id,\n        "image_count": 1,\n        "aspect_ratio": str(input_.get("aspectRatio") or "auto"),\n        "resolution": str(input_.get("resolution") or "auto"),\n        "style": {"prompt": str(input_.get("prompt") or "")},\n',
        "pass validated resolution to Magic Hour image generator")

    # ------------------------------------------------------------------
    # prompts.py: replace the reference map with explicit, user-controlled roles.
    # ------------------------------------------------------------------
    new_reference_map = r'''def add_image_reference_map(prompt: str, fields: dict) -> str:
    """Map every uploaded image to its provider position and explicit user role."""
    references = fields.get("referenceUrls") or []
    if not isinstance(references, (list, tuple)):
        references = []
    raw_tags = fields.get("referenceTags") or []
    if not isinstance(raw_tags, (list, tuple)):
        raw_tags = []
    raw_roles = fields.get("referenceRoles") or []
    if not isinstance(raw_roles, (list, tuple)):
        raw_roles = []

    valid_roles = {"element", "base", "style", "detail"}
    tags: list[str] = []
    roles: list[str] = []
    used_tags: set[str] = set()
    for index in range(len(references)):
        tag = raw_tags[index] if index < len(raw_tags) else None
        if not isinstance(tag, str) or not tag.startswith("@img") or tag in used_tags:
            tag = f"@img{index + 1}"
            suffix = index + 1
            while tag in used_tags:
                suffix += 1
                tag = f"@img{suffix}"
        tags.append(tag)
        used_tags.add(tag)
        role = raw_roles[index] if index < len(raw_roles) else "element"
        roles.append(role if isinstance(role, str) and role in valid_roles else "element")

    has_style_image = bool(fields.get("styleReferenceUrl")) or "style" in roles
    has_primary_element = (
        fields.get("feature") == "text_to_image" and bool(fields.get("imageUrl"))
    )
    if not references and not has_style_image and not has_primary_element:
        return prompt

    manifest: list[str] = [
        "ATTACHED IMAGE MAP (provider image order; user-declared roles are authoritative):"
    ]
    provider_index = 1
    if fields.get("styleReferenceUrl"):
        manifest.append(
            "Input image 1 is @style, a style-only reference. Match its lighting, tonal range, "
            "contrast, palette, color temperature, material response, texture, grain and rendering "
            "finish. Do not copy its subject or composition unless the user explicitly requests that."
        )
        provider_index += 1
    if has_primary_element:
        manifest.append(
            f"Input image {provider_index} is @element, the primary identity source. It is the actual "
            "object to preserve, not inspiration for a lookalike. Keep its recognizable silhouette, "
            "proportions, distinctive components, color/material identity, texture, labels and logos."
        )
        provider_index += 1

    role_text = {
        "element": (
            "OBJECT TO INSERT/PRESERVE: use this actual object as the source; preserve its defining "
            "silhouette, proportions, colors, materials, texture and distinctive details. Do not replace it."
        ),
        "base": (
            "BASE SCENE/BACKGROUND: use this image as the destination canvas. Preserve its viewpoint, "
            "framing, architecture and unrelated areas; only make the changes requested by the user."
        ),
        "style": (
            "STYLE ONLY: transfer lighting, tonal range, contrast, palette, color temperature, texture "
            "and rendering finish. Do not copy this image's objects or composition unless requested."
        ),
        "detail": (
            "DETAIL/CONTEXT REFERENCE: use the details explicitly mentioned by the user; do not blindly "
            "copy this image's background or unrelated objects into the destination scene."
        ),
    }
    for index, (tag, role) in enumerate(zip(tags, roles)):
        manifest.append(
            f"{tag} is content/reference image {index + 1} (provider input image {provider_index + index}); "
            f"user-declared role: {role}. {role_text[role]}"
        )

    guidance: list[str] = []
    if fields.get("feature") == "text_to_image":
        guidance.append(
            "IMAGE EDIT / COMPOSITING TASK: source images are actual visual inputs, not optional inspiration. "
            "Use the declared role of each image and the exact @img tag referenced in the user's description. "
            "Do not silently ignore any attachment, including the third and later images."
        )
        if has_primary_element or "element" in roles:
            guidance.append(
                "ELEMENT IDENTITY: the user's element image is the same object that must appear in the result. "
                "Do not substitute a generic object of the same category, redesign it, merge it with another object, "
                "or invent distinctive details. Adapt only the position, scale, projected geometry, perspective, "
                "lighting, reflections, occlusion and contact/cast shadows needed for the described camera and scene."
            )
        if "base" in roles:
            guidance.append(
                "BASE IMAGE PRESERVATION: keep the designated base scene and all unrequested areas stable. "
                "Do not replace its background with a newly invented scene. Do not import the unrelated backgrounds "
                "from element images."
            )
        if has_style_image:
            guidance.append(
                "HISTORICAL IMAGE2 LIGHTING DISCIPLINE: match the style reference's luminance, exposure, highlight "
                "roll-off, shadow depth, contrast curve, saturation, palette, color temperature, material response, "
                "grain, edge treatment and rendering medium. Do not brighten, warm, whiten, raise exposure, soften "
                "shadows, add gloss or apply generic bright architectural daylight unless those traits appear in the "
                "style reference or are explicitly requested. A dark, muted, cool, matte, grainy, painterly, graphic, "
                "cinematic or high-contrast reference must retain that character."
            )
        guidance.append(
            "LIGHTING/GEOMETRY BALANCE: adapt lighting and projected geometry only as far as needed to fit the "
            "requested camera/viewpoint; these adaptations must not change the object's identity. A single 2D image "
            "does not reveal hidden surfaces, so infer unseen geometry conservatively. Preserve the original object's "
            "visible features rather than inventing a 3D redesign."
        )
    return prompt + "\n\n" + "\n".join(manifest + guidance)
'''
    data["worker/prompts.py"] = replace_function(
        data["worker/prompts.py"],
        "def add_image_reference_map(prompt: str, fields: dict) -> str:",
        "def build_print_render_prompt(",
        new_reference_map,
        "replace Image2 attachment map with role-aware map",
    )

    # Modify text-only task wording when actual image references are attached.
    sub("worker/prompts.py",
        '    preserve_element_identity=False,\n) -> str:\n    """Build a sectioned, subject-first prompt that keeps user requirements salient."""\n    user_description = _sanitize_scene_details(scene_details)\n',
        '    preserve_element_identity=False,\n    has_reference_images=False,\n) -> str:\n    """Build a sectioned Image2 prompt for text generation or source-image editing."""\n    user_description = _sanitize_scene_details(scene_details)\n',
        "allow prompt to distinguish edit vs text-only")
    sub("worker/prompts.py",
        '            "TASK: Generate one coherent image of the scene requested by the user. "\n            "The user\'s scene specification below is the source of truth for the subject and its contents."\n',
        '            (\n                "TASK: Edit/composite the supplied source images into the scene requested by the user. "\n                "Use image roles and preserve every object identity specified by the user. "\n                "The description below is authoritative for placement and scene contents."\n            ) if has_reference_images else (\n                "TASK: Generate one coherent image of the scene requested by the user. "\n                "The user\'s scene specification below is the source of truth for the subject and its contents."\n            )\n',
        "make image edit task explicit for attached sources")
    sub("worker/prompts.py",
        '            has_style_reference=bool(fields.get("styleReferenceUrl")),\n            style_filters=fields.get("styleFilters"),\n            aspect_ratio=fields.get("aspectRatio"),\n            preserve_element_identity=bool(\n                fields.get("preserveElementIdentity")\n            ),\n',
        '            has_style_reference=bool(fields.get("styleReferenceUrl")) or "style" in (fields.get("referenceRoles") or []),\n            style_filters=fields.get("styleFilters"),\n            aspect_ratio=fields.get("aspectRatio"),\n            preserve_element_identity=bool(fields.get("preserveElementIdentity")),\n            has_reference_images=bool(\n                fields.get("imageUrl") or fields.get("styleReferenceUrl") or fields.get("referenceUrls")\n            ),\n',
        "pass source-image context to prompt builder")

    # ------------------------------------------------------------------
    # workflow: preserve identity from role metadata, filter provider capability,
    # honor resolution and validate delivered image dimensions.
    # ------------------------------------------------------------------
    sub("worker/workflows/image_render.py",
        'from frame_ratio import check_delivered_ratio, filter_by_frame\n',
        'from frame_ratio import check_delivered_ratio, check_delivered_resolution, filter_by_frame, filter_by_resolution\n',
        "import output-resolution validation")
    sub("worker/workflows/image_render.py",
        'def _stage_text_to_image_outputs(output_urls: list[str], requested_ratio: str) -> list[str]:\n',
        'def _stage_text_to_image_outputs(output_urls: list[str], requested_ratio: str, requested_resolution: str = "1K") -> list[str]:\n',
        "validate requested resolution in staging")
    sub("worker/workflows/image_render.py",
        '            if not check_delivered_ratio(width, height, requested_ratio):\n                raise ValueError(\n                    f"frame mismatch: requested {requested_ratio}, returned {width}x{height}"\n                )\n',
        '            if not check_delivered_ratio(width, height, requested_ratio):\n                raise ValueError(\n                    f"frame mismatch: requested {requested_ratio}, returned {width}x{height}"\n                )\n            if not check_delivered_resolution(width, height, requested_resolution):\n                raise ValueError(\n                    f"resolution mismatch: requested {requested_resolution}, returned {width}x{height}"\n                )\n',
        "reject silently downgraded resolution")
    sub("worker/workflows/image_render.py",
        '    # Any supplied primary Image2 image is the element to preserve, even if\n    # an older client omitted the flag or sent it as false.\n    if feature == "text_to_image":\n        input_["preserveElementIdentity"] = bool(input_.get("imageUrl"))\n',
        '    # Keep backward compatibility and activate identity preservation for reference roles too.\n    if feature == "text_to_image":\n        reference_roles = input_.get("referenceRoles") or []\n        input_["preserveElementIdentity"] = bool(\n            input_.get("imageUrl")\n            or (isinstance(reference_roles, (list, tuple)) and "element" in reference_roles)\n        )\n',
        "preserve element identity for role-tagged references")
    sub("worker/workflows/image_render.py",
        '                has_style_reference = bool(input_.get("styleReferenceUrl"))\n',
        '                reference_roles = input_.get("referenceRoles") or []\n                has_style_reference = bool(input_.get("styleReferenceUrl")) or (\n                    isinstance(reference_roles, (list, tuple)) and "style" in reference_roles\n                )\n',
        "count style-role references")
    sub("worker/workflows/image_render.py",
        '                    + int(has_style_reference)\n',
        '                    + int(bool(input_.get("styleReferenceUrl")))\n',
        "count separately stored Style image once")
    # Insert identity-capability filtering after image-input counting, before provider selection.
    old_auto = '''                # Real Auto: only configured providers are candidates. The normal
                # quality/cost ranking still applies to the providers that are ready.
                selected_model = input_.get("model")
'''
    new_auto = '''                selected_model = input_.get("model")
                has_image_inputs = bool(
                    input_.get("imageUrl") or input_.get("styleReferenceUrl") or input_.get("referenceUrls")
                )
                if has_image_inputs:
                    identity_edit_candidates = [candidate for candidate in feature_candidates if candidate.supports_identity_edit]
                    if selected_model and selected_model != "auto" and not any(
                        candidate.key == selected_model for candidate in identity_edit_candidates
                    ):
                        raise ValueError(
                            "The selected model does not support Image2 source-image editing with identity preservation. "
                            "Choose Auto, GPT Image 2.5 Sunburst, or Gemini Nano Banana 2.1."
                        )
                    feature_candidates = identity_edit_candidates
                # The existing Auto guard below removes candidates whose providers are not configured.
                # Image inputs have already been reduced to actual edit-capable adapters.
'''
    sub("worker/workflows/image_render.py", old_auto, new_auto, "require true edit-capable models for image inputs")
    old_hardcoded = '''                    # Image2 must edit its attached images, not merely use them
                    # as weak inspiration for a text-to-image request. In Auto,
                    # route requests with image inputs only to official providers
                    # whose adapters send every image as an edit/generation input.
                    has_image_inputs = bool(
                        input_.get("imageUrl")
                        or input_.get("styleReferenceUrl")
                        or input_.get("referenceUrls")
                    )
                    if has_image_inputs:
                        feature_candidates = [
                            candidate for candidate in feature_candidates
                            if candidate.provider in {"google", "openai"}
                        ]
'''
    sub("worker/workflows/image_render.py", old_hardcoded, "", "remove redundant hardcoded provider filter")
    sub("worker/workflows/image_render.py",
        '                feature_candidates = filter_by_frame(\n                    feature_candidates,\n                    input_.get("aspectRatio"),\n                    input_.get("model"),\n                )\n',
        '                feature_candidates = filter_by_frame(\n                    feature_candidates,\n                    input_.get("aspectRatio"),\n                    input_.get("model"),\n                )\n                feature_candidates = filter_by_resolution(\n                    feature_candidates,\n                    input_.get("aspectRatio"),\n                    input_.get("resolution") or "1K",\n                    input_.get("model"),\n                )\n',
        "filter by resolution/frame capability")
    # After normal tier/cost ordering, use a fidelity-first order only when images are present in Auto.
    old_order = '''            candidates = order_candidates(feature_candidates, input_.get("quality") or "standard", input_.get("model"))
            requested_ratio = input_.get("aspectRatio") or "auto"
'''
    new_order = '''            requested_quality = input_.get("quality") or "standard"
            if feature == "text_to_image" and requested_quality == "pro":
                feature_candidates = [candidate for candidate in feature_candidates if "pro" in candidate.tiers]
                if not feature_candidates:
                    raise ValueError(
                        f"No compatible Image2 model supports Pro quality for {input_.get('aspectRatio') or 'auto'} "
                        f"at {input_.get('resolution') or '1K'}. Choose Standard or another frame/resolution."
                    )
            candidates = order_candidates(feature_candidates, requested_quality, input_.get("model"))
            if feature == "text_to_image" and (not input_.get("model") or input_.get("model") == "auto") and (
                input_.get("imageUrl") or input_.get("styleReferenceUrl") or input_.get("referenceUrls")
            ):
                priority = {"gpt-image-1.5": 0, "gemini-2.5-flash": 1}
                candidates = sorted(candidates, key=lambda candidate: (priority.get(candidate.key, 100), candidate.cost_per_generation))
            requested_ratio = input_.get("aspectRatio") or "auto"
            requested_resolution = input_.get("resolution") or "1K"
'''
    sub("worker/workflows/image_render.py", old_order, new_order, "prioritize identity edit and capture requested resolution")
    sub("worker/workflows/image_render.py",
        '                    return _stage_text_to_image_outputs(output_urls, requested_ratio)\n',
        '                    return _stage_text_to_image_outputs(output_urls, requested_ratio, requested_resolution)\n',
        "validate output resolution")
    sub("worker/workflows/image_render.py",
        '                    if str(err).startswith("frame mismatch:"):\n                        log.warning("Image2 candidate %s returned an incompatible frame: %s", candidate.key, err)\n',
        '                    if str(err).startswith(("frame mismatch:", "resolution mismatch:")):\n                        log.warning("Image2 candidate %s returned incompatible output: %s", candidate.key, err)\n',
        "log frame and resolution mismatches")
    sub("worker/workflows/image_render.py",
        '                output_validator=(validate_text_to_image if feature == "text_to_image" and requested_ratio != "auto" else None),\n',
        '                output_validator=(validate_text_to_image if feature == "text_to_image" else None),\n',
        "validate resolution even in Auto frame mode")

    # ------------------------------------------------------------------
    # /api/generate: validate and preserve each image role in the job record.
    # ------------------------------------------------------------------
    sub("web/app/api/generate/route.ts",
        '  const referenceItems: Array<{\n    tag: string;\n    file?: File;\n    assetId?: string;\n    storagePath?: string;\n  }> = [];\n',
        '  const referenceItems: Array<{\n    tag: string;\n    role: "element" | "base" | "style" | "detail";\n    file?: File;\n    assetId?: string;\n    storagePath?: string;\n  }> = [];\n',
        "preserve roles in reference items")
    sub("web/app/api/generate/route.ts",
        '      let metadata: { index?: unknown; source?: unknown; assetId?: unknown; tag?: unknown };\n',
        '      let metadata: { index?: unknown; source?: unknown; assetId?: unknown; tag?: unknown; role?: unknown };\n',
        "parse image role metadata")
    sub("web/app/api/generate/route.ts",
        '      const tag = typeof metadata.tag === "string" ? metadata.tag : "";\n      const itemIndex = typeof metadata.index === "number" && Number.isInteger(metadata.index)\n',
        '      const tag = typeof metadata.tag === "string" ? metadata.tag : "";\n      const validRoles = new Set(["element", "base", "style", "detail"]);\n      const role = metadata.role === undefined ? "element" : metadata.role;\n      if (typeof role !== "string" || !validRoles.has(role)) {\n        return NextResponse.json({ error: "Invalid image input role." }, { status: 400 });\n      }\n      const itemIndex = typeof metadata.index === "number" && Number.isInteger(metadata.index)\n',
        "validate image role from client")
    sub("web/app/api/generate/route.ts",
        '        referenceItems.push({ tag, file });\n      } else if (metadata.source === "asset" && typeof metadata.assetId === "string") {\n',
        '        referenceItems.push({ tag, role: role as "element" | "base" | "style" | "detail", file });\n      } else if (metadata.source === "asset" && typeof metadata.assetId === "string") {\n',
        "store role for uploaded image")
    sub("web/app/api/generate/route.ts",
        '        referenceItems.push({ tag, assetId: metadata.assetId, storagePath: asset.storage_path });\n',
        '        referenceItems.push({ tag, role: role as "element" | "base" | "style" | "detail", assetId: metadata.assetId, storagePath: asset.storage_path });\n',
        "store role for project asset")
    sub("web/app/api/generate/route.ts",
        '      referenceItems.push({ tag: submittedTags[index] ?? `@img${index + 1}`, file });\n',
        '      referenceItems.push({ tag: submittedTags[index] ?? `@img${index + 1}`, role: "element", file });\n',
        "backwards-compatible legacy role")
    sub("web/app/api/generate/route.ts",
        '  const referenceTags = referenceItems.map((item) => item.tag);\n',
        '  const referenceTags = referenceItems.map((item) => item.tag);\n  const referenceRoles = referenceItems.map((item) => item.role);\n',
        "build ordered role list")
    sub("web/app/api/generate/route.ts",
        '      referenceUrls,\n      referenceTags,\n      styleReferenceUrl: styleReferenceUrl ?? undefined,\n',
        '      referenceUrls,\n      referenceTags,\n      referenceRoles,\n      styleReferenceUrl: styleReferenceUrl ?? undefined,\n',
        "include roles in queued worker input")
    sub("web/app/api/generate/route.ts",
        '      preserveElementIdentity: isTextToImage && Boolean(imageUrl),\n',
        '      preserveElementIdentity: isTextToImage && (Boolean(imageUrl) || referenceRoles.includes("element")),\n',
        "enable identity for role-tagged uploaded elements")

    # ------------------------------------------------------------------
    # Image2 UI: role selector, capability metadata, and accurate Auto resolution set.
    # ------------------------------------------------------------------
    sub("web/components/studio/image2-workspace.tsx",
        'type Image2ModelOption = ModelOption & {\n',
        'type ImageReferenceRole = "element" | "base" | "style" | "detail";\n\ntype Image2ModelOption = ModelOption & {\n',
        "declare reference roles")
    sub("web/components/studio/image2-workspace.tsx",
        '  frameRatios?: string[];\n  costPerGeneration?: number;\n',
        '  frameRatios?: string[];\n  resolutionRatios?: Record<string, string[]>;\n  supportsIdentityEdit?: boolean;\n  costPerGeneration?: number;\n',
        "receive identity/resolution capabilities")
    sub("web/components/studio/image2-workspace.tsx",
        'interface ImageInput {\n  id: string;\n  tag: string;\n  name: string;\n  previewUrl: string;\n  file?: File;\n  assetId?: string;\n  sizeBytes: number;\n}\n',
        'interface ImageInput {\n  id: string;\n  tag: string;\n  name: string;\n  previewUrl: string;\n  role: ImageReferenceRole;\n  file?: File;\n  assetId?: string;\n  sizeBytes: number;\n}\n',
        "persist role with each reference")
    sub("web/components/studio/image2-workspace.tsx",
        '      model.configured && imageInputCount <= (model.maxReferences ?? 0),\n',
        '      model.configured &&\n      imageInputCount <= (model.maxReferences ?? 0) &&\n      (imageInputCount === 0 || model.supportsIdentityEdit === true),\n',
        "hide non-edit-capable models when images are attached")
    old_settings = '''  // Show only settings genuinely exposed by the selected model. Auto uses the
  // intersection across configured models that can handle the selected inputs.
  const availableQualityTiers = useMemo(() => {
    const capabilityModels = selectedModelOption ? [selectedModelOption] : frameCompatibleModels;
    if (capabilityModels.length === 0) return [QUALITY_TIERS[0]];
    const supportedIds = new Set(capabilityModels.flatMap((model) => model.tiers ?? ["standard"]));
    const supported = QUALITY_TIERS.filter((tier) => supportedIds.has(tier.id));
    return supported.length > 0 ? supported : [QUALITY_TIERS[0]];
  }, [selectedModelOption, frameCompatibleModels]);
  const availableResolutions = useMemo<Resolution[]>(() => {
    const capabilityModels = selectedModelOption ? [selectedModelOption] : frameCompatibleModels;
    if (capabilityModels.length === 0) return ["1K"];
    return RESOLUTIONS.filter((value) =>
      capabilityModels.every((model) => (model.resolutions ?? ["1K"]).includes(value)),
    );
  }, [selectedModelOption, frameCompatibleModels]);
'''
    new_settings = '''  // Keep settings aligned to the current frame/resolution in both manual and Auto mode.
  const resolutionCompatibleModels = useMemo(() => {
    const capabilityModels = selectedModelOption ? [selectedModelOption] : frameCompatibleModels;
    return capabilityModels.filter((model) => {
      const frameTiers = model.resolutionRatios
        ? (model.resolutionRatios[aspectRatio] ?? [])
        : (model.resolutions ?? ["1K"]);
      return frameTiers.includes(resolution);
    });
  }, [selectedModelOption, frameCompatibleModels, aspectRatio, resolution]);

  // Auto uses the union of tiers exposed by compatible models. The worker requires an exact tier match.
  const availableQualityTiers = useMemo(() => {
    const supportedIds = new Set(resolutionCompatibleModels.flatMap((model) => model.tiers ?? ["standard"]));
    const supported = QUALITY_TIERS.filter((tier) => supportedIds.has(tier.id));
    return supported.length > 0 ? supported : [QUALITY_TIERS[0]];
  }, [resolutionCompatibleModels]);

  const availableResolutions = useMemo<Resolution[]>(() => {
    const capabilityModels = selectedModelOption ? [selectedModelOption] : frameCompatibleModels;
    if (capabilityModels.length === 0) return ["1K"];
    return RESOLUTIONS.filter((value) => capabilityModels.some((model) => {
      const frameTiers = model.resolutionRatios
        ? (model.resolutionRatios[aspectRatio] ?? [])
        : (model.resolutions ?? ["1K"]);
      return frameTiers.includes(value);
    }));
  }, [selectedModelOption, frameCompatibleModels, aspectRatio]);
'''
    sub("web/components/studio/image2-workspace.tsx", old_settings, new_settings, "filter available quality/resolutions by model capability")
    # Add explicit image-role selector to each reference card.
    old_name = '''                    <p
                      className="mt-1 truncate px-0.5 text-[9px] text-[#a6a8b1]"
                      title={reference.name}
                    >
                      {reference.name}
                    </p>
'''
    new_name = '''                    <p
                      className="mt-1 truncate px-0.5 text-[9px] text-[#a6a8b1]"
                      title={reference.name}
                    >
                      {reference.name}
                    </p>
                    <select
                      aria-label={`Role for ${reference.tag}`}
                      value={reference.role ?? "element"}
                      onChange={(event) => {
                        const role = event.target.value as ImageReferenceRole;
                        setReferences((current) => current.map((item) =>
                          item.id === reference.id ? { ...item, role } : item,
                        ));
                      }}
                      className="mt-1 w-full rounded-md border border-white/[0.10] bg-[#17181c] px-1 py-1 text-[9px] text-[#d8d9e0] outline-none focus:border-[#aaa7ff]"
                    >
                      <option value="element">Element · preserve identity</option>
                      <option value="base">Base scene / background</option>
                      <option value="style">Style / lighting only</option>
                      <option value="detail">Detail / context</option>
                    </select>
'''
    sub("web/components/studio/image2-workspace.tsx", old_name, new_name, "add explicit role selector to reference cards")
    # Every reference creation path defaults to the useful identity-preserving role.
    sub("web/components/studio/image2-workspace.tsx",
        '          tag: `@img${nextTagRef.current++}`,\n          name: "Project image",\n',
        '          tag: `@img${nextTagRef.current++}`,\n          role: "element",\n          name: "Project image",\n',
        "default project images to element role")
    # The second project-image creation path uses the same code shape and is replaced separately if present.
    sub("web/components/studio/image2-workspace.tsx",
        '              tag: `@img${nextTagRef.current++}`,\n              name: "Project image",\n',
        '              tag: `@img${nextTagRef.current++}`,\n              role: "element",\n              name: "Project image",\n',
        "default preselected project images to element role")
    sub("web/components/studio/image2-workspace.tsx",
        '          tag: `@img${nextTagRef.current++}`,\n          name: file.name,\n',
        '          tag: `@img${nextTagRef.current++}`,\n          role: "element",\n          name: file.name,\n',
        "default uploads to element role")
    sub("web/components/studio/image2-workspace.tsx",
        '          tag: reference.tag,\n        }),\n      );\n',
        '          tag: reference.tag,\n          role: reference.role ?? "element",\n        }),\n      );\n',
        "send selected role in form metadata")

    # Make Auto preview the exact same resolution-compatible fidelity-first intent as worker routing.
    old_auto = '''  const resolvedAutoModel = useMemo<Image2ModelOption | null>(() => {
    if (frameCompatibleModels.length === 0) return null;
    const matchingTier = frameCompatibleModels.filter((model) =>
      (model.tiers ?? ["standard"]).includes(quality),
    );
    const candidates = matchingTier.length > 0 ? matchingTier : frameCompatibleModels;
    return candidates.reduce((best, model) =>
      (model.costPerGeneration ?? Infinity) < (best.costPerGeneration ?? Infinity)
        ? model
        : best,
    );
  }, [frameCompatibleModels, quality]);
'''
    new_auto = '''  const resolvedAutoModel = useMemo<Image2ModelOption | null>(() => {
    if (resolutionCompatibleModels.length === 0) return null;
    if (imageInputCount > 0) {
      const fidelityCandidate = resolutionCompatibleModels.find((model) => model.key === "gpt-image-1.5");
      if (fidelityCandidate) return fidelityCandidate;
    }
    const matchingTier = resolutionCompatibleModels.filter((model) =>
      (model.tiers ?? ["standard"]).includes(quality),
    );
    const candidates = matchingTier.length > 0 ? matchingTier : resolutionCompatibleModels;
    return candidates.reduce((best, model) =>
      (model.costPerGeneration ?? Infinity) < (best.costPerGeneration ?? Infinity)
        ? model
        : best,
    );
  }, [resolutionCompatibleModels, quality, imageInputCount]);
'''
    sub("web/components/studio/image2-workspace.tsx", old_auto, new_auto, "sync Auto preview with resolution/fidelity routing")
    sub("web/components/studio/image2-workspace.tsx",
        '    frameSupported(aspectRatio) &&\n    (Boolean(selectedModel) ||\n',
        '    frameSupported(aspectRatio) &&\n    (modelOptions.length === 0 || resolutionCompatibleModels.length > 0) &&\n    (Boolean(selectedModel) ||\n',
        "disable generation if no model supports selected resolution")
    sub("web/components/studio/image2-workspace.tsx",
        '''                      ? `Will use ${resolvedAutoModel.name} (${providerLabel(resolvedAutoModel.provider, resolvedAutoModel)}) — cheapest configured model matching your inputs.`
''',
        '''                      ? `Will use ${resolvedAutoModel.name} (${providerLabel(resolvedAutoModel.provider, resolvedAutoModel)}) — ${imageInputCount > 0 ? "prioritizes identity-preserving image editing and may cost more" : "lowest-cost compatible model for this request"}.`
''',
        "tell users Auto prioritizes fidelity when images are attached")
    # Explicit metadata is added after form construction; the old clients/API default remains element.

    # ------------------------------------------------------------------
    # Regression tests: align old expectations and add role/capability coverage.
    # ------------------------------------------------------------------
    sub("worker/tests/test_frame_ratio.py",
        '    GPT_IMAGE_1_SIZES,\n    MAGICHOUR_FRAMES,\n    check_delivered_ratio,\n    filter_by_frame,\n',
        '    GPT_IMAGE_1_SIZES,\n    GPT_IMAGE_SIZES_BY_RESOLUTION,\n    GPT_IMAGE_RESOLUTION_RATIOS,\n    GEMINI_RESOLUTION_RATIOS,\n    MAGICHOUR_FRAMES,\n    check_delivered_ratio,\n    check_delivered_resolution,\n    filter_by_frame,\n    filter_by_resolution,\n',
        "import new resolution tests")
    sub("worker/tests/test_frame_ratio.py",
        '        "quality": "standard",\n        "quantity": 1,\n',
        '        "quality": "standard",\n        "resolution": "1K",\n        "quantity": 1,\n',
        "default test resolution")
    old_test = '''def test_openai_only_maps_documented_native_sizes():
    assert GPT_IMAGE_1_SIZES == {
        "1:1": "1024x1024",
        "3:2": "1536x1024",
        "2:3": "1024x1536",
    }
    assert openai_text_to_image_input(_request("1:1"))["size"] == "1024x1024"
    assert openai_text_to_image_input(_request("3:2"))["size"] == "1536x1024"
    assert openai_text_to_image_input(_request("2:3"))["size"] == "1024x1536"
    assert openai_text_to_image_input(_request("auto"))["size"] == "auto"
    for ratio in ("4:3", "16:9", "21:9"):
        try:
            openai_text_to_image_input(_request(ratio))
        except ValueError:
            pass
        else:
            raise AssertionError(f"GPT Image 1 must not approximate {ratio}")
'''
    new_test = '''def test_openai_maps_supported_native_size_for_ratio_and_resolution():
    assert GPT_IMAGE_1_SIZES == {
        "1:1": "1024x1024",
        "3:2": "1536x1024",
        "2:3": "1024x1536",
    }
    assert openai_text_to_image_input(_request("1:1"))["size"] == "1024x1024"
    assert openai_text_to_image_input(_request("16:9"))["size"] == "1536x864"
    assert openai_text_to_image_input({**_request("16:9"), "resolution": "2K"})["size"] == "2560x1440"
    assert openai_text_to_image_input({**_request("16:9"), "resolution": "4K"})["size"] == "3840x2160"
    assert openai_text_to_image_input(_request("auto"))["size"] == "auto"
    assert openai_text_to_image_input(_request("1:1"))["quality"] == "high"
    assert openai_text_to_image_input({**_request("1:1"), "quality": "pro"})["quality"] == "xhigh"
    assert openai_text_to_image_input(_request("1:1"))["output_format"] == "png"
    try:
        openai_text_to_image_input({**_request("1:1"), "resolution": "4K"})
    except ValueError as error:
        assert "does not support 4K" in str(error)
    else:
        raise AssertionError("OpenAI must not advertise unsupported 4K square output")
'''
    sub("worker/tests/test_frame_ratio.py", old_test, new_test, "replace obsolete OpenAI size expectations")
    sub("worker/tests/test_frame_ratio.py",
        '    assert google_text_to_image_input(_request("3:2"))["aspectRatio"] == "3:2"\n    assert "aspectRatio" not in google_text_to_image_input(_request("auto"))\n',
        '    assert google_text_to_image_input(_request("3:2"))["aspectRatio"] == "3:2"\n    assert google_text_to_image_input({**_request("16:9"), "resolution": "2K"})["resolution"] == "2K"\n    assert "aspectRatio" not in google_text_to_image_input(_request("auto"))\n',
        "test Gemini resolution passthrough")
    sub("worker/tests/test_frame_ratio.py",
        '    assert _candidate("gpt-image-1.5").frame_ratios == ("auto", "1:1", "3:2", "2:3")\n',
        '    assert _candidate("gpt-image-1.5").frame_ratios == ("auto", *ALL_FRAMES)\n',
        "update GPT supported frame test")
    sub("worker/tests/test_frame_ratio.py",
        '    assert _candidate("gpt-image-1.5") not in capable\n',
        '    assert _candidate("gpt-image-1.5") in capable\n',
        "include GPT in newly supported wide frames")
    sub("worker/tests/test_frame_ratio.py",
        '    try:\n        filter_by_frame(candidates, "16:9", "gpt-image-1.5")\n    except ValueError as error:\n        assert "cannot generate a 16:9" in str(error)\n    else:\n        raise AssertionError("Explicit unsupported model choice must fail clearly")\n',
        '    assert filter_by_frame(candidates, "16:9", "gpt-image-1.5") == [\n        _candidate("gpt-image-1.5")\n    ]\n',
        "update explicit GPT frame test")
    sub("worker/tests/test_frame_ratio.py",
        '    assert models["gpt-image-1.5"]["frameRatios"] == ("auto", "1:1", "3:2", "2:3")\n',
        '    assert models["gpt-image-1.5"]["frameRatios"] == ("auto", *ALL_FRAMES)\n    assert models["gpt-image-1.5"]["resolutionRatios"]["16:9"] == ("1K", "2K", "4K")\n    assert models["gpt-image-1.5"]["supportsIdentityEdit"] is True\n',
        "update API model capability test")
    sub("worker/tests/test_image2_multi_reference.py",
        '    assert models["gemini-2.5-flash"].max_references == 3\n',
        '    assert models["gemini-2.5-flash"].max_references == 14\n',
        "fix stale Gemini reference-limit expectation")

    new_role_test = '''"""Image2 source roles, provider payloads and resolution routing regression tests."""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from catalog import (  # noqa: E402
    TEXT_TO_IMAGE_CANDIDATES, google_text_to_image_input, openai_text_to_image_input,
    magichour_text_to_image_input, text_to_image_images, list_feature_models,
)
from frame_ratio import (  # noqa: E402
    ALL_FRAMES, GEMINI_RESOLUTION_RATIOS, GPT_IMAGE_RESOLUTION_RATIOS,
    GPT_IMAGE_SIZES_BY_RESOLUTION, check_delivered_resolution, filter_by_resolution,
)
from prompts import add_image_reference_map, build_feature_prompt  # noqa: E402


def req(**overrides):
    value = {
        "feature": "text_to_image", "prompt": "Add @img1 to @img2", "sceneDetails": "Add @img1 to @img2",
        "aspectRatio": "16:9", "resolution": "2K", "quality": "standard", "quantity": 1,
        "referenceUrls": ["data:image/png;base64,OBJECT", "data:image/png;base64,BASE"],
        "referenceTags": ["@img1", "@img2"], "referenceRoles": ["element", "base"],
    }
    value.update(overrides)
    return value


def test_image_order_is_stable_and_roles_do_not_reorder_payload():
    value = req(styleReferenceUrl="data:image/png;base64,STYLE", imageUrl="data:image/png;base64,PRIMARY")
    assert text_to_image_images(value) == [value["styleReferenceUrl"], value["imageUrl"], *value["referenceUrls"]]


def test_reference_map_declares_each_role_and_historical_lighting_rules():
    value = req()
    prompt = add_image_reference_map(build_feature_prompt("text_to_image", value), value)
    assert "role: element" in prompt
    assert "role: base" in prompt
    assert "BASE SCENE/BACKGROUND" in prompt
    assert "HISTORICAL IMAGE2 LIGHTING DISCIPLINE" not in prompt  # no style reference was supplied
    style_value = req(referenceRoles=["style", "base"])
    style_prompt = add_image_reference_map(build_feature_prompt("text_to_image", style_value), style_value)
    assert "role: style" in style_prompt
    assert "HISTORICAL IMAGE2 LIGHTING DISCIPLINE" in style_prompt
    assert "Do not silently ignore any attachment, including the third and later images" in style_prompt


def test_provider_payloads_receive_selected_native_resolution():
    value = req()
    openai = openai_text_to_image_input(value)
    google = google_text_to_image_input(value)
    assert openai["size"] == "2560x1440"
    assert openai["quality"] == "high"
    assert openai["output_format"] == "png"
    assert google["resolution"] == "2K"
    assert google["aspectRatio"] == "16:9"


def test_magichour_builder_requests_only_its_declared_1k_resolution():
    value = req(aspectRatio="1:1", resolution="1K")
    assert magichour_text_to_image_input(value)["resolution"] == "1k"
    try:
        magichour_text_to_image_input({**value, "resolution": "2K"})
    except ValueError as error:
        assert "only the 1K tier" in str(error)
    else:
        raise AssertionError("Magic Hour must not advertise an unimplemented 2K option")


def test_every_declared_openai_size_obeys_pixel_grid_and_requested_frame():
    frame_values = {frame: int(frame.split(":")[0]) / int(frame.split(":")[1]) for frame in ALL_FRAMES}
    for resolution, sizes in GPT_IMAGE_SIZES_BY_RESOLUTION.items():
        for frame, size in sizes.items():
            if size == "auto":
                continue
            width, height = (int(value) for value in size.split("x"))
            assert width % 16 == 0 and height % 16 == 0
            assert max(width, height) <= 3840
            assert abs((width / height) - frame_values[frame]) / frame_values[frame] <= 0.02


def test_model_capability_matrices_do_not_advertise_unsupported_combinations():
    assert GPT_IMAGE_RESOLUTION_RATIOS["1:1"] == ("1K", "2K")
    assert GEMINI_RESOLUTION_RATIOS["1:1"] == ("1K", "2K", "4K")
    models = {item["key"]: item for item in list_feature_models("text_to_image")}
    assert models["gpt-image-1.5"]["resolutionRatios"]["1:1"] == ("1K", "2K")
    assert models["gemini-2.5-flash"]["supportsIdentityEdit"] is True
    assert models["flux-pro"]["supportsIdentityEdit"] is False


def test_pro_quality_is_only_advertised_by_candidates_declaring_pro():
    assert "pro" not in next(candidate for candidate in TEXT_TO_IMAGE_CANDIDATES if candidate.key == "magichour-flux-2-klein-text").tiers
    assert any("pro" in candidate.tiers for candidate in TEXT_TO_IMAGE_CANDIDATES)


def test_resolution_router_filters_and_respects_explicit_model():
    capable = filter_by_resolution(TEXT_TO_IMAGE_CANDIDATES, "16:9", "4K", None)
    assert all("4K" in dict(item.resolution_ratios).get("16:9", ()) for item in capable)
    assert {item.key for item in capable} == {"gpt-image-1.5", "gemini-2.5-flash"}
    try:
        filter_by_resolution(TEXT_TO_IMAGE_CANDIDATES, "1:1", "4K", "gpt-image-1.5")
    except ValueError as error:
        assert "does not support 4K" in str(error)
    else:
        raise AssertionError("Unsupported model resolution must fail clearly")


def test_delivery_resolution_guard_rejects_silent_downgrade():
    assert check_delivered_resolution(1024, 1024, "1K") is True
    assert check_delivered_resolution(1024, 1024, "2K") is False
    assert check_delivered_resolution(3840, 2160, "4K") is True
'''
    rel = "worker/tests/test_image2_reference_roles.py"
    if (root / rel).exists():
        raise PatchMismatch(f"{rel} already exists; refusing to overwrite an existing test file")
    data[rel] = new_role_test

    # Final structural checks catch an incomplete plan before any writes.
    expected_markers = {
        "worker/frame_ratio.py": ["GPT_IMAGE_SIZES_BY_RESOLUTION", "filter_by_resolution", "check_delivered_resolution"],
        "worker/catalog.py": ["resolutionRatios", "supports_identity_edit", "def openai_text_to_image_input", '"quality": "xhigh" if req.get("quality") == "pro" else "high"'],
        "worker/prompts.py": ["user-declared roles are authoritative", "HISTORICAL IMAGE2 LIGHTING DISCIPLINE", "has_reference_images=False"],
        "worker/workflows/image_render.py": ["filter_by_resolution", "supports_identity_edit", "resolution mismatch:", 'priority = {"gpt-image-1.5": 0, "gemini-2.5-flash": 1}', 'requested_quality == "pro"'],
        "worker/providers/openai.py": ["output_format = str(input_.get(\"output_format\") or \"jpeg\")", "return f\"data:{mime_type};base64,{b64}\""],
        "worker/providers/google.py": ["response_format[\"image_size\"] = image_size"],
        "worker/providers/magichour.py": ['"resolution": str(input_.get("resolution") or "auto")'],
        "web/app/api/generate/route.ts": ["referenceRoles", "Invalid image input role"],
        "web/components/studio/image2-workspace.tsx": ["ImageReferenceRole", "resolutionRatios", "Role for ${reference.tag}"],
        "worker/tests/test_image2_reference_roles.py": ["test_reference_map_declares_each_role", "test_resolution_router_filters", "test_every_declared_openai_size"],
    }
    for rel, markers in expected_markers.items():
        for marker in markers:
            if marker not in data[rel]:
                raise PatchMismatch(f"Post-patch verification failed: {rel} lacks {marker!r}")

    # Python fails at import time if a Candidate call receives duplicate keyword args;
    # verify the edited capability-bearing catalog entries before writing any file.
    for key in ("flux-pro", "flux-dev", "gpt-image-1.5", "gemini-2.5-flash", "magichour-flux-2-klein-text"):
        _start, _end, block = candidate_block(data["worker/catalog.py"], key)
        if block.count("frame_ratios=") != 1:
            raise PatchMismatch(f"Post-patch verification failed: {key} has duplicate/missing frame_ratios")
        if block.count("resolution_ratios=") != 1:
            raise PatchMismatch(f"Post-patch verification failed: {key} has duplicate/missing resolution_ratios")
    if '"gpt-image-1.5"' not in data["worker/catalog.py"] or 'supports_identity_edit=True' not in candidate_block(data["worker/catalog.py"], "gpt-image-1.5")[2]:
        raise PatchMismatch("Post-patch verification failed: GPT edit capability is not declared")
    if 'role: reference.role ?? "element"' not in data["web/components/studio/image2-workspace.tsx"]:
        raise PatchMismatch("Post-patch verification failed: UI role is not sent to the API")

    # Restore each file's original line-ending style.
    return {
        rel: (value.replace("\n", "\r\n") if crlf.get(rel, False) else value)
        for rel, value in data.items()
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=Path.cwd(), help="project root")
    parser.add_argument("--apply", action="store_true", help="write changes after creating backups")
    parser.add_argument("--diff", action="store_true", help="print proposed unified source diffs")
    parser.add_argument("--allow-different-head", action="store_true", help="allow apply on a different commit after reviewing --diff")
    parser.add_argument("--allow-dirty", action="store_true", help="allow apply when the working tree already has changes")
    args = parser.parse_args()
    root = args.root.resolve()

    if not (root / ".git").exists() and not (root / "worker" / "catalog.py").exists():
        print("ERROR: --root must point to the project root (the folder containing worker/ and web/).", file=sys.stderr)
        return 2
    if not (root / "worker" / "tests" / "test_frame_ratio.py").parent.is_dir():
        print("ERROR: expected worker/tests directory was not found.", file=sys.stderr)
        return 2

    try:
        planned = edits(root)
    except PatchMismatch as exc:
        print(f"PREFLIGHT FAILED: {exc}", file=sys.stderr)
        print("No files were written. This patch requires source blocks matching the reviewed CODEX snapshot.", file=sys.stderr)
        return 2

    head_sha = None
    is_dirty = False
    try:
        head = subprocess.run(["git", "rev-parse", "HEAD"], cwd=root, capture_output=True, text=True, check=False)
        if head.returncode == 0:
            head_sha = head.stdout.strip()
            print(f"Current HEAD: {head_sha}")
            if head_sha != BASE_COMMIT:
                print(f"NOTE: reviewed base was {BASE_COMMIT}; source anchors matched, but review the diff carefully.")
        status = subprocess.run(["git", "status", "--short"], cwd=root, capture_output=True, text=True, check=False)
        is_dirty = status.returncode == 0 and bool(status.stdout.strip())
        if is_dirty:
            print("WARNING: working tree already has changes. The script preserves them, but inspect the planned diff first.")
    except OSError:
        pass

    print("\nValidated planned file set:")
    for rel in planned:
        print(f"  - {rel}")
    print(f"\nFiles to change: {len(planned)} (including one new regression-test file)")

    if args.diff:
        print("\n--- PROPOSED DIFF (read-only) ---")
        for rel, after in planned.items():
            before = (root / rel).read_text(encoding="utf-8").replace("\r\n", "\n") if (root / rel).exists() else ""
            after_norm = after.replace("\r\n", "\n")
            diff = difflib.unified_diff(before.splitlines(keepends=True), after_norm.splitlines(keepends=True), fromfile=rel, tofile=f"{rel} (proposed)")
            print("".join(diff), end="")

    if not args.apply:
        print("\nDRY RUN: no project files changed. Review the diff, then re-run with --apply.")
        return 0

    if head_sha and head_sha != BASE_COMMIT and not args.allow_different_head:
        print("ERROR: --apply is restricted to the reviewed base commit. Review --diff and pass --allow-different-head only if you verified the changed source version.", file=sys.stderr)
        return 2
    if is_dirty and not args.allow_dirty:
        print("ERROR: working tree has uncommitted changes. Apply in a clean worktree, or pass --allow-dirty only after backing up and reviewing every affected file.", file=sys.stderr)
        return 2

    backups = {rel: root / (rel + BACKUP_SUFFIX) for rel in planned if (root / rel).exists()}
    collisions = [str(path.relative_to(root)) for path in backups.values() if path.exists()]
    if collisions:
        print("ERROR: refusing to overwrite existing backup(s): " + ", ".join(collisions), file=sys.stderr)
        return 2

    # Create all backups before touching any source file.
    try:
        for rel, backup in backups.items():
            backup.write_bytes((root / rel).read_bytes())
        written: list[str] = []
        try:
            for rel, content in planned.items():
                path = root / rel
                path.parent.mkdir(parents=True, exist_ok=True)
                temp = path.with_name(path.name + ".image2patch.tmp")
                temp.write_text(content, encoding="utf-8", newline="")
                temp.replace(path)
                written.append(rel)
        except Exception:
            # Restore every already-written file from its byte-identical backup.
            for rel in written:
                backup = backups.get(rel)
                if backup and backup.exists():
                    (root / rel).write_bytes(backup.read_bytes())
                elif (root / rel).exists():
                    (root / rel).unlink()
            raise
    except Exception as exc:
        print(f"ERROR: write failed and rollback was attempted: {exc}", file=sys.stderr)
        print("Backup files are retained for manual inspection.", file=sys.stderr)
        return 2

    print("\nPatch applied locally. Backups were saved with suffix:")
    print(f"  {BACKUP_SUFFIX}")
    print("Next commands (run these yourself):")
    print("  python -m compileall worker")
    print("  python -m pytest worker/tests/test_frame_ratio.py worker/tests/test_image2_multi_reference.py worker/tests/test_image2_reference_roles.py")
    print("  cd web && npm run lint && npx tsc --noEmit")
    print("No GitHub commit, push, or branch change was performed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
