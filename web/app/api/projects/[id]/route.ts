// Détail d'un projet + ses assets (filtre ?type=image|video) — la corbeille
// du projet reste visible via /api/assets?trashed=1. PATCH : renommage et
// cover manuelle (un asset DU projet).
import { NextRequest, NextResponse } from "next/server";

import {
  deleteProject,
  getAsset,
  getDevUser,
  getProject,
  listAssets,
  renameProject,
  setProjectCover,
} from "@/lib/db/queries";
import { publicUrl } from "@/lib/worker-client";

export const runtime = "nodejs";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getDevUser();
  const project = await getProject(user.id, params.id);
  if (!project) {
    return NextResponse.json({ error: "Project not found." }, { status: 404 });
  }
  const typeParam = new URL(req.url).searchParams.get("type");
  const type = typeParam === "image" || typeParam === "video" ? typeParam : undefined;
  const assets = await listAssets(user.id, { projectId: project.id, type });
  return NextResponse.json({
    project: { id: project.id, name: project.name, coverAssetId: project.cover_asset_id },
    assets: assets.map((asset) => ({
      id: asset.id,
      type: asset.type,
      url: publicUrl(asset.storage_path),
      isFavorite: asset.is_favorite,
      generationId: asset.generation_id,
      createdAt: asset.created_at,
    })),
  });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const body = (await req.json().catch(() => null)) as
    | { name?: unknown; coverAssetId?: unknown }
    | null;
  const user = await getDevUser();
  const project = await getProject(user.id, params.id);
  if (!project) {
    return NextResponse.json({ error: "Project not found." }, { status: 404 });
  }

  if (typeof body?.name === "string" && body.name.trim()) {
    await renameProject(user.id, project.id, body.name.trim().slice(0, 120));
  }
  if (body?.coverAssetId !== undefined) {
    if (body.coverAssetId !== null && typeof body.coverAssetId === "string") {
      // La cover doit être un asset DU projet (sinon refus sec).
      const asset = await getAsset(user.id, body.coverAssetId);
      if (!asset || asset.project_id !== project.id) {
        return NextResponse.json({ error: "Cover asset not in this project." }, { status: 400 });
      }
    }
    await setProjectCover(
      user.id,
      project.id,
      typeof body.coverAssetId === "string" ? body.coverAssetId : null
    );
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getDevUser();
  const project = await getProject(user.id, params.id);
  if (!project) {
    return NextResponse.json({ error: "Project not found." }, { status: 404 });
  }
  await deleteProject(user.id, project.id);
  return NextResponse.json({ ok: true });
}
