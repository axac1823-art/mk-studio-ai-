"""Audit interne des providers — un seul point de vérité pour vérifier
quels providers sont configurés, si leurs appels réussissent, et combien
ils coûtent / combien de temps ils prennent.

Usage (dry-run, sans appels payants):
    cd worker && ./.venv/Scripts/python scripts/audit_providers.py

Usage (tests réels, un appel par provider configuré):
    cd worker && ./.venv/Scripts/python scripts/audit_providers.py --live

Le script est volontairement explicite : il n'utilise PAS les workflows,
il appelle chaque adaptateur provider directement avec une entrée minimale.
"""
import argparse
import base64
import io
import json
import os
import sys
import time
from pathlib import Path

# Permet d'importer `providers` depuis worker/scripts.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from catalog import Candidate, MODEL_CATALOG, list_feature_models
from providers import PROVIDERS, is_provider_configured
from providers.http_helpers import ProviderError

# Petit carré PNG 1x1 transparent en data URI.
_TINY_PNG = (
    "data:image/png;base64,"
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="
)


def _tiny_image_url() -> str:
    return _TINY_PNG


def _audit_image_provider(provider_name: str, model_id: str, cost: int, live: bool) -> dict:
    status = {"provider": provider_name, "model": model_id, "configured": is_provider_configured(provider_name)}
    if not status["configured"]:
        status["result"] = "SKIPPED (not configured)"
        return status
    if not live:
        status["result"] = "DRY_RUN (use --live to test)"
        return status

    started = time.monotonic()
    try:
        module = PROVIDERS[provider_name]
        # Entrée normalisée minimale pour tous les providers image.
        result = module.generate(
            model_id,
            {
                "prompt": "a tiny red cube on a white background, product photo",
                "imageUrl": _tiny_image_url(),
                "referenceUrls": [],
                "quantity": 1,
                "aspectRatio": "1:1",
                "resolution": "1K",
                "quality": "standard",
            },
            180_000,
        )
        latency_ms = int((time.monotonic() - started) * 1000)
        images = result.get("images") or []
        urls = [img.get("url") for img in images if isinstance(img, dict) and img.get("url")]
        status["latency_ms"] = latency_ms
        status["cost_cents"] = cost
        status["result"] = "PASS" if urls else "FAIL (empty output)"
        status["outputs"] = len(urls)
    except Exception as err:
        status["latency_ms"] = int((time.monotonic() - started) * 1000)
        status["result"] = f"FAIL ({err.__class__.__name__}: {str(err)[:120]})"
    return status


def _audit_video_provider(provider_name: str, model_id: str, cost: int, live: bool) -> dict:
    status = {"provider": provider_name, "model": model_id, "configured": is_provider_configured(provider_name)}
    if not status["configured"]:
        status["result"] = "SKIPPED (not configured)"
        return status
    if not live:
        status["result"] = "DRY_RUN (use --live to test)"
        return status

    started = time.monotonic()
    try:
        module = PROVIDERS[provider_name]
        result = module.generate(
            model_id,
            {
                "prompt": "slowly rotating cube on white background",
                "imageUrl": _tiny_image_url(),
                "referenceUrls": [],
                "durationSeconds": 4,
                "aspectRatio": "16:9",
                "quality": "standard",
                "quantity": 1,
            },
            600_000,
        )
        latency_ms = int((time.monotonic() - started) * 1000)
        video = result.get("video") or {}
        url = video.get("url") if isinstance(video, dict) else None
        status["latency_ms"] = latency_ms
        status["cost_cents"] = cost
        status["result"] = "PASS" if url else "FAIL (empty output)"
        status["outputs"] = 1 if url else 0
    except Exception as err:
        status["latency_ms"] = int((time.monotonic() - started) * 1000)
        status["result"] = f"FAIL ({err.__class__.__name__}: {str(err)[:120]})"
    return status


def _audit_audio_provider(live: bool) -> dict:
    provider_name = "elevenlabs"
    status = {"provider": provider_name, "model": "eleven_multilingual_v2", "configured": is_provider_configured(provider_name)}
    if not status["configured"]:
        status["result"] = "SKIPPED (not configured)"
        return status
    if not live:
        status["result"] = "DRY_RUN (use --live to test)"
        return status

    started = time.monotonic()
    try:
        result = PROVIDERS[provider_name].generate({"text": "Hello, this is a test."}, timeout_s=60)
        latency_ms = int((time.monotonic() - started) * 1000)
        audio = result.get("audio") or {}
        url = audio.get("url") if isinstance(audio, dict) else None
        status["latency_ms"] = latency_ms
        status["result"] = "PASS" if url else "FAIL (empty output)"
        status["outputs"] = 1 if url else 0
    except Exception as err:
        status["latency_ms"] = int((time.monotonic() - started) * 1000)
        status["result"] = f"FAIL ({err.__class__.__name__}: {str(err)[:120]})"
    return status


def main() -> int:
    parser = argparse.ArgumentParser(description="Audit des providers IA configurés.")
    parser.add_argument("--live", action="store_true", help="Lancer un vrai appel payant sur chaque provider configuré")
    parser.add_argument("--json", action="store_true", help="Sortie JSON")
    args = parser.parse_args()

    results = []

    # Image candidates (toutes les features image partagent le même catalogue).
    for candidate in MODEL_CATALOG.get("print_render", []):
        results.append(_audit_image_provider(candidate.provider, candidate.model_id, candidate.cost_per_generation, args.live))

    # Video candidates.
    for candidate in MODEL_CATALOG.get("animate", []):
        results.append(_audit_video_provider(candidate.provider, candidate.model_id, candidate.cost_per_generation, args.live))

    # Audio.
    results.append(_audit_audio_provider(args.live))

    if args.json:
        print(json.dumps(results, indent=2))
    else:
        print("\nProvider audit results")
        print("-" * 90)
        print(f"{'Provider':<18} {'Model':<24} {'Configured':<12} {'Latency':<10} {'Cost(¢)':<10} {'Result'}")
        print("-" * 90)
        for r in results:
            latency = f"{r.get('latency_ms', '-')}ms" if "latency_ms" in r else "-"
            cost = f"{r.get('cost_cents', '-')}¢" if "cost_cents" in r else "-"
            print(f"{r['provider']:<18} {r['model']:<24} {str(r['configured']):<12} {latency:<10} {cost:<10} {r['result']}")
        print("-" * 90)
        total_configured = sum(1 for r in results if r["configured"])
        passed = sum(1 for r in results if r.get("result", "").startswith("PASS"))
        dry = sum(1 for r in results if "DRY_RUN" in r.get("result", ""))
        print(f"Configured: {total_configured}/{len(results)} | Passed: {passed} | Dry-run: {dry}")

    return 0 if all(r.get("result", "").startswith(("PASS", "SKIPPED", "DRY_RUN")) for r in results) else 1


if __name__ == "__main__":
    raise SystemExit(main())
