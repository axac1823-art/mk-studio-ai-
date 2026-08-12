// Route de création d'un job lip_sync (Magic Hour).
// Valide les entrées vidéo + audio, calcule le coût, crée le job et délègue au worker.
import { NextRequest, NextResponse } from "next/server";

import { requireAuth } from "@/lib/auth";
import { computeCost, getBalance } from "@/lib/credits";
import { getDefaultProject, getProject, insertJob } from "@/lib/db/queries";
import { WorkerNotConfiguredError, isWorkerConfigured, startLipSyncJob, uploadSource } from "@/lib/worker-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const ALLOWED_VIDEO_TYPES = ["video/mp4", "video/webm", "video/quicktime"];
const ALLOWED_AUDIO_TYPES = ["audio/mpeg", "audio/mp3", "audio/wav", "audio/x-m4a", "audio/mp4"];
const MAX_VIDEO_SIZE = 50 * 1024 * 1024;
const MAX_AUDIO_SIZE = 20 * 1024 * 1024;

function optionalString(form: FormData, key: string): string | undefined {
  const value = form.get(key);
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function validVideo(value: unknown, maxSize: number): value is File {
  return value instanceof File && ALLOWED_VIDEO_TYPES.includes(value.type) && value.size > 0 && value.size <= maxSize;
}

function validAudio(value: unknown, maxSize: number): value is File {
  return value instanceof File && ALLOWED_AUDIO_TYPES.includes(value.type) && value.size > 0 && value.size <= maxSize;
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

  const video = form.get("video");
  const audio = form.get("audio");

  if (!validVideo(video, MAX_VIDEO_SIZE)) {
    return NextResponse.json(
      { error: "Please provide a valid video file (MP4/WebM/MOV, 50 MB max)." },
      { status: 400 }
    );
  }
  if (!validAudio(audio, MAX_AUDIO_SIZE)) {
    return NextResponse.json(
      { error: "Please provide a valid audio file (MP3/WAV/M4A, 20 MB max)." },
      { status: 400 }
    );
  }

  const projectIdField = optionalString(form, "projectId");
  const { dbUser: user } = await requireAuth();
  const project = projectIdField ? await getProject(user.id, projectIdField) : await getDefaultProject(user.id);
  if (!project) {
    return NextResponse.json({ error: "Unknown project." }, { status: 400 });
  }

  const cost = await computeCost({ feature: "lip_sync", quality: "standard", resolution: "1K", quantity: 1 });
  const balance = await getBalance();
  if (balance < cost) {
    return NextResponse.json({ error: "insufficient_credits", required: cost, balance }, { status: 402 });
  }

  const [videoUrl, audioUrl] = await Promise.all([
    uploadSource(Buffer.from(await video.arrayBuffer()), video.type),
    uploadSource(Buffer.from(await audio.arrayBuffer()), audio.type),
  ]);

  const jobId = await insertJob({
    userId: user.id,
    projectId: project.id,
    type: "lip_sync",
    jobInput: {
      videoUrl,
      audioUrl,
      quality: "standard",
      creditCost: cost,
    },
  });

  try {
    await startLipSyncJob(jobId);
  } catch (err) {
    if (err instanceof WorkerNotConfiguredError) {
      return NextResponse.json({ error: "Lip sync is not configured yet — please try again later." }, { status: 503 });
    }
    return NextResponse.json({ error: "Generation failed, please try again." }, { status: 500 });
  }

  return NextResponse.json({ jobId });
}
