#!/usr/bin/env python3
"""Temporary local-only diagnostic patch for Image2 provider failures.

Run from the repository root. Backs up worker/workflows/common.py and existing
worker .env files, then makes Image2 show a redacted per-model provider error
instead of only the generic quota/configuration message. It does not call any
provider, change API keys, reset Git, or modify provider request payloads.
Re-run after diagnosis to restore the backups manually if desired.
"""
from __future__ import annotations

import hashlib
import os
import py_compile
import re
import shutil
import sys
from datetime import datetime
from pathlib import Path

REPO_SLUG = "axac1823-art/mk-studio-ai-"
DEBUG_BLOCK = '''    # IMAGE2_LOCAL_PROVIDER_DIAGNOSTIC: temporary local debugging only.
    if isinstance(err, AllModelsFailedError) and os.getenv("IMAGE2_DEBUG_PROVIDER_ERRORS") == "1":
        diagnostic_parts = []
        for attempt in err.attempts[:6]:
            label = str(attempt.get("candidateKey") or "unknown-model")
            raw_error = str(attempt.get("error") or "no error text")
            raw_error = re.sub(r"(?i)(authorization\\s*[:=]\\s*bearer\\s+)[^\\s,;]+", r"\\1[REDACTED]", raw_error)
            raw_error = re.sub(r"\\bsk-[A-Za-z0-9_-]{12,}\\b", "[REDACTED]", raw_error)
            raw_error = re.sub(r"(?i)(api[_ -]?key|access[_ -]?token|secret|token)(\\s*[:=]\\s*)[^\\s,;]+", r"\\1\\2[REDACTED]", raw_error)
            raw_error = re.sub(r"(https?://[^\\s?]+)\\?[^\\s]+", r"\\1?[query-redacted]", raw_error)
            raw_error = " ".join(raw_error.split())[:320]
            diagnostic_parts.append(f"{label}: {raw_error}")
        details = " | ".join(diagnostic_parts) or str(err)[:320]
        return "Image2 provider diagnostic (per-model; quota is not inferred): " + details
'''


def fail(message: str) -> None:
    print(f"STOP: {message}", file=sys.stderr)
    raise SystemExit(2)


def find_root(start: Path) -> Path:
    for candidate in (start, *start.parents):
        if (candidate / ".git").exists() and (candidate / "worker" / "workflows" / "common.py").is_file():
            return candidate.resolve()
    fail("Run from the project root or a subfolder containing worker/workflows/common.py.")


def add_import(source: str, name: str) -> str:
    if re.search(rf"^import {re.escape(name)}$", source, flags=re.M):
        return source
    # Insert among top-level imports after the module docstring if present.
    lines = source.splitlines(keepends=True)
    i = 0
    if lines and lines[0].startswith(('"""', "'''")):
        quote = lines[0][:3]
        if lines[0].count(quote) < 2:
            i = 1
            while i < len(lines) and quote not in lines[i]:
                i += 1
            i += 1
    # Put the import before the first non-future import, after future imports.
    while i < len(lines) and (not lines[i].strip() or lines[i].lstrip().startswith("#")):
        i += 1
    while i < len(lines) and lines[i].startswith("from __future__ import "):
        i += 1
    lines.insert(i, f"import {name}\n")
    return "".join(lines)


def patch_common(path: Path) -> tuple[str, bool]:
    source = path.read_text(encoding="utf-8")
    if "IMAGE2_LOCAL_PROVIDER_DIAGNOSTIC" in source:
        return source, False
    fn_start = source.find("def _client_failure_message(err: Exception) -> str:")
    if fn_start < 0:
        raise RuntimeError(f"Cannot find _client_failure_message in {path}")
    fn_end = source.find("\n\ndef store_output(", fn_start)
    if fn_end < 0:
        raise RuntimeError(f"Cannot safely find end of error classifier in {path}")
    # Inject immediately after the function docstring, before any generic classification.
    doc_start = source.find('"""', fn_start)
    doc_end = source.find('"""', doc_start + 3)
    if doc_start < 0 or doc_end < 0 or doc_end > fn_end:
        raise RuntimeError(f"Could not locate classifier docstring in {path}")
    insert_at = source.find("\n", doc_end + 3) + 1
    new_source = source[:insert_at] + DEBUG_BLOCK + source[insert_at:]
    new_source = add_import(new_source, "os")
    new_source = add_import(new_source, "re")
    compile(new_source, str(path), "exec")
    return new_source, True


