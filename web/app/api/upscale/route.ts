// Route Upscale — crée un job "upscale" à partir d'un upload direct (comme
// Render) OU d'un asset existant. Vérifie le solde, puis délègue au worker
// via POST /upscale. L'asset source n'est JAMAIS remplacé : le résultat est
// un nouvel asset avec parent_generation_id = job source de l'asset.
import { NextRequest, NextResponse } from "next/server";

import { computeCost, getBalance } from "@/lib/credits";
import {
  getAsset,
  getDefaultProject,
  getDevUser,
  getProject,
  insertJob,
  insertSourceAsset,
} from "@/lib/db/queries";
import { startUpscaleJob, uploadSource, WorkerNotConfiguredError } from "@/lib/worker-client";

export const runtime = "nodejs";

export const dynamic = "force-dynamic";

const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/webp"];
const MAX_SIZE = 10 * 1024 * 1024;

function validImageFile(value: unknown): value is File {
  return value instanceof File && ALLOWED_TYPES.includes(value.type) && value.size > 0 && value.size <= MAX_SIZE;
}

function optionalString(form: FormData, key: string): string | undefined {
  const value = form.get(key);
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

export async function POST(req: NextRequest) {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const image = form.get("image");
  const assetIdField = optionalString(form, "assetId");
  const factor = Number(form.get("factor"));
  const enhance = form.get("enhance") === "1" || form.get("enhance") === "true";
  const model = optionalString(form, "model");
  const projectIdField = optionalString(form, "projectId");

  if (factor !== 2 && factor !== 4) {
    return NextResponse.json({ error: "Upscale factor must be 2 or 4." }, { status: 400 });
  }

  const user = await getDevUser();

  // --- Résolution de l'asset source : upload direct -> storage + asset DB,
  //     sinon assetId fourni.
  let assetId: string;
  if (image && validImageFile(image)) {
    const buffer = Buffer.from(await image.arrayBuffer());
    const project = projectIdField
      ? await getProject(user.id, projectIdField)
      : await getDefaultProject(user.id);
    if (!project) {
      return NextResponse.json({ error: "Unknown project." }, { status: 400 });
    }
    const storagePath = await uploadSource(buffer, image.type);
    assetId = await insertSourceAsset({ userId: user.id, projectId: project.id, type: "image", storagePath });
  } else if (assetIdField) {
    assetId = assetIdField;
  } else {
    return NextResponse.json(
      { error: "Please provide an image (PNG, JPEG or WebP, 10 MB max) or select an existing asset." },
      { status: 400 }
    );
  }

  const asset = await getAsset(user.id, assetId);
  if (!asset) {
    return NextResponse.json({ error: "Asset not found." }, { status: 404 });
  }
  if (asset.is_trashed) {
    return NextResponse.json({ error: "Cannot upscale a trashed asset." }, { status: 400 });
  }

  const project = projectIdField
    ? await getProject(user.id, projectIdField)
    : await getProject(user.id, asset.project_id);
  if (!project) {
    return NextResponse.json({ error: "Unknown project." }, { status: 400 });
  }

  const cost = await computeCost({
    feature: "upscale",
    upscaleFactor: factor,
    quality: "standard",
    resolution: "1K",
    quantity: 1,
  });
  const balance = await getBalance();
  if (balance < cost) {
    return NextResponse.json({ error: "insufficient_credits", required: cost, balance }, { status: 402 });
  }

  const jobId = await insertJob({
    userId: user.id,
    projectId: project.id,
    type: "upscale",
    parentGenerationId: asset.generation_id ?? undefined,
    jobInput: {
      assetId: asset.id,
      factor,
      enhance,
      model,
      creditCost: cost,
    },
  });

  try {
    await startUpscaleJob(jobId);
  } catch (err) {
    if (err instanceof WorkerNotConfiguredError) {
      return NextResponse.json(
        { error: "Upscale is not configured yet — please try again later." },
        { status: 503 }
      );
    }
    return NextResponse.json({ error: "Upscale failed, please try again." }, { status: 500 });
  }

  return NextResponse.json({ jobId });
}
