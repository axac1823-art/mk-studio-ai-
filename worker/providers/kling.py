"""Adaptateur Kling (Kuaishou) — API officielle image-to-video.

Modèles servis : kling-v3, kling-v2-5-turbo et variants Seedance/3.0 du
 catalogue (les model_id sont transmis tels quels à l'API legacy).

Auth : JWT HS256. Seule KLING_SECRET_KEY est requise. Si KLING_ACCESS_KEY
est aussi renseignée, elle est utilisée comme claim `iss` ; sinon le
worker utilise KLING_SECRET_KEY pour les deux, ce qui suffit en dev.

Schéma legacy : POST /v1/videos/image2video avec { model_name, image,
image_tail?, multi_shot? } -> data.task_id ; puis polling
GET /v1/videos/image2video/{task_id}. Le format de réponse a évolué : on
accepte indifféremment data.task_status/data.task_result.videos (ancien) et
data.status/data.works[] (nouveau).

Env : KLING_SECRET_KEY (requis), KLING_ACCESS_KEY (optionnel).
"""
import base64
import hashlib
import hmac
import json
import os
import time

from providers.http_helpers import (
    ProviderError,
    get_json,
    poll_until_done,
    post_json,
    require_env,
    to_base64_or_url,
)

BASE_URL = "https://api.klingai.com"


def _b64url(raw: bytes) -> str:
    """Base64url SANS padding."""
    return base64.urlsafe_b64encode(raw).rstrip(b"=").decode()


def _sign_kling_token() -> str:
    """JWT HS256. `iss` = AccessKey quand disponible, sinon SecretKey."""
    secret_key = require_env("KLING_SECRET_KEY")
    access_key = os.environ.get("KLING_ACCESS_KEY") or secret_key
    now = int(time.time())
    header = _b64url(json.dumps({"alg": "HS256", "typ": "JWT"}, separators=(",", ":")).encode())
    payload = _b64url(
        json.dumps({"iss": access_key, "exp": now + 1800, "nbf": now - 5}, separators=(",", ":")).encode()
    )
    signature = _b64url(hmac.new(secret_key.encode(), f"{header}.{payload}".encode(), hashlib.sha256).digest())
    return f"{header}.{payload}.{signature}"


def generate(model_id: str, input_: dict, timeout_ms: int) -> dict:
    """Contrat provider : {"video": {"url": ...}}.

    `input_` provient du build_input du catalogue (legacy Kling) et contient
    au minimum `image`. L'API legacy n'accepte que model_name, image,
    image_tail et multi_shot : prompt/durée/ratio sont déduits de l'image.
    """

    def headers():
        # Token régénéré à chaque appel : le polling peut dépasser la
        # validité d'un jeton frais sur les longues files d'attente.
        return {"Authorization": f"Bearer {_sign_kling_token()}"}

    image = input_.get("image")
    if not image:
        raise ProviderError("kling: missing image")

    payload: dict = {"model_name": model_id, "image": image}
    if input_.get("image_tail"):
        payload["image_tail"] = input_["image_tail"]

    submit = post_json(f"{BASE_URL}/v1/videos/image2video", headers(), payload)
    task_id = (submit.get("data") or {}).get("task_id")
    if submit.get("code") != 0 or not task_id:
        raise ProviderError(f"kling submit failed: {submit.get('message') or 'no task_id'}")

    def fetch_status():
        status = get_json(f"{BASE_URL}/v1/videos/image2video/{task_id}", headers())
        if status.get("code") != 0:
            raise ProviderError(f"kling poll failed: {status.get('message') or 'unknown'}")
        return status

    def _extract_url(task: dict) -> str | None:
        # Ancien format.
        if task.get("task_status") == "succeed":
            videos = (task.get("task_result") or {}).get("videos") or []
            return videos[0].get("url") if videos else None
        # Nouveau format : works[] avec type == video.
        if task.get("status") == "succeed":
            works = task.get("works") or []
            for work in works:
                if work.get("type") == "video":
                    return work.get("url")
        return None

    def extract_done(status):
        task = status.get("data") or {}
        url = _extract_url(task)
        if url:
            return url
        return None

    def extract_error(status):
        task = status.get("data") or {}
        # Ancien format.
        if task.get("task_status") == "failed":
            return f"kling task failed: {task.get('task_status_msg') or 'unknown'}"
        # Nouveau format.
        state = task.get("status")
        if state == "failed":
            return f"kling task failed: {task.get('message') or task.get('task_status_msg') or 'unknown'}"
        return None

    video_url = poll_until_done(fetch_status, extract_done, extract_error, timeout_ms, interval_ms=5000)
    return {"video": {"url": video_url}}
