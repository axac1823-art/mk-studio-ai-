// Route de création d'un job video_edit (trim / concat / speed / overlay / export).
import { NextRequest, NextResponse } from "next/server";

import { requireAuth } from "@/lib/auth";
import { computeCost, getBalance } from "@/lib/credits";
import {
  ensureDefaultProject,
  getAsset,
  getDefaultProject,
  getProject,
  insertJob,
  insertSourceAsset,
} from "@/lib/db/queries";
import {
  WorkerNotConfiguredError,
  isWorkerConfigured,
  startVideoEditJob,
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

class ResponseError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function resolveUploadedVideo(userId: string, projectId: string, file: File): Promise<string> {
  if (!VIDEO_MIME_TYPES.includes(file.type as (typeof VIDEO_MIME_TYPES)[number])) {
    throw new ResponseError("Unsupported video format. Use MP4, WebM or QuickTime.", 400);
  }
  if (file.size > MAX_VIDEO_SIZE_BYTES) {
    throw new ResponseError("Video must be under 100 MB.", 400);
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

  const operation = form.get("operation");
  const VALID_OPERATIONS = ["trim", "concat", "speed", "overlay", "export"] as const;
  if (!VALID_OPERATIONS.includes(operation as (typeof VALID_OPERATIONS)[number])) {
    return NextResponse.json({ error: "Operation must be one of: trim, concat, speed, overlay, export." }, { status: 400 });
  }

  const { dbUser: user } = await requireAuth();
  const projectIdField = optionalString(form, "projectId");

  let jobInput: Record<string, unknown>;
  let feature: string;
  let singleAssetProjectId: string | undefined;

  async function requireVideoAsset(field: string): Promise<{ id: string; project_id: string }> {
    const assetId = optionalString(form, field);
    const videoFile = form.get("video");

    if (assetId) {
      if (videoFile instanceof File) {
        throw new ResponseError("Provide either an existing asset or an upload, not both.", 400);
      }
      const asset = await getAsset(user.id, assetId);
      if (!asset || asset.type !== "video" || asset.is_trashed) {
        throw new ResponseError("Invalid video asset.", 400);
      }
      return asset;
    }

    if (videoFile instanceof File) {
      const project = projectIdField
        ? await getProject(user.id, projectIdField)
        : await ensureDefaultProject(user.id);
      if (!project) {
        throw new ResponseError("Unknown project.", 400);
      }
      singleAssetProjectId = project.id;
      const uploadedAssetId = await resolveUploadedVideo(user.id, project.id, videoFile);
      const asset = await getAsset(user.id, uploadedAssetId);
      if (!asset || asset.type !== "video" || asset.is_trashed) {
        throw new ResponseError("Invalid uploaded video asset.", 400);
      }
      return asset;
    }

    throw new ResponseError("Select an existing video or upload one.", 400);
  }

  try {
    if (operation === "trim") {
      const asset = await requireVideoAsset("assetId");
      const startRaw = Number(form.get("startSeconds"));
      const endRaw = Number(form.get("endSeconds"));
      if (!Number.isFinite(startRaw) || !Number.isFinite(endRaw) || endRaw <= startRaw || startRaw < 0) {
        throw new ResponseError("Invalid trim range.", 400);
      }
      feature = "video_edit_trim";
      jobInput = {
        operation: "trim",
        assetId: asset.id,
        startSeconds: startRaw,
        endSeconds: endRaw,
      };
    } else if (operation === "concat") {
      const assetIds = form.getAll("assetIds").filter((v): v is string => typeof v === "string" && v.length > 0);
      if (assetIds.length < 2) {
        throw new ResponseError("Concat requires at least two assets.", 400);
      }
      const assets = await Promise.all(assetIds.map((id) => getAsset(user.id, id)));
      if (assets.some((a) => !a || a.type !== "video" || a.is_trashed)) {
        throw new ResponseError("Invalid video assets.", 400);
      }
      feature = "video_edit_concat";
      jobInput = {
        operation: "concat",
        assetIds,
      };
    } else if (operation === "speed") {
      const asset = await requireVideoAsset("assetId");
      const speed = Number(form.get("speed"));
      if (!Number.isFinite(speed) || speed <= 0 || speed > 4) {
        throw new ResponseError("Speed must be between 0.1 and 4x.", 400);
      }
      feature = "video_edit_speed";
      jobInput = { operation: "speed", assetId: asset.id, speed };
    } else if (operation === "overlay") {
      const asset = await requireVideoAsset("assetId");
      const text = form.get("text");
      if (typeof text !== "string" || text.trim().length === 0 || text.length > 200) {
        throw new ResponseError("Overlay text must be 1-200 characters.", 400);
      }
      const position = form.get("position");
      const positionValue = typeof position === "string" && ["top", "bottom", "center"].includes(position) ? position : "bottom";
      feature = "video_edit_overlay";
      jobInput = { operation: "overlay", assetId: asset.id, text: text.trim(), position: positionValue };
    } else if (operation === "export") {
      const asset = await requireVideoAsset("assetId");
      const width = Number(form.get("width"));
      const height = Number(form.get("height"));
      if (!Number.isInteger(width) || !Number.isInteger(height) || width < 240 || height < 240) {
        throw new ResponseError("Export resolution must be at least 240x240.", 400);
      }
      feature = "video_edit_export";
      jobInput = { operation: "export", assetId: asset.id, width, height };
    } else {
      // Validation plus haut rend ce cas impossible, mais TypeScript l'apprécie.
      throw new ResponseError("Unknown operation.", 400);
    }
  } catch (err) {
    if (err instanceof ResponseError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }

  const cost = await computeCost({ feature, quality: "standard", resolution: "1K", quantity: 1 });
  const balance = await getBalance();
  if (balance < cost) {
    return NextResponse.json({ error: "insufficient_credits", required: cost, balance }, { status: 402 });
  }

  jobInput.creditCost = cost;

  const project = projectIdField
    ? await getProject(user.id, projectIdField)
    : singleAssetProjectId
      ? await getProject(user.id, singleAssetProjectId)
      : await getDefaultProject(user.id);
  if (!project) {
    return NextResponse.json({ error: "Unknown project." }, { status: 400 });
  }

  const jobId = await insertJob({
    userId: user.id,
    projectId: project.id,
    type: "video_edit",
    jobInput,
  });

  try {
    await startVideoEditJob(jobId);
  } catch (err) {
    if (err instanceof WorkerNotConfiguredError) {
      return NextResponse.json({ error: "Video editing is not configured yet — please try again later." }, { status: 503 });
    }
    return NextResponse.json({ error: "Edit failed, please try again." }, { status: 500 });
  }

  return NextResponse.json({ jobId });
}
