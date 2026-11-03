
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
import re
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
    # True only for adapters that pass images as multimodal context, not as the image being edited.
    supports_style_reference: bool = False
    # Current text-to-image adapters expose approximately 1K output only.
    # Do not advertise 2K/4K until an adapter really requests those sizes.
    resolutions: tuple[str, ...] = ("1K",)
    # Native output aspect ratios accepted by this candidate adapter. Empty means unverified.
    frame_ratios: tuple[str, ...] = ()
    # Capacités de composition Image2 ; une priorité plus basse est préférée.
    max_identity_objects: int | None = None
    image2_identity_priority: int = 50
    # Text-only Image Generator may support fewer ratios than Image Editor.
    # None means that the generator shares the candidate's general frame ratios.
    text_to_image_generator_frame_ratios: tuple[str, ...] | None = None


# --- Helpers d'exposition des modèles disponibles ---
def candidate_resolutions(candidate: Candidate) -> tuple[str, ...]:
    """Expose the verified resolution limit for the pinned Magic Hour model."""
    if candidate.key != "magichour-flux-2-klein-text":
        return candidate.resolutions
    # Flux 2 Klein is currently validated only at this size by the adapter.
    # Account tier alone must not make unsupported resolutions selectable.
    return ("640px",)

def candidate_text_to_image_frame_ratios(
    candidate: Candidate,
    *,
    has_input_images: bool,
) -> tuple[str, ...]:
    """Return frame ratios for the actual Magic Hour-style generation path."""
    if (
        not has_input_images
        and candidate.text_to_image_generator_frame_ratios is not None
    ):
        return candidate.text_to_image_generator_frame_ratios

    return candidate.frame_ratios
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
            "provider": c.provider,
            "maxReferences": c.max_references,
            "image2IdentityPriority": c.image2_identity_priority,
            "supportsStyleReference": c.supports_style_reference,
            "resolutions": candidate_resolutions(c),
            "frameRatios": list(c.frame_ratios),
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
        if c.max_identity_objects is not None:
            item["maxIdentityObjects"] = c.max_identity_objects
        if c.text_to_image_generator_frame_ratios is not None:
            item["textToImageGeneratorFrameRatios"] = (
                c.text_to_image_generator_frame_ratios
            )
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
        "resolution": str(req.get("resolution") or "640px"),
        "quantity": req["quantity"],
    }


IMAGE2_REFERENCE_ROLES = {"element", "base", "style", "detail"}


