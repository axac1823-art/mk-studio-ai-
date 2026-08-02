// Table de configuration du routage multi-modèles — le cœur de la couche
// d'orchestration ("generation-router"). C'est ICI, et nulle part ailleurs,
// qu'on décide quels modèles servent chaque fonctionnalité, sur quelle API
// OFFICIELLE ils sont appelés, dans quel ordre ils sont essayés, et combien
// ils coûtent en interne.
//
// Pas d'agrégateur : chaque candidat porte son `provider` (BFL, Google,
// ByteDance ARK, Kling, Runway, ElevenLabs) et le routeur le dispatche vers
// l'adaptateur correspondant (lib/ai/providers/). Changer de fournisseur ou
// de version de modèle = modifier UNE entrée ici.
//
// Règles :
// - Les `key`/`modelId` ne doivent JAMAIS apparaître côté client.
// - Le `costWeight` est un poids de coût INTERNE (comparaison coût/qualité/
//   latence entre modèles). L'utilisateur paie toujours le coût total de la
//   feature (lib/costs.ts, future table action_costs) quel que soit le
//   modèle ayant servi — la variance est absorbée par la plateforme.
// - ⚠️ Les modelId sont indicatifs : vérifier la doc de chaque fournisseur
//   (les versions évoluent vite) avant la mise en production.
import type { Feature, GenerationRequest, ProviderName, QualityTier } from "./types";
import { toBase64OrUrl } from "./providers/http";

export interface ModelCandidate {
  /** Clé interne — journalisation/analytics uniquement, JAMAIS exposée. */
  key: string;
  /** API officielle appelée pour ce candidat (voir lib/ai/providers/). */
  provider: ProviderName;
  /** Identifiant du modèle CHEZ SON FOURNISSEUR (endpoint ou model name). */
  modelId: string;
  costWeight: number;
  /** Nombre max d'images de référence acceptées (0 = elles seront ignorées). */
  maxReferences: number;
  timeoutMs: number;
  /** Niveau(x) de qualité servi(s) par ce candidat. */
  tiers: QualityTier[];
  buildInput(req: GenerationRequest): Record<string, unknown>;
  extractOutput(data: unknown): string[];
}

// --- Extracteurs tolérants : normalisent les réponses des adaptateurs vers
//     une simple liste d'URLs (les adaptateurs rendent tous la même forme
//     { images } / { video }). ---

function asRecord(data: unknown): Record<string, unknown> {
  return typeof data === "object" && data !== null ? (data as Record<string, unknown>) : {};
}

function extractImageUrls(data: unknown): string[] {
  const images = asRecord(data).images;
  if (!Array.isArray(images)) return [];
  return images
    .map((img) => asRecord(img).url)
    .filter((url): url is string => typeof url === "string" && url.length > 0);
}

function extractVideoUrl(data: unknown): string[] {
  const video = asRecord(asRecord(data).video);
  return typeof video.url === "string" ? [video.url] : [];
}

// --- Fabriques d'input : traduisent la GenerationRequest normalisée vers
//     le vocabulaire de l'API officielle de chaque fournisseur. ---

/** BFL Flux Kontext : une seule image d'entrée, base64 brut. L'adaptateur
 *  duplique la requête pour servir `quantity`. */
function bflEditInput(req: GenerationRequest): Record<string, unknown> {
  return {
    prompt: req.prompt,
    input_image: toBase64OrUrl(req.imageUrl),
    output_format: "jpeg",
    safety_tolerance: 2,
    quantity: req.quantity,
  };
}

/** Google Gemini image : l'image principale en tête, suivie des références,
 *  en parts inline_data (data URIs conservées). */
function googleEditInput(req: GenerationRequest): Record<string, unknown> {
  return {
    prompt: req.prompt,
    images: [req.imageUrl, ...req.referenceUrls],
    quantity: req.quantity,
  };
}

/** Les durées demandées (4/8/12 s) sont mappées au plus proche supporté
 *  par les modèles vidéo (généralement 5 ou 10 s). */
function mapDuration(req: GenerationRequest): number {
  return (req.durationSeconds ?? 4) <= 6 ? 5 : 10;
}

/** Kling officiel : image base64 ou URL ; les ratios 4:3/3:4 ne sont pas
 *  supportés par l'endpoint — repli sur le ratio cinéma le plus proche. */
