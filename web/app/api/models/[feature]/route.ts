// Proxy vers le worker pour la liste des modèles d'une feature spécifique.
// Utilisé par les workspaces qui changent de feature (studio/onglets) afin
// de n'exposer que les candidats pertinents pour l'outil actuel.
import { NextResponse } from "next/server";

import { WorkerNotConfiguredError, baseUrl } from "@/lib/worker-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: { feature: string } }
) {
  const { feature } = params;
  try {
    const res = await fetch(`${baseUrl()}/models/${feature}`, {
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`worker /models/${feature} failed (${res.status})`);
    const data = (await res.json()) as unknown[];
    return NextResponse.json(Array.isArray(data) ? data : []);
  } catch (err) {
    if (err instanceof WorkerNotConfiguredError) {
      return NextResponse.json([], { status: 503 });
    }
    return NextResponse.json({ error: "Failed to load models." }, { status: 502 });
  }
}
