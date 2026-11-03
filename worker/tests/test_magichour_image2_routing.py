"""Image2 routing tests for the Magic Hour API adapter."""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from providers import magichour


def test_image2_requests_with_reference_images_use_the_editor(monkeypatch):
    calls = {"editor": 0, "generator": 0}

    def editor(_model_id, _input, _timeout_ms):
        calls["editor"] += 1
        return "editor-output.png"

    def generator(_model_id, _input, _timeout_ms):
        calls["generator"] += 1
        return "generator-output.png"

    monkeypatch.setattr(magichour, "_run_image_edit", editor)
    monkeypatch.setattr(magichour, "_run_image_generator", generator)

    result = magichour.generate(
        "flux-2-klein",
        {"images": ["base.png", "element.png"], "is_text_to_image": True, "quantity": 1},
        1000,
    )

    assert calls == {"editor": 1, "generator": 0}
    assert result == {"images": [{"url": "editor-output.png"}]}


def test_image2_text_only_request_uses_the_generator(monkeypatch):
    calls = {"editor": 0, "generator": 0}

    def editor(_model_id, _input, _timeout_ms):
        calls["editor"] += 1
        return "editor-output.png"

    def generator(_model_id, _input, _timeout_ms):
        calls["generator"] += 1
        return "generator-output.png"

    monkeypatch.setattr(magichour, "_run_image_edit", editor)
    monkeypatch.setattr(magichour, "_run_image_generator", generator)

    result = magichour.generate(
        "flux-2-klein",
        {"images": [], "is_text_to_image": True, "quantity": 1},
        1000,
    )

    assert calls == {"editor": 0, "generator": 1}
    assert result == {"images": [{"url": "generator-output.png"}]}
