// Polling du statut d'un video_job.
import { NextRequest, NextResponse } from "next/server";

import { getVideoJobForUser } from "@/lib/db/queries";
import { requireAuth } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const { dbUser: user } = await requireAuth();
  const job = await getVideoJobForUser(params.id, user.id);
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
