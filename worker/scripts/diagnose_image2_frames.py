#!/usr/bin/env python3
"""Diagnostic: why does Image2 fail (or silently degrade) for non-default frames?

Read-only script. It reuses the real catalog adapters and the real
`frame_ratio.validate_image_output_frame` so the numbers below are exactly
what the worker does at generation time — no provider call is made.

Run from the repository root:
    python worker/scripts/diagnose_image2_frames.py
"""
from __future__ import annotations

import io
import sys
from pathlib import Path

WORKER_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(WORKER_DIR))

import catalog  # noqa: E402
from frame_ratio import FRAME_RATIOS, validate_image_output_frame  # noqa: E402

FRAMES = ("1:1", "16:9", "9:16", "4:3", "3:4", "3:2", "2:3", "21:9")

# Documented gpt-image-2 custom-size rules (OpenAI Images API reference):
# both edges divisible by 16, 1:3 <= ratio <= 3:1, 655,360 <= w*h <= 8,294,400.
GPT_MIN_PIXELS = 655_360
GPT_MAX_PIXELS = 8_294_400
GPT_MAX_EDGE = 3840


def gpt_size_errors(size: str) -> list[str]:
    try:
        width, height = (int(part) for part in size.lower().split("x"))
    except Exception:
        return ["size is not WIDTHxHEIGHT"]
    problems: list[str] = []
    if width % 16 or height % 16:
        problems.append("edge not divisible by 16")
    if max(width, height) > GPT_MAX_EDGE:
        problems.append("edge above 3840")
    if max(width, height) / min(width, height) > 3:
        problems.append("aspect ratio beyond 3:1")
    if not GPT_MIN_PIXELS <= width * height <= GPT_MAX_PIXELS:
        problems.append(f"pixel count {width * height:,} outside {GPT_MIN_PIXELS:,}-{GPT_MAX_PIXELS:,}")
    return problems


def bfl_size_errors(width: int, height: int) -> list[str]:
    # FLUX.1 Pro 1.1 / Dev: 256 <= edge <= 1440 and both edges multiples of 32.
    problems: list[str] = []
    if width % 32 or height % 32:
        problems.append("edge not divisible by 32")
    if not (256 <= width <= 1440 and 256 <= height <= 1440):
        problems.append("edge outside 256-1440")
    return problems


def frame_tolerance_report() -> None:
    """Show which real provider output grids survive the 2.5% output check."""
    from PIL import Image

    grids = {
        "FLUX (exact) 16:9": ("16:9", (1024, 576)),
        "Gemini 1K 21:9": ("21:9", (1584, 672)),
        "Gemini 2.5 21:9": ("21:9", (1536, 672)),
        "Magic Hour 16:9": ("16:9", (640, 384)),
        "Magic Hour 9:16": ("9:16", (384, 640)),
        "Gemini 4:3": ("4:3", (1024, 768)),
    }
    print("\n== output-frame validator (tolerance 8%) ==")
    for label, (frame, size) in grids.items():
        buffer = io.BytesIO()
        Image.new("RGB", size, (20, 20, 20)).save(buffer, format="PNG")
        uri = "data:image/png;base64," + __import__("base64").b64encode(buffer.getvalue()).decode()
        deviation = abs((size[0] / size[1]) / FRAME_RATIOS[frame] - 1.0)
        try:
            validate_image_output_frame([uri], frame)
            verdict = "ACCEPTED"
        except ValueError as err:
            verdict = f"REJECTED -> {err}"
        print(f"  {label:<18} {size[0]}x{size[1]} requested {frame:<5} off by {deviation:6.2%}  {verdict}")


def main() -> None:
    print("== per-model frame claims in the catalog ==")
    for candidate in catalog.TEXT_TO_IMAGE_CANDIDATES:
        print(f"  {candidate.key:<32} {candidate.provider:<10} frames: {', '.join(candidate.frame_ratios) or '-'}")

    print("\n== what each adapter sends per requested frame ==")
    for frame in FRAMES:
        req = {"prompt": "x", "aspectRatio": frame, "quality": "standard", "quantity": 1}
        openai_size = catalog.openai_text_to_image_input(req)["size"]
        bfl_payload = catalog.bfl_text_to_image_input(req)
        google_payload = catalog.google_text_to_image_input(req)
        gpt_problems = gpt_size_errors(openai_size)
        bfl_problems = bfl_size_errors(bfl_payload["width"], bfl_payload["height"])
        print(f"  {frame:<5}")
        print(f"    GPT Image 2 : {openai_size:<10} {'OK' if not gpt_problems else 'REJECTED by API: ' + ', '.join(gpt_problems)}")
        print(f"    FLUX        : {bfl_payload['width']}x{bfl_payload['height']:<8} {'OK' if not bfl_problems else 'REJECTED by API: ' + ', '.join(bfl_problems)}")
        print(f"    Gemini      : imageConfig.aspectRatio={google_payload.get('aspectRatio')!r} {'OK (documented)' if google_payload.get('aspectRatio') in FRAMES else 'NOT SENT -> provider default frame'}")
        try:
            catalog.magichour_text_to_image_input(req)
            magic = "OK (1:1 / 16:9 / 9:16 only)"
        except ValueError as err:
            magic = f"REJECTED: {err}"
        print(f"    Magic Hour  : {magic}")

    frame_tolerance_report()

    print("\n== candidates left after frame filtering (no provider keys needed) ==")
    from frame_ratio import filter_candidates_by_frame

    for frame in FRAMES:
        keys = [c.key for c in filter_candidates_by_frame(catalog.TEXT_TO_IMAGE_CANDIDATES, frame)]
        print(f"  {frame:<5} -> {', '.join(keys)}")


if __name__ == "__main__":
    main()
