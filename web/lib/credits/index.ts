// Coûts et solde — côté serveur uniquement.
//
// La BASE par action vit en table `action_costs` (spec : pas de coût en
// dur). Les multiplicateurs restent des constantes DOCUMENTÉES ici
// (qualité pro x2, durée vidéo, surcharge résolution) — elles rejoindront
// la table si un palier d'abonnement l'exige.
//
// Règle non négociable : le débit réel (ledger) n'intervient QU'au
// succès, exécuté par le worker de façon idempotente. Ici : calcul du
// coût affiché/facturé et lecture du solde AVANT lancement.
import { getActionCosts, getDevUser, getLedgerBalance } from "../db/queries";

export const QUALITY_MULTIPLIER = { standard: 1, pro: 2 } as const;
export const RESOLUTION_SURCHARGE = { "1K": 0, "2K": 5, "4K": 10 } as const;
export const DURATION_MULTIPLIER = { 4: 1, 8: 1.5 } as const;

/** Coût final d'une action = base (table) x multiplicateurs (ici). */
export async function computeCost(input: CostInput): Promise<number> {
  const costs = await getActionCosts();
  if (input.feature === "animate") {
    const duration = DURATION_MULTIPLIER[input.durationSeconds ?? 4];
    return Math.round(costs.animate * QUALITY_MULTIPLIER[input.quality] * duration);
  }
  if (input.feature === "upscale") {
    const factor = input.upscaleFactor ?? 2;
    const key = factor === 4 ? "upscale_4x" : "upscale_2x";
    const base = costs[key];
    if (base === undefined) throw new Error(`unknown feature cost: ${key}`);
    return base;
  }
  // Nouvelles actions à coût fixe (table action_costs) : voice, video edit/upscale.
  const fixedCost = costs[input.feature];
  if (fixedCost !== undefined) return fixedCost;

  const base = costs[input.feature];
  if (base === undefined) throw new Error(`unknown feature cost: ${input.feature}`);
  const unit = base * QUALITY_MULTIPLIER[input.quality] + RESOLUTION_SURCHARGE[input.resolution];
  return unit * input.quantity;
}

export interface CostInput {
  feature: string;
  quality: keyof typeof QUALITY_MULTIPLIER;
  resolution: keyof typeof RESOLUTION_SURCHARGE;
  quantity: number;
  durationSeconds?: keyof typeof DURATION_MULTIPLIER;
  upscaleFactor?: 2 | 4;
}

/** Solde courant de l'utilisateur (somme du ledger append-only). */
export async function getBalance(): Promise<number> {
  const user = await getDevUser();
  return getLedgerBalance(user.id);
}
