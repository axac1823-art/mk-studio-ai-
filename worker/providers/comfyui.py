"""Adaptateur ComfyUI — serveur LOCAL de test (port de providers/comfyui.ts).

Sert à faire tourner le pipeline SANS clé payante : img2img ET img2video
(i2v) sur le GPU de l'utilisateur, gratuit et hors-ligne.

Schéma (API HTTP de ComfyUI) :
  1. POST /upload/image (multipart) — l'image source vers input/
  2. POST /prompt { prompt: <graphe de nœuds> } -> { prompt_id }
  3. polling GET /history/{prompt_id} -> outputs (SaveImage pour l'image,
     VHS_VideoCombine — clé "gifs" — pour la vidéo)
  4. GET /view?filename=... -> octets

Endpoints locaux (le model_id du catalogue choisit) :
- "img2img" : graphe par défaut checkpoints SD1.5/SDXL, REMPLAÇABLE via
  COMFYUI_WORKFLOW_FILE — indispensable pour Flux ou tout graphe custom ;
- "i2v" : PAS de graphe par défaut (Wan/LTX/SVD diffèrent trop) —
  COMFYUI_VIDEO_WORKFLOW_FILE est REQUIS (sinon échec vite -> fallback).

Placeholders des fichiers de workflow (JSON exporté de ComfyUI en format
API, quotes incluses) : "{{PROMPT}}", "{{NEGATIVE}}", "{{IMAGE}}",
"{{SEED}}" ; vidéo uniquement : "{{FRAMES}}" (durée x fps), "{{FPS}}",
"{{WIDTH}}", "{{HEIGHT}}" — remplacés par des NOMBRES.

Env : COMFYUI_CHECKPOINT (requis pour img2img), COMFYUI_VIDEO_WORKFLOW_FILE
(requis pour i2v) ; COMFYUI_BASE_URL, COMFYUI_DENOISE (défaut 0.55),
COMFYUI_WORKFLOW_FILE et COMFYUI_VIDEO_FPS (défaut 16) optionnels.

Sorties : data URI pour l'image ; pour la vidéo, les octets sont écrits
directement via storage.py (une data URI vidéo serait trop lourde) et le
chemin "/storage/<nom>" est renvoyé.
"""
import base64
import json
import os
import random
from urllib.parse import urlencode

import httpx

import storage
from providers.http_helpers import (
    ProviderError,
    get_bytes,
    get_json,
    parse_data_uri,
    poll_until_done,
    post_json,
    require_env,
)

DEFAULT_BASE_URL = "http://127.0.0.1:8188"
DEFAULT_VIDEO_FPS = 16

# Négatif constant pour le graphe par défaut — orienté rendu d'architecture
# (le prompt positif vient des templates serveur, comme partout).
DEFAULT_NEGATIVE = (
    "blurry, lowres, deformed geometry, warped walls, bent lines, text, "
    "watermark, logo, people, oversaturated"
)


def _base_url() -> str:
    return os.environ.get("COMFYUI_BASE_URL", DEFAULT_BASE_URL).rstrip("/")


def _denoise_strength() -> float:
    try:
        raw = float(os.environ.get("COMFYUI_DENOISE", "0.55"))
    except ValueError:
        return 0.55
    # img2img : 0 = copie conforme, 1 = génération complète. Borné pour
    # garder un comportement "édition" quoi qu'il arrive.
    return min(1.0, max(0.05, raw))


def _video_fps() -> int:
    try:
        raw = int(os.environ.get("COMFYUI_VIDEO_FPS", str(DEFAULT_VIDEO_FPS)))
    except ValueError:
        return DEFAULT_VIDEO_FPS
    return min(60, max(1, raw))


def _upload_image(image_data_uri: str) -> str:
    """ComfyUI ne lit que des fichiers de SON dossier input/ : la data URI
    (upload utilisateur) y est versée au préalable."""
    parsed = parse_data_uri(image_data_uri)
    if not parsed:
        raise ProviderError("comfyui: http image inputs are not supported, data URI expected")
    mime, data = parsed
    ext = mime.split("/")[1] if "/" in mime else "png"
    response = httpx.post(
        f"{_base_url()}/upload/image",
        files={"image": (f"input.{ext}", base64.b64decode(data), mime)},
        timeout=60,
    )
    if response.status_code >= 400:
        raise ProviderError(
            f"POST {_base_url()}/upload/image failed ({response.status_code})", response.status_code
        )
    payload = response.json()
    name = payload.get("name")
    if not name:
        raise ProviderError("comfyui: no image name in upload response")
    subfolder = payload.get("subfolder") or ""
    return f"{subfolder}/{name}" if subfolder else name


