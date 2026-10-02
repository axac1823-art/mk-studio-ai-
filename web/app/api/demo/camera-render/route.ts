import { NextRequest, NextResponse } from "next/server";

import { getJobForUser, insertJob, listAssetsForJob, markJobFailed } from "@/lib/db/queries";
import sql from "@/lib/db";
import { getClientIp, checkRateLimit } from "@/lib/rate-limit";
import { isWorkerConfigured, publicUrl, startImageJob, WorkerNotConfiguredError } from "@/lib/worker-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEMO_EMAIL = "public-camera-demo@renderstudio.local";
const DEMO_PROJECT_ID = "e87f18bf-70f5-47dc-89ab-3f6fa44f5e90";
const MAX_IMAGE_SIZE = 10 * 1024 * 1024;
const IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp"];
const ASPECT_RATIOS = ["1:1", "16:9", "9:16", "4:3", "3:4"] as const;

type CameraState = {
  azimuth: number;
  elevation: number;
  distance: number;
  height: number;
  target: { x: number; y: number; z: number };
  fov: number;
  roll: number;
  zoom: number;
  projection: "perspective";
};

function parseCameraState(value: FormDataEntryValue | null): CameraState | null {
  if (typeof value !== "string") return null;
  try {
    const raw = JSON.parse(value) as Record<string, unknown>;
    const target = raw.target as Record<string, unknown> | undefined;
    const values = [raw.azimuth, raw.elevation, raw.distance, raw.height, raw.fov, raw.roll, raw.zoom, target?.x, target?.y, target?.z];
    if (!values.every((item) => typeof item === "number" && Number.isFinite(item))) return null;
    const [azimuth, elevation, distance, height, fov, roll, zoom, x, y, z] = values as number[];
    if (azimuth < 0 || azimuth >= 360 || elevation < -30 || elevation > 60 || distance < 1 || distance > 10 || height < -100 || height > 100 || fov < 20 || fov > 100 || roll < -180 || roll > 180 || zoom < 0.5 || zoom > 3 || [x, y, z].some((coordinate) => Math.abs(coordinate) > 100)) return null;
    return { azimuth, elevation, distance, height, target: { x, y, z }, fov, roll, zoom, projection: "perspective" };
  } catch {
    return null;
  }
}

async function getDemoIdentity(create = false): Promise<{ userId: string; projectId: string } | null> {
  const users = create
    ? await sql<Array<{ id: string }>>`
        INSERT INTO users (email, display_name)
        VALUES (${DEMO_EMAIL}, 'Public Camera Demo')
        ON CONFLICT (email) DO UPDATE SET display_name = users.display_name
        RETURNING id`
    : await sql<Array<{ id: string }>>`SELECT id FROM users WHERE email = ${DEMO_EMAIL} LIMIT 1`;
  if (!users[0]) return null;
  const userId = users[0].id;
  if (create) {
    await sql`
      INSERT INTO projects (id, user_id, name)
      VALUES (${DEMO_PROJECT_ID}, ${userId}, 'Public Camera Demo')
      ON CONFLICT (id) DO NOTHING`;
  }
  const projects = await sql<Array<{ id: string }>>`
    SELECT id FROM projects WHERE id = ${DEMO_PROJECT_ID} AND user_id = ${userId} LIMIT 1`;
  if (!projects[0]) throw new Error("Public camera project is unavailable.");
  return { userId, projectId: projects[0].id };
}

export async function POST(request: NextRequest) {
  const limit = checkRateLimit("public-camera-render", getClientIp(request), { max: 6, windowMs: 60_000 });
  if (!limit.allowed) {
    return NextResponse.json({ error: "Please wait before creating another camera render." }, { status: 429, headers: { "Retry-After": String(limit.retryAfter) } });
  }
  if (!(await isWorkerConfigured())) {
    return NextResponse.json({ error: "Image generation is not configured yet." }, { status: 503 });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid render request." }, { status: 400 });
  }

  const cameraGuide = form.get("cameraGuide");
  const subjectReference = form.get("image");
  const cameraState = parseCameraState(form.get("cameraState"));
  const requestedAspectRatio = form.get("aspectRatio");
  const aspectRatio = ASPECT_RATIOS.includes(requestedAspectRatio as (typeof ASPECT_RATIOS)[number])
    ? requestedAspectRatio as (typeof ASPECT_RATIOS)[number]
    : "4:3";
  if (!(cameraGuide instanceof File) || !IMAGE_TYPES.includes(cameraGuide.type) || cameraGuide.size === 0 || cameraGuide.size > MAX_IMAGE_SIZE ||
      !(subjectReference instanceof File) || !IMAGE_TYPES.includes(subjectReference.type) || subjectReference.size === 0 || subjectReference.size > MAX_IMAGE_SIZE || !cameraState) {
    return NextResponse.json({ error: "A valid camera guide, subject reference, and camera position are required." }, { status: 400 });
  }

  try {
    const identity = await getDemoIdentity(true);
    if (!identity) throw new Error("Public camera identity is unavailable.");
    const { userId, projectId } = identity;
    const guideBytes = Buffer.from(await cameraGuide.arrayBuffer());
    const imageUrl = `data:${cameraGuide.type};base64,${guideBytes.toString("base64")}`;
    const subjectBytes = Buffer.from(await subjectReference.arrayBuffer());
    const referenceUrls = [`data:${subjectReference.type};base64,${subjectBytes.toString("base64")}`];
    const jobId = await insertJob({
      userId,
      projectId,
      type: "multi_angle",
      jobInput: {
        feature: "multi_angle",
        imageUrl,
        referenceUrls,
        quality: "standard",
        aspectRatio,
        resolution: "1K",
        quantity: 1,
        cameraState,
        creditCost: 0,
      },
    });
    try {
      await startImageJob(jobId);
    } catch (error) {
      await markJobFailed(jobId);
      if (error instanceof WorkerNotConfiguredError) {
        return NextResponse.json({ error: "Image generation is not configured yet." }, { status: 503 });
      }
      throw error;
    }
    return NextResponse.json({ jobId });
  } catch {
    return NextResponse.json({ error: "Could not start image generation. Please try again." }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("id");
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ status: "error" }, { status: 400 });
  try {
    const identity = await getDemoIdentity();
    if (!identity) return NextResponse.json({ status: "error" }, { status: 404 });
    const job = await getJobForUser(id, identity.userId);
    if (!job || job.project_id !== identity.projectId) return NextResponse.json({ status: "error" }, { status: 404 });
    if (job.status === "complete") {
      const assets = await listAssetsForJob(job.id);
      const image = assets.find((asset) => asset.type === "image");
      return image
        ? NextResponse.json({ status: "done", outputUrl: publicUrl(image.storage_path) })
        : NextResponse.json({ status: "error", error: "The generated image is missing." });
    }
    if (job.status === "failed") {
      return NextResponse.json({
        status: "error",
        error: job.error_message ?? "Image generation failed. Please try again.",
      });
    }
    return NextResponse.json({ status: job.status });
  } catch {
    return NextResponse.json({ status: "error", error: "Could not retrieve the generated image." }, { status: 500 });
  }
}
