// Métadonnées d'affichage des presets — CLIENT-SAFE.
// Aucun fragment de prompt ici : le prompt engineering vit côté serveur
// dans worker/prompts.py. Ici : ids, labels, vignettes, bornes UI.

// --- "Customize Scene" : type de scène (base qui débloque les bons
//     réglages). Remplace l'ancien sélecteur de style — chaque type a son
//     prompt préparé côté serveur (worker/prompts.py). ---

export interface SceneTypeMeta {
  id: string;
  label: string;
  description: string;
}

export const SCENE_TYPE_PRESETS: SceneTypeMeta[] = [
  { id: "commercial_exterior", label: "Commercial Exterior", description: "Urban façade" },
  { id: "interior", label: "Interior", description: "Indoor environment" },
  { id: "residential_exterior", label: "Residential Exterior", description: "Home & Garden" },
];

export interface PresetMeta {
  id: string;
  label: string;
  /** Dégradé Tailwind utilisé comme vignette (scanné car lib/ est dans le
   *  `content` de tailwind.config.ts). */
  swatch: string;
}

export const MATERIAL_PRESETS: PresetMeta[] = [
  { id: "oak", label: "Oak wood", swatch: "from-amber-200 to-amber-400" },
  { id: "marble", label: "Marble", swatch: "from-stone-100 to-stone-300" },
  { id: "concrete", label: "Concrete", swatch: "from-zinc-300 to-zinc-500" },
  { id: "brick", label: "Brick", swatch: "from-red-300 to-orange-500" },
  { id: "steel_glass", label: "Steel & glass", swatch: "from-sky-200 to-slate-500" },
  { id: "textile", label: "Textiles", swatch: "from-rose-100 to-rose-300" },
];

export const LIGHTING_PRESETS: PresetMeta[] = [
  { id: "daylight", label: "Daylight", swatch: "from-sky-200 to-blue-400" },
  { id: "golden_hour", label: "Golden hour", swatch: "from-amber-300 to-orange-500" },
  { id: "overcast", label: "Overcast", swatch: "from-slate-200 to-slate-400" },
  { id: "night", label: "Night", swatch: "from-indigo-400 to-slate-800" },
];

// --- Fonctions 2/4/6 du scope MVP : presets dédiés (bâti uniquement) ---

/** Mood Shift (fonction 2) : variation d'ambiance de la MÊME scène. */
export const MOOD_PRESETS: PresetMeta[] = [
  { id: "daylight", label: "Daylight", swatch: "from-sky-200 to-blue-400" },
  { id: "golden_hour", label: "Golden hour", swatch: "from-amber-300 to-orange-500" },
  { id: "night", label: "Night", swatch: "from-indigo-400 to-slate-800" },
  { id: "overcast", label: "Overcast", swatch: "from-slate-200 to-slate-400" },
  { id: "rain", label: "Rain", swatch: "from-cyan-300 to-slate-500" },
  { id: "snow", label: "Snow", swatch: "from-slate-100 to-sky-300" },
];

/** Plan to Render (fonction 4) : orientation du rendu depuis un plan 2D. */
export const PLAN_RENDER_PRESETS: PresetMeta[] = [
  { id: "furnished_interior", label: "Furnished interior", swatch: "from-amber-100 to-amber-300" },
  { id: "landscaped_exterior", label: "Landscaped exterior", swatch: "from-emerald-200 to-emerald-500" },
];

/** Multi-Angle (fonction 6) : angle de caméra additionnel, même scène. */
export const ANGLE_PRESETS: PresetMeta[] = [
  { id: "eye_level", label: "Eye level", swatch: "from-zinc-200 to-zinc-400" },
  { id: "high_angle", label: "High angle", swatch: "from-stone-300 to-stone-500" },
  { id: "aerial", label: "Aerial / drone", swatch: "from-sky-300 to-indigo-500" },
  { id: "corner_view", label: "Corner view", swatch: "from-orange-200 to-amber-400" },
  { id: "close_up", label: "Close-up", swatch: "from-rose-200 to-rose-400" },
];

/** Image Extender : direction de l'outpaint. */
export const EXTENDER_DIRECTION_PRESETS: PresetMeta[] = [
  { id: "center", label: "All sides", swatch: "from-zinc-200 to-zinc-400" },
  { id: "left", label: "Extend left", swatch: "from-blue-200 to-blue-400" },
  { id: "right", label: "Extend right", swatch: "from-emerald-200 to-emerald-400" },
  { id: "top", label: "Extend top", swatch: "from-amber-200 to-amber-400" },
  { id: "bottom", label: "Extend bottom", swatch: "from-rose-200 to-rose-400" },
];

// --- Bornes et options des contrôles de génération ---

export const MAX_REFERENCES = 14;
export const MAX_QUANTITY = 4;
export const SCENE_DETAILS_MAX = 10_000;

export const ASPECT_RATIOS = ["1:1", "16:9", "9:16", "4:3", "3:4"] as const;
export const RESOLUTIONS = ["1K", "2K", "4K"] as const;
export const QUALITY_TIERS = [
  { id: "standard", label: "Standard" },
  { id: "pro", label: "Pro" },
] as const;
// --- Upscale : facteur et toggle enhance (simple, pas de réglages techniques) ---

export type UpscaleFactor = 2 | 4;

export const UPSCALE_FACTORS: Array<{ id: UpscaleFactor; label: string }> = [
  { id: 2, label: "2×" },
  { id: 4, label: "4×" },
];
