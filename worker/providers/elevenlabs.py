"""Provider ElevenLabs — génération de voix (TTS) via l'API officielle.

Interface : generate(input) -> {"audio": {"url": "data:audio/mpeg;base64,..."}}
input attend : { text: str, voice_id?: str, model_id?: str }

Le worker stocke ensuite le data URI comme n'importe quelle sortie provider
(voir workflows/common.py).
"""
import base64
import os

import httpx

from providers.http_helpers import ProviderError, require_env

_BASE = "https://api.elevenlabs.io/v1"
DEFAULT_MODEL = "eleven_multilingual_v2"
DEFAULT_VOICE = "CwhRBWXzGAHq8TQ4Fs17"  # Roger — voix premade actuelle (vérifier via /v1/voices si la clé change)

# Coût réel provider moyen par génération TTS (centimes USD). ElevenLabs
# facture au caractère ; cette valeur est une estimation conservative pour
# un script de narration courte (≈ 1 500 caractères). Utilisé pour le calcul
# de marge et la cohérence avec `provider_cost_cents` des jobs image/vidéo.
COST_PER_GENERATION_CENTS = 2


def is_configured() -> bool:
    return bool(os.environ.get("ELEVENLABS_API_KEY"))


def _api_key() -> str:
    return require_env("ELEVENLABS_API_KEY")


def _headers() -> dict:
    return {"xi-api-key": _api_key()}


def list_voices() -> list[dict]:
    """Liste les voix disponibles (name/description) pour le sélecteur UI."""
    try:
        response = httpx.get(f"{_BASE}/voices", headers=_headers(), timeout=30)
    except Exception as err:
        raise ProviderError(f"elevenlabs voices: {err}") from err
    if response.status_code >= 400:
        raise ProviderError(f"elevenlabs voices failed ({response.status_code}): {response.text[:300]}")
    data = response.json()
    voices = data.get("voices") or []
    return [
        {
            "key": v.get("voice_id"),
            "name": v.get("name", "Unknown"),
            "description": v.get("description") or f"{v.get('labels', {}).get('accent', '')} {v.get('labels', {}).get('gender', '')}".strip(),
        }
        for v in voices
        if v.get("voice_id")
    ]


def generate(input_: dict, timeout_s: int = 120) -> dict:
    """Génère un audio MP3 à partir du texte. Retourne un data URI audio/mpeg."""
    text = input_.get("text")
    if not isinstance(text, str) or not text.strip():
        raise ProviderError("elevenlabs: missing text")

    voice_id = input_.get("voice_id") or DEFAULT_VOICE
    model_id = input_.get("model_id") or DEFAULT_MODEL

    response = httpx.post(
        f"{_BASE}/text-to-speech/{voice_id}",
        headers={**_headers(), "Content-Type": "application/json"},
        json={"text": text.strip(), "model_id": model_id},
        timeout=timeout_s,
    )
    if response.status_code >= 400:
        raise ProviderError(f"elevenlabs tts failed ({response.status_code}): {response.text[:300]}")

    data = response.content
    if not data:
        raise ProviderError("elevenlabs tts: empty response")

    b64 = base64.b64encode(data).decode()
    return {"audio": {"url": f"data:audio/mpeg;base64,{b64}"}}
