// Coûts en crédits AFFICHÉS et facturés à l'utilisateur.
//
// Ces valeurs migreront vers la table de config `action_costs` au jalon DB
// (spec : "credit costs per action must be stored in a config table, not
// hardcoded") — en attendant, elles vivent ici UNIQUEMENT. Ne jamais
// disperser un coût ailleurs dans le code.
//
// Règle non négociable : l'utilisateur paie le coût TOTAL de la feature,
// quel que soit le modèle (ou le fallback) ayant réellement servi. La
// variance de coût fournisseur (costWeight du catalogue) est absorbée par
// la plateforme.
import type { Feature, QualityTier, Resolution } from "@/lib/ai/types";

export const FEATURE_BASE_COSTS: Record<Feature, number> = {
  print_render: 10,
  mood_swap: 8,
  exterior_to_interior: 12,
  plan_to_render: 12,
  multi_angle: 15,
  animate: 30,
  upscale: 50,
};

const QUALITY_MULTIPLIER: Record<QualityTier, number> = {
  standard: 1,
  pro: 2,
};

/** Surcoût du post-traitement d'upscale quand le modèle de base ne produit
 *  pas nativement la résolution demandée. */
const RESOLUTION_SURCHARGE: Record<Resolution, number> = {
  "1K": 0,
  "2K": 5,
  "4K": 10,
};

const DURATION_MULTIPLIER: Record<4 | 8, number> = {
  4: 1,
  8: 1.5,
};

export interface CreditCostInput {
  feature: Feature;
  quality: QualityTier;
  resolution: Resolution;
  quantity: number;
  durationSeconds?: 4 | 8;
}

export function computeCreditCost(input: CreditCostInput): number {
  const base = FEATURE_BASE_COSTS[input.feature];

  if (input.feature === "animate") {
    const duration = DURATION_MULTIPLIER[input.durationSeconds ?? 4];
    return Math.round(base * QUALITY_MULTIPLIER[input.quality] * duration);
  }

  const unit = base * QUALITY_MULTIPLIER[input.quality] + RESOLUTION_SURCHARGE[input.resolution];
  return unit * input.quantity;
}
