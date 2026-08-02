"""Catalogue feature -> candidats ordonnés — port de lib/ai/catalog.ts.

C'EST ICI, et nulle part ailleurs, qu'on décide quels modèles servent
chaque fonctionnalité, sur quelle API OFFICIELLE ils sont appelés, dans
quel ordre ils sont essayés, et combien ils coûtent en interne. Changer de
fournisseur ou de version de modèle = modifier UNE entrée.

Règles :
- Les `key`/`model_id` ne doivent JAMAIS apparaître côté client.
- `cost_weight` est un poids de coût INTERNE (comparaison coût/qualité/
  latence). L'utilisateur paie toujours le coût de la feature
  (table action_costs) quel que soit le modèle ayant servi.
- Les model_id sont INDICATIFS : vérifier la doc de chaque fournisseur
  avant la mise en production (les versions évoluent vite).
"""
from dataclasses import dataclass
from typing import Callable

from providers.http_helpers import to_base64_or_url

IMAGE_TIMEOUT_MS = 3 * 60 * 1000
VIDEO_TIMEOUT_MS = 10 * 60 * 1000


@dataclass(frozen=True)
class Candidate:
    """Un modèle candidat pour une feature (journalisation interne via
    `key` — jamais exposée au client)."""

    key: str
    provider: str
    model_id: str
    cost_weight: int
    max_references: int
    timeout_ms: int
    tiers: tuple[str, ...]
    build_input: Callable[[dict], dict]
    extract_output: Callable[[dict], list[str]]


# --- Extracteurs tolérants : normalisent les sorties des providers vers
#     une simple liste d'URLs ({ images } / { video }). ---


def extract_image_urls(data: dict) -> list[str]:
    images = data.get("images") if isinstance(data, dict) else None
    if not isinstance(images, list):
        return []
    return [img["url"] for img in images if isinstance(img, dict) and img.get("url")]


def extract_video_url(data: dict) -> list[str]:
    video = data.get("video") if isinstance(data, dict) else None
    if isinstance(video, dict) and isinstance(video.get("url"), str):
        return [video["url"]]
    return []


# --- Fabriques d'input : traduisent la requête normalisée (dict) vers le
#     vocabulaire de l'API officielle de chaque fournisseur. ---


def bfl_edit_input(req: dict) -> dict:
    """BFL Flux Kontext : une seule image d'entrée, base64 brut."""
    return {
        "prompt": req["prompt"],
        "input_image": to_base64_or_url(req["imageUrl"]),
        "output_format": "jpeg",
        "safety_tolerance": 2,
        "quantity": req["quantity"],
    }


def google_edit_input(req: dict) -> dict:
    """Google Gemini image : image principale en tête, puis références."""
    return {
        "prompt": req["prompt"],
        "images": [req["imageUrl"], *req.get("referenceUrls", [])],
        "quantity": req["quantity"],
    }


def map_duration(req: dict) -> int:
    """Les durées demandées (4/8 s) sont mappées au plus proche supporté
    par les modèles vidéo (généralement 5 ou 10 s)."""
    return 5 if (req.get("durationSeconds") or 4) <= 6 else 10


def kling_video_input(req: dict) -> dict:
    """Kling officiel : ratios 4:3/3:4 non supportés -> repli cinéma."""
    ratio = (
        "16:9"
        if req["aspectRatio"] in ("16:9", "4:3")
        else "9:16"
        if req["aspectRatio"] in ("9:16", "3:4")
        else "1:1"
    )
    return {
        "image": to_base64_or_url(req["imageUrl"]),
        "prompt": req["prompt"],
        "duration": str(map_duration(req)),
        "aspect_ratio": ratio,
    }


def runway_video_input(req: dict) -> dict:
    """Runway officiel : ratios en pixels cibles, durée numérique."""
    ratio = {
        "16:9": "1280:720",
        "9:16": "720:1280",
        "4:3": "1104:832",
        "3:4": "832:1104",
    }.get(req["aspectRatio"], "960:960")
    return {
        "promptImage": req["imageUrl"],
        "promptText": req["prompt"],
        "ratio": ratio,
        "duration": map_duration(req),
    }


