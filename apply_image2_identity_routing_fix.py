#!/usr/bin/env python3
"""Guarded local patch for Image2 role-aware identity routing.

Targets the current CODEX layout of axac1823-art/mk-studio-ai-.
Default operation is read-only (prints a change summary). Use --diff to inspect
unified diffs or --apply to write changes after full preflight validation.
This script does not use the network, Git, or GitHub and does not deploy anything.
"""
from __future__ import annotations

import argparse
import ast
import difflib
import os
import shutil
import sys
import tempfile
from pathlib import Path

class PatchError(RuntimeError):
    pass


def replace_once(source: str, old: str, new: str, label: str) -> str:
    """Replace one exact anchor; allow safe reruns when replacement is already present."""
    # Test for the complete target block first. This also handles replacements
    # that intentionally retain part of their original anchor for context.
    if source.count(new) == 1:
        return source
    old_count = source.count(old)
    if old_count == 1:
        return source.replace(old, new, 1)
    raise PatchError(
        f"{label}: expected exactly one original anchor (found {old_count}) or one applied block. "
        "No project files have been written. This checkout may not match the expected CODEX source."
    )


def transform_catalog(source: str) -> str:
    # These helpers keep model eligibility decisions testable and consistent with prompt role defaults.
    has_identity_helper = "def text_to_image_identity_locked(req: dict) -> bool:" in source
    has_filter_helper = "def filter_text_to_image_candidates(" in source
    if has_identity_helper and has_filter_helper:
        return source
    if has_identity_helper or has_filter_helper:
        raise PatchError(
            "worker/catalog.py contains only part of the Image2 identity helper block. "
            "Review the file manually; no project files have been written."
        )

    # Do not depend on a byte-for-byte signature anchor. Local checkouts may differ in
    # spacing, line endings, or how the return annotation was encoded in a prior edit.
    try:
        tree = ast.parse(source, filename="worker/catalog.py")
    except SyntaxError as exc:
        raise PatchError(f"worker/catalog.py cannot be parsed before patching: {exc}") from exc
    anchors = [
        node for node in tree.body
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef))
        and node.name == "filter_candidates_by_mode"
        and node.col_offset == 0
    ]
    if len(anchors) != 1:
        raise PatchError(
            "worker/catalog.py: expected one top-level filter_candidates_by_mode function "
            f"as the insertion point, found {len(anchors)}. No project files have been written."
        )
    insert_at = anchors[0].lineno - 1
    additions = r'''
def text_to_image_identity_locked(req: dict) -> bool:
    """Return True when Image2 must preserve a supplied object or base scene.

    Match add_image_reference_map: references lacking valid role metadata default to
    the `element` role, so legacy jobs do not silently become low-fidelity prompts.
    Style/detail references alone do not require exact-object routing.
    """
    if bool(req.get("imageUrl")):
        return True

    references = req.get("referenceUrls") or []
    if not isinstance(references, (list, tuple)) or not references:
        return False

    raw_roles = req.get("referenceRoles") or []
    if not isinstance(raw_roles, (list, tuple)):
        raw_roles = []

    valid_roles = {"element", "base", "style", "detail"}
    for index in range(len(references)):
        role = raw_roles[index] if index < len(raw_roles) else "element"
        if not isinstance(role, str) or role not in valid_roles:
            role = "element"
        if role in {"element", "base"}:
            return True
    return False


def filter_text_to_image_candidates(
    candidates: list[Candidate],
    *,
    input_count: int,
    has_style_reference: bool,
    identity_locked: bool,
) -> list[Candidate]:
    """Filter Image2 models by input capacity and explicit role requirements.

    `supports_identity_edit` is an eligibility declaration, not a guarantee of
    pixel identity. It prevents Image2 from silently treating a locked element
    as an ordinary inspiration image on a model that is not designated for edits.
    """
    eligible = [
        candidate
        for candidate in candidates
        if candidate.max_references >= input_count
        and (not has_style_reference or candidate.supports_style_reference)
    ]
    if identity_locked:
        eligible = [candidate for candidate in eligible if candidate.supports_identity_edit]
    return eligible
'''
    lines = source.splitlines(keepends=True)
    # Insert before the function's source line. AST-derived line numbers remain stable
    # across spaces/annotations; preserve the original file's line-ending convention.
    newline = "\r\n" if "\r\n" in source else "\n"
    helper_block = additions.strip("\n").replace("\n", newline) + newline + newline
    offset = sum(len(line) for line in lines[:insert_at])
    return source[:offset] + helper_block + source[offset:]


