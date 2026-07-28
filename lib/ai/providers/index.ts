// Registre des fournisseurs — C'EST ICI que le "pas de vendor lock-in" se
// joue : chaque modèle du catalogue appelle l'API OFFICIELLE de son éditeur
// via l'adaptateur de ce tableau. Ajouter/retirer un fournisseur = modifier
// UNE entrée ici + son adaptateur, jamais le routeur ni le catalogue.
// Exceptions documentées (AGENTS.md §1) : `magichour` est une plateforme
// agrégatrice ; `comfyui` est un serveur LOCAL de test (GPU de
// l'utilisateur, hors-ligne) — ni l'un ni l'autre n'est un éditeur de
// modèle, tous deux ajoutés à la demande explicite du propriétaire.
//
// Un fournisseur sans clé configurée échoue vite au premier appel et le
// routeur bascule sur le candidat suivant : la plateforme reste disponible
// avec n'importe quel sous-ensemble de fournisseurs configurés.
import type { ProviderAdapter, ProviderName } from "../types";
import { bflAdapter } from "./bfl";
import { comfyuiAdapter } from "./comfyui";
import { elevenlabsAdapter } from "./elevenlabs";
import { googleAdapter } from "./google";
import { klingAdapter } from "./kling";
import { magichourAdapter } from "./magichour";
import { openaiAdapter } from "./openai";
import { runwayAdapter } from "./runway";

export const PROVIDER_ADAPTERS: Record<ProviderName, ProviderAdapter> = {
  bfl: bflAdapter,
  google: googleAdapter,
  kling: klingAdapter,
  runway: runwayAdapter,
  elevenlabs: elevenlabsAdapter,
  openai: openaiAdapter,
  magichour: magichourAdapter,
  comfyui: comfyuiAdapter,
};

/** Variables d'env requises par fournisseur — utilisé pour le contrôle de
 *  configuration au démarrage d'une génération. */
const PROVIDER_ENV_KEYS: Record<ProviderName, string[]> = {
  bfl: ["BFL_API_KEY"],
  google: ["GOOGLE_API_KEY"],
  kling: ["KLING_SECRET_KEY"],
  runway: ["RUNWAY_API_KEY"],
  elevenlabs: ["ELEVENLABS_API_KEY"],
  openai: ["OPENAI_API_KEY"],
  magichour: ["MAGIC_HOUR_API_KEY"],
  comfyui: ["COMFYUI_CHECKPOINT"],
};

export function isProviderConfigured(provider: ProviderName): boolean {
  return PROVIDER_ENV_KEYS[provider].every((key) => Boolean(process.env[key]));
}

/** Au moins un fournisseur configuré = la génération peut être tentée. */
export function isAnyProviderConfigured(): boolean {
  return (Object.keys(PROVIDER_ENV_KEYS) as ProviderName[]).some(isProviderConfigured);
}
