export interface ComparePricingConfig {
  marginMultiplier: number;
  creditPerUsdCent: number;
}

/**
 * Estime le coût en crédits d'une génération Compare.
 * Le coût provider est fourni exclusivement par le catalogue serveur.
 */
export function calculateCompareCredits(
  providerCostCents: number,
  config: ComparePricingConfig
): number {
  if (
    !Number.isFinite(providerCostCents) ||
    providerCostCents < 0
  ) {
    throw new Error("Invalid provider cost estimate.");
  }

  if (
    !Number.isFinite(config.marginMultiplier) ||
    config.marginMultiplier <= 0
  ) {
    throw new Error("Invalid Compare margin configuration.");
  }

  if (
    !Number.isFinite(config.creditPerUsdCent) ||
    config.creditPerUsdCent <= 0
  ) {
    throw new Error("Invalid credit conversion configuration.");
  }

  return Math.max(
    0,
    Math.round(
      providerCostCents *
        config.marginMultiplier *
        config.creditPerUsdCent
    )
  );
}