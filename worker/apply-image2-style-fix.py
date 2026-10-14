from pathlib import Path

def find_repository_root() -> Path:
    """Find the repository root even if this installer is launched from worker/."""
    candidates = [Path.cwd(), Path(__file__).resolve().parent, *Path.cwd().resolve().parents, *Path(__file__).resolve().parents]
    seen = set()
    for candidate in candidates:
        candidate = candidate.resolve()
        if candidate in seen:
            continue
        seen.add(candidate)
        if (
            (candidate / "web" / "app" / "api" / "generate" / "route.ts").is_file()
            and (candidate / "worker" / "catalog.py").is_file()
        ):
            return candidate
    raise RuntimeError(
        "Could not locate the repository root. Run this installer from the project root or keep it inside the project's worker/ folder."
    )


ROOT = find_repository_root()


def read(path: str) -> str:
    file = ROOT / path
    if not file.is_file():
        raise RuntimeError(f"Missing {path}. Run the Image2 multi-input installer first.")
    return file.read_text(encoding="utf-8")


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count == 0 and new in text:
        return text
    if count != 1:
        raise RuntimeError(f"Could not safely update {label}: expected one match, found {count}.")
    return text.replace(old, new, 1)


def replace_one_of(text: str, choices: list[str], replacement: str, label: str) -> str:
    matches = [choice for choice in choices if choice in text]
    if len(matches) == 1:
        return text.replace(matches[0], replacement, 1)
    if not matches and replacement in text:
        return text
    if len(matches) > 1:
        raise RuntimeError(f"Could not safely update {label}: multiple known versions are present.")
    raise RuntimeError(f"Could not safely update {label}: no known source version was found.")


def replace_between(text: str, start: str, end: str, replacement: str, label: str) -> str:
    begin = text.find(start)
    if begin < 0:
        if replacement in text:
            return text
        raise RuntimeError(f"Could not find start marker for {label}.")
    finish = text.find(end, begin + len(start))
    if finish < 0:
        raise RuntimeError(f"Could not find end marker for {label}.")
    return text[:begin] + replacement + text[finish:]


