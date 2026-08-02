// Templates de prompt — côté serveur UNIQUEMENT, VERSIONNÉS.
//
// Règle non négociable : tout le prompt engineering vit ici. Le texte
// libre de l'utilisateur ("scene details") est TOUJOURS enveloppé dans
// ces templates, jamais envoyé brut au modèle. Itérer sur la qualité =
// modifier ce fichier (et bumper la version), sans toucher au frontend.
//
// Les fragments par preset y sont centralisés : lib/presets.ts (client)
// ne contient que les métadonnées d'affichage (label, vignette).

export const PROMPT_TEMPLATES_VERSION = "2026-07-30.v2";

// --- Fragments internes par preset (jamais affichés tels quels) ---

/** Type de scène ("Customize Scene") : la BASE du prompt — elle oriente le
 *  cadrage, le contexte et les réglages pertinents pour le sujet. */
const SCENE_TYPE_FRAGMENTS: Record<string, string> = {
  commercial_exterior:
    "commercial building exterior, urban façade, street-level architectural photography, city context, professional presentation",
  interior:
    "interior space, indoor environment, carefully staged furniture and décor, balanced indoor lighting",
  residential_exterior:
    "residential home exterior, garden and landscaping, welcoming curb appeal, neighborhood context",
};

const MATERIAL_FRAGMENTS: Record<string, string> = {
  oak: "light oak wood flooring and joinery",
  marble: "polished marble surfaces with subtle veining",
  concrete: "board-formed raw concrete surfaces",
  brick: "warm exposed brick walls",
  steel_glass: "black steel frames and floor-to-ceiling glass",
  textile: "soft natural textiles, linen and wool textures",
};

const LIGHTING_FRAGMENTS: Record<string, string> = {
  daylight: "bright natural daylight, soft shadows",
  golden_hour: "golden hour lighting, warm sunset glow, long soft shadows",
  overcast: "overcast daylight, soft diffused light, neutral color grading",
  night: "night scene, interior lights on, blue hour sky",
};

const MOTION_FRAGMENTS: Record<string, string> = {
  push_in: "slow cinematic camera push-in towards the building",
  orbit: "smooth orbital camera movement around the subject",
  pan: "slow lateral camera pan across the scene",
  tilt_up: "gentle upward camera tilt revealing the full height",
  dolly: "slow lateral dolly shot, architectural walkthrough feel",
};

/** Mood Shift (fonction 2) : la géométrie et la composition sont figées —
 *  SEULE l'ambiance change (jour/nuit/saison/météo). */
const MOOD_FRAGMENTS: Record<string, string> = {
  daylight: "bright midday daylight, clear sky, crisp natural shadows",
  golden_hour: "golden hour lighting, warm sunset glow, long soft shadows",
  night: "night scene, interior and exterior lights on, blue hour sky",
  overcast: "overcast daylight, soft diffused light, neutral color grading",
  rain: "rainy weather, wet ground and surfaces with reflections, moody overcast sky",
  snow: "winter scene, snow on roofs and ground, cold pale light",
};

/** Plan to Render (fonction 4) : orientation du rendu depuis un plan 2D. */
const PLAN_RENDER_FRAGMENTS: Record<string, string> = {
  furnished_interior:
    "photorealistic 3D interior render generated from this 2D technical floor plan, furnished and professionally staged, wide perspective view, consistent room proportions",
  landscaped_exterior:
    "photorealistic 3D exterior render generated from this 2D technical plan, landscaped garden and surroundings, plausible façade materials, street context",
};

/** Multi-Angle (fonction 6) : même scène, SEUL le point de vue change
 *  (cohérence best-effort — aucune garantie parfaite en V1). */
const ANGLE_FRAGMENTS: Record<string, string> = {
  eye_level: "same scene from an eye-level pedestrian viewpoint",
  high_angle: "same scene from an elevated high-angle viewpoint",
  aerial: "same scene from an aerial top-down drone viewpoint",
  corner_view: "same scene from a corner viewpoint showing two façades",
  close_up: "same scene with a closer framing on the main subject",
};

function fragment(table: Record<string, string>, id: string | undefined): string | null {
  return id && table[id] ? table[id] : null;
}

