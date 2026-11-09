import { createHash } from "node:crypto";

/**
 * Identifiant public stable d'un modèle pour Compare Studio.
 * La clé interne du catalogue ne doit jamais être exposée au navigateur.
 */
export function getCompareSelectionId(internalKey: string): string {
  const digest = createHash("sha256")
    .update(`renderuim:compare:model:v1:${internalKey}`)
    .digest("hex")
    .slice(0, 24);

  return `cmp_${digest}`;
}