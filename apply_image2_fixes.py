from __future__ import annotations

import argparse
import subprocess
import sys
import tempfile
from datetime import datetime
from pathlib import Path


REPO_ROOT = Path.cwd()
REVIEWED_CODEX_HEAD = "32e26de9b1193e0e69a144512e1c1a6abc330f8e"
FILE_NEWLINES: dict[Path, str] = {}


def run_git(root: Path, *args: str) -> str:
    result = subprocess.run(
        ["git", *args], cwd=root, text=True, capture_output=True, check=False
    )
    if result.returncode:
        raise RuntimeError(result.stderr.strip() or f"git {' '.join(args)} failed")
    return result.stdout.strip()


def replace_once(source: str, old: str, new: str, label: str) -> str:
    count = source.count(old)
    if count != 1:
        raise RuntimeError(
            f"Preflight failed for {label}: expected exactly one match, found {count}. "
            "No files were written. Make sure this is the reviewed codex source."
        )
    return source.replace(old, new, 1)


def apply_text_changes(root: Path, changes: dict[str, list[tuple[str, str, str]]]) -> dict[Path, str]:
    staged: dict[Path, str] = {}
    for relative, replacements in changes.items():
        path = root / relative
        if not path.is_file():
            raise RuntimeError(f"Required project file not found: {relative}")
        raw_source = path.read_bytes().decode("utf-8")
        newline = "\r\n" if "\r\n" in raw_source else "\n"
        FILE_NEWLINES[path] = newline
        source = raw_source.replace("\r\n", "\n")
        for old, new, label in replacements:
            source = replace_once(source, old, new, f"{relative}: {label}")
        staged[path] = source
    return staged


