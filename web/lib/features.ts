// Métadonnées d'affichage des fonctionnalités — CLIENT-SAFE.
// Le `name` est le libellé PRODUIT vu par l'utilisateur (historique,
// résultats) ; il ne révèle rien des modèles sous-jacents.
//
// Scope MVP : agrégateur IA VERTICAL pour architectes, archviz,
// décorateurs d'intérieur et agents immobiliers — 6 fonctions métier,
// une par onglet du studio. Pas d'outil généraliste (voir AGENTS.md).

export type StudioTab =
  | "text_to_image"
  | "print_render"
  | "mood_swap"
  | "exterior_to_interior"
  | "plan_to_render"
  | "multi_angle"
  | "image_extender"
  | "variations"
  | "background_remover"
  | "upscale";

export const STUDIO_TABS: Array<{ id: StudioTab; label: string }> = [
  { id: "text_to_image", label: "Image Generator" },
  { id: "print_render", label: "Render" },
  { id: "mood_swap", label: "Mood" },
  { id: "exterior_to_interior", label: "Exterior → Interior" },
  { id: "plan_to_render", label: "Plan to Render" },
  { id: "multi_angle", label: "Multi-Angle" },
  { id: "image_extender", label: "Extender" },
  { id: "variations", label: "Variations" },
  { id: "background_remover", label: "Background" },
  { id: "upscale", label: "Upscale" },
];
