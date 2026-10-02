"""Provider dédié de suppression d'arrière-plan — remove.bg API officielle.

Interface : remove_background(input) -> {"images": [{"url": data_uri_png}]}
input attend : { image: str (data URI ou URL http), format?: "png" | "jpg" }

remove.bg renvoie une image PNG transparente sous forme d'octets bruts.
"""
import base64
import os

import httpx

from providers.http_helpers import ProviderError, require_env

_BASE = "https://api.remove.bg/v1.0/removebg"


def is_configured() -> bool:
    return bool(os.environ.get("REMOVEBG_API_KEY"))


def _headers() -> dict:
    return {"X-Api-Key": require_env("REMOVEBG_API_KEY")}


def generate(_model_id: str, input_: dict, _timeout_ms: int) -> dict:
    """Contrat provider : {"images": [{"url": data_uri_png}]}."""
    image = input_.get("image")
    if not image:
        raise ProviderError("removebg: missing image")

    payload: dict = {"format": "png", "size": "auto"}
    files = None

    if image.startswith("data:"):
        from providers.http_helpers import parse_data_uri

        parsed = parse_data_uri(image)
        if not parsed:
            raise ProviderError("removebg: invalid data URI")
        mime, data = parsed
        ext = mime.split("/")[1] if "/" in mime else "png"
        files = {"image_file": (f"image.{ext}", base64.b64decode(data), mime)}
    else:
        payload["image_url"] = image

    try:
        response = httpx.post(
            _BASE,
            headers=_headers(),
            data=payload,
            files=files,
            timeout=120,
        )
    except Exception as err:
        raise ProviderError(f"removebg request failed: {err}") from err

    if response.status_code >= 400:
        raise ProviderError(f"removebg failed ({response.status_code}): {response.text[:300]}", response.status_code)

    data = response.content
    if not data:
        raise ProviderError("removebg: empty response")

    b64 = base64.b64encode(data).decode()
    return {"images": [{"url": f"data:image/png;base64,{b64}"}]}
