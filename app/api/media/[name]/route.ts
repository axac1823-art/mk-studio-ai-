// Sert les vidéos produites côté serveur (Sora, ou sortie du serveur
// ComfyUI local i2v), stockées dans le dossier temporaire local
// (lib/ai/media.ts). REMPLACÉ par les URLs signées S3/Supabase Storage au
// jalon DB.
import { NextRequest, NextResponse } from "next/server";

import { readMediaFile } from "@/lib/ai/media";

export const runtime = "nodejs";

export async function GET(_req: NextRequest, { params }: { params: { name: string } }) {
  const file = await readMediaFile(params.name);
  if (!file) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
  return new NextResponse(new Uint8Array(file), {
    headers: {
      "Content-Type": "video/mp4",
      "Content-Length": String(file.length),
      "Cache-Control": "private, max-age=3600",
    },
  });
}
