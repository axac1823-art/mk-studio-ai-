from pathlib import Path
import sys

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


def read(relative: str) -> str:
    path = ROOT / relative
    if not path.is_file():
        raise RuntimeError(f"Missing project file: {relative}. Run this script from the repository root.")
    return path.read_text(encoding="utf-8")


def replace_once(content: str, old: str, new: str, label: str) -> str:
    count = content.count(old)
    if count == 1:
        return content.replace(old, new, 1)
    if count == 0 and new in content:
        return content
    raise RuntimeError(f"Could not safely apply {label}: expected one source match, found {count}.")


def replace_between(content: str, start_marker: str, end_marker: str, replacement: str, label: str) -> str:
    start = content.find(start_marker)
    if start < 0:
        if replacement in content:
            return content
        raise RuntimeError(f"Could not find the start of {label}.")
    end = content.find(end_marker, start + len(start_marker))
    if end < 0:
        raise RuntimeError(f"Could not find the end of {label}.")
    return content[:start] + replacement + content[end:]


def replace_one_of(content: str, choices: list[str], replacement: str, label: str) -> str:
    hits = [old for old in choices if old in content]
    if len(hits) == 1:
        return content.replace(hits[0], replacement, 1)
    if not hits and replacement in content:
        return content
    if len(hits) > 1:
        raise RuntimeError(f"Could not safely apply {label}: multiple older versions were found.")
    raise RuntimeError(f"Could not safely apply {label}: no known source version was found.")


