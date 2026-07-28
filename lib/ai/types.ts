// Schéma interne normalisé de la couche d'orchestration multi-modèles.
//
// Règle non négociable : le frontend et le futur système de crédits ne
// connaissent QUE ces types — jamais le nom d'un fournisseur, d'un modèle
// ou d'un identifiant d'API. Tout ce qui permettrait d'identifier le
// modèle sous-jacent (servedBy, AttemptLog, costWeight) reste côté
// serveur, pour l'analytics interne qualité/coût/latence.

export type Feature =
  | "print_render"
  | "mood_swap"
  | "object_swap"
  | "upscale"
  | "animate"
  | "lip_sync_narration";

export type QualityTier = "standard" | "pro";
export type AspectRatio = "1:1" | "16:9" | "9:16" | "4:3" | "3:4";
export type Resolution = "1K" | "2K" | "4K";

/** Fournisseurs d'API directs supportés (PAS d'agrégateur — chaque modèle
 *  est appelé sur l'API officielle de son éditeur). Ajouter un fournisseur
 *  = ajouter son adaptateur dans lib/ai/providers/ + une entrée ici. */
export type ProviderName =
  | "bfl"
  | "google"
  | "kling"
  | "runway"
  | "elevenlabs"
  | "openai"
  // Agrégateur — exception assumée au principe ci-dessus (voir AGENTS.md §1).
  | "magichour"
  // Serveur LOCAL de test (GPU de l'utilisateur) — dev hors-ligne, pas pour la prod.
  | "comfyui";

/** Requête normalisée, indépendante de tout fournisseur. */
export interface GenerationRequest {
  feature: Feature;
  /** Image principale (data URI ou URL http). */
  imageUrl: string;
  /** Images de conditionnement (style/cohérence) — jamais l'entrée principale. */
  referenceUrls: string[];
  /** Prompt final, DÉJÀ construit par lib/ai/prompt-templates.ts (serveur). */
  prompt: string;
  quality: QualityTier;
  aspectRatio: AspectRatio;
  resolution: Resolution;
  quantity: number;
  /** Clé interne du candidat à essayer EN PREMIER (choix "modèle" de
   *  l'utilisateur dans le picker) — le fallback reste automatique. */
  preferredCandidateKey?: string;
  // --- Champs spécifiques à la chaîne Animate ---
  motionPresetId?: string;
  durationSeconds?: 4 | 8 | 12;
  narrationScript?: string;
  /** Image de fin optionnelle (start/end frame) — ignorée par les modèles
   *  qui ne la supportent pas. */
  endImageUrl?: string;
}

/** Résultat normalisé, indépendant de tout fournisseur. */
export interface GenerationResult {
  kind: "image" | "video" | "audio";
  outputUrls: string[];
  /**
   * Clé(s) interne(s) du/des modèle(s) ayant réellement servi la génération
   * (fallback et chaînage inclus). JOURNALISÉ pour l'analytics interne,
   * JAMAIS renvoyé au client.
   */
  servedBy: string;
  /** Trace des tentatives (fallback) — analytics interne uniquement. */
  attempts: AttemptLog[];
}

export interface AttemptLog {
  candidateKey: string;
  ok: boolean;
  latencyMs: number;
  /** Erreur réelle (timeout, rejet politique de contenu...) — serveur seulement. */
  error?: string;
}

/** Adaptateur de fournisseur : interface unique derrière laquelle se cachent
 *  les API officielles de chaque éditeur (BFL, Google, ByteDance, Kling,
 *  Runway, ElevenLabs...). Injectable pour les tests/simulations. */
export interface ProviderAdapter {
  /** Nom interne — journalisation uniquement. */
  name: string;
  run(modelId: string, input: Record<string, unknown>, timeoutMs: number): Promise<unknown>;
}

/** Levée quand tous les candidats d'une feature ont échoué : la route
 *  traduit en message GÉNÉRIQUE côté client. */
export class AllModelsFailedError extends Error {
  constructor(
    public readonly feature: Feature,
    public readonly attempts: AttemptLog[]
  ) {
    super(`All models failed for feature "${feature}"`);
    this.name = "AllModelsFailedError";
  }
}