def _explicit_image2_reference_role(scene_details: str | None, tag: str) -> str | None:
    """Detect an explicit role assigned to one exact Image2 tag in the prompt."""
    text = scene_details if isinstance(scene_details, str) else ""
    if not text or not isinstance(tag, str) or not re.fullmatch(r"@img[1-9]\d*", tag):
        return None
    image_tag = re.escape(tag)
    negative_patterns = (
        rf"\b(?:do\s+not|don't|never|avoid)\s+(?:use|treat|assign|consider|interpret)\s+{image_tag}\s+(?:as|for)\b",
        rf"{image_tag}\s+(?:is|should\s+be)\s+not\s+(?:the\s+)?(?:base|background|style|lighting|light|material|texture|detail|element|object)\b",
        rf"(?:لا\s+تستخدم|لا\s+تعامل|لا\s+تعتبر)\s+{image_tag}\s+(?:ك|على\s+أنه|على\s+أنها)",
    )
    if any(re.search(pattern, text, re.IGNORECASE) for pattern in negative_patterns):
        return None

    # Arabic role declarations are matched independently so a negative
    # declaration can still fall through to the saved metadata role.
    arabic_patterns = {
        "base": (
            rf"{image_tag}[^.!?\n]{{0,45}}(?:\u0643\u062e\u0644\u0641\u064a\u0629|\u0643\u0642\u0627\u0639\u062f\u0629|\u0643\u0645\u0634\u0647\u062f\s+\u0623\u0633\u0627\u0633\u064a)",
            rf"(?:\u0623\u062f\u062e\u0644|\u0636\u0639|\u0627\u062f\u0645\u062c)[^.!?\n]{{0,80}}\b(?:\u0641\u064a|\u062f\u0627\u062e\u0644|\u0636\u0645\u0646)\s+{image_tag}",
            rf"\u0644\u0625\u062f\u062e\u0627\u0644\u0647\s+\u0641\u064a\s+{image_tag}",
        ),
        "style": (
            rf"{image_tag}[^.!?\n]{{0,45}}(?:\u0644\u0644\u0625\u0636\u0627\u0621\u0629|\u0644\u0644\u0623\u0644\u0648\u0627\u0646|\u0643\u0645\u0631\u062c\u0639\s+\u0623\u0633\u0644\u0648\u0628\u064a)",
            rf"(?:\u0627\u0633\u062a\u0644\u0647\u0645|\u062e\u0630|\u0637\u0627\u0628\u0642)[^.!?\n]{{0,80}}(?:\u0627\u0644\u0625\u0636\u0627\u0621\u0629|\u0627\u0644\u0623\u0644\u0648\u0627\u0646)[^.!?\n]{{0,50}}{image_tag}",
        ),
        "detail": (
            rf"{image_tag}[^.!?\n]{{0,45}}(?:\u0644\u0644\u062e\u0627\u0645\u0629|\u0644\u0644\u0645\u0644\u0645\u0633|\u0644\u0644\u062a\u0641\u0627\u0635\u064a\u0644)",
            rf"(?:\u0627\u0633\u062a\u0641\u062f|\u0627\u0642\u062a\u0628\u0633|\u062e\u0630)[^.!?\n]{{0,80}}(?:\u0627\u0644\u062e\u0627\u0645\u0629|\u0627\u0644\u0645\u0644\u0645\u0633|\u0627\u0644\u062a\u0641\u0627\u0635\u064a\u0644)[^.!?\n]{{0,40}}{image_tag}",
            rf"\u0627\u0633\u062a\u0641\u062f\s+\u0645\u0646\s+(?:\u062e\u0627\u0645\u0629|\u0645\u0644\u0645\u0633|\u062a\u0641\u0627\u0635\u064a\u0644)\s+{image_tag}",
        ),
        "element": (
            rf"{image_tag}[^.!?\n]{{0,45}}(?:\u0643\u0639\u0646\u0635\u0631|\u0643\u062c\u0633\u0645|\u0643\u0645\u0646\u062a\u062c)",
            rf"(?:\u0627\u062d\u0641\u0638|\u0627\u062d\u062a\u0641\u0638)[^.!?\n]{{0,70}}(?:\u0647\u0648\u064a\u0629|\u0634\u0643\u0644|\u0646\u0633\u0628)[^.!?\n]{{0,40}}{image_tag}",
        ),
    }
    for role in ("base", "style", "detail", "element"):
        if any(re.search(pattern, text) for pattern in arabic_patterns[role]):
            return role

    role_patterns: tuple[tuple[str, tuple[str, ...]], ...] = (
        (
            "base",
            (
                rf"{image_tag}\s+(?:as\s+)?(?:the\s+)?(?:base|background|backdrop|destination(?:\s+scene)?|existing\s+(?:room|scene|image)|room\s+background|scene\s+background)\b",
                rf"\b(?:base|background|backdrop|destination(?:\s+scene)?|existing\s+(?:room|scene|image))\s+(?:image\s+)?(?:is|=|:)\s*{image_tag}\b",
                rf"\b(?:insert|place|put|add|composite|integrate)\b[^.!?\n]{{0,120}}\b(?:into|onto|inside|within)\s+{image_tag}\b",
                rf"{image_tag}\s+(?:كخلفية|كقاعدة|كمشهد\s+أساسي|كمشهد\s+مستقبِل)",
                rf"(?:أدخل|ضع|ادمج)\b[^.!؟\n]{{0,100}}\b(?:في|داخل|ضمن)\s+{image_tag}\b",
            ),
        ),
        (
            "style",
            (
                rf"\b(?:use|treat|consider|use\s+only)\s+{image_tag}\s+(?:as|for)\s+(?:the\s+)?(?:style|lighting|light|color(?:\s+treatment)?|palette|visual\s+treatment)\b",
                rf"\b(?:lighting|light|color(?:\s+treatment)?|palette|visual\s+treatment|style)\b[^.!?\n]{{0,80}}\bfrom\s+{image_tag}\b",
                rf"{image_tag}\s+(?:للإضاءة|للضوء|للألوان|للمعالجة\s+البصرية|كمرجع\s+أسلوبي)(?:\s+فقط)?",
                rf"(?:استلهم|خذ|طابق)\b[^.!؟\n]{{0,80}}\b(?:الإضاءة|الألوان|الأسلوب|المعالجة\s+البصرية)\b[^.!؟\n]{{0,40}}{image_tag}",
            ),
        ),
        (
            "detail",
            (
                rf"\b(?:borrow|take|use|match|copy)\b[^.!?\n]{{0,100}}\b(?:material|texture|detail|pattern|finish|surface)[^.!?\n]{{0,60}}\bfrom\s+{image_tag}\b",
                rf"\b(?:use|take|borrow)\s+{image_tag}\s+(?:for|as)\s+(?:the\s+)?(?:material|texture|detail|pattern|finish|surface)\b",
                rf"{image_tag}\s+(?:للخامة|للملمس|للتفاصيل|للنقش|للتشطيب)(?:\s+فقط)?",
                rf"(?:استفد|اقتبس|خذ)\b[^.!؟\n]{{0,80}}\b(?:الخامة|الملمس|التفاصيل|النقش|التشطيب)\b[^.!؟\n]{{0,40}}{image_tag}",
            ),
        ),
        (
            "element",
            (
                rf"\b(?:use|treat|consider)\s+{image_tag}\s+(?:as\s+)?(?:the\s+)?(?:element|object|item|subject|product|person|building)\b",
                rf"{image_tag}\s+(?:as\s+)?(?:the\s+)?(?:object|element|item|subject)\s+to\s+(?:insert|place|add|include)\b",
                rf"\b(?:preserve|keep|retain)\b[^.!?\n]{{0,100}}\b(?:identity|silhouette|proportions|features)\b[^.!?\n]{{0,50}}{image_tag}\b",
                rf"{image_tag}\s+(?:كعنصر|كجسم|كمنتج|كشخص|كعنصر\s+لإدخاله)",
                rf"(?:حافظ|احتفظ)\b[^.!؟\n]{{0,100}}\b(?:هوية|شكل|نسب|تفاصيل)\b[^.!؟\n]{{0,50}}{image_tag}",
            ),
        ),
    )
    for role, patterns in role_patterns:
        if any(re.search(pattern, text, re.IGNORECASE) for pattern in patterns):
            return role
    return None