def transform_workflow(source: str) -> str:
    source = replace_once(
        source,
        "from catalog import MODEL_CATALOG, text_to_image_candidates_for_tier\n",
        "from catalog import (\n    MODEL_CATALOG,\n    filter_text_to_image_candidates,\n    text_to_image_candidates_for_tier,\n    text_to_image_identity_locked,\n)\n",
        "workflow import of role-aware candidate helpers",
    )
    source = replace_once(
        source,
        '''    # Keep backward compatibility and activate identity preservation for reference roles too.
    if feature == "text_to_image":
        reference_roles = input_.get("referenceRoles") or []
        input_["preserveElementIdentity"] = bool(
            input_.get("imageUrl")
            or (isinstance(reference_roles, (list, tuple)) and "element" in reference_roles)
        )
''',
        '''    # `preserveElementIdentity` adds instructions specifically about the primary @element
    # image. Reference-list elements are mapped as @imgN and handled by role guidance instead.
    identity_locked = feature == "text_to_image" and text_to_image_identity_locked(input_)
    if feature == "text_to_image":
        input_["preserveElementIdentity"] = bool(input_.get("imageUrl"))
''',
        "separate primary @element prompt from role-based identity routing",
    )
    source = replace_once(
        source,
        '''                feature_candidates = [
                    candidate for candidate in feature_candidates
                    if candidate.max_references >= input_count
                    and (not has_style_reference or candidate.supports_style_reference)
                ]
                selected_model = input_.get("model")
                has_image_inputs = bool(
                    input_.get("imageUrl") or input_.get("styleReferenceUrl") or input_.get("referenceUrls")
                )
                if has_image_inputs:
                    # Image2 may also send references as generation context to
                    # providers that accept images without guaranteeing exact
                    # identity preservation (for example Magic Hour Flux 2 Klein).
                    reference_candidates = [
                        candidate for candidate in feature_candidates
                        if candidate.supports_identity_edit
                        or (
                            candidate.max_references >= input_count
                            and (not has_style_reference or candidate.supports_style_reference)
                        )
                    ]
                    if selected_model and selected_model != "auto" and not any(
                        candidate.key == selected_model for candidate in reference_candidates
                    ):
                        raise ValueError(
                            "The selected model does not support the current Image2 references. "
                            "Choose a compatible model or remove some references."
                        )
                    feature_candidates = reference_candidates
''',
        '''                feature_candidates = filter_text_to_image_candidates(
                    feature_candidates,
                    input_count=input_count,
                    has_style_reference=has_style_reference,
                    identity_locked=identity_locked,
                )
                selected_model = input_.get("model")
                has_image_inputs = bool(
                    input_.get("imageUrl") or input_.get("styleReferenceUrl") or input_.get("referenceUrls")
                )
                if has_image_inputs and selected_model and selected_model != "auto" and not any(
                    candidate.key == selected_model for candidate in feature_candidates
                ):
                    if identity_locked:
                        raise ValueError(
                            "The selected model is not eligible for Image2 exact-element/base-scene editing. "
                            "Choose a source-image editing model or change the reference role to Style/Detail."
                        )
                    raise ValueError(
                        "The selected model does not support the current Image2 references. "
                        "Choose a compatible model or remove some references."
                    )
''',
        "strict Image2 identity-mode candidate filtering",
    )
    source = replace_once(
        source,
        '''                if not feature_candidates:
                    if has_style_reference:
                        raise ValueError(
                            "No configured Text-to-Image provider supports the selected Style and content inputs. "
                            "Configure a supported provider (for example OpenAI GPT Image 1.5 or Google Gemini 2.5 Flash Image), "
                            "reduce the number of images, or remove Style."
                        )
''',
        '''                if not feature_candidates:
                    if identity_locked:
                        raise ValueError(
                            "Exact element/base-scene mode requires a configured model that supports source-image editing "
                            "and the selected image count. Configure an eligible provider, reduce the image count, "
                            "or change the locked role to Style/Detail."
                        )
                    if has_style_reference:
                        raise ValueError(
                            "No configured Text-to-Image provider supports the selected Style and content inputs. "
                            "Configure a supported provider (for example OpenAI GPT Image 2.5 Sunburst or Google Gemini Nano Banana 2.1), "
                            "reduce the number of images, or remove Style."
                        )
''',
        "clear error for identity-locked jobs with no eligible configured model",
    )
    return source


