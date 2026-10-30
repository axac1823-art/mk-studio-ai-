// Route de création d'un job video_upscale.
import { NextRequest, NextResponse } from "next/server";

import { requireAuth } from "@/lib/auth";
import { computeCost, getBalance } from "@/lib/credits";
import { ensureDefaultProject, getAsset, getProject, insertJob, insertSourceAsset } from "@/lib/db/queries";
import { VIDEO_UPSCALE_RESOLUTIONS, type VideoUpscaleProvider } from "@/lib/video-upscale-options";
import {
  WorkerNotConfiguredError,
  getVideoUpscaleProviders,
  isWorkerReachable,
  startVideoUpscaleJob,
  uploadSource,
} from "@/lib/worker-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const VIDEO_MIME_TYPES = ["video/mp4", "video/webm", "video/quicktime"] as const;
const MAX_VIDEO_SIZE_BYTES = 200 * 1024 * 1024;

function optionalString(form: FormData, key: string): string | undefined {
  const value = form.get(key);
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

async function resolveUploadedVideo(userId: string, projectId: string, file: File): Promise<string> {
  if (!VIDEO_MIME_TYPES.includes(file.type as (typeof VIDEO_MIME_TYPES)[number])) {
    throw new Error("Unsupported video format. Use MP4, WebM or QuickTime.");
  }
  if (file.size > MAX_VIDEO_SIZE_BYTES || file.size < 512) {
    throw new Error("Video must be between 512 bytes and 200 MB.");
  }
  const buffer = Buffer.from(await file.arrayBuffer());
  const signatureOk = file.type === "video/mp4" ? buffer.includes(Buffer.from("ftyp"))
    : file.type === "video/webm" ? buffer.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]))
      : file.type === "video/quicktime" ? buffer.includes(Buffer.from("ftyp")) : false;
  if (!signatureOk) throw new Error("The file contents do not match a supported video format.");
  const storagePath = await uploadSource(buffer, file.type);
  return insertSourceAsset({ userId, projectId, type: "video", storagePath });
}

export async function POST(req: NextRequest) {
  if (!(await isWorkerReachable())) {
    return NextResponse.json({ error: "Video processor is unavailable — please try again later." }, { status: 503 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const { dbUser: user } = await requireAuth();
  const provider = optionalString(form, "provider") ?? "hitpaw";
  if (!["runway_magnific", "magichour", "hitpaw"].includes(provider)) {
    return NextResponse.json({ error: "Select a supported video upscaling AI." }, { status: 400 });
  }
  if (provider === "magichour") {
    const providers = await getVideoUpscaleProviders();
    const magicHour = providers?.find((option) => option.key === "magichour");
    if (!magicHour?.configured) {
      return NextResponse.json({ error: "Magic Hour is not configured on the worker." }, { status: 503 });
    }
    if (!magicHour.available) {
      return NextResponse.json({ error: "Magic Hour Video Upscaler requires a paid Magic Hour API plan. Upgrade the plan linked to your API key, or choose another AI provider." }, { status: 403 });
    }
  }
  if (provider === "hitpaw") {
    const providers = await getVideoUpscaleProviders();
    const hitpaw = providers?.find((option) => option.key === "hitpaw");
    if (!hitpaw?.configured) {
      return NextResponse.json({ error: "HitPaw is not configured on the worker. Set HITPAW_API_KEY to enable it." }, { status: 503 });
    }
  }
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

  const resolution = optionalString(form, "resolution") ?? "2k";
  const flavor = optionalString(form, "flavor") ?? "natural";
  const intOption = (name: string, fallback: number) => {
    const value = Number(form.get(name) ?? fallback);
    return Number.isInteger(value) && value >= 0 && value <= 100 ? value : null;
  };
  const creativity = intOption("creativity", 25);
  const sharpen = intOption("sharpen", 25);
  const smartGrain = intOption("smartGrain", 0);
  const allowedResolutions = VIDEO_UPSCALE_RESOLUTIONS[provider as VideoUpscaleProvider];
  if (!allowedResolutions.includes(resolution) || (provider === "runway_magnific" && !["natural", "vivid"].includes(flavor)) || creativity === null || sharpen === null || smartGrain === null) {
    return NextResponse.json({ error: "Invalid video upscaling settings." }, { status: 400 });
  }
  const fpsBoost = optionalString(form, "fpsBoost") === "true";
  const cost = await computeCost({ feature: "video_upscale_speed", quality: "standard", resolution: "1K", quantity: 1 });
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
      provider,
      resolution, creativity, sharpen, smartGrain, flavor, fpsBoost,
      creditCost: cost,
    },
  });

  try {
    await startVideoUpscaleJob(jobId);
  } catch (err) {
    if (err instanceof WorkerNotConfiguredError) {
      return NextResponse.json({ error: "Video processing is not configured yet — please try again later." }, { status: 503 });
    }
    return NextResponse.json({ error: "Video processing failed, please try again." }, { status: 500 });
  }

  return NextResponse.json({ jobId });
}
