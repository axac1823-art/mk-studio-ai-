// Adaptateur OpenAI — API officielle (https://platform.openai.com/docs/api-reference).
// Modèles servis : gpt-image-1.5 / gpt-image-1 (édition d'images) et
// sora-2 / sora-2-pro (image->vidéo).
//
// Images : POST /v1/images/edits en multipart (champ `image[]` répété pour
// l'image principale + les références) ; la réponse rend `data[].b64_json`,
// converti ici en data URI (le stockage objet arrive au jalon DB). Une image
// par requête : la quantité est servie par requêtes parallèles (même schéma
// que l'adaptateur Google).
//
// Vidéos : POST /v1/videos (JSON, image d'entrée en `input_reference.image_url`,
// data URL acceptée) -> { id }, polling GET /v1/videos/{id} -> "completed",
// puis téléchargement authentifié GET /v1/videos/{id}/content : Sora ne
// publie PAS d'URL de sortie — le MP4 est stocké en local et servi via
// /api/media (cf. lib/ai/media.ts).
// ⚠️ Surface d'API à re-vérifier contre la doc au premier branchement de clé
// (le fallback absorbe un rejet, mais l'appel reste facturé s'il aboutit).
//
// Clé : OPENAI_API_KEY (https://platform.openai.com/api-keys) — serveur uniquement.
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

const BASE_URL = "https://api.openai.com/v1";

function headers(): Record<string, string> {
  return { Authorization: `Bearer ${requireEnv("OPENAI_API_KEY")}` };
}

interface OpenAiImagesResponse {
  data?: Array<{ b64_json?: string }>;
}

async function runImageEdit(modelId: string, input: Record<string, unknown>): Promise<string> {
  const images = Array.isArray(input.images) ? (input.images as string[]) : [];

  const form = new FormData();
  form.set("model", modelId);
  form.set("prompt", String(input.prompt ?? ""));
  form.set("size", String(input.size ?? "auto"));
  form.set("quality", String(input.quality ?? "auto"));
  form.set("output_format", "jpeg");
  for (const uri of images) {
    const parsed = parseDataUri(uri);
    if (!parsed) {
      throw new ProviderError("openai: http image inputs are not supported, data URI expected");
    }
    const ext = parsed.mime.split("/")[1] ?? "png";
    form.append("image[]", new Blob([base64ToBytes(parsed.data)], { type: parsed.mime }), `image.${ext}`);
  }

  // PAS de Content-Type manuel : fetch pose le boundary multipart lui-même.
  const res = await fetch(`${BASE_URL}/images/edits`, {
    method: "POST",
    headers: headers(),
    body: form,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new ProviderError(
      `POST ${BASE_URL}/images/edits failed (${res.status}): ${text.slice(0, 300)}`,
      res.status
    );
  }
  const data = (await res.json()) as OpenAiImagesResponse;
  const b64 = data.data?.[0]?.b64_json;
  if (!b64) throw new ProviderError("openai: no image in images/edits response");
  return `data:image/jpeg;base64,${b64}`;
}

interface OpenAiVideo {
  id?: string;
  status?: "queued" | "in_progress" | "completed" | "failed";
  error?: { message?: string };
}

async function runVideo(
  modelId: string,
  input: Record<string, unknown>,
  timeoutMs: number
): Promise<unknown> {
  const job = (await postJson(`${BASE_URL}/videos`, headers(), {
    model: modelId,
    prompt: String(input.prompt ?? ""),
    seconds: String(input.seconds ?? "4"),
    size: String(input.size ?? "1280x720"),
    input_reference: { image_url: String(input.image_url ?? "") },
  })) as OpenAiVideo;
  if (!job.id) throw new ProviderError("openai: no video id in submit response");

  await pollUntilDone<OpenAiVideo>({
    fetchStatus: () => getJson(`${BASE_URL}/videos/${job.id}`, headers()),
    extractDone: (status) => (status.status === "completed" ? status : null),
    extractError: (status) =>
      status.status === "failed"
        ? `openai video failed: ${status.error?.message ?? "unknown"}`
        : null,
    timeoutMs,
    intervalMs: 5000,
  });

  const res = await fetch(`${BASE_URL}/videos/${job.id}/content`, { headers: headers() });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new ProviderError(
      `GET ${BASE_URL}/videos/${job.id}/content failed (${res.status}): ${text.slice(0, 300)}`,
      res.status
    );
  }
  const url = await storeVideoBuffer(Buffer.from(await res.arrayBuffer()));
  return { video: { url } };
}

export const openaiAdapter: ProviderAdapter = {
  name: "openai",
  async run(modelId, input, timeoutMs) {
    // Le modelId détermine l'endpoint officiel appelé (images vs vidéos).
    if (modelId.startsWith("sora")) return runVideo(modelId, input, timeoutMs);
    const count = Math.max(1, Number(input.quantity) || 1);
    const urls = await Promise.all(Array.from({ length: count }, () => runImageEdit(modelId, input)));
    return { images: urls.map((url) => ({ url })) };
  },
};
