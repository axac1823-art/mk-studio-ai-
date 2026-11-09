from __future__ import annotations

import argparse
import ast
import hashlib
import re
import subprocess
import sys
import tempfile
from datetime import datetime
from pathlib import Path

TARGETS = (
    "worker/catalog.py",
    "worker/workflows/image_render.py",
    "worker/workflows/common.py",
    "worker/tests/test_image2_role_prompt_regressions.py",
)


def git(root: Path, *args: str) -> str:
    result = subprocess.run(
        ["git", *args], cwd=root, text=True, capture_output=True, check=False
    )
    if result.returncode:
        raise RuntimeError(result.stderr.strip() or f"git {' '.join(args)} failed")
    return result.stdout.strip()


def replace_once(text: str, old: str, new: str, *, path: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise RuntimeError(
            f"{path}: expected exactly one anchor for {label}, found {count}. "
            "No files have been changed."
        )
    return text.replace(old, new, 1)


def replace_function(
    text: str,
    name: str,
    replacement: str,
    *,
    path: str,
    must_contain: tuple[str, ...],
) -> str:
    pattern = re.compile(
        rf"^def {re.escape(name)}\([^\n]*\)(?:\s*->[^\n:]*)?:.*?(?=^def |\Z)",
        re.MULTILINE | re.DOTALL,
    )
    match = pattern.search(text)
    if match is None:
        raise RuntimeError(
            f"{path}: could not locate top-level function {name}. No files were changed."
        )
    old_function = match.group(0)
    missing = [fragment for fragment in must_contain if fragment not in old_function]
    if missing:
        raise RuntimeError(
            f"{path}: function {name} differs from the reviewed source; "
            f"missing expected body anchors {missing!r}. No files were changed."
        )
    return text[:match.start()] + replacement.rstrip() + "\n\n" + text[match.end():]


def transform(path: str, original: bytes) -> bytes:
    newline = b"\r\n" if b"\r\n" in original else b"\n"
    try:
        text = original.decode("utf-8")
    except UnicodeDecodeError as exc:
        raise RuntimeError(f"{path}: expected UTF-8 source: {exc}") from exc
    text = text.replace("\r\n", "\n")

    if path == "worker/catalog.py":
        text = replace_once(
            text,
            'IMAGE2_REFERENCE_ROLES = {"element", "base", "style", "detail"}\n\n\n',
            '''IMAGE2_REFERENCE_ROLES = {"element", "base", "style", "detail"}


class Image2RoleConflictError(ValueError):
    """The prompt explicitly assigns a reference a role different from its saved metadata."""


class Image2AutoFrameError(ValueError):
    """The selected Base metadata is ambiguous or its dimensions cannot be inspected."""


''',
            path=path,
            label="Image2 validation exceptions",
        )

        text = replace_once(
            text,
            '            rf"(?:\\u0627\\u062d\\u0641\\u0638|\\u0627\\u062d\\u062a\\u0641\\u0638)[^.!?\\n]{{0,70}}(?:\\u0647\\u0648\\u064a\\u0629|\\u0634\\u0643\\u0644|\\u0646\\u0633\\u0628)[^.!?\\n]{{0,40}}{image_tag}",\n',
            '',
            path=path,
            label="remove non-role Arabic identity wording from explicit role parser",
        )
        text = replace_once(
            text,
            '                rf"\\b(?:preserve|keep|retain)\\b[^.!?\\n]{{0,100}}\\b(?:identity|silhouette|proportions|features)\\b[^.!?\\n]{{0,50}}{image_tag}\\b",\n',
            '',
            path=path,
            label="remove non-role English identity wording from explicit role parser",
        )

        normalize_replacement = '''def normalize_image2_reference_roles(req: dict) -> list[str]:
    """Return saved Image2 roles; never infer or mutate them from prompt text.

    Legacy requests without valid role metadata keep the historical Element default.
    """
    references = req.get("referenceUrls") or []
    if not isinstance(references, (list, tuple)):
        references = []

    raw_roles = req.get("referenceRoles") or []
    if not isinstance(raw_roles, (list, tuple)):
        raw_roles = []

    roles: list[str] = []
    for index in range(len(references)):
        saved_role = raw_roles[index] if index < len(raw_roles) else None
        if isinstance(saved_role, str) and saved_role in IMAGE2_REFERENCE_ROLES:
            roles.append(saved_role)
        else:
            roles.append("element")
    return roles


def image2_reference_role_conflicts(req: dict) -> list[dict[str, str]]:
    """Find explicit prompt role assignments that contradict saved role metadata.

    Prompt text is validation-only here. It never changes the returned role manifest.
    Multiple prompt clauses are checked independently so contradictory assignments
    to the same tag are not hidden by the first matching clause.
    """
    references = req.get("referenceUrls") or []
    if not isinstance(references, (list, tuple)) or not references:
        return []

    scene_details = req.get("sceneDetails")
    if not isinstance(scene_details, str) or not scene_details.strip():
        return []

    raw_tags = req.get("referenceTags") or []
    if not isinstance(raw_tags, (list, tuple)):
        raw_tags = []

    saved_roles = normalize_image2_reference_roles(req)
    clauses = re.split(r"(?<=[.!?؟])\\s+|[\\r\\n;،]+", scene_details)
    conflicts: list[dict[str, str]] = []

    for index, saved_role in enumerate(saved_roles):
        tag = raw_tags[index] if index < len(raw_tags) else None
        if not isinstance(tag, str) or not re.fullmatch(r"@img[1-9]\\d*", tag):
            tag = f"@img{index + 1}"

        declared_roles: set[str] = set()
        image_tag = re.escape(tag)
        direct_role_patterns = {
            "base": (
                rf"{image_tag}\\s+(?:as\\s+)?(?:(?:the|a|an)\\s+)?(?:base|background|backdrop|destination(?:\\s+scene)?)\\b",
                rf"{image_tag}\\s+(?:كخلفية|كقاعدة|كمشهد\\s+أساسي)",
            ),
            "element": (
                rf"{image_tag}\\s+(?:as\\s+)?(?:(?:the|a|an)\\s+)?(?:element|object|item|subject|product|person|building)\\b",
                rf"{image_tag}\\s+(?:كعنصر|كجسم|كمنتج|كشخص)",
            ),
            "style": (
                rf"{image_tag}\\s+(?:as|for)\\s+(?:(?:the|a|an)\\s+)?(?:style|lighting|light|color(?:\\s+treatment)?|palette|visual\\s+treatment)\\b",
                rf"{image_tag}\\s+(?:للإضاءة|للضوء|للألوان|للمعالجة\\s+البصرية|كمرجع\\s+أسلوبي)",
            ),
            "detail": (
                rf"{image_tag}\\s+(?:as|for)\\s+(?:(?:the|a|an)\\s+)?(?:material|texture|detail|pattern|finish|surface)\\b",
                rf"{image_tag}\\s+(?:للخامة|للملمس|للتفاصيل|للنقش|للتشطيب)",
            ),
        }
        for clause in clauses:
            negative_patterns = (
                rf"\\b(?:do\\s+not|don't|never|avoid)\\s+(?:use|treat|assign|consider|interpret)\\s+{image_tag}\\s+(?:as|for)\\b",
                rf"{image_tag}\\s+(?:is|should\\s+be)\\s+not\\s+(?:the\\s+)?(?:base|background|style|lighting|light|material|texture|detail|element|object)\\b",
                rf"(?:لا\\s+تستخدم|لا\\s+تعامل|لا\\s+تعتبر|لا\\s+تسند|لا\\s+تصنف)\\s+{image_tag}\\s+(?:ك|على\\s+أنه|على\\s+أنها)",
            )
            if any(re.search(pattern, clause, re.IGNORECASE) for pattern in negative_patterns):
                continue

            for role, patterns in direct_role_patterns.items():
                if any(re.search(pattern, clause, re.IGNORECASE) for pattern in patterns):
                    declared_roles.add(role)

            # Also catch compact contradictory assignments such as
            # "Use @img1 as Base and Element" within one sentence.
            all_role_aliases = (
                r"base|background|backdrop|destination|element|object|item|subject|product|person|building|"
                r"style|lighting|light|color(?:\\s+treatment)?|palette|visual\\s+treatment|"
                r"material|texture|detail|pattern|finish|surface"
            )
            for role, aliases in (
                ("base", r"base|background|backdrop|destination"),
                ("element", r"element|object|item|subject|product|person|building"),
                ("style", r"style|lighting|light|color(?:\\s+treatment)?|palette|visual\\s+treatment"),
                ("detail", r"material|texture|detail|pattern|finish|surface"),
            ):
                compound = (
                    rf"{image_tag}\\s+(?:as|for)\\s+(?:(?:the|a|an)\\s+)?(?:{all_role_aliases})"
                    rf"\\s+(?:and|or|/)\\s+(?:(?:the|a|an)\\s+)?(?:{aliases})\\b"
                )
                if re.search(compound, clause, re.IGNORECASE):
                    declared_roles.add(role)

            explicit_role = _explicit_image2_reference_role(clause, tag)
            if explicit_role in IMAGE2_REFERENCE_ROLES:
                declared_roles.add(explicit_role)

        for prompt_role in sorted(declared_roles):
            if prompt_role != saved_role:
                conflicts.append(
                    {
                        "tag": tag,
                        "saved_role": saved_role,
                        "prompt_role": prompt_role,
                    }
                )

    return conflicts

'''
        text = replace_function(
            text,
            "normalize_image2_reference_roles",
            normalize_replacement,
            path=path,
            must_contain=(
                "if explicit_role in IMAGE2_REFERENCE_ROLES:",
                'scene_details = req.get("sceneDetails")',
                'role = "element"',
            ),
        )

        frame_replacement = '''def image2_frame_reference(req: dict) -> str | None:
    """Return the single explicitly tagged Base reference for Auto framing.

    Primary Image, Element, Style and Detail never become an Auto frame source.
    With no Base, the caller applies the documented default. Multiple Base roles
    are ambiguous and must be resolved by the user before provider selection.
    """
    references = req.get("referenceUrls") or []
    if not isinstance(references, (list, tuple)):
        references = []

    roles = normalize_image2_reference_roles(req)
    base_indices = [index for index, role in enumerate(roles) if role == "base"]

    if len(base_indices) > 1:
        raise Image2AutoFrameError(
            f"Auto framing requires exactly one Base reference; found {len(base_indices)}. "
            "Keep one Base image or choose an explicit aspect ratio."
        )

    if not base_indices:
        return None

    base_index = base_indices[0]
    if base_index >= len(references):
        raise Image2AutoFrameError(
            "The selected Base reference is missing. Re-select the Base image or choose an explicit aspect ratio."
        )

    value = references[base_index]
    if not isinstance(value, str) or not value.strip():
        raise Image2AutoFrameError(
            "The selected Base reference is empty or invalid. Re-select the Base image or choose an explicit aspect ratio."
        )
    return value

'''
        text = replace_function(
            text,
            "image2_frame_reference",
            frame_replacement,
            path=path,
            must_contain=(
                "Primary image: used when there is no Base.",
                'primary = req.get("imageUrl")',
                'element_index = next(',
            ),
        )

    elif path == "worker/workflows/image_render.py":
        text = replace_once(
            text,
            "from PIL import Image\n",
            "from PIL import Image, ImageOps\n",
            path=path,
            label="Pillow EXIF orientation import",
        )
        text = replace_once(
            text,
            "    image2_frame_reference,\n    image2_identity_object_count,\n",
            "    image2_frame_reference,\n    image2_identity_object_count,\n    image2_reference_role_conflicts,\n    Image2AutoFrameError,\n    Image2RoleConflictError,\n",
            path=path,
            label="Image2 catalog imports",
        )

        infer_replacement = '''def _infer_aspect_ratio(value: str | None) -> str:
    """Infer the nearest supported frame from one Base image.

    A missing Base uses the documented 4:3 default. If a Base was selected but
    cannot be read, fail explicitly instead of silently changing its frame to 4:3.
    EXIF orientation is applied to an in-memory Pillow view for measurement only;
    the original reference bytes and provider input are never rewritten.
    """
    if not isinstance(value, str) or not value.strip():
        return "4:3"

    try:
        if value.startswith("data:") and "," in value:
            payload = value.split(",", 1)[1]
            image_bytes = base64.b64decode(payload, validate=True)
        elif value.startswith("/storage/"):
            image_bytes = storage.resolve(value).read_bytes()
        elif value.startswith(("http://", "https://")):
            local_path = storage.local_path_from_url(value)
            if local_path is not None and local_path.is_file():
                image_bytes = local_path.read_bytes()
            else:
                image_bytes, _content_type = get_bytes(value, timeout_s=30)
        else:
            raise ValueError("unsupported Base image reference format")

        with Image.open(io.BytesIO(image_bytes)) as image:
            oriented_image = ImageOps.exif_transpose(image)
            width, height = oriented_image.size
            if width <= 0 or height <= 0:
                raise ValueError("Base image has invalid dimensions")
            source_ratio = width / height

        ratios = {
            "1:1": 1.0,
            "16:9": 16 / 9,
            "9:16": 9 / 16,
            "4:3": 4 / 3,
            "3:4": 3 / 4,
            "3:2": 3 / 2,
            "2:3": 2 / 3,
            "21:9": 21 / 9,
        }
        return min(
            ratios,
            key=lambda key: abs(math.log(source_ratio / ratios[key])),
        )
    except Exception as exc:
        # Do not log the URL or data URI: either may contain private/signed data.
        logger.error(
            "IMAGE2_AUTO_FRAME_BASE_INSPECTION_FAILED error_type=%s",
            type(exc).__name__,
        )
        raise Image2AutoFrameError(
            "Auto could not read the selected Base image dimensions. "
            "Re-select the Base image or choose an explicit aspect ratio."
        ) from exc

'''
        text = replace_function(
            text,
            "_infer_aspect_ratio",
            infer_replacement,
            path=path,
            must_contain=(
                "width, height = image.size",
                "Keep Auto usable when a reference URL cannot be inspected.",
                'return "4:3"',
            ),
        )

        ratio_resolver = (
            "def _resolve_image2_aspect_ratio(input_: dict, req: dict) -> str:\n"
            '    """Resolve the Image2 output frame once; adapters may only translate it."""\n'
            '    requested_ratio = input_.get("aspectRatio") or "4:3"\n'
            '    if requested_ratio != "auto":\n'
            '        return requested_ratio\n\n'
            '    frame_reference = image2_frame_reference(req)\n'
            '    if frame_reference:\n'
            '        return _infer_aspect_ratio(frame_reference)\n\n'
            '    if (\n'
            '        input_.get("model") == "magichour-flux-2-klein-text"\n'
            '        and not text_to_image_images(input_)\n'
            '    ):\n'
            '        return "1:1"\n\n'
            '    return "4:3"\n\n\n'
        )
        text = replace_once(
            text,
            "def run(job: dict) -> None:\n",
            ratio_resolver + "def run(job: dict) -> None:\n",
            path=path,
            label="centralized Image2 explicit/Auto ratio resolution",
        )

        old_auto_block = (
            '            requested_ratio = input_.get("aspectRatio") or "4:3"\n\n'
            '            if requested_ratio == "auto":\n'
            '                frame_reference = image2_frame_reference(req)\n\n'
            '                if frame_reference:\n'
            '                    # A real destination frame always has priority.\n'
            '                    req["resolvedAspectRatio"] = _infer_aspect_ratio(\n'
            '                        frame_reference\n'
            '                    )\n\n'
            '                elif (\n'
            '                    input_.get("model") == "magichour-flux-2-klein-text"\n'
            '                    and not text_to_image_images(input_)\n'
            '                ):\n'
            '                    # Magic Hour text-only Generator defaults to square.\n'
            '                    # Keep Auto compatible with its native output frame.\n'
            '                    req["resolvedAspectRatio"] = "1:1"\n\n'
            '                else:\n'
            '                    # Preserve the existing project default for other cases.\n'
            '                    req["resolvedAspectRatio"] = _infer_aspect_ratio(None)\n\n'
            '            else:\n'
            '                req["resolvedAspectRatio"] = requested_ratio\n'
        )
        new_auto_block = (
            '            requested_ratio = input_.get("aspectRatio") or "4:3"\n'
            '            req["resolvedAspectRatio"] = _resolve_image2_aspect_ratio(input_, req)\n'
        )
        text = replace_once(
            text,
            old_auto_block,
            new_auto_block,
            path=path,
            label="Base-only Auto and explicit-ratio resolution",
        )

        text = replace_once(
            text,
            "        try:\n            prompt = build_feature_prompt(feature, input_)\n",
            '''        try:
            if feature == "text_to_image":
                role_conflicts = image2_reference_role_conflicts(input_)
                if role_conflicts:
                    details = "; ".join(
                        f"{item['tag']} is saved as {item['saved_role'].title()} "
                        f"but the prompt explicitly assigns it as {item['prompt_role'].title()}"
                        for item in role_conflicts
                    )
                    raise Image2RoleConflictError(
                        "Image2 reference role conflict: " + details + ". "
                        "The saved role is authoritative. Edit the prompt or change the role "
                        "in Image2; no provider request was sent."
                    )

            prompt = build_feature_prompt(feature, input_)
''',
            path=path,
            label="pre-provider role conflict validation",
        )

    elif path == "worker/workflows/common.py":
        text = replace_once(
            text,
            "from providers.http_helpers import data_uri_to_bytes, get_bytes\nfrom workflows.engine import AllModelsFailedError, OutputValidationError\n",
            "from catalog import Image2AutoFrameError, Image2RoleConflictError\nfrom providers.http_helpers import data_uri_to_bytes, get_bytes\nfrom workflows.engine import AllModelsFailedError, OutputValidationError\n",
            path=path,
            label="safe Image2 validation error imports",
        )
        text = replace_once(
            text,
            'def _client_failure_message(err: Exception) -> str:\n'
            '    """Traduit les erreurs providers en messages actionnables sans exposer\n'
            '    les réponses brutes, URLs internes ou détails d\'authentification."""\n'
            '    if isinstance(err, OutputValidationError):\n',
            'def _client_failure_message(err: Exception) -> str:\n'
            '    """Traduit les erreurs providers en messages actionnables sans exposer\n'
            '    les réponses brutes, URLs internes ou détails d\'authentification."""\n'
            '    if isinstance(err, (Image2RoleConflictError, Image2AutoFrameError)):\n'
            '        return str(err)\n'
            '    if isinstance(err, OutputValidationError):\n',
            path=path,
            label="client-facing Image2 role and Auto errors",
        )

    elif path == "worker/tests/test_image2_role_prompt_regressions.py":
        text = replace_once(
            text,
            "\"\"\"Regressions for Image2 source roles, identity prompts and provider ordering.\"\"\"\nimport sys\nfrom pathlib import Path\n",
            "\"\"\"Regressions for Image2 source roles, identity prompts and provider ordering.\"\"\"\nimport base64\nimport io\nimport sys\nfrom pathlib import Path\n\nfrom PIL import Image\n",
            path=path,
            label="EXIF regression test imports",
        )
        text = replace_once(
            text,
            "    image2_frame_reference,\n    image2_identity_object_count,\n",
            "    image2_frame_reference,\n    image2_identity_object_count,\n    image2_reference_role_conflicts,\n    Image2AutoFrameError,\n    Image2RoleConflictError,\n",
            path=path,
            label="Image2 role and Auto test imports",
        )
        text = replace_once(
            text,
            "from workflows.engine import order_text_to_image_candidates\n",
            "from workflows.engine import order_text_to_image_candidates\nfrom workflows.image_render import _infer_aspect_ratio, _resolve_image2_aspect_ratio\nfrom workflows import image_render\n",
            path=path,
            label="Auto ratio test import",
        )

        explicit_test = '''def test_saved_role_metadata_is_authoritative_and_prompt_conflicts_are_reported():
    req = {
        "referenceUrls": ["base.png"],
        "referenceTags": ["@img1"],
        "referenceRoles": ["base"],
        "sceneDetails": "Use @img1 as an Element.",
    }

    assert normalize_image2_reference_roles(req) == ["base"]
    assert image2_reference_role_conflicts(req) == [
        {"tag": "@img1", "saved_role": "base", "prompt_role": "element"}
    ]


def test_identity_preservation_language_does_not_reassign_a_base_role():
    req = {
        "referenceUrls": ["base.png"],
        "referenceTags": ["@img1"],
        "referenceRoles": ["base"],
        "sceneDetails": "Preserve the identity, geometry and proportions of @img1.",
    }

    assert normalize_image2_reference_roles(req) == ["base"]
    assert image2_reference_role_conflicts(req) == []


def test_prompt_assigning_two_roles_to_one_tag_is_rejected_as_ambiguous():
    req = {
        "referenceUrls": ["base.png"],
        "referenceTags": ["@img1"],
        "referenceRoles": ["base"],
        "sceneDetails": "Use @img1 as Base and Element.",
    }

    assert normalize_image2_reference_roles(req) == ["base"]
    assert image2_reference_role_conflicts(req) == [
        {"tag": "@img1", "saved_role": "base", "prompt_role": "element"}
    ]


def test_negative_role_instruction_does_not_create_a_conflict():
    req = {
        "referenceUrls": ["base.png"],
        "referenceTags": ["@img1"],
        "referenceRoles": ["base"],
        "sceneDetails": "Do not use @img1 as an Element; preserve it as the Base scene.",
    }

    assert normalize_image2_reference_roles(req) == ["base"]
    assert image2_reference_role_conflicts(req) == []


def test_same_role_instruction_does_not_create_a_conflict():
    req = {
        "referenceUrls": ["base.png"],
        "referenceTags": ["@img1"],
        "referenceRoles": ["base"],
        "sceneDetails": "Use @img1 as the Base scene.",
    }

    assert normalize_image2_reference_roles(req) == ["base"]
    assert image2_reference_role_conflicts(req) == []


def test_legacy_missing_role_defaults_to_element_and_prompt_cannot_change_it():
    req = {
        "referenceUrls": ["reference.png"],
        "referenceTags": ["@img1"],
        "sceneDetails": "Use @img1 as the Base scene.",
    }

    assert normalize_image2_reference_roles(req) == ["element"]
    assert image2_reference_role_conflicts(req) == [
        {"tag": "@img1", "saved_role": "element", "prompt_role": "base"}
    ]


def test_role_conflict_fails_before_prompt_build_or_provider_execution(monkeypatch):
    failures = []

    class FakeConnection:
        def __enter__(self):
            return self

        def __exit__(self, exc_type, exc, traceback):
            return False

    def unexpected_call(*args, **kwargs):
        raise AssertionError("a role conflict must stop before provider execution")

    monkeypatch.setattr(image_render.db, "connect", lambda: FakeConnection())
    monkeypatch.setattr(image_render, "mark_processing", lambda conn, job_id: None)
    monkeypatch.setattr(image_render, "fail_job", lambda conn, job, err: failures.append(err))
    monkeypatch.setattr(image_render, "build_feature_prompt", unexpected_call)
    monkeypatch.setattr(image_render, "execute_with_fallback", unexpected_call)

    image_render.run(
        {
            "id": "test-job",
            "input": {
                "feature": "text_to_image",
                "referenceUrls": ["base.png"],
                "referenceTags": ["@img1"],
                "referenceRoles": ["base"],
                "sceneDetails": "Use @img1 as an Element.",
            },
        }
    )

    assert len(failures) == 1
    assert isinstance(failures[0], Image2RoleConflictError)


def test_arabic_prompt_role_conflicts_are_detected_without_mutating_metadata():
    req = {
        "referenceUrls": ["element.png", "base.png", "style.png", "detail.png"],
        "referenceTags": ["@img1", "@img2", "@img3", "@img4"],
        "referenceRoles": ["detail", "element", "element", "style"],
        "sceneDetails": (
            "استخدم @img1 كعنصر لإدخاله في @img2. "
            "استخدم @img3 للإضاءة والألوان فقط. "
            "استفد من خامة @img4 فقط."
        ),
    }

    assert normalize_image2_reference_roles(req) == [
        "detail", "element", "element", "style"
    ]
    assert image2_reference_role_conflicts(req) == [
        {"tag": "@img1", "saved_role": "detail", "prompt_role": "element"},
        {"tag": "@img2", "saved_role": "element", "prompt_role": "base"},
        {"tag": "@img3", "saved_role": "element", "prompt_role": "style"},
        {"tag": "@img4", "saved_role": "style", "prompt_role": "detail"},
    ]

'''
        text = replace_function(
            text,
            "test_explicit_prompt_roles_override_saved_metadata",
            explicit_test,
            path=path,
            must_contain=(
                'assert normalize_image2_reference_roles(req) == [',
                '\"element\",\n        \"base\",\n        \"style\",\n        \"detail\",',
            ),
        )

        # Replace the older Arabic test: its previous expectation explicitly allowed
        # prompt text to mutate saved role metadata, which is now prohibited.
        arabic_old = '''def test_arabic_prompt_roles_are_recognized():
    req = {
        "referenceUrls": [
            "element.png",
            "background.png",
            "lighting.png",
            "material.png",
        ],
        "referenceTags": [
            "@img1",
            "@img2",
            "@img3",
            "@img4",
        ],
        "referenceRoles": [
            "detail",
            "element",
            "element",
            "style",
        ],
        "sceneDetails": (
            "استخدم @img1 كعنصر لإدخاله في @img2. "
            "استخدم @img3 للإضاءة والألوان فقط. "
            "استفد من خامة @img4 فقط."
        ),
    }

    assert normalize_image2_reference_roles(req) == [
        "element",
        "base",
        "style",
        "detail",
    ]

'''
        text = replace_once(
            text,
            arabic_old,
            "",
            path=path,
            label="remove obsolete prompt-overrides-role test",
        )

        primary_auto_old = '''def test_auto_frame_uses_primary_image_without_base():
    req = {
        "imageUrl": "primary.png",
        "referenceUrls": [
            "style.png",
            "detail.png",
        ],
        "referenceRoles": [
            "style",
            "detail",
        ],
    }

    assert image2_frame_reference(req) == "primary.png"

'''
        text = replace_once(
            text,
            primary_auto_old,
            '''def test_auto_frame_does_not_use_primary_image_without_base():
    req = {
        "imageUrl": "primary.png",
        "referenceUrls": ["style.png", "detail.png"],
        "referenceRoles": ["style", "detail"],
    }

    assert image2_frame_reference(req) is None

''',
            path=path,
            label="Base-only Auto primary-image test",
        )

        element_auto_old = '''def test_auto_frame_falls_back_to_first_element():
    req = {
        "referenceUrls": [
            "style.png",
            "detail.png",
            "first-element.png",
            "second-element.png",
        ],
        "referenceRoles": [
            "style",
            "detail",
            "element",
            "element",
        ],
    }

    assert image2_frame_reference(req) == "first-element.png"

'''
        text = replace_once(
            text,
            element_auto_old,
            '''def test_auto_frame_does_not_use_element_without_base():
    req = {
        "referenceUrls": ["style.png", "detail.png", "element.png"],
        "referenceRoles": ["style", "detail", "element"],
    }

    assert image2_frame_reference(req) is None

''',
            path=path,
            label="Base-only Auto Element test",
        )

        insert_before = "def test_magic_hour_generator_and_editor_have_different_frame_capabilities():\n"
        additions = '''def test_auto_frame_rejects_multiple_base_references():
    req = {
        "referenceUrls": ["base-one.png", "base-two.png", "element.png"],
        "referenceRoles": ["base", "base", "element"],
    }

    try:
        image2_frame_reference(req)
    except Image2AutoFrameError as exc:
        assert "exactly one Base" in str(exc)
    else:
        raise AssertionError("multiple Base references must fail Auto framing")


def test_auto_frame_rejects_a_missing_base_file():
    req = {"referenceUrls": [None], "referenceRoles": ["base"]}

    try:
        image2_frame_reference(req)
    except Image2AutoFrameError as exc:
        assert "Base reference" in str(exc)
    else:
        raise AssertionError("a missing Base file must not silently default to 4:3")


def test_auto_uses_four_by_three_without_base_even_when_primary_or_element_exists():
    request = {
        "imageUrl": "primary.png",
        "referenceUrls": ["style.png", "detail.png", "element.png"],
        "referenceRoles": ["style", "detail", "element"],
        "aspectRatio": "auto",
        "model": "gpt-image-2.5-sunburst",
    }

    assert _resolve_image2_aspect_ratio(request, request) == "4:3"


def test_auto_magic_hour_text_only_keeps_square_native_default():
    request = {
        "referenceUrls": [],
        "referenceRoles": [],
        "aspectRatio": "auto",
        "model": "magichour-flux-2-klein-text",
    }

    assert _resolve_image2_aspect_ratio(request, request) == "1:1"


def test_explicit_ratio_is_not_recomputed_from_base():
    request = {
        "referenceUrls": ["unreadable-base.png"],
        "referenceRoles": ["base"],
        "aspectRatio": "16:9",
        "model": "gpt-image-2.5-sunburst",
    }

    assert _resolve_image2_aspect_ratio(request, request) == "16:9"


def _jpeg_data_uri_with_orientation(width: int, height: int, orientation: int) -> tuple[str, bytes]:
    image = Image.new("RGB", (width, height), "white")
    exif = image.getexif()
    exif[274] = orientation
    buffer = io.BytesIO()
    image.save(buffer, format="JPEG", exif=exif.tobytes())
    original = buffer.getvalue()
    encoded = base64.b64encode(original).decode("ascii")
    return f"data:image/jpeg;base64,{encoded}", original


def test_auto_ratio_respects_exif_orientation_6_without_changing_source_bytes():
    data_uri, original_bytes = _jpeg_data_uri_with_orientation(1600, 900, 6)
    before_hash = __import__("hashlib").sha256(original_bytes).hexdigest()

    assert _infer_aspect_ratio(data_uri) == "9:16"
    after_bytes = base64.b64decode(data_uri.split(",", 1)[1])
    assert __import__("hashlib").sha256(after_bytes).hexdigest() == before_hash
    assert after_bytes == original_bytes


def test_auto_ratio_respects_exif_orientation_8_without_changing_source_bytes():
    data_uri, original_bytes = _jpeg_data_uri_with_orientation(900, 1600, 8)
    before_hash = __import__("hashlib").sha256(original_bytes).hexdigest()

    assert _infer_aspect_ratio(data_uri) == "16:9"
    after_bytes = base64.b64decode(data_uri.split(",", 1)[1])
    assert __import__("hashlib").sha256(after_bytes).hexdigest() == before_hash
    assert after_bytes == original_bytes


def test_auto_ratio_fails_clearly_when_selected_base_cannot_be_read():
    try:
        _infer_aspect_ratio("data:image/png;base64,not-a-valid-image")
    except Image2AutoFrameError as exc:
        assert "could not read" in str(exc).lower()
    else:
        raise AssertionError("an unreadable Base must not silently become 4:3")


'''
        text = replace_once(
            text,
            insert_before,
            additions + insert_before,
            path=path,
            label="Base-only and EXIF regression tests",
        )

    else:
        raise RuntimeError(f"Unexpected target path: {path}")

    rendered = text.replace("\n", newline.decode("ascii")).encode("utf-8")
    if path.endswith(".py"):
        ast.parse(rendered.decode("utf-8"), filename=path)
    return rendered


def main() -> int:
    parser = argparse.ArgumentParser(
        description=(
            "Prepare/apply Image2 batch 1: immutable role metadata, prompt conflict "
            "validation, Base-only Auto framing, and EXIF-aware measurement."
        )
    )
    parser.add_argument("--root", default=".", help="Repository root")
    parser.add_argument("--apply", action="store_true", help="Write after all anchors pass; dry-run is default")
    args = parser.parse_args()

    root = Path(args.root).resolve()
    if git(root, "branch", "--show-current") != "codex":
        raise RuntimeError("Expected branch 'codex'. No files were changed.")
    head = git(root, "rev-parse", "HEAD")

    target_status = git(root, "status", "--porcelain", "--", *TARGETS).splitlines()
    if target_status:
        names = sorted(line[3:] for line in target_status if len(line) > 3)
        raise RuntimeError(
            "Target files already have local changes; refusing to overwrite them: "
            + ", ".join(names)
        )

    prepared: dict[str, tuple[bytes, bytes]] = {}
    for rel in TARGETS:
        path = root / rel
        if not path.is_file():
            raise RuntimeError(f"Missing target file: {rel}. No files were changed.")
        before = path.read_bytes()
        after = transform(rel, before)
        prepared[rel] = (before, after)

    print(f"Branch: codex")
    print(f"HEAD:   {head}")
    print(f"Validated all exact source anchors in {len(prepared)} files.")
    for rel, (before, after) in prepared.items():
        digest = hashlib.sha256(after).hexdigest()[:12]
        print(f"  {rel}: {len(before)} -> {len(after)} bytes; new sha256={digest}")

    if not args.apply:
        print("\nDRY RUN ONLY. No source files were written.")
        print("Run again with --apply after reviewing this list.")
        return 0

    backup_root = Path(tempfile.gettempdir()) / f"image2-batch1-backup-{datetime.now():%Y%m%d-%H%M%S}"
    backup_root.mkdir(parents=True, exist_ok=False)
    written: list[str] = []
    try:
        for rel, (before, after) in prepared.items():
            backup = backup_root / rel
            backup.parent.mkdir(parents=True, exist_ok=True)
            backup.write_bytes(before)
            destination = root / rel
            temporary = destination.with_name(destination.name + ".image2-batch1.tmp")
            temporary.write_bytes(after)
            temporary.replace(destination)
            written.append(rel)
    except Exception:
        for rel in reversed(written):
            (root / rel).write_bytes((backup_root / rel).read_bytes())
        raise

    print("\nApplied successfully.")
    print(f"Backup outside repository: {backup_root}")
    print("No commit/push was created. README.md and web/.next-dev were not touched.")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        raise SystemExit(1)