def _substitute(raw: str, key: str, value) -> str:
    """Remplace UN placeholder quoté ("{{KEY}}") par la valeur JSON — chaîne
    complète (quotes réinsérées) ou nombre brut. None = no-op."""
    if value is None:
        return raw
    replacement = json.dumps(value) if isinstance(value, str) else str(value)
    return raw.replace(f'"{{{{{key}}}}}"', replacement)


def _load_workflow_file(path: str, values: dict) -> dict:
    """Charge un workflow exporté de ComfyUI (format API) et y injecte les
    valeurs — placeholders remplacés AVANT le parse JSON."""
    with open(path, "r", encoding="utf-8") as handle:
        raw = handle.read()
    raw = _substitute(raw, "PROMPT", values.get("prompt"))
    raw = _substitute(raw, "NEGATIVE", DEFAULT_NEGATIVE)
    raw = _substitute(raw, "IMAGE", values.get("image_name"))
    raw = _substitute(raw, "SEED", values.get("seed"))
    raw = _substitute(raw, "FRAMES", values.get("frames"))
    raw = _substitute(raw, "FPS", values.get("fps"))
    raw = _substitute(raw, "WIDTH", values.get("width"))
    raw = _substitute(raw, "HEIGHT", values.get("height"))
    return json.loads(raw)


def _default_workflow(values: dict) -> dict:
    """Graphe minimal img2img pour checkpoints style SD1.5/SDXL (une seule
    image d'entrée, dimensions conservées)."""
    return {
        "3": {
            "class_type": "KSampler",
            "inputs": {
                "seed": values["seed"],
                "steps": 25,
                "cfg": 6.5,
                "sampler_name": "euler",
                "scheduler": "normal",
                "denoise": _denoise_strength(),
                "model": ["4", 0],
                "positive": ["6", 0],
                "negative": ["7", 0],
                "latent_image": ["12", 0],
            },
        },
        "4": {"class_type": "CheckpointLoaderSimple", "inputs": {"ckpt_name": require_env("COMFYUI_CHECKPOINT")}},
        "6": {"class_type": "CLIPTextEncode", "inputs": {"text": values["prompt"], "clip": ["4", 1]}},
        "7": {"class_type": "CLIPTextEncode", "inputs": {"text": DEFAULT_NEGATIVE, "clip": ["4", 1]}},
        "10": {"class_type": "LoadImage", "inputs": {"image": values["image_name"]}},
        "12": {"class_type": "VAEEncode", "inputs": {"pixels": ["10", 0], "vae": ["4", 2]}},
        "13": {"class_type": "VAEDecode", "inputs": {"samples": ["3", 0], "vae": ["4", 2]}},
        "14": {"class_type": "SaveImage", "inputs": {"filename_prefix": "renderstudio", "images": ["13", 0]}},
    }


def _build_image_workflow(values: dict) -> dict:
    workflow_file = os.environ.get("COMFYUI_WORKFLOW_FILE")
    if not workflow_file:
        return _default_workflow(values)
    return _load_workflow_file(workflow_file, values)


def _execute_workflow(workflow: dict, timeout_ms: int) -> dict:
    """POST /prompt + polling /history jusqu'aux outputs (erreur/timeout =
    échec de la tentative -> le workflow bascule sur le candidat suivant)."""
    submit = post_json(f"{_base_url()}/prompt", {}, {"prompt": workflow})
    prompt_id = submit.get("prompt_id")
    if not prompt_id:
        raise ProviderError(f"comfyui: no prompt_id (node errors: {json.dumps(submit.get('node_errors') or {})})")

    def fetch_status():
        return get_json(f"{_base_url()}/history/{prompt_id}", {})

    def extract_done(history):
        entry = history.get(prompt_id) or {}
        status = entry.get("status") or {}
        if not status.get("completed"):
            return None
        return entry.get("outputs") or {}

    def extract_error(history):
        entry = history.get(prompt_id) or {}
        status = entry.get("status") or {}
        return "comfyui: execution error" if status.get("status_str") == "error" else None

    return poll_until_done(fetch_status, extract_done, extract_error, timeout_ms, interval_ms=2000)