/** Enveloppe le texte libre utilisateur : borné et neutralisé. */
function sanitizeSceneDetails(sceneDetails: string | undefined): string | null {
  const trimmed = sceneDetails?.trim();
  if (!trimmed) return null;
  // Le compteur UI borne déjà à 10000 caractères ; on re-borne côté serveur.
  return trimmed.slice(0, 10_000);
}

export interface PrintRenderPromptArgs {
  sceneDetails?: string;
  sceneTypeId?: string;
  materialId?: string;
  lightingId?: string;
}

export function buildPrintRenderPrompt(args: PrintRenderPromptArgs): string {
  const parts: string[] = [
    "photorealistic architectural render, preserve exact geometry and proportions of the input image",
  ];
  for (const part of [
    fragment(SCENE_TYPE_FRAGMENTS, args.sceneTypeId),
    fragment(MATERIAL_FRAGMENTS, args.materialId),
    fragment(LIGHTING_FRAGMENTS, args.lightingId),
    sanitizeSceneDetails(args.sceneDetails),
  ]) {
    if (part) parts.push(part);
  }
  return parts.join(", ");
}

export interface MoodSwapPromptArgs {
  moodId?: string;
  sceneDetails?: string;
}

/** Fonction 2 — Mood Shift : MÊME scène, seule l'ambiance varie. */
export function buildMoodSwapPrompt(args: MoodSwapPromptArgs): string {
  const parts: string[] = [
    "same architectural scene as the input image, preserve exact geometry, composition and materials — change only the atmosphere",
    fragment(MOOD_FRAGMENTS, args.moodId) ?? MOOD_FRAGMENTS.daylight,
  ];
  const details = sanitizeSceneDetails(args.sceneDetails);
  if (details) parts.push(details);
  return parts.join(", ");
}

/** Fonction 3 — Exterior -> Interior : pas de preset en V1, le bâtiment
 *  guide le style intérieur (+ détails libres optionnels). */
export function buildExteriorToInteriorPrompt(args: { sceneDetails?: string }): string {
  const parts: string[] = [
    "plausible interior view of the same building, coherent with the exterior architecture, style and materials visible in the input image, professionally staged interior, natural light consistent with the façade openings, photorealistic",
  ];
  const details = sanitizeSceneDetails(args.sceneDetails);
  if (details) parts.push(details);
  return parts.join(", ");
}

export interface PlanToRenderPromptArgs {
  planStyleId?: string;
  sceneDetails?: string;
}

/** Fonction 4 — Plan technique 2D -> rendu meublé/paysagé. */
export function buildPlanToRenderPrompt(args: PlanToRenderPromptArgs): string {
  const parts: string[] = [
    "transform this 2D technical plan into a photorealistic architectural render, accurate to the plan layout",
    fragment(PLAN_RENDER_FRAGMENTS, args.planStyleId) ?? PLAN_RENDER_FRAGMENTS.furnished_interior,
  ];
  const details = sanitizeSceneDetails(args.sceneDetails);
  if (details) parts.push(details);
  return parts.join(", ");
}

export interface MultiAnglePromptArgs {
  angleId?: string;
  sceneDetails?: string;
}

/** Fonction 6 — Multi-Angle : cohérence best-effort (pas de garantie). */
export function buildMultiAnglePrompt(args: MultiAnglePromptArgs): string {
  const parts: string[] = [
    fragment(ANGLE_FRAGMENTS, args.angleId) ?? ANGLE_FRAGMENTS.eye_level,
    "preserve the architecture, geometry, materials, lighting and environment of the input image — only the camera viewpoint changes, photorealistic",
  ];
  const details = sanitizeSceneDetails(args.sceneDetails);
  if (details) parts.push(details);
  return parts.join(", ");
}

export interface AnimatePromptArgs {
  sceneDetails?: string;
  motionId?: string;
}

export function buildAnimatePrompt(args: AnimatePromptArgs): string {
  const parts: string[] = [
    "cinematic architectural video, photorealistic, smooth camera motion, preserve the building geometry",
  ];
  const motion = fragment(MOTION_FRAGMENTS, args.motionId);
  parts.push(motion ?? MOTION_FRAGMENTS.push_in);
  const details = sanitizeSceneDetails(args.sceneDetails);
  if (details) parts.push(details);
  return parts.join(", ");
}
