// Route de création d'un job 3d_generator.
// Accepte un prompt (text-to-3D) et/ou jusqu'à 6 images de vues
// (front/back/left/right/top/bottom) pour l'image-to-3D / multi-view.
import { NextRequest, NextResponse } from "next/server";

import { requireAuth } from "@/lib/auth";
import { computeCost, getBalance } from "@/lib/credits";
import { getDefaultProject, getProject, insertJob } from "@/lib/db/queries";
import { WorkerNotConfiguredError, isWorkerConfigured, start3DGeneratorJob, uploadSource } from "@/lib/worker-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const ALLOWED_IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp"];
const MAX_IMAGE_SIZE = 10 * 1024 * 1024;
const MAX_PROMPT_LENGTH = 2000;
const VIEWS = ["front", "back", "left", "right", "top", "bottom"] as const;

function optionalString(form: FormData, key: string): string | undefined {
  const value = form.get(key);
  return typeof value === "string" && value.length > 0 ? value : undefined;
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

  const prompt = optionalString(form, "prompt");
  const hasPrompt = typeof prompt === "string" && prompt.trim().length > 0 && prompt.length <= MAX_PROMPT_LENGTH;
  const selectedModel = optionalString(form, "model");

  const imageUrls: Record<string, string> = {};
  for (const view of VIEWS) {
    const file = form.get(view);
    if (file instanceof File) {
      if (!ALLOWED_IMAGE_TYPES.includes(file.type) || file.size <= 0 || file.size > MAX_IMAGE_SIZE) {
        return NextResponse.json(
          { error: `Invalid ${view} image (PNG/JPEG/WebP, ${MAX_IMAGE_SIZE / 1024 / 1024} MB max).` },
          { status: 400 }
        );
      }
      const buffer = Buffer.from(await file.arrayBuffer());
      imageUrls[view] = await uploadSource(buffer, file.type);
    }
  }
  const hasImage = Object.keys(imageUrls).length > 0;

  if (!hasPrompt && !hasImage) {
    return NextResponse.json(
      { error: "Please provide a prompt or at least one view image." },
      { status: 400 }
    );
  }

  const projectIdField = optionalString(form, "projectId");
  const { dbUser: user } = await requireAuth();
  const project = projectIdField ? await getProject(user.id, projectIdField) : await getDefaultProject(user.id);
  if (!project) {
    return NextResponse.json({ error: "Unknown project." }, { status: 400 });
  }

  const cost = await computeCost({ feature: "3d_generator", quality: "standard", resolution: "1K", quantity: 1 });
  const balance = await getBalance();
  if (balance < cost) {
    return NextResponse.json({ error: "insufficient_credits", required: cost, balance }, { status: 402 });
  }

  const jobInput: Record<string, unknown> = {
    creditCost: cost,
    quality: "standard",
    model: selectedModel || undefined,
  };
  if (hasPrompt) {
    jobInput.prompt = prompt.trim();
  }
  if (hasImage) {
    jobInput.imageUrls = imageUrls;
  }

  const jobId = await insertJob({
    userId: user.id,
    projectId: project.id,
    type: "3d_generator",
    jobInput,
  });

  try {
    await start3DGeneratorJob(jobId);
  } catch (err) {
    if (err instanceof WorkerNotConfiguredError) {
      return NextResponse.json({ error: "3D generation is not configured yet — please try again later." }, { status: 503 });
    }
    return NextResponse.json({ error: "Generation failed, please try again." }, { status: 500 });
  }

  return NextResponse.json({ jobId });
}
