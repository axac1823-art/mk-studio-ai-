"""Adaptateur Kling (Kuaishou) — API officielle (port de kling.ts).

Modèles servis : kling-v3, kling-v2-5-turbo (image->vidéo).

Auth : JWT HS256 signé avec la SecretKey seule (généré ici via hmac, sans
dépendance) ; le claim `iss` porte la même clé.
Schéma : POST /v1/videos/image2video -> data.task_id, puis polling
GET /v1/videos/image2video/{task_id} -> data.task_status "succeed"
-> data.task_result.videos[0].url.

Env : KLING_SECRET_KEY (console développeur Kling) — lue à l'appel, jamais
à l'import (échec vite -> fallback).
"""
import base64
import hashlib
import hmac
import json
import time

from providers.http_helpers import (
    ProviderError,
    get_json,
    poll_until_done,
    post_json,
    require_env,
)

BASE_URL = "https://api.klingai.com"


def _b64url(raw: bytes) -> str:
    """Base64url SANS padding, comme l'encodage `base64url` de Node."""
    return base64.urlsafe_b64encode(raw).rstrip(b"=").decode()


def _sign_kling_token() -> str:
    """JWT HS256 tel qu'attendu par l'API Kling (iss = SecretKey, signé avec
    la même clé, validité 30 min)."""
    secret_key = require_env("KLING_SECRET_KEY")
    now = int(time.time())
    header = _b64url(json.dumps({"alg": "HS256", "typ": "JWT"}, separators=(",", ":")).encode())
    payload = _b64url(
        json.dumps({"iss": secret_key, "exp": now + 1800, "nbf": now - 5}, separators=(",", ":")).encode()
    )
    signature = _b64url(hmac.new(secret_key.encode(), f"{header}.{payload}".encode(), hashlib.sha256).digest())
    return f"{header}.{payload}.{signature}"


def generate(model_id: str, input_: dict, timeout_ms: int) -> dict:
    """Contrat provider : {"video": {"url": ...}}. Le model_id part dans
    `model_name` (le catalogue choisit la version de Kling)."""

    def headers():
        # Token régénéré à chaque appel : le polling peut dépasser la
        # validité d'un jeton frais sur les longues files d'attente.
        return {"Authorization": f"Bearer {_sign_kling_token()}"}

    submit = post_json(f"{BASE_URL}/v1/videos/image2video", headers(), {"model_name": model_id, **input_})
    task_id = (submit.get("data") or {}).get("task_id")
    if submit.get("code") != 0 or not task_id:
        raise ProviderError(f"kling submit failed: {submit.get('message') or 'no task_id'}")

    def fetch_status():
        status = get_json(f"{BASE_URL}/v1/videos/image2video/{task_id}", headers())
        if status.get("code") != 0:
            raise ProviderError(f"kling poll failed: {status.get('message') or 'unknown'}")
        return status

    def extract_done(status):
        task = status.get("data") or {}
        if task.get("task_status") != "succeed":
            return None
        videos = (task.get("task_result") or {}).get("videos") or []
        url = videos[0].get("url") if videos else None
        if not url:
            raise ProviderError("kling: task succeeded without video url")
        return url

    def extract_error(status):
        task = status.get("data") or {}
        if task.get("task_status") == "failed":
            return f"kling task failed: {task.get('task_status_msg') or 'unknown'}"
        return None

    video_url = poll_until_done(fetch_status, extract_done, extract_error, timeout_ms, interval_ms=5000)
    return {"video": {"url": video_url}}
