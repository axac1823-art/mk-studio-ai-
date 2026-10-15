#!/usr/bin/env python3
"""Safely apply the Image2 native-frame patch to the local codex worktree.

This applies only these paths from origin/codex:
  web/components/studio/image2-workspace.tsx
  worker/catalog.py
  worker/frame_ratio.py
  worker/prompts.py
  worker/tests/test_frame_ratio.py
  worker/workflows/image_render.py

It does not pull, merge, rebase, switch branches, commit, or force-reset.
It builds a patch from a known upstream baseline, so local and remote histories
do not need to have a merge-base.
It creates a timestamped Desktop backup and rolls back if git-apply fails.
"""
from __future__ import annotations

import argparse
import os
import shutil
import subprocess
import sys
from datetime import datetime
from pathlib import Path

REPO_SLUG = "axac1823-art/mk-studio-ai-"
# Known upstream commit immediately before the Image2 native-frame fix.
# Use this anchor to build a file patch even when the local codex branch has
# unrelated Git history and therefore has no merge-base with origin/codex.
PATCH_BASE = "bad4e5557b601135b50b45869cc8d5387a9afc01"
PATCH_PATHS = [
    "web/components/studio/image2-workspace.tsx",
    "worker/catalog.py",
    "worker/frame_ratio.py",
    "worker/prompts.py",
    "worker/tests/test_frame_ratio.py",
    "worker/workflows/image_render.py",
]


class ApplyError(RuntimeError):
    pass


def run_git(repo: Path, *args: str, check: bool = True, binary: bool = False):
    command = ["git", "-C", str(repo), *args]
    result = subprocess.run(
        command,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=not binary,
        errors="replace" if not binary else None,
    )
    if check and result.returncode != 0:
        stderr = result.stderr.decode(errors="replace") if binary else result.stderr
        raise ApplyError(
            f"Git command failed ({result.returncode}): {' '.join(command)}\n{stderr.strip()}"
        )
    return result


def find_repo(start: Path) -> Path:
    result = subprocess.run(
        ["git", "-C", str(start), "rev-parse", "--show-toplevel"],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        errors="replace",
    )
    if result.returncode != 0 or not result.stdout.strip():
        raise ApplyError(f"المسار ليس داخل Git repository: {start}")
    return Path(result.stdout.strip()).resolve()


def is_expected_remote(repo: Path) -> str:
    remote = run_git(repo, "remote", "get-url", "origin").stdout.strip()
    normalized = remote.rstrip("/")
    if normalized.endswith(".git"):
        normalized = normalized[:-4]
    expected_https = "https://github.com/" + REPO_SLUG
    expected_ssh = "git@github.com:" + REPO_SLUG
    if normalized.lower() not in {expected_https.lower(), expected_ssh.lower()}:
        raise ApplyError(
            "رابط origin لا يطابق المستودع المتوقع. لم يتم تغيير الملفات.\n"
            f"origin: {remote}"
        )
    return remote


def file_backup(repo: Path, paths: list[str], backup_dir: Path) -> set[str]:
    existed: set[str] = set()
    for relative in paths:
        source = repo / relative
        if source.exists() and source.is_file():
            existed.add(relative)
            destination = backup_dir / "files" / relative
            destination.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(source, destination)
    (backup_dir / "existed-before.txt").write_text(
        "\n".join(sorted(existed)) + ("\n" if existed else ""),
        encoding="utf-8",
    )
    return existed