def openai_edit_input(req: dict) -> dict:
    """OpenAI GPT Image : tailles au plus proche (3 tailles seulement)."""
    size = (
        "1536x1024"
        if req["aspectRatio"] in ("16:9", "4:3")
        else "1024x1536"
        if req["aspectRatio"] in ("9:16", "3:4")
        else "1024x1024"
    )
    return {
        "prompt": req["prompt"],
        "images": [req["imageUrl"], *req.get("referenceUrls", [])],
        "size": size,
        "quality": "high" if req["quality"] == "pro" else "medium",
        "quantity": req["quantity"],
    }


def sora_video_input(req: dict) -> dict:
    """OpenAI Sora : durées exactes (4/8 s), 2 orientations."""
    return {
        "prompt": req["prompt"],
        "image_url": req["imageUrl"],
        "seconds": str(req.get("durationSeconds") or 4),
        "size": "720x1280" if req["aspectRatio"] in ("9:16", "3:4") else "1280x720",
    }


def magichour_edit_input(req: dict) -> dict:
    """Magic Hour (agrégateur — exception, voir AGENTS.md §1) : le modèle
    épinglé n'accepte que auto/1:1/16:9/9:16."""
    ratio = (
        "16:9"
        if req["aspectRatio"] in ("16:9", "4:3")
        else "9:16"
        if req["aspectRatio"] in ("9:16", "3:4")
        else "1:1"
    )
    return {
        "prompt": req["prompt"],
        "images": [req["imageUrl"], *req.get("referenceUrls", [])],
        "aspectRatio": ratio,
        "resolution": "auto",
        "quantity": req["quantity"],
    }


def magichour_video_input(req: dict) -> dict:
    """Magic Hour image-to-video : durées transmises telles quelles."""
    return {
        "prompt": req["prompt"],
        "image": req["imageUrl"],
        "endSeconds": req.get("durationSeconds") or 4,
        "resolution": "1080p" if req["quality"] == "pro" else "720p",
    }


def comfyui_img2img_input(req: dict) -> dict:
    """ComfyUI local : img2img (l'image est versée dans input/ par le provider)."""
    return {"prompt": req["prompt"], "image": req["imageUrl"], "quantity": req["quantity"]}


def comfyui_video_input(req: dict) -> dict:
    """ComfyUI local : img2video — dimensions cibles modestes en multiples
    de 16 (~480p standard, ~720p pro : la vidéo locale est LOURDE sur GPU
    grand public) ; la durée est convertie en frames par le provider."""
    pro = req["quality"] == "pro"
    width, height = {
        "16:9": (1280, 720) if pro else (832, 480),
        "9:16": (720, 1280) if pro else (480, 832),
        "4:3": (1088, 816) if pro else (768, 576),
        "3:4": (816, 1088) if pro else (576, 768),
    }.get(req["aspectRatio"], (960, 960) if pro else (640, 640))
    return {
        "prompt": req["prompt"],
        "image": req["imageUrl"],
        "duration": req.get("durationSeconds") or 4,
        "width": width,
        "height": height,
    }


# --- LE CATALOGUE ---