function klingVideoInput(req: GenerationRequest): Record<string, unknown> {
  const ratio =
    req.aspectRatio === "16:9" || req.aspectRatio === "4:3"
      ? "16:9"
      : req.aspectRatio === "9:16" || req.aspectRatio === "3:4"
        ? "9:16"
        : "1:1";
  return {
    image: toBase64OrUrl(req.imageUrl),
    prompt: req.prompt,
    duration: String(mapDuration(req)),
    aspect_ratio: ratio,
  };
}

/** Runway officiel : ratios en pixels cibles, durée numérique. */
function runwayVideoInput(req: GenerationRequest): Record<string, unknown> {
  const ratio =
    req.aspectRatio === "16:9"
      ? "1280:720"
      : req.aspectRatio === "9:16"
        ? "720:1280"
        : req.aspectRatio === "4:3"
          ? "1104:832"
          : req.aspectRatio === "3:4"
            ? "832:1104"
            : "960:960";
  return {
    promptImage: req.imageUrl,
    promptText: req.prompt,
    ratio,
    duration: mapDuration(req),
  };
}

/** OpenAI GPT Image : édition multi-images ; tailles au plus proche du
 *  ratio demandé (l'API n'offre que 3 tailles), qualité depuis le tier. */
function openaiEditInput(req: GenerationRequest): Record<string, unknown> {
  return {
    prompt: req.prompt,
    images: [req.imageUrl, ...req.referenceUrls],
    size:
      req.aspectRatio === "16:9" || req.aspectRatio === "4:3"
        ? "1536x1024"
        : req.aspectRatio === "9:16" || req.aspectRatio === "3:4"
          ? "1024x1536"
          : "1024x1024",
    quality: req.quality === "pro" ? "high" : "medium",
    quantity: req.quantity,
  };
}

/** OpenAI Sora : les durées demandées (4/8/12 s) correspondent EXACTEMENT
 *  à celles de l'API ; ratios mappés sur les 2 orientations disponibles. */
function soraVideoInput(req: GenerationRequest): Record<string, unknown> {
  return {
    prompt: req.prompt,
    image_url: req.imageUrl,
    seconds: String(req.durationSeconds ?? 4),
    size: req.aspectRatio === "9:16" || req.aspectRatio === "3:4" ? "720x1280" : "1280x720",
  };
}

/** Magic Hour (agrégateur — exception assumée, voir AGENTS.md §1) : le
 *  modèle épinglé (flux-2-klein) n'accepte que auto/1:1/16:9/9:16 — les
 *  ratios 4:3 et 3:4 replient sur le plus proche supporté (même logique
 *  que pour Kling vidéo). Résolution "auto" : mappée côté serveur selon
 *  le TIER de l'abonnement (le free tier rejette 1k+ -> 640px) — le
 *  réglage résolution du studio est donc ignoré pour ce candidat. */
function magichourEditInput(req: GenerationRequest): Record<string, unknown> {
  const ratio =
    req.aspectRatio === "16:9" || req.aspectRatio === "4:3"
      ? "16:9"
      : req.aspectRatio === "9:16" || req.aspectRatio === "3:4"
        ? "9:16"
        : "1:1";
  return {
    prompt: req.prompt,
    images: [req.imageUrl, ...req.referenceUrls],
    aspectRatio: ratio,
    resolution: "auto",
    quantity: req.quantity,
  };
}

/** Magic Hour image-to-video : durées transmises telles quelles (le routage
 *  `default` vise kling-3.0 sur tiers payants, qui accepte 3-15 s),
 *  résolution depuis le tier. */
function magichourVideoInput(req: GenerationRequest): Record<string, unknown> {
  return {
    prompt: req.prompt,
    image: req.imageUrl,
    endSeconds: req.durationSeconds ?? 4,
    resolution: req.quality === "pro" ? "1080p" : "720p",
  };
}

/** ComfyUI (serveur LOCAL de test) : img2img — l'image source est versée
 *  dans input/ par l'adaptateur ; dimensions et composition suivent
 *  l'original (denoise borné < 1). */
function comfyuiImg2imgInput(req: GenerationRequest): Record<string, unknown> {
  return {
    prompt: req.prompt,
    image: req.imageUrl,
    quantity: req.quantity,
  };
}

/** ComfyUI (serveur LOCAL de test) : img2video — le workflow custom
 *  (COMFYUI_VIDEO_WORKFLOW_FILE) reçoit prompt/image + dimensions cibles.
 *  Tailles modestes en multiples de 16 (la vidéo locale est LOURDE sur GPU
 *  grand public) : ~480p en standard, ~720p en pro ; la durée est convertie
 *  en frames côté adaptateur (COMFYUI_VIDEO_FPS). */