def normalize_image2_reference_roles(req: dict) -> list[str]:
    """Explicit prompt role declarations override saved roles; legacy requests fall back safely."""
    references = req.get("referenceUrls") or []
    if not isinstance(references, (list, tuple)):
        references = []

    raw_roles = req.get("referenceRoles") or []
    if not isinstance(raw_roles, (list, tuple)):
        raw_roles = []

    raw_tags = req.get("referenceTags") or []
    if not isinstance(raw_tags, (list, tuple)):
        raw_tags = []

    scene_details = req.get("sceneDetails")
    roles: list[str] = []

    for index in range(len(references)):
        tag = raw_tags[index] if index < len(raw_tags) else None
        if not isinstance(tag, str) or not re.fullmatch(r"@img[1-9]\d*", tag):
            tag = f"@img{index + 1}"

        saved_role = raw_roles[index] if index < len(raw_roles) else None
        explicit_role = _explicit_image2_reference_role(scene_details, tag)

        if explicit_role in IMAGE2_REFERENCE_ROLES:
            role = explicit_role
        elif isinstance(saved_role, str) and saved_role in IMAGE2_REFERENCE_ROLES:
            role = saved_role
        else:
            role = "element"

        roles.append(role)

    return roles

def text_to_image_identity_locked(req: dict) -> bool:
    """Only an Element or Base source locks identity/composition; Style alone does not."""
    return bool(req.get("imageUrl")) or any(
        role in {"element", "base"} for role in normalize_image2_reference_roles(req)
    )


