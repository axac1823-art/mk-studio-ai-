// Route serveur : crée un job de génération et lance l'orchestration en
// arrière-plan (le client polle GET /api/generate/[id]).
//
// Règles non négociables appliquées ici :
// - la clé fournisseur ne quitte jamais le serveur (tout passe par le
//   generation-router) ;
// - le texte libre utilisateur est enveloppé dans les templates serveur
//   (lib/ai/prompt-templates.ts), jamais envoyé brut ;
// - le client ne reçoit que des messages GÉNÉRIQUES — l'erreur réelle et
//   le modèle ayant servi sont journalisés côté serveur (logger) ;
// - aucun sélecteur de modèle exposé : le routage est 100% serveur (scope
//   V1 — agrégateur vertical, le choix du modèle est un détail interne) ;
// - crédits : vérification du solde AVANT lancement ; le débit réel
//   n'arrive qu'au jalon DB (ledger), et uniquement au succès.
import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";

import { runGeneration } from "@/lib/ai/router";
import { logGeneration } from "@/lib/ai/logger";
import { isAnyProviderConfigured } from "@/lib/ai/providers";
import {
  buildAnimatePrompt,
  buildExteriorToInteriorPrompt,
  buildMoodSwapPrompt,
  buildMultiAnglePrompt,
  buildPlanToRenderPrompt,
  buildPrintRenderPrompt,
} from "@/lib/ai/prompt-templates";
import type { AspectRatio, Feature, GenerationRequest, QualityTier, Resolution } from "@/lib/ai/types";
import { AllModelsFailedError } from "@/lib/ai/types";
import { computeCreditCost } from "@/lib/costs";
import { getCreditBalance } from "@/lib/credits";
import { createJob, updateJob } from "@/lib/jobs/store";
import { MAX_QUANTITY, MAX_REFERENCES, SCENE_DETAILS_MAX } from "@/lib/presets";

export const runtime = "nodejs";
// La génération vidéo (Animate) peut durer plusieurs minutes.
export const maxDuration = 300;

// Les 6 fonctions du scope MVP (agrégateur vertical archviz/immobilier).
const SUPPORTED_FEATURES: Feature[] = [
  "print_render",
  "mood_swap",
  "exterior_to_interior",
  "plan_to_render",
  "multi_angle",
  "animate",
];
const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/webp"];
const MAX_PRIMARY_SIZE = 10 * 1024 * 1024;
const MAX_REFERENCE_SIZE = 5 * 1024 * 1024;
const ASPECT_RATIOS: AspectRatio[] = ["1:1", "16:9", "9:16", "4:3", "3:4"];
const RESOLUTIONS: Resolution[] = ["1K", "2K", "4K"];
const QUALITY_TIERS: QualityTier[] = ["standard", "pro"];
const DURATIONS = [4, 8];

function asDataUri(buffer: Buffer, mime: string): string {
  return `data:${mime};base64,${buffer.toString("base64")}`;
}

function validImageFile(value: unknown, maxSize: number): value is File {
  return (
    value instanceof File &&
    ALLOWED_TYPES.includes(value.type) &&
    value.size > 0 &&
    value.size <= maxSize
  );
}

interface PromptFields {
  sceneDetails?: string;
  sceneTypeId?: string;
  materialId?: string;
  lightingId?: string;
  motionId?: string;
  /** Preset de la fonction, porté par UN champ générique côté client
   *  (moodId, planStyleId ou angleId selon la feature). */
  optionId?: string;
}

/** Dispatch du template serveur par feature — tout le prompt engineering
 *  vit dans lib/ai/prompt-templates.ts. */
function buildFeaturePrompt(feature: Feature, fields: PromptFields): string {
  switch (feature) {
    case "animate":
      return buildAnimatePrompt(fields);
    case "mood_swap":
      return buildMoodSwapPrompt({ moodId: fields.optionId, sceneDetails: fields.sceneDetails });
    case "exterior_to_interior":
      return buildExteriorToInteriorPrompt(fields);
    case "plan_to_render":
      return buildPlanToRenderPrompt({
        planStyleId: fields.optionId,
        sceneDetails: fields.sceneDetails,
      });
    case "multi_angle":
      return buildMultiAnglePrompt({ angleId: fields.optionId, sceneDetails: fields.sceneDetails });
    default:
      return buildPrintRenderPrompt(fields);
  }
}

