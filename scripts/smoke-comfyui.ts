// Test hors-ligne de l'adaptateur ComfyUI : un faux serveur ComfyUI
// (node:http) vérifie le contrat upload -> /prompt -> /history -> /view
// SANS GPU ni serveur réel.
//
//   npm run test:comfyui
//
// Couvre : normalisation de la sortie image (data URI), quantité servie par
// requêtes parallèles, injection du checkpoint/prompt/image dans le graphe
// par défaut, échec vite sans COMFYUI_CHECKPOINT (le routeur basculera),
// endpoint vidéo i2v (workflow custom -> "gifs" de l'historique -> mp4
// stocké via /api/media) et échec vite sans COMFYUI_VIDEO_WORKFLOW_FILE.
import http from "http";
import os from "os";
import path from "path";
import { mkdtemp, rm, writeFile } from "fs/promises";

import { readMediaFile } from "../lib/ai/media";
import { comfyuiAdapter } from "../lib/ai/providers/comfyui";

let failures = 0;

function assert(condition: boolean, label: string): void {
  if (condition) {
    console.log(`  PASS  ${label}`);
  } else {
    failures += 1;
    console.error(`  FAIL  ${label}`);
  }
}

const FAKE_IMAGE_B64 = Buffer.from("fake-png-bytes").toString("base64");
const FAKE_VIDEO_BYTES = Buffer.from("fake-mp4-bytes");

type WorkflowNode = { class_type?: string; inputs?: Record<string, unknown> };

