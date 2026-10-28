"""Adaptateur Google Gemini — API officielle (port de google.ts).

Les modèles legacy utilisent generateContent ; Gemini Nano Banana 2.1 utilise
Interactions API. Les deux chemins acceptent du texte et des images de référence.

Schéma : POST /v1beta/models/{model}:generateContent (header
`x-goog-api-key`) ; le prompt + les images de référence partent en parts
inline_data ; la réponse rend des parts inlineData (base64), converties
ici en data URIs (les workflows les stockent ensuite sur disque).
Une image par requête : la quantité est servie par requêtes parallèles.

Env : GOOGLE_API_KEY (https://aistudio.google.com/apikey) — lue à l'appel,
jamais à l'import (échec vite -> fallback).
"""
from concurrent.futures import ThreadPoolExecutor

from providers.http_helpers import (
    ProviderError,
    parse_data_uri,
    post_json,
    require_env,
)

BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models"
INTERACTIONS_URL = "https://generativelanguage.googleapis.com/v1beta/interactions"


def _run_one(model_id: str, input_: dict) -> str:
    images = input_.get("images")
    if not isinstance(images, list):
        images = []

    parts = [{"text": str(input_.get("prompt") or "")}]
    for uri in images:
        parsed = parse_data_uri(uri)
        if not parsed:
            raise ProviderError("google: http image inputs are not supported, data URI expected")
        mime, data = parsed
        parts.append({"inline_data": {"mime_type": mime, "data": data}})

    generation_config: dict = {"responseModalities": ["IMAGE"]}
    # Gemini supports native imageConfig.aspectRatio for explicit frames. For AUTO,
    # omit the override and let the model choose its default framing.
    aspect_ratio = input_.get("aspectRatio")
    if aspect_ratio in {"1:1", "16:9", "9:16", "4:3", "3:4", "3:2", "2:3", "21:9"}:
        generation_config["imageConfig"] = {"aspectRatio": aspect_ratio}

    response = post_json(
        f"{BASE_URL}/{model_id}:generateContent",
        {"x-goog-api-key": require_env("GOOGLE_API_KEY")},
        {"contents": [{"parts": parts}], "generationConfig": generation_config},
    )
    for candidate in response.get("candidates") or []:
        for part in (candidate.get("content") or {}).get("parts") or []:
            inline = part.get("inlineData") or {}
            if inline.get("data"):
                return f"data:{inline.get('mimeType') or 'image/png'};base64,{inline['data']}"
    raise ProviderError("google: no image in generateContent response")


def _run_interaction_one(model_id: str, input_: dict) -> str:
    """Call Gemini's Interactions API for image generation and editing."""
    images = input_.get("images")
    if not isinstance(images, list):
        images = []

    parts = [
        {
            "type": "text",
            "text": str(input_.get("prompt") or ""),
        }
    ]
    # Image order matches the Image2 map: style, primary element, references.
    for uri in images:
        parsed = parse_data_uri(uri)
        if not parsed:
            raise ProviderError(
                "google: image inputs must be data URIs before calling Interactions API"
            )
        mime, data = parsed
        parts.append({"type": "image", "data": data, "mime_type": mime})

    # Interactions API currently accepts JPEG output only for image responses.
    response_format = {"type": "image", "mime_type": "image/jpeg"}
    aspect_ratio = input_.get("aspectRatio")
    supported_ratios = {
        "1:1",
        "16:9",
        "9:16",
        "4:3",
        "3:4",
        "3:2",
        "2:3",
        "21:9",
    }
    if aspect_ratio in supported_ratios:
        response_format["aspect_ratio"] = aspect_ratio
    image_size = input_.get("resolution")
    if image_size in {"1K", "2K", "4K"}:
        response_format["image_size"] = image_size

    response = post_json(
        INTERACTIONS_URL,
        {"x-goog-api-key": require_env("GOOGLE_API_KEY")},
        {
            "model": model_id,
            "input": parts,
            "response_format": response_format,
        },
        timeout_s=300,
    )

    output_image = response.get("output_image")
    if isinstance(output_image, dict) and output_image.get("data"):
        mime = output_image.get("mime_type") or "image/jpeg"
        return f"data:{mime};base64,{output_image['data']}"

    # Be tolerant of responses where the image is included in output items.
    outputs = response.get("output")
    if isinstance(outputs, list):
        for item in outputs:
            if isinstance(item, dict) and item.get("type") == "image" and item.get("data"):
                mime = item.get("mime_type") or "image/jpeg"
                return f"data:{mime};base64,{item['data']}"

    raise ProviderError("google: no image in Interactions API response")


def generate(model_id: str, input_: dict, timeout_ms: int) -> dict:
    """Contrat provider : {"images": [{"url": ...}]}. Appel synchrone (pas
    de polling) : timeout_ms est inutilisé, comme dans le port TS."""
    try:
        count = max(1, int(input_.get("quantity") or 1))
    except (TypeError, ValueError):
        count = 1
    images = input_.get("images")
    has_images = isinstance(images, list) and len(images) > 0
    if input_.get("require_images") and not has_images:
        raise ProviderError(
            "google: Image2 expected reference images, but no images were attached"
        )
    runner = (
        _run_interaction_one
        if model_id == "gemini-nano-banana-2.1"
        else _run_one
    )
    with ThreadPoolExecutor(max_workers=count) as pool:
        urls = list(pool.map(lambda _: runner(model_id, input_), range(count)))
    return {"images": [{"url": url} for url in urls]}
