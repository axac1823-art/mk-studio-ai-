// Liste publique des "modèles" affichée dans le sélecteur du studio
// (style Higgsfield : Featured / All models, badges New/Premium).
//
// CLIENT-SAFE : seuls des noms PRODUIT sont exposés. Le `candidateKey`
// renvoie à une clé générique du catalogue serveur (lib/ai/catalog.ts) ;
// les identifiants d'API réels (modelId) ne quittent jamais le serveur.
//
// Sémantique : le choix de l'utilisateur change juste QUEL candidat
// interne est essayé EN PREMIER — le fallback sur les autres reste
// automatique et invisible, et le prix reste le coût total de la feature.
// "auto" = le routeur décide (ordre de priorité du catalogue).

export interface ModelOption {
  /** Id public envoyé par le client (champ de formulaire "modelOption"). */
  id: string;
  /** Clé interne générique du catalogue — null pour le routage automatique. */
  candidateKey: string | null;
  feature: "print_render" | "animate";
  name: string;
  description: string;
  badge?: "New" | "Premium";
  section: "featured" | "all";
}

export const AUTO_MODEL_OPTION_ID = "auto";

export const MODEL_OPTIONS: ModelOption[] = [
  // --- Rendu image ---
  {
    id: AUTO_MODEL_OPTION_ID,
    candidateKey: null,
    feature: "print_render",
    name: "Auto (recommended)",
    description: "We pick the best model for your render",
    section: "featured",
  },
  {
    id: "flux-kontext-max",
    candidateKey: "edit-alpha-pro",
    feature: "print_render",
    name: "Flux Kontext Max",
    description: "Edit with accuracy, ultimate detail",
    badge: "Premium",
    section: "featured",
  },
  {
    id: "nano-banana-pro",
    candidateKey: "edit-beta-pro",
    feature: "print_render",
    name: "Nano Banana Pro",
    description: "Pro quality, multi-reference conditioning",
    badge: "New",
    section: "featured",
  },
  {
    id: "gpt-image-1-5",
    candidateKey: "edit-delta-pro",
    feature: "print_render",
    name: "GPT Image 1.5",
    description: "OpenAI's flagship — precise instruction edits",
    badge: "New",
    section: "featured",
  },
  {
    id: "flux-kontext-pro",
    candidateKey: "edit-alpha",
    feature: "print_render",
    name: "Flux Kontext Pro",
    description: "Balanced quality and speed",
    section: "all",
  },
  {
    id: "nano-banana",
    candidateKey: "edit-beta",
    feature: "print_render",
    name: "Nano Banana",
    description: "Fast drafts at Flash speed",
    section: "all",
  },
  {
    id: "gpt-image-1",
    candidateKey: "edit-delta",
    feature: "print_render",
    name: "GPT Image 1",
    description: "OpenAI image edits, balanced cost",
    section: "all",
  },
  {
    id: "magic-hour",
    candidateKey: "edit-epsilon",
    feature: "print_render",
    name: "Magic Hour",
    description: "All-in-one studio — picks a model for you",
    section: "all",
  },
  {
    id: "comfyui-local",
    candidateKey: "edit-zeta",
    feature: "print_render",
    name: "Local (ComfyUI)",
    description: "Your own GPU — free offline drafts",
    section: "all",
  },

  // --- Vidéo (Animate) ---
  {
    id: "auto-video",
    candidateKey: null,
    feature: "animate",
    name: "Auto (recommended)",
    description: "We pick the best video model for your shot",
    section: "featured",
  },
  {
    id: "kling-3-pro",
    candidateKey: "video-beta-pro",
    feature: "animate",
    name: "Kling 3 Pro",
    description: "Latest Kling — cinematic visuals, fluid motion",
    badge: "New",
    section: "featured",
  },
  {
    id: "sora-2-pro",
    candidateKey: "video-delta-pro",
    feature: "animate",
    name: "Sora 2 Pro",
    description: "OpenAI's flagship video model",
    badge: "New",
    section: "featured",
  },
  {
    id: "kling-2-5-turbo",
    candidateKey: "video-beta",
    feature: "animate",
    name: "Kling 2.5 Turbo",
    description: "Photorealistic motion, fast turnaround",
    section: "all",
  },
  {
    id: "runway-gen4",
    candidateKey: "video-gamma",
    feature: "animate",
    name: "Runway Gen-4 Turbo",
    description: "Fast cinematic drafts",
    section: "all",
  },
  {
    id: "sora-2",
    candidateKey: "video-delta",
    feature: "animate",
    name: "Sora 2",
    description: "Creative OpenAI video drafts",
    section: "all",
  },
  {
    id: "magic-hour-video",
    candidateKey: "video-epsilon",
    feature: "animate",
    name: "Magic Hour",
    description: "All-in-one studio — picks a video model",
    section: "all",
  },
];

export function modelOptionsFor(feature: "print_render" | "animate"): ModelOption[] {
  return MODEL_OPTIONS.filter((option) => option.feature === feature);
}

/** Résout un id public vers la clé interne du catalogue (null si id
 *  inconnu ou routage automatique) — utilisé côté serveur par la route. */
export function resolveCandidateKey(publicId: string): string | null {
  return MODEL_OPTIONS.find((option) => option.id === publicId)?.candidateKey ?? null;
}
