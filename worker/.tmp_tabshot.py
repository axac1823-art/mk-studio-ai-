import asyncio
import json
import base64
import websockets

async def click_tab_and_screenshot(ws_url, tab_label, output_path):
    async with websockets.connect(ws_url) as ws:
        counter = 0
        async def send(method, params=None):
            nonlocal counter
            counter += 1
            await ws.send(json.dumps({"id": counter, "method": method, "params": params or {}}))
            return counter

        await send("Runtime.enable")
        await send("Page.enable")
        await send("Input.enable")
        await asyncio.sleep(2)

        # click tab by coordinate
        coords = {"Render": (300, 110), "Mood": (360, 110), "Ext->Int": (430, 110), "Plan": (500, 110), "Animate": (580, 110), "Multi-Angle": (660, 110), "Upscale": (740, 110)}
        x, y = coords.get(tab_label, (300, 110))
        click_id = await send("Input.dispatchMouseEvent", {"type": "mousePressed", "x": x, "y": y, "button": "left", "clickCount": 1})
        await send("Input.dispatchMouseEvent", {"type": "mouseReleased", "x": x, "y": y, "button": "left", "clickCount": 1})
        async for msg in ws:
            data = json.loads(msg)
            if data.get("id") == click_id:
                break
        await asyncio.sleep(2)

        # scroll to bottom for tall panels
        scroll_id = await send("Runtime.evaluate", {"expression": f"""
            (() => {{
              const main = document.querySelector('main');
              if (main) main.scrollTo(0, main.scrollHeight);
              window.scrollTo(0, document.body.scrollHeight);
              return 'ok';
            }})()
        """})
        async for msg in ws:
            data = json.loads(msg)
            if data.get("id") == scroll_id:
                break
        await asyncio.sleep(0.5)

        shot_id = await send("Page.captureScreenshot", {"format": "png"})
        async for msg in ws:
            data = json.loads(msg)
            if data.get("id") == shot_id:
                if "result" in data and "data" in data["result"]:
                    with open(output_path, "wb") as f:
                        f.write(base64.b64decode(data["result"]["data"]))
                    print("saved", output_path)
                else:
                    print(json.dumps(data))
                break

asyncio.run(click_tab_and_screenshot("ws://127.0.0.1:9222/devtools/page/5BE539E33E0784159BD888F282FCD32E", "Upscale", "C:/Users/PC/AppData/Local/Temp/dashboard_upscale.png"))
