// Route de création d'un job video_upscale.
import { NextRequest, NextResponse } from "next/server";

import { requireAuth } from "@/lib/auth";
import { computeCost, getBalance } from "@/lib/credits";
import { ensureDefaultProject, getAsset, getProject, insertJob, insertSourceAsset } from "@/lib/db/queries";
import {
  WorkerNotConfiguredError,
  isWorkerConfigured,
  startVideoUpscaleJob,
  uploadSource,
} from "@/lib/worker-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const VIDEO_MIME_TYPES = ["video/mp4", "video/webm", "video/quicktime"] as const;
const MAX_VIDEO_SIZE_BYTES = 100 * 1024 * 1024;

function optionalString(form: FormData, key: string): string | undefined {
  const value = form.get(key);
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

async function resolveUploadedVideo(userId: string, projectId: string, file: File): Promise<string> {
  if (!VIDEO_MIME_TYPES.includes(file.type as (typeof VIDEO_MIME_TYPES)[number])) {
    throw new Error("Unsupported video format. Use MP4, WebM or QuickTime.");
  }
  if (file.size > MAX_VIDEO_SIZE_BYTES) {
    throw new Error("Video must be under 100 MB.");
  }
  const buffer = Buffer.from(await file.arrayBuffer());
  const storagePath = await uploadSource(buffer, file.type);
  return insertSourceAsset({ userId, projectId, type: "video", storagePath });
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

  const { dbUser: user } = await requireAuth();
  const projectIdField = optionalString(form, "projectId");

  let assetId = optionalString(form, "assetId");
  let asset;

  try {
    if (assetId) {
      asset = await getAsset(user.id, assetId);
      if (!asset || asset.type !== "video" || asset.is_trashed) {
        return NextResponse.json({ error: "Invalid video asset." }, { status: 400 });
      }
    } else {
      const videoFile = form.get("video");
      if (!(videoFile instanceof File)) {
        return NextResponse.json({ error: "Select an existing video or upload one." }, { status: 400 });
      }
      const project = projectIdField
        ? await getProject(user.id, projectIdField)
        : await ensureDefaultProject(user.id);
      if (!project) {
        return NextResponse.json({ error: "Unknown project." }, { status: 400 });
      }
      assetId = await resolveUploadedVideo(user.id, project.id, videoFile);
      asset = await getAsset(user.id, assetId);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to process video upload.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  if (!asset) {
    return NextResponse.json({ error: "Invalid video asset." }, { status: 400 });
  }

  const project = projectIdField
    ? await getProject(user.id, projectIdField)
    : await getProject(user.id, asset.project_id) ?? (await ensureDefaultProject(user.id));
  if (!project) {
    return NextResponse.json({ error: "Unknown project." }, { status: 400 });
  }

  const factorRaw = Number(form.get("factor"));
  const factor = factorRaw === 4 ? 4 : 2;
  const feature = factor === 4 ? "video_upscale_4x" : "video_upscale_2x";

  const cost = await computeCost({ feature, quality: "standard", resolution: "1K", quantity: 1 });
  const balance = await getBalance();
  if (balance < cost) {
    return NextResponse.json({ error: "insufficient_credits", required: cost, balance }, { status: 402 });
  }

  const jobId = await insertJob({
    userId: user.id,
    projectId: project.id,
    type: "video_upscale",
    parentGenerationId: asset.generation_id ?? undefined,
    jobInput: {
      assetId: asset.id,
      factor,
      creditCost: cost,
    },
  });

  try {
    await startVideoUpscaleJob(jobId);
  } catch (err) {
    if (err instanceof WorkerNotConfiguredError) {
      return NextResponse.json({ error: "Video upscaling is not configured yet — please try again later." }, { status: 503 });
    }
    return NextResponse.json({ error: "Upscale failed, please try again." }, { status: 500 });
  }

  return NextResponse.json({ jobId });
}
