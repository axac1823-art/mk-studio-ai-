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
    """Un modèle candidat pour une feature.

    `cost_per_generation` est le coût réel du provider en centimes de
    devise (USD) pour UNE génération. Il sert au calcul de marge et à la
    sélection "Auto" (le moins cher satisfaisant la qualité demandée).
    `cost_weight` reste un poids historique/qualitatif interne.
    """

    key: str
    name: str
    description: str
    provider: str
    model_id: str
    cost_weight: int
    cost_per_generation: int  # centimes de dollar, coût réel provider
    max_references: int
    timeout_ms: int
    tiers: tuple[str, ...]
    build_input: Callable[[dict], dict]
    extract_output: Callable[[dict], list[str]]
    # Capacités vidéo (ignorées pour les features image).
    supports_text_to_video: bool = False
    supports_image_to_video: bool = False
    supports_start_end_frame: bool = False
    supports_multi_reference: bool = False
    supports_video_to_video: bool = False
    supports_relight: bool = False
    supports_text_to_3d: bool = False
    supports_image_to_3d: bool = False


# --- Helpers d'exposition des modèles disponibles ---

def list_feature_models(feature: str, include_costs: bool = False) -> list[dict]:
    """Retourne les candidats d'une feature, prêts à être affichés dans un
    sélecteur utilisateur.

    Les modèles sont TOUJOURS listés (même sans clé provider configurée)
    pour que l'UI montre ce qui est disponible. `configured` indique si la
    clé correspondante est renseignée ; la génération échouera proprement
    si un modèle non configuré est choisi manuellement.

    `include_costs=True` expose `costPerGeneration` (centimes réels provider)
    pour le calcul des crédits côté web.
    """
    from providers import is_provider_configured

    result = []
    for c in MODEL_CATALOG.get(feature, []):
        item: dict = {
            "key": c.key,
            "name": c.name,
            "description": c.description,
            "configured": is_provider_configured(c.provider),
            "tiers": c.tiers,
            "supportsTextToVideo": c.supports_text_to_video,
            "supportsImageToVideo": c.supports_image_to_video,
            "supportsStartEndFrame": c.supports_start_end_frame,
            "supportsMultiReference": c.supports_multi_reference,
            "supportsVideoToVideo": c.supports_video_to_video,
            "supportsRelight": c.supports_relight,
            "supportsTextTo3d": c.supports_text_to_3d,
            "supportsImageTo3d": c.supports_image_to_3d,
        }
        if include_costs:
            item["costPerGeneration"] = c.cost_per_generation
        result.append(item)
    return result


def filter_candidates_by_mode(candidates: list[Candidate], mode: str) -> list[Candidate]:
    """Filtre les candidats vidéo selon le mode détecté."""
    flags = {
        "text_to_video": "supports_text_to_video",
        "image_to_video": "supports_image_to_video",
        "start_end_frame": "supports_start_end_frame",
        "multi_reference": "supports_multi_reference",
        "multi_shot": "supports_image_to_video",
        "video_to_video": "supports_video_to_video",
        "relight": "supports_relight",
    }
    attr = flags.get(mode)
    if not attr:
        return candidates
    return [c for c in candidates if getattr(c, attr)]


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
    """Kling legacy image-to-video : seuls image, image_tail et multi_shot
    sont acceptés. Les champs prompt/durée/ratio sont déduits de l'image."""
    payload: dict = {"image": to_base64_or_url(req["imageUrl"])}
    if req.get("endImageUrl"):
        payload["image_tail"] = to_base64_or_url(req["endImageUrl"])
    return payload


def runway_video_input(req: dict) -> dict:
    """Runway officiel : ratios en pixels cibles, durée numérique.

    gen4_turbo ne supporte PAS endImage ; ce champ est donc ignoré pour
    éviter une erreur 400 de validation.
    """
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
    payload = {
        "prompt": req["prompt"],
        "image_url": req["imageUrl"],
        "seconds": str(req.get("durationSeconds") or 4),
        "size": "720x1280" if req["aspectRatio"] in ("9:16", "3:4") else "1280x720",
    }
    if req.get("endImageUrl"):
        payload["end_image_url"] = req["endImageUrl"]
    return payload


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