def _first_file(outputs: dict, kinds: tuple[str, ...]) -> dict | None:
    """Premier fichier produit parmi les clés demandées (images pour
    img2img, gifs/videos pour i2v), dans l'ordre des nœuds de sortie."""
    for node_output in outputs.values():
        for kind in kinds:
            files = node_output.get(kind)
            if files and files[0].get("filename"):
                return {
                    "filename": files[0]["filename"],
                    "subfolder": files[0].get("subfolder") or "",
                    "type": files[0].get("type") or "output",
                }
    return None


def _fetch_view(file_info: dict) -> tuple[bytes, str]:
    """GET /view -> (octets, mime) du fichier produit."""
    return get_bytes(f"{_base_url()}/view?{urlencode(file_info)}")


def _random_seed() -> int:
    return random.randrange(2**32)


def _run_image_one(input_: dict, timeout_ms: int) -> str:
    workflow = _build_image_workflow(
        {
            "prompt": str(input_.get("prompt") or ""),
            "image_name": _upload_image(str(input_.get("image") or "")),
            "seed": _random_seed(),
        }
    )
    outputs = _execute_workflow(workflow, timeout_ms)
    image = _first_file(outputs, ("images",))
    if not image:
        raise ProviderError("comfyui: history completed without output image")
    data, mime = _fetch_view(image)
    if not mime.startswith("image/"):
        mime = "image/png"
    return f"data:{mime};base64,{base64.b64encode(data).decode()}"


def _run_video(input_: dict, timeout_ms: int) -> dict:
    """Vidéo img2video : une SEULE sortie mp4, écrite directement sur disque
    (storage.py) — une data URI vidéo serait trop lourde."""
    # require_env échoue vite AVANT l'upload si le workflow n'est pas configuré.
    workflow_file = require_env("COMFYUI_VIDEO_WORKFLOW_FILE")
    fps = _video_fps()
    try:
        duration = float(input_.get("duration") or 4)
    except (TypeError, ValueError):
        duration = 4
    frames = max(1, round(duration * fps))

    def _int_or_none(value):
        try:
            return int(value)
        except (TypeError, ValueError):
            return None

    workflow = _load_workflow_file(
        workflow_file,
        {
            "prompt": str(input_.get("prompt") or ""),
            "image_name": _upload_image(str(input_.get("image") or "")),
            "seed": _random_seed(),
            "frames": frames,
            "fps": fps,
            "width": _int_or_none(input_.get("width")),
            "height": _int_or_none(input_.get("height")),
        },
    )
    outputs = _execute_workflow(workflow, timeout_ms)
    video = _first_file(outputs, ("gifs", "videos"))
    if not video:
        raise ProviderError("comfyui: history completed without video output (gifs/videos)")
    data, _mime = _fetch_view(video)
    return {"video": {"url": storage.save_file(data, "mp4")}}


def generate(model_id: str, input_: dict, timeout_ms: int) -> dict:
    """Contrat provider : img2img -> {"images": [...]}, i2v -> {"video": ...}.
    Le model_id sert de garde-fou si le catalogue évolue."""
    if model_id == "i2v":
        return _run_video(input_, timeout_ms)
    if model_id != "img2img":
        raise ProviderError(f'comfyui: unsupported endpoint "{model_id}"')
    try:
        count = max(1, int(input_.get("quantity") or 1))
    except (TypeError, ValueError):
        count = 1
    # Séquentiel volontairement : le GPU local sature déjà sur une requête.
    urls = [_run_image_one(input_, timeout_ms) for _ in range(count)]
    return {"images": [{"url": url} for url in urls]}


# Alias publics réutilisés par providers/upscale.py (même package) — le
# schéma upload/prompt/history/view n'est PAS dupliqué pour l'upscale.
upload_image = _upload_image
load_workflow_file = _load_workflow_file
execute_workflow = _execute_workflow
first_file = _first_file
fetch_view = _fetch_view
random_seed = _random_seed
