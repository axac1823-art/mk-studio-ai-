"""Client ElevenLabs pour TTS mono-voix et Text-to-Dialogue.

Le worker reste l'unique détenteur de la clé API. Les réponses audio sont
normalisées en octets et métadonnées pour que les workflows ne connaissent
ni le protocole HTTP ni le format de transport du fournisseur.
"""
from __future__ import annotations

import os
import random
import re
import threading
import time
from typing import Any

import httpx

from providers.http_helpers import ProviderError, require_env

_BASE = "https://api.elevenlabs.io/v1"
DEFAULT_MODEL = "eleven_multilingual_v2"
DIALOGUE_MODEL = "eleven_v3"
DEFAULT_VOICE = "CwhRBWXzGAHq8TQ4Fs17"
ALLOWED_VOICE_MODELS = {DEFAULT_MODEL, "eleven_flash_v2_5", "eleven_turbo_v2_5", "eleven_v3"}
MAX_SINGLE_TEXT_LENGTH = 5000
MAX_DIALOGUE_CHARACTERS = 2000
MAX_DIALOGUE_TURNS = 50
MAX_UNIQUE_DIALOGUE_VOICES = 10
MAX_EMOTION_LENGTH = 80
VOICE_CACHE_TTL_SECONDS = 300
MAX_PROVIDER_ATTEMPTS = 3

COST_PER_GENERATION_CENTS = 2

_AUDIO_EXTENSIONS = {
    "audio/mpeg": "mp3",
    "audio/mp3": "mp3",
    "audio/wav": "wav",
    "audio/wave": "wav",
    "audio/x-wav": "wav",
    "audio/ogg": "ogg",
    "audio/webm": "webm",
    "audio/mp4": "mp4",
}
_VOICE_ID_RE = re.compile(r"^[A-Za-z0-9_-]{1,128}$")
_LANGUAGE_CODE_RE = re.compile(r"^[a-zA-Z]{2}$")

# Client partagé : réutilise le pool HTTP entre générations dans le processus worker.
_CLIENT = httpx.Client(timeout=httpx.Timeout(120.0), follow_redirects=True)
_VOICE_CACHE_LOCK = threading.Lock()
_VOICE_CACHE: tuple[float, list[dict[str, str]]] | None = None


def is_configured() -> bool:
    return bool(os.environ.get("ELEVENLABS_API_KEY"))


def _headers() -> dict[str, str]:
    return {"xi-api-key": require_env("ELEVENLABS_API_KEY")}


def _provider_error(response: httpx.Response, operation: str) -> ProviderError:
    return ProviderError(
        f"elevenlabs {operation} failed ({response.status_code}): {response.text[:300]}",
        response.status_code,
    )


def _post_audio(
    url: str,
    payload: dict[str, Any],
    operation: str,
    timeout_s: int = 120,
) -> dict[str, Any]:
    """POST audio; retry only explicit transient responses/connect failures.

    Read timeouts are not retried: ElevenLabs may have completed and billed a
    request before the response was lost, so retrying could duplicate charges.
    """
    last_error: Exception | None = None
    for attempt in range(MAX_PROVIDER_ATTEMPTS):
        try:
            response = _CLIENT.post(
                url,
                headers={**_headers(), "Content-Type": "application/json"},
                json=payload,
                timeout=timeout_s,
            )
        except (httpx.ConnectError, httpx.ConnectTimeout) as err:
            last_error = err
            if attempt + 1 == MAX_PROVIDER_ATTEMPTS:
                break
            time.sleep(min(2**attempt + random.random(), 4))
            continue
        except httpx.TimeoutException as err:
            raise ProviderError(f"elevenlabs {operation} timed out; request was not retried") from err
        except httpx.RequestError as err:
            raise ProviderError(f"elevenlabs {operation} connection failed; request was not retried") from err

        if response.status_code < 400:
            if not response.content:
                raise ProviderError(f"elevenlabs {operation}: empty response")
            return _normalize_audio_response(response, operation)

        if response.status_code not in (429, 502, 503, 504) or attempt + 1 == MAX_PROVIDER_ATTEMPTS:
            raise _provider_error(response, operation)

        retry_after = response.headers.get("Retry-After")
        try:
            delay = min(max(float(retry_after or 0), 0), 5)
        except ValueError:
            delay = 0
        if delay == 0:
            delay = min(2**attempt + random.random(), 4)
        time.sleep(delay)

    raise ProviderError(f"elevenlabs {operation} connection failed after retries") from last_error


def _normalize_audio_response(response: httpx.Response, model: str) -> dict[str, Any]:
    mime_type = response.headers.get("content-type", "audio/mpeg").split(";", 1)[0].strip().lower()
    extension = _AUDIO_EXTENSIONS.get(mime_type)
    if extension is None:
        raise ProviderError(f"elevenlabs returned unsupported audio content type: {mime_type}")
    return {
        "audio_bytes": response.content,
        "mime_type": mime_type,
        "extension": extension,
        "model": model,
        "provider_request_id": response.headers.get("request-id") or response.headers.get("xi-request-id"),
    }


