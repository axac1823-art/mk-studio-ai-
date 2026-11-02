"""Adaptateur Topaz Labs Video API utilisé pour les essais Video Upscaler."""
import os
import time
from pathlib import Path

import httpx

from providers.http_helpers import ProviderError, require_env

BASE_URL = "https://api.topazlabs.com/video"
MAX_TEST_FILE_BYTES = 100 * 1024 * 1024
POLL_INTERVAL_SECONDS = 5


def is_configured() -> bool:
    return bool(os.environ.get("TOPAZ_API_KEY"))


def _headers() -> dict[str, str]:
    return {"X-API-Key": require_env("TOPAZ_API_KEY"), "Accept": "application/json"}


def _json(response: httpx.Response, operation: str) -> dict:
    if response.status_code >= 400:
        raise ProviderError(
            f"Topaz {operation} failed ({response.status_code}): {response.text[:300]}",
            response.status_code,
        )
    try:
        payload = response.json()
    except ValueError as exc:
        raise ProviderError(f"Topaz {operation}: invalid JSON response") from exc
    if not isinstance(payload, dict):
        raise ProviderError(f"Topaz {operation}: invalid response")
    return payload


def upscale(
    path: str,
    resolution: str,
    width: int,
    height: int,
    duration: float,
    frame_rate: float,
    frame_count: int,
    timeout_s: int = 1800,
) -> dict:
    """Submit a small MP4 test clip, upload it, poll Topaz, and return its URL."""
    source = Path(path)
    if source.suffix.lower() != ".mp4":
        raise ValueError("Topaz test provider currently accepts MP4 source videos only.")
    size = source.stat().st_size
    if size <= 0 or size > MAX_TEST_FILE_BYTES:
        raise ValueError("Topaz test provider accepts MP4 files up to 100 MB.")
    if resolution not in {"720p", "1080p"}:
        raise ValueError("Topaz test provider supports 720p or 1080p output.")
    if width <= 0 or height <= 0 or duration <= 0 or frame_rate <= 0 or frame_count <= 0:
        raise ValueError("Could not read the source video's technical information.")

    target_long_edge = {"720p": 1280, "1080p": 1920}[resolution]
    scale = target_long_edge / max(width, height)
    output_width = max(2, round(width * scale / 2) * 2)
    output_height = max(2, round(height * scale / 2) * 2)
    headers = _headers()
    timeout = httpx.Timeout(connect=30, read=timeout_s, write=timeout_s, pool=30)

    with httpx.Client(timeout=timeout, follow_redirects=True) as client:
        created = _json(client.post(
            f"{BASE_URL}/",
            headers={**headers, "Content-Type": "application/json"},
            json={
                "source": {
                    "resolution": {"width": width, "height": height},
                    "container": "mp4",
                    "size": size,
                    "duration": duration,
                    "frameRate": frame_rate,
                    "frameCount": frame_count,
                },
                "filters": [{"model": "prob-4", "auto": "Auto"}],
                "output": {
                    "resolution": {"width": output_width, "height": output_height},
                    "audioTransfer": "Copy",
                    "audioCodec": "AAC",
                    "frameRate": frame_rate,
                    "dynamicCompressionLevel": "High",
                    "container": "mp4",
                },
            },
        ), "request")
        request_id = created.get("requestId")
        if not isinstance(request_id, str) or not request_id:
            raise ProviderError("Topaz request: missing requestId")

        accepted = _json(client.patch(f"{BASE_URL}/{request_id}/accept", headers=headers), "accept")
        upload_urls = accepted.get("urls")
        if not isinstance(upload_urls, list) or len(upload_urls) != 1 or not isinstance(upload_urls[0], str):
            raise ProviderError("Topaz test provider expected one upload URL for this small test clip")

        with source.open("rb") as video_file:
            uploaded = client.put(
                upload_urls[0],
                content=video_file,
                headers={"Content-Type": "video/mp4"},
            )
        if uploaded.status_code >= 400:
            raise ProviderError(f"Topaz upload failed ({uploaded.status_code}): {uploaded.text[:300]}", uploaded.status_code)
        etag = uploaded.headers.get("ETag")
        if not etag:
            raise ProviderError("Topaz upload response did not include an ETag")

        _json(client.patch(
            f"{BASE_URL}/{request_id}/complete-upload/",
            headers={**headers, "Content-Type": "application/json"},
            json={"uploadResults": [{"partNum": 1, "eTag": etag}]},
        ), "complete upload")

        deadline = time.monotonic() + timeout_s
        while time.monotonic() < deadline:
            time.sleep(POLL_INTERVAL_SECONDS)
            status = _json(client.get(f"{BASE_URL}/{request_id}/status", headers=headers), "status")
            state = str(status.get("status") or "").lower()
            if state == "complete":
                download = status.get("download")
                url = download.get("url") if isinstance(download, dict) else None
                if isinstance(url, str) and url.startswith(("https://", "http://")):
                    return {"url": url, "task_id": request_id, "model": "prob-4"}
                raise ProviderError("Topaz completed task has no download URL")
            if state in {"failed", "canceled", "cancelled"}:
                raise ProviderError(f"Topaz task {state}: {str(status)[:300]}")

    raise ProviderError(f"Topaz task timed out after {timeout_s} seconds")