function comfyuiVideoInput(req: GenerationRequest): Record<string, unknown> {
  const pro = req.quality === "pro";
  const [width, height] =
    req.aspectRatio === "16:9"
      ? pro
        ? [1280, 720]
        : [832, 480]
      : req.aspectRatio === "9:16"
        ? pro
          ? [720, 1280]
          : [480, 832]
        : req.aspectRatio === "4:3"
          ? pro
            ? [1088, 816]
            : [768, 576]
          : req.aspectRatio === "3:4"
            ? pro
              ? [816, 1088]
              : [576, 768]
            : pro
              ? [960, 960]
              : [640, 640];
  return {
    prompt: req.prompt,
    image: req.imageUrl,
    duration: req.durationSeconds ?? 4,
    width,
    height,
  };
}

// --- LE CATALOGUE : feature -> candidats par ordre de priorité. ---
// Le tri final tient compte du tier demandé (voir router.orderCandidates).

const IMAGE_TIMEOUT_MS = 3 * 60 * 1000;
const VIDEO_TIMEOUT_MS = 10 * 60 * 1000;

/** Candidats partagés par TOUTES les features d'édition image du scope MVP
 *  (même pipeline img2img/edit chez les mêmes fournisseurs — SEUL le prompt
 *  change, voir lib/ai/prompt-templates.ts). Si une feature doit diverger
 *  (modèle dédié, ordre différent), lui donner sa propre liste. */
const IMAGE_EDIT_CANDIDATES: ModelCandidate[] = [
  {
    key: "edit-alpha-pro",
    provider: "bfl",
    modelId: "flux-kontext-max",
    costWeight: 8,
    maxReferences: 0,
    timeoutMs: IMAGE_TIMEOUT_MS,
    tiers: ["pro"],
    buildInput: bflEditInput,
    extractOutput: extractImageUrls,
  },
  {
    key: "edit-beta-pro",
    provider: "google",
    modelId: "gemini-3-pro-image-preview",
    costWeight: 6,
    maxReferences: 13,
    timeoutMs: IMAGE_TIMEOUT_MS,
    tiers: ["standard", "pro"],
    buildInput: googleEditInput,
    extractOutput: extractImageUrls,
  },
  {
    key: "edit-alpha",
    provider: "bfl",
    modelId: "flux-kontext-pro",
    costWeight: 4,
    maxReferences: 0,
    timeoutMs: IMAGE_TIMEOUT_MS,
    tiers: ["standard", "pro"],
    buildInput: bflEditInput,
    extractOutput: extractImageUrls,
  },
  {
    key: "edit-beta",
    provider: "google",
    modelId: "gemini-2.5-flash-image",
    costWeight: 2,
    maxReferences: 13,
    timeoutMs: IMAGE_TIMEOUT_MS,
    tiers: ["standard"],
    buildInput: googleEditInput,
    extractOutput: extractImageUrls,
  },
  {
    key: "edit-delta-pro",
    provider: "openai",
    modelId: "gpt-image-1.5",
    costWeight: 7,
    maxReferences: 13,
    timeoutMs: IMAGE_TIMEOUT_MS,
    tiers: ["pro"],
    buildInput: openaiEditInput,
    extractOutput: extractImageUrls,
  },
  {
    key: "edit-delta",
    provider: "openai",
    modelId: "gpt-image-1",
    costWeight: 5,
    maxReferences: 13,
    timeoutMs: IMAGE_TIMEOUT_MS,
    tiers: ["standard", "pro"],
    buildInput: openaiEditInput,
    extractOutput: extractImageUrls,
  },
  {
    // Agrégateur (exception assumée, voir AGENTS.md §1) : flux-2-klein est
    // ÉPINGLÉ car c'est le seul modèle d'édition éligible au free tier
    // (max 5 images additionnelles, résolution "auto" = plafond du tier)
    // — repasser à `default` (routage recommandé) sur un plan payant.
    key: "edit-epsilon",
    provider: "magichour",
    modelId: "flux-2-klein",
    costWeight: 5,
    maxReferences: 5,
    timeoutMs: IMAGE_TIMEOUT_MS,
    tiers: ["standard", "pro"],
    buildInput: magichourEditInput,
    extractOutput: extractImageUrls,
  },
  {
    // Provider LOCAL de test (votre GPU, gratuit, hors-ligne) : img2img
    // via ComfyUI — dernier recours du routage auto (coût nul). Pas de
    // références (graphe par défaut).
    key: "edit-zeta",
    provider: "comfyui",
    modelId: "img2img",
    costWeight: 0,
    maxReferences: 0,
    timeoutMs: IMAGE_TIMEOUT_MS,
    tiers: ["standard", "pro"],
    buildInput: comfyuiImg2imgInput,
    extractOutput: extractImageUrls,
  },
];

