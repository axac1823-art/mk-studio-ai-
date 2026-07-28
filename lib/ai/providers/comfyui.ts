// Adaptateur ComfyUI — serveur LOCAL de test (défaut http://127.0.0.1:8188).
// Sert à faire tourner le pipeline SANS clé payante : img2img sur le GPU de
// l'utilisateur, gratuit et hors-ligne. Ce n'est pas un fournisseur au sens
// produit (la qualité dépend du checkpoint chargé) — mais il respecte le
// même contrat ProviderAdapter que les API officielles et le fallback reste
// automatique si le serveur est éteint.
//
// Schéma (API HTTP de ComfyUI) :
//   1. POST /upload/image (multipart) — l'image source vers input/
//   2. POST /prompt { prompt: <graphe de nœuds> } -> { prompt_id }
//   3. polling GET /history/{prompt_id} -> outputs (SaveImage)
//   4. GET /view?filename=... -> octets -> data URI (comme les autres
//      adaptateurs, en attendant le stockage objet du jalon DB)
//
// Le graphe par défaut (checkpoints SD1.5/SDXL : CheckpointLoaderSimple ->
// CLIPTextEncode x2 -> LoadImage -> VAEEncode -> KSampler -> VAEDecode ->
// SaveImage) est REMPLAÇABLE : COMFYUI_WORKFLOW_FILE pointe un JSON exporté
// de ComfyUI en format API, avec les placeholders "{{PROMPT}}",
// "{{NEGATIVE}}", "{{IMAGE}}", "{{SEED}}" — indispensable pour Flux ou tout
// graphe custom.
//
// Env : COMFYUI_CHECKPOINT (requis — nom exact du .safetensors dans
// models/checkpoints) ; COMFYUI_BASE_URL, COMFYUI_DENOISE (défaut 0.55) et
// COMFYUI_WORKFLOW_FILE optionnels. Serveur local : pas de clé, mais ces
// variables restent serveur (jamais de NEXT_PUBLIC_ par convention).
import { readFile } from "fs/promises";

import type { ProviderAdapter } from "../types";
import {
  ProviderError,
  base64ToBytes,
  getJson,
  parseDataUri,
  pollUntilDone,
  postJson,
  requireEnv,
} from "./http";

const DEFAULT_BASE_URL = "http://127.0.0.1:8188";

/** Négatif constant pour le graphe par défaut — orienté rendu d'architecture
 *  (le prompt positif vient des templates serveur, comme partout). */
const DEFAULT_NEGATIVE =
  "blurry, lowres, deformed geometry, warped walls, bent lines, text, watermark, logo, people, oversaturated";

function baseUrl(): string {
  return (process.env.COMFYUI_BASE_URL ?? DEFAULT_BASE_URL).replace(/\/$/, "");
}

function denoiseStrength(): number {
  const raw = Number(process.env.COMFYUI_DENOISE ?? "0.55");
  if (!Number.isFinite(raw)) return 0.55;
  // img2img : 0 = copie conforme, 1 = génération complète. On borne pour
  // garder un comportement "édition" quoi qu'il arrive.
  return Math.min(1, Math.max(0.05, raw));
}

interface UploadResponse {
  name?: string;
  subfolder?: string;
}

/** ComfyUI ne lit que des fichiers de SON dossier input/ : la data URI
 *  (upload utilisateur) y est versée au préalable. */
async function uploadImage(imageDataUri: string): Promise<string> {
  const parsed = parseDataUri(imageDataUri);
  if (!parsed) {
    throw new ProviderError("comfyui: http image inputs are not supported, data URI expected");
  }
  const ext = parsed.mime.split("/")[1] ?? "png";
  const form = new FormData();
  form.append("image", new Blob([base64ToBytes(parsed.data)], { type: parsed.mime }), `input.${ext}`);
  const res = await fetch(`${baseUrl()}/upload/image`, { method: "POST", body: form });
  if (!res.ok) {
    throw new ProviderError(`POST ${baseUrl()}/upload/image failed (${res.status})`, res.status);
  }
  const data = (await res.json()) as UploadResponse;
  if (!data.name) throw new ProviderError("comfyui: no image name in upload response");
  return data.subfolder ? `${data.subfolder}/${data.name}` : data.name;
}

interface WorkflowOptions {
  prompt: string;
  imageName: string;
  seed: number;
}

/** Graphe minimal img2img pour checkpoints style SD1.5/SDXL (une seule
 *  image d'entrée, dimensions conservées — la composition suit l'original). */
