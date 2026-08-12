// Liste et upload des assets de l'utilisateur — galerie du studio et
// pages Projects/Favorites/Uploads/Trash. Les URLs sont absolues (worker
// public) : le navigateur n'a jamais à connaître l'adresse interne.
import { NextRequest, NextResponse } from "next/server";

import { requireAuth } from "@/lib/auth";
import { ensureDefaultProject, insertSourceAsset, listAssets } from "@/lib/db/queries";
import { publicUrl, uploadSource } from "@/lib/worker-client";

export const runtime = "nodejs";

export const dynamic = "force-dynamic";

const ALLOWED_TYPES: Record<string, "image" | "video" | "audio"> = {
  "image/png": "image",
  "image/jpeg": "image",
  "image/webp": "image",
  "video/mp4": "video",
  "video/webm": "video",
  "video/quicktime": "video",
  "audio/mpeg": "audio",
  "audio/wav": "audio",
  "audio/webm": "audio",
};
const MAX_IMAGE_SIZE = 10 * 1024 * 1024;
const MAX_VIDEO_SIZE = 100 * 1024 * 1024;
const MAX_AUDIO_SIZE = 25 * 1024 * 1024;

export async function GET(req: NextRequest) {
  const params = new URL(req.url).searchParams;
  const typeParam = params.get("type");
  const { dbUser: user } = await requireAuth();
  const assets = await listAssets(user.id, {
    projectId: params.get("project_id") ?? undefined,
    type: typeParam === "image" || typeParam === "video" || typeParam === "audio" ? typeParam : undefined,
    favorite: params.get("favorite") === "1" ? true : undefined,
    trashed: params.get("trashed") === "1",
    uploadsOnly: params.get("uploads") === "1",
  });
  return NextResponse.json({
    assets: assets.map((asset) => ({
      id: asset.id,
      projectId: asset.project_id,
      type: asset.type,
      url: publicUrl(asset.storage_path),
      isFavorite: asset.is_favorite,
      generationId: asset.generation_id,
      createdAt: asset.created_at,
    })),
  });
}

export async function POST(req: NextRequest) {
  const { dbUser: user } = await requireAuth();

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing file." }, { status: 400 });
  }

  const assetType = ALLOWED_TYPES[file.type];
  if (!assetType) {
    return NextResponse.json({ error: "Unsupported file type." }, { status: 400 });
  }

  const maxSize = assetType === "video" ? MAX_VIDEO_SIZE : assetType === "audio" ? MAX_AUDIO_SIZE : MAX_IMAGE_SIZE;
  if (file.size > maxSize) {
    return NextResponse.json({ error: `File too large (${maxSize / (1024 * 1024)} MB max).` }, { status: 400 });
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const storagePath = await uploadSource(buffer, file.type);
    const project = await ensureDefaultProject(user.id);
    const assetId = await insertSourceAsset({
      userId: user.id,
      projectId: project.id,
      type: assetType,
      storagePath,
    });
    return NextResponse.json({
      asset: {
        id: assetId,
        projectId: project.id,
        type: assetType,
        url: publicUrl(storagePath),
        isFavorite: false,
        generationId: null,
        createdAt: new Date().toISOString(),
      },
    });
  } catch {
    return NextResponse.json({ error: "Upload failed, please try again." }, { status: 500 });
  }
}
