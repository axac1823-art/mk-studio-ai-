"""Adaptateur Google Gemini — API officielle (port de google.ts).

Modèles servis : gemini-2.5-flash-image ("Nano Banana"),
gemini-3-pro-image ("Nano Banana Pro") — génération image à partir de
 texte seul et/ou d'images de référence.

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

    response = post_json(
        f"{BASE_URL}/{model_id}:generateContent",
        {"x-goog-api-key": require_env("GOOGLE_API_KEY")},
        {"contents": [{"parts": parts}], "generationConfig": {"responseModalities": ["IMAGE"]}},
    )
    for candidate in response.get("candidates") or []:
        for part in (candidate.get("content") or {}).get("parts") or []:
            inline = part.get("inlineData") or {}
            if inline.get("data"):
                return f"data:{inline.get('mimeType') or 'image/png'};base64,{inline['data']}"
    raise ProviderError("google: no image in generateContent response")


def generate(model_id: str, input_: dict, timeout_ms: int) -> dict:
    """Contrat provider : {"images": [{"url": ...}]}. Appel synchrone (pas
    de polling) : timeout_ms est inutilisé, comme dans le port TS."""
    try:
        count = max(1, int(input_.get("quantity") or 1))
    except (TypeError, ValueError):
        count = 1
    with ThreadPoolExecutor(max_workers=count) as pool:
        urls = list(pool.map(lambda _: _run_one(model_id, input_), range(count)))
    return {"images": [{"url": url} for url in urls]}
