// Liste des assets de l'utilisateur avec filtres — galerie du studio et
// pages Projects/Favorites/Uploads/Trash. Les URLs sont absolues (worker
// public) : le navigateur n'a jamais à connaître l'adresse interne.
import { NextRequest, NextResponse } from "next/server";

import { getDevUser, listAssets } from "@/lib/db/queries";
import { publicUrl } from "@/lib/worker-client";

export const runtime = "nodejs";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const params = new URL(req.url).searchParams;
  const typeParam = params.get("type");
  const user = await getDevUser();
  const assets = await listAssets(user.id, {
    projectId: params.get("project_id") ?? undefined,
    type: typeParam === "image" || typeParam === "video" ? typeParam : undefined,
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
