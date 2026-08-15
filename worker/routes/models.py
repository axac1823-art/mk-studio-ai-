"""Exposition des modèles disponibles pour le sélecteur UI.

Chaque feature (image/vidéo/upscale/audio) renvoie la liste des candidats
ou capacités configurés, avec key/name/description — le client n'affiche
QUE ces champs ; model_id et API restent internes au worker.
"""
from fastapi import APIRouter, HTTPException

from catalog import list_feature_models
from providers import elevenlabs, upscale

router = APIRouter()


@router.get("/models")
def list_models() -> dict:
    """Retourne les modèles image, vidéo, upscale et audio disponibles côté worker.

    `costPerGeneration` (centimes USD réels provider) est inclus pour que le
    front puisse estimer le coût crédits d'un modèle choisi manuellement.
    """
    return {
        "image": list_feature_models("print_render", include_costs=True),
        "video": (
            list_feature_models("animate", include_costs=True)
            + list_feature_models("video_to_video", include_costs=True)
            + list_feature_models("video_relight", include_costs=True)
        ),
        "upscale": upscale.list_models(),
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
    return list_feature_models(feature, include_costs=True)