def transform_workspace(source: str) -> str:
    source = replace_once(
        source,
        '''  const imageInputCount = references.length;
  const isCompatibleWithSelectedInputs = useCallback(
    (model: Image2ModelOption) =>
      model.configured &&
      imageInputCount <= (model.maxReferences ?? 0) &&
      (!references.some((reference) => reference.role === "style") ||
        model.supportsStyleReference === true),
    [imageInputCount, references],
  );
''',
        '''  const imageInputCount = references.length;
  const identityLockedReferenceSelected = references.some((reference) => {
    const role = reference.role ?? "element";
    return role === "element" || role === "base";
  });
  const isCompatibleWithSelectedInputs = useCallback(
    (model: Image2ModelOption) =>
      model.configured &&
      imageInputCount <= (model.maxReferences ?? 0) &&
      (!identityLockedReferenceSelected || model.supportsIdentityEdit === true) &&
      (!references.some((reference) => reference.role === "style") ||
        model.supportsStyleReference === true),
    [imageInputCount, references, identityLockedReferenceSelected],
  );
''',
        "Image2 UI compatibility filter for element/base roles",
    )
    source = replace_once(
        source,
        '''    if (selectedModelOption && !selectedModelOption.configured) {
      setError(
        "The selected model is not configured on the worker. Choose another model or Auto.",
      );
      return;
    }
''',
        '''    if (selectedModelOption && !selectedModelOption.configured) {
      setError(
        "The selected model is not configured on the worker. Choose another model or Auto.",
      );
      return;
    }
    if (
      selectedModelOption &&
      identityLockedReferenceSelected &&
      selectedModelOption.supportsIdentityEdit !== true
    ) {
      setError(
        "Exact element/base-scene mode requires a model configured for source-image editing. Choose Auto or change the role to Style/Detail.",
      );
      return;
    }
''',
        "manual Image2 model guard for element/base roles",
    )
    return source


def transform_api_route(source: str) -> str:
    return replace_once(
        source,
        '      preserveElementIdentity: isTextToImage && (Boolean(imageUrl) || referenceRoles.includes("element")),\n',
        '      preserveElementIdentity: isTextToImage && Boolean(imageUrl),\n',
        "only set primary @element prompt flag when a primary imageUrl exists",
    )


TEST_SOURCE = '''"""Regression tests for strict Image2 reference-role routing."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from catalog import (
    TEXT_TO_IMAGE_CANDIDATES,
    filter_text_to_image_candidates,
    text_to_image_identity_locked,
)


def test_primary_image_url_locks_identity():
    assert text_to_image_identity_locked({"feature": "text_to_image", "imageUrl": "source.png"})


def test_element_and_base_roles_lock_identity():
    assert text_to_image_identity_locked({"referenceUrls": ["chair.png"], "referenceRoles": ["element"]})
    assert text_to_image_identity_locked({"referenceUrls": ["room.png"], "referenceRoles": ["base"]})


def test_style_and_detail_roles_alone_do_not_lock_object_identity():
    request = {
        "referenceUrls": ["style.png", "detail.png"],
        "referenceRoles": ["style", "detail"],
    }
    assert not text_to_image_identity_locked(request)


def test_missing_or_invalid_legacy_roles_follow_prompt_default_element_role():
    assert text_to_image_identity_locked({"referenceUrls": ["old-reference.png"]})
    assert text_to_image_identity_locked({"referenceUrls": ["bad-role.png"], "referenceRoles": ["unknown"]})


def test_locked_image2_jobs_only_use_identity_edit_candidates():
    candidates = filter_text_to_image_candidates(
        TEXT_TO_IMAGE_CANDIDATES,
        input_count=2,
        has_style_reference=False,
        identity_locked=True,
    )
    assert {candidate.key for candidate in candidates} == {"gpt-image-1.5", "gemini-2.5-flash"}
    assert all(candidate.supports_identity_edit for candidate in candidates)


def test_style_only_requests_keep_compatible_style_reference_candidates():
    candidates = filter_text_to_image_candidates(
        TEXT_TO_IMAGE_CANDIDATES,
        input_count=2,
        has_style_reference=True,
        identity_locked=False,
    )
    assert {candidate.key for candidate in candidates} == {
        "gpt-image-1.5", "gemini-2.5-flash", "magichour-flux-2-klein-text"
    }


def test_too_many_inputs_still_excludes_models_over_their_reference_limit():
    candidates = filter_text_to_image_candidates(
        TEXT_TO_IMAGE_CANDIDATES,
        input_count=15,
        has_style_reference=False,
        identity_locked=True,
    )
    assert [candidate.key for candidate in candidates] == ["gpt-image-1.5"]
'''

TRANSFORMS = {
    "worker/catalog.py": transform_catalog,
    "worker/workflows/image_render.py": transform_workflow,
    "web/components/studio/image2-workspace.tsx": transform_workspace,
    "web/app/api/generate/route.ts": transform_api_route,
}


