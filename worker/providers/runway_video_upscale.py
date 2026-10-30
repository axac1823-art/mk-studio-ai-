"""Runway Dev adapter for Magnific Video Upscaler (API version 2024-11-06)."""
import os
import time
from pathlib import Path

import httpx

from providers.http_helpers import ProviderError

BASE_URL = "https://api.dev.runwayml.com"
API_VERSION = "2024-11-06"
MODEL = "magnific_video_upscaler_creative"


def _headers():
    key = os.environ.get("RUNWAYML_API_SECRET") or os.environ.get("RUNWAY_API_KEY")
    if not key:
        raise ProviderError("provider not configured: missing RUNWAYML_API_SECRET")
    return {"Authorization": f"Bearer {key}", "X-Runway-Version": API_VERSION}


def _check(response):
    if response.is_error:
        # Keep diagnostics server-side but avoid echoing provider payloads to the client.
        raise ProviderError(f"Runway request failed ({response.status_code})", response.status_code)
    return response.json()


def upscale(path: Path, options: dict, timeout_s: int = 3600) -> dict:
    headers = _headers()
    with httpx.Client(timeout=120, follow_redirects=True) as client:
        upload = _check(client.post(f"{BASE_URL}/v1/uploads", headers={**headers, "Content-Type": "application/json"}, json={"filename": path.name, "type": "ephemeral"}))
        form = dict(upload.get("fields") or {})
        with path.open("rb") as source:
            response = client.post(upload["uploadUrl"], data=form, files={"file": (path.name, source, "video/mp4")}, timeout=300)
        if response.is_error:
            raise ProviderError(f"Runway upload failed ({response.status_code})", response.status_code)
        payload = {"model": MODEL, "videoUri": upload["runwayUri"], **options}
        task = _check(client.post(f"{BASE_URL}/v1/video_upscale", headers={**headers, "Content-Type": "application/json"}, json=payload))
        task_id = task.get("id")
        if not task_id:
            raise ProviderError("Runway did not return a task ID")
        deadline = time.monotonic() + timeout_s
        while time.monotonic() < deadline:
            status = _check(client.get(f"{BASE_URL}/v1/tasks/{task_id}", headers=headers))
            state = status.get("status")
            if state == "SUCCEEDED":
                output = status.get("output") or []
                if not output or not isinstance(output[0], str):
                    raise ProviderError("Runway task completed without a video output")
                return {"url": output[0], "task_id": task_id}
            if state in ("FAILED", "CANCELLED", "THROTTLED"):
                raise ProviderError(f"Runway task {state.lower()}")
            time.sleep(5)
    raise ProviderError("Runway task polling timed out")
