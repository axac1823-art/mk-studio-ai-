"""Everypixel Labs video upscaling adapter.

Everypixel accepts video data URIs on its JSON Video Upscale API. Sending the
worker's local file inline avoids requiring a public storage URL or tunnel.
"""
import base64
import mimetypes
import os
import time

import httpx

from providers.http_helpers import ProviderError, require_env

BASE_URL = "https://api.everypixel.com/v1"
MODEL = "topaz-prob-4"
SUPPORTED_RESOLUTIONS = {"720p", "1080p", "1440p", "4k"}
MAX_INPUT_BYTES = 500 * 1024 * 1024


def is_configured() -> bool:
    return bool(os.environ.get("EVERYPIXEL_CLIENT_ID") and os.environ.get("EVERYPIXEL_CLIENT_SECRET"))


def _credentials() -> tuple[str, str]:
    return (
        require_env("EVERYPIXEL_CLIENT_ID"),
        require_env("EVERYPIXEL_CLIENT_SECRET"),
    )


def _json_response(response: httpx.Response, operation: str) -> dict:
    if response.status_code >= 400:
        raise ProviderError(
            f"everypixel {operation} failed ({response.status_code}): {response.text[:300]}",
            response.status_code,
        )
    try:
        payload = response.json()
    except ValueError as exc:
        raise ProviderError(f"everypixel {operation}: invalid JSON response") from exc
    if not isinstance(payload, dict):
        raise ProviderError(f"everypixel {operation}: invalid response")
    return payload


def upscale(path: str, resolution: str, timeout_s: int = 3600) -> dict:
    """Submit a Topaz Proteus upscale from a local video and poll its result."""
    if resolution not in SUPPORTED_RESOLUTIONS:
        raise ValueError("Everypixel supports 720p, 1080p, 1440p, and 4K output.")

    size = os.path.getsize(path)
    if size <= 0 or size > MAX_INPUT_BYTES:
        raise ValueError("Everypixel accepts source videos up to 500 MB.")

    mime_type = mimetypes.guess_type(path)[0] or "video/mp4"
    with open(path, "rb") as video:
        encoded = base64.b64encode(video.read()).decode("ascii")
    video_data_uri = f"data:{mime_type};base64,{encoded}"

    response = httpx.post(
        f"{BASE_URL}/video_upscale",
        auth=_credentials(),
        json={"video_url": video_data_uri, "model": MODEL, "resolution": resolution},
        timeout=300,
    )
    task = _json_response(response, "submit")
    task_id = task.get("task_id")
    if not isinstance(task_id, str) or not task_id:
        raise ProviderError("everypixel submit: no task_id in response")

    deadline = time.monotonic() + timeout_s
    while time.monotonic() < deadline:
        response = httpx.get(
            f"{BASE_URL}/status",
            params={"task_id": task_id},
            timeout=30,
        )
        status = _json_response(response, "poll")
        state = str(status.get("status") or "").upper()
        if state == "SUCCESS":
            result = status.get("result")
            if isinstance(result, dict):
                result = result.get("url")
            if not isinstance(result, str) or not result.startswith(("https://", "http://", "data:")):
                raise ProviderError("everypixel completed task has no output video")
            return {"url": result, "task_id": task_id}
        if state in {"FAILURE", "REVOKED"}:
            reason = status.get("error") or status.get("message") or state
            raise ProviderError(f"everypixel task failed: {str(reason)[:300]}")
        time.sleep(5)

    raise ProviderError(f"everypixel task timed out after {timeout_s} seconds")
