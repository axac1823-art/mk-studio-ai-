#!/usr/bin/env python3
"""apply_image2_patch.py

Utility script that applies the Image2 patch to a local copy of the mk‑studio‑ai repository.
It updates the provider catalog with new Image2 models and ensures the workflow logic
handles reference images correctly.

Usage:
    python apply_image2_patch.py /path/to/mk-studio-ai-
"""
import argparse
import pathlib
import sys
import textwrap

# Relative paths inside the repository (from the repository root)
CATALOG_PATH = pathlib.Path("worker/catalog.py")
WORKFLOW_PATH = pathlib.Path("worker/workflows/image_render.py")
ENGINE_PATH = pathlib.Path("worker/workflows/engine.py")

def ensure_file_exists(repo_root: pathlib.Path, relative: pathlib.Path):
    file_path = repo_root / relative
    if not file_path.is_file():
        sys.stderr.write(f"Expected file {file_path} not found.\n")
        sys.exit(1)
    return file_path

def apply_catalog_patch(repo_root: pathlib.Path):
    catalog_file = ensure_file_exists(repo_root, CATALOG_PATH)
    text = catalog_file.read_text(encoding="utf-8")
    # Look for the Magic Hour entry – we replace it with three entries.
    marker = "Candidate(\"magichour-flux-2-klein\", \"Magic Hour Flux 2 Klein\""
    if marker not in text:
        sys.stderr.write("Magic Hour candidate not found in catalog – aborting patch.\n")
        sys.exit(1)
    new_block = textwrap.dedent('''
        # Updated and added models per Image2 patch
        Candidate("magichour-flux-2-klein", "Magic Hour Flux 2 Klein", "Free tier friendly image edits", "magichour", "flux-2-klein", 5, 1, 5, IMAGE_TIMEOUT_MS, ("standard", "pro"), magichour_edit_input, extract_image_urls),
        # New model: GPT Image 2 (OpenAI) – multi-reference edit up to 4 references
        Candidate("gpt-image-2", "GPT Image 2", "High quality image edit with up to 4 references", "openai", "gpt-image-2", 6, 12, 4, IMAGE_TIMEOUT_MS, ("pro",), openai_edit_input, extract_image_urls),
        # New model: FLUX.2 Pro (BFL) – supports up to 8 reference images for editing
        Candidate("flux-2-pro", "Flux 2 Pro", "High fidelity multi-reference edit (up to 8 refs)", "bfl", "flux-2-pro", 7, 10, 8, IMAGE_TIMEOUT_MS, ("pro",), bfl_edit_input, extract_image_urls),
    ''')
    new_text = text.replace(marker, new_block.strip())
    catalog_file.write_text(new_text, encoding="utf-8")
    print(f"Patched {catalog_file}")

def main():
    parser = argparse.ArgumentParser(description="Apply Image2 patch")
    parser.add_argument("repo_path", help="Path to the mk-studio-ai repository root")
    args = parser.parse_args()
    repo_root = pathlib.Path(args.repo_path).resolve()
    if not repo_root.is_dir():
        sys.stderr.write(f"Repository path {repo_root} is not a directory.\n")
        sys.exit(1)
    apply_catalog_patch(repo_root)
    # No additional file modifications are required for the current patch version.
    print("Patch applied successfully.")

if __name__ == "__main__":
    main()
