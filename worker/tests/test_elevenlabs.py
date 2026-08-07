"""Tests minimaux hors-ligne pour le provider ElevenLabs.

    cd worker && ./.venv/Scripts/python -m tests.test_elevenlabs

Couvre : is_configured, extraction du data URI, gestion d'erreur texte vide.
"""
import base64
import os

from providers import elevenlabs

failures = 0


def check(condition: bool, label: str) -> None:
    global failures
    if condition:
        print(f"  PASS  {label}")
    else:
        failures += 1
        print(f"  FAIL  {label}")


def main() -> None:
    print("\n[1] is_configured détecte la clé")
    old = os.environ.get("ELEVENLABS_API_KEY")
    os.environ["ELEVENLABS_API_KEY"] = "test-key"
    check(elevenlabs.is_configured() is True, "configuré quand ELEVENLABS_API_KEY est présent")
    del os.environ["ELEVENLABS_API_KEY"]
    check(elevenlabs.is_configured() is False, "non configuré quand la clé est absente")
    if old:
        os.environ["ELEVENLABS_API_KEY"] = old

    print("\n[2] generate refuse un texte vide")
    try:
        elevenlabs.generate({"text": "   "})
        check(False, "doit lever une erreur")
    except Exception as err:
        check("missing text" in str(err), "erreur explicite sur texte manquant")

    print("\n[3] generate retourne un data URI audio/mpeg")
    fake_mp3 = b"fake mp3 bytes"
    # Monkey-patch httpx.post pour simuler ElevenLabs sans appel réseau.
    import httpx

    original_post = httpx.post

    def fake_post(url, **kwargs):
        class FakeResponse:
            status_code = 200
            text = ""
            content = fake_mp3

        return FakeResponse()

    httpx.post = fake_post
    os.environ["ELEVENLABS_API_KEY"] = "test-key"
    try:
        result = elevenlabs.generate({"text": "Hello", "voice_id": "fake-voice"})
        check("audio" in result, "clé audio présente")
        url = result["audio"]["url"]
        check(url.startswith("data:audio/mpeg;base64,"), "format data URI audio/mpeg")
        decoded = base64.b64decode(url.split(",")[1])
        check(decoded == fake_mp3, "contenu MP3 encodé correctement")
    finally:
        httpx.post = original_post
        if old:
            os.environ["ELEVENLABS_API_KEY"] = old
        else:
            os.environ.pop("ELEVENLABS_API_KEY", None)

    print(f"\n{failures} failure(s)")
    raise SystemExit(1 if failures else 0)


if __name__ == "__main__":
    main()
