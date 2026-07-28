// Le "generation-router" — couche d'orchestration multi-modèles, serveur
// uniquement, jamais exposée au client.
//
// Responsabilités :
// - résoudre la liste de candidats d'une feature (catalogue) selon le tier
//   de qualité demandé ET le modèle éventuellement choisi par l'utilisateur
//   (essayé en premier), puis les essayer dans l'ordre : en cas d'échec
//   (timeout, erreur, rejet politique de contenu), bascule automatique sur
//   le suivant — invisible pour l'utilisateur ;
// - dispatcher chaque candidat vers l'API OFFICIELLE de son fournisseur
//   (lib/ai/providers/) — aucun agrégateur, aucune dépendance fatale à un
//   fournisseur unique ;
// - normaliser requêtes/réponses via GenerationRequest/GenerationResult ;
// - chaîner les pipelines composés (rendu -> upscale 2K/4K ; Animate :
//   vidéo -> TTS -> merge ffmpeg, voir chains/animate.ts) ;
// - tracer chaque tentative pour l'analytics interne (logger.ts).
//
// Le point d'entrée `executeWithFallback` est exporté séparément pour
// permettre la simulation du fallback sans appels réels (scripts/).
import { MODEL_CATALOG, type ModelCandidate } from "./catalog";
import { logGeneration } from "./logger";
import { PROVIDER_ADAPTERS } from "./providers";
import {
  AllModelsFailedError,
  type AttemptLog,
  type Feature,
  type GenerationRequest,
  type GenerationResult,
  type ProviderAdapter,
  type QualityTier,
} from "./types";

export interface RouterDeps {
  /** Adaptateur injecté pour TOUS les candidats — tests/simulations
   *  uniquement (en prod, chaque candidat utilise SON fournisseur). */
  adapter?: ProviderAdapter;
  /** Liste de candidats injectée à la place du catalogue — tests uniquement. */
  candidatesOverride?: ModelCandidate[];
  now?: () => number;
}

export type StageCallback = (stage: string) => void;

/** Tri des candidats : le modèle choisi par l'utilisateur (s'il fait partie
 *  de la feature) passe EN PREMIER ; ensuite, à priorité de configuration
 *  égale, un candidat du tier demandé passe devant. Tri stable : l'ordre du
 *  catalogue reste la priorité principale et le fallback reste automatique. */
export function orderCandidates(
  candidates: ModelCandidate[],
  quality: QualityTier,
  preferredKey?: string
): ModelCandidate[] {
  return candidates
    .map((candidate, index) => ({ candidate, index }))
    .sort((a, b) => {
      const aPreferred = preferredKey && a.candidate.key === preferredKey ? 0 : 1;
      const bPreferred = preferredKey && b.candidate.key === preferredKey ? 0 : 1;
      if (aPreferred !== bPreferred) return aPreferred - bPreferred;
      const aMatch = a.candidate.tiers.includes(quality) ? 0 : 1;
      const bMatch = b.candidate.tiers.includes(quality) ? 0 : 1;
      return aMatch - bMatch || a.index - b.index;
    })
    .map(({ candidate }) => candidate);
}

export interface FallbackOutcome {
  winner: ModelCandidate;
  outputUrls: string[];
  attempts: AttemptLog[];
}

/** Essaie chaque candidat dans l'ordre jusqu'au premier succès. Toutes
 *  les erreurs fournisseur (timeout, 4xx/5xx, rejet de contenu, sortie
 *  vide) déclenchent le fallback. */
export async function executeWithFallback(
  feature: Feature,
  candidates: ModelCandidate[],
  req: GenerationRequest,
  deps: RouterDeps = {}
): Promise<FallbackOutcome> {
  const now = deps.now ?? Date.now;
  const attempts: AttemptLog[] = [];

  for (const candidate of candidates) {
    const startedAt = now();
    try {
      // Chaque candidat appelle l'API de SON fournisseur (sauf injection
      // de test). Un fournisseur non configuré échoue vite -> fallback.
      const adapter = deps.adapter ?? PROVIDER_ADAPTERS[candidate.provider];
      // Tronque les références au max supporté par le modèle — les
      // candidats à 0 slot les ignorent silencieusement (loggé).
      const truncatedReq =
        candidate.maxReferences >= req.referenceUrls.length
          ? req
          : { ...req, referenceUrls: req.referenceUrls.slice(0, candidate.maxReferences) };
      const input = candidate.buildInput(truncatedReq);
      const data = await adapter.run(candidate.modelId, input, candidate.timeoutMs);
      const outputUrls = candidate.extractOutput(data);
      if (outputUrls.length === 0) {
        throw new Error("provider returned an empty output");
      }
      attempts.push({ candidateKey: candidate.key, ok: true, latencyMs: now() - startedAt });
      return { winner: candidate, outputUrls, attempts };
    } catch (err) {
      // L'erreur réelle reste dans la trace serveur, jamais chez le client.
      attempts.push({
        candidateKey: candidate.key,
        ok: false,
        latencyMs: now() - startedAt,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  throw new AllModelsFailedError(feature, attempts);
}

/** Pipeline image standard : modèle d'édition (+ chaîne d'upscale si la
 *  résolution demandée dépasse le natif du modèle de base). */
async function runImagePipeline(
  req: GenerationRequest,
  onStage: StageCallback | undefined,
  deps: RouterDeps
): Promise<GenerationResult> {
  const candidates =
    deps.candidatesOverride ??
    orderCandidates(MODEL_CATALOG[req.feature], req.quality, req.preferredCandidateKey);

  onStage?.("render");
  const render = await executeWithFallback(req.feature, candidates, req, deps);

  let outputUrls = render.outputUrls;
  let servedBy = render.winner.key;
  let attempts = render.attempts;

  // Post-traitement : upscale si 2K/4K demandé (le modèle de base ne
  // produit pas cette résolution nativement) — invisible pour l'utilisateur.
  // Liste de candidats vide (ex. Seedream/ARK retiré) = étape sautée : le
  // rendu est livré à sa résolution native (dégradation gracieuse).
  if (req.resolution !== "1K" && MODEL_CATALOG.upscale.length > 0) {
    onStage?.("upscaling");
    const upscaleCandidates = orderCandidates(MODEL_CATALOG.upscale, req.quality);
    const upscaleReq: GenerationRequest = {
      ...req,
      feature: "upscale",
      imageUrl: outputUrls[0],
      referenceUrls: [],
      quantity: 1,
    };
    const upscaled = await executeWithFallback("upscale", upscaleCandidates, upscaleReq, deps);
    outputUrls = upscaled.outputUrls;
    servedBy = `${servedBy}+${upscaled.winner.key}`;
    attempts = [...attempts, ...upscaled.attempts];
  }

  return { kind: "image", outputUrls, servedBy, attempts };
}

/** Point d'entrée unique de la couche d'orchestration. */
export async function runGeneration(
  req: GenerationRequest,
  onStage?: StageCallback,
  deps: RouterDeps = {}
): Promise<GenerationResult> {
  if (req.feature === "animate") {
    // Import dynamique : la chaîne Animate (ffmpeg) n'est chargée que si
    // nécessaire, pour garder le pipeline image léger.
    const { runAnimateChain } = await import("./chains/animate");
    return runAnimateChain(req, onStage, deps);
  }
  return runImagePipeline(req, onStage, deps);
}

// Réexport pour les routes qui veulent journaliser sans importer logger.
export { logGeneration };
