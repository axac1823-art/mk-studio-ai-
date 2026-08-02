"""Test hors-ligne du provider ComfyUI — port de scripts/smoke-comfyui.ts.

    cd worker && ./.venv/Scripts/python -m tests.smoke_comfyui

Un faux serveur ComfyUI (http.server) vérifie le contrat
upload -> /prompt -> /history -> /view SANS GPU ni serveur réel :
img2img (data URI), échec vite sans COMFYUI_CHECKPOINT, vidéo i2v
(workflow custom -> "gifs" -> fichier stocké) et échec vite sans
COMFYUI_VIDEO_WORKFLOW_FILE.
"""
import base64
import json
import os
import tempfile

# STORAGE_DIR est capturé par config à l'import de storage.py : il DOIT
# être pointé sur un dossier temporaire AVANT tout import du worker.
os.environ["STORAGE_DIR"] = tempfile.mkdtemp(prefix="comfyui-smoke-")

from http.server import BaseHTTPRequestHandler, HTTPServer  # noqa: E402
from pathlib import Path  # noqa: E402
from threading import Thread  # noqa: E402
from urllib.parse import parse_qs, urlparse  # noqa: E402

import storage  # noqa: E402
from providers import comfyui  # noqa: E402

failures = 0


def check(condition: bool, label: str) -> None:
    global failures
    if condition:
        print(f"  PASS  {label}")
    else:
        failures += 1
        print(f"  FAIL  {label}")


FAKE_IMAGE_B64 = base64.b64encode(b"fake-png-bytes").decode()
FAKE_VIDEO_BYTES = b"fake-mp4-bytes"


