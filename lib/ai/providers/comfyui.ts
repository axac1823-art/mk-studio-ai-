// Adaptateur ComfyUI — serveur LOCAL de test (défaut http://127.0.0.1:8188).
// Sert à faire tourner le pipeline SANS clé payante : img2img ET img2video
// (i2v) sur le GPU de l'utilisateur, gratuit et hors-ligne. Ce n'est pas un
// fournisseur au sens produit (la qualité dépend du checkpoint chargé) —
// mais il respecte le même contrat ProviderAdapter que les API officielles
// et le fallback reste automatique si le serveur est éteint.
//
// Schéma (API HTTP de ComfyUI) :
//   1. POST /upload/image (multipart) — l'image source vers input/
//   2. POST /prompt { prompt: <graphe de nœuds> } -> { prompt_id }
//   3. polling GET /history/{prompt_id} -> outputs (SaveImage pour l'image,
//      VHS_VideoCombine — clé "gifs" de l'historique — pour la vidéo)
//   4. GET /view?filename=... -> octets -> data URI pour l'image ; pour la
//      vidéo, stockage via lib/ai/media.ts -> /api/media/<nom>.mp4 (une
//      data URI vidéo serait trop lourde)
//
// Deux "endpoints" locaux (le modelId du catalogue choisit) :
// - "img2img" (print_render) : graphe par défaut checkpoints SD1.5/SDXL
//   (CheckpointLoaderSimple -> CLIPTextEncode x2 -> LoadImage -> VAEEncode
//   -> KSampler -> VAEDecode -> SaveImage), REMPLAÇABLE via
//   COMFYUI_WORKFLOW_FILE — indispensable pour Flux ou tout graphe custom ;
// - "i2v" (animate) : PAS de graphe par défaut (Wan/LTX/SVD ont des nœuds
//   trop différents, souvent via custom nodes) —
//   COMFYUI_VIDEO_WORKFLOW_FILE est REQUIS (sinon échec vite -> fallback).
//
// Placeholders des fichiers de workflow (JSON exporté de ComfyUI en format
// API, quotes incluses dans le fichier) : "{{PROMPT}}", "{{NEGATIVE}}",
// "{{IMAGE}}", "{{SEED}}" ; vidéo uniquement : "{{FRAMES}}" (durée x fps),
// "{{FPS}}", "{{WIDTH}}", "{{HEIGHT}}" — remplacés par des NOMBRES.
//
// Env : COMFYUI_CHECKPOINT (requis pour img2img — nom exact du
// .safetensors dans models/checkpoints) ; COMFYUI_VIDEO_WORKFLOW_FILE
// (requis pour i2v) ; COMFYUI_BASE_URL, COMFYUI_DENOISE (défaut 0.55),
// COMFYUI_WORKFLOW_FILE et COMFYUI_VIDEO_FPS (défaut 16) optionnels.
// Serveur local : pas de clé, mais ces variables restent serveur (jamais
// de NEXT_PUBLIC_ par convention).
import { readFile } from "fs/promises";

import { storeVideoBuffer } from "../media";

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

interface WorkflowValues {
  prompt: string;
  imageName: string;
  seed: number;
  /** Vidéo uniquement — injectés dans les placeholders "{{FRAMES}}" etc. */
  frames?: number;
  fps?: number;
  width?: number;
  height?: number;
}

/** Substitue UN placeholder dans le JSON brut du workflow : la forme QUOTÉE
 *  ("{{KEY}}") est remplacée par la valeur JSON — chaîne complète (quotes
 *  réinsérées) ou nombre brut. Valeur undefined : no-op. */
function substitute(raw: string, key: string, value: string | number | undefined): string {
  if (value === undefined) return raw;
  return raw.replaceAll(
    `"{{${key}}}"`,
    typeof value === "number" ? String(value) : JSON.stringify(value)
  );
}

/** Charge un workflow exporté de ComfyUI (format API) et y injecte les
 *  valeurs — les placeholders sont remplacés AVANT le parse JSON. */