def rollback(repo: Path, paths: list[str], backup_dir: Path, existed: set[str]) -> None:
    # First clear only this patch's index entries; never reset the whole branch.
    run_git(repo, "reset", "--quiet", "HEAD", "--", *paths, check=False)
    for relative in paths:
        destination = repo / relative
        if relative in existed:
            saved = backup_dir / "files" / relative
            if saved.exists():
                destination.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(saved, destination)
        else:
            # It did not exist before this run; remove any partial newly-created file.
            if destination.exists() and destination.is_file():
                destination.unlink()
    # Remove empty directories left only by newly created patch files.
    for relative in reversed(paths):
        parent = (repo / relative).parent
        while parent != repo and parent.exists():
            try:
                parent.rmdir()
            except OSError:
                break
            parent = parent.parent


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--repo",
        default=".",
        help="Project folder, or any folder inside the project (default: current folder)",
    )
    args = parser.parse_args()

    try:
        project_root = find_repo(Path(args.repo).expanduser().resolve())
        remote = is_expected_remote(project_root)
        codex_repo = (project_root / ".codex-worktrees" / "codex").resolve()
        if not codex_repo.is_dir():
            raise ApplyError(f"لم يتم العثور على Worktree: {codex_repo}")
        branch = run_git(codex_repo, "branch", "--show-current").stdout.strip()
        if branch != "codex":
            raise ApplyError(f"Worktree الحالي ليس على فرع codex: {branch}")

        # Do not touch a worktree containing uncommitted changes.
        status = run_git(codex_repo, "status", "--porcelain").stdout
        if status.strip():
            raise ApplyError(
                "Worktree يحتوي على تعديلات محلية؛ لم يتم تغيير أي ملف.\n"
                + status.strip()
            )

        print(f"Repository: {project_root}")
        print(f"Remote: {remote}")
        print(f"Target worktree: {codex_repo}")
        print("جلب مرجع origin/codex (دون pull أو rebase)...")
        run_git(codex_repo, "fetch", "origin", "codex")

        # The local codex worktree may have been created from unrelated history.
        # Do not require merge-base with the remote branch. Build the patch from
        # the known upstream baseline that directly precedes our two fix commits.
        base_check = run_git(
            codex_repo, "cat-file", "-e", f"{PATCH_BASE}^{{commit}}", check=False
        )
        if base_check.returncode != 0:
            print("Commit المرجع غير موجود محليًا؛ أحاول جلبه من origin...")
            fetch_base = run_git(codex_repo, "fetch", "origin", PATCH_BASE, check=False)
            if fetch_base.returncode != 0:
                raise ApplyError(
                    "تعذر جلب commit المرجعي لإعداد patch. لم تُعدّل الملفات.\n"
                    + (fetch_base.stderr or "").strip()
                )
            base_check = run_git(
                codex_repo, "cat-file", "-e", f"{PATCH_BASE}^{{commit}}", check=False
            )
            if base_check.returncode != 0:
                raise ApplyError(
                    "لم يتم العثور على commit المرجعي بعد جلبه؛ لم تُعدّل الملفات."
                )

        base = PATCH_BASE
        name_result = run_git(
            codex_repo,
            "diff",
            "--name-only",
            f"{base}..origin/codex",
            "--",
            *PATCH_PATHS,
        )
        changed = [line.strip() for line in name_result.stdout.splitlines() if line.strip()]
        if not changed:
            raise ApplyError(
                "لم يُعثر على تغييرات Image2 المطلوبة في origin/codex. "
                "لم يتم تغيير الملفات."
            )

        patch_result = run_git(
            codex_repo,
            "diff",
            "--binary",
            "--full-index",
            f"{base}..origin/codex",
            "--",
            *PATCH_PATHS,
            binary=True,
        )
        patch_bytes = patch_result.stdout
        if not patch_bytes:
            raise ApplyError("التغييرات المطلوبة فارغة؛ لم يتم تغيير الملفات.")

        stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
        desktop = Path(os.environ.get("USERPROFILE", str(Path.home()))) / "Desktop"
        if not desktop.is_dir():
            desktop = Path.home()
        backup_dir = desktop / f"image2-native-frame-backup-{stamp}"
        backup_dir.mkdir(parents=True, exist_ok=False)
        (backup_dir / "image2-native-frame.patch").write_bytes(patch_bytes)
        existed = file_backup(codex_repo, PATCH_PATHS, backup_dir)
        (backup_dir / "metadata.txt").write_text(
            f"repository={project_root}\nworktree={codex_repo}\n"
            f"branch=codex\nbase={base}\nremote_ref=origin/codex\n"
            f"remote_head={run_git(codex_repo, 'rev-parse', 'origin/codex').stdout.strip()}\n"
            f"changed_paths:\n" + "\n".join(changed) + "\n",
            encoding="utf-8",
        )

        print("\nملفات الإصلاح التي سيتم تطبيقها:")
        for path in changed:
            print(f"  - {path}")
        print(f"\nنسخة احتياطية: {backup_dir}")
        print("تطبيق التغييرات على الملفات فقط، دون تغيير تاريخ الفروع...")

        patch_file = backup_dir / "image2-native-frame.patch"
        applied = run_git(
            codex_repo, "apply", "--3way", "--index", str(patch_file), check=False
        )
        if applied.returncode != 0:
            rollback(codex_repo, PATCH_PATHS, backup_dir, existed)
            detail = (applied.stderr or "").strip()
            raise ApplyError(
                "لم تُطبّق التغييرات بسبب تعارض مع كودك المحلي. "
                "أُعيدت الملفات المستهدفة إلى حالتها السابقة.\n"
                f"تفاصيل Git: {detail}\nنسخة احتياطية: {backup_dir}"
            )

        print("\nنجح تطبيق إصلاح Image2.")
        print("حالة الملفات:")
        result = run_git(codex_repo, "status", "--short", "--branch", check=False)
        print(result.stdout.strip() or "لا توجد تغييرات ظاهرة.")
        print(f"\nالنسخة الاحتياطية محفوظة في: {backup_dir}")
        print("الخطوة التالية للاختبار:")
        print(f'  Set-Location "{codex_repo}"')
        print("  python -m pytest worker/tests/test_frame_ratio.py")
        print("ملاحظة: التغييرات ستظهر staged في Git؛ لم يتم عمل commit أو push.")
        return 0

    except ApplyError as exc:
        print(f"\nلم يكتمل الإصلاح: {exc}", file=sys.stderr)
        return 1
    except KeyboardInterrupt:
        print("\nأوقف المستخدم التنفيذ.", file=sys.stderr)
        return 130


if __name__ == "__main__":
    raise SystemExit(main())