def add_test_file(root: Path, relative: str, content: str) -> tuple[Path, bool]:
    path = root / relative
    if path.exists():
        existing = path.read_text(encoding="utf-8")
        if existing == content:
            return path, False
        raise RuntimeError(
            f"Test file already exists with different content: {relative}. "
            "No files were written. Review it manually before applying."
        )
    return path, True


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Apply the reviewed Image2 fixes to the local Renderuim repository."
    )
    parser.add_argument(
        "--allow-non-codex",
        action="store_true",
        help="Allow applying to a branch other than codex after the source preflight passes.",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Validate all source matches without writing files.",
    )
    args = parser.parse_args()

    root = Path(run_git(REPO_ROOT, "rev-parse", "--show-toplevel"))
    branch = run_git(root, "branch", "--show-current")
    local_head = run_git(root, "rev-parse", "HEAD")
    if branch != "codex" and not args.allow_non_codex:
        raise RuntimeError(
            f"Current branch is '{branch}', not 'codex'. Switch to codex, or pass "
            "--allow-non-codex only after confirming the same source version."
        )

    status = run_git(root, "status", "--short")
    if status:
        print("WARNING: your worktree already has local changes:")
        print(status)
        print("The script will back up every file it changes before writing.")

    changes = {
        "worker/catalog.py": [
            (
                'def normalize_image2_reference_roles(req: dict) -> list[str]:\n'
                '    """Resolve explicit prompt declarations before saved roles and legacy defaults."""',
                'def normalize_image2_reference_roles(req: dict) -> list[str]:\n'
                '    """Keep saved UI roles authoritative; infer roles only for legacy requests."""',
                "make the role contract explicit",
            ),
            (
                'def text_to_image_images(req: dict) -> list[str]:\n',
                'def image2_frame_reference(req: dict) -> str | None:\n'
                '    """Choose the only valid source for Auto framing: Base, primary, then Element.\n\n'
                '    Style and Detail images are deliberately excluded because they do not define\n'
                '    the destination frame.\n'
                '    """\n'
                '    references = req.get("referenceUrls") or []\n'
                '    if not isinstance(references, (list, tuple)):\n'
                '        references = []\n'
                '    roles = normalize_image2_reference_roles(req)\n'
                '    base_index = next((i for i, role in enumerate(roles) if role == "base"), None)\n'
                '    if base_index is not None and base_index < len(references):\n'
                '        return references[base_index]\n'
                '    primary = req.get("imageUrl")\n'
                '    if isinstance(primary, str) and primary.strip():\n'
                '        return primary\n'
                '    element_index = next((i for i, role in enumerate(roles) if role == "element"), None)\n'
                '    if element_index is not None and element_index < len(references):\n'
                '        return references[element_index]\n'
                '    return None\n\n\n'
                'def text_to_image_images(req: dict) -> list[str]:\n',
                "add deterministic Auto frame-source selection",
            ),
            (
                '    ratio = req.get("aspectRatio") or "auto"\n\n'
                '    supported_ratios = {"auto", "1:1", "16:9", "9:16", "4:3", "3:2", "2:3"}',
                '    ratio = req.get("aspectRatio") or "auto"\n'
                '    if ratio == "auto":\n'
                '        ratio = req.get("resolvedAspectRatio") or "4:3"\n\n'
                '    supported_ratios = {"auto", "1:1", "16:9", "9:16", "4:3", "3:2", "2:3"}',
                "pass a concrete resolved frame to Magic Hour",
            ),
        ],
        "worker/workflows/image_render.py": [
            (
                'import mimetypes\n',
                '',
                "remove the duplicate local MIME handling",
            ),
            (
                'def _image_reference_to_data_uri(value: str) -> str:\n'
                '    """Read a local /storage file and turn it into a provider-ready data URI."""\n'
                '    path_value = value\n'
                '    if value.startswith("http://") or value.startswith("https://"):\n'
                '        from urllib.parse import urlparse\n'
                '        parsed = urlparse(value)\n'
                '        if parsed.path.startswith("/storage/") and parsed.hostname in {"localhost", "127.0.0.1"}:\n'
                '            path_value = parsed.path\n'
                '    if not path_value.startswith("/storage/"):\n'
                '        return value\n'
                '    file_path = storage.resolve(path_value)\n'
                '    mime = mimetypes.guess_type(file_path.name)[0] or "image/png"\n'
                '    encoded = base64.b64encode(file_path.read_bytes()).decode("ascii")\n'
                '    return f"data:{mime};base64,{encoded}"',
                'def _image_reference_to_data_uri(value: str) -> str:\n'
                '    """Convert any URL pointing to this worker storage into a data URI."""\n'
                '    return storage.image_data_uri_if_local(value)',
                "normalize worker storage URLs independently of localhost/LAN hostname",
            ),
            (
                '    image2_identity_object_count,\n'
                '    normalize_image2_reference_roles,',
                '    image2_frame_reference,\n'
                '    image2_identity_object_count,\n'
                '    normalize_image2_reference_roles,',
                "import the shared frame-source resolver",
            ),
            (
                '                requested_ratio = input_.get("aspectRatio") or "4:3"\n'
                '                if requested_ratio == "auto":\n'
                '                    source_for_ratio = req.get("imageUrl")\n'
                '                    if not source_for_ratio:\n'
                '                        references_for_ratio = req.get("referenceUrls") or []\n'
                '                        reference_roles = input_.get("referenceRoles") or []\n'
                '                        base_index = next(\n'
                '                            (index for index, role in enumerate(reference_roles) if role == "base"),\n'
                '                            None,\n'
                '                        )\n'
                '                        element_index = next(\n'
                '                            (index for index, role in enumerate(reference_roles) if role == "element"),\n'
                '                            None,\n'
                '                        )\n'
                '                        source_index = base_index if base_index is not None else element_index\n'
                '                        if source_index is None:\n'
                '                            source_index = 0 if references_for_ratio else None\n'
                '                        source_for_ratio = (\n'
                '                            references_for_ratio[source_index]\n'
                '                            if source_index is not None and source_index < len(references_for_ratio)\n'
                '                            else None\n'
                '                        )\n'
                '                    req["resolvedAspectRatio"] = _infer_aspect_ratio(source_for_ratio)\n'
                '                else:\n'
                '                    req["resolvedAspectRatio"] = requested_ratio',
                '                requested_ratio = input_.get("aspectRatio") or "4:3"\n'
                '                if requested_ratio == "auto":\n'
                '                    # Base is the destination frame. Only if it is absent may the\n'
                '                    # primary image or an Element reference define the frame.\n'
                '                    source_for_ratio = image2_frame_reference(req)\n'
                '                    req["resolvedAspectRatio"] = _infer_aspect_ratio(source_for_ratio)\n'
                '                else:\n'
                '                    req["resolvedAspectRatio"] = requested_ratio',
                "make Base authoritative for Auto framing",
            ),
            (
                '                # Explicit frames are filtered before model ordering. Auto remains provider-selected.\n'
                '                if requested_ratio != "auto":\n'
                '                    selected_candidate = next(\n'
                '                        (candidate for candidate in feature_candidates if candidate.key == selected_model),\n'
                '                        None,\n'
                '                    )\n'
                '                    if selected_candidate and requested_ratio not in selected_candidate.frame_ratios:\n'
                '                        supported = ", ".join(selected_candidate.frame_ratios) or "none reported"\n'
                '                        raise ValueError(\n'
                '                            f"{selected_candidate.name} does not support {requested_ratio}. Supported frames: {supported}."\n'
                '                        )\n'
                '                    feature_candidates = filter_candidates_by_frame(feature_candidates, requested_ratio)\n'
                '                    if not feature_candidates:\n'
                '                        raise ValueError(\n'
                '                            f"No configured Text-to-Image model supports {requested_ratio}. Choose a supported frame or another model."\n'
                '                        )',
                '                # The resolved frame is binding in both explicit and Auto modes.\n'
                '                # Never let Auto choose a model that changes the source frame.\n'
                '                target_frame = req.get("resolvedAspectRatio") or requested_ratio\n'
                '                selected_candidate = next(\n'
                '                    (candidate for candidate in feature_candidates if candidate.key == selected_model),\n'
                '                    None,\n'
                '                )\n'
                '                if selected_candidate and target_frame not in selected_candidate.frame_ratios:\n'
                '                    supported = ", ".join(selected_candidate.frame_ratios) or "none reported"\n'
                '                    raise ValueError(\n'
                '                        f"{selected_candidate.name} does not support {target_frame}. Supported frames: {supported}."\n'
                '                    )\n'
                '                feature_candidates = filter_candidates_by_frame(feature_candidates, target_frame)\n'
                '                if not feature_candidates:\n'
                '                    raise ValueError(\n'
                '                        f"No configured Text-to-Image model supports {target_frame}. Choose a compatible model or frame."\n'
                '                    )',
                "enforce frame compatibility in Auto and manual selection",
            ),
            (
                '            if feature == "text_to_image" and (input_.get("aspectRatio") or "4:3") != "auto":\n'
                '                expected_frame = input_.get("aspectRatio") or "4:3"\n'
                '                output_transformer = lambda urls, _candidate: normalize_image_output_frame(urls, expected_frame)\n'
                '                output_validator = lambda urls, _candidate: validate_image_output_frame(urls, expected_frame)',
                '            if feature == "text_to_image":\n'
                '                # Auto uses the frame resolved from Base/primary/Element above.\n'
                '                expected_frame = req.get("resolvedAspectRatio") or "4:3"\n'
                '                output_transformer = lambda urls, _candidate: normalize_image_output_frame(urls, expected_frame)\n'
                '                output_validator = lambda urls, _candidate: validate_image_output_frame(urls, expected_frame)',
                "validate and non-destructively normalize Auto outputs too",
            ),
        ],
        "worker/workflows/engine.py": [
            (
                'from catalog import Candidate\n',
                'from catalog import Candidate, text_to_image_images\n',
                "import the canonical Image2 image list helper",
            ),
            (
                '            reference_count = len(req.get("referenceUrls", []))\n'
                '            if feature == "text_to_image" and req.get("imageUrl"):\n'
                '                reference_count += 1',
                '            reference_count = (\n'
                '                len(text_to_image_images(req))\n'
                '                if feature == "text_to_image"\n'
                '                else len(req.get("referenceUrls", []))\n'
                '            )',
                "count separate Style, primary, and tagged references consistently",
            ),
        ],
        "worker/providers/magichour.py": [
            (
                'def _run_image_generator(model_id: str, input_: dict, timeout_ms: int) -> str:\n'
                '    """Magic Hour image generator, including Image2 reference assets."""',
                'def _run_image_generator(model_id: str, input_: dict, timeout_ms: int) -> str:\n'
                '    """Magic Hour text-to-image endpoint for requests without source images."""',
                "document that the generator is text-only",
            ),
            (
                '    images = input_.get("images")\n\n'
                '    if isinstance(images, list) and images:\n'
                '        with ThreadPoolExecutor(max_workers=max(1, len(images))) as pool:\n'
                '            file_paths = list(pool.map(_ensure_file_path, images))\n\n'
                '        payload["assets"] = {\n'
                '            "image_file_paths": file_paths\n'
                '        }',
                '    images = input_.get("images")\n'
                '    if isinstance(images, list) and images:\n'
                '        raise ProviderError(\n'
                '            "magichour: source images must be sent through the AI Image Editor endpoint"\n'
                '        )',
                "prevent unsupported reference-image payloads on the generator endpoint",
            ),
            (
                'def generate(model_id: str, input_: dict, timeout_ms: int) -> dict:\n'
                '    """Route Image2 through the generator and other image edits through the editor."""',
                'def generate(model_id: str, input_: dict, timeout_ms: int) -> dict:\n'
                '    """Use the generator for text-only requests and the editor for image-backed requests."""',
                "correct provider routing documentation",
            ),
            (
                '    if isinstance(input_.get("images"), list):',
                '    images = input_.get("images")\n    if isinstance(images, list):',
                "capture the image array before routing Magic Hour by actual inputs",
            ),
            (
                '        runner = _run_image_generator if input_.get("is_text_to_image") else _run_image_edit',
                '        # The generator endpoint is text-only in the documented API contract.\n'
                '        # Any attached image must go through the editor endpoint that accepts\n'
                '        # assets.image_file_paths, including Image2 reference-guided jobs.\n'
                '        runner = _run_image_edit if images else _run_image_generator',
                "route every request with images through Magic Hour Editor",
            ),
        ],
        "worker/prompts.py": [
            (
                '        lines.append(\n'
                '            "HIGHEST-PRIORITY STYLE TRANSFER: the separate Style reference is provider input 1 (@style). "\n'
                '            "Use it only for palette, lighting, contrast, "\n'
                '            "texture and rendering medium; never copy its subject, objects, architecture or scene."\n'
                '        )',
                '        lines.append(\n'
                '            "HIGHEST-PRIORITY STYLE TRANSFER: the separate Style reference is provider input 1 (@style). "\n'
                '            "Transfer only its visual treatment: relative luminance and exposure, highlight roll-off, "\n'
                '            "shadow depth and retained shadow detail, contrast curve, saturation, palette, white balance, "\n'
                '            "color temperature, material response, texture or grain, surface finish and edge treatment. "\n'
                '            "Adapt the lighting coherently to the destination scene. Never copy its subject, objects, "\n'
                '            "architecture or background, and do not impose an unrelated style."\n'
                '        )',
                "make Style transfer specific without imposing a default aesthetic",
            ),
            (
                '        "style": "Style reference only: borrow lighting, colors and visual treatment; do not copy its subject or background.",',
                '        "style": (\n'
                '            "Style reference only: transfer exposure, luminance, highlight and shadow behavior, "\n'
                '            "contrast, saturation, color palette, white balance, material response, texture and finish. "\n'
                '            "Do not copy its subject, objects, architecture or background."\n'
                '        ),',
                "expand the saved Style role description consistently",
            ),
        ],
        "web/components/studio/image2-workspace.tsx": [
            (
                'const MAGIC_HOUR_IMAGE2_FRAME_RATIOS = ["1:1", "16:9", "9:16"] as const;\n\n'
                'function supportedImage2FrameRatios(model: Image2ModelOption): string[] {\n'
                '  const modelRatios = model.frameRatios ?? [];\n'
                '  if (model.provider?.toLowerCase() !== "magichour") return modelRatios;\n'
                '  return modelRatios.filter((ratio) =>\n'
                '    MAGIC_HOUR_IMAGE2_FRAME_RATIOS.includes(\n'
                '      ratio as (typeof MAGIC_HOUR_IMAGE2_FRAME_RATIOS)[number],\n'
                '    ),\n'
                '  );\n'
                '}',
                'function supportedImage2FrameRatios(model: Image2ModelOption): string[] {\n'
                '  // The worker catalog is the single source of truth for verified frames.\n'
                '  return model.frameRatios ?? [];\n'
                '}',
                "remove the stale Magic Hour three-ratio UI restriction",
            ),
            (
                '  const compatibleConfiguredModels = useMemo(\n'
                '    () => configuredInputCompatibleModels.filter(\n'
                '      (model) => aspectRatio === "auto" || (model.frameRatios ?? []).includes(aspectRatio),\n'
                '    ),\n'
                '    [configuredInputCompatibleModels, aspectRatio],\n'
                '  );',
                '  const compatibleConfiguredModels = useMemo(\n'
                '    () => configuredInputCompatibleModels.filter(\n'
                '      (model) => aspectRatio === "auto" || supportedImage2FrameRatios(model).includes(aspectRatio),\n'
                '    ),\n'
                '    [configuredInputCompatibleModels, aspectRatio],\n'
                '  );',
                "use canonical model frame capabilities for Auto",
            ),
            (
                '  const availableAspectRatios = useMemo<Image2AspectRatio[]>(() => {\n'
                '    if (modelOptions.length === 0) return [...IMAGE2_ASPECT_RATIOS];\n'
                '    return IMAGE2_ASPECT_RATIOS.filter(\n'
                '      (ratio) => ratio === "auto" || frameCapabilityModels.some((model) =>\n'
                '        supportedImage2FrameRatios(model).includes(ratio),\n'
                '      ),\n'
                '    );\n'
                '  }, [modelOptions.length, frameCapabilityModels]);',
                '  const availableAspectRatios = useMemo<Image2AspectRatio[]>(() => {\n'
                '    const supported = modelOptions.length === 0\n'
                '      ? [...IMAGE2_ASPECT_RATIOS]\n'
                '      : IMAGE2_ASPECT_RATIOS.filter(\n'
                '          (ratio) => ratio === "auto" || frameCapabilityModels.some((model) =>\n'
                '            supportedImage2FrameRatios(model).includes(ratio),\n'
                '          ),\n'
                '        );\n'
                '    // Keep the current value visible even when the selected model cannot honor it.\n'
                '    return supported.includes(aspectRatio) ? supported : [aspectRatio, ...supported];\n'
                '  }, [modelOptions.length, frameCapabilityModels, aspectRatio]);',
                "keep the selected aspect ratio visible in the selector",
            ),
            (
                '  useEffect(() => {\n'
                '    if (!availableResolutions.includes(resolution)) {\n'
                '      setResolution(availableResolutions[0] ?? "1K");\n'
                '    }\n'
                '  }, [availableResolutions, resolution]);\n\n'
                '  useEffect(() => {\n'
                '    if (!availableAspectRatios.includes(aspectRatio)) {\n'
                '      setAspectRatio("auto");\n'
                '    }\n'
                '  }, [availableAspectRatios, aspectRatio]);',
                '  // Keep user-selected output settings intact when capabilities change.\n'
                '  // An incompatible model is blocked; the frame/resolution is never silently rewritten.',
                "remove implicit frame and resolution resets",
            ),
            (
                '  const availableResolutions = useMemo<Resolution[]>(() => {\n'
                '    const capabilityModels = selectedModelOption ? [selectedModelOption] : compatibleConfiguredModels;\n'
                '    if (capabilityModels.length === 0) return ["1K"];\n'
                '    return RESOLUTIONS.filter((value) =>\n'
                '      capabilityModels.some((model) => (model.resolutions ?? ["1K"]).includes(value)),\n'
                '    );\n'
                '  }, [selectedModelOption, compatibleConfiguredModels]);',
                '  const availableResolutions = useMemo<Resolution[]>(() => {\n'
                '    const capabilityModels = selectedModelOption ? [selectedModelOption] : compatibleConfiguredModels;\n'
                '    if (capabilityModels.length === 0) return [...RESOLUTIONS];\n'
                '    const supported = RESOLUTIONS.filter((value) =>\n'
                '      capabilityModels.some((model) => (model.resolutions ?? ["1K"]).includes(value)),\n'
                '    );\n'
                '    // Keep an unsupported current value visible so the user can see it is preserved.\n'
                '    return supported.includes(resolution) ? supported : [resolution, ...supported];\n'
                '  }, [selectedModelOption, compatibleConfiguredModels, resolution]);',
                "keep an unsupported selected resolution visible without mutating it",
            ),
            (
                '  const selectedModelCanHandleFrame = selectedModelOption\n'
                '    ? aspectRatio === "auto" || supportedImage2FrameRatios(selectedModelOption).includes(aspectRatio)\n'
                '    : true;\n'
                '  const canGenerate =\n'
                '    prompt.trim().length > 0 &&\n'
                '    selectedModelCanHandleImages &&\n'
                '    selectedModelCanHandleFrame &&\n'
                '    (Boolean(selectedModel) ||\n'
                '      modelOptions.length === 0 ||\n'
                '      compatibleConfiguredModels.length > 0);',
                '  const selectedModelCanHandleFrame = selectedModelOption\n'
                '    ? aspectRatio === "auto" || supportedImage2FrameRatios(selectedModelOption).includes(aspectRatio)\n'
                '    : true;\n'
                '  const selectedModelCanHandleResolution = selectedModelOption\n'
                '    ? (selectedModelOption.resolutions ?? ["1K"]).includes(resolution)\n'
                '    : !selectedModel;\n'
                '  const canGenerate =\n'
                '    prompt.trim().length > 0 &&\n'
                '    selectedModelCanHandleImages &&\n'
                '    selectedModelCanHandleFrame &&\n'
                '    selectedModelCanHandleResolution &&\n'
                '    (Boolean(selectedModel) ||\n'
                '      modelOptions.length === 0 ||\n'
                '      resolutionCompatibleModels.length > 0);',
                "block incompatible selected resolution and require a real Auto candidate",
            ),
            (
                'const handleModelSelection = (key: string) => {\n'
                '  const model = modelOptions.find((item) => item.key === key);\n\n'
                '  setSelectedModel(key);\n\n'
                '  if (\n'
                '    model &&\n'
                '    aspectRatio !== "auto" &&\n'
                '    !supportedImage2FrameRatios(model).includes(aspectRatio)\n'
                '  ) {\n'
                '    setAspectRatio("auto");\n'
                '  }\n\n'
                '  if (model?.resolutions?.length) {\n'
                '    const supportedResolutions = model.resolutions;\n\n'
                '    if (!supportedResolutions.includes(resolution)) {\n'
                '      const preferredResolution = supportedResolutions.includes("1K")\n'
                '        ? "1K"\n'
                '        : supportedResolutions[0];\n\n'
                '      if (preferredResolution) {\n'
                '        setResolution(preferredResolution as Resolution);\n'
                '      }\n'
                '    }\n'
                '  }\n\n'
                '  setModelPickerOpen(false);\n'
                '  setError(null);\n'
                '};',
                'const handleModelSelection = (key: string) => {\n'
                '  // Selection never mutates the requested frame or resolution.\n'
                '  // Compatibility is validated separately and an incompatible model cannot run.\n'
                '  setSelectedModel(key);\n'
                '  setModelPickerOpen(false);\n'
                '  setError(null);\n'
                '};',
                "preserve the user’s frame and resolution when selecting a model",
            ),
            (
                'const supportedResolutions = selectedModelOption?.resolutions ?? [];',
                'const supportedResolutions = selectedModelOption?.resolutions ?? ["1K"];',
                "use the same default resolution capability as the compatibility check",
            ),
            (
                'if (\n'
                '  selectedModelOption &&\n'
                '  supportedResolutions.length > 0 &&\n'
                '  !supportedResolutions.includes(resolution)\n'
                ') {\n'
                '  const nextResolution = supportedResolutions.includes("1K")\n'
                '    ? "1K"\n'
                '    : supportedResolutions[0];\n\n'
                '  if (nextResolution) {\n'
                '    setResolution(nextResolution as Resolution);\n'
                '    setError(\n'
                '      `${selectedModelOption.name} supports ${supportedResolutions.join(", ")} only. Resolution updated. Generate again.`,\n'
                '    );\n'
                '  }\n\n'
                '  return;\n'
                '}',
                'if (selectedModelOption && !supportedResolutions.includes(resolution)) {\n'
                '  setError(\n'
                '    `${selectedModelOption.name} does not support ${resolution}. Supported resolutions: ${supportedResolutions.join(", ")}. Your selected resolution was kept unchanged.`,\n'
                '  );\n'
                '  return;\n'
                '}\n'
                'if (\n'
                '  selectedModelOption &&\n'
                '  aspectRatio !== "auto" &&\n'
                '  !supportedImage2FrameRatios(selectedModelOption).includes(aspectRatio)\n'
                ') {\n'
                '  setError(\n'
                '    `${selectedModelOption.name} does not support ${aspectRatio}. Your selected frame was kept unchanged. Choose another model or explicitly select a supported frame.`,\n'
                '  );\n'
                '  return;\n'
                '}',
                "replace hidden resolution changes with explicit validation",
            ),
            (
                '    if (\n'
                '      selectedModelOption &&\n'
                '      imageInputCount > (selectedModelOption.maxReferences ?? 0)\n'
                '    ) {\n'
                '      setError(\n'
                '        `${selectedModelOption.name} supports up to ${selectedModelOption.maxReferences ?? 0} total image inputs including Style. Choose a compatible model or remove images.`,\n'
                '      );\n'
                '      return;\n'
                '    }',
                '    if (\n'
                '      selectedModelOption &&\n'
                '      imageInputCount > (selectedModelOption.maxReferences ?? 0)\n'
                '    ) {\n'
                '      setError(\n'
                '        `${selectedModelOption.name} supports up to ${selectedModelOption.maxReferences ?? 0} total image inputs including Style. Choose a compatible model or remove images.`,\n'
                '      );\n'
                '      return;\n'
                '    }\n'
                '    if (\n'
                '      selectedModelOption?.maxIdentityObjects !== undefined &&\n'
                '      identityObjectCount > selectedModelOption.maxIdentityObjects\n'
                '    ) {\n'
                '      setError(\n'
                '        `${selectedModelOption.name} supports up to ${selectedModelOption.maxIdentityObjects} identity Element images; reduce Element references or choose another model.`,\n'
                '      );\n'
                '      return;\n'
                '    }\n'
                '    if (selectedModelOption && hasStyleReference && !selectedModelOption.supportsStyleReference) {\n'
                '      setError(`${selectedModelOption.name} does not support a Style reference. Choose a compatible model.`);\n'
                '      return;\n'
                '    }',
                "validate role-specific capability limits before submit",
            ),
            (
                '                    const fitsReferences = imageInputCount <= maxRefs;\n'
                '                    const supportedFrames = supportedImage2FrameRatios(model);\n'
                '                    const supportsCurrentFrame = aspectRatio === "auto" || supportedFrames.includes(aspectRatio);',
                '                    const fitsReferences = imageInputCount <= maxRefs;\n'
                '                    const fitsIdentityObjects = model.maxIdentityObjects === undefined || identityObjectCount <= model.maxIdentityObjects;\n'
                '                    const supportsStyle = !hasStyleReference || model.supportsStyleReference === true;\n'
                '                    const supportedFrames = supportedImage2FrameRatios(model);\n'
                '                    const supportsCurrentFrame = aspectRatio === "auto" || supportedFrames.includes(aspectRatio);\n'
                '                    const supportsCurrentResolution = (model.resolutions ?? ["1K"]).includes(resolution);',
                "derive full model-card compatibility from the live catalog",
            ),
            (
                '                          {!fitsReferences && (\n'
                '                            <span className="mt-1 block text-[9px] text-rose-200">\n'
                '                              Needs fewer image inputs ({imageInputCount}{" "}\n'
                '                              selected).\n'
                '                            </span>\n'
                '                          )}',
                '                          {!fitsReferences && (\n'
                '                            <span className="mt-1 block text-[9px] text-rose-200">\n'
                '                              Needs fewer image inputs ({imageInputCount}{" "}\n'
                '                              selected).\n'
                '                            </span>\n'
                '                          )}\n'
                '                          {!fitsIdentityObjects && (\n'
                '                            <span className="mt-1 block text-[9px] text-rose-200">\n'
                '                              Supports up to {model.maxIdentityObjects} Element references.\n'
                '                            </span>\n'
                '                          )}\n'
                '                          {!supportsStyle && (\n'
                '                            <span className="mt-1 block text-[9px] text-rose-200">\n'
                '                              This model does not support the Style role.\n'
                '                            </span>\n'
                '                          )}\n'
                '                          {!supportsCurrentResolution && (\n'
                '                            <span className="mt-1 block text-[9px] text-amber-200">\n'
                '                              Does not support {resolution}. Choose: {(model.resolutions ?? []).join(", ")}.\n'
                '                            </span>\n'
                '                          )}',
                "show role and resolution incompatibilities in the picker",
            ),
            (
                '                    {resolvedAutoModel\n'
                '                      ? `Will use ${resolvedAutoModel.name} (${providerLabel(resolvedAutoModel.provider, resolvedAutoModel)}) — cheapest configured model matching your inputs.`\n'
                '                      : "Automatically pick a configured model that supports your content references and requested quality."}',
                '                    {aspectRatio === "auto" && imageInputCount > 0\n'
                '                      ? "The worker will infer the frame from Base, then primary image or Element, and select a compatible model."\n'
                '                      : resolvedAutoModel\n'
                '                        ? `Will use ${resolvedAutoModel.name} (${providerLabel(resolvedAutoModel.provider, resolvedAutoModel)}) — best compatible candidate for the selected task and output settings.`\n'
                '                        : "No configured model currently matches all selected references, roles, frame, resolution and quality. Adjust an input or choose a compatible model."}',
                "make Auto compatibility failures visible",
            ),
        ],
        "worker/tests/test_image2_role_prompt_regressions.py": [
            (
                'from catalog import (\n',
                'from catalog import (\n'
                '    Candidate,\n'
                '    bfl_text_to_image_input,\n',
                "import Candidate for engine fallback tests",
            ),
            (
                '    image2_identity_object_count,\n'
                '    candidate_resolutions,',
                '    image2_identity_object_count,\n'
                '    image2_frame_reference,\n'
                '    candidate_resolutions,',
                "import frame reference resolver for tests",
            ),
            (
                'from workflows.engine import order_text_to_image_candidates',
                'from workflows.engine import (\n'
                '    AllModelsFailedError,\n'
                '    execute_with_fallback,\n'
                '    order_text_to_image_candidates,\n'
                ')',
                "import fallback engine test helpers",
            ),
            (
                'def test_arabic_prompt_roles_are_recognized():\n'
                '    req = {\n'
                '        "referenceUrls": ["element.png", "background.png", "lighting.png", "material.png"],\n'
                '        "referenceTags": ["@img1", "@img2", "@img3", "@img4"],\n'
                '        "referenceRoles": ["detail", "element", "element", "style"],\n'
                '        "sceneDetails": (\n'
                '            "استخدم @img1 كعنصر لإدخاله في @img2. "\n'
                '            "استخدم @img3 للإضاءة والألوان فقط. "\n'
                '            "استفد من خامة @img4 فقط."\n'
                '        ),\n'
                '    }\n'
                '    assert normalize_image2_reference_roles(req) == ["element", "base", "style", "detail"]',
                'def test_arabic_saved_ui_roles_are_authoritative():\n'
                '    req = {\n'
                '        "referenceUrls": ["element.png", "background.png", "lighting.png", "material.png"],\n'
                '        "referenceTags": ["@img1", "@img2", "@img3", "@img4"],\n'
                '        "referenceRoles": ["detail", "element", "element", "style"],\n'
                '        "sceneDetails": (\n'
                '            "استخدم @img1 كعنصر لإدخاله في @img2. "\n'
                '            "استخدم @img3 للإضاءة والألوان فقط. "\n'
                '            "استفد من خامة @img4 فقط."\n'
                '        ),\n'
                '    }\n'
                '    assert normalize_image2_reference_roles(req) == ["detail", "element", "element", "style"]\n\n\n'
                'def test_arabic_legacy_role_inference_when_metadata_is_absent():\n'
                '    req = {\n'
                '        "referenceUrls": ["element.png", "background.png", "lighting.png", "material.png"],\n'
                '        "referenceTags": ["@img1", "@img2", "@img3", "@img4"],\n'
                '        "sceneDetails": (\n'
                '            "استخدم @img1 كعنصر لإدخاله في @img2. "\n'
                '            "استخدم @img3 للإضاءة والألوان فقط. "\n'
                '            "استفد من خامة @img4 فقط."\n'
                '        ),\n'
                '    }\n'
                '    assert normalize_image2_reference_roles(req) == ["element", "base", "style", "detail"]',
                "keep Arabic saved roles authoritative while testing legacy prompt inference",
            ),
            (
                'def test_explicit_prompt_roles_override_saved_metadata():\n'
                '    req = {\n'
                '        "referenceUrls": ["element.png", "base.png", "style.png", "detail.png"],\n'
                '        "referenceTags": ["@img1", "@img2", "@img3", "@img4"],\n'
                '        "referenceRoles": ["detail", "element", "element", "style"],\n'
                '        "sceneDetails": (\n'
                '            "Use @img1 as the object to insert into @img2. "\n'
                '            "Use @img3 for lighting and color treatment only. "\n'
                '            "Borrow the material texture from @img4, "\n'
                '            "but do not copy its objects or background."\n'
                '        ),\n'
                '    }\n'
                '    assert normalize_image2_reference_roles(req) == ["element", "base", "style", "detail"]',
                'def test_saved_ui_roles_are_authoritative_over_prompt_text():\n'
                '    req = {\n'
                '        "referenceUrls": ["one.png", "two.png", "three.png", "four.png"],\n'
                '        "referenceTags": ["@img1", "@img2", "@img3", "@img4"],\n'
                '        "referenceRoles": ["detail", "element", "element", "style"],\n'
                '        "sceneDetails": (\n'
                '            "Use @img1 as the object to insert into @img2. "\n'
                '            "Use @img3 for lighting and color treatment only. "\n'
                '            "Borrow the material texture from @img4."\n'
                '        ),\n'
                '    }\n'
                '    assert normalize_image2_reference_roles(req) == ["detail", "element", "element", "style"]\n\n\n'
                'def test_legacy_requests_infer_roles_from_prompt_when_metadata_is_absent():\n'
                '    req = {\n'
                '        "referenceUrls": ["element.png", "base.png", "style.png", "detail.png"],\n'
                '        "referenceTags": ["@img1", "@img2", "@img3", "@img4"],\n'
                '        "sceneDetails": (\n'
                '            "Use @img1 as the object to insert into @img2. "\n'
                '            "Use @img3 for lighting and color treatment only. "\n'
                '            "Borrow the material texture from @img4, "\n'
                '            "but do not copy its objects or background."\n'
                '        ),\n'
                '    }\n'
                '    assert normalize_image2_reference_roles(req) == ["element", "base", "style", "detail"]',
                "replace stale role test with the persisted-UI-role contract",
            ),
        ],
    }

    staged = apply_text_changes(root, changes)

    magic_hour_test = '''"""Image2 routing tests for the Magic Hour API adapter."""\n\nimport sys\nfrom pathlib import Path\n\nsys.path.insert(0, str(Path(__file__).resolve().parent.parent))\n\nfrom providers import magichour\n\n\ndef test_image2_requests_with_reference_images_use_the_editor(monkeypatch):\n    calls = {"editor": 0, "generator": 0}\n\n    def editor(_model_id, _input, _timeout_ms):\n        calls["editor"] += 1\n        return "editor-output.png"\n\n    def generator(_model_id, _input, _timeout_ms):\n        calls["generator"] += 1\n        return "generator-output.png"\n\n    monkeypatch.setattr(magichour, "_run_image_edit", editor)\n    monkeypatch.setattr(magichour, "_run_image_generator", generator)\n\n    result = magichour.generate(\n        "flux-2-klein",\n        {"images": ["base.png", "element.png"], "is_text_to_image": True, "quantity": 1},\n        1000,\n    )\n\n    assert calls == {"editor": 1, "generator": 0}\n    assert result == {"images": [{"url": "editor-output.png"}]}\n\n\ndef test_image2_text_only_request_uses_the_generator(monkeypatch):\n    calls = {"editor": 0, "generator": 0}\n\n    def editor(_model_id, _input, _timeout_ms):\n        calls["editor"] += 1\n        return "editor-output.png"\n\n    def generator(_model_id, _input, _timeout_ms):\n        calls["generator"] += 1\n        return "generator-output.png"\n\n    monkeypatch.setattr(magichour, "_run_image_edit", editor)\n    monkeypatch.setattr(magichour, "_run_image_generator", generator)\n\n    result = magichour.generate(\n        "flux-2-klein",\n        {"images": [], "is_text_to_image": True, "quantity": 1},\n        1000,\n    )\n\n    assert calls == {"editor": 0, "generator": 1}\n    assert result == {"images": [{"url": "generator-output.png"}]}\n'''

    frame_contract_test = r'''import base64
import io
import sys
from pathlib import Path

import pytest
from PIL import Image, ImageChops, ImageDraw

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import storage
from frame_ratio import normalize_image_output_frame, validate_image_output_frame


def _png_data_uri(width: int, height: int) -> tuple[str, Image.Image]:
    source = Image.new("RGB", (width, height), "white")
    draw = ImageDraw.Draw(source)
    draw.rectangle((97, 0, 105, height - 1), fill="black")
    buffer = io.BytesIO()
    source.save(buffer, format="PNG")
    encoded = base64.b64encode(buffer.getvalue()).decode("ascii")
    return "data:image/png;base64," + encoded, source


def test_small_frame_correction_pads_canvas_and_preserves_every_source_pixel():
    source_uri, source = _png_data_uri(640, 384)
    normalized_uri = normalize_image_output_frame([source_uri], "16:9")[0]
    normalized_bytes = base64.b64decode(normalized_uri.split(",", 1)[1])

    with Image.open(io.BytesIO(normalized_bytes)) as normalized:
        normalized = normalized.convert("RGB")
        assert normalized.size == (683, 384)
        preserved_source = normalized.crop((21, 0, 661, 384))
        assert ImageChops.difference(preserved_source, source).getbbox() is None

    validate_image_output_frame([normalized_uri], "16:9")


def test_worker_storage_image_url_is_resolved_even_when_host_is_a_lan_ip(tmp_path, monkeypatch):
    monkeypatch.setattr(storage, "STORAGE_DIR", tmp_path)
    monkeypatch.setattr(storage, "PUBLIC_BASE_URL", "http://192.168.1.4:8000")
    source_path = tmp_path / "source.png"
    source_path.write_bytes(b"local-image-bytes")

    result = storage.image_data_uri_if_local(
        "http://192.168.1.4:8000/storage/source.png"
    )

    assert result == "data:image/png;base64," + base64.b64encode(b"local-image-bytes").decode("ascii")


def test_large_frame_mismatch_is_not_cropped_or_rewritten_and_is_rejected():
    square_uri, _source = _png_data_uri(384, 384)
    normalized = normalize_image_output_frame([square_uri], "16:9")

    assert normalized == [square_uri]
    with pytest.raises(ValueError, match="not the requested 16:9 frame"):
        validate_image_output_frame(normalized, "16:9")
'''

    # Add the frame and fallback regression tests at the end of the existing test module.
    test_path = root / "worker/tests/test_image2_role_prompt_regressions.py"
    test_source = staged[test_path]
    extra_tests = '''\n\n\ndef test_auto_frame_source_prefers_base_then_primary_then_element():\n    req = {\n        "imageUrl": "primary-element.png",\n        "referenceUrls": ["style.png", "base.png", "element.png"],\n        "referenceRoles": ["style", "base", "element"],\n    }\n    assert image2_frame_reference(req) == "base.png"\n\n    without_base = {\n        "imageUrl": "primary-element.png",\n        "referenceUrls": ["style.png", "element.png"],\n        "referenceRoles": ["style", "element"],\n    }\n    assert image2_frame_reference(without_base) == "primary-element.png"\n\n    element_only = {\n        "referenceUrls": ["style.png", "element.png"],\n        "referenceRoles": ["style", "element"],\n    }\n    assert image2_frame_reference(element_only) == "element.png"\n\n\ndef test_style_and_detail_never_define_auto_frame():\n    req = {\n        "referenceUrls": ["style.png", "detail.png"],\n        "referenceRoles": ["style", "detail"],\n    }\n    assert image2_frame_reference(req) is None\n\n\ndef test_magichour_builder_uses_resolved_frame_for_auto():\n    payload = magichour_text_to_image_input(\n        {\n            "prompt": "Architectural visualization",\n            "images": [],\n            "aspectRatio": "auto",\n            "resolvedAspectRatio": "16:9",\n            "resolution": "640px",\n            "quantity": 1,\n        }\n    )\n    assert payload["aspectRatio"] == "16:9"\n\n\ndef test_native_adapters_honor_resolved_auto_frame():
    req = {
        "prompt": "Architectural visualization",
        "referenceUrls": [],
        "aspectRatio": "auto",
        "resolvedAspectRatio": "16:9",
        "resolution": "1K",
        "quality": "standard",
        "quantity": 1,
    }
    bfl = bfl_text_to_image_input(req)
    assert bfl["width"] == 1024
    assert bfl["height"] == 576

    openai = openai_text_to_image_25_input(req)
    assert openai["size"] == "1280x720"

    google = google_text_to_image_input(req)
    assert google["aspectRatio"] == "16:9"


def test_fallback_counts_the_separate_style_reference():\n    candidate = Candidate(\n        key="test-image2",\n        name="Test Image2",\n        description="Mock candidate",\n        provider="openai",\n        model_id="mock",\n        cost_weight=1,\n        cost_per_generation=1,\n        max_references=0,\n        timeout_ms=1000,\n        tiers=("standard",),\n        build_input=lambda req: req,\n        extract_output=lambda data: [item["url"] for item in data.get("images", [])],\n    )\n\n    try:\n        execute_with_fallback(\n            "text_to_image",\n            [candidate],\n            {"styleReferenceUrl": "style.png", "prompt": "test", "quantity": 1},\n            adapter_override=lambda _model, _input, _timeout: {"images": [{"url": "out.png"}]},\n        )\n    except AllModelsFailedError as error:\n        assert "request contains 1" in error.attempts[0]["error"]\n    else:\n        raise AssertionError("A zero-reference candidate must reject a separate Style image")\n'''
    if "test_auto_frame_source_prefers_base_then_primary_then_element" not in test_source:
        test_source += extra_tests
        staged[test_path] = test_source

    magichour_test_path, should_add_magichour_test = add_test_file(
        root, "worker/tests/test_magichour_image2_routing.py", magic_hour_test
    )
    frame_test_path, should_add_frame_test = add_test_file(
        root, "worker/tests/test_image2_frame_contract_preservation.py", frame_contract_test
    )

    if args.dry_run:
        print("DRY RUN OK: all expected source blocks matched exactly.")
        print(f"Local HEAD: {local_head}")
        print(f"Reviewed upstream codex baseline: {REVIEWED_CODEX_HEAD}")
        print("Files that would be changed:")
        for path in staged:
            print(f"  {path.relative_to(root)}")
        if should_add_magichour_test:
            print("  worker/tests/test_magichour_image2_routing.py (new)")
        if should_add_frame_test:
            print("  worker/tests/test_image2_frame_contract_preservation.py (new)")
        print("worker/frame_ratio.py will not be changed.")
        return 0

    backup_root = Path(tempfile.gettempdir()) / (
        "Renderuim-Image2-backup-" + datetime.now().strftime("%Y%m%d-%H%M%S")
    )
    backup_root.mkdir(parents=True, exist_ok=False)

    for path in staged:
        relative = path.relative_to(root)
        backup_path = backup_root / relative
        backup_path.parent.mkdir(parents=True, exist_ok=True)
        backup_path.write_bytes(path.read_bytes())
    try:
        for path, content in staged.items():
            temp_path = path.with_suffix(path.suffix + ".image2-tmp")
            newline = FILE_NEWLINES.get(path, "\n")
            output = content.replace("\n", newline).encode("utf-8")
            temp_path.write_bytes(output)
            temp_path.replace(path)
        if should_add_magichour_test:
            magichour_test_path.parent.mkdir(parents=True, exist_ok=True)
            magichour_test_path.write_bytes(magic_hour_test.encode("utf-8"))
        if should_add_frame_test:
            frame_test_path.parent.mkdir(parents=True, exist_ok=True)
            frame_test_path.write_bytes(frame_contract_test.encode("utf-8"))

        compile_paths = [str(path) for path in staged]
        if should_add_magichour_test:
            compile_paths.append(str(magichour_test_path))
        if should_add_frame_test:
            compile_paths.append(str(frame_test_path))
        compile_result = subprocess.run(
            [sys.executable, "-m", "py_compile", *compile_paths],
            cwd=root,
            text=True,
            capture_output=True,
            check=False,
        )
        if compile_result.returncode:
            raise RuntimeError(
                "Python syntax verification failed after applying the patcher:\n"
                + (compile_result.stderr.strip() or compile_result.stdout.strip())
            )
    except Exception:
        # Restore all staged files from the backup if any write fails.
        for path in staged:
            relative = path.relative_to(root)
            path.write_bytes((backup_root / relative).read_bytes())
        if should_add_magichour_test and magichour_test_path.exists():
            magichour_test_path.unlink()
        if should_add_frame_test and frame_test_path.exists():
            frame_test_path.unlink()
        raise

    print("Image2 fixes applied successfully.")
    print(f"Repository: {root}")
    print(f"Branch: {branch}")
    print(f"Local HEAD: {local_head}")
    print(f"Reviewed upstream codex baseline: {REVIEWED_CODEX_HEAD}")
    print(f"Backup: {backup_root}")
    print("Changed files:")
    for path in staged:
        print(f"  {path.relative_to(root)}")
    if should_add_magichour_test:
        print("  worker/tests/test_magichour_image2_routing.py (new)")
    if should_add_frame_test:
        print("  worker/tests/test_image2_frame_contract_preservation.py (new)")
    print("Unchanged by design: worker/frame_ratio.py, API request schema, database schema, credits, and provider catalog model IDs/costs.")
    print("Next: run the verification commands from the accompanying instructions.")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        raise SystemExit(1)