def list_voices(force_refresh: bool = False) -> list[dict[str, str]]:
    """Return the account voice catalog, cached briefly for UI and validation."""
    global _VOICE_CACHE
    now = time.monotonic()
    with _VOICE_CACHE_LOCK:
        if not force_refresh and _VOICE_CACHE and now - _VOICE_CACHE[0] < VOICE_CACHE_TTL_SECONDS:
            return [dict(voice) for voice in _VOICE_CACHE[1]]

    try:
        response = _CLIENT.get(f"{_BASE}/voices", headers=_headers(), timeout=30)
    except httpx.RequestError as err:
        raise ProviderError(f"elevenlabs voices connection failed: {err}") from err
    if response.status_code >= 400:
        raise _provider_error(response, "voices")

    data = response.json()
    voices = [
        {
            "key": voice["voice_id"],
            "name": voice.get("name", "Unknown"),
            "description": voice.get("description")
            or f"{voice.get('labels', {}).get('accent', '')} {voice.get('labels', {}).get('gender', '')}".strip(),
        }
        for voice in (data.get("voices") or [])
        if isinstance(voice, dict) and isinstance(voice.get("voice_id"), str)
    ]
    with _VOICE_CACHE_LOCK:
        _VOICE_CACHE = (time.monotonic(), voices)
    return [dict(voice) for voice in voices]


def validate_voice_ids(voice_ids: set[str]) -> None:
    """Reject voice IDs outside the configured ElevenLabs account catalog."""
    if not voice_ids:
        return
    available = {voice["key"] for voice in list_voices()}
    missing = voice_ids - available
    if missing:
        raise ProviderError("elevenlabs: one or more voice IDs are unavailable")


def _validate_voice_id(voice_id: Any) -> str:
    if not isinstance(voice_id, str) or not _VOICE_ID_RE.fullmatch(voice_id):
        raise ProviderError("elevenlabs: invalid voice ID")
    return voice_id


def normalize_dialogue_inputs(inputs: Any) -> list[dict[str, str]]:
    """Validate structured turns and apply optional natural-language tags.

    Speaker boundaries are supplied by the frontend; this function never
    parses or infers speakers from text.
    """
    if not isinstance(inputs, list) or not 2 <= len(inputs) <= MAX_DIALOGUE_TURNS:
        raise ProviderError(f"elevenlabs: dialogue must contain 2 to {MAX_DIALOGUE_TURNS} turns")

    normalized: list[dict[str, str]] = []
    total_characters = 0
    unique_voices: set[str] = set()
    for item in inputs:
        if not isinstance(item, dict):
            raise ProviderError("elevenlabs: invalid dialogue turn")
        text = item.get("text")
        if not isinstance(text, str) or not text.strip():
            raise ProviderError("elevenlabs: dialogue turns require text")
        voice_id = _validate_voice_id(item.get("voiceId") or item.get("voice_id"))
        emotion = item.get("emotion")
        if emotion is not None:
            if not isinstance(emotion, str) or len(emotion) > MAX_EMOTION_LENGTH:
                raise ProviderError("elevenlabs: invalid dialogue emotion")
            emotion = emotion.strip()
            if any(char in emotion for char in "[]\r\n"):
                raise ProviderError("elevenlabs: emotion must be plain text without brackets")
        rendered_text = f"[{emotion}] {text.strip()}" if emotion else text.strip()
        total_characters += len(rendered_text)
        unique_voices.add(voice_id)
        normalized.append({"text": rendered_text, "voice_id": voice_id})

    if total_characters > MAX_DIALOGUE_CHARACTERS:
        raise ProviderError(f"elevenlabs: dialogue exceeds {MAX_DIALOGUE_CHARACTERS} characters")
    if len(unique_voices) > MAX_UNIQUE_DIALOGUE_VOICES:
        raise ProviderError(f"elevenlabs: dialogue supports at most {MAX_UNIQUE_DIALOGUE_VOICES} distinct voices")
    return normalized


def validate_single_input(input_: dict[str, Any]) -> tuple[str, str, str]:
    text = input_.get("text")
    if not isinstance(text, str) or not text.strip() or len(text.strip()) > MAX_SINGLE_TEXT_LENGTH:
        raise ProviderError(f"elevenlabs: text must contain 1 to {MAX_SINGLE_TEXT_LENGTH} characters")
    voice_id = input_.get("voiceId") or input_.get("voice_id") or DEFAULT_VOICE
    voice_id = _validate_voice_id(voice_id)
    model = input_.get("model") or input_.get("model_id") or DEFAULT_MODEL
    if model not in ALLOWED_VOICE_MODELS:
        raise ProviderError("elevenlabs: unsupported voice model")
    return text.strip(), voice_id, model


def generate(input_: dict[str, Any], timeout_s: int = 120) -> dict[str, Any]:
    """Generate one narration turn using an allowlisted TTS model."""
    text, voice_id, model = validate_single_input(input_)

    response_data = _post_audio(
        f"{_BASE}/text-to-speech/{voice_id}",
        {"text": text.strip(), "model_id": model},
        "text-to-speech",
        timeout_s,
    )
    return response_data


def generate_dialogue(input_: dict[str, Any]) -> dict[str, Any]:
    """Generate dialogue from frontend-provided turns through the official API."""
    inputs = normalize_dialogue_inputs(input_.get("inputs"))
    payload: dict[str, Any] = {"inputs": inputs, "model_id": DIALOGUE_MODEL}

    language_code = input_.get("languageCode") or input_.get("language_code")
    if language_code:
        if not isinstance(language_code, str) or not _LANGUAGE_CODE_RE.fullmatch(language_code):
            raise ProviderError("elevenlabs: language code must be a two-letter ISO code")
        payload["language_code"] = language_code.lower()

    seed = input_.get("seed")
    if seed is not None:
        if isinstance(seed, bool) or not isinstance(seed, int) or not 0 <= seed <= 4_294_967_295:
            raise ProviderError("elevenlabs: seed must be between 0 and 4294967295")
        payload["seed"] = seed

    return _post_audio(f"{_BASE}/text-to-dialogue", payload, "text-to-dialogue")