def magichour_text_to_image_input(req: dict) -> dict:
    """Magic Hour image editor utilisé pour le text-to-image avec image
    optionnelle : l'image uploadée est transmise en référence par le front,
    on la remonte comme image principale du flux Magic Hour."""
    ratio = (
        "16:9"
        if req["aspectRatio"] in ("16:9", "4:3")
        else "9:16"
        if req["aspectRatio"] in ("9:16", "3:4")
        else "1:1"
    )
    images: list[str] = []
    if req.get("imageUrl"):
        images.append(req["imageUrl"])
    images.extend(req.get("referenceUrls", []))
    return {
        "prompt": req["prompt"],
        "images": images,
        "aspectRatio": ratio,
        "resolution": "auto",
        "quantity": req["quantity"],
    }


def magichour_video_input(req: dict) -> dict:
    """Magic Hour image-to-video : durées transmises telles quelles.

    Le tier standard utilise 480p car 720p n'est pas disponible sur tous les
    plans Magic Hour (notamment le free tier)."""
    payload = {
        "prompt": req["prompt"],
        "image": req["imageUrl"],
        "endSeconds": req.get("durationSeconds") or 4,
        "resolution": "1080p" if req["quality"] == "pro" else "480p",
    }
    if req.get("endImageUrl"):
        payload["endImage"] = req["endImageUrl"]
    return payload


def magichour_video_to_video_input(req: dict) -> dict:
    """Magic Hour video-to-video / relight : reprend une vidéo existante.

    Le tier standard utilise 480p pour rester compatible avec les plans Magic Hour
    qui ne proposent pas 720p (free tier)."""
    return {
        "prompt": req["prompt"],
        "videoUrl": req["videoUrl"],
        "endSeconds": req.get("durationSeconds") or 4,
        "resolution": "1080p" if req["quality"] == "pro" else "480p",
    }


def magichour_lip_sync_input(req: dict) -> dict:
    """Magic Hour lip-sync : synchronise une vidéo avec une piste audio."""
    return {
        "videoUrl": req["videoUrl"],
        "audioUrl": req["audioUrl"],
    }


def unified_3d_input(req: dict) -> dict:
    """Passe au provider les champs pertinents (prompt et/ou images).

    Chaque adaptateur 3D choisit lui-même s'il utilise le prompt, l'image
    ou les deux selon son API officielle."""
    payload: dict = {}
    if req.get("prompt"):
        payload["prompt"] = req["prompt"]
    if req.get("imageUrls"):
        payload["imageUrls"] = req["imageUrls"]
    elif req.get("imageUrl"):
        payload["imageUrl"] = req["imageUrl"]
    return payload


def removebg_input(req: dict) -> dict:
    """remove.bg attend `image` (data URI ou URL http), pas de prompt."""
    return {"image": req["imageUrl"]}


def bfl_text_to_image_input(req: dict) -> dict:
    """BFL text-to-image : prompt + image de référence optionnelle."""
    payload: dict = {
        "prompt": req["prompt"],
        "output_format": "jpeg",
        "safety_tolerance": 2,
        "quantity": req["quantity"],
    }
    if req.get("imageUrl"):
        payload["input_image"] = to_base64_or_url(req["imageUrl"])
    return payload


def openai_text_to_image_input(req: dict) -> dict:
    """OpenAI text-to-image : /v1/images/generations ; références ignorées."""
    size = (
        "1536x1024"
        if req["aspectRatio"] in ("16:9", "4:3")
        else "1024x1536"
        if req["aspectRatio"] in ("9:16", "3:4")
        else "1024x1024"
    )
    return {
        "prompt": req["prompt"],
        "size": size,
        "quality": "high" if req["quality"] == "pro" else "medium",
        "quantity": req["quantity"],
    }


def google_text_to_image_input(req: dict) -> dict:
    """Google text-to-image : prompt + références optionnelles."""
    return {
        "prompt": req["prompt"],
        "images": req.get("referenceUrls", []),
        "quantity": req["quantity"],
    }


# --- LE CATALOGUE ---

