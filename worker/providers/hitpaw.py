"""HitPaw's official Video Enhancement API adapter.

HitPaw accepts a remotely retrievable source URL, so local worker assets are
first uploaded through its signed OSS flow; no public tunnel is required.
"""
import mimetypes
import os
import time
from pathlib import Path

import httpx

from providers.http_helpers import ProviderError, require_env

BASE_URL = "https://api-base.hitpaw.com"
SUPPORTED_RESOLUTIONS = {"720p": 1280, "1080p": 1920, "1440p": 2560, "4k": 3840}
MAX_INPUT_BYTES = 500 * 1024 * 1024
MAX_PIXELS = 36_000_000


def is_configured() -> bool:
    return bool(os.environ.get("HITPAW_API_KEY"))


def _headers() -> dict[str, str]:
    return {"Apikey": require_env("HITPAW_API_KEY"), "Content-Type": "application/json"}


def _payload(response: httpx.Response, operation: str) -> dict:
    if response.status_code >= 400:
        raise ProviderError(
            f"HitPaw {operation} failed ({response.status_code}): {response.text[:300]}",
            response.status_code,
        )
    try:
        payload = response.json()
    except ValueError as exc:
        raise ProviderError(f"HitPaw {operation}: invalid JSON response") from exc
    if not isinstance(payload, dict):
        raise ProviderError(f"HitPaw {operation}: invalid response")
    code = payload.get("code", payload.get("error_code", 0))
    if code not in (0, 200, "0", "200"):
        raise ProviderError(
            f"HitPaw {operation} failed ({code}): {str(payload.get('message') or payload)[:300]}",
            402 if str(code) in {"110402000", "110402001", "110402004"} else None,
        )
    return payload


def _data(payload: dict) -> dict:
    data = payload.get("data")
    return data if isinstance(data, dict) else payload


def _target_dimensions(width: int, height: int, resolution: str) -> tuple[int, int]:
    if resolution not in SUPPORTED_RESOLUTIONS:
        raise ValueError("HitPaw supports 720p, 1080p, 1440p, and 4K output.")
    if width <= 0 or height <= 0:
        raise ValueError("Could not read the source video's dimensions.")
    if width * height > MAX_PIXELS:
        raise ValueError("HitPaw input is limited to 36 megapixels.")
    scale = SUPPORTED_RESOLUTIONS[resolution] / max(width, height)
    out_width = max(2, round(width * scale / 2) * 2)
    out_height = max(2, round(height * scale / 2) * 2)
    if out_width * out_height > MAX_PIXELS:
        raise ValueError("HitPaw output is limited to 36 megapixels.")
    return out_width, out_height


def _restore_model(width: int, height: int, target_width: int, target_height: int) -> str:
    scale = max(target_width / width, target_height / height)
    if scale <= 1:
        return "general_restore_1x"
    if scale <= 2:
        return "general_restore_2x"
    return "general_restore_4x"


def upscale(
    path: str,
    resolution: str,
    original_width: int,
    original_height: int,
    timeout_s: int = 3600,
) -> dict:
    """Upload a local video, submit enhancement, and poll until it completes."""
    source = Path(path)
    size = source.stat().st_size
    if size <= 0 or size > MAX_INPUT_BYTES:
        raise ValueError("HitPaw accepts source videos up to 500 MB.")
    target_width, target_height = _target_dimensions(original_width, original_height, resolution)
    model = _restore_model(original_width, original_height, target_width, target_height)
    extension = source.suffix.lower() or ".mp4"
    content_type = mimetypes.guess_type(source.name)[0] or "video/mp4"
    headers = _headers()

    with httpx.Client(timeout=300) as client:
        presign_response = client.post(
            f"{BASE_URL}/api/oss/presign-put",
            headers=headers,
            json={"filename": f"source{extension}", "content_type": content_type, "expire_seconds": 3600},
        )
        presign = _data(_payload(presign_response, "presign upload"))
        upload_url = presign.get("upload_url")
        access_url = presign.get("access_url")
        upload_type = presign.get("content_type") or content_type
        if not isinstance(upload_url, str) or not isinstance(access_url, str):
            raise ProviderError("HitPaw presign upload: missing upload_url or access_url")

        with source.open("rb") as video_file:
            upload_response = client.put(
                upload_url,
                headers={"Content-Type": upload_type},
                content=video_file,
            )
        if upload_response.status_code >= 400:
            raise ProviderError(
                f"HitPaw source upload failed ({upload_response.status_code}): {upload_response.text[:300]}",
                upload_response.status_code,
            )

        submitted = _data(_payload(client.post(
            f"{BASE_URL}/api/video-enhancer",
            headers=headers,
            json={
                "video_url": access_url,
                "model_name": model,
                "resolution": [target_width, target_height],
                "extension": extension,
                "original_resolution": [original_width, original_height],
            },
        ), "submit"))
        job_id = submitted.get("job_id")
        if not isinstance(job_id, str) or not job_id:
            raise ProviderError("HitPaw submit: missing job_id")

        deadline = time.monotonic() + timeout_s
        while time.monotonic() < deadline:
            status_payload = _data(_payload(client.post(
                f"{BASE_URL}/api/task-status",
                headers=headers,
                json={"job_id": job_id},
            ), "poll"))
            state = str(status_payload.get("status") or "").upper()
            if state == "COMPLETED":
                output_url = status_payload.get("res_url")
                if not isinstance(output_url, str) or not output_url.startswith(("https://", "http://")):
                    raise ProviderError("HitPaw completed task has no output video URL")
                return {"url": output_url, "task_id": job_id, "model": model}
            if state == "ERROR":
                reason = status_payload.get("message") or status_payload.get("error") or state
                raise ProviderError(f"HitPaw task failed: {str(reason)[:300]}")
            if state != "CONVERTING":
                raise ProviderError(f"HitPaw returned an unknown task status: {state or 'empty'}")
            time.sleep(8)

    raise ProviderError(f"HitPaw task timed out after {timeout_s} seconds")
