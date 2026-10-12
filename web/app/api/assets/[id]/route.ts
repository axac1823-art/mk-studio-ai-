// Asset detail/actions: ownership-scoped preview metadata, favorite/trash flags,
// restoration, and permanent deletion. Generation provenance is read-only.
import { NextRequest, NextResponse } from "next/server";

import { requireAuth } from "@/lib/auth";
import { getAssetProvenance } from "@/lib/db/asset-provenance";
import { deleteAsset, getAsset, setAssetFlags } from "@/lib/db/queries";
import { publicUrl } from "@/lib/worker-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const { dbUser: user } = await requireAuth();
  const asset = await getAsset(user.id, params.id);
  if (!asset || asset.is_trashed) {
    return NextResponse.json({ error: "Asset not found." }, { status: 404 });
  }

  const provenance = await getAssetProvenance(user.id, params.id);

  return NextResponse.json({
    asset: {
      id: asset.id,
      projectId: asset.project_id,
      type: asset.type,
      url: publicUrl(asset.storage_path),
      isFavorite: asset.is_favorite,
      createdAt: provenance?.createdAt ?? asset.created_at,
      generationId: provenance?.generationId ?? asset.generation_id,
      videoJobId: provenance?.videoJobId ?? null,
      source: provenance?.source ?? (asset.generation_id ? "generated" : "upload"),
      feature: provenance?.feature ?? null,
      modelUsed: provenance?.modelUsed ?? null,
      selectedModel: provenance?.selectedModel ?? null,
      generationCreatedAt: provenance?.generationCreatedAt ?? null,
      description: provenance?.description ?? null,
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
  const asset = await getAsset(user.id, params.id);
  if (!asset) return NextResponse.json({ error: "Asset not found." }, { status: 404 });
  await setAssetFlags(user.id, params.id, flags);
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const { dbUser: user } = await requireAuth();
  const asset = await getAsset(user.id, params.id);
  if (!asset) return NextResponse.json({ error: "Asset not found." }, { status: 404 });
  await deleteAsset(user.id, params.id);
  return NextResponse.json({ ok: true });
}