# Candidats partagés par TOUTES les features d'édition image du scope MVP
# (même pipeline img2img/edit — SEUL le prompt change, voir prompts.py).
# Si une feature doit diverger, lui donner sa propre liste.
# `cost_per_generation` = coût réel provider en centimes de dollar (à ajuster
# selon les factures réelles ; utilisé pour la marge et la sélection Auto).
IMAGE_EDIT_CANDIDATES: list[Candidate] = [
    Candidate("flux-kontext-max", "Flux Kontext Max", "Best for photorealistic architectural renders", "bfl", "flux-kontext-max", 8, 6, 0, IMAGE_TIMEOUT_MS, ("pro",), bfl_edit_input, extract_image_urls),
    Candidate("gemini-3-pro", "Gemini 3 Pro Image", "Best for detailed edits with many references", "google", "gemini-3-pro-image", 6, 10, 13, IMAGE_TIMEOUT_MS, ("standard", "pro"), google_edit_input, extract_image_urls),
    Candidate("flux-kontext-pro", "Flux Kontext Pro", "Reliable photorealistic edits", "bfl", "flux-kontext-pro", 4, 3, 0, IMAGE_TIMEOUT_MS, ("standard", "pro"), bfl_edit_input, extract_image_urls),
    Candidate("gemini-2.5-flash", "Gemini 2.5 Flash Image", "Fast image edits at lower cost", "google", "gemini-2.5-flash-image", 2, 3, 13, IMAGE_TIMEOUT_MS, ("standard",), google_edit_input, extract_image_urls),
    Candidate("gpt-image-1.5", "GPT Image 1.5", "High quality architectural edits", "openai", "gpt-image-1.5", 7, 15, 13, IMAGE_TIMEOUT_MS, ("pro",), openai_edit_input, extract_image_urls),
    Candidate("gpt-image-1", "GPT Image 1", "Versatile OpenAI image edits", "openai", "gpt-image-1", 5, 8, 13, IMAGE_TIMEOUT_MS, ("standard", "pro"), openai_edit_input, extract_image_urls),
    # Agrégateur (exception assumée, AGENTS.md §1) : flux-2-klein ÉPINGLÉ
    # (seul modèle d'édition éligible au free tier).
    Candidate("magichour-flux-2-klein", "Magic Hour Flux 2 Klein", "Free tier friendly image edits", "magichour", "flux-2-klein", 5, 1, 5, IMAGE_TIMEOUT_MS, ("standard", "pro"), magichour_edit_input, extract_image_urls),
]

ANIMATE_CANDIDATES: list[Candidate] = [
    Candidate(
        "kling-seedance-1.6", "Kling Seedance 1.6", "Kling's latest cinematic video model",
        "kling", "seedance-1.6", 20, 100, 0, VIDEO_TIMEOUT_MS, ("pro",),
        kling_video_input, extract_video_url,
        supports_image_to_video=True, supports_start_end_frame=True,
    ),
    Candidate(
        "kling-3.0-pro", "Kling 3.0 Pro", "High-end Kling 3.0 for cinematic results",
        "kling", "kling-3.0-pro", 19, 90, 0, VIDEO_TIMEOUT_MS, ("pro",),
        kling_video_input, extract_video_url,
        supports_image_to_video=True, supports_start_end_frame=True,
    ),
    Candidate(
        "kling-3.0", "Kling 3.0", "Balanced quality and motion for architectural videos",
        "kling", "kling-3.0", 17, 70, 0, VIDEO_TIMEOUT_MS, ("standard", "pro"),
        kling_video_input, extract_video_url,
        supports_image_to_video=True, supports_start_end_frame=True,
    ),
    Candidate(
        "kling-v3", "Kling v3", "Best for realistic physics and camera motion",
        "kling", "kling-v3", 18, 80, 0, VIDEO_TIMEOUT_MS, ("standard", "pro"),
        kling_video_input, extract_video_url,
        supports_image_to_video=True, supports_start_end_frame=True,
    ),
    Candidate(
        "kling-v2.5-turbo", "Kling v2.5 Turbo", "Fast video generation with smooth motion",
        "kling", "kling-v2-5-turbo", 15, 40, 0, VIDEO_TIMEOUT_MS, ("standard", "pro"),
        kling_video_input, extract_video_url,
        supports_image_to_video=True,
    ),
    Candidate(
        "runway-gen4", "Runway Gen-4", "Runway's flagship cinematic model",
        "runway", "gen4", 18, 70, 0, VIDEO_TIMEOUT_MS, ("standard", "pro"),
        runway_video_input, extract_video_url,
        supports_image_to_video=True,
    ),
    Candidate(
        "runway-gen4-turbo", "Runway Gen-4 Turbo", "Best for smooth cinematic camera moves",
        "runway", "gen4_turbo", 15, 50, 0, VIDEO_TIMEOUT_MS, ("standard",),
        runway_video_input, extract_video_url,
        supports_image_to_video=True,
    ),
    Candidate(
        "sora-2-pro", "Sora 2 Pro", "Highest quality cinematic video",
        "openai", "sora-2-pro", 19, 150, 0, VIDEO_TIMEOUT_MS, ("pro",),
        sora_video_input, extract_video_url,
        supports_image_to_video=True,
    ),
    Candidate(
        "sora-2", "Sora 2", "High quality image-to-video",
        "openai", "sora-2", 16, 80, 0, VIDEO_TIMEOUT_MS, ("standard", "pro"),
        sora_video_input, extract_video_url,
        supports_image_to_video=True,
    ),
    # Agrégateur (exception assumée, AGENTS.md §1) : `default` ~ kling-3.0
    # sur tiers payants, ltx-2.3 en gratuit.
    Candidate(
        "magichour-video", "Magic Hour Video", "Aggregated video models, free tier available",
        "magichour", "default", 16, 30, 0, VIDEO_TIMEOUT_MS, ("standard", "pro"),
        magichour_video_input, extract_video_url,
        supports_image_to_video=True, supports_video_to_video=True, supports_relight=True,
    ),
]

