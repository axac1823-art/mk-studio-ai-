"""Adaptateur ComfyUI local pour les workflows vidéo.

Le worker soumet un workflow API déjà exporté par ComfyUI, puis attend son
résultat dans `/history`. Les fichiers d'entrée sont chargés dans le dossier
`input` de ComfyUI et les sorties sont exposées via `/view`.

Env : COMFYUI_BASE_URL (défaut : http://127.0.0.1:8188) et
COMFYUI_WORKFLOW_PATH (optionnel, défaut : workflow MiniMax H3 du dépôt).
"""
from __future__ import annotations

import copy
import json
import mimetypes
import os
from pathlib import Path
from urllib.parse import urlencode
from uuid import uuid4

import httpx

import storage
from providers.http_helpers import ProviderError, get_bytes, get_json, poll_until_done, post_json, parse_data_uri

BASE_URL = os.environ.get("COMFYUI_BASE_URL", "http://127.0.0.1:8188").rstrip("/")
DEFAULT_WORKFLOW_PATH = Path(__file__).resolve().parents[2] / "video_minimax_h3_i2v.json"
WORKFLOW_PATH = os.environ.get("COMFYUI_WORKFLOW_PATH", str(DEFAULT_WORKFLOW_PATH))


def _load_workflow() -> dict:
    try:
        with open(WORKFLOW_PATH, encoding="utf-8") as workflow_file:
            return json.load(workflow_file)
    except (OSError, json.JSONDecodeError) as err:
        raise ProviderError(f"comfyui: cannot load workflow {WORKFLOW_PATH}: {err}") from err


def _input_bytes(uri: str) -> tuple[bytes, str, str]:
    parsed = parse_data_uri(uri)
    if parsed:
        mime, encoded = parsed
        import base64

        return base64.b64decode(encoded), mime, f"input-{uuid4().hex}.{mime.split('/')[-1]}"
    if uri.startswith("/storage/"):
        path = storage.resolve(uri)
        mime = mimetypes.guess_type(path.name)[0] or "image/png"
        return path.read_bytes(), mime, path.name
    content, mime = get_bytes(uri)
    return content, mime, f"input-{uuid4().hex}.{mime.split('/')[-1]}"


def _upload_image(uri: str) -> str:
    content, mime, filename = _input_bytes(uri)
    response = httpx.post(
        f"{BASE_URL}/upload/image",
        data={"overwrite": "true", "type": "input", "subfolder": ""},
        files={"image": (filename, content, mime)},
        timeout=60,
    )
    if response.status_code >= 400:
        raise ProviderError(f"comfyui image upload failed ({response.status_code}): {response.text[:300]}", response.status_code)
    uploaded = response.json()
    name = uploaded.get("name")
    if not name:
        raise ProviderError("comfyui image upload returned no filename")
    subfolder = uploaded.get("subfolder") or ""
    return f"{subfolder}/{name}" if subfolder else name


def _aspect_ratio_label(aspect_ratio: str) -> str:
    return {
        "1:1": "1:1 (Square)",
        "16:9": "16:9 (Landscape)",
        "9:16": "9:16 (Portrait)",
        "4:3": "4:3 (Landscape)",
        "3:4": "3:4 (Portrait)",
    }.get(aspect_ratio, "16:9 (Landscape)")


def build_workflow(input_: dict, image_filename: str) -> dict:
    """Injecte les champs normalisés dans le workflow MiniMax H3 exporté."""
    workflow = copy.deepcopy(_load_workflow())
    workflow["114"]["inputs"]["image"] = image_filename
    workflow["105:104"]["inputs"]["prompt"] = input_.get("prompt") or ""
    workflow["105:111"]["inputs"]["value"] = float(input_.get("durationSeconds") or 5)
    workflow["115"]["inputs"]["aspect_ratio"] = _aspect_ratio_label(input_.get("aspectRatio") or "16:9")
    return workflow


def _view_url(file_info: dict) -> str | None:
    filename = file_info.get("filename")
    if not filename:
        return None
    query = urlencode({
        "filename": filename,
        "subfolder": file_info.get("subfolder") or "",
        "type": file_info.get("type") or "output",
    })
    return f"{BASE_URL}/view?{query}"


def _extract_video_url(history: dict, prompt_id: str) -> str | None:
    record = history.get(prompt_id) or {}
    outputs = record.get("outputs") or {}
    for node_output in outputs.values():
        for key in ("videos", "gifs"):
            for file_info in node_output.get(key) or []:
                url = _view_url(file_info)
                if url:
                    return url
    return None


def _history_error(history: dict, prompt_id: str) -> str | None:
    record = history.get(prompt_id) or {}
    status = record.get("status") or {}
    if status.get("status_str") in {"error", "failed"}:
        return f"comfyui prompt failed: {status.get('messages') or status.get('status_str')}"
    return None


def generate(model_id: str, input_: dict, timeout_ms: int) -> dict:
    """Contrat provider : soumet le workflow et retourne une vidéo ComfyUI."""
    del model_id
    image_url = input_.get("imageUrl")
    if not image_url:
        raise ProviderError("comfyui: missing imageUrl")

    image_filename = _upload_image(image_url)
    submit = post_json(
        f"{BASE_URL}/prompt",
        {},
        {"prompt": build_workflow(input_, image_filename), "client_id": f"renderstudio-{uuid4().hex}"},
    )
    prompt_id = submit.get("prompt_id")
    if not prompt_id:
        raise ProviderError(f"comfyui prompt submission failed: {submit.get('error') or 'no prompt_id'}")

    def fetch_status():
        return get_json(f"{BASE_URL}/history/{prompt_id}", {})

    url = poll_until_done(
        fetch_status,
        lambda history: _extract_video_url(history, prompt_id),
        lambda history: _history_error(history, prompt_id),
        timeout_ms,
        interval_ms=2000,
    )
    return {"video": {"url": url}}
