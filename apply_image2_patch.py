#!/usr/bin/env python3
"""Apply reviewed Image2 fixes to a local checkout only.

No GitHub API, commits, pushes, or branch creation are performed.
Every source replacement must match exactly once before any file is written.
"""
from __future__ import annotations

import sys
from pathlib import Path


def replace_once(source: str, old: str, new: str, label: str) -> str:
    count = source.count(old)
    if count != 1:
        raise RuntimeError(
            f"{label}: expected one source match, found {count}. "
            "No files were written; check the branch/source version."
        )
    return source.replace(old, new, 1)


def main() -> int:
    root = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else Path.cwd()
    paths = {
        "catalog": root / "worker/catalog.py",
        "image_render": root / "worker/workflows/image_render.py",
        "engine": root / "worker/workflows/engine.py",
        "openai": root / "worker/providers/openai.py",
        "google": root / "worker/providers/google.py",
        "prompts": root / "worker/prompts.py",
    }
    for path in paths.values():
        if not path.is_file():
            print(f"ERROR: Missing {path}", file=sys.stderr)
            print("Pass the root of your local repository as the first argument.", file=sys.stderr)
            return 2

    test_path = root / "worker/tests/test_image2_reference_fidelity.py"
    if test_path.exists():
        print(f"ERROR: Refusing to overwrite existing test file: {test_path}", file=sys.stderr)
        return 2
    if not test_path.parent.is_dir():
        print(f"ERROR: Expected test directory does not exist: {test_path.parent}", file=sys.stderr)
        return 2

    pending: dict[Path, str] = {}
    try:
        # ------------------------------------------------------------------
        # worker/catalog.py: make image routing independent from the UI flag,
        # add flexible GPT Image sizes, add FLUX.2 and current edit models.
        # ------------------------------------------------------------------
        path = paths["catalog"]
        text = path.read_text(encoding="utf-8")

        text = replace_once(
            text,
            "IMAGE_TIMEOUT_MS = 3 * 60 * 1000\nVIDEO_TIMEOUT_MS = 10 * 60 * 1000\n",
            '''IMAGE_TIMEOUT_MS = 3 * 60 * 1000
VIDEO_TIMEOUT_MS = 10 * 60 * 1000

# Native flexible dimensions for GPT Image 2 / GPT Image 2.5.
# All edges are multiples of 16 and stay within the documented 4K limits.
GPT_IMAGE_FLEX_SIZES: dict[str, str] = {
    "1:1": "1024x1024",
    "16:9": "1536x864",
    "9:16": "864x1536",
    "4:3": "1536x1152",
    "3:4": "1152x1536",
    "3:2": "1536x1024",
    "2:3": "1024x1536",
    "21:9": "1792x768",
}

# FLUX.2 accepts arbitrary dimensions in multiples of 16 (up to 4MP).
FLUX2_DIMENSIONS: dict[str, tuple[int, int]] = {
    "1:1": (1024, 1024),
    "16:9": (1536, 864),
    "9:16": (864, 1536),
    "4:3": (1536, 1152),
    "3:4": (1152, 1536),
    "3:2": (1536, 1024),
    "2:3": (1024, 1536),
    "21:9": (1792, 768),
}
''',
            "catalog.py: add flexible native sizes",
        )

        text = replace_once(
            text,
            '''def text_to_image_images(req: dict) -> list[str]:
    """Build ordered Image2 inputs: Style, primary element, then references."""
    images: list[str] = []
    style_image = req.get("styleReferenceUrl")
    if isinstance(style_image, str) and style_image:
        images.append(style_image)

    element_image = req.get("imageUrl")
    if (
        req.get("preserveElementIdentity")
        and isinstance(element_image, str)
        and element_image
    ):
        images.append(element_image)

    references = req.get("referenceUrls") or []
    if isinstance(references, (list, tuple)):
        images.extend(
            image for image in references if isinstance(image, str) and image
        )
    return images
''',
            '''def text_to_image_images(req: dict) -> list[str]:
    """Build Image2 inputs: Style, primary source, then tagged references.

    A supplied primary image is sent even when the UI identity flag is absent
    or false. The workflow controls whether it is labelled as @element.
    """
    images: list[str] = []
    style_image = req.get("styleReferenceUrl")
    if isinstance(style_image, str) and style_image:
        images.append(style_image)

    element_image = req.get("imageUrl")
    if isinstance(element_image, str) and element_image:
        images.append(element_image)

    references = req.get("referenceUrls") or []
    if isinstance(references, (list, tuple)):
        images.extend(
            image for image in references if isinstance(image, str) and image
        )
    return images
''',
            "catalog.py: ensure the primary Image2 image is always sent",
        )

        text = replace_once(
            text,
            '''def openai_text_to_image_input(req: dict) -> dict:
    """OpenAI image generation/editing with the requested frame and inputs."""
    ratio = req.get("aspectRatio") or "auto"
    size = "auto" if ratio == "auto" else exact_size(GPT_IMAGE_1_SIZES, ratio)
    images = text_to_image_images(req)
    return {
        "prompt": req["prompt"],
        "images": images,
        "size": size,
        "quality": "high" if req["quality"] == "pro" else "medium",
        "quantity": req["quantity"],
    }

def google_text_to_image_input(req: dict) -> dict:
    """Google image generation with ordered Style, element and content inputs."""
    payload = {
        "prompt": req["prompt"],
        "images": text_to_image_images(req),
        "quantity": req["quantity"],
    }
    if req.get("aspectRatio") not in (None, "auto"):
        payload["aspectRatio"] = req["aspectRatio"]
    return payload
''',
            '''def openai_text_to_image_input(req: dict) -> dict:
    """Legacy GPT Image input builder; retained for compatibility."""
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


def openai_flexible_text_to_image_input(req: dict) -> dict:
    """GPT Image 2 / 2.5 builder with native sizes for every supported frame."""
    ratio = req.get("aspectRatio") or "auto"
    if ratio == "auto":
        size = "auto"
    else:
        try:
            size = GPT_IMAGE_FLEX_SIZES[ratio]
        except KeyError:
            raise ValueError(
                f"GPT Image 2.5 does not declare a native size for {ratio}."
            ) from None
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
        "quality": "high" if req.get("quality") == "pro" else "medium",
        "quantity": req.get("quantity") or 1,
    }


def flux2_text_to_image_input(req: dict) -> dict:
    """FLUX.2 Pro multi-reference editing with native size control."""
    ratio = req.get("aspectRatio") or "auto"
    if ratio == "auto":
        width, height = 1024, 1024
    else:
        try:
            width, height = FLUX2_DIMENSIONS[ratio]
        except KeyError:
            raise ValueError(f"FLUX.2 does not declare a supported frame for {ratio}.") from None

    images = text_to_image_images(req)
    if len(images) > 8:
        raise ValueError("FLUX.2 Pro accepts at most 8 reference images through the API.")

    payload: dict = {
        "prompt": req["prompt"],
        "width": width,
        "height": height,
        "output_format": "jpeg",
        "safety_tolerance": 2,
        "quantity": req.get("quantity") or 1,
    }
    for index, image in enumerate(images):
        field = "input_image" if index == 0 else f"input_image_{index + 1}"
        payload[field] = to_base64_or_url(image)
    return payload


def google_text_to_image_input(req: dict) -> dict:
    """Google image generation with ordered Style, element and content inputs."""
    payload = {
        "prompt": req["prompt"],
        "images": text_to_image_images(req),
        "require_images": bool(
            req.get("imageUrl")
            or req.get("styleReferenceUrl")
            or req.get("referenceUrls")
        ),
        "quantity": req.get("quantity") or 1,
    }
    if req.get("aspectRatio") not in (None, "auto"):
        payload["aspectRatio"] = req["aspectRatio"]
    return payload
''',
            "catalog.py: add flexible GPT and FLUX.2 builders",
        )

        old_gpt = '''    Candidate("gpt-image-1.5", "GPT Image 1.5", "High-fidelity text-to-image with Style and content references", "openai", "gpt-image-1.5", 7, 15, 16, IMAGE_TIMEOUT_MS, ("pro",), openai_text_to_image_input, extract_image_urls, supports_style_reference=True, frame_ratios=("auto", "1:1", "3:2", "2:3")),
'''
        new_gpt = '''    Candidate("gpt-image-1.5", "GPT Image 2.5 Sunburst", "Precision-first Image2 edits with element and style references", "openai", "gpt-image-2.5-sunburst", 7, 15, 16, IMAGE_TIMEOUT_MS, ("pro",), openai_flexible_text_to_image_input, extract_image_urls, supports_style_reference=True, frame_ratios=("auto", *ALL_FRAMES)),
    Candidate("gpt-image-2", "GPT Image 2", "High-fidelity multi-reference image editing", "openai", "gpt-image-2", 7, 12, 16, IMAGE_TIMEOUT_MS, ("standard", "pro"), openai_flexible_text_to_image_input, extract_image_urls, supports_style_reference=True, frame_ratios=("auto", *ALL_FRAMES)),
    Candidate("gemini-3-pro", "Gemini 3 Pro Image", "Professional image editing with high-fidelity references", "google", "gemini-3-pro-image", 7, 10, 6, IMAGE_TIMEOUT_MS, ("pro",), google_text_to_image_input, extract_image_urls, supports_style_reference=True, frame_ratios=("auto", *ALL_FRAMES)),
    Candidate("flux-2-pro", "FLUX.2 Pro", "Multi-reference image compositing with precise framing", "bfl", "flux-2-pro", 6, 6, 8, IMAGE_TIMEOUT_MS, ("standard", "pro"), flux2_text_to_image_input, extract_image_urls, supports_style_reference=True, frame_ratios=("auto", *ALL_FRAMES)),
    Candidate("gemini-nano-banana-2-1", "Gemini Nano Banana 2.1", "High-fidelity multi-reference image editing", "google", "gemini-nano-banana-2.1", 5, 4, 14, IMAGE_TIMEOUT_MS, ("standard", "pro"), google_text_to_image_input, extract_image_urls, supports_style_reference=True, frame_ratios=("auto", *ALL_FRAMES)),
'''
        text = replace_once(text, old_gpt, new_gpt, "catalog.py: current image editing candidates")
        pending[path] = text

        # ------------------------------------------------------------------
        # worker/workflows/image_render.py: identity rule and avoid low-fidelity
        # FLUX.1 / Magic Hour text-to-image routes when source images are used.
        # ------------------------------------------------------------------
        path = paths["image_render"]
        text = path.read_text(encoding="utf-8")
        text = replace_once(
            text,
            '''from workflows.engine import execute_with_fallback, order_candidates
''',
            '''from workflows.engine import (
    execute_with_fallback,
    order_candidates,
    order_image2_reference_candidates,
)
''',
            "image_render.py: import Image2 fidelity ordering",
        )
        text = replace_once(
            text,
            '''    # Backward compatibility for queued Image2 jobs created before this field.
    if (
        feature == "text_to_image"
        and "preserveElementIdentity" not in input_
    ):
        input_["preserveElementIdentity"] = bool(input_.get("imageUrl"))
''',
            '''    # When Image2 has a primary source image, always preserve its identity.
    # Do not let an explicit False or a missing UI field disable this rule.
    if feature == "text_to_image":
        input_["preserveElementIdentity"] = bool(input_.get("imageUrl"))
''',
            "image_render.py: enforce primary identity flag",
        )
        text = replace_once(
            text,
            '''                has_element_image = bool(
                    input_.get("preserveElementIdentity")
                    and input_.get("imageUrl")
                )
                input_count = (
                    content_count
                    + int(has_style_reference)
                    + int(has_element_image)
                )
                feature_candidates = [
                    candidate for candidate in feature_candidates
                    if candidate.max_references >= input_count
                    and (not has_style_reference or candidate.supports_style_reference)
                ]
''',
            '''                has_element_image = bool(input_.get("imageUrl"))
                input_count = (
                    content_count
                    + int(has_style_reference)
                    + int(has_element_image)
                )
                has_reference_inputs = input_count > 0
                feature_candidates = [
                    candidate for candidate in feature_candidates
                    if candidate.max_references >= input_count
                    and (not has_style_reference or candidate.supports_style_reference)
                ]
                if has_reference_inputs:
                    # FLUX.1 image_prompt and the old Magic Hour generator treat
                    # sources as weak inspiration, not reliably as compositing inputs.
                    low_fidelity_reference_keys = {
                        "flux-pro",
                        "flux-dev",
                        "magichour-flux-2-klein-text",
                    }
                    feature_candidates = [
                        candidate for candidate in feature_candidates
                        if candidate.key not in low_fidelity_reference_keys
                    ]
''',
            "image_render.py: filter text-only / weak-reference candidates",
        )
        text = replace_once(
            text,
            '''            candidates = order_candidates(feature_candidates, input_.get("quality") or "standard", input_.get("model"))
            requested_ratio = input_.get("aspectRatio") or "auto"
''',
            '''            candidates = order_candidates(feature_candidates, input_.get("quality") or "standard", input_.get("model"))
            if feature == "text_to_image" and has_reference_inputs:
                candidates = order_image2_reference_candidates(
                    candidates, input_.get("quality") or "standard"
                )
            requested_ratio = input_.get("aspectRatio") or "auto"
''',
            "image_render.py: apply fidelity-first Auto ordering",
        )
        text = replace_once(
            text,
            '"Configure a supported provider (for example OpenAI GPT Image 1.5 or Google Gemini 2.5 Flash Image), "',
            '"Configure a supported provider (for example OpenAI GPT Image 2.5 Sunburst, FLUX.2 Pro, or Gemini Nano Banana 2.1), "',
            "image_render.py: provider help text",
        )
        pending[path] = text

        # ------------------------------------------------------------------
        # worker/workflows/engine.py: count exactly the images being sent and
        # provide fidelity-first ordering only when references exist.
        # ------------------------------------------------------------------
        path = paths["engine"]
        text = path.read_text(encoding="utf-8")
        text = replace_once(
            text,
            "from catalog import Candidate\n",
            "from catalog import Candidate, text_to_image_images\n",
            "engine.py: import input image builder",
        )
        text = replace_once(
            text,
            '''def execute_with_fallback(
''',
            '''def order_image2_reference_candidates(candidates: list[Candidate], quality: str) -> list[Candidate]:
    """Rank multi-image editing models by fidelity first, not lowest cost.

    Text-only requests continue to use order_candidates' existing cost ranking.
    These priorities are an explicit product policy, not a claim that every
    generated result is pixel-identical to its references.
    """
    if quality == "pro":
        priorities = {
            "gpt-image-1.5": 0,       # legacy key now routes to GPT Image 2.5 Sunburst
            "gpt-image-2": 1,
            "gemini-3-pro": 2,
            "flux-2-pro": 3,
            "gemini-nano-banana-2-1": 4,
            "gemini-2.5-flash": 5,
        }
    else:
        priorities = {
            "flux-2-pro": 0,
            "gemini-nano-banana-2-1": 1,
            "gemini-2.5-flash": 2,
            "gpt-image-2": 3,
            "gpt-image-1.5": 4,
            "gemini-3-pro": 5,
        }

    return sorted(
        candidates,
        key=lambda candidate: (
            priorities.get(candidate.key, 100),
            candidate.cost_per_generation,
        ),
    )


def execute_with_fallback(
''',
            "engine.py: add fidelity-first ordering",
        )
        text = replace_once(
            text,
            '''            reference_count = len(req.get("referenceUrls", []))
            if feature == "text_to_image":
                if req.get("imageUrl"):
                    reference_count += 1
                if req.get("styleReferenceUrl"):
                    reference_count += 1
''',
            '''            if feature == "text_to_image":
                reference_count = len(text_to_image_images(req))
            else:
                reference_count = len(req.get("referenceUrls") or [])
''',
            "engine.py: count exact Image2 provider inputs",
        )
        pending[path] = text

        # ------------------------------------------------------------------
        # worker/providers/openai.py: do not silently downgrade to text-only.
        # ------------------------------------------------------------------
        path = paths["openai"]
        text = path.read_text(encoding="utf-8")
        text = replace_once(
            text,
            '''    images = input_.get("images")
    has_images = isinstance(images, list) and len(images) > 0
    runner = _run_image_edit if has_images else _run_image_generation
''',
            '''    images = input_.get("images")
    has_images = isinstance(images, list) and len(images) > 0
    if input_.get("require_images") and not has_images:
        raise ProviderError(
            "openai: Image2 expected reference images, but no images were attached"
        )
    runner = _run_image_edit if has_images else _run_image_generation
''',
            "openai.py: reject missing Image2 references",
        )
        pending[path] = text

        # ------------------------------------------------------------------
        # worker/providers/google.py: add REST Interactions API for Nano Banana
        # 2.1; preserve the existing generateContent adapter for legacy models.
        # ------------------------------------------------------------------
        path = paths["google"]
        text = path.read_text(encoding="utf-8")
        text = replace_once(
            text,
            '''def generate(model_id: str, input_: dict, timeout_ms: int) -> dict:
    """Contrat provider : {"images": [{"url": ...}]}. Appel synchrone (pas
    de polling) : timeout_ms est inutilisé, comme dans le port TS."""
    try:
        count = max(1, int(input_.get("quantity") or 1))
    except (TypeError, ValueError):
        count = 1
    with ThreadPoolExecutor(max_workers=count) as pool:
        urls = list(pool.map(lambda _: _run_one(model_id, input_), range(count)))
    return {"images": [{"url": url} for url in urls]}
''',
            '''def _run_interaction_one(model_id: str, input_: dict) -> str:
    """Call the current Gemini Interactions API for Nano Banana 2.1."""
    images = input_.get("images")
    if not isinstance(images, list):
        images = []

    parts = [{"type": "text", "text": str(input_.get("prompt") or "")}]
    for uri in images:
        parsed = parse_data_uri(uri)
        if not parsed:
            raise ProviderError(
                "google: image inputs must be data URIs before calling Interactions API"
            )
        mime, data = parsed
        parts.append({"type": "image", "data": data, "mime_type": mime})

    response_format: dict = {"type": "image", "mime_type": "image/png"}
    aspect_ratio = input_.get("aspectRatio")
    supported_ratios = {
        "1:1", "16:9", "9:16", "4:3", "3:4", "3:2", "2:3", "21:9"
    }
    if aspect_ratio in supported_ratios:
        response_format["aspect_ratio"] = aspect_ratio

    response = post_json(
        "https://generativelanguage.googleapis.com/v1beta/interactions",
        {"x-goog-api-key": require_env("GOOGLE_API_KEY")},
        {"model": model_id, "input": parts, "response_format": response_format},
        timeout_s=300,
    )

    output_image = response.get("output_image")
    if isinstance(output_image, dict) and output_image.get("data"):
        mime = output_image.get("mime_type") or output_image.get("mimeType") or "image/png"
        return f"data:{mime};base64,{output_image['data']}"

    for step in response.get("steps") or []:
        if not isinstance(step, dict) or step.get("type") != "model_output":
            continue
        for block in step.get("content") or []:
            if isinstance(block, dict) and block.get("type") == "image" and block.get("data"):
                mime = block.get("mime_type") or block.get("mimeType") or "image/png"
                return f"data:{mime};base64,{block['data']}"

    raise ProviderError("google: no image returned by Gemini Interactions API")


def generate(model_id: str, input_: dict, timeout_ms: int) -> dict:
    """Return normalized image output using the correct API for the model."""
    images = input_.get("images")
    has_images = isinstance(images, list) and len(images) > 0
    if input_.get("require_images") and not has_images:
        raise ProviderError(
            "google: Image2 expected reference images, but no images were attached"
        )

    try:
        count = max(1, int(input_.get("quantity") or 1))
    except (TypeError, ValueError):
        count = 1

    runner = _run_interaction_one if model_id == "gemini-nano-banana-2.1" else _run_one
    with ThreadPoolExecutor(max_workers=count) as pool:
        urls = list(pool.map(lambda _: runner(model_id, input_), range(count)))
    return {"images": [{"url": url} for url in urls]}
''',
            "google.py: add Interactions API for Nano Banana 2.1",
        )
        pending[path] = text

        # ------------------------------------------------------------------
        # worker/prompts.py: concise image-edit prompt and compact reference map.
        # Keep the existing text-only prompt and its tests unchanged.
        # ------------------------------------------------------------------
        path = paths["prompts"]
        text = path.read_text(encoding="utf-8")
        text = replace_once(
            text,
            '''    has_style = bool(fields.get("styleReferenceUrl"))
    has_element = (
        fields.get("feature") == "text_to_image"
        and bool(fields.get("preserveElementIdentity"))
        and bool(fields.get("imageUrl"))
    )

    if not references and not has_style and not has_element:
        return prompt
''',
            '''    has_style = bool(fields.get("styleReferenceUrl"))
    has_element = (
        fields.get("feature") == "text_to_image"
        and bool(fields.get("preserveElementIdentity"))
        and bool(fields.get("imageUrl"))
    )

    # Image2 needs a compact, explicit image-edit map. The text-only prompt below
    # remains untouched for requests without source images.
    if fields.get("feature") == "text_to_image":
        if not references and not has_style and not has_element:
            return prompt

        image_map = [
            "IMAGE EDIT MAP (provider image order):",
            "Task: edit/composite the supplied source images; do not treat them as generic inspiration.",
        ]
        provider_index = 1
        if has_style:
            image_map.append(
                f"Image {provider_index} is @style: use as an aesthetic guide only; do not copy its subject or composition."
            )
            provider_index += 1
        if has_element:
            image_map.append(
                f"Image {provider_index} is @element: use this actual object as the identity source, not a lookalike."
            )
            provider_index += 1
        for index, tag in enumerate(tags):
            image_map.append(
                f"Image {provider_index + index} is {tag}; use this exact image when the request mentions {tag}."
            )
        image_map.extend([
            "Follow the user's requested image roles and placements. If a source is identified as the base/background, preserve its unrelated areas.",
            "Keep transferred objects recognizable: silhouette, proportions, color, material, texture, distinctive parts and labels. Adapt perspective, lighting and contact shadows only as needed to integrate the same object.",
            "Do only requested changes. Do not replace source objects with generic lookalikes or add unrequested objects.",
        ])
        return prompt + "\\n\\n" + "\\n".join(image_map)

    if not references and not has_style and not has_element:
        return prompt
''',
            "prompts.py: concise Image2 image map",
        )

        text = replace_once(
            text,
            '''def build_text_to_image_prompt(
''',
            '''def build_text_to_image_edit_prompt(
    scene_details=None,
    style_filters=None,
    aspect_ratio=None,
) -> str:
    """Short prompt for requests that include source images."""
    user_description = _sanitize_scene_details(scene_details)
    sections = [
        "IMAGE EDIT / COMPOSITING TASK: Use the supplied images as actual source material. Follow the user's request; this is not text-only image generation.",
        "USER REQUEST:\\n" + (user_description or "Edit the supplied source images conservatively."),
        "IDENTITY AND INTEGRATION: When an object is transferred, use that actual object from its source image rather than a similar replacement. Preserve its distinctive silhouette, proportions, color, material, texture, components and markings. Adapt scale, perspective, lighting and contact shadow to fit the scene. Change only what the request calls for; keep unrelated areas of a designated base image unchanged.",
    ]

    if aspect_ratio and aspect_ratio in IMAGE2_FRAME_SIZE_PROMPTS:
        sections.append("OUTPUT FRAME: " + IMAGE2_FRAME_SIZE_PROMPTS[aspect_ratio])

    selected_filters: list[str] = []
    if isinstance(style_filters, (list, tuple)):
        for value in style_filters:
            if (
                isinstance(value, str)
                and value in IMAGE2_STYLE_FILTER_PROMPTS
                and value not in selected_filters
            ):
                selected_filters.append(value)
    if selected_filters:
        sections.append(
            "STYLE FILTERS (finish only; do not change object identity or scene contents): "
            + ", ".join(f"#{item}" for item in selected_filters)
            + "."
        )
        sections.extend(IMAGE2_STYLE_FILTER_PROMPTS[item] for item in selected_filters)

    return "\\n\\n".join(sections)


def build_text_to_image_prompt(
''',
            "prompts.py: add concise Image2 edit prompt",
        )

        text = replace_once(
            text,
            '''    if feature == "text_to_image":
        return build_text_to_image_prompt(
            scene_details=details,
            has_style_reference=bool(fields.get("styleReferenceUrl")),
            style_filters=fields.get("styleFilters"),
            aspect_ratio=fields.get("aspectRatio"),
            preserve_element_identity=bool(
                fields.get("preserveElementIdentity")
            ),
        )
''',
            '''    if feature == "text_to_image":
        has_source_images = bool(
            fields.get("imageUrl")
            or fields.get("styleReferenceUrl")
            or fields.get("referenceUrls")
        )
        if has_source_images:
            return build_text_to_image_edit_prompt(
                scene_details=details,
                style_filters=fields.get("styleFilters"),
                aspect_ratio=fields.get("aspectRatio"),
            )
        return build_text_to_image_prompt(
            scene_details=details,
            has_style_reference=False,
            style_filters=fields.get("styleFilters"),
            aspect_ratio=fields.get("aspectRatio"),
            preserve_element_identity=False,
        )
''',
            "prompts.py: route Image2 with images to concise edit prompt",
        )
        pending[path] = text

    except Exception as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        print("No files were written.", file=sys.stderr)
        return 3

    tests = '''"""Regression tests for Image2 reference routing and prompt behavior."""
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from catalog import (  # noqa: E402
    MODEL_CATALOG,
    flux2_text_to_image_input,
    openai_flexible_text_to_image_input,
    text_to_image_images,
)
from prompts import add_image_reference_map, build_feature_prompt  # noqa: E402
from providers import google, openai  # noqa: E402
from providers.http_helpers import ProviderError  # noqa: E402
from workflows.engine import order_image2_reference_candidates  # noqa: E402


def _request(**overrides):
    req = {
        "prompt": "Add the chair from @img1 to the room from @img2.",
        "sceneDetails": "Add the chair from @img1 to the room from @img2.",
        "quality": "standard",
        "aspectRatio": "16:9",
        "quantity": 1,
        "preserveElementIdentity": False,
        "styleReferenceUrl": "data:image/png;base64,U1RZTEU=",
        "imageUrl": "data:image/png;base64,RUxFTUVOVA==",
        "referenceUrls": [
            "data:image/png;base64,Q0hBSVI=",
            "data:image/png;base64,Uk9PTQ==",
        ],
        "referenceTags": ["@img1", "@img2"],
        "feature": "text_to_image",
    }
    req.update(overrides)
    return req


def test_primary_image_is_sent_even_when_identity_flag_is_false():
    req = _request(preserveElementIdentity=False)
    images = text_to_image_images(req)
    assert images == [
        req["styleReferenceUrl"],
        req["imageUrl"],
        *req["referenceUrls"],
    ]


def test_openai_flexible_builder_supports_widescreen_with_references():
    payload = openai_flexible_text_to_image_input(_request())
    assert payload["size"] == "1536x864"
    assert payload["require_images"] is True
    assert len(payload["images"]) == 4


def test_flux2_builder_passes_multiple_images_with_correct_fields():
    req = _request(aspectRatio="16:9")
    payload = flux2_text_to_image_input(req)
    assert (payload["width"], payload["height"]) == (1536, 864)
    assert payload["input_image"] == "U1RZTEU="
    assert payload["input_image_2"] == "RUxFTUVOVA=="
    assert payload["input_image_3"] == "Q0hBSVI="
    assert payload["input_image_4"] == "Uk9PTQ=="


def test_pro_reference_ranking_prefers_precision_model_over_cheap_generator():
    candidates = MODEL_CATALOG["text_to_image"]
    ordered = order_image2_reference_candidates(candidates, "pro")
    assert ordered[0].key == "gpt-image-1.5"
    assert ordered[1].key == "gpt-image-2"


def test_image2_uses_compact_edit_prompt_and_image_map():
    req = _request(preserveElementIdentity=True)
    prompt = build_feature_prompt("text_to_image", req)
    mapped = add_image_reference_map(prompt, req)
    assert "IMAGE EDIT / COMPOSITING TASK" in prompt
    assert "Add the chair from @img1 to the room from @img2." in prompt
    assert "Image 1 is @style" in mapped
    assert "Image 2 is @element" in mapped
    assert "Image 3 is @img1" in mapped
    assert "Image 4 is @img2" in mapped


def test_openai_refuses_silent_text_only_fallback():
    with pytest.raises(ProviderError, match="expected reference images"):
        openai.generate("gpt-image-2.5-sunburst", {"require_images": True, "images": []}, 1000)


def test_google_interactions_adapter_sends_images_and_reads_output(monkeypatch):
    captured = {}
    monkeypatch.setattr(google, "require_env", lambda _name: "fake-key")

    def fake_post_json(url, headers, body, timeout_s=60):
        captured["url"] = url
        captured["body"] = body
        return {"output_image": {"data": "R0lGODlh", "mime_type": "image/png"}}

    monkeypatch.setattr(google, "post_json", fake_post_json)
    result = google._run_interaction_one(
        "gemini-nano-banana-2.1",
        {
            "prompt": "Edit the supplied images.",
            "images": ["data:image/png;base64,QUJD"],
            "aspectRatio": "16:9",
        },
    )
    assert captured["url"].endswith("/v1beta/interactions")
    assert captured["body"]["input"][1] == {
        "type": "image", "data": "QUJD", "mime_type": "image/png"
    }
    assert captured["body"]["response_format"]["aspect_ratio"] == "16:9"
    assert result == "data:image/png;base64,R0lGODlh"
'''

    # Validate all source edits and test file path before writing anything.
    for path, new_text in pending.items():
        if not new_text or new_text == path.read_text(encoding="utf-8"):
            raise RuntimeError(f"No effective changes prepared for {path}; no files were written.")

    # Write source files only after all replacements succeeded.
    for path, new_text in pending.items():
        path.write_text(new_text, encoding="utf-8")
    test_path.write_text(tests, encoding="utf-8")

    print("Applied local Image2 patch to:")
    for path in pending:
        print(f"  - {path.relative_to(root)}")
    print(f"  - {test_path.relative_to(root)}")
    print("No GitHub branch, commit, push, or pull request was created.")
    print("Review `git diff`, then run `python -m compileall worker` and `pytest worker/tests`.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
