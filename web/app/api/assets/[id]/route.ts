// PATCH d'un asset : bascule favori, corbeille (soft delete) et restauration.
// La purge définitive (> 30 j) est faite par web/scripts/purge-trash.ts.
import { NextRequest, NextResponse } from "next/server";

import {
  deleteAsset,
  getDevUser,
  setAssetFlags,
} from "@/lib/db/queries";

export const runtime = "nodejs";

export const dynamic = "force-dynamic";

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
  const user = await getDevUser();
  await setAssetFlags(user.id, params.id, flags);
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getDevUser();
  await deleteAsset(user.id, params.id);
  return NextResponse.json({ ok: true });
}