def main() -> int:
    paths = {
        "route": "web/app/api/generate/route.ts",
        "presets": "web/lib/presets.ts",
        "storage": "worker/routes/storage.py",
        "catalog": "worker/catalog.py",
        "workflow": "worker/workflows/image_render.py",
        "prompts": "worker/prompts.py",
    }
    original = {key: read(path) for key, path in paths.items()}
    if "styleReferenceUrl: styleReferenceUrl ?? undefined" in original["route"] and "supports_style_reference" in original["catalog"]:
        print("Image2 multi-input and style-fix updates are already fully applied.")
        return 0
    patched = dict(original)

    # Web API: accept ordered reference metadata for uploads and assets, with
    # a separate Style image, and store paths rather than huge base64 strings in Postgres.
    route = patched["route"]
    if "getAsset," not in route:
        route = replace_once(
            route,
            "import {\n  getDefaultProject,",
            "import {\n  getAsset,\n  getDefaultProject,",
            "project-asset lookup import",
        )
    if "MAX_TOTAL_REFERENCE_SIZE_BYTES" not in route:
        route = replace_once(
            route,
            'import { MAX_QUANTITY, MAX_REFERENCES, SCENE_DETAILS_MAX } from "@/lib/presets";',
            'import {\n  MAX_QUANTITY,\n  MAX_REFERENCES,\n  MAX_REFERENCE_SIZE_BYTES,\n  MAX_TOTAL_REFERENCE_SIZE_BYTES,\n  SCENE_DETAILS_MAX,\n} from "@/lib/presets";',
            "shared image-upload bounds import",
        )
    # An earlier package iteration imported publicUrl. Relative /storage paths
    # are more reliable here because the worker resolves them locally.
    route = route.replace("  publicUrl,\n", "")
    route = replace_one_of(
        route,
        [
            "const MAX_REFERENCE_SIZE = 5 * 1024 * 1024;",
            "const MAX_REFERENCE_SIZE = 50 * 1024 * 1024;",
            "const MAX_REFERENCE_SIZE = 100 * 1024 * 1024;",
            "const MAX_REFERENCE_SIZE = MAX_REFERENCE_SIZE_BYTES;",
        ],
        "const MAX_REFERENCE_SIZE = MAX_REFERENCE_SIZE_BYTES;",
        "per-image upload limit",
    )

    image_marker = '  const image = form.get("image");'
    if "const { dbUser: user } = await requireAuth();" not in route[:route.find(image_marker) if image_marker in route else 0]:
        route = replace_once(
            route,
            image_marker,
            '  const { dbUser: user } = await requireAuth();\n\n' + image_marker,
            "authenticate before resolving reference assets",
        )

    reference_parser = '''  const rawReferenceMetadata = form
    .getAll("referenceMeta")
    .filter((value): value is string => typeof value === "string");
  const referenceItems: Array<{
    tag: string;
    file?: File;
    assetId?: string;
    storagePath?: string;
  }> = [];

  if (rawReferenceMetadata.length > 0) {
    for (let position = 0; position < rawReferenceMetadata.length; position += 1) {
      let metadata: { index?: unknown; source?: unknown; assetId?: unknown; tag?: unknown };
      try {
        metadata = JSON.parse(rawReferenceMetadata[position]) as typeof metadata;
      } catch {
        return NextResponse.json({ error: "Invalid reference metadata." }, { status: 400 });
      }
      const tag = typeof metadata.tag === "string" ? metadata.tag : "";
      const itemIndex = typeof metadata.index === "number" && Number.isInteger(metadata.index)
        ? metadata.index
        : position;
      if (itemIndex < 0 || itemIndex >= MAX_REFERENCES) {
        return NextResponse.json({ error: "Invalid image input index." }, { status: 400 });
      }

      if (metadata.source === "upload") {
        const file = form.get(`referenceFile_${itemIndex}`);
        if (!(file instanceof File)) {
          return NextResponse.json({ error: "An image input is missing its file." }, { status: 400 });
        }
        referenceItems.push({ tag, file });
      } else if (metadata.source === "asset" && typeof metadata.assetId === "string") {
        const asset = await getAsset(user.id, metadata.assetId);
        if (!asset || asset.is_trashed || asset.type !== "image") {
          return NextResponse.json({ error: "One of the selected project images is unavailable." }, { status: 400 });
        }
        referenceItems.push({ tag, assetId: metadata.assetId, storagePath: asset.storage_path });
      } else {
        return NextResponse.json({ error: "Invalid image input source." }, { status: 400 });
      }
    }
  } else {
    // Backwards-compatible parser for existing studio tools using form field reference.
    const legacyFiles = form
      .getAll("reference")
      .filter((value): value is File => value instanceof File && value.size > 0);
    const submittedTags = form.getAll("referenceTag").filter((value): value is string => typeof value === "string");
    if (submittedTags.length > 0 && submittedTags.length !== legacyFiles.length) {
      return NextResponse.json({ error: "Reference labels do not match the attached images." }, { status: 400 });
    }
    legacyFiles.forEach((file, index) => {
      referenceItems.push({ tag: submittedTags[index] ?? `@img${index + 1}`, file });
    });
  }

  // Style is deliberately a separate input; it is not silently treated as @img content.
  let styleReferenceItem: { file?: File; assetId?: string; storagePath?: string } | null = null;
  const rawStyleReferenceMeta = form.get("styleReferenceMeta");
  if (typeof rawStyleReferenceMeta === "string") {
    let metadata: { source?: unknown; assetId?: unknown };
    try {
      metadata = JSON.parse(rawStyleReferenceMeta) as typeof metadata;
    } catch {
      return NextResponse.json({ error: "Invalid style reference metadata." }, { status: 400 });
    }
    if (metadata.source === "upload") {
      const file = form.get("styleReferenceFile");
      if (!(file instanceof File)) {
        return NextResponse.json({ error: "The style reference image is missing its file." }, { status: 400 });
      }
      styleReferenceItem = { file };
    } else if (metadata.source === "asset" && typeof metadata.assetId === "string") {
      const asset = await getAsset(user.id, metadata.assetId);
      if (!asset || asset.is_trashed || asset.type !== "image") {
        return NextResponse.json({ error: "The selected style image is unavailable." }, { status: 400 });
      }
      styleReferenceItem = { assetId: metadata.assetId, storagePath: asset.storage_path };
    } else {
      return NextResponse.json({ error: "Invalid style reference source." }, { status: 400 });
    }
  }

  if (referenceItems.length + (styleReferenceItem ? 1 : 0) > MAX_REFERENCES) {
    return NextResponse.json({ error: `Too many image inputs (${MAX_REFERENCES} max including Style).` }, { status: 400 });
  }
  const referenceFiles = referenceItems.flatMap((item) => item.file ? [item.file] : []);
  const styleReferenceFile = styleReferenceItem?.file;
  if (referenceFiles.some((file) => !validImageFile(file, MAX_REFERENCE_SIZE))
    || (styleReferenceFile && !validImageFile(styleReferenceFile, MAX_REFERENCE_SIZE))) {
    return NextResponse.json(
      { error: "Invalid image input (PNG, JPEG or WebP, 100 MB max each)." },
      { status: 400 }
    );
  }
  const totalReferenceBytes = referenceFiles.reduce((total, file) => total + file.size, 0) + (styleReferenceFile?.size ?? 0);
  if (totalReferenceBytes > MAX_TOTAL_REFERENCE_SIZE_BYTES) {
    return NextResponse.json(
      { error: "Uploaded content and style images exceed the 500 MB combined limit. Remove an image or upload smaller files." },
      { status: 400 }
    );
  }
  let referenceTags = referenceItems.map((item) => item.tag);
  if (referenceTags.some((tag) => !/^@img[1-9]\\d*$/.test(tag)) || new Set(referenceTags).size !== referenceTags.length) {
    return NextResponse.json({ error: "Invalid or repeated image input labels." }, { status: 400 });
  }

'''
    parser_start = '  const rawReferenceMetadata = form\n' if '  const rawReferenceMetadata = form\n' in route else '  const referenceFiles = form\n'
    route = replace_between(route, parser_start, '  const rawQuality = form.get("quality");', reference_parser, "free-form reference and separate style parser")

    late_auth = '  const { dbUser: user } = await requireAuth();\n  const projectIdField = optionalString(form, "projectId");'
    if late_auth in route:
        route = replace_once(route, late_auth, '  const projectIdField = optionalString(form, "projectId");', "remove duplicate authentication call")

    reference_storage = '''  // Save uploads as worker storage files; store only small paths in the jobs JSON.
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
        // The generated job must not fail if optional asset-library indexing fails.
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
        // Keep the style input usable if optional library indexing fails.
      }
      styleReferenceUrl = storagePath;
    }
  } catch {
    return NextResponse.json({ error: "One or more images could not be stored. Try fewer or smaller files." }, { status: 502 });
  }

  // The first provider reference is always Style when it exists; content refs keep @imgN tags.
  if (styleReferenceUrl) {
    referenceUrls.unshift(styleReferenceUrl);
    referenceTags.unshift("@style");
  }

'''
    if '  const referenceUrls = await Promise.all(\n' in route:
        storage_start = '  const referenceUrls = await Promise.all(\n'
    elif '  const referenceUrls: string[] = [];' in route:
        storage_start = '  // Save uploads as worker storage files; store only small paths in the jobs JSON.\n'
        if storage_start not in route:
            storage_start = '  // Store uploaded references as reusable worker assets and keep only URLs\n'
        if storage_start not in route:
            storage_start = '  const referenceUrls: string[] = [];\n'
    else:
        raise RuntimeError("Could not find the reference-storage section in web/app/api/generate/route.ts.")
    route = replace_between(route, storage_start, '  // --- Création du job + démarrage côté worker ---', reference_storage, "store uploaded images as worker assets")
    if "referenceTags," not in route:
        route = replace_once(route, "      referenceUrls,\n      quality,", "      referenceUrls,\n      referenceTags,\n      quality,", "persist reference tags with the job")
    patched["route"] = route

    presets = patched["presets"]
    if "MAX_REFERENCE_SIZE_BYTES" not in presets:
        presets = replace_once(
            presets,
            "export const MAX_REFERENCES = 14;\n",
            "export const MAX_REFERENCES = 14;\nexport const MAX_REFERENCE_SIZE_BYTES = 100 * 1024 * 1024;\nexport const MAX_TOTAL_REFERENCE_SIZE_BYTES = 500 * 1024 * 1024;\n",
            "shared image upload limits",
        )
    else:
        for before, after in [
            ("export const MAX_REFERENCE_SIZE_BYTES = 50 * 1024 * 1024;", "export const MAX_REFERENCE_SIZE_BYTES = 100 * 1024 * 1024;"),
            ("export const MAX_TOTAL_REFERENCE_SIZE_BYTES = 250 * 1024 * 1024;", "export const MAX_TOTAL_REFERENCE_SIZE_BYTES = 500 * 1024 * 1024;"),
        ]:
            if before in presets:
                presets = replace_once(presets, before, after, "update an existing upload limit")
    if "export const MAX_REFERENCE_SIZE_BYTES = 100 * 1024 * 1024;" not in presets or "export const MAX_TOTAL_REFERENCE_SIZE_BYTES = 500 * 1024 * 1024;" not in presets:
        raise RuntimeError("Could not validate shared image-upload size constants.")
    patched["presets"] = presets

    storage_source = patched["storage"]
    storage_source = replace_one_of(
        storage_source,
        [
            "MAX_IMAGE_SIZE = 10 * 1024 * 1024",
            "MAX_IMAGE_SIZE = 50 * 1024 * 1024",
            "MAX_IMAGE_SIZE = 100 * 1024 * 1024",
        ],
        "MAX_IMAGE_SIZE = 100 * 1024 * 1024",
        "worker storage upload cap",
    )
    patched["storage"] = storage_source

    catalog = patched["catalog"]
    if '            "provider": c.provider,' not in catalog:
        catalog = replace_once(
            catalog,
            '            "description": c.description,\n            "configured": is_provider_configured(c.provider),',
            '            "description": c.description,\n            "provider": c.provider,\n            "maxReferences": c.max_references,\n            "configured": is_provider_configured(c.provider),',
            "expose provider and reference capacity to the model selector",
        )
    elif '            "maxReferences": c.max_references,' not in catalog:
        catalog = replace_once(
            catalog,
            '            "provider": c.provider,\n            "configured": is_provider_configured(c.provider),',
            '            "provider": c.provider,\n            "maxReferences": c.max_references,\n            "configured": is_provider_configured(c.provider),',
            "expose image-reference capacity to the model selector",
        )

    bfl_adapter = '''def bfl_text_to_image_input(req: dict) -> dict:
    """BFL text-to-image with one optional image reference."""
    payload: dict = {
        "prompt": req["prompt"],
        "output_format": "jpeg",
        "safety_tolerance": 2,
        "quantity": req["quantity"],
    }
    image = req.get("imageUrl")
    if not image:
        references = req.get("referenceUrls") or []
        image = references[0] if references else None
    if image:
        payload["input_image"] = to_base64_or_url(image)
    return payload
'''
    catalog = replace_between(catalog, "def bfl_text_to_image_input(req: dict) -> dict:", "\n\ndef openai_text_to_image_input", bfl_adapter, "BFL one-image reference adapter")

    openai_adapter = '''def openai_text_to_image_input(req: dict) -> dict:
    """OpenAI image generation, switching to its image-edit endpoint for references."""
    size = (
        "1536x1024"
        if req["aspectRatio"] in ("16:9", "4:3")
        else "1024x1536"
        if req["aspectRatio"] in ("9:16", "3:4")
        else "1024x1024"
    )
    return {
        "prompt": req["prompt"],
        "images": req.get("referenceUrls", []),
        "size": size,
        "quality": "high" if req["quality"] == "pro" else "medium",
        "quantity": req["quantity"],
    }
'''
    catalog = replace_between(catalog, "def openai_text_to_image_input(req: dict) -> dict:", "\ndef google_text_to_image_input", openai_adapter, "OpenAI reference-aware text-to-image adapter")

    candidate_updates = [
        ('Candidate("flux-pro", "Flux Pro", "High quality text-to-image photorealistic renders", "bfl", "flux-pro", 7, 5, 0, IMAGE_TIMEOUT_MS, ("standard", "pro"), bfl_text_to_image_input, extract_image_urls)',
         'Candidate("flux-pro", "Flux Pro", "High quality text-to-image photorealistic renders; supports one reference image", "bfl", "flux-pro", 7, 5, 1, IMAGE_TIMEOUT_MS, ("standard", "pro"), bfl_text_to_image_input, extract_image_urls)'),
        ('Candidate("flux-dev", "Flux Dev", "Fast text-to-image generation", "bfl", "flux-dev", 5, 3, 0, IMAGE_TIMEOUT_MS, ("standard",), bfl_text_to_image_input, extract_image_urls)',
         'Candidate("flux-dev", "Flux Dev", "Fast text-to-image generation; supports one reference image", "bfl", "flux-dev", 5, 3, 1, IMAGE_TIMEOUT_MS, ("standard",), bfl_text_to_image_input, extract_image_urls)'),
        ('Candidate("gpt-image-1", "GPT Image 1", "Versatile OpenAI text-to-image", "openai", "gpt-image-1", 6, 8, 0, IMAGE_TIMEOUT_MS, ("standard", "pro"), openai_text_to_image_input, extract_image_urls)',
         'Candidate("gpt-image-1", "GPT Image 1", "Versatile OpenAI text-to-image with image references", "openai", "gpt-image-1", 6, 8, 13, IMAGE_TIMEOUT_MS, ("standard", "pro"), openai_text_to_image_input, extract_image_urls)'),
        ('Candidate("gemini-2.5-flash", "Gemini 2.5 Flash Image", "Fast text-to-image", "google", "gemini-2.5-flash-image", 3, 3, 0, IMAGE_TIMEOUT_MS, ("standard",), google_text_to_image_input, extract_image_urls)',
         'Candidate("gemini-2.5-flash", "Gemini 2.5 Flash Image", "Fast text-to-image with reference images", "google", "gemini-2.5-flash-image", 3, 3, 13, IMAGE_TIMEOUT_MS, ("standard",), google_text_to_image_input, extract_image_urls)'),
    ]
    for before, after in candidate_updates:
        catalog = replace_one_of(catalog, [before, after], after, "text-to-image reference capacity")
    patched["catalog"] = catalog

    workflow = patched["workflow"]
    if "def _image_reference_to_data_uri(" not in workflow:
        workflow = replace_once(
            workflow,
            "import db\n",
            "import base64\nimport mimetypes\n\nimport db\nimport storage\n",
            "worker image conversion imports",
        )
        helper = '''def _image_reference_to_data_uri(value: str) -> str:
    """Read a local /storage file and turn it into a provider-ready data URI."""
    path_value = value
    if value.startswith("http://") or value.startswith("https://"):
        from urllib.parse import urlparse
        parsed = urlparse(value)
        if parsed.path.startswith("/storage/") and parsed.hostname in {"localhost", "127.0.0.1"}:
            path_value = parsed.path
    if not path_value.startswith("/storage/"):
        return value
    file_path = storage.resolve(path_value)
    mime = mimetypes.guess_type(file_path.name)[0] or "image/png"
    encoded = base64.b64encode(file_path.read_bytes()).decode("ascii")
    return f"data:{mime};base64,{encoded}"


'''
        workflow = replace_once(workflow, "def run(job: dict) -> None:", helper + "def run(job: dict) -> None:", "worker image-reference resolver")

    old_request_line = '            req = {**input_, "prompt": build_feature_prompt(feature, input_)}\n'
    new_request_lines = '''            req = {**input_, "prompt": build_feature_prompt(feature, input_)}
            references = req.get("referenceUrls") or []
            if isinstance(references, list):
                req["referenceUrls"] = [
                    _image_reference_to_data_uri(value) if isinstance(value, str) else value
                    for value in references
                ]
'''
    if '            references = req.get("referenceUrls") or []' not in workflow:
        if old_request_line in workflow:
            workflow = replace_once(workflow, old_request_line, new_request_lines, "prepare local image references for provider calls")
        elif '            reference_urls = req.get("referenceUrls")' in workflow:
            # Upgrade the immediately preceding package iteration, which used
            # storage.image_data_uri_if_local(url) for the same normalization.
            if "storage.image_data_uri_if_local(url)" in workflow:
                workflow = replace_once(
                    workflow,
                    "storage.image_data_uri_if_local(url)",
                    "_image_reference_to_data_uri(url)",
                    "upgrade earlier worker reference normalizer",
                )
            elif "_image_reference_to_data_uri(url)" not in workflow:
                raise RuntimeError("Could not safely upgrade the prior image-reference normalizer.")
        else:
            raise RuntimeError("Could not find the prompt-construction line in image_render.py.")
    elif '            req = {**input_, "prompt": build_feature_prompt(feature, input_)}' not in workflow and '            req = {**input_, "prompt": prompt}' not in workflow:
        raise RuntimeError("Could not find the prompt-construction line in image_render.py.")

    old_candidate_line = '            feature_candidates = MODEL_CATALOG[feature]\n'
    new_candidate_lines = '''            feature_candidates = MODEL_CATALOG[feature]
            if feature == "text_to_image":
                input_count = len(input_.get("referenceUrls") or [])
                feature_candidates = [candidate for candidate in feature_candidates if candidate.max_references >= input_count]
'''
    if 'input_count = len(input_.get("referenceUrls") or [])' not in workflow:
        workflow = replace_once(workflow, old_candidate_line, new_candidate_lines, "filter candidates by the image-input limit")
    elif old_candidate_line not in workflow:
        raise RuntimeError("Could not find model candidate selection in image_render.py.")
    patched["workflow"] = workflow

    mapper = '''def add_image_reference_map(prompt: str, fields: dict) -> str:
    """Map @img tags to attached inputs; @style is a separate aesthetic guide."""
    references = fields.get("referenceUrls") or []
    if not references:
        return prompt
    tags = fields.get("referenceTags") or [f"@img{index + 1}" for index in range(len(references))]
    has_style = bool(tags and tags[0] == "@style")
    lines = []
    if has_style:
        lines.append(
            "@style is the separate style/filter reference (image input 1). Transfer its palette, lighting, mood, material response, "
            "textures, contrast, color grading and rendering technique. Do not copy its subject, objects, geometry or composition unless "
            "the user's prompt explicitly asks for them."
        )
        for image_index, tag in enumerate(tags[1:], start=2):
            lines.append(f"{tag} is content/reference image input {image_index}; use that exact image when the tag is mentioned.")
    else:
        lines = [
            f"{tag} is content/reference image input {index + 1}; use that exact image when the tag is mentioned."
            for index, tag in enumerate(tags[:len(references)])
        ]
    if fields.get("feature") == "text_to_image" and has_style:
        guidance = (
            "IMAGE GENERATION INPUT RULE: Generate the subject and scene described by the user. Use @img references for the specific "
            "content they identify. Use @style only as an aesthetic guide for palette, lighting, atmosphere, materials, texture treatment, "
            "contrast and rendering style. Do not merge the style image's subject or objects into the result unless requested."
        )
    elif fields.get("feature") == "text_to_image":
        guidance = (
            "IMAGE GENERATION INPUT RULE: Each @img is a content/reference image. Follow the user's explicit instructions for each tag; "
            "do not invent fixed roles or priorities. If tags are not mentioned, consider the images together where relevant."
        )
    else:
        guidance = "REFERENCE INPUT RULE: Tags identify exact corresponding attached reference images."
    return prompt + "\\n\\n" + guidance + "\\n" + "\\n".join(lines)
'''
    prompts = patched["prompts"]
    if "def add_image_reference_map(" in prompts:
        prompts = replace_between(prompts, "def add_image_reference_map(", "\n\ndef build_print_render_prompt", mapper, "style and content prompt map")
    else:
        prompts = replace_once(prompts, "def build_print_render_prompt", mapper + "\n\ndef build_print_render_prompt", "insert style and content prompt map")
    prompts = replace_one_of(
        prompts,
        [
            "        return build_text_to_image_prompt(scene_details=details)\n",
            "        return add_image_reference_map(build_text_to_image_prompt(scene_details=details), fields)\n",
        ],
        "        return add_image_reference_map(build_text_to_image_prompt(scene_details=details), fields)\n",
        "apply style and content tags to the generated prompt",
    )
    patched["prompts"] = prompts

    # Validate every target before writing any changes.
    if "referenceTags," not in patched["route"]:
        raise RuntimeError("referenceTags is missing from the saved job input.")
    if '"provider": c.provider' not in patched["catalog"] or '"maxReferences": c.max_references' not in patched["catalog"]:
        raise RuntimeError("The model catalogue is not exposing provider/image-reference metadata.")
    if "add_image_reference_map(build_text_to_image_prompt(scene_details=details), fields)" not in patched["prompts"]:
        raise RuntimeError("The style/content prompt map is not connected to text-to-image generation.")
    if "input_count = len(input_.get(\"referenceUrls\") or [])" not in patched["workflow"]:
        raise RuntimeError("The worker does not filter models by image-reference capacity.")

    for key, relative in paths.items():
        if patched[key] != original[key]:
            (ROOT / relative).write_text(patched[key], encoding="utf-8", newline="\n")

    print("Applied the Image2 Magnific-inspired generation update:")
    print(" - separate Style/Filter input and @img1… content image references")
    print(" - local uploads/project assets stored as paths, not base64 in the jobs table")
    print(" - worker loads image paths and builds a @style-aware generation prompt")
    print(" - per-model provider and image-reference limits are exposed to the UI")
    print(" - candidates unable to accept the submitted image count are excluded")
    print(" - 100 MB per uploaded image and 500 MB total uploaded image data")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        print("No project files were written because validation did not complete.", file=sys.stderr)
        raise SystemExit(1)
