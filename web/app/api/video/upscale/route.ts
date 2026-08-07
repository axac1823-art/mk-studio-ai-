// Route de création d'un job video_upscale.
import { NextRequest, NextResponse } from "next/server";

import { computeCost, getBalance } from "@/lib/credits";
import { getAsset, getDefaultProject, getDevUser, getProject, insertJob } from "@/lib/db/queries";
import { WorkerNotConfiguredError, isWorkerConfigured, startVideoUpscaleJob } from "@/lib/worker-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

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

  const assetId = optionalString(form, "assetId");
  if (!assetId) {
    return NextResponse.json({ error: "Missing assetId." }, { status: 400 });
  }

  const user = await getDevUser();
  const asset = await getAsset(user.id, assetId);
  if (!asset || asset.type !== "video" || asset.is_trashed) {
    return NextResponse.json({ error: "Invalid video asset." }, { status: 400 });
  }

  const projectIdField = optionalString(form, "projectId");
  const project = projectIdField ? await getProject(user.id, projectIdField) : await getProject(user.id, asset.project_id);
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