# Candidats partagés par TOUTES les features d'édition image du scope MVP
# (même pipeline img2img/edit — SEUL le prompt change, voir prompts.py).
# Si une feature doit diverger, lui donner sa propre liste.
IMAGE_EDIT_CANDIDATES: list[Candidate] = [
    Candidate("edit-alpha-pro", "bfl", "flux-kontext-max", 8, 0, IMAGE_TIMEOUT_MS, ("pro",), bfl_edit_input, extract_image_urls),
    Candidate("edit-beta-pro", "google", "gemini-3-pro-image-preview", 6, 13, IMAGE_TIMEOUT_MS, ("standard", "pro"), google_edit_input, extract_image_urls),
    Candidate("edit-alpha", "bfl", "flux-kontext-pro", 4, 0, IMAGE_TIMEOUT_MS, ("standard", "pro"), bfl_edit_input, extract_image_urls),
    Candidate("edit-beta", "google", "gemini-2.5-flash-image", 2, 13, IMAGE_TIMEOUT_MS, ("standard",), google_edit_input, extract_image_urls),
    Candidate("edit-delta-pro", "openai", "gpt-image-1.5", 7, 13, IMAGE_TIMEOUT_MS, ("pro",), openai_edit_input, extract_image_urls),
    Candidate("edit-delta", "openai", "gpt-image-1", 5, 13, IMAGE_TIMEOUT_MS, ("standard", "pro"), openai_edit_input, extract_image_urls),
    # Agrégateur (exception assumée, AGENTS.md §1) : flux-2-klein ÉPINGLÉ
    # (seul modèle d'édition éligible au free tier).
    Candidate("edit-epsilon", "magichour", "flux-2-klein", 5, 5, IMAGE_TIMEOUT_MS, ("standard", "pro"), magichour_edit_input, extract_image_urls),
    # Provider LOCAL de test (GPU utilisateur, gratuit, hors-ligne) —
    # dernier recours du routage auto (coût nul).
    Candidate("edit-zeta", "comfyui", "img2img", 0, 0, IMAGE_TIMEOUT_MS, ("standard", "pro"), comfyui_img2img_input, extract_image_urls),
]

ANIMATE_CANDIDATES: list[Candidate] = [
    # Nom du modèle v3 à vérifier dans la console Kling — si l'API le
    # rejette, le fallback bascule automatiquement sur v2.5-turbo.
    Candidate("video-beta-pro", "kling", "kling-v3", 18, 0, VIDEO_TIMEOUT_MS, ("standard", "pro"), kling_video_input, extract_video_url),
    Candidate("video-beta", "kling", "kling-v2-5-turbo", 15, 0, VIDEO_TIMEOUT_MS, ("standard", "pro"), kling_video_input, extract_video_url),
    Candidate("video-gamma", "runway", "gen4_turbo", 15, 0, VIDEO_TIMEOUT_MS, ("standard",), runway_video_input, extract_video_url),
    Candidate("video-delta-pro", "openai", "sora-2-pro", 19, 0, VIDEO_TIMEOUT_MS, ("pro",), sora_video_input, extract_video_url),
    Candidate("video-delta", "openai", "sora-2", 16, 0, VIDEO_TIMEOUT_MS, ("standard", "pro"), sora_video_input, extract_video_url),
    # Agrégateur (exception assumée, AGENTS.md §1) : `default` ~ kling-3.0
    # sur tiers payants, ltx-2.3 en gratuit.
    Candidate("video-epsilon", "magichour", "default", 16, 0, VIDEO_TIMEOUT_MS, ("standard", "pro"), magichour_video_input, extract_video_url),
    # Provider LOCAL de test : img2video via workflow custom OBLIGATOIRE
    # (COMFYUI_VIDEO_WORKFLOW_FILE), sinon échec vite -> fallback.
    Candidate("video-zeta", "comfyui", "i2v", 0, 0, VIDEO_TIMEOUT_MS, ("standard", "pro"), comfyui_video_input, extract_video_url),
]

MODEL_CATALOG: dict[str, list[Candidate]] = {
    "print_render": IMAGE_EDIT_CANDIDATES,
    "mood_swap": IMAGE_EDIT_CANDIDATES,
    "exterior_to_interior": IMAGE_EDIT_CANDIDATES,
    "plan_to_render": IMAGE_EDIT_CANDIDATES,
    "multi_angle": IMAGE_EDIT_CANDIDATES,
    # L'upscale a son propre provider avec liste de fallback en config
    # (providers/upscale.py) — pas de candidats catalogue ici.
    "upscale": [],
    "animate": ANIMATE_CANDIDATES,
}