def stage(root: Path) -> tuple[dict[Path, bytes], dict[Path, bytes]]:
    originals: dict[Path, bytes] = {}
    staged: dict[Path, bytes] = {}
    for rel, transform in TRANSFORMS.items():
        path = root / rel
        if not path.is_file():
            raise PatchError(f"Required current CODEX file is missing: {rel}")
        raw = path.read_bytes()
        try:
            source = raw.decode("utf-8")
        except UnicodeDecodeError as exc:
            raise PatchError(f"{rel} is not UTF-8 text") from exc
        try:
            result = transform(source)
        except PatchError as exc:
            raise PatchError(f"{rel}: {exc}") from exc
        originals[path] = raw
        staged[path] = result.encode("utf-8")

    test_path = root / "worker/tests/test_image2_identity_routing.py"
    if test_path.exists():
        existing = test_path.read_bytes()
        if existing.decode("utf-8", errors="replace") != TEST_SOURCE:
            raise PatchError(
                "worker/tests/test_image2_identity_routing.py already exists with different content; "
                "review it manually instead of overwriting it."
            )
        originals[test_path] = existing
        staged[test_path] = existing
    else:
        originals[test_path] = b""
        staged[test_path] = TEST_SOURCE.encode("utf-8")

    # Validate Python syntax on all modified/new Python sources before any write.
    for path, content in staged.items():
        if path.suffix == ".py":
            try:
                ast.parse(content.decode("utf-8"), filename=str(path))
            except SyntaxError as exc:
                raise PatchError(f"Python syntax validation failed in {path}: {exc}") from exc

    catalog = staged[root / "worker/catalog.py"].decode("utf-8")
    workflow = staged[root / "worker/workflows/image_render.py"].decode("utf-8")
    workspace = staged[root / "web/components/studio/image2-workspace.tsx"].decode("utf-8")
    route = staged[root / "web/app/api/generate/route.ts"].decode("utf-8")
    required = [
        ("catalog identity helper", "def text_to_image_identity_locked(req: dict) -> bool:", catalog),
        ("catalog strict candidate filter", "if identity_locked:\n        eligible = [candidate for candidate in eligible if candidate.supports_identity_edit]", catalog),
        ("workflow identity routing", "identity_locked=identity_locked,", workflow),
        ("workflow primary image prompt flag", 'input_["preserveElementIdentity"] = bool(input_.get("imageUrl"))', workflow),
        ("UI locked role guard", "!identityLockedReferenceSelected || model.supportsIdentityEdit === true", workspace),
        ("API primary image distinction", 'preserveElementIdentity: isTextToImage && Boolean(imageUrl),', route),
    ]
    for label, needle, blob in required:
        if needle not in blob:
            raise PatchError(f"staged validation missing {label}: {needle!r}")

    return originals, staged


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=Path.cwd(), help="Current repository root (default: cwd)")
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument("--diff", action="store_true", help="Print unified diffs; no files are written")
    mode.add_argument("--apply", action="store_true", help="Write the patch after preflight validation")
    args = parser.parse_args()
    root = args.root.resolve()

    try:
        originals, staged = stage(root)
    except PatchError as exc:
        print(f"PREFLIGHT FAILED: {exc}\nNo project files were changed.", file=sys.stderr)
        return 2

    changed = [path for path in staged if staged[path] != originals[path]]
    if not changed:
        print("The Image2 identity-routing patch is already applied. No files changed.")
        return 0

    print("Preflight passed. Planned changes:")
    for path in changed:
        print(f"  - {path.relative_to(root).as_posix()}")

    if args.diff:
        for path in changed:
            before = originals[path].decode("utf-8").splitlines(keepends=True)
            after = staged[path].decode("utf-8").splitlines(keepends=True)
            diff = difflib.unified_diff(
                before, after,
                fromfile=f"a/{path.relative_to(root).as_posix()}",
                tofile=f"b/{path.relative_to(root).as_posix()}",
            )
            sys.stdout.writelines(diff)
        print("\nDiff only: no files were written.")
        return 0

    if not args.apply:
        print("Read-only mode: no files were written. Use --diff to inspect or --apply to write locally.")
        return 0

    backup_root = Path(tempfile.mkdtemp(prefix="image2-identity-routing-backup-"))
    for path in changed:
        rel = path.relative_to(root)
        if originals[path]:
            backup = backup_root / rel
            backup.parent.mkdir(parents=True, exist_ok=True)
            backup.write_bytes(originals[path])

    written: list[Path] = []
    try:
        for path in changed:
            path.parent.mkdir(parents=True, exist_ok=True)
            tmp = path.with_name(path.name + ".image2-identity-tmp")
            tmp.write_bytes(staged[path])
            os.replace(tmp, path)
            written.append(path)
    except Exception as exc:  # noqa: BLE001
        for path in written:
            if originals[path]:
                path.write_bytes(originals[path])
            else:
                path.unlink(missing_ok=True)
        for path in changed:
            path.with_name(path.name + ".image2-identity-tmp").unlink(missing_ok=True)
        print(f"WRITE FAILED: originals restored where possible: {exc}", file=sys.stderr)
        return 3

    print(f"Applied locally. Original-file backups: {backup_root}")
    print("No GitHub API calls, commits, pushes, deployments, package installs, or paid image generations were performed.")
    print("Next: run the focused pytest module, then the worker test suite and frontend lint/typecheck.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