def main() -> int:
    files = {
        "route": "web/app/api/generate/route.ts",
        "catalog": "worker/catalog.py",
        "workflow": "worker/workflows/image_render.py",
        "prompts": "worker/prompts.py",
    }
    original = {key: read(path) for key, path in files.items()}
    if (
        "styleReferenceUrl: styleReferenceUrl ?? undefined" in original["route"]
        and "supports_style_reference" in original["catalog"]
        and "style_reference = req.get(\"styleReferenceUrl\")" in original["workflow"]
        and "HIGHEST-PRIORITY STYLE TRANSFER: @style must control the final image's visual treatment" in original["prompts"]
    ):
        print("Image2 Style/Filter fidelity fix is already applied.")
        return 0
    patched = dict(original)

    # Keep Style completely separate from content reference URLs and @img tags.
    route = patched["route"]
    storage_start = '  // Save uploads as worker storage files; store only small paths in the jobs JSON.\n'
    storage_end = '  // --- Création du job + démarrage côté worker ---'
    style_store = '''  // Store content references and Style separately. Style must never occupy the @img1 slot.
  const referenceUrls: string[] = [];
  let styleReferenceUrl: string | null = null;
  try {
    for (const reference of referenceItems) {
      if (reference.storagePath) {
        referenceUrls.push(reference.storagePath);
        continue;
      }
      if (!reference.file) {
        return NextResponse.json({ error: "An image input could not be read." }, { status: 400 });
      }
      const buffer = Buffer.from(await reference.file.arrayBuffer());
      const storagePath = await uploadSource(buffer, reference.file.type);
      try {
        await insertSourceAsset({ userId: user.id, projectId: project.id, type: "image", storagePath });
      } catch {
        // Asset-library indexing is optional; the generation input remains valid.
      }
      referenceUrls.push(storagePath);
    }

    if (styleReferenceItem?.storagePath) {
      styleReferenceUrl = styleReferenceItem.storagePath;
    } else if (styleReferenceItem?.file) {
      const buffer = Buffer.from(await styleReferenceItem.file.arrayBuffer());
      const storagePath = await uploadSource(buffer, styleReferenceItem.file.type);
      try {
        await insertSourceAsset({ userId: user.id, projectId: project.id, type: "image", storagePath });
      } catch {
        // Style input stays available even if optional asset-library indexing fails.
      }
      styleReferenceUrl = storagePath;
    }
  } catch {
    return NextResponse.json({ error: "One or more images could not be stored. Try fewer or smaller files." }, { status: 502 });
  }

'''
    route = replace_between(route, storage_start, storage_end, style_store, "separate Style storage")
    route = replace_once(
        route,
        "      referenceUrls,\n      referenceTags,\n      quality,",
        "      referenceUrls,\n      referenceTags,\n      styleReferenceUrl: styleReferenceUrl ?? undefined,\n      quality,",
        "save Style URL separately on the job",
    )
    patched["route"] = route

    catalog = patched["catalog"]
    if "supports_style_reference: bool = False" not in catalog:
        catalog = replace_once(
            catalog,
            "    supports_image_to_3d: bool = False\n",
            "    supports_image_to_3d: bool = False\n    # True only for adapters that pass images as multimodal context, not as the image being edited.\n    supports_style_reference: bool = False\n",
            "declare per-model style-reference capability",
        )
    if '"supportsStyleReference": c.supports_style_reference,' not in catalog:
        catalog = replace_once(
            catalog,
            '            "maxReferences": c.max_references,\n',
            '            "maxReferences": c.max_references,\n            "supportsStyleReference": c.supports_style_reference,\n',
            "expose style-reference capability",
        )

    google_adapter = '''def google_text_to_image_input(req: dict) -> dict:
    """Google multimodal generation: keep Style explicit and ahead of content references."""
    images: list[str] = []
    style_image = req.get("styleReferenceUrl")
    if isinstance(style_image, str) and style_image:
        images.append(style_image)
    images.extend(req.get("referenceUrls") or [])
    return {
        "prompt": req["prompt"],
        "images": images,
        "quantity": req["quantity"],
    }
'''
    catalog = replace_between(
        catalog,
        "def google_text_to_image_input(req: dict) -> dict:",
        "\n\n# --- LE CATALOGUE ---",
        google_adapter,
        "Google Style-aware multimodal input adapter",
    )

    # OpenAI's edit adapter accepts multiple image[] inputs. Keep Style as
    # provider input 1 and content references after it; Auto is not tied to Google.
    openai_adapter = '''def openai_text_to_image_input(req: dict) -> dict:
    """OpenAI image generation/edit with a dedicated Style input when supplied."""
    size = (
        "1536x1024"
        if req["aspectRatio"] in ("16:9", "4:3")
        else "1024x1536"
        if req["aspectRatio"] in ("9:16", "3:4")
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
    catalog = replace_between(
        catalog,
        "def openai_text_to_image_input(req: dict) -> dict:",
        "\ndef google_text_to_image_input",
        openai_adapter,
        "OpenAI Style-aware multi-image adapter",
    )
    gemini_new = 'Candidate("gemini-2.5-flash", "Gemini 2.5 Flash Image", "Fast text-to-image with Style and content references", "google", "gemini-2.5-flash-image", 3, 3, 13, IMAGE_TIMEOUT_MS, ("standard",), google_text_to_image_input, extract_image_urls, supports_style_reference=True)'
    gemini_versions = [
        'Candidate("gemini-2.5-flash", "Gemini 2.5 Flash Image", "Fast text-to-image with reference images", "google", "gemini-2.5-flash-image", 3, 3, 13, IMAGE_TIMEOUT_MS, ("standard",), google_text_to_image_input, extract_image_urls)',
        'Candidate("gemini-2.5-flash", "Gemini 2.5 Flash Image", "Fast text-to-image with reference images and dedicated Style guidance", "google", "gemini-2.5-flash-image", 3, 3, 13, IMAGE_TIMEOUT_MS, ("standard",), google_text_to_image_input, extract_image_urls, supports_style_reference=True)',
    ]
    catalog = replace_one_of(catalog, gemini_versions, gemini_new, "enable Gemini Style input")
    openai_old = 'Candidate("gpt-image-1", "GPT Image 1", "Versatile OpenAI text-to-image with image references", "openai", "gpt-image-1", 6, 8, 13, IMAGE_TIMEOUT_MS, ("standard", "pro"), openai_text_to_image_input, extract_image_urls)'
    openai_new = 'Candidate("gpt-image-1", "GPT Image 1", "Versatile OpenAI text-to-image with Style and content references", "openai", "gpt-image-1", 6, 8, 13, IMAGE_TIMEOUT_MS, ("standard", "pro"), openai_text_to_image_input, extract_image_urls, supports_style_reference=True)'
    catalog = replace_once(catalog, openai_old, openai_new, "enable OpenAI Style reference support")
    patched["catalog"] = catalog

    workflow = patched["workflow"]
    request_old_choices = [
        '''            req = {**input_, "prompt": build_feature_prompt(feature, input_)}
            references = req.get("referenceUrls") or []
            if isinstance(references, list):
                req["referenceUrls"] = [
                    _image_reference_to_data_uri(value) if isinstance(value, str) else value
                    for value in references
                ]
