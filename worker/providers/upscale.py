"""Provider upscale — liste de fallback EN CONFIG (env UPSCALE_PROVIDERS,
défaut "comfyui,magichour"), même philosophie que le routeur de génération :
chaque candidat échoue VITE, le suivant prend le relais.

Candidats :
- "comfyui" : workflow custom (Real-ESRGAN, Ultimate SD Upscale...) pointé
  par COMFYUI_UPSCALE_WORKFLOW_FILE — placeholders "{{IMAGE}}", "{{PROMPT}}"
  (VIDE quand enhance est off : upscale pur), "{{NEGATIVE}}", "{{SEED}}".
  Le facteur 2x/4x est câblé dans le graphe (modèle chargé) ;
- "magichour" : AI Image Upscaler de l'agrégateur assumé (AGENTS.md §1).
  ⚠️ endpoint/payload à VÉRIFIER dans la doc Magic Hour à l'intégration —
  un rejet échoue vite et le fallback bascule (le coût d'appel reste réel).

Interface différente des autres providers : upscale(input, timeout_ms) —
l'upscale n'est pas un candidat du catalogue, c'est une action dédiée.
"""
import base64
import os

import httpx

from providers import comfyui
from providers.http_helpers import (
    ProviderError,
    get_json,
    parse_data_uri,
    poll_until_done,
    post_json,
    require_env,
)

UPSCALE_TIMEOUT_MS = 10 * 60 * 1000
DEFAULT_PROVIDERS = "comfyui,magichour"

_MAGICHOUR_BASE = "https://api.magichour.ai"


def _configured_providers() -> list[str]:
    raw = os.environ.get("UPSCALE_PROVIDERS", DEFAULT_PROVIDERS)
    return [name.strip() for name in raw.split(",") if name.strip()]


def is_configured() -> bool:
    """Au moins un candidat upscale configuré (la route /upscale refuse en
    503 sinon — même garde-fou que pour la génération)."""
    names = _configured_providers()
    return ("comfyui" in names and bool(os.environ.get("COMFYUI_UPSCALE_WORKFLOW_FILE"))) or (
        "magichour" in names and bool(os.environ.get("MAGIC_HOUR_API_KEY"))
    )


def _upscale_comfyui(input_: dict, timeout_ms: int) -> dict:
    """Upscale local via workflow custom — gratuit, hors-ligne. Requiert
    COMFYUI_UPSCALE_WORKFLOW_FILE (échec vite AVANT tout upload sinon)."""
    workflow_file = require_env("COMFYUI_UPSCALE_WORKFLOW_FILE")
    enhance = bool(input_.get("enhance"))
    workflow = comfyui.load_workflow_file(
        workflow_file,
        {
            # enhance on -> passe de détail guidée prompt ; off -> texte vide
            # (upscale "pur", type Real-ESRGAN seul).
            "prompt": "high quality architectural photography, sharp clean details" if enhance else "",
            "image_name": comfyui.upload_image(str(input_.get("image") or "")),
            "seed": comfyui.random_seed(),
        },
    )
    outputs = comfyui.execute_workflow(workflow, timeout_ms)
    image = comfyui.first_file(outputs, ("images",))
    if not image:
        raise ProviderError("comfyui upscale: history completed without output image")
    data, mime = comfyui.fetch_view(image)
    if not mime.startswith("image/"):
        mime = "image/png"
    return {"images": [{"url": f"data:{mime};base64,{base64.b64encode(data).decode()}"}]}


def _magichour_upload(data_uri: str, api_key: str) -> str:
    """Verse une data URI chez Magic Hour (upload-urls -> PUT) -> file_path
    — même flow que providers/magichour.py."""
    parsed = parse_data_uri(data_uri)
    if not parsed:
        # Une URL http passe telle quelle (Magic Hour la télécharge).
        return data_uri
    mime, data = parsed
    ext = mime.split("/")[1] if "/" in mime else "png"
    upload = post_json(
        f"{_MAGIC_HOUR_BASE}/v1/files/upload-urls",
        {"x-api-key": api_key},
        {"items": [{"extension": ext}]},
    )
    item = (upload.get("items") or [{}])[0]
    upload_url, file_path = item.get("upload_url"), item.get("file_path")
    if not upload_url or not file_path:
        raise ProviderError("magichour upscale: no upload url")
    response = httpx.put(
        upload_url,
        content=base64.b64decode(data),
        headers={"Content-Type": mime},
        timeout=120,
        follow_redirects=True,
    )
    if response.status_code >= 400:
        raise ProviderError(f"magichour upload failed ({response.status_code})", response.status_code)
    return file_path


def _upscale_magichour(input_: dict, timeout_ms: int) -> dict:
    """Magic Hour image upscaler — ⚠️ endpoint/payload à VÉRIFIER à
    l'intégration (rejet -> échec vite -> fallback comfyui)."""
    api_key = require_env("MAGIC_HOUR_API_KEY")
    file_path = _magichour_upload(str(input_.get("image") or ""), api_key)
    submit = post_json(
        f"{_MAGIC_HOUR_BASE}/v1/ai-image-upscaler",
        {"x-api-key": api_key},
        {
            "image": file_path,
            "upscale_factor": int(input_.get("factor") or 2),
            "enhance": bool(input_.get("enhance")),
        },
    )
    project_id = submit.get("id")
    if not project_id:
        raise ProviderError(f"magichour upscale: no project id in response ({submit})")

    def fetch_status():
        return get_json(f"{_MAGIC_HOUR_BASE}/v1/image-projects/{project_id}", {"x-api-key": api_key})

    def extract_done(status):
        if status.get("status") == "complete":
            downloads = status.get("downloads") or []
            if downloads and downloads[0].get("url"):
                return downloads[0]["url"]
            raise ProviderError("magichour upscale: complete without download")
        return None

    def extract_error(status):
        return status.get("status") if status.get("status") in ("error", "canceled") else None

    url = poll_until_done(fetch_status, extract_done, extract_error, timeout_ms, interval_ms=3000)
    return {"images": [{"url": url}]}


def upscale(input_: dict, timeout_ms: int = UPSCALE_TIMEOUT_MS) -> dict:
    """Essaie les candidats dans l'ordre de UPSCALE_PROVIDERS jusqu'au
    premier succès — toute erreur déclenche la bascule (comme le routeur)."""
    errors: list[str] = []
    for name in _configured_providers():
        try:
            if name == "comfyui":
                return _upscale_comfyui(input_, timeout_ms)
            if name == "magichour":
                return _upscale_magichour(input_, timeout_ms)
        except Exception as err:  # noqa: BLE001 — toute erreur = fallback
            errors.append(f"{name}: {err}")
    if not errors:
        raise ProviderError("upscale: no provider in UPSCALE_PROVIDERS")
    raise ProviderError("upscale failed — " + " | ".join(errors))