def image2_identity_object_count(req: dict) -> int:
    """Count identity-bearing objects, excluding Base, Style and Detail references."""
    return (1 if req.get("imageUrl") else 0) + sum(
        role == "element" for role in normalize_image2_reference_roles(req)
    )


def image2_frame_reference(req: dict) -> str | None:
    """Choose the source image that defines Auto framing.

    Priority:
    1. Base: it is the destination scene and therefore owns the output frame.
    2. Primary image: used when there is no Base.
    3. First Element reference: fallback when no primary image exists.

    Style and Detail references never define the destination frame.
    """
    references = req.get("referenceUrls") or []
    if not isinstance(references, (list, tuple)):
        references = []

    roles = normalize_image2_reference_roles(req)

    base_index = next(
        (index for index, role in enumerate(roles) if role == "base"),
        None,
    )
    if base_index is not None and base_index < len(references):
        value = references[base_index]
        if isinstance(value, str) and value.strip():
            return value

    primary = req.get("imageUrl")
    if isinstance(primary, str) and primary.strip():
        return primary

    element_index = next(
        (index for index, role in enumerate(roles) if role == "element"),
        None,
    )
    if element_index is not None and element_index < len(references):
        value = references[element_index]
        if isinstance(value, str) and value.strip():
            return value

    return None


def text_to_image_images(req: dict) -> list[str]:
    """Return provider image inputs in manifest order: Style, primary Element, then references."""
    images: list[str] = []
    style_image = req.get("styleReferenceUrl")
    if isinstance(style_image, str) and style_image.strip():
        images.append(style_image)
    primary_image = req.get("imageUrl")
    if isinstance(primary_image, str) and primary_image.strip():
        images.append(primary_image)
    references = req.get("referenceUrls") or []
    if isinstance(references, (list, tuple)):
        images.extend(image for image in references if isinstance(image, str) and image.strip())
    return images


def magichour_text_to_image_input(req: dict) -> dict:
    """Magic Hour Flux 2 Klein: preserve the resolved native frame ratio."""
    ratio = req.get("aspectRatio") or "auto"
    if ratio == "auto":
        ratio = req.get("resolvedAspectRatio") or "4:3"

    supported_ratios = {"auto", "1:1", "16:9", "9:16", "4:3", "3:2", "2:3"}
    if ratio not in supported_ratios:
        raise ValueError(
            f"Magic Hour Flux 2 Klein does not support {ratio}; "
            "use auto, 1:1, 16:9, 9:16, 4:3, 3:2, or 2:3."
        )

    images = text_to_image_images(req)

    return {
        "prompt": req["prompt"],
        "images": images,
        "aspectRatio": ratio,
        "resolution": str(req.get("resolution") or "640px"),
        "quantity": req["quantity"],
        "is_text_to_image": True,
    }


def _magichour_video_prompt(req: dict, *, video_to_video: bool = False) -> str:
    """Construit un prompt concis respectant la limite Magic Hour de 2000 caractères."""
    if video_to_video:
        prefix = (
            "Modify the architectural video only as requested. Preserve its geometry, identity, framing, camera path, "
            "timing, and temporal consistency. Apply these scene directions: "
        )
    else:
        prefix = (
            "Create a photorealistic architectural video from the reference image. Preserve geometry, materials, and "
            "lighting. Use smooth natural camera motion and stable details. Scene directions: "
        )
    scene = str(req.get("userPrompt") or req.get("prompt") or "").strip()
    return (prefix + scene)[:2000]


