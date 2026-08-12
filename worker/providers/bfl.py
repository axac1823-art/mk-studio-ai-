"""Adaptateur Black Forest Labs — API officielle Flux (port de bfl.ts).

Modèles servis : flux-kontext-pro, flux-kontext-max (édition image->image).

Schéma : POST /v1/{model} (header `x-key`) -> { id, polling_url }, puis
polling de polling_url jusqu'à status "Ready" -> result.sample (URL).
BFL ne produit qu'UNE image par requête : la quantité demandée est servie
par des requêtes parallèles.

Env : BFL_API_KEY (https://dashboard.bfl.ai) — lue à l'appel, jamais à
l'import (échec vite -> le workflow bascule sur le candidat suivant).
"""
from concurrent.futures import ThreadPoolExecutor

from providers.http_helpers import (
    ProviderError,
    get_json,
    poll_until_done,
    post_json,
    require_env,
)

BASE_URL = "https://api.bfl.ai"


def _headers() -> dict:
    return {"x-key": require_env("BFL_API_KEY")}


def _run_one(model_id: str, payload: dict, timeout_ms: int) -> str:
    submit = post_json(f"{BASE_URL}/v1/{model_id}", _headers(), payload)
    polling_url = submit.get("polling_url")
    if not polling_url and submit.get("id"):
        polling_url = f"{BASE_URL}/v1/get_result?id={submit['id']}"
    if not polling_url:
        raise ProviderError("bfl: no polling_url in submit response")

    def fetch_status():
        return get_json(polling_url, _headers())

    def extract_done(status):
        result = status.get("result") or {}
        return result.get("sample") if status.get("status") == "Ready" else None

    def extract_error(status):
        state = status.get("status")
        # États terminaux d'erreur documentés ; "Reasoning" et "Generating"
        # sont des états intermédiaires valides.
        terminal_errors = ("Error", "Request Moderated", "Content Moderated", "Task not found")
        return f"bfl task {state}" if state in terminal_errors else None

    return poll_until_done(fetch_status, extract_done, extract_error, timeout_ms)


def generate(model_id: str, input_: dict, timeout_ms: int) -> dict:
    """Contrat provider : {"images": [{"url": ...}]}. Le model_id est passé
    tel quel dans l'URL (le catalogue choisit la variante Flux)."""
    try:
        count = max(1, int(input_.get("quantity") or 1))
    except (TypeError, ValueError):
        count = 1
    # `quantity` est un réglage interne, pas un paramètre de l'API BFL.
    payload = {key: value for key, value in input_.items() if key != "quantity"}
    # Requêtes parallèles : chaque appel produit une variante.
    with ThreadPoolExecutor(max_workers=count) as pool:
        urls = list(pool.map(lambda _: _run_one(model_id, payload, timeout_ms), range(count)))
    return {"images": [{"url": url} for url in urls]}