''',
        '''            prompt = build_feature_prompt(feature, input_)
            prompt = add_image_reference_map(prompt, input_)
            req = {**input_, "prompt": prompt}
            # References are stored as worker asset URLs to keep large image data out of the jobs row.
            # Convert local worker assets to inline data URIs immediately before provider adapters consume them.
            reference_urls = req.get("referenceUrls")
            if isinstance(reference_urls, list):
                req["referenceUrls"] = [
                    _image_reference_to_data_uri(url) if isinstance(url, str) else url
                    for url in reference_urls
                ]
''',
    ]
    request_new = '''            prompt = build_feature_prompt(feature, input_)
            prompt = add_image_reference_map(prompt, input_)
            req = {**input_, "prompt": prompt}
            # References are stored as worker asset URLs to keep large image data out of the jobs row.
            # Convert local worker assets to inline data URIs immediately before provider adapters consume them.
            reference_urls = req.get("referenceUrls")
            if isinstance(reference_urls, list):
                req["referenceUrls"] = [
                    _image_reference_to_data_uri(url) if isinstance(url, str) else url
                    for url in reference_urls
                ]
            style_reference = req.get("styleReferenceUrl")
            if isinstance(style_reference, str) and style_reference:
                req["styleReferenceUrl"] = _image_reference_to_data_uri(style_reference)
'''
    if "style_reference = req.get(\"styleReferenceUrl\")" not in workflow:
        workflow = replace_one_of(workflow, request_old_choices, request_new, "normalize Style image storage URL")
    elif "build_feature_prompt(feature, input_)" not in workflow:
        raise RuntimeError("Could not verify worker prompt request setup.")

    candidate_old = '''            if feature == "text_to_image":
                input_count = len(input_.get("referenceUrls") or [])
                feature_candidates = [candidate for candidate in feature_candidates if candidate.max_references >= input_count]