# Video-to-Video et Relight : pour l'instant seul Magic Hour expose ces
# capacités via son endpoint /v1/video-to-video. Les builders ne diffèrent que
# par le prompt (même requête API).
VIDEO_TO_VIDEO_CANDIDATES: list[Candidate] = [
    Candidate(
        "magichour-video-to-video", "Magic Hour Video-to-Video", "Modify an existing video with a prompt",
        "magichour", "default", 16, 40, 0, VIDEO_TIMEOUT_MS, ("standard", "pro"),
        magichour_video_to_video_input, extract_video_url,
        supports_video_to_video=True,
    ),
]

VIDEO_RELIGHT_CANDIDATES: list[Candidate] = [
    Candidate(
        "magichour-video-relight", "Magic Hour Video Relight", "Change lighting and time of day on a video",
        "magichour", "default", 16, 40, 0, VIDEO_TIMEOUT_MS, ("standard", "pro"),
        magichour_video_to_video_input, extract_video_url,
        supports_relight=True,
    ),
]

LIP_SYNC_CANDIDATES: list[Candidate] = [
    Candidate(
        "magichour-lip-sync", "Magic Hour Lip Sync", "Synchronize mouth movement with an audio track",
        "magichour", "lip-sync", 16, 40, 0, VIDEO_TIMEOUT_MS, ("standard", "pro"),
        magichour_lip_sync_input, extract_video_url,
    ),
]

# Background Remover : provider dédié (segmentation, pas d'édition image
# généraliste) — remove.bg en V1.
BACKGROUND_REMOVER_CANDIDATES: list[Candidate] = [
    Candidate(
        "removebg",
        "remove.bg",
        "Dedicated background removal with transparent PNG output",
        "removebg",
        "removebg",
        1,
        2,
        0,
        IMAGE_TIMEOUT_MS,
        ("standard", "pro"),
        removebg_input,
        extract_image_urls,
    ),
]

# 3D Generator : Meshy text-to-3D et image-to-3D, sortie GLB.
THREED_TIMEOUT_MS = 10 * 60 * 1000


def extract_3d_model_url(data: dict) -> list[str]:
    model = data.get("3d_model") if isinstance(data, dict) else None
    if isinstance(model, dict) and isinstance(model.get("url"), str):
        return [model["url"]]
    return []


