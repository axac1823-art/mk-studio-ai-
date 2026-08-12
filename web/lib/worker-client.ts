// Wrapper HTTP fin vers le worker — SEUL canal entre /web et les
// providers IA. Le worker détient TOUTE la logique de génération et les
// clés fournisseurs ; /web crée les jobs en DB et délègue l'exécution.

/** URL interne du worker — partagée avec les routes serveur. */
export function baseUrl(): string {
  return (process.env.WORKER_BASE_URL ?? "http://127.0.0.1:8000").replace(/\/$/, "");
}

const publicBaseUrl = (): string =>
  (process.env.WORKER_PUBLIC_URL ?? "http://127.0.0.1:8000").replace(/\/$/, "");

/** Chemin relatif (/storage/<nom>) -> URL absolue pour le navigateur. */
export function publicUrl(storagePath: string): string {
  return `${publicBaseUrl()}${storagePath}`;
}

/** Levée quand le worker n'a AUCUN provider configuré (les routes
 *  traduisent en 503 générique). */
export class WorkerNotConfiguredError extends Error {
  constructor() {
    super("worker has no provider configured");
    this.name = "WorkerNotConfiguredError";
  }
}

/** Santé/config du worker — utilisé AVANT de créer un job (503 propre). */
export async function isWorkerConfigured(): Promise<boolean> {
  try {
    const res = await fetch(`${baseUrl()}/health`, { cache: "no-store" });
    if (!res.ok) return false;
    const data = (await res.json()) as { providers_configured?: boolean };
    return data.providers_configured === true;
  } catch {
    return false;
  }
}

function workerHeaders(): Record<string, string> {
  const key = process.env.WORKER_API_KEY;
  return {
    "Content-Type": "application/json",
    ...(key ? { "X-Worker-Key": key } : {}),
  };
}

async function postStartJob(path: string, jobId: string, bodyKey: string = "job_id"): Promise<void> {
  const res = await fetch(`${baseUrl()}${path}`, {
    method: "POST",
    headers: workerHeaders(),
    body: JSON.stringify({ [bodyKey]: jobId }),
  });
  if (res.status === 503) throw new WorkerNotConfiguredError();
  if (!res.ok) throw new Error(`worker ${path} failed (${res.status})`);
}

export function startImageJob(jobId: string): Promise<void> {
  return postStartJob("/generate/image", jobId);
}

export function startVideoJob(videoJobId: string): Promise<void> {
  return postStartJob("/generate/video", videoJobId, "video_job_id");
}

export function startAudioJob(jobId: string): Promise<void> {
  return postStartJob("/audio/generate", jobId);
}

export function startLipSyncJob(jobId: string): Promise<void> {
  return postStartJob("/lip-sync/generate", jobId);
}

export function start3DGeneratorJob(jobId: string): Promise<void> {
  return postStartJob("/3d-generator/generate", jobId);
}

export function startVideoEditJob(jobId: string): Promise<void> {
  return postStartJob("/video/edit", jobId);
}

export function startVideoUpscaleJob(jobId: string): Promise<void> {
  return postStartJob("/video/upscale", jobId);
}

export function startUpscaleJob(jobId: string): Promise<void> {
  return postStartJob("/upscale", jobId);
}

/** Verse une image source chez le worker (asset réutilisable, page
 *  Uploads) et retourne son chemin public relatif. */
export async function uploadSource(data: Buffer, mime: string): Promise<string> {
  const form = new FormData();
  form.append("file", new Blob([new Uint8Array(data)], { type: mime }), `upload.${mime.split("/")[1] ?? "png"}`);
  const headers: Record<string, string> = {};
  const key = process.env.WORKER_API_KEY;
  if (key) headers["X-Worker-Key"] = key;
  const res = await fetch(`${baseUrl()}/storage/upload`, { method: "POST", headers, body: form });
  if (!res.ok) throw new Error(`worker /storage/upload failed (${res.status})`);
  const payload = (await res.json()) as { path?: string };
  if (!payload.path) throw new Error("worker /storage/upload: no path");
  return payload.path;
}