async function loadWorkflowFile(
  file: string,
  values: WorkflowValues
): Promise<Record<string, unknown>> {
  let raw = await readFile(file, "utf8");
  raw = substitute(raw, "PROMPT", values.prompt);
  raw = substitute(raw, "NEGATIVE", DEFAULT_NEGATIVE);
  raw = substitute(raw, "IMAGE", values.imageName);
  raw = substitute(raw, "SEED", values.seed);
  raw = substitute(raw, "FRAMES", values.frames);
  raw = substitute(raw, "FPS", values.fps);
  raw = substitute(raw, "WIDTH", values.width);
  raw = substitute(raw, "HEIGHT", values.height);
  return JSON.parse(raw) as Record<string, unknown>;
}

/** Graphe minimal img2img pour checkpoints style SD1.5/SDXL (une seule
 *  image d'entrée, dimensions conservées — la composition suit l'original). */
function defaultWorkflow(opts: WorkflowValues): Record<string, unknown> {
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

/** Image : graphe custom si COMFYUI_WORKFLOW_FILE est défini, sinon le
 *  graphe par défaut. */
async function buildImageWorkflow(values: WorkflowValues): Promise<Record<string, unknown>> {
  const file = process.env.COMFYUI_WORKFLOW_FILE;
  if (!file) return defaultWorkflow(values);
  return loadWorkflowFile(file, values);
}

/** Vidéo : pas de graphe par défaut (les pipelines Wan/LTX/SVD diffèrent
 *  trop) — COMFYUI_VIDEO_WORKFLOW_FILE est requis (voir runVideo). */

interface PromptSubmitResponse {
  prompt_id?: string;
  node_errors?: Record<string, unknown>;
}

type NodeOutputs = Record<
  string,
  {
    images?: Array<{ filename?: string; subfolder?: string; type?: string }>;
    // VideoHelperSuite (VHS_VideoCombine) publie les mp4 sous "gifs" ;
    // certains nœuds custom utilisent "videos".
    gifs?: Array<{ filename?: string; subfolder?: string; type?: string }>;
    videos?: Array<{ filename?: string; subfolder?: string; type?: string }>;
  }
>;

type History = Record<
  string,
  {
    status?: { completed?: boolean; status_str?: string };
    outputs?: NodeOutputs;
  }
>;

interface ProducedFile {
  filename: string;
  subfolder: string;
  type: string;
}

/** POST /prompt + polling /history jusqu'aux outputs (erreur ou timeout =
 *  échec de la tentative -> le routeur bascule sur le candidat suivant). */
async function executeWorkflow(
  workflow: Record<string, unknown>,
  timeoutMs: number
): Promise<NodeOutputs> {
  const submit = (await postJson(`${baseUrl()}/prompt`, {}, { prompt: workflow })) as PromptSubmitResponse;
  if (!submit.prompt_id) {
    throw new ProviderError(
      `comfyui: no prompt_id (node errors: ${JSON.stringify(submit.node_errors ?? {})})`
    );
  }
  const promptId = submit.prompt_id;

  const outputs = await pollUntilDone<History>({
    fetchStatus: () => getJson(`${baseUrl()}/history/${promptId}`, {}),
    extractDone: (history) => {
      const entry = history[promptId];
      return entry?.status?.completed ? (entry.outputs ?? {}) : null;
    },
    extractError: (history) =>
      history[promptId]?.status?.status_str === "error" ? "comfyui: execution error" : null,
    timeoutMs,
    intervalMs: 2000,
  });
  return outputs as NodeOutputs;
}

/** Premier fichier produit parmi les clés demandées (images pour img2img,
 *  gifs/videos pour i2v), dans l'ordre des nœuds de sortie. */
function firstFile(outputs: NodeOutputs, kinds: Array<"images" | "gifs" | "videos">): ProducedFile | null {
  for (const nodeOutput of Object.values(outputs)) {
    for (const kind of kinds) {
      const file = nodeOutput[kind]?.[0];
      if (file?.filename) {
        return {
          filename: file.filename,
          subfolder: file.subfolder ?? "",
          type: file.type ?? "output",
        };
      }
    }
  }
  return null;
}

/** GET /view -> octets du fichier produit (+ mime, utilisé pour la data
 *  URI image). */
async function fetchView(file: ProducedFile): Promise<{ buffer: Buffer; mime: string }> {
  const params = new URLSearchParams({
    filename: file.filename,
    subfolder: file.subfolder,
    type: file.type,
  });
  const res = await fetch(`${baseUrl()}/view?${params.toString()}`);
  if (!res.ok) {
    throw new ProviderError(`GET ${baseUrl()}/view failed (${res.status})`, res.status);
  }
  return {
    buffer: Buffer.from(await res.arrayBuffer()),
    mime: res.headers.get("content-type") ?? "application/octet-stream",
  };
}

function randomSeed(): number {
  return Math.floor(Math.random() * 2 ** 32);
}

async function runImageOne(input: Record<string, unknown>, timeoutMs: number): Promise<string> {
  const workflow = await buildImageWorkflow({
    prompt: String(input.prompt ?? ""),
    imageName: await uploadImage(String(input.image ?? "")),
    seed: randomSeed(),
  });
  const outputs = await executeWorkflow(workflow, timeoutMs);
  const image = firstFile(outputs, ["images"]);
  if (!image) throw new ProviderError("comfyui: history completed without output image");
  const { buffer, mime } = await fetchView(image);
  return `data:${mime.startsWith("image/") ? mime : "image/png"};base64,${buffer.toString("base64")}`;
}

const DEFAULT_VIDEO_FPS = 16;

/** FPS injecté dans "{{FPS}}" et utilisé pour convertir la durée en frames
 *  — doit correspondre au frame_rate du graphe exporté (16 = Wan, 24/25 =
 *  LTX-Video). Borné pour rester sain quelle que soit la valeur d'env. */
function videoFps(): number {
  const raw = Number(process.env.COMFYUI_VIDEO_FPS ?? String(DEFAULT_VIDEO_FPS));
  if (!Number.isFinite(raw) || raw <= 0) return DEFAULT_VIDEO_FPS;
  return Math.min(60, Math.floor(raw));
}

/** Vidéo img2video : une SEULE sortie mp4, stockée côté serveur via
 *  lib/ai/media.ts (/api/media/<nom>.mp4) — comme les vidéos mergées. */
async function runVideo(
  input: Record<string, unknown>,
  timeoutMs: number
): Promise<{ video: { url: string } }> {
  // requireEnv échoue vite AVANT l'upload si le workflow n'est pas configuré.
  const workflowFile = requireEnv("COMFYUI_VIDEO_WORKFLOW_FILE");
  const fps = videoFps();
  const duration = Number(input.duration);
  const frames = Math.max(
    1,
    Math.round((Number.isFinite(duration) && duration > 0 ? duration : 4) * fps)
  );
  const workflow = await loadWorkflowFile(workflowFile, {
    prompt: String(input.prompt ?? ""),
    imageName: await uploadImage(String(input.image ?? "")),
    seed: randomSeed(),
    frames,
    fps,
    width: Number(input.width) || undefined,
    height: Number(input.height) || undefined,
  });
  const outputs = await executeWorkflow(workflow, timeoutMs);
  const video = firstFile(outputs, ["gifs", "videos"]);
  if (!video) {
    throw new ProviderError("comfyui: history completed without video output (gifs/videos)");
  }
  const { buffer } = await fetchView(video);
  return { video: { url: await storeVideoBuffer(buffer) } };
}

export const comfyuiAdapter: ProviderAdapter = {
  name: "comfyui",
  async run(modelId, input, timeoutMs) {
    // Deux "endpoints" locaux : img2img (graphe image) et i2v (workflow
    // vidéo custom). Le modelId sert de garde-fou si le catalogue évolue.
    if (modelId === "i2v") return runVideo(input, timeoutMs);
    if (modelId !== "img2img") {
      throw new ProviderError(`comfyui: unsupported endpoint "${modelId}"`);
    }
    const count = Math.max(1, Number(input.quantity) || 1);
    const urls = await Promise.all(Array.from({ length: count }, () => runImageOne(input, timeoutMs)));
    return { images: urls.map((url) => ({ url })) };
  },
};
