// Adaptateur Magic Hour — API de la PLATEFORME (https://docs.magichour.ai).
// ⚠️ EXCEPTION au principe "aucun agrégateur" (AGENTS.md §1) : Magic Hour
// n'édite aucun modèle fondamental — il revend un accès unifié à des modèles
// tiers (Kling, Veo, Sora, Nano Banana, Seedream...). Ajouté à la demande
// explicite du propriétaire du produit. Image : `flux-2-klein` ÉPINGLÉ
// (seul modèle d'édition éligible au free tier) ; vidéo : routage `default`
// (~ltx-2.3 en gratuit, kling-3.0 en payant) — le modèle réellement servant
// n'est donc pas garanti d'un appel à l'autre, contrairement aux
// fournisseurs directs.
//
// Schéma : soumission JSON (POST /v1/ai-image-editor ou /v1/image-to-video)
// -> { id }, polling GET /v1/{image|video}-projects/{id} -> "complete" ->
// downloads[0].url (URL pré-signée, expirante). Les data URIs ne sont pas
// acceptées en entrée : elles sont d'abord versées sur le stockage Magic
// Hour (POST /v1/files/upload-urls -> PUT des octets -> file_path) ; les URL
// http passent telles quelles. Une image par requête : la quantité est
// servie par requêtes parallèles.
//
// Clé : MAGIC_HOUR_API_KEY (https://magichour.ai/developer?tab=api-keys) —
// serveur uniquement.
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

const BASE_URL = "https://api.magichour.ai";

function headers(): Record<string, string> {
  return { Authorization: `Bearer ${requireEnv("MAGIC_HOUR_API_KEY")}` };
}

interface UploadUrlResponse {
  items?: Array<{ upload_url?: string; file_path?: string }>;
}

/** Magic Hour n'accepte que des URL http ou des `file_path` de SON stockage :
 *  les data URIs (uploads utilisateur) y sont donc versées au préalable. */
async function ensureFilePath(uri: string): Promise<string> {
  const parsed = parseDataUri(uri);
  if (!parsed) return uri;
  const ext = parsed.mime.split("/")[1] ?? "png";
  const grant = (await postJson(`${BASE_URL}/v1/files/upload-urls`, headers(), {
    items: [{ type: "image", extension: ext }],
  })) as UploadUrlResponse;
  const item = grant.items?.[0];
  if (!item?.upload_url || !item.file_path) {
    throw new ProviderError("magichour: no upload url in response");
  }
  const res = await fetch(item.upload_url, {
    method: "PUT",
    headers: { "Content-Type": parsed.mime },
    body: base64ToBytes(parsed.data),
  });
  if (!res.ok) throw new ProviderError(`magichour upload failed (${res.status})`, res.status);
  return item.file_path;
}

interface ProjectStatus {
  status?: string;
  downloads?: Array<{ url?: string }>;
  error?: { message?: string; code?: string } | null;
}

/** Polling commun image/vidéo : "complete" -> URL de téléchargement. */
async function pollProject(kind: "image" | "video", id: string, timeoutMs: number): Promise<string> {
  const url = await pollUntilDone<ProjectStatus>({
    fetchStatus: () => getJson(`${BASE_URL}/v1/${kind}-projects/${id}`, headers()),
    extractDone: (status) => {
      const downloadUrl = status.status === "complete" ? status.downloads?.[0]?.url : undefined;
      return typeof downloadUrl === "string" && downloadUrl.length > 0 ? downloadUrl : null;
    },
    extractError: (status) =>
      status.status === "error" || status.status === "canceled"
        ? `magichour ${kind} failed: ${status.error?.message ?? status.status}`
        : null,
    timeoutMs,
    intervalMs: kind === "video" ? 5000 : 3000,
  });
  return String(url);
}

async function runImageEdit(
  modelId: string,
  input: Record<string, unknown>,
  timeoutMs: number
): Promise<string> {
  const images = Array.isArray(input.images) ? (input.images as string[]) : [];
  const filePaths = await Promise.all(images.map(ensureFilePath));
  const job = (await postJson(`${BASE_URL}/v1/ai-image-editor`, headers(), {
    model: modelId,
    image_count: 1,
    aspect_ratio: String(input.aspectRatio ?? "auto"),
    resolution: String(input.resolution ?? "auto"),
    style: { prompt: String(input.prompt ?? "") },
    assets: { image_file_paths: filePaths },
  })) as { id?: string };
  if (!job.id) throw new ProviderError("magichour: no image id in submit response");
  return pollProject("image", job.id, timeoutMs);
}

async function runVideo(
  modelId: string,
  input: Record<string, unknown>,
  timeoutMs: number
): Promise<unknown> {
  const filePath = await ensureFilePath(String(input.image ?? ""));
  const job = (await postJson(`${BASE_URL}/v1/image-to-video`, headers(), {
    model: modelId,
    end_seconds: Number(input.endSeconds) || 5,
    resolution: String(input.resolution ?? "720p"),
    // La narration est gérée par la chaîne Animate (ElevenLabs + ffmpeg) :
    // pas de piste audio générée côté Magic Hour.
    audio: false,
    style: { prompt: String(input.prompt ?? "") },
    assets: { image_file_path: filePath },
  })) as { id?: string };
  if (!job.id) throw new ProviderError("magichour: no video id in submit response");
  const url = await pollProject("video", job.id, timeoutMs);
  return { video: { url } };
}

export const magichourAdapter: ProviderAdapter = {
  name: "magichour",
  async run(modelId, input, timeoutMs) {
    // La forme de l'input distingue l'endpoint (édition d'image vs vidéo) —
    // pas le modelId (flux-2-klein en image, `default` en vidéo).
    if (Array.isArray(input.images)) {
      const count = Math.max(1, Number(input.quantity) || 1);
      const urls = await Promise.all(
        Array.from({ length: count }, () => runImageEdit(modelId, input, timeoutMs))
      );
      return { images: urls.map((url) => ({ url })) };
    }
    return runVideo(modelId, input, timeoutMs);
  },
};