export async function POST(req: NextRequest) {
  // Au moins un fournisseur configuré (voir .env.example) — sinon la file
  // échouerait à coup sûr sur chaque candidat.
  if (!isAnyProviderConfigured()) {
    return NextResponse.json(
      { error: "Generation is not configured yet — please try again later." },
      { status: 503 }
    );
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  // --- Validation de la feature et des réglages ---
  const feature = form.get("feature");
  if (typeof feature !== "string" || !SUPPORTED_FEATURES.includes(feature as Feature)) {
    return NextResponse.json({ error: "This feature is not available yet." }, { status: 400 });
  }

  const image = form.get("image");
  const imageUrlField = form.get("imageUrl");
  const hasImageUrl =
    typeof imageUrlField === "string" && /^https?:\/\/.+/.test(imageUrlField.trim());
  if (!hasImageUrl && !validImageFile(image, MAX_PRIMARY_SIZE)) {
    return NextResponse.json(
      { error: "Please provide a valid image (PNG, JPEG or WebP, 10 MB max)." },
      { status: 400 }
    );
  }

  const referenceFiles = form
    .getAll("reference")
    .filter((value): value is File => value instanceof File && value.size > 0);
  if (referenceFiles.length > MAX_REFERENCES) {
    return NextResponse.json(
      { error: `Too many reference images (${MAX_REFERENCES} max).` },
      { status: 400 }
    );
  }
  if (referenceFiles.some((file) => !validImageFile(file, MAX_REFERENCE_SIZE))) {
    return NextResponse.json(
      { error: "Invalid reference image (PNG, JPEG or WebP, 5 MB max each)." },
      { status: 400 }
    );
  }

  const rawQuality = form.get("quality");
  const quality: QualityTier = QUALITY_TIERS.includes(rawQuality as QualityTier)
    ? (rawQuality as QualityTier)
    : "standard";
  const rawAspect = form.get("aspectRatio");
  const aspectRatio: AspectRatio = ASPECT_RATIOS.includes(rawAspect as AspectRatio)
    ? (rawAspect as AspectRatio)
    : "1:1";
  const rawResolution = form.get("resolution");
  const resolution: Resolution = RESOLUTIONS.includes(rawResolution as Resolution)
    ? (rawResolution as Resolution)
    : "1K";
  const rawQuantity = Number(form.get("quantity"));
  const quantity = Number.isInteger(rawQuantity)
    ? Math.min(Math.max(rawQuantity, 1), MAX_QUANTITY)
    : 1;
  const rawDuration = Number(form.get("durationSeconds"));
  const durationSeconds = (DURATIONS.includes(rawDuration) ? rawDuration : 4) as 4 | 8;

  const sceneDetails = typeof form.get("sceneDetails") === "string"
    ? String(form.get("sceneDetails")).slice(0, SCENE_DETAILS_MAX)
    : undefined;
  const optionId = typeof form.get("optionId") === "string" ? String(form.get("optionId")) : undefined;

  // --- Coût affiché = coût facturé, quel que soit le modèle servant ---
  const cost = computeCreditCost({
    feature: feature as Feature,
    quality,
    resolution,
    quantity,
    durationSeconds,
  });
  const balance = await getCreditBalance();
  if (balance < cost) {
    // Le client affiche le détail chiffré (sans rien révéler du backend).
    return NextResponse.json({ error: "insufficient_credits", required: cost, balance }, { status: 402 });
  }

  // --- Construction de la requête normalisée (prompt enveloppé serveur) ---
  const sceneTypeId = typeof form.get("sceneTypeId") === "string" ? String(form.get("sceneTypeId")) : undefined;
  const materialId = typeof form.get("materialId") === "string" ? String(form.get("materialId")) : undefined;
  const lightingId = typeof form.get("lightingId") === "string" ? String(form.get("lightingId")) : undefined;
  const motionId = typeof form.get("motionId") === "string" ? String(form.get("motionId")) : undefined;

  // Image principale : soit une URL (rendu précédent, transmise telle
  // quelle), soit le fichier uploadé encodé en data URI.
  let imageUrl: string;
  if (hasImageUrl && typeof imageUrlField === "string") {
    imageUrl = imageUrlField.trim();
  } else if (validImageFile(image, MAX_PRIMARY_SIZE)) {
    imageUrl = asDataUri(Buffer.from(await image.arrayBuffer()), image.type);
  } else {
    // Déjà refusé par la validation ci-dessus — garde-fou pour le typage.
    return NextResponse.json(
      { error: "Please provide a valid image (PNG, JPEG or WebP, 10 MB max)." },
      { status: 400 }
    );
  }
  const referenceUrls = await Promise.all(
    referenceFiles.map(async (file) => asDataUri(Buffer.from(await file.arrayBuffer()), file.type))
  );

  const generationRequest: GenerationRequest = {
    feature: feature as Feature,
    imageUrl,
    referenceUrls,
    prompt: buildFeaturePrompt(feature as Feature, {
      sceneDetails,
      sceneTypeId,
      materialId,
      lightingId,
      motionId,
      optionId,
    }),
    quality,
    aspectRatio,
    resolution,
    quantity,
    motionPresetId: motionId,
    durationSeconds,
  };

  // --- Création du job + orchestration en arrière-plan ---
  const jobId = randomUUID();
  createJob(jobId);
  updateJob(jobId, { status: "processing" });

  runGeneration(generationRequest, (stage) => updateJob(jobId, { stage }))
    .then((result) => {
      logGeneration({
        jobId,
        feature: generationRequest.feature,
        servedBy: result.servedBy,
        attempts: result.attempts,
        internalCostWeight: 0, // renseigné au branchement analytics
        creditsCharged: cost, // débit réel au jalon DB, uniquement au succès
        status: "done",
      });
      updateJob(jobId, { status: "done", kind: result.kind, outputUrls: result.outputUrls });
    })
    .catch((err: unknown) => {
      // L'erreur réelle (timeouts, rejets fournisseur...) reste au serveur.
      logGeneration({
        jobId,
        feature: generationRequest.feature,
        attempts: err instanceof AllModelsFailedError ? err.attempts : [],
        internalCostWeight: 0,
        creditsCharged: 0, // pas de débit en cas d'échec
        status: "error",
        error: err instanceof Error ? err.message : String(err),
      });
      updateJob(jobId, {
        status: "error",
        errorMessage: "Generation failed, please try again.",
      });
    });

  return NextResponse.json({ jobId });
}