function defaultWorkflow(opts: WorkflowOptions): Record<string, unknown> {
  return {
    "3": {
      class_type: "KSampler",
      inputs: {
        seed: opts.seed,
        steps: 25,
        cfg: 6.5,
        sampler_name: "euler",
        scheduler: "normal",
        denoise: denoiseStrength(),
        model: ["4", 0],
        positive: ["6", 0],
        negative: ["7", 0],
        latent_image: ["12", 0],
      },
    },
    "4": { class_type: "CheckpointLoaderSimple", inputs: { ckpt_name: requireEnv("COMFYUI_CHECKPOINT") } },
    "6": { class_type: "CLIPTextEncode", inputs: { text: opts.prompt, clip: ["4", 1] } },
    "7": { class_type: "CLIPTextEncode", inputs: { text: DEFAULT_NEGATIVE, clip: ["4", 1] } },
    "10": { class_type: "LoadImage", inputs: { image: opts.imageName } },
    "12": { class_type: "VAEEncode", inputs: { pixels: ["10", 0], vae: ["4", 2] } },
    "13": { class_type: "VAEDecode", inputs: { samples: ["3", 0], vae: ["4", 2] } },
    "14": { class_type: "SaveImage", inputs: { filename_prefix: "renderstudio", images: ["13", 0] } },
  };
}

/** Charge le graphe custom si COMFYUI_WORKFLOW_FILE est défini, sinon le
 *  graphe par défaut. Les placeholders du fichier sont remplacés AVANT le
 *  parse JSON (valeurs de chaînes complètes, quotes incluses). */
async function buildWorkflow(opts: WorkflowOptions): Promise<Record<string, unknown>> {
  const file = process.env.COMFYUI_WORKFLOW_FILE;
  if (!file) return defaultWorkflow(opts);
  const raw = await readFile(file, "utf8");
  const replaced = raw
    .replaceAll('"{{PROMPT}}"', JSON.stringify(opts.prompt))
    .replaceAll('"{{NEGATIVE}}"', JSON.stringify(DEFAULT_NEGATIVE))
    .replaceAll('"{{IMAGE}}"', JSON.stringify(opts.imageName))
    .replaceAll('"{{SEED}}"', String(opts.seed));
  return JSON.parse(replaced) as Record<string, unknown>;
}

interface PromptSubmitResponse {
  prompt_id?: string;
  node_errors?: Record<string, unknown>;
}

type History = Record<
  string,
  {
    status?: { completed?: boolean; status_str?: string };
    outputs?: Record<string, { images?: Array<{ filename?: string; subfolder?: string; type?: string }> }>;
  }
>;

interface ProducedImage {
  filename: string;
  subfolder: string;
  type: string;
}

async function runOne(input: Record<string, unknown>, timeoutMs: number): Promise<string> {
  const imageName = await uploadImage(String(input.image ?? ""));
  const workflow = await buildWorkflow({
    prompt: String(input.prompt ?? ""),
    imageName,
    seed: Math.floor(Math.random() * 2 ** 32),
  });

  const submit = (await postJson(`${baseUrl()}/prompt`, {}, { prompt: workflow })) as PromptSubmitResponse;
  if (!submit.prompt_id) {
    throw new ProviderError(
      `comfyui: no prompt_id (node errors: ${JSON.stringify(submit.node_errors ?? {})})`
    );
  }
  const promptId = submit.prompt_id;

  const produced = await pollUntilDone<History>({
    fetchStatus: () => getJson(`${baseUrl()}/history/${promptId}`, {}),
    extractDone: (history) => {
      const entry = history[promptId];
      if (!entry?.status?.completed) return null;
      for (const nodeOutput of Object.values(entry.outputs ?? {})) {
        const image = nodeOutput.images?.[0];
        if (image?.filename) {
          const result: ProducedImage = {
            filename: image.filename,
            subfolder: image.subfolder ?? "",
            type: image.type ?? "output",
          };
          return result;
        }
      }
      throw new ProviderError("comfyui: history completed without output image");
    },
    extractError: (history) =>
      history[promptId]?.status?.status_str === "error" ? "comfyui: execution error" : null,
    timeoutMs,
    intervalMs: 2000,
  });

  const image = produced as ProducedImage;
  const params = new URLSearchParams({
    filename: image.filename,
    subfolder: image.subfolder,
    type: image.type,
  });
  const res = await fetch(`${baseUrl()}/view?${params.toString()}`);
  if (!res.ok) {
    throw new ProviderError(`GET ${baseUrl()}/view failed (${res.status})`, res.status);
  }
  const mime = res.headers.get("content-type") ?? "image/png";
  return `data:${mime};base64,${Buffer.from(await res.arrayBuffer()).toString("base64")}`;
}

export const comfyuiAdapter: ProviderAdapter = {
  name: "comfyui",
  async run(modelId, input, timeoutMs) {
    // Un seul "endpoint" local aujourd'hui : img2img. Le modelId sert de
    // garde-fou si le catalogue évolue (vidéo locale, upscale...).
    if (modelId !== "img2img") {
      throw new ProviderError(`comfyui: unsupported endpoint "${modelId}"`);
    }
    const count = Math.max(1, Number(input.quantity) || 1);
    const urls = await Promise.all(Array.from({ length: count }, () => runOne(input, timeoutMs)));
    return { images: urls.map((url) => ({ url })) };
  },
};
