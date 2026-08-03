import asyncio
import base64
import json
import os
import subprocess
import time
from pathlib import Path

import httpx
import websockets

CHROME = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
USER_DATA = Path(os.environ.get("TEMP", "C:/tmp")) / "cdp_screenshot_v3"
PORT = 9225
URL = "http://localhost:3000/app/dashboard"
OUT = Path(__file__).resolve().parent / "upscale-tab.png"


def start_chrome():
    USER_DATA.mkdir(parents=True, exist_ok=True)
    cmd = [
        CHROME,
        "--headless",
        "--disable-gpu",
        "--no-sandbox",
        f"--remote-debugging-port={PORT}",
        f"--user-data-dir={USER_DATA}",
        "--window-size=1440,900",
        "--hide-scrollbars",
        "--disable-background-timer-throttling",
        "--disable-renderer-backgrounding",
    ]
    return subprocess.Popen(cmd)


async def wait_for_cdp():
    for _ in range(30):
        try:
            r = httpx.get(f"http://127.0.0.1:{PORT}/json/list", timeout=2)
            if r.status_code == 200:
                pages = r.json()
                if pages:
                    return pages
        except Exception:
            pass
        await asyncio.sleep(0.5)
    raise RuntimeError("Chrome remote debugging not ready")


class CdpClient:
    def __init__(self, ws):
        self.ws = ws
        self._next_id = 1
        self._pending = {}
        self._reader_task = asyncio.create_task(self._reader())

    async def _reader(self):
        async for msg in self.ws:
            data = json.loads(msg)
            if "id" in data:
                fut = self._pending.pop(data["id"], None)
                if fut:
                    fut.set_result(data)

    async def send(self, method, params=None):
        req_id = self._next_id
        self._next_id += 1
        fut = asyncio.get_event_loop().create_future()
        self._pending[req_id] = fut
        await self.ws.send(json.dumps({"id": req_id, "method": method, "params": params or {}}))
        return await asyncio.wait_for(fut, timeout=15)

    async def screenshot(self, path: Path):
        r = await self.send("Page.captureScreenshot", {"format": "png", "fromSurface": True})
        b64 = r["result"]["data"]
        path.write_bytes(base64.b64decode(b64))

    async def close(self):
        self._reader_task.cancel()
        try:
            await self._reader_task
        except asyncio.CancelledError:
            pass


async def main():
    proc = start_chrome()
    try:
        await asyncio.sleep(2)
        pages = await wait_for_cdp()
        page = pages[0]
        ws_url = page["webSocketDebuggerUrl"]

        async with websockets.connect(ws_url) as ws:
            cdp = CdpClient(ws)
            await cdp.send("Page.enable")
            await cdp.send("Runtime.enable")

            await cdp.send("Page.navigate", {"url": URL})
            await asyncio.sleep(8)  # let load + hydration + fetch models

            r = await cdp.send("Runtime.evaluate", {
                "expression": """
                    const el = document.querySelector('[data-value="upscale"]');
                    if (el) { el.scrollIntoView({block:'center'}); el.click(); return 'clicked'; }
                    return 'not found';
                """,
                "returnByValue": True,
            })
            print("click result:", r.get("result", {}).get("value", "?"))
            await asyncio.sleep(3)

            await cdp.screenshot(OUT)
            print(f"saved {OUT}")
            await cdp.close()
    finally:
        proc.terminate()
        try:
            proc.wait(timeout=5)
        except subprocess.TimeoutExpired:
            proc.kill()


if __name__ == "__main__":
    asyncio.run(main())
