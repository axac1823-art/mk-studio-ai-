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
  margins: Record<string, number>;
  videoMargins: Record<string, number>;
  creditConversionRate: number;
  modelCosts: Record<string, Record<string, number>>;
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
  selectedModel?: string;
}

export async function fetchCostsConfig(): Promise<CostsConfig> {
  const res = await fetch("/api/config/costs", { cache: "no-store" });
  if (!res.ok) throw new Error("failed to load costs config");
  return (await res.json()) as CostsConfig;
}

function modelCreditCost(config: CostsConfig, feature: string, modelKey: string): number | null {
  const category = feature === "animate" ? "video" : "image";
  const providerCost = config.modelCosts[category]?.[modelKey];
  if (providerCost === undefined) return null;
  const margin = config.margins[feature] ?? config.videoMargins[feature] ?? 2.0;
  const rate = config.creditConversionRate || 1;
  return Math.round(providerCost * rate * margin);
}

/** Même formule que lib/credits.computeCost (affiché = facturé). */
export function computeVideoDisplayCost(
  config: CostsConfig,
  mode: VideoMode,
  shotCount: number,
  selectedModel?: string
): number {
  const base = computeVideoCost(config.videoCosts, mode, shotCount);
  if (!selectedModel) return base;
  const perModel = modelCreditCost(config, "animate", selectedModel);
  if (perModel === null) return base;
  // Le coût modèle est pour un shot ; les multiplicateurs qualité/durée et
  // multi-shot s'appliquent ensuite de la même façon que le coût de base.
  const duration = config.durationMultiplier[String(4)] ?? 1;
  const perShot = Math.round(perModel * (config.qualityMultiplier.standard ?? 1) * duration);
  if (mode === "multi_shot") {
    return perShot * shotCount + (config.videoCosts.multi_shot_concat_overhead ?? 0);
  }
  return perShot;
}

export function computeDisplayCost(config: CostsConfig, input: DisplayCostInput): number {
  // Si un modèle spécifique est choisi, le coût est dérivé du coût réel
  // provider × marge, pas du tarif Auto forfaitaire.
  if (input.selectedModel) {
    const perModel = modelCreditCost(config, input.feature, input.selectedModel);
    if (perModel !== null) {
      if (input.feature === "upscale" || input.feature === "video_upscale") {
        return perModel;
      }
      const unit =
        perModel * (config.qualityMultiplier[input.quality] ?? 1) +
        (config.resolutionSurcharge[input.resolution] ?? 0);
      return unit * input.quantity;
    }
  }

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
