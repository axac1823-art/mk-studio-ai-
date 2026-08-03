// Proxy vers le worker pour la liste des modèles disponibles.
// Le client ne connaît que key/name/description ; model_id et provider
// restent internes au worker.
import { NextResponse } from "next/server";

import { WorkerNotConfiguredError, baseUrl } from "@/lib/worker-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const res = await fetch(`${baseUrl()}/models`, { cache: "no-store" });
    if (!res.ok) throw new Error(`worker /models failed (${res.status})`);
    const data = (await res.json()) as { image?: unknown[]; video?: unknown[]; upscale?: unknown[] };
    return NextResponse.json({
      image: Array.isArray(data.image) ? data.image : [],
      video: Array.isArray(data.video) ? data.video : [],
      upscale: Array.isArray(data.upscale) ? data.upscale : [],
    });
  } catch (err) {
    if (err instanceof WorkerNotConfiguredError) {
      return NextResponse.json({ image: [], video: [] }, { status: 503 });
    }
    return NextResponse.json({ error: "Failed to load models." }, { status: 502 });
  }
}
