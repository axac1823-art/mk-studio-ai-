// Coûts AFFICHÉS côté client — CLIENT-SAFE.
//
// La config complète (bases de la table action_costs + multiplicateurs
// documentés de lib/credits) est fetchée UNE fois depuis
// /api/config/costs ; la formule appliquée ici est la même que côté
// serveur pour que le coût affiché soit EXACTEMENT le coût facturé.

import { computeVideoCost, type VideoMode } from "@/lib/video-utils";

export interface CostsConfig {
  baseCosts: Record<string, number>;
  videoCosts: Record<string, number>;
  qualityMultiplier: Record<string, number>;
  resolutionSurcharge: Record<string, number>;
  durationMultiplier: Record<string, number>;
}

export interface DisplayCostInput {
  feature: string;
  quality: string;
  resolution: string;
  quantity: number;
  durationSeconds?: number;
  upscaleFactor?: 2 | 4;
}

export async function fetchCostsConfig(): Promise<CostsConfig> {
  const res = await fetch("/api/config/costs", { cache: "no-store" });
  if (!res.ok) throw new Error("failed to load costs config");
  return (await res.json()) as CostsConfig;
}

/** Même formule que lib/credits.computeCost (affiché = facturé). */
export function computeVideoDisplayCost(config: CostsConfig, mode: VideoMode, shotCount: number): number {
  return computeVideoCost(config.videoCosts, mode, shotCount);
}

export function computeDisplayCost(config: CostsConfig, input: DisplayCostInput): number {
  if (input.feature === "animate") {
    const duration = config.durationMultiplier[String(input.durationSeconds ?? 4)] ?? 1;
    return Math.round(config.baseCosts.animate * (config.qualityMultiplier[input.quality] ?? 1) * duration);
  }
  if (input.feature === "upscale") {
    const factor = input.upscaleFactor ?? 2;
    const key = factor === 4 ? "upscale_4x" : "upscale_2x";
    return config.baseCosts[key] ?? 0;
  }
  if (input.feature === "video_upscale") {
    const factor = input.upscaleFactor ?? 2;
    const key = factor === 4 ? "video_upscale_4x" : "video_upscale_2x";
    return config.baseCosts[key] ?? 0;
  }
  // Coûts fixes des nouvelles actions (pas de multiplicateur qualité/résolution en V1).
  const fixed = config.baseCosts[input.feature];
  if (fixed !== undefined) return fixed;

  const base = config.baseCosts[input.feature] ?? 0;
  const unit =
    base * (config.qualityMultiplier[input.quality] ?? 1) +
    (config.resolutionSurcharge[input.resolution] ?? 0);
  return unit * input.quantity;
}