def update_env(path: Path) -> tuple[bytes | None, bool]:
    # If this checkout has no .env, create one containing only the temporary
    # diagnostic flag. Existing process-level/provider variables remain intact
    # because python-dotenv does not override them by default.
    if not path.is_file():
        return b"# Temporary local Image2 diagnostic; remove after debugging\nIMAGE2_DEBUG_PROVIDER_ERRORS=1\n", True
    raw = path.read_bytes()
    text = raw.decode("utf-8", errors="replace")
    lines = text.splitlines()
    found = False
    for i, line in enumerate(lines):
        if line.strip().startswith("IMAGE2_DEBUG_PROVIDER_ERRORS="):
            lines[i] = "IMAGE2_DEBUG_PROVIDER_ERRORS=1"
            found = True
    if not found:
        if lines and lines[-1].strip():
            lines.append("")
        lines.append("# Temporary local Image2 diagnostic; remove after debugging")
        lines.append("IMAGE2_DEBUG_PROVIDER_ERRORS=1")
    ending = "\r\n" if b"\r\n" in raw else "\n"
    updated = (ending.join(lines) + ending).encode("utf-8")
    return updated, updated != raw


def main() -> int:
    root = find_root(Path.cwd().resolve())
    expected = f"github.com/{REPO_SLUG}"
    remote_result = __import__("subprocess").run(
        ["git", "-C", str(root), "remote", "get-url", "origin"],
        capture_output=True, text=True,
    )
    remote = remote_result.stdout.strip() if remote_result.returncode == 0 else "(origin unavailable)"
    if remote_result.returncode == 0 and expected.lower() not in remote.lower().replace(".git", ""):
        fail(f"Unexpected Git origin; no files changed. origin={remote}")

    targets: list[tuple[str, Path, Path]] = []
    candidates = [("main", root / "worker")]
    codex_worker = root / ".codex-worktrees" / "codex" / "worker"
    if codex_worker.is_dir():
        candidates.append(("codex", codex_worker))
    for label, worker_dir in candidates:
        common = worker_dir / "workflows" / "common.py"
        if common.is_file():
            targets.append((label, common, worker_dir / ".env"))
    if not targets:
        fail("No worker/workflows/common.py found.")

    prepared = []
    for label, common, env_path in targets:
        new_source, changed = patch_common(common)
        env_existed = env_path.is_file()
        new_env, env_changed = update_env(env_path)
        prepared.append((label, common, env_path, new_source, changed, new_env, env_changed, env_existed))

    stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    desktop = Path(os.environ.get("USERPROFILE", str(Path.home()))) / "Desktop"
    if not desktop.is_dir():
        desktop = Path.home()
    backup_dir = desktop / f"image2-provider-debug-backup-{stamp}"
    backup_dir.mkdir(parents=True, exist_ok=False)
    (backup_dir / "manifest.txt").write_text(f"Repository: {root}\nRemote: {remote}\n", encoding="utf-8")

    # Back up all files first; don't print file contents or secrets.
    for label, common, env_path, *_rest in prepared:
        sub = backup_dir / label
        sub.mkdir(parents=True, exist_ok=True)
        shutil.copy2(common, sub / "common.py.original")
        if env_path.is_file():
            shutil.copy2(env_path, sub / ".env.original")
        else:
            (sub / ".env-was-absent").write_text("This file did not exist before the diagnostic patch.\n", encoding="utf-8")

    changed_files: list[Path] = []
    try:
        for label, common, env_path, new_source, changed, new_env, env_changed, env_existed in prepared:
            if changed:
                common.write_text(new_source, encoding="utf-8", newline="")
                py_compile.compile(str(common), doraise=True)
                changed_files.append(common)
            if env_changed and new_env is not None:
                env_path.write_bytes(new_env)
                changed_files.append(env_path)
    except Exception as exc:
        for label, common, env_path, *_ in prepared:
            sub = backup_dir / label
            if (sub / "common.py.original").is_file():
                shutil.copy2(sub / "common.py.original", common)
            if (sub / ".env.original").is_file():
                shutil.copy2(sub / ".env.original", env_path)
            elif (sub / ".env-was-absent").is_file():
                env_path.unlink(missing_ok=True)
        fail(f"Patch failed; original files restored. Details: {exc}")

    print("Image2 local diagnostic patch applied.")
    print(f"Repository: {root}")
    print(f"Origin: {remote}")
    print(f"Backup: {backup_dir}")
    for label, common, env_path, _source, changed, _env, env_changed, _env_existed in prepared:
        print(f"- {label} worker: {common}")
        print(f"  classifier patched: {'yes' if changed else 'already patched'}")
        print(f"  debug flag set in .env: {'yes' if env_changed else 'already enabled'}")
    print("\nNEXT: stop the running worker with Ctrl+C, then restart it from the worker folder that serves Image2.")
    print("If starting the main worker, use: cd worker; python -m uvicorn main:app --port 8000")
    print("If starting the codex worker, use: cd .codex-worktrees\\codex\\worker; python -m uvicorn main:app --port 8000")
    print("Retry one Image2 generation and copy the new error beginning 'Image2 provider diagnostic'.")
    print("The diagnostic attempts to redact keys/tokens and signed URL query strings; review the output before sharing it.")
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