class MockComfyUI(BaseHTTPRequestHandler):
    """Faux serveur : capture le workflow soumis, sert des sorties fixes
    (image PNG node 14 + vidéo MP4 node 24 dans le même historique)."""

    workflow: dict | None = None
    upload_body_size = 0

    def log_message(self, *_args):  # silence le logging de http.server
        pass

    def _json(self, body: dict) -> None:
        data = json.dumps(body).encode()
        self.send_response(200)
        self.send_header("content-type", "application/json")
        self.send_header("content-length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_POST(self) -> None:
        path = urlparse(self.path).path
        body = self.rfile.read(int(self.headers.get("content-length") or 0))
        if path == "/upload/image":
            MockComfyUI.upload_body_size = len(body)
            self._json({"name": "input.png", "subfolder": "", "type": "input"})
            return
        if path == "/prompt":
            MockComfyUI.workflow = json.loads(body.decode("utf-8"))["prompt"]
            self._json({"prompt_id": "pid-1", "number": 1, "node_errors": {}})
            return
        self.send_response(404)
        self.end_headers()

    def do_GET(self) -> None:
        parsed = urlparse(self.path)
        if parsed.path == "/history/pid-1":
            # Les deux sorties coexistent : img2img lit "images", i2v lit "gifs".
            self._json(
                {
                    "pid-1": {
                        "status": {"completed": True, "status_str": "success"},
                        "outputs": {
                            "14": {"images": [{"filename": "renderstudio_00001_.png", "subfolder": "", "type": "output"}]},
                            "24": {
                                "gifs": [
                                    {
                                        "filename": "renderstudio_00001_.mp4",
                                        "subfolder": "",
                                        "type": "output",
                                        "format": "video/h264-mp4",
                                    }
                                ]
                            },
                        },
                    }
                }
            )
            return
        if parsed.path == "/view":
            filename = parse_qs(parsed.query).get("filename", [""])[0]
            if filename.endswith(".mp4"):
                check(filename == "renderstudio_00001_.mp4", "/view reçoit le filename vidéo issu de l'historique")
                data, mime = FAKE_VIDEO_BYTES, "video/mp4"
            else:
                check(filename == "renderstudio_00001_.png", "/view reçoit le filename issu de l'historique")
                data, mime = base64.b64decode(FAKE_IMAGE_B64), "image/png"
            self.send_response(200)
            self.send_header("content-type", mime)
            self.send_header("content-length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)
            return
        self.send_response(404)
        self.end_headers()


def main() -> None:
    server = HTTPServer(("127.0.0.1", 0), MockComfyUI)
    Thread(target=server.serve_forever, daemon=True).start()
    port = server.server_address[1]
    os.environ["COMFYUI_BASE_URL"] = f"http://127.0.0.1:{port}"
    os.environ["COMFYUI_CHECKPOINT"] = "test-model.safetensors"

    try:
        print("\n[1] img2img : upload -> /prompt -> /history -> /view")
        result = comfyui.generate(
            "img2img",
            {"prompt": "photorealistic living room", "image": f"data:image/png;base64,{FAKE_IMAGE_B64}", "quantity": 2},
            5000,
        )
        check(len(result.get("images", [])) == 2, "quantity=2 -> 2 images")
        check(
            result["images"][0]["url"].startswith("data:image/png;base64,"),
            "sortie normalisée en data URI",
        )
        check(MockComfyUI.upload_body_size > len(FAKE_IMAGE_B64), "l'upload multipart a bien transporté l'image")

        print("\n[2] Graphe par défaut soumis à /prompt")
        wf = MockComfyUI.workflow or {}
        check(
            wf.get("4", {}).get("class_type") == "CheckpointLoaderSimple"
            and wf["4"]["inputs"].get("ckpt_name") == "test-model.safetensors",
            "checkpoint injecté depuis COMFYUI_CHECKPOINT",
        )
        check(wf.get("6", {}).get("inputs", {}).get("text") == "photorealistic living room", "prompt injecté dans CLIPTextEncode")
        check(wf.get("10", {}).get("inputs", {}).get("image") == "input.png", "LoadImage référence le fichier uploadé")
        check(wf.get("3", {}).get("inputs", {}).get("latent_image") == ["12", 0], "KSampler lit le latent produit par VAEEncode")

        print("\n[3] Checkpoint manquant -> échec vite (fallback)")
        del os.environ["COMFYUI_CHECKPOINT"]
        thrown = False
        try:
            comfyui.generate("img2img", {"prompt": "x", "image": f"data:image/png;base64,{FAKE_IMAGE_B64}", "quantity": 1}, 1000)
        except Exception:
            thrown = True
        check(thrown, "sans COMFYUI_CHECKPOINT, l'appel échoue (le workflow basculera)")

        print("\n[4] Vidéo i2v : workflow custom -> gifs -> fichier stocké")
        workflow_file = Path(os.environ["STORAGE_DIR"]) / "i2v.json"
        workflow_file.write_text(
            json.dumps(
                {
                    "20": {"class_type": "CLIPTextEncode", "inputs": {"text": "{{PROMPT}}"}},
                    "21": {"class_type": "CLIPTextEncode", "inputs": {"text": "{{NEGATIVE}}"}},
                    "22": {"class_type": "LoadImage", "inputs": {"image": "{{IMAGE}}"}},
                    "23": {
                        "class_type": "WanImageToVideo",
                        "inputs": {"width": "{{WIDTH}}", "height": "{{HEIGHT}}", "length": "{{FRAMES}}", "seed": "{{SEED}}"},
                    },
                    "24": {"class_type": "VHS_VideoCombine", "inputs": {"frame_rate": "{{FPS}}", "format": "video/h264-mp4"}},
                }
            ),
            encoding="utf-8",
        )
        os.environ["COMFYUI_VIDEO_WORKFLOW_FILE"] = str(workflow_file)
        os.environ["COMFYUI_VIDEO_FPS"] = "8"
        video = comfyui.generate(
            "i2v",
            {"prompt": "slow dolly in", "image": f"data:image/png;base64,{FAKE_IMAGE_B64}", "duration": 4, "width": 832, "height": 480},
            5000,
        )
        video_url = (video.get("video") or {}).get("url") or ""
        check(video_url.startswith("/storage/") and video_url.endswith(".mp4"), "sortie normalisée en /storage/<uuid>.mp4")
        stored = storage.resolve(video_url)
        check(stored.exists() and stored.read_bytes() == FAKE_VIDEO_BYTES, "le mp4 téléchargé est stocké sur disque")

        video_wf = MockComfyUI.workflow or {}
        check(video_wf.get("20", {}).get("inputs", {}).get("text") == "slow dolly in", "prompt injecté dans le workflow vidéo")
        check(
            video_wf.get("23", {}).get("inputs", {}).get("width") == 832
            and video_wf["23"]["inputs"].get("height") == 480,
            "WIDTH/HEIGHT injectés en nombres",
        )
        check(video_wf.get("23", {}).get("inputs", {}).get("length") == 32, "FRAMES = durée x fps (4 s x 8)")
        check(video_wf.get("24", {}).get("inputs", {}).get("frame_rate") == 8, "FPS injecté depuis COMFYUI_VIDEO_FPS")
        check(isinstance(video_wf.get("23", {}).get("inputs", {}).get("seed"), int), "SEED injecté en nombre")

        print("\n[5] Workflow vidéo manquant -> échec vite (fallback)")
        del os.environ["COMFYUI_VIDEO_WORKFLOW_FILE"]
        thrown = False
        try:
            comfyui.generate(
                "i2v",
                {"prompt": "x", "image": f"data:image/png;base64,{FAKE_IMAGE_B64}", "duration": 4, "width": 640, "height": 640},
                1000,
            )
        except Exception:
            thrown = True
        check(thrown, "sans COMFYUI_VIDEO_WORKFLOW_FILE, l'appel i2v échoue (le workflow basculera)")
    finally:
        server.shutdown()

    print("\nTous les tests passent.\n" if failures == 0 else f"\n{failures} test(s) en échec.\n")
    raise SystemExit(0 if failures == 0 else 1)


main()