def magichour_video_input(req: dict) -> dict:
    """Magic Hour image-to-video : durées transmises telles quelles.

    Le tier standard utilise 480p car 720p n'est pas disponible sur tous les
    plans Magic Hour (notamment le free tier).
    """
    payload = {
        "prompt": _magichour_video_prompt(req),
        "image": req["imageUrl"],
        "endSeconds": req.get("durationSeconds") or 4,
        "resolution": "1080p" if req["quality"] == "pro" else "480p",
    }
    end_image = req.get("endImageUrl")
    # Magic Hour image-to-video accepts a start image and an optional end
    # image. Use a single extra tagged reference as the end frame when the
    # user has not supplied one explicitly.
    if not end_image:
        references = req.get("referenceUrls") or []
        end_image = references[0] if references else None
    if end_image:
        payload["endImage"] = end_image
    return payload


def magichour_video_to_video_input(req: dict) -> dict:
    """Magic Hour video-to-video / relight : reprend une vidéo existante.

    Le tier standard utilise 480p pour rester compatible avec les plans Magic Hour
    qui ne proposent pas 720p (free tier).
    """
    return {
        "prompt": _magichour_video_prompt(req, video_to_video=True),
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
    ou les deux selon son API officielle.
    """
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


def google_background_removal_input(req: dict) -> dict:
    """Google Gemini : prompt d'isolation + image source comme référence."""
    return {
        "prompt": req["prompt"],
        "images": [req["imageUrl"]],
        "quantity": 1,
    }


def bfl_text_to_image_input(req: dict) -> dict:
    """BFL text-to-image: pass actual dimensions so the selected frame is honored."""
    ratio = req.get("resolvedAspectRatio") if req.get("aspectRatio") == "auto" else req.get("aspectRatio")
    # FLUX.1 Pro 1.1 / Dev endpoints require dimensions in multiples of 32.
    # These pairs preserve each requested ratio exactly and remain below 1440 px.
    width, height = {
        "1:1": (1024, 1024),
        "16:9": (1024, 576),
        "9:16": (576, 1024),
        "4:3": (1024, 768),
        "3:4": (768, 1024),
        "3:2": (960, 640),
        "2:3": (640, 960),
        "21:9": (1344, 576),
    }.get(ratio, (1024, 768))
    payload: dict = {
        "prompt": req["prompt"],
        "width": width,
        "height": height,
        "output_format": "jpeg",
        "safety_tolerance": 2,
        "quantity": req["quantity"],
    }
    image = req.get("imageUrl")
    if not image:
        references = req.get("referenceUrls") or []
        image = references[0] if references else None
    if image:
        payload["input_image"] = to_base64_or_url(image)
    return payload


def openai_text_to_image_input(req: dict) -> dict:
    """GPT Image 2: send dimensions matching the selected frame exactly."""
    ratio = req.get("aspectRatio") or "auto"
    size = {
        "1:1": "1024x1024",
        "16:9": "1024x576",
        "9:16": "576x1024",
        "4:3": "1024x768",
        "3:4": "768x1024",
        "3:2": "960x640",
        "2:3": "640x960",
        "21:9": "1008x432",
    }.get(ratio, "auto")
    images = text_to_image_images(req)
    return {
        "prompt": req["prompt"],
        "images": images,
        "size": size,
        "quality": "high" if req["quality"] == "pro" else "medium",
        "output_format": "png",
        "quantity": req["quantity"],
    }


OPENAI_IMAGE2_SIZES = {
    "1K": {
        "1:1": "1024x1024",
        "16:9": "1280x720",
        "9:16": "720x1280",
        "4:3": "1024x768",
        "3:4": "768x1024",
        "3:2": "1152x768",
        "2:3": "768x1152",
        "21:9": "1792x768",
    },
    "2K": {
        "1:1": "2048x2048",
        "16:9": "2560x1440",
        "9:16": "1440x2560",
        "4:3": "2048x1536",
        "3:4": "1536x2048",
        "3:2": "2304x1536",
        "2:3": "1536x2304",
        "21:9": "2688x1152",
    },
    "4K": {
        "1:1": "2880x2880",
        "16:9": "3840x2160",
        "9:16": "2160x3840",
        "4:3": "3264x2448",
        "3:4": "2448x3264",
        "3:2": "3456x2304",
        "2:3": "2304x3456",
        "21:9": "3840x1648",
    },
}


def openai_text_to_image_25_input(req: dict) -> dict:
    """Construire les dimensions Image2 explicites pour GPT Image 2.5."""
    ratio = req.get("aspectRatio") or "auto"
    if ratio == "auto":
        ratio = req.get("resolvedAspectRatio") or "auto"
    resolution = str(req.get("resolution") or "1K").upper()
    size = OPENAI_IMAGE2_SIZES.get(resolution, {}).get(ratio, "auto")
    return {
        "prompt": req["prompt"],
        "images": text_to_image_images(req),
        "size": size,
        "quality": "xhigh" if req.get("quality") == "pro" else "medium",
        "output_format": "png",
        "quantity": req["quantity"],
    }


def google_text_to_image_input(req: dict) -> dict:
    """Google multimodal generation: preserve Style order and pass a native ratio when selected."""
    images = text_to_image_images(req)
    ratio = req.get("aspectRatio") or "auto"
    if ratio == "auto":
        ratio = req.get("resolvedAspectRatio") or "auto"
    payload = {
        "prompt": req["prompt"],
        "images": images,
        "quantity": req["quantity"],
        "resolution": str(req.get("resolution") or "1K").upper(),
    }
    if ratio != "auto":
        payload["aspectRatio"] = ratio
    return payload


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
    Candidate("gemini-3.1-flash-lite", "Gemini 3.1 Flash Lite Image", "Cost-efficient 1K image edits", "google", "gemini-3.1-flash-lite-image", 2, 4, 13, IMAGE_TIMEOUT_MS, ("standard",), google_edit_input, extract_image_urls),
    Candidate("gemini-3.1-flash", "Nano Banana 2", "High-quality image edits at 1K resolution", "google", "gemini-3.1-flash-image", 3, 7, 13, IMAGE_TIMEOUT_MS, ("standard", "pro"), google_edit_input, extract_image_urls),
    Candidate("gpt-image-1.5", "GPT Image 1.5", "High quality architectural edits", "openai", "gpt-image-1.5", 7, 15, 13, IMAGE_TIMEOUT_MS, ("pro",), openai_edit_input, extract_image_urls),
    Candidate("gpt-image-1", "GPT Image 1", "Versatile OpenAI image edits", "openai", "gpt-image-1", 5, 8, 13, IMAGE_TIMEOUT_MS, ("standard", "pro"), openai_edit_input, extract_image_urls),
    # Agrégateur (exception assumée, AGENTS.md §1) : flux-2-klein ÉPINGLÉ
    # (seul modèle d'édition éligible au free tier).
    Candidate("magichour-flux-2-klein", "Magic Hour Flux 2 Klein", "Free tier friendly image edits", "magichour", "flux-2-klein", 5, 1, 5, IMAGE_TIMEOUT_MS, ("standard", "pro"), magichour_edit_input, extract_image_urls),
]


