// Métadonnées d'affichage des fonctionnalités — CLIENT-SAFE.
// Le `name` est le libellé PRODUIT vu par l'utilisateur (historique,
// résultats) ; il ne révèle rien des modèles sous-jacents.
//
// Scope MVP : agrégateur IA VERTICAL pour architectes, archviz,
// décorateurs d'intérieur et agents immobiliers — 6 fonctions métier,
// une par onglet du studio. Pas d'outil généraliste (voir AGENTS.md).

export type StudioTab =
  | "print_render"
  | "mood_swap"
  | "exterior_to_interior"
  | "plan_to_render"
  | "animate"
  | "multi_angle";

export const STUDIO_TABS: Array<{ id: StudioTab; label: string }> = [
  { id: "print_render", label: "Render" },
  { id: "mood_swap", label: "Mood" },
  { id: "exterior_to_interior", label: "Exterior → Interior" },
  { id: "plan_to_render", label: "Plan to Render" },
  { id: "animate", label: "Animate" },
  { id: "multi_angle", label: "Multi-Angle" },
];

export interface FeatureMeta {
  id: StudioTab;
  name: string;
}

export const FEATURES: Record<StudioTab, FeatureMeta> = {
  print_render: { id: "print_render", name: "Print Render" },
  mood_swap: { id: "mood_swap", name: "Mood Shift" },
  exterior_to_interior: { id: "exterior_to_interior", name: "Exterior to Interior" },
  plan_to_render: { id: "plan_to_render", name: "Plan to Render" },
  animate: { id: "animate", name: "Animate" },
  multi_angle: { id: "multi_angle", name: "Multi-Angle" },
};
