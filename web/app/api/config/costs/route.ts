// Config des coûts pour l'AFFICHAGE client : bases de la table
// action_costs + multiplicateurs documentés (lib/credits) + coûts provider
// (margin × cost_per_generation). Le client applique la MÊME formule que le
// serveur — affiché = facturé.
import { NextResponse } from "next/server";

import { DURATION_MULTIPLIER, QUALITY_MULTIPLIER, RESOLUTION_SURCHARGE } from "@/lib/credits";
import {
  getActionCosts,
  getActionMargins,
  getAppConfigNumber,
  getVideoActionCosts,
  getVideoActionMargins,
} from "@/lib/db/queries";
import { WorkerNotConfiguredError, baseUrl } from "@/lib/worker-client";

export const runtime = "nodejs";

export const dynamic = "force-dynamic";

interface WorkerModelEntry {
  key: string;
  name?: string;
  costPerGeneration?: number;
}

async function fetchModelCosts() {
  try {
    const res = await fetch(`${baseUrl()}/models`, { cache: "no-store" });
    if (!res.ok) return {};
    const data = (await res.json()) as {
      image?: WorkerModelEntry[];
      video?: WorkerModelEntry[];
    };
    const costs: Record<string, Record<string, number>> = {};
    for (const category of ["image", "video"] as const) {
      const list = data[category] ?? [];
      costs[category] = Object.fromEntries(
        list
          .filter((m) => typeof m.key === "string" && typeof m.costPerGeneration === "number")
          .map((m) => [m.key, m.costPerGeneration as number])
      );
    }
    return costs;
  } catch (err) {
    if (err instanceof WorkerNotConfiguredError) return {};
    return {};
  }
}

export async function GET() {
  const [baseCosts, videoCosts, margins, videoMargins, conversionRate, modelCosts] = await Promise.all([
    getActionCosts(),
    getVideoActionCosts(),
    getActionMargins(),
    getVideoActionMargins(),
    getAppConfigNumber("credit_per_usd_cent", 1),
    fetchModelCosts(),
  ]);
  return NextResponse.json({
    baseCosts,
    videoCosts,
    margins,
    videoMargins,
    creditConversionRate: conversionRate,
    modelCosts,
    qualityMultiplier: QUALITY_MULTIPLIER,
    resolutionSurcharge: RESOLUTION_SURCHARGE,
    durationMultiplier: DURATION_MULTIPLIER,
  });
}