async function main(): Promise<void> {
  let uploadBodySize = 0;
  let workflow: Record<string, WorkflowNode> | null = null;

  const server = http.createServer((req, res) => {
    const url = new URL(req.url ?? "/", "http://mock");
    const json = (body: unknown) => {
      res.setHeader("content-type", "application/json");
      res.end(JSON.stringify(body));
    };
    const drain = (onEnd: (body: Buffer) => void) => {
      const chunks: Buffer[] = [];
      req.on("data", (chunk: Buffer) => chunks.push(chunk));
      req.on("end", () => onEnd(Buffer.concat(chunks)));
    };

    if (req.method === "POST" && url.pathname === "/upload/image") {
      drain((body) => {
        uploadBodySize = body.length;
        json({ name: "input.png", subfolder: "", type: "input" });
      });
      return;
    }
    if (req.method === "POST" && url.pathname === "/prompt") {
      drain((body) => {
        workflow = (JSON.parse(body.toString("utf8")) as { prompt: Record<string, WorkflowNode> }).prompt;
        json({ prompt_id: "pid-1", number: 1, node_errors: {} });
      });
      return;
    }
    if (req.method === "GET" && url.pathname === "/history/pid-1") {
      // Les deux sorties coexistent dans le mock : le chemin image lit
      // "images" (SaveImage), le chemin vidéo lit "gifs" (VHS_VideoCombine).
      json({
        "pid-1": {
          status: { completed: true, status_str: "success" },
          outputs: {
            "14": { images: [{ filename: "renderstudio_00001_.png", subfolder: "", type: "output" }] },
            "24": {
              gifs: [
                {
                  filename: "renderstudio_00001_.mp4",
                  subfolder: "",
                  type: "output",
                  format: "video/h264-mp4",
                },
              ],
            },
          },
        },
      });
      return;
    }
    if (req.method === "GET" && url.pathname === "/view") {
      const filename = url.searchParams.get("filename") ?? "";
      if (filename.endsWith(".mp4")) {
        assert(
          filename === "renderstudio_00001_.mp4",
          "/view reçoit le filename vidéo issu de l'historique"
        );
        res.setHeader("content-type", "video/mp4");
        res.end(FAKE_VIDEO_BYTES);
        return;
      }
      assert(
        filename === "renderstudio_00001_.png",
        "/view reçoit le filename issu de l'historique"
      );
      res.setHeader("content-type", "image/png");
      res.end(Buffer.from(FAKE_IMAGE_B64, "base64"));
      return;
    }
    res.statusCode = 404;
    res.end("{}");
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  const port = typeof address === "object" && address !== null ? address.port : 0;
  process.env.COMFYUI_BASE_URL = `http://127.0.0.1:${port}`;
  process.env.COMFYUI_CHECKPOINT = "test-model.safetensors";

  try {
    console.log("\n[1] Adapter : upload -> /prompt -> /history -> /view");
    const result = (await comfyuiAdapter.run(
      "img2img",
      {
        prompt: "photorealistic living room",
        image: `data:image/png;base64,${FAKE_IMAGE_B64}`,
        quantity: 2,
      },
      5000
    )) as { images?: Array<{ url?: string }> };
    assert(Array.isArray(result.images) && result.images.length === 2, "quantity=2 -> 2 images");
    assert(
      typeof result.images?.[0]?.url === "string" &&
        result.images[0].url.startsWith("data:image/png;base64,"),
      "sortie normalisée en data URI"
    );
    assert(uploadBodySize > FAKE_IMAGE_B64.length, "l'upload multipart a bien transporté l'image");

    console.log("\n[2] Graphe par défaut soumis à /prompt");
    const wf: Record<string, WorkflowNode> = workflow ?? {};
    assert(
      wf["4"]?.class_type === "CheckpointLoaderSimple" &&
        wf["4"].inputs?.ckpt_name === "test-model.safetensors",
      "checkpoint injecté depuis COMFYUI_CHECKPOINT"
    );
    assert(wf["6"]?.inputs?.text === "photorealistic living room", "prompt injecté dans CLIPTextEncode");
    assert(wf["10"]?.inputs?.image === "input.png", "LoadImage référence le fichier uploadé");
    assert(
      JSON.stringify(wf["3"]?.inputs?.latent_image) === JSON.stringify(["12", 0]),
      "KSampler lit le latent produit par VAEEncode"
    );

    console.log("\n[3] Checkpoint manquant -> échec vite (fallback)");
    delete process.env.COMFYUI_CHECKPOINT;
    let thrown = false;
    try {
      await comfyuiAdapter.run(
        "img2img",
        { prompt: "x", image: `data:image/png;base64,${FAKE_IMAGE_B64}`, quantity: 1 },
        1000
      );
    } catch {
      thrown = true;
    }
    assert(thrown, "sans COMFYUI_CHECKPOINT, l'appel échoue (le routeur basculera)");

    console.log("\n[4] Vidéo i2v : workflow custom -> gifs -> /api/media");
    const tmpDir = await mkdtemp(path.join(os.tmpdir(), "comfyui-smoke-"));
    const workflowFile = path.join(tmpDir, "i2v.json");
    await writeFile(
      workflowFile,
      JSON.stringify({
        "20": { class_type: "CLIPTextEncode", inputs: { text: "{{PROMPT}}" } },
        "21": { class_type: "CLIPTextEncode", inputs: { text: "{{NEGATIVE}}" } },
        "22": { class_type: "LoadImage", inputs: { image: "{{IMAGE}}" } },
        "23": {
          class_type: "WanImageToVideo",
          inputs: {
            width: "{{WIDTH}}",
            height: "{{HEIGHT}}",
            length: "{{FRAMES}}",
            seed: "{{SEED}}",
          },
        },
        "24": {
          class_type: "VHS_VideoCombine",
          inputs: { frame_rate: "{{FPS}}", format: "video/h264-mp4" },
        },
      })
    );
    process.env.COMFYUI_VIDEO_WORKFLOW_FILE = workflowFile;
    process.env.COMFYUI_VIDEO_FPS = "8";
    const video = (await comfyuiAdapter.run(
      "i2v",
      {
        prompt: "slow dolly in",
        image: `data:image/png;base64,${FAKE_IMAGE_B64}`,
        duration: 4,
        width: 832,
        height: 480,
      },
      5000
    )) as { video?: { url?: string } };
    const videoUrl = video.video?.url ?? "";
    assert(
      /^\/api\/media\/[a-f0-9-]+\.mp4$/.test(videoUrl),
      "sortie normalisée en /api/media/<uuid>.mp4"
    );
    const stored = await readMediaFile(videoUrl.replace("/api/media/", ""));
    assert(
      stored !== null && stored.equals(FAKE_VIDEO_BYTES),
      "le mp4 téléchargé est stocké et lisible via readMediaFile"
    );

    const videoWf: Record<string, WorkflowNode> = workflow ?? {};
    assert(videoWf["20"]?.inputs?.text === "slow dolly in", "prompt injecté dans le workflow vidéo");
    assert(
      videoWf["23"]?.inputs?.width === 832 && videoWf["23"]?.inputs?.height === 480,
      "WIDTH/HEIGHT injectés en nombres"
    );
    assert(videoWf["23"]?.inputs?.length === 32, "FRAMES = durée x fps (4 s x 8)");
    assert(videoWf["24"]?.inputs?.frame_rate === 8, "FPS injecté depuis COMFYUI_VIDEO_FPS");
    assert(typeof videoWf["23"]?.inputs?.seed === "number", "SEED injecté en nombre");
    await rm(tmpDir, { recursive: true, force: true });

    console.log("\n[5] Workflow vidéo manquant -> échec vite (fallback)");
    delete process.env.COMFYUI_VIDEO_WORKFLOW_FILE;
    let videoThrown = false;
    try {
      await comfyuiAdapter.run(
        "i2v",
        {
          prompt: "x",
          image: `data:image/png;base64,${FAKE_IMAGE_B64}`,
          duration: 4,
          width: 640,
          height: 640,
        },
        1000
      );
    } catch {
      videoThrown = true;
    }
    assert(
      videoThrown,
      "sans COMFYUI_VIDEO_WORKFLOW_FILE, l'appel i2v échoue (le routeur basculera)"
    );
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }

  console.log(failures === 0 ? "\nTous les tests passent.\n" : `\n${failures} test(s) en échec.\n`);
  process.exit(failures === 0 ? 0 : 1);
}

void main();
