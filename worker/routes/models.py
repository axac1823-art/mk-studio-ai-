"""Exposition des modèles disponibles pour le sélecteur UI.

Chaque feature (image/vidéo/upscale/audio) renvoie la liste des candidats
ou capacités configurés, avec key/name/description — le client n'affiche
QUE ces champs ; model_id et API restent internes au worker.
"""
import os

from fastapi import APIRouter, HTTPException

from catalog import list_feature_models, text_to_image_candidates_for_tier
from providers import elevenlabs, hitpaw, magichour, upscale

router = APIRouter()


@router.get("/models")
def list_models() -> dict:
    """Retourne les modèles image, vidéo, upscale et audio disponibles côté worker.

    `costPerGeneration` (centimes USD réels provider) est inclus pour que le
    front puisse estimer le coût crédits d'un modèle choisi manuellement.
    """
    magic_hour_configured = bool(os.environ.get("MAGIC_HOUR_API_KEY"))
    magic_hour_tier = "free"
    if magic_hour_configured:
        try:
            magic_hour_tier = magichour.account_tier()
        except Exception:
            # Ne pas rendre tout le catalogue indisponible si l'API compte est
            # temporairement injoignable ; Magic Hour reste alors non vérifié.
            magic_hour_tier = "unknown"

    return {
        "image": list_feature_models("print_render", include_costs=True),
        "background_remover": list_feature_models("background_remover", include_costs=True),
        "video": (
            list_feature_models("animate", include_costs=True)
            + list_feature_models("video_to_video", include_costs=True)
            + list_feature_models("video_relight", include_costs=True)
        ),
        "upscale": upscale.list_models(),
        "video_upscale": [
            {"key": "runway_magnific", "name": "Magnific Video Upscaler", "provider": "Runway", "description": "Creative detail reconstruction with FPS boost.", "configured": bool(os.environ.get("RUNWAYML_API_SECRET") or os.environ.get("RUNWAY_API_KEY"))},
            {"key": "magichour", "name": "Magic Hour Video Upscaler", "provider": "Magic Hour", "description": "AI video upscaling with 720p, 1080p, 2K, or 4K output.", "configured": magic_hour_configured, "available": magic_hour_configured and magic_hour_tier in {"creator", "pro", "business"}, "availabilityMessage": "Requires a paid Magic Hour API plan." if magic_hour_tier == "free" else ("Could not verify Magic Hour plan access." if magic_hour_tier == "unknown" else None)},
            {"key": "hitpaw", "name": "HitPaw Video Enhancer", "provider": "HitPaw", "description": "General Restore AI enhancement up to 4K.", "configured": hitpaw.is_configured()},
        ],
        "audio": elevenlabs.list_voices() if elevenlabs.is_configured() else [],
        "threed": list_feature_models("3d_generator", include_costs=True),
    }


@router.get("/models/{feature}")
def list_feature(feature: str) -> list[dict]:
    """Liste les modèles/capacités d'une feature spécifique."""
    if feature not in {
        "print_render",
        "mood_swap",
        "exterior_to_interior",
        "plan_to_render",
        "multi_angle",
        "image_extender",
        "variations",
        "background_remover",
        "text_to_image",
        "animate",
        "video_to_video",
        "video_relight",
        "lip_sync",
        "upscale",
        "audio",
        "3d_generator",
    }:
        raise HTTPException(400, "unknown feature")
    if feature == "upscale":
        return upscale.list_models()
    if feature == "audio":
        return elevenlabs.list_voices() if elevenlabs.is_configured() else []
    if feature == "text_to_image":
        tier = "basic"
        if os.environ.get("MAGIC_HOUR_API_KEY"):
            try:
                tier = magichour.account_tier()
            except Exception:
                # En cas d'indisponibilité du compte, n'annoncer que le tier Basic sûr.
                tier = "basic"
        return list_feature_models(
            feature,
            include_costs=True,
            candidates=text_to_image_candidates_for_tier(tier),
        )
    return list_feature_models(feature, include_costs=True)
