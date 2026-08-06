// Polling du statut d'un video_job.
import { NextRequest, NextResponse } from "next/server";

import { getVideoJob } from "@/lib/db/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const job = await getVideoJob(params.id);
  if (!job) {
    return NextResponse.json({ error: "Job not found." }, { status: 404 });
  }

  return NextResponse.json({
    status: job.status,
    mode: job.mode,
    modelUsed: job.model_used,
    resultUrl: job.result_url,
    progress: job.progress,
    error: job.error_message,
    creditsCharged: job.credits_charged,
  });
}
