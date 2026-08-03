"""Exposition des modèles disponibles pour le sélecteur UI.

Chaque feature (image/vidéo/upscale) renvoie la liste des candidats dont le
provider est configuré, avec key/name/description — le client n'affiche
QUE ces champs ; model_id et API restent internes au worker.
"""
from fastapi import APIRouter, HTTPException

from catalog import list_feature_models
from providers import upscale

router = APIRouter()


@router.get("/models")
def list_models() -> dict:
    """Retourne les modèles image, vidéo et upscale disponibles côté worker."""
    return {
        "image": list_feature_models("print_render"),
        "video": list_feature_models("animate"),
        "upscale": upscale.list_models(),
    }


@router.get("/models/{feature}")
def list_feature(feature: str) -> list[dict]:
    """Liste les modèles d'une feature spécifique (feature -> candidats)."""
    if feature not in {"print_render", "mood_swap", "exterior_to_interior", "plan_to_render", "multi_angle", "animate", "upscale"}:
        raise HTTPException(400, "unknown feature")
    if feature == "upscale":
        return upscale.list_models()
    return list_feature_models(feature)
