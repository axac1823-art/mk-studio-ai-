// Polling du statut d'un job : le client appelle cette route toutes les
// ~2,5 s jusqu'à "done" (avec outputUrls) ou "error" (message GÉNÉRIQUE).
// Lit DIRECTEMENT la ligne Postgres écrite par le worker — les statuts DB
// (complete/failed) sont mappés vers le contrat client historique
// (done/error), assets inclus pour la galerie et l'upscale.
import { NextRequest, NextResponse } from "next/server";

import { getJob, listAssetsForJob } from "@/lib/db/queries";
import { publicUrl } from "@/lib/worker-client";

export const runtime = "nodejs";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const job = await getJob(params.id);
  if (!job) {
    return NextResponse.json(
      { status: "error", error: "Generation failed, please try again." },
      { status: 404 }
    );
  }

  if (job.status === "complete") {
    const assets = await listAssetsForJob(job.id);
    return NextResponse.json({
      status: "done",
      kind: assets[0]?.type ?? "image",
      outputUrls: assets.map((asset) => publicUrl(asset.storage_path)),
      assetIds: assets.map((asset) => asset.id),
    });
  }
  if (job.status === "failed") {
    return NextResponse.json({
      status: "error",
      error: job.error_message ?? "Generation failed, please try again.",
    });
  }
  // pending / processing : le client repollera.
  return NextResponse.json({ status: job.status });
}
