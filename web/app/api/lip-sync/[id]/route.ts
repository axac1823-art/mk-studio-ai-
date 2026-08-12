// Polling du statut d'un job lip_sync.
import { NextRequest, NextResponse } from "next/server";

import { requireAuth } from "@/lib/auth";
import { getJobForUser, listAssetsForJob } from "@/lib/db/queries";
import { publicUrl } from "@/lib/worker-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const { dbUser: user } = await requireAuth();
  const job = await getJobForUser(params.id, user.id);
  if (!job || job.type !== "lip_sync") {
    return NextResponse.json({ error: "Job not found." }, { status: 404 });
  }

  if (job.status === "complete") {
    const assets = await listAssetsForJob(job.id);
    const asset = assets[0];
    return NextResponse.json({
      status: "complete",
      resultUrl: asset ? publicUrl(asset.storage_path) : null,
      assetId: asset?.id ?? null,
      creditsCharged: job.credits_charged,
    });
  }

  if (job.status === "failed") {
    return NextResponse.json({
      status: "failed",
      error: job.error_message ?? "Generation failed, please try again.",
    });
  }

  return NextResponse.json({ status: job.status });
}
