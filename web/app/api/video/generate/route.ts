// Route de création d'un job vidéo unifié (Video Generator).
//
// Le mode est détecté exclusivement par le worker ; ici on valide, calcule
// le coût estimé (affiché = facturé), upload les fichiers vers le worker,
// crée la ligne video_jobs et déclenche le workflow worker.
import { NextRequest, NextResponse } from "next/server";

import { computeVideoCost, resolveVideoMode } from "@/lib/video-utils";
import { getBalance } from "@/lib/credits";
import {
  getDefaultProject,
  getDevUser,
  getProject,
  getVideoActionCosts,
  insertVideoJob,
} from "@/lib/db/queries";
import { WorkerNotConfiguredError, isWorkerConfigured, startVideoJob, uploadSource } from "@/lib/worker-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const ALLOWED_IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp"];
const ALLOWED_VIDEO_TYPES = ["video/mp4", "video/webm", "video/quicktime"];
const MAX_START_END_SIZE = 10 * 1024 * 1024;
const MAX_MEDIA_SIZE = 50 * 1024 * 1024;
const MAX_ATTACHED_MEDIA = 9;
const MAX_PROMPT_LENGTH = 1999;

function validImage(value: unknown, maxSize: number): value is File {
  return value instanceof File && ALLOWED_IMAGE_TYPES.includes(value.type) && value.size > 0 && value.size <= maxSize;
}

function validVideo(value: unknown, maxSize: number): value is File {
  return value instanceof File && ALLOWED_VIDEO_TYPES.includes(value.type) && value.size > 0 && value.size <= maxSize;
}

export async function POST(req: NextRequest) {
  if (!(await isWorkerConfigured())) {
    return NextResponse.json({ error: "Generation is not configured yet — please try again later." }, { status: 503 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const payloadRaw = form.get("payload");
  if (typeof payloadRaw !== "string") {
    return NextResponse.json({ error: "Missing payload." }, { status: 400 });
  }

  let payload: {
    duration: number;
    aspectRatio: string;
    audioEnabled: boolean;
    selectedModel?: string;
    shots: Array<{ id: string; prompt: string; taggedMediaIds: string[] }>;
    mediaMeta: Array<{ tag: string; type: "image" | "video" }>;
  };
  try {
    payload = JSON.parse(payloadRaw);
  } catch {
    return NextResponse.json({ error: "Invalid payload JSON." }, { status: 400 });
  }

  if (!Array.isArray(payload.shots) || payload.shots.length === 0) {
    return NextResponse.json({ error: "At least one shot is required." }, { status: 400 });
  }
  for (const shot of payload.shots) {
    if (typeof shot.prompt !== "string" || shot.prompt.length > MAX_PROMPT_LENGTH) {
      return NextResponse.json({ error: "Invalid shot prompt." }, { status: 400 });
    }
  }

  const startImage = form.get("startImage");
  const endImage = form.get("endImage");
  const hasStartImage = validImage(startImage, MAX_START_END_SIZE);
  const hasEndImage = validImage(endImage, MAX_START_END_SIZE);
  if (startImage instanceof File && !hasStartImage) {
    return NextResponse.json({ error: "Invalid start image (PNG/JPEG/WebP, 10 MB max)." }, { status: 400 });
  }
  if (endImage instanceof File && !hasEndImage) {
    return NextResponse.json({ error: "Invalid end image (PNG/JPEG/WebP, 10 MB max)." }, { status: 400 });
  }

  const mediaMeta = Array.isArray(payload.mediaMeta) ? payload.mediaMeta : [];
  if (mediaMeta.length > MAX_ATTACHED_MEDIA) {
    return NextResponse.json({ error: `Too many attached media (${MAX_ATTACHED_MEDIA} max).` }, { status: 400 });
  }

  const attachedMedia: Array<{ tag: string; asset_url: string; type: "image" | "video" }> = [];
  for (const meta of mediaMeta) {
    const file = form.get(meta.tag);
    const isImage = meta.type === "image" && validImage(file, MAX_MEDIA_SIZE);
    const isVideo = meta.type === "video" && validVideo(file, MAX_MEDIA_SIZE);
    if (!isImage && !isVideo) {
      return NextResponse.json({ error: `Invalid attached media ${meta.tag}.` }, { status: 400 });
    }
    const buffer = Buffer.from(await (file as File).arrayBuffer());
    const storagePath = await uploadSource(buffer, (file as File).type);
    attachedMedia.push({ tag: meta.tag, asset_url: storagePath, type: meta.type });
  }

  const user = await getDevUser();
  const projectIdField = typeof form.get("projectId") === "string" ? (form.get("projectId") as string) : undefined;
  const project = projectIdField ? await getProject(user.id, projectIdField) : await getDefaultProject(user.id);
  if (!project) {
    return NextResponse.json({ error: "Unknown project." }, { status: 400 });
  }

  const duration = [4, 5, 6, 8, 10].includes(payload.duration) ? payload.duration : 4;
  const aspectRatio = ["16:9", "9:16", "1:1"].includes(payload.aspectRatio) ? payload.aspectRatio : "16:9";

  const shotsForDb = payload.shots.map((shot) => ({
    id: shot.id,
    prompt: shot.prompt,
    tagged_media_ids: Array.isArray(shot.taggedMediaIds) ? shot.taggedMediaIds : [],
  }));

  const startImageUrl = hasStartImage
    ? await uploadSource(Buffer.from(await startImage.arrayBuffer()), startImage.type)
    : null;
  const endImageUrl = hasEndImage
    ? await uploadSource(Buffer.from(await endImage.arrayBuffer()), endImage.type)
    : null;

  // Estimation du mode et du coût (le worker recalcule le mode de façon
  // autoritaire au moment de l'exécution).
  const previewMode = resolveVideoMode({
    startImage: startImageUrl,
    endImage: endImageUrl,
    shots: payload.shots,
  });
  const videoCosts = await getVideoActionCosts();
  const cost = computeVideoCost(videoCosts, previewMode, payload.shots.length);
  const balance = await getBalance();
  if (balance < cost) {
    return NextResponse.json({ error: "insufficient_credits", required: cost, balance }, { status: 402 });
  }

  const jobId = await insertVideoJob({
    userId: user.id,
    projectId: project.id,
    startImageUrl,
    endImageUrl,
    mediaReferences: attachedMedia,
    shots: shotsForDb,
    duration,
    aspectRatio,
    audioEnabled: Boolean(payload.audioEnabled),
    selectedModel: payload.selectedModel || null,
  });

  try {
    await startVideoJob(jobId);
  } catch (err) {
    if (err instanceof WorkerNotConfiguredError) {
      return NextResponse.json({ error: "Generation is not configured yet — please try again later." }, { status: 503 });
    }
    return NextResponse.json({ error: "Generation failed, please try again." }, { status: 500 });
  }

  return NextResponse.json({ jobId });
}