export const MODEL_CATALOG: Record<Feature, ModelCandidate[]> = {
  // Les 5 features image du scope MVP partagent les mêmes candidats.
  print_render: IMAGE_EDIT_CANDIDATES,
  mood_swap: IMAGE_EDIT_CANDIDATES,
  exterior_to_interior: IMAGE_EDIT_CANDIDATES,
  plan_to_render: IMAGE_EDIT_CANDIDATES,
  multi_angle: IMAGE_EDIT_CANDIDATES,

  // Plus de candidat upscale (Seedream/ARK retiré) : le pipeline saute
  // l'étape quand la liste est vide (voir router.runImagePipeline) et livre
  // le rendu à sa résolution native.
  upscale: [],

  animate: [
    {
      key: "video-beta-pro",
      provider: "kling",
      // ⚠️ Nom du modèle v3 à vérifier dans la console Kling — si l'API le
      // rejette, le fallback bascule automatiquement sur v2.5-turbo.
      modelId: "kling-v3",
      costWeight: 18,
      maxReferences: 0,
      timeoutMs: VIDEO_TIMEOUT_MS,
      tiers: ["standard", "pro"],
      buildInput: klingVideoInput,
      extractOutput: extractVideoUrl,
    },
    {
      key: "video-beta",
      provider: "kling",
      modelId: "kling-v2-5-turbo",
      costWeight: 15,
      maxReferences: 0,
      timeoutMs: VIDEO_TIMEOUT_MS,
      tiers: ["standard", "pro"],
      buildInput: klingVideoInput,
      extractOutput: extractVideoUrl,
    },
    {
      key: "video-gamma",
      provider: "runway",
      modelId: "gen4_turbo",
      costWeight: 15,
      maxReferences: 0,
      timeoutMs: VIDEO_TIMEOUT_MS,
      tiers: ["standard"],
      buildInput: runwayVideoInput,
      extractOutput: extractVideoUrl,
    },
    {
      key: "video-delta-pro",
      provider: "openai",
      modelId: "sora-2-pro",
      costWeight: 19,
      maxReferences: 0,
      timeoutMs: VIDEO_TIMEOUT_MS,
      tiers: ["pro"],
      buildInput: soraVideoInput,
      extractOutput: extractVideoUrl,
    },
    {
      key: "video-delta",
      provider: "openai",
      modelId: "sora-2",
      costWeight: 16,
      maxReferences: 0,
      timeoutMs: VIDEO_TIMEOUT_MS,
      tiers: ["standard", "pro"],
      buildInput: soraVideoInput,
      extractOutput: extractVideoUrl,
    },
    {
      // Agrégateur (exception assumée, voir AGENTS.md §1) : `default` ~
      // kling-3.0 sur tiers payants, ltx-2.3 en gratuit (12 s rejeté ->
      // fallback sur les fournisseurs directs).
      key: "video-epsilon",
      provider: "magichour",
      modelId: "default",
      costWeight: 16,
      maxReferences: 0,
      timeoutMs: VIDEO_TIMEOUT_MS,
      tiers: ["standard", "pro"],
      buildInput: magichourVideoInput,
      extractOutput: extractVideoUrl,
    },
    {
      // Provider LOCAL de test (votre GPU, gratuit, hors-ligne) : img2video
      // via ComfyUI — workflow custom OBLIGATOIRE
      // (COMFYUI_VIDEO_WORKFLOW_FILE, ex. Wan 2.2 / LTX-Video), sinon échec
      // vite -> fallback. Dernier recours du routage auto (coût nul).
      key: "video-zeta",
      provider: "comfyui",
      modelId: "i2v",
      costWeight: 0,
      maxReferences: 0,
      timeoutMs: VIDEO_TIMEOUT_MS,
      tiers: ["standard", "pro"],
      buildInput: comfyuiVideoInput,
      extractOutput: extractVideoUrl,
    },
  ],
};
