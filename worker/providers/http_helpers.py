"""Helpers HTTP partagés par les providers — port de lib/ai/providers/http.ts.

Toutes les API officielles ont le même schéma général : POST d'une tâche
(ou appel synchrone) + polling jusqu'au résultat. Ces helpers centralisent
: JSON + gestion d'erreurs, polling avec budget de timeout (le workflow
bascule sur le candidat suivant quand il expire), et conversion d'images.
"""
import base64
import os
import time

import httpx

DEFAULT_TIMEOUT_S = 60


class ProviderError(Exception):
    """Erreur provider — le workflow la trace et déclenche le fallback."""

    def __init__(self, message: str, status: int | None = None):
        super().__init__(message)
        self.status = status


def require_env(name: str) -> str:
    """Variable d'env requise ou échec VITE (le workflow bascule alors sur
    un autre provider configuré — pas de vendor lock-in)."""
    value = os.environ.get(name)
    if not value:
        raise ProviderError(f"provider not configured: missing {name}")
    return value


def _error_snippet(response: httpx.Response) -> str:
    return response.text[:300]


def post_json(url: str, headers: dict, body: dict | list, timeout_s: int = DEFAULT_TIMEOUT_S):
    """POST JSON -> JSON, sinon ProviderError avec le début du corps d'erreur."""
    response = httpx.post(url, headers={**headers, "Content-Type": "application/json"}, json=body, timeout=timeout_s)
    if response.status_code >= 400:
        raise ProviderError(
            f"POST {url} failed ({response.status_code}): {_error_snippet(response)}",
            response.status_code,
        )
    return response.json()


def get_json(url: str, headers: dict, timeout_s: int = DEFAULT_TIMEOUT_S):
    """GET -> JSON, sinon ProviderError."""
    response = httpx.get(url, headers=headers, timeout=timeout_s)
    if response.status_code >= 400:
        raise ProviderError(
            f"GET {url} failed ({response.status_code}): {_error_snippet(response)}",
            response.status_code,
        )
    return response.json()


def get_bytes(url: str, headers: dict | None = None, timeout_s: int = 300) -> tuple[bytes, str]:
    """GET -> (octets, content-type) — téléchargement des sorties (CDN des
    providers, URLs locales /storage/...)."""
    response = httpx.get(url, headers=headers or {}, timeout=timeout_s, follow_redirects=True)
    if response.status_code >= 400:
        raise ProviderError(f"GET {url} failed ({response.status_code})", response.status_code)
    return response.content, response.headers.get("content-type", "application/octet-stream")


def poll_until_done(fetch_status, extract_done, extract_error, timeout_ms: int, interval_ms: int = 3000):
    """Polling générique jusqu'au résultat, à l'échec ou au timeout.

    fetch_status() -> statut brut ; extract_done(statut) -> résultat ou
    None ; extract_error(statut) -> message d'erreur définitive ou None.
    Le timeout global fait échouer la tentative pour laisser le workflow
    basculer sur le candidat suivant.
    """
    deadline = time.monotonic() + timeout_ms / 1000
    while True:
        if time.monotonic() > deadline:
            raise ProviderError(f"provider timeout after {timeout_ms}ms")
        status = fetch_status()
        done = extract_done(status)
        if done is not None:
            return done
        error = extract_error(status)
        if error:
            raise ProviderError(error)
        time.sleep(interval_ms / 1000)


def parse_data_uri(uri: str) -> tuple[str, str] | None:
    """Extrait (mime, base64 brut) d'une data URI ; None sinon."""
    if not uri.startswith("data:"):
        return None
    try:
        header, data = uri[5:].split(",", 1)
        mime = header.split(";")[0]
        return mime, data
    except ValueError:
        return None


def to_base64_or_url(uri: str) -> str:
    """La plupart des API "image en entrée" veulent du base64 BRUT quand on
    leur passe une data URI (les URL http sont acceptées telles quelles)."""
    parsed = parse_data_uri(uri)
    return parsed[1] if parsed else uri


def data_uri_to_bytes(uri: str) -> tuple[bytes, str]:
    """Data URI -> (octets, mime) — les workflows stockent TOUTES les
    sorties sur disque, quelle que soit leur forme."""
    parsed = parse_data_uri(uri)
    if not parsed:
        raise ProviderError("data URI expected")
    mime, data = parsed
    return base64.b64decode(data), mime
