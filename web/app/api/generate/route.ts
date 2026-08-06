// Route serveur : valide la requête, calcule le coût (table action_costs),
// crée la ligne `jobs` en Postgres et délègue l'exécution au worker HTTP.
//
// Règles non négociables appliquées ici :
// - /web ne parle JAMAIS aux providers IA : le worker détient TOUTE la
//   logique de génération, les clés fournisseurs et le prompt engineering ;
// - le client ne reçoit que des messages GÉNÉRIQUES — l'erreur réelle
//   reste côté worker (logs) ;
// - crédits : vérification du solde AVANT création du job ; le débit réel
//   n'intervient QU'au succès (ledger idempotent, exécuté par le worker).
import { NextRequest, NextResponse } from "next/server";

import type { AspectRatio, Feature, QualityTier, Resolution } from "@/lib/ai/types";
import { computeCost, getBalance } from "@/lib/credits";
import {
  getDefaultProject,
  getDevUser,
  getProject,
  insertJob,
  insertSourceAsset,
  markJobFailed,
} from "@/lib/db/queries";
import { MAX_QUANTITY, MAX_REFERENCES, SCENE_DETAILS_MAX } from "@/lib/presets";
import {
  WorkerNotConfiguredError,
  isWorkerConfigured,
  startImageJob,
  uploadSource,
} from "@/lib/worker-client";

export const runtime = "nodejs";

export const dynamic = "force-dynamic";
// La génération vidéo (Animate) peut durer plusieurs minutes côté worker.
export const maxDuration = 300;

// Les 5 fonctions image du scope MVP (agrégateur vertical archviz/immobilier).
const SUPPORTED_FEATURES: Feature[] = [
  "print_render",
  "mood_swap",
  "exterior_to_interior",
  "plan_to_render",
  "multi_angle",
];
const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/webp"];
const MAX_PRIMARY_SIZE = 10 * 1024 * 1024;
const MAX_REFERENCE_SIZE = 5 * 1024 * 1024;
const ASPECT_RATIOS: AspectRatio[] = ["1:1", "16:9", "9:16", "4:3", "3:4"];
const RESOLUTIONS: Resolution[] = ["1K", "2K", "4K"];
const QUALITY_TIERS: QualityTier[] = ["standard", "pro"];

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

function optionalString(form: FormData, key: string): string | undefined {
  const value = form.get(key);
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

export async function POST(req: NextRequest) {
  // Le worker doit avoir au moins un provider configuré — sinon le job
  // échouerait à coup sûr sur chaque candidat.
  if (!(await isWorkerConfigured())) {
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

  const sceneDetails = optionalString(form, "sceneDetails")?.slice(0, SCENE_DETAILS_MAX);
  const model = optionalString(form, "model"); // choix utilisateur (optionnel)

  // --- Projet cible : sélection studio, sinon le projet par défaut ---
  const user = await getDevUser();
  const projectIdField = optionalString(form, "projectId");
  const project = projectIdField
    ? await getProject(user.id, projectIdField)
    : await getDefaultProject(user.id);
  if (!project) {
    return NextResponse.json({ error: "Unknown project." }, { status: 400 });
  }

  // --- Coût affiché = coût facturé, quel que soit le modèle servant ---
  const cost = await computeCost({ feature: feature as Feature, quality, resolution, quantity });
  const balance = await getBalance();
  if (balance < cost) {
    // Le client affiche le détail chiffré (sans rien révéler du backend).
    return NextResponse.json({ error: "insufficient_credits", required: cost, balance }, { status: 402 });
  }

  // Image principale : soit une URL (rendu précédent, transmise telle
  // quelle), soit le fichier uploadé encodé en data URI. Les data URIs
  // transitent dans le job (jsonb) en attendant le stockage objet.
  let imageUrl: string;
  if (hasImageUrl && typeof imageUrlField === "string") {
    imageUrl = imageUrlField.trim();
  } else if (validImageFile(image, MAX_PRIMARY_SIZE)) {
    const buffer = Buffer.from(await image.arrayBuffer());
    imageUrl = asDataUri(buffer, image.type);
    // L'upload source devient un asset réutilisable (page Uploads) —
    // best-effort : un échec ne bloque PAS la génération.
    try {
      const storagePath = await uploadSource(buffer, image.type);
      await insertSourceAsset({ userId: user.id, projectId: project.id, type: "image", storagePath });
    } catch {
      // best-effort : l'asset source est un confort, pas un prérequis.
    }
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

  // --- Création du job + démarrage côté worker ---
  const jobId = await insertJob({
    userId: user.id,
    projectId: project.id,
    type: feature as Feature,
    jobInput: {
      feature,
      imageUrl,
      referenceUrls,
      quality,
      aspectRatio,
      resolution,
      quantity,
      sceneDetails,
      optionId: optionalString(form, "optionId"),
      sceneTypeId: optionalString(form, "sceneTypeId"),
      materialId: optionalString(form, "materialId"),
      lightingId: optionalString(form, "lightingId"),
      motionId: optionalString(form, "motionId"),
      model,
      creditCost: cost,
    },
  });

  try {
    await startImageJob(jobId);
  } catch (err) {
    await markJobFailed(jobId);
    if (err instanceof WorkerNotConfiguredError) {
      return NextResponse.json(
        { error: "Generation is not configured yet — please try again later." },
        { status: 503 }
      );
    }
    return NextResponse.json({ error: "Generation failed, please try again." }, { status: 500 });
  }

  return NextResponse.json({ jobId });
}
