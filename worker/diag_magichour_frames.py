import io

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

from PIL import Image

from providers import magichour
from providers.http_helpers import get_bytes

for ratio in ("1:1", "16:9", "9:16"):
    url = magichour._run_image_generator(
        "flux-2-klein",
        {"prompt": "a red house on a hill", "aspectRatio": ratio, "resolution": "640px"},
        timeout_ms=180_000,
    )
    data, _ = get_bytes(url, timeout_s=60)
    w, h = Image.open(io.BytesIO(data)).size
    print(f"requested={ratio:5} -> {w}x{h} (ratio {w/h:.4f})")