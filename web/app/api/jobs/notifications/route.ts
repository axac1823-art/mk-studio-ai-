// Notifications de jobs : renvoie les jobs récents de l'utilisateur
// (image, vidéo, audio) avec leur statut, pour le badge "cloche" et les
// toasts de fin de génération.
import { NextResponse } from "next/server";

import { requireAuth } from "@/lib/auth";
import sql from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface JobNotification {
  id: string;
  type: "image" | "video" | "audio";
  status: "pending" | "processing" | "complete" | "failed";
  feature?: string;
  error?: string;
  created_at: string;
}

export async function GET() {
  const { dbUser: user } = await requireAuth();

  const imageJobs = await sql<
    Array<{
      id: string;
      type: string;
      status: string;
      error_message: string | null;
      created_at: string;
    }>
  >`
    SELECT id, type, status, error_message, created_at
    FROM jobs
    WHERE user_id = ${user.id}
    ORDER BY created_at DESC
    LIMIT 20
  `;

  const videoJobs = await sql<
    Array<{ id: string; status: string; error_message: string | null; created_at: string }>
  >`
    SELECT id, 'video'::text AS type, status, error_message, created_at
    FROM video_jobs
    WHERE user_id = ${user.id}
    ORDER BY created_at DESC
    LIMIT 20
  `;

  const jobs: JobNotification[] = [
    ...imageJobs.map((j) => ({
      id: j.id,
      type: "image" as const,
      feature: j.type,
      status: j.status as JobNotification["status"],
      error: j.error_message ?? undefined,
      created_at: j.created_at,
    })),
    ...videoJobs.map((j) => ({
      ...j,
      type: "video" as const,
      feature: "video",
      status: j.status as JobNotification["status"],
      error: j.error_message ?? undefined,
    })),
  ]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 20);

  return NextResponse.json({ jobs });
}