'''
    candidate_new = '''            if feature == "text_to_image":
                content_count = len(input_.get("referenceUrls") or [])
                has_style_reference = bool(input_.get("styleReferenceUrl"))
                input_count = content_count + (1 if has_style_reference else 0)
                feature_candidates = [
                    candidate for candidate in feature_candidates
                    if candidate.max_references >= input_count
                    and (not has_style_reference or candidate.supports_style_reference)
                ]
                # Real Auto: only configured providers are candidates. The normal
                # quality/cost ranking still applies to the providers that are ready.
                selected_model = input_.get("model")
                if not selected_model or selected_model == "auto":
                    feature_candidates = [
                        candidate for candidate in feature_candidates
                        if is_provider_configured(candidate.provider)
                    ]
                if not feature_candidates:
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
    if candidate_old in workflow:
        workflow = replace_once(workflow, candidate_old, candidate_new, "filter by Style capability, not only image count")
    elif "if not selected_model or selected_model == \"auto\":" not in workflow:
        # Upgrade the earlier Style-fix iteration, which filtered by capability
        # but did not exclude unconfigured providers from Auto.
        old_style_start = '''            if feature == "text_to_image":
                content_count = len(input_.get("referenceUrls") or [])'''
        if old_style_start in workflow:
            workflow = replace_between(
                workflow,
                old_style_start,
                "\n            candidates = order_candidates",
                candidate_new.rstrip(),
                "upgrade Auto to configured-provider selection",
            )
        else:
            raise RuntimeError("Could not find a known Text-to-Image candidate-selection block to update.")
    if "from providers import is_provider_configured" not in workflow:
        workflow = replace_once(
            workflow,
            "from catalog import MODEL_CATALOG\n",
            "from catalog import MODEL_CATALOG\nfrom providers import is_provider_configured\n",
            "filter Auto to configured providers",
        )
    patched["workflow"] = workflow

    prompts = patched["prompts"]
    style_mapper = '''def add_image_reference_map(prompt: str, fields: dict) -> str:
    """Describe independent visual inputs without assigning Style the subject role."""
    references = fields.get("referenceUrls") or []
    tags = fields.get("referenceTags") or [f"@img{index + 1}" for index in range(len(references))]
    has_style = bool(fields.get("styleReferenceUrl"))
    if not references and not has_style:
        return prompt

    lines: list[str] = []
    if has_style:
        lines.append(
            "The separate Style/Filter image is input image 1 and is named @style. It is an aesthetic reference only, "
            "not the subject image and not a composition to copy. Match its actual visual signature faithfully: overall "
            "luminance, exposure, highlight roll-off, shadow depth, contrast curve, saturation, palette, color temperature, "
            "texture character, material response, grain, edge treatment and rendering medium."
        )
    for index, tag in enumerate(tags[:len(references)]):
        provider_index = index + (2 if has_style else 1)
        lines.append(
            f"{tag} is content/reference image {provider_index}; use its subject or details only as directed by the user's prompt."
        )

    if fields.get("feature") == "text_to_image" and has_style:
        guidance = (
            "HIGHEST-PRIORITY STYLE TRANSFER: @style must control the final image's visual treatment. Keep the requested subject, "
            "objects and scene from the written prompt and @img content references, but make the result look as though it was "
            "created with the same art direction as @style. Do not copy @style's subject, objects, architecture or layout unless asked. "
            "Do not brighten, warm, whiten, increase exposure, soften shadows, boost saturation, add gloss, or convert the result to "
            "generic photorealistic / high-key architectural imagery unless those traits are visibly present in @style. If @style is dark, "
            "muted, low-key, cool, monochrome, matte, grainy, painterly, graphic, cinematic or high-contrast, preserve that character. "
            "Do not insert any unrequested default lighting or color-grade."
        )
    elif fields.get("feature") == "text_to_image":
        guidance = (
            "CONTENT REFERENCE RULE: the @img labels point to content images, not hidden fixed roles. Follow the user's prompt to decide "
            "what to retain or borrow. Do not impose a default daylight, high-key, warm, glossy or bright visual style; follow the user's description."
        )
    else:
        guidance = "REFERENCE INPUT RULE: the @img labels identify their corresponding content/reference images."
    return prompt + "\\n\\n" + guidance + "\\n" + "\\n".join(lines)
'''
    prompts = replace_between(
        prompts,
        "\ndef add_image_reference_map(prompt: str, fields: dict) -> str:",
        "\n\ndef build_print_render_prompt",
        "\n" + style_mapper,
        "rewrite the Style prompt mapper",
    )

    text_to_image = '''def build_text_to_image_prompt(scene_details=None, has_style_reference=False) -> str:
    """Text-to-image prompt with no baked-in bright/daylight aesthetic."""
    parts = [
        (
            "Create the subject and scene described by the user as a coherent, intentional image. Preserve explicit choices for "
            "subject, composition, camera, materials, palette, lighting, time of day, mood and visual medium. Do not assume an "
            "unrequested style or lighting setup."
        ),
        (
            "Maintain internal visual consistency: believable proportions where relevant, coherent perspective, consistent object "
            "identity, intentional detail hierarchy and clean rendering appropriate to the requested medium."
        ),
    ]
    if has_style_reference:
        parts.extend([
            (
                "A dedicated Style/Filter reference is attached. Its visual appearance takes priority over generic image-quality defaults. "
                "Reproduce its actual tonal range, brightness, contrast, shadow density, highlight behavior, saturation, palette, color cast, "
                "surface finish, texture, edge quality and art direction. The result may be dark, subdued, cool, low-key, matte, stylized or "
                "illustrative when that is what the reference shows."
            ),
            (
                "Do not automatically make the image bright, airy, warm, sunlit, glossy, clean-white, saturated or conventionally photorealistic. "
                "Do not add soft natural daylight, golden-hour light, ambient glow, glossy reflections or lifted shadows unless the Style image "
                "or user's written prompt calls for them."
            ),
        ])
    else:
        parts.append(
            "Let the user's prompt decide the lighting and mood. Do not add default daylight, high-key exposure, warm color grading, glossy materials or artificial glow when they were not requested."
        )
    parts.append(_sanitize_scene_details(scene_details))
    return _join(parts)
'''
    prompts = replace_between(
        prompts,
        "\ndef build_text_to_image_prompt(scene_details=None) -> str:",
        "\n\ndef build_feature_prompt",
        "\n" + text_to_image,
        "remove hard-coded image-generation art direction",
    )

    prompts = replace_one_of(
        prompts,
        [
            '        return build_text_to_image_prompt(scene_details=details)\n',
            '        return add_image_reference_map(build_text_to_image_prompt(scene_details=details), fields)\n',
            '        return add_image_reference_map(\n            build_text_to_image_prompt(scene_details=details, has_style_reference=bool(fields.get("styleReferenceUrl"))),\n            fields,\n        )\n',
        ],
        '        return add_image_reference_map(\n            build_text_to_image_prompt(scene_details=details, has_style_reference=bool(fields.get("styleReferenceUrl"))),\n            fields,\n        )\n',
        "give Style-aware prompt builder a separate flag",
    )
    patched["prompts"] = prompts

    # Validate all changes before writing any file.
    assert "referenceUrls.unshift(styleReferenceUrl)" not in patched["route"]
    assert "styleReferenceUrl: styleReferenceUrl ?? undefined" in patched["route"]
    assert '"supportsStyleReference": c.supports_style_reference' in patched["catalog"]
    assert 'supports_style_reference=True)' in patched["catalog"]
    assert '"gpt-image-1", "GPT Image 1", "Versatile OpenAI text-to-image with Style and content references"' in patched["catalog"]
    assert "from providers import is_provider_configured" in patched["workflow"]
    assert "if not selected_model or selected_model == \"auto\":" in patched["workflow"]
    assert "req.get(\"styleReferenceUrl\")" in patched["catalog"]
    assert "candidate.supports_style_reference" in patched["workflow"]
    assert "style_reference = req.get(\"styleReferenceUrl\")" in patched["workflow"]
    assert "has_style_reference=bool(fields.get(\"styleReferenceUrl\"))" in patched["prompts"]
    assert "Do not automatically make the image bright, airy, warm, sunlit" in patched["prompts"]

    for key, path in files.items():
        if patched[key] != original[key]:
            (ROOT / path).write_text(patched[key], encoding="utf-8", newline="\n")

    print("Applied Image2 Style/Filter fidelity fix:")
    print(" - Style is persisted separately from @img content images")
    print(" - only multimodal adapters declared Style-capable can run with a Style image")
    print(" - Auto considers every configured Style-capable provider, ranked by the existing quality/cost policy")
    print(" - OpenAI GPT Image 1 and Google Gemini 2.5 Flash Image can receive Style as the first image input")
    print(" - removed default bright/daylight/glossy image-generation assumptions")
    print(" - prompt explicitly preserves the reference's actual tonal range and art direction")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
