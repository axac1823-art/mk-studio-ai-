"""Ensure description tags stay connected to the exact attached visual inputs."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from prompts import add_image_reference_map
from workflows.video import _reference_map


def test_image_description_tags_map_to_reference_order():
    prompt = add_image_reference_map(
        "Use @img2 for the facade material and @img1 for the garden style.",
        {
            "feature": "print_render",
            "referenceUrls": ["image-one", "image-two"],
            "referenceTags": ["@img1", "@img2"],
        },
    )

    assert "Use @img2 for the facade material" in prompt
    assert "@img1 is supplemental reference image 1" in prompt
    assert "@img2 is supplemental reference image 2" in prompt


def test_image_generator_source_is_separate_from_tagged_references():
    prompt = add_image_reference_map(
        "Use @img1 for the style.",
        {
            "feature": "text_to_image",
            "imageUrl": "source-image",
            "referenceUrls": ["visual-ref"],
            "referenceTags": ["@img1"],
        },
    )

    assert "optional source image is the untagged base input" in prompt
    assert "@img1 is supplemental reference image 1" in prompt


def test_video_tags_are_preserved_and_explained_for_provider_prompt():
    prompt = "Move the building style from @img2 and use motion from @vid1."
    references = [
        {"tag": "@img2", "type": "image", "asset_url": "image-two"},
        {"tag": "@vid1", "type": "video", "asset_url": "video-one"},
    ]

    mapped = _reference_map(prompt, references)

    assert "@img2" in prompt
    assert "@img2 is the attached image" in mapped
    assert "@vid1 is the attached video" in mapped
