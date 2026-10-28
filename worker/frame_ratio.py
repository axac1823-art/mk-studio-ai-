"""Native frame ratios supported by Image2 text-to-image models.

This module never changes image pixels. It selects only a model whose API can
accept the requested frame, then checks the delivered output dimensions.
"""
from __future__ import annotations

import logging

logger = logging.getLogger(__name__)

ALL_FRAMES = ("1:1", "16:9", "9:16", "4:3", "3:4", "3:2", "2:3", "21:9")

# BFL image APIs require width and height to be multiples of 32 (within provider limits).
BFL_DIMENSIONS: dict[str, tuple[int, int]] = {
    "1:1": (1024, 1024),
    "16:9": (1024, 576),
    "9:16": (576, 1024),
    "4:3": (1024, 768),
    "3:4": (768, 1024),
    "3:2": (1056, 704),
    "2:3": (704, 1056),
    "21:9": (1344, 576),
}

# GPT Image 1.5 uses these standard sizes; other fixed ratios must not be silently approximated.
GPT_IMAGE_1_SIZES: dict[str, str] = {
    "1:1": "1024x1024",
    "3:2": "1536x1024",
    "2:3": "1024x1536",
}


# Native output sizes verified against the providers' image-generation APIs.
# GPT Image 2.5 accepts arbitrary W×H sizes when each side is divisible by 16;
# sizes beyond 2560×1440 are experimental and the documented maximum is 3840×2160.
GPT_IMAGE_SIZES_BY_RESOLUTION: dict[str, dict[str, str]] = {
    "1K": {
        "auto": "auto", "1:1": "1024x1024", "16:9": "1536x864",
        "9:16": "864x1536", "4:3": "1200x896", "3:4": "896x1200",
        "3:2": "1264x848", "2:3": "848x1264", "21:9": "1584x672",
    },
    "2K": {
        "1:1": "2048x2048", "16:9": "2560x1440", "9:16": "1440x2560",
        "4:3": "2400x1792", "3:4": "1792x2400", "3:2": "2528x1696",
        "2:3": "1696x2528", "21:9": "2048x880",
    },
    "4K": {
        # Conservative 4K advertisement: only frames with a 3840px long edge.
        # Keep other ratios at 2K until provider A/B confirms a better native profile.
        "16:9": "3840x2160", "9:16": "2160x3840", "21:9": "3840x1648",
    },
}
GPT_IMAGE_RESOLUTION_RATIOS: dict[str, tuple[str, ...]] = {
    "auto": ("1K",),
    **{
        frame: tuple(resolution for resolution, sizes in GPT_IMAGE_SIZES_BY_RESOLUTION.items() if frame in sizes)
        for frame in ALL_FRAMES
    },
}
GEMINI_RESOLUTION_RATIOS: dict[str, tuple[str, ...]] = {
    "auto": ("1K", "2K", "4K"),
    **{frame: ("1K", "2K", "4K") for frame in ALL_FRAMES},
}


def gpt_image_size(ratio: str | None, resolution: str | None) -> str:
    """Resolve user ratio/resolution to a concrete documented OpenAI image size."""
    frame = ratio or "auto"
    tier = resolution or "1K"
    try:
        return GPT_IMAGE_SIZES_BY_RESOLUTION[tier][frame]
    except KeyError:
        supported = tuple(
            res for res, sizes in GPT_IMAGE_SIZES_BY_RESOLUTION.items() if frame in sizes
        )
        raise ValueError(
            f"GPT Image 2.5 Sunburst does not support {tier} for {frame}. "
            f"Supported resolutions for this frame: {', '.join(supported) or 'none'}."
        ) from None