THREED_CANDIDATES: list[Candidate] = [
    Candidate(
        "meshy", "Meshy", "Fast text or image to 3D",
        "meshy", "meshy", 10, 50, 0, THREED_TIMEOUT_MS, ("standard", "pro"),
        unified_3d_input, extract_3d_model_url,
        supports_text_to_3d=True, supports_image_to_3d=True,
    ),
    Candidate(
        "tripo", "Tripo", "Fast text or image to 3D",
        "tripo", "tripo", 12, 60, 0, THREED_TIMEOUT_MS, ("standard", "pro"),
        unified_3d_input, extract_3d_model_url,
        supports_text_to_3d=True, supports_image_to_3d=True,
    ),
    Candidate(
        "hunyuan3d-2", "Hunyuan3D 2", "High-quality text or image to 3D via Replicate",
        "hunyuan3d", "tencent/hunyuan3d-2", 14, 70, 0, THREED_TIMEOUT_MS, ("standard", "pro"),
        unified_3d_input, extract_3d_model_url,
        supports_text_to_3d=True, supports_image_to_3d=True,
    ),
    Candidate(
        "trellis", "Trellis", "Structured image-to-3D via Replicate",
        "trellis", "wtybill/trellis", 13, 65, 0, THREED_TIMEOUT_MS, ("standard", "pro"),
        unified_3d_input, extract_3d_model_url,
        supports_image_to_3d=True,
    ),
]

# Text-to-image standalone (Image Generator) : prompt principal + image de
# référence optionnelle. Les modèles image-to-image du catalogue édition
# peuvent aussi servir quand une image est fournie ; ici on privilégie les
# modèles natifs text-to-image.
TEXT_TO_IMAGE_CANDIDATES: list[Candidate] = [
    Candidate("flux-pro", "Flux Pro", "High quality text-to-image photorealistic renders", "bfl", "flux-pro", 7, 5, 0, IMAGE_TIMEOUT_MS, ("standard", "pro"), bfl_text_to_image_input, extract_image_urls),
    Candidate("flux-dev", "Flux Dev", "Fast text-to-image generation", "bfl", "flux-dev", 5, 3, 0, IMAGE_TIMEOUT_MS, ("standard",), bfl_text_to_image_input, extract_image_urls),
    Candidate("gpt-image-1", "GPT Image 1", "Versatile OpenAI text-to-image", "openai", "gpt-image-1", 6, 8, 0, IMAGE_TIMEOUT_MS, ("standard", "pro"), openai_text_to_image_input, extract_image_urls),
    Candidate("gemini-2.5-flash", "Gemini 2.5 Flash Image", "Fast text-to-image", "google", "gemini-2.5-flash-image", 3, 3, 0, IMAGE_TIMEOUT_MS, ("standard",), google_text_to_image_input, extract_image_urls),
    # Agrégateur (exception assumée, AGENTS.md §1) : utilisable quand une
    # image de référence est fournie, car l'API Magic Hour exige une image
    # d'entrée.
    Candidate("magichour-flux-2-klein-text", "Magic Hour Flux 2 Klein", "Free tier friendly text-to-image with reference", "magichour", "flux-2-klein", 5, 1, 5, IMAGE_TIMEOUT_MS, ("standard", "pro"), magichour_text_to_image_input, extract_image_urls),
]

MODEL_CATALOG: dict[str, list[Candidate]] = {
    "print_render": IMAGE_EDIT_CANDIDATES,
    "mood_swap": IMAGE_EDIT_CANDIDATES,
    "exterior_to_interior": IMAGE_EDIT_CANDIDATES,
    "plan_to_render": IMAGE_EDIT_CANDIDATES,
    "multi_angle": IMAGE_EDIT_CANDIDATES,
    "image_extender": IMAGE_EDIT_CANDIDATES,
    "variations": IMAGE_EDIT_CANDIDATES,
    "background_remover": BACKGROUND_REMOVER_CANDIDATES,
    "text_to_image": TEXT_TO_IMAGE_CANDIDATES,
    # L'upscale a son propre provider avec liste de fallback en config
    # (providers/upscale.py) — pas de candidats catalogue ici.
    "upscale": [],
    "animate": ANIMATE_CANDIDATES,
    "video_to_video": VIDEO_TO_VIDEO_CANDIDATES,
    "video_relight": VIDEO_RELIGHT_CANDIDATES,
    "lip_sync": LIP_SYNC_CANDIDATES,
    "3d_generator": THREED_CANDIDATES,
}
