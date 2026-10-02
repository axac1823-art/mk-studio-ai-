// Solde de crédits pour l'affichage — somme du ledger (append-only).
import { NextResponse } from "next/server";

import { getBalance } from "@/lib/credits";

export const runtime = "nodejs";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ balance: await getBalance() });
}