def filter_by_resolution(
    candidates: list,
    requested_frame: str | None,
    requested_resolution: str | None,
    selected_model: str | None,
) -> list:
    """Filter candidates by the exact frame/resolution combination they advertise."""
    frame = requested_frame or "auto"
    resolution = requested_resolution or "1K"

    def supports(candidate) -> bool:
        matrix = dict(getattr(candidate, "resolution_ratios", ()) or ())
        if matrix:
            return resolution in matrix.get(frame, ())
        return resolution in getattr(candidate, "resolutions", ("1K",))

    if selected_model and selected_model != "auto":
        selected = next((item for item in candidates if item.key == selected_model), None)
        if selected is None:
            raise ValueError("The selected model is not compatible with the current Image2 inputs.")
        if not supports(selected):
            matrix = dict(getattr(selected, "resolution_ratios", ()) or ())
            available = matrix.get(frame, ()) if matrix else getattr(selected, "resolutions", ("1K",))
            raise ValueError(
                f"{selected.name} does not support {resolution} output for {frame}. "
                f"Supported resolutions: {', '.join(available) or 'none'}."
            )
        return [selected]

    capable = [candidate for candidate in candidates if supports(candidate)]
    if not capable:
        available = sorted({
            value
            for candidate in candidates
            for value in (
                dict(getattr(candidate, "resolution_ratios", ()) or ()).get(frame, ())
                if getattr(candidate, "resolution_ratios", ())
                else getattr(candidate, "resolutions", ("1K",))
            )
        })
        raise ValueError(
            f"No configured model supports {resolution} for {frame}. "
            f"Available resolutions: {', '.join(available) or 'none'}."
        )
    return capable


def check_delivered_resolution(width: int, height: int, requested: str | None) -> bool:
    """Reject obvious silent resolution downgrades without resizing/cropping output."""
    minimum_edge = {"640px": 600, "1K": 900, "2K": 2000, "4K": 3600}.get(requested or "1K")
    if minimum_edge is None:
        return True
    actual_edge = max(width, height)
    ok = actual_edge >= minimum_edge
    if not ok:
        logger.warning(
            "Image2 resolution mismatch: requested %s, provider returned %dx%d",
            requested, width, height,
        )
    return ok

# Magic Hour Flux 2 Klein native frame options documented for generation.
MAGICHOUR_FRAMES = ("1:1", "16:9", "9:16")

_RATIO_VALUES = {
    ratio: int(ratio.split(":")[0]) / int(ratio.split(":")[1])
    for ratio in ALL_FRAMES
}
_FRAME_ORDER = ("auto", *ALL_FRAMES)


def exact_size(sizes: dict[str, str], ratio: str) -> str:
    """Return only a size explicitly supported for this ratio."""
    try:
        return sizes[ratio]
    except KeyError:
        raise ValueError(f"This model cannot generate a {ratio} frame natively.") from None


def filter_by_frame(candidates: list, requested: str | None, selected_model: str | None) -> list:
    """Keep models that explicitly declare support for the requested frame."""
    frame = requested or "auto"

    if selected_model and selected_model != "auto":
        selected = next((item for item in candidates if item.key == selected_model), None)
        if selected is None:
            raise ValueError(
                "The selected model is not compatible with the chosen image inputs. "
                "Choose another model or adjust the references."
            )
        if frame not in selected.frame_ratios:
            supported = ", ".join(selected.frame_ratios) or "none declared"
            raise ValueError(
                f"{selected.name} cannot generate a {frame} frame natively. "
                f"Supported frames: {supported}."
            )
        return [selected]

    capable = [item for item in candidates if frame in item.frame_ratios]
    if not capable:
        available = {ratio for item in candidates for ratio in item.frame_ratios}
        ordered = [ratio for ratio in _FRAME_ORDER if ratio in available]
        raise ValueError(
            f"No compatible configured model can generate a {frame} frame natively. "
            f"Available frames: {', '.join(ordered) or 'none'}."
        )
    return capable


def check_delivered_ratio(width: int, height: int, requested: str | None) -> bool:
    """Validate output dimensions without modifying them.

    Some providers document dimension grids that approximate the requested
    ratio by a few percent (for example Magic Hour's 640x384 for 16:9 is ~6.25%).
    A 7% tolerance accepts those supported outputs but rejects materially
    different frames (for example 3:2 returned for 16:9 is ~15.6%).
    """
    target = _RATIO_VALUES.get(requested or "")
    if target is None:
        return True

    actual = width / height
    matches = abs(actual - target) / target <= 0.07
    if not matches:
        logger.warning(
            "Image2 frame mismatch: requested %s, provider returned %dx%d (ratio %.4f)",
            requested,
            width,
            height,
            actual,
        )
    return matches
