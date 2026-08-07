// Route de création d'un job video_edit (trim / concat).
import { NextRequest, NextResponse } from "next/server";

import { computeCost, getBalance } from "@/lib/credits";
import { getAsset, getDefaultProject, getDevUser, getProject, insertJob } from "@/lib/db/queries";
import { WorkerNotConfiguredError, isWorkerConfigured, startVideoEditJob } from "@/lib/worker-client";

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

  const operation = form.get("operation");
  if (operation !== "trim" && operation !== "concat") {
    return NextResponse.json({ error: "Operation must be 'trim' or 'concat'." }, { status: 400 });
  }

  const user = await getDevUser();
  const projectIdField = optionalString(form, "projectId");
  const project = projectIdField ? await getProject(user.id, projectIdField) : await getDefaultProject(user.id);
  if (!project) {
    return NextResponse.json({ error: "Unknown project." }, { status: 400 });
  }

  let jobInput: Record<string, unknown>;
  let feature: string;

  if (operation === "trim") {
    const assetId = optionalString(form, "assetId");
    if (!assetId) {
      return NextResponse.json({ error: "Missing assetId." }, { status: 400 });
    }
    const asset = await getAsset(user.id, assetId);
    if (!asset || asset.type !== "video" || asset.is_trashed) {
      return NextResponse.json({ error: "Invalid video asset." }, { status: 400 });
    }
    const startRaw = Number(form.get("startSeconds"));
    const endRaw = Number(form.get("endSeconds"));
    if (!Number.isFinite(startRaw) || !Number.isFinite(endRaw) || endRaw <= startRaw || startRaw < 0) {
      return NextResponse.json({ error: "Invalid trim range." }, { status: 400 });
    }
    feature = "video_edit_trim";
    jobInput = {
      operation: "trim",
      assetId: asset.id,
      startSeconds: startRaw,
      endSeconds: endRaw,
    };
  } else {
    const assetIds = form.getAll("assetIds").filter((v): v is string => typeof v === "string" && v.length > 0);
    if (assetIds.length < 2) {
      return NextResponse.json({ error: "Concat requires at least two assets." }, { status: 400 });
    }
    const assets = await Promise.all(assetIds.map((id) => getAsset(user.id, id)));
    if (assets.some((a) => !a || a.type !== "video" || a.is_trashed)) {
      return NextResponse.json({ error: "Invalid video assets." }, { status: 400 });
    }
    feature = "video_edit_concat";
    jobInput = {
      operation: "concat",
      assetIds,
    };
  }

  const cost = await computeCost({ feature, quality: "standard", resolution: "1K", quantity: 1 });
  const balance = await getBalance();
  if (balance < cost) {
    return NextResponse.json({ error: "insufficient_credits", required: cost, balance }, { status: 402 });
  }

  jobInput.creditCost = cost;

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
