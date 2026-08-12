"""Adaptateur Runway — API officielle (port de runway.ts).

Modèle servi : gen4_turbo (image->vidéo).

Schéma : POST /v1/image_to_video (Bearer + header de version
`X-Runway-Version`) -> { id }, puis polling GET /v1/tasks/{id}
-> status "SUCCEEDED" -> output[0] (URL).

Env : RUNWAY_API_KEY (https://dev.runwayml.com) — lue à l'appel, jamais à
l'import (échec vite -> fallback).
"""
from providers.http_helpers import (
    ProviderError,
    get_json,
    poll_until_done,
    post_json,
    require_env,
)

BASE_URL = "https://api.dev.runwayml.com"
# Version d'API requise par Runway dans un header dédié.
API_VERSION = "2024-11-06"


def _headers() -> dict:
    return {
        "Authorization": f"Bearer {require_env('RUNWAY_API_KEY')}",
        "X-Runway-Version": API_VERSION,
    }


def generate(model_id: str, input_: dict, timeout_ms: int) -> dict:
    """Contrat provider : {"video": {"url": ...}}."""
    task = post_json(f"{BASE_URL}/v1/image_to_video", _headers(), {"model": model_id, **input_})
    task_id = task.get("id")
    if not task_id:
        raise ProviderError("runway: no task id in submit response")

    def fetch_status():
        return get_json(f"{BASE_URL}/v1/tasks/{task_id}", _headers())

    def extract_done(status):
        output = status.get("output") or []
        return output[0] if status.get("status") == "SUCCEEDED" and output else None

    def extract_error(status):
        state = status.get("status")
        if state == "FAILED":
            return f"runway task failed: {status.get('failure') or 'unknown'}"
        if state in ("THROTTLED", "CANCELLED"):
            return f"runway task {state.lower()}: {status.get('failure') or status.get('estimatedCost') or 'unknown'}"
        return None

    video_url = poll_until_done(fetch_status, extract_done, extract_error, timeout_ms, interval_ms=5000)
    return {"video": {"url": video_url}}
