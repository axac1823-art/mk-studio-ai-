"""Registre des providers.

Chaque module expose generate(model_id, input, timeout_ms) -> dict avec la
même forme de sortie : {"images": [{"url": ...}]} ou {"video": {"url": ...}}.

Formes d'URL acceptées en sortie (les WORKFLOWS les normalisent ensuite en
fichiers stockés via storage.py) :
- data URI (image ou petite vidéo) ;
- URL http(s) (CDN du provider) ;
- chemin "/storage/<nom>" (déjà sur disque côté worker).
"""
import os

from providers import bfl, elevenlabs, google, kling, magichour, openai, runway

PROVIDERS = {
    "bfl": bfl,
    "google": google,
    "kling": kling,
    "runway": runway,
    "openai": openai,
    "magichour": magichour,
    "elevenlabs": elevenlabs,
}

# Groupes alternatifs de variables d'env : un groupe complet suffit.
PROVIDER_ENV_KEYS = {
    "bfl": [["BFL_API_KEY"]],
    "google": [["GOOGLE_API_KEY"]],
    "kling": [["KLING_SECRET_KEY"]],
    "runway": [["RUNWAY_API_KEY"]],
    "openai": [["OPENAI_API_KEY"]],
    "magichour": [["MAGIC_HOUR_API_KEY"]],
    "elevenlabs": [["ELEVENLABS_API_KEY"]],
}


def is_provider_configured(name: str) -> bool:
    return any(all(os.environ.get(key) for key in group) for group in PROVIDER_ENV_KEYS[name])


def is_any_provider_configured() -> bool:
    """Au moins un provider configuré = une génération peut être tentée
    (sinon les routes répondent 503 immédiatement)."""
    return any(is_provider_configured(name) for name in PROVIDER_ENV_KEYS)
