// Adaptateur Kling (Kuaishou) — API officielle (https://app.klingai.com).
// Modèles servis : kling-v3, kling-v2-5-turbo (image->vidéo).
//
// Auth : JWT HS256 signé avec la SecretKey seule (généré ici via
// node:crypto, sans dépendance) ; le claim `iss` porte la même clé.
// Schéma : POST /v1/videos/image2video -> data.task_id, puis polling
// GET /v1/videos/image2video/{task_id} -> data.task_status "succeed"
// -> data.task_result.videos[0].url.
//
// Clé : KLING_SECRET_KEY (console développeur Kling) — serveur uniquement.
import { createHmac } from "crypto";

import type { ProviderAdapter } from "../types";
import { ProviderError, getJson, pollUntilDone, postJson, requireEnv } from "./http";

const BASE_URL = "https://api.klingai.com";

function base64url(input: string): string {
  return Buffer.from(input).toString("base64url");
}

/** JWT HS256 tel qu'attendu par l'API Kling (iss = SecretKey, signé avec la
 *  même clé, validité 30 min). */
function signKlingToken(): string {
  const secretKey = requireEnv("KLING_SECRET_KEY");
  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = base64url(JSON.stringify({ iss: secretKey, exp: now + 1800, nbf: now - 5 }));
  const signature = createHmac("sha256", secretKey).update(`${header}.${payload}`).digest("base64url");
  return `${header}.${payload}.${signature}`;
}

interface KlingResponse<T> {
  code?: number;
  message?: string;
  data?: T;
}

interface KlingTask {
  task_id?: string;
  task_status?: string;
  task_status_msg?: string;
  task_result?: { videos?: Array<{ url?: string }> };
}

export const klingAdapter: ProviderAdapter = {
  name: "kling",
  async run(modelId, input, timeoutMs) {
    const headers = () => ({ Authorization: `Bearer ${signKlingToken()}` });

    const submit = (await postJson(`${BASE_URL}/v1/videos/image2video`, headers(), {
      model_name: modelId,
      ...input,
    })) as KlingResponse<KlingTask>;
    if (submit.code !== 0 || !submit.data?.task_id) {
      throw new ProviderError(`kling submit failed: ${submit.message ?? "no task_id"}`);
    }
    const taskId = submit.data.task_id;

    const videoUrl = await pollUntilDone<KlingResponse<KlingTask>>({
      fetchStatus: async () => {
        const status = (await getJson(
          `${BASE_URL}/v1/videos/image2video/${taskId}`,
          headers()
        )) as KlingResponse<KlingTask>;
        if (status.code !== 0) throw new ProviderError(`kling poll failed: ${status.message ?? "unknown"}`);
        return status;
      },
      extractDone: (s) => {
        const task = s.data;
        if (task?.task_status !== "succeed") return null;
        const url = task.task_result?.videos?.[0]?.url;
        if (!url) throw new ProviderError("kling: task succeeded without video url");
        return url;
      },
      extractError: (s) =>
        s.data?.task_status === "failed"
          ? `kling task failed: ${s.data.task_status_msg ?? "unknown"}`
          : null,
      timeoutMs,
      intervalMs: 5000,
    });
    return { video: { url: videoUrl } };
  },
};
