// Test hors-ligne de l'adaptateur ComfyUI : un faux serveur ComfyUI
// (node:http) vérifie le contrat upload -> /prompt -> /history -> /view
// SANS GPU ni serveur réel.
//
//   npm run test:comfyui
//
// Couvre : normalisation de la sortie (data URI), quantité servie par
// requêtes parallèles, injection du checkpoint/prompt/image dans le graphe
// par défaut, échec vite sans COMFYUI_CHECKPOINT (le routeur basculera).
import http from "http";

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
      json({
        "pid-1": {
          status: { completed: true, status_str: "success" },
          outputs: {
            "14": { images: [{ filename: "renderstudio_00001_.png", subfolder: "", type: "output" }] },
          },
        },
      });
      return;
    }
    if (req.method === "GET" && url.pathname === "/view") {
      assert(
        url.searchParams.get("filename") === "renderstudio_00001_.png",
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
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }

  console.log(failures === 0 ? "\nTous les tests passent.\n" : `\n${failures} test(s) en échec.\n`);
  process.exit(failures === 0 ? 0 : 1);
}

void main();