ANIMATE_CANDIDATES: list[Candidate] = [
    Candidate(
        "comfyui-minimax-h3", "MiniMax H3 (Local ComfyUI)", "Local MiniMax H3 image-to-video generation",
        "comfyui", "minimax-h3", 1, 0, 0, VIDEO_TIMEOUT_MS, ("standard", "pro"),
        lambda req: req, extract_video_url,
        supports_image_to_video=True, supports_start_end_frame=True,
    ),
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
        "magichour", "default", 16, 30, 1, VIDEO_TIMEOUT_MS, ("standard", "pro"),
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


# Background Remover : services dédiés en priorité. Magic Hour utilise ici
# son éditeur d'image standard (Flux 2 Klein, éligible free tier) avec le prompt
# d'isolation ; sa sortie générative peut ne pas contenir un vrai canal alpha.
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
    Candidate(
        "magichour-background-remover",
        "Magic Hour Background Remover",
        "Prompt-guided background removal with image editing",
        "magichour",
        "flux-2-klein",
        3,
        1,
        0,
        IMAGE_TIMEOUT_MS,
        ("standard", "pro"),
        magichour_edit_input,
        extract_image_urls,
    ),
    Candidate(
        "gemini-background-removal",
        "Gemini 3 Pro Image",
        "Prompt-guided background removal with image editing",
        "google",
        "gemini-3-pro-image",
        6,
        10,
        1,
        IMAGE_TIMEOUT_MS,
        ("standard", "pro"),
        google_background_removal_input,
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
IMAGE2_FRAME_RATIOS = ("1:1", "16:9", "9:16", "4:3", "3:4", "3:2", "2:3", "21:9")


TEXT_TO_IMAGE_CANDIDATES: list[Candidate] = [
    Candidate(
        "gpt-image-2.5-sunburst",
        "GPT Image 2.5 Sunburst",
        "High-precision image generation and architectural compositing",
        "openai",
        "gpt-image-2.5-sunburst",
        8,
        8,  # Estimation provisoire ; le coût réel varie avec la taille et la qualité.
        13,
        IMAGE_TIMEOUT_MS,
        ("standard", "pro"),
        openai_text_to_image_25_input,
        extract_image_urls,
        supports_style_reference=True,
        resolutions=("1K", "2K", "4K"),
        frame_ratios=IMAGE2_FRAME_RATIOS,
        max_identity_objects=13,
        image2_identity_priority=10,
    ),
    Candidate(
        "gemini-3.1-flash",
        "Nano Banana 2",
        "High-quality multi-reference architectural generation",
        "google",
        "gemini-3.1-flash-image",
        3,
        7,
        13,
        IMAGE_TIMEOUT_MS,
        ("standard", "pro"),
        google_text_to_image_input,
        extract_image_urls,
        supports_style_reference=True,
        resolutions=("1K", "2K", "4K"),
        frame_ratios=IMAGE2_FRAME_RATIOS,
        max_identity_objects=10,
        image2_identity_priority=20,
    ),
    Candidate(
        "gemini-3.1-flash-lite",
        "Nano Banana 2 Lite",
        "Cost-efficient multi-reference generation at 1K",
        "google",
        "gemini-3.1-flash-lite-image",
        3,
        4,
        13,
        IMAGE_TIMEOUT_MS,
        ("standard",),
        google_text_to_image_input,
        extract_image_urls,
        supports_style_reference=True,
        resolutions=("1K",),
        frame_ratios=IMAGE2_FRAME_RATIOS,
        max_identity_objects=10,
        image2_identity_priority=30,
    ),
    Candidate(
        "flux-pro",
        "Flux Pro 1.1",
        "High quality text-to-image photorealistic renders; supports one reference image",
        "bfl",
        "flux-pro-1.1",
        7,
        5,
        1,
        IMAGE_TIMEOUT_MS,
        ("standard", "pro"),
        bfl_text_to_image_input,
        extract_image_urls,
        frame_ratios=IMAGE2_FRAME_RATIOS,
        max_identity_objects=1,
        image2_identity_priority=40,
    ),
    Candidate(
        "flux-dev",
        "Flux Dev",
        "Fast text-to-image generation; supports one reference image",
        "bfl",
        "flux-dev",
        5,
        3,
        1,
        IMAGE_TIMEOUT_MS,
        ("standard",),
        bfl_text_to_image_input,
        extract_image_urls,
        frame_ratios=IMAGE2_FRAME_RATIOS,
        max_identity_objects=1,
        image2_identity_priority=50,
    ),
    # Les ratios natifs documentés de Flux 2 Klein dans Magic Hour.
    Candidate(
        "magichour-flux-2-klein-text",
        "Magic Hour Flux 2 Klein",
        "Free tier friendly 640px text-to-image and style reference edits",
        "magichour",
        "flux-2-klein",
        5,
        1,
        5,
        IMAGE_TIMEOUT_MS,
        ("standard", "pro"),
        magichour_text_to_image_input,
        extract_image_urls,
        supports_style_reference=True,
        resolutions=("640px",),
        frame_ratios=("1:1", "16:9", "9:16", "4:3", "3:2", "2:3"),
        max_identity_objects=5,
        image2_identity_priority=100,
        text_to_image_generator_frame_ratios=("1:1", "16:9", "9:16"),
    ),
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
