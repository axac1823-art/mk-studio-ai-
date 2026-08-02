// Config des coûts pour l'AFFICHAGE client : bases de la table
// action_costs + multiplicateurs documentés (lib/credits). Le client
// applique la MÊME formule que le serveur — affiché = facturé.
import { NextResponse } from "next/server";

import { DURATION_MULTIPLIER, QUALITY_MULTIPLIER, RESOLUTION_SURCHARGE } from "@/lib/credits";
import { getActionCosts } from "@/lib/db/queries";

export const runtime = "nodejs";

export const dynamic = "force-dynamic";

export async function GET() {
  const baseCosts = await getActionCosts();
  return NextResponse.json({
    baseCosts,
    qualityMultiplier: QUALITY_MULTIPLIER,
    resolutionSurcharge: RESOLUTION_SURCHARGE,
    durationMultiplier: DURATION_MULTIPLIER,
  });
}
