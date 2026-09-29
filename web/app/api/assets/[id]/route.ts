// PATCH d'un asset : bascule favori, corbeille (soft delete) et restauration.
// La purge définitive (> 30 j) est faite par web/scripts/purge-trash.ts.
import { NextRequest, NextResponse } from "next/server";

import { requireAuth } from "@/lib/auth";

import {
  deleteAsset,
  getAsset,
  setAssetFlags,
} from "@/lib/db/queries";
import { publicUrl } from "@/lib/worker-client";

export const runtime = "nodejs";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const { dbUser: user } = await requireAuth();
  const asset = await getAsset(user.id, params.id);
  if (!asset || asset.is_trashed) {
    return NextResponse.json({ error: "Asset not found." }, { status: 404 });
  }
  return NextResponse.json({
    asset: {
      id: asset.id,
      projectId: asset.project_id,
      type: asset.type,
      url: publicUrl(asset.storage_path),
      isFavorite: asset.is_favorite,
      createdAt: asset.created_at,
    },
  });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const body = (await req.json().catch(() => null)) as
    | { isFavorite?: unknown; isTrashed?: unknown }
    | null;
  const flags: { isFavorite?: boolean; isTrashed?: boolean } = {};
  if (typeof body?.isFavorite === "boolean") flags.isFavorite = body.isFavorite;
  if (typeof body?.isTrashed === "boolean") flags.isTrashed = body.isTrashed;
  if (flags.isFavorite === undefined && flags.isTrashed === undefined) {
    return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
  }
  const { dbUser: user } = await requireAuth();
  await setAssetFlags(user.id, params.id, flags);
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const { dbUser: user } = await requireAuth();
  await deleteAsset(user.id, params.id);
  return NextResponse.json({ ok: true });
}
