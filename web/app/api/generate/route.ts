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
import { requireAuth } from "@/lib/auth";
import { computeCost, getBalance } from "@/lib/credits";
import {
  getAsset,
  getDefaultProject,
  getProject,
  insertJob,
  insertSourceAsset,
  markJobFailed,
} from "@/lib/db/queries";
import {
  MAX_QUANTITY,
  MAX_REFERENCES,
  MAX_REFERENCE_SIZE_BYTES,
  MAX_TOTAL_REFERENCE_SIZE_BYTES,
  SCENE_DETAILS_MAX,
} from "@/lib/presets";
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

// Les fonctions image du scope (agrégateur vertical archviz/immobilier).
const SUPPORTED_FEATURES: Feature[] = [
  "print_render",
  "mood_swap",
  "exterior_to_interior",
  "plan_to_render",
  "multi_angle",
  "image_extender",
  "variations",
  "background_remover",
  "text_to_image",
];
const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/webp"];
const IMAGE2_STYLE_FILTER_IDS = new Set([
  "inkprint", "oilpainting", "traditional-japan", "fantasy", "cartoon", "3d",
  "cartoonfun", "digital-art", "comic", "painting", "dark", "sketch", "mock",
  "2000s-phone", "cyberpunk",
]);
const MAX_IMAGE2_STYLE_FILTERS = 3;
const MAX_PRIMARY_SIZE = 10 * 1024 * 1024;
const MAX_REFERENCE_SIZE = MAX_REFERENCE_SIZE_BYTES;
const ASPECT_RATIOS: AspectRatio[] = ["1:1", "16:9", "9:16", "4:3", "3:4"];
const IMAGE2_ADDITIONAL_ASPECT_RATIOS = ["3:2", "2:3", "21:9"];
const RESOLUTIONS: Resolution[] = ["1K", "2K", "4K"];
const QUALITY_TIERS: QualityTier[] = ["standard", "pro"];

type CameraPromptState = {
  azimuth: number;
  elevation: number;
  distance: number;
  height: number;
  target: { x: number; y: number; z: number };
  fov: number;
  roll: number;
  zoom: number;
  projection: "perspective";
};

function parseCameraState(value: string | undefined): CameraPromptState | null | "invalid" {
  if (!value) return null;
  try {
    const raw = JSON.parse(value) as Record<string, unknown>;
    const target = raw.target as Record<string, unknown> | undefined;
    const values = [raw.azimuth, raw.elevation, raw.distance, raw.height, raw.fov, raw.roll, raw.zoom, target?.x, target?.y, target?.z];
    if (!values.every((item) => typeof item === "number" && Number.isFinite(item))) return "invalid";
    const [azimuth, elevation, distance, height, fov, roll, zoom, x, y, z] = values as number[];
    if (azimuth < 0 || azimuth >= 360 || elevation < -30 || elevation > 60 || distance < 1 || distance > 10 || height < -100 || height > 100 || fov < 20 || fov > 100 || roll < -180 || roll > 180 || zoom < 0.5 || zoom > 3) return "invalid";
    if ([x, y, z].some((coordinate) => Math.abs(coordinate) > 100)) return "invalid";
    return { azimuth, elevation, distance, height, target: { x, y, z }, fov, roll, zoom, projection: "perspective" };
  } catch {
    return "invalid";
  }
}

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

  const rawStyleFilterValues = form.getAll("styleFilter");
  const validStyleFilterValues = rawStyleFilterValues.every(
    (value): value is string => typeof value === "string" && IMAGE2_STYLE_FILTER_IDS.has(value),
  );
  if (
    rawStyleFilterValues.length > MAX_IMAGE2_STYLE_FILTERS
    || !validStyleFilterValues
    || new Set(rawStyleFilterValues).size !== rawStyleFilterValues.length
    || (rawStyleFilterValues.length > 0 && feature !== "text_to_image")
  ) {
    return NextResponse.json({ error: "Invalid style filters for this image feature." }, { status: 400 });
  }
  const styleFilters = rawStyleFilterValues as string[];

  const { dbUser: user } = await requireAuth();

  const image = form.get("image");
  const imageUrlField = form.get("imageUrl");
  const hasImageUrl =
    typeof imageUrlField === "string" && /^https?:\/\/.+/.test(imageUrlField.trim());
  const isTextToImage = feature === "text_to_image";
  // Text-to-image : l'image principale est optionnelle (prompt suffit) ;
  // une image de référence peut être fournie via le champ `reference`.
  if (!isTextToImage && !hasImageUrl && !validImageFile(image, MAX_PRIMARY_SIZE)) {
    return NextResponse.json(
      { error: "Please provide a valid image (PNG, JPEG or WebP, 10 MB max)." },
      { status: 400 }
    );
  }

  const rawReferenceMetadata = form
    .getAll("referenceMeta")
    .filter((value): value is string => typeof value === "string");
  const referenceItems: Array<{
    tag: string;
    role: "element" | "base" | "style" | "detail";
    file?: File;
    assetId?: string;
    storagePath?: string;
  }> = [];

  if (rawReferenceMetadata.length > 0) {
    for (let position = 0; position < rawReferenceMetadata.length; position += 1) {
      let metadata: { index?: unknown; source?: unknown; assetId?: unknown; tag?: unknown; role?: unknown };
      try {
        metadata = JSON.parse(rawReferenceMetadata[position]) as typeof metadata;
      } catch {
        return NextResponse.json({ error: "Invalid reference metadata." }, { status: 400 });
      }
      const tag = typeof metadata.tag === "string" ? metadata.tag : "";
      const validRoles = new Set(["element", "base", "style", "detail"]);
      const role = metadata.role === undefined ? "element" : metadata.role;
      if (typeof role !== "string" || !validRoles.has(role)) {
        return NextResponse.json({ error: "Invalid image input role." }, { status: 400 });
      }
      const itemIndex = typeof metadata.index === "number" && Number.isInteger(metadata.index)
        ? metadata.index
        : position;
      if (itemIndex < 0 || itemIndex >= MAX_REFERENCES) {
        return NextResponse.json({ error: "Invalid image input index." }, { status: 400 });
      }

      if (metadata.source === "upload") {
        const file = form.get(`referenceFile_${itemIndex}`);
        if (!(file instanceof File)) {
          return NextResponse.json({ error: "An image input is missing its file." }, { status: 400 });
        }
        referenceItems.push({ tag, role: role as "element" | "base" | "style" | "detail", file });
      } else if (metadata.source === "asset" && typeof metadata.assetId === "string") {
        const asset = await getAsset(user.id, metadata.assetId);
        if (!asset || asset.is_trashed || asset.type !== "image") {
          return NextResponse.json({ error: "One of the selected project images is unavailable." }, { status: 400 });
        }
        referenceItems.push({ tag, role: role as "element" | "base" | "style" | "detail", assetId: metadata.assetId, storagePath: asset.storage_path });
      } else {
        return NextResponse.json({ error: "Invalid image input source." }, { status: 400 });
      }
    }
  } else {
    // Backwards-compatible parser for existing studio tools using form field reference.
    const legacyFiles = form
      .getAll("reference")
      .filter((value): value is File => value instanceof File && value.size > 0);
    const submittedTags = form.getAll("referenceTag").filter((value): value is string => typeof value === "string");
    if (submittedTags.length > 0 && submittedTags.length !== legacyFiles.length) {
      return NextResponse.json({ error: "Reference labels do not match the attached images." }, { status: 400 });
    }
    legacyFiles.forEach((file, index) => {
      referenceItems.push({ tag: submittedTags[index] ?? `@img${index + 1}`, role: "element", file });
    });
  }

  // Style is deliberately a separate input; it is not silently treated as @img content.
  let styleReferenceItem: { file?: File; assetId?: string; storagePath?: string } | null = null;
  const rawStyleReferenceMeta = form.get("styleReferenceMeta");
  if (typeof rawStyleReferenceMeta === "string") {
    let metadata: { source?: unknown; assetId?: unknown };
    try {
      metadata = JSON.parse(rawStyleReferenceMeta) as typeof metadata;
    } catch {
      return NextResponse.json({ error: "Invalid style reference metadata." }, { status: 400 });
    }
    if (metadata.source === "upload") {
      const file = form.get("styleReferenceFile");
      if (!(file instanceof File)) {
        return NextResponse.json({ error: "The style reference image is missing its file." }, { status: 400 });
      }
      styleReferenceItem = { file };
    } else if (metadata.source === "asset" && typeof metadata.assetId === "string") {
      const asset = await getAsset(user.id, metadata.assetId);
      if (!asset || asset.is_trashed || asset.type !== "image") {
        return NextResponse.json({ error: "The selected style image is unavailable." }, { status: 400 });
      }
      styleReferenceItem = { assetId: metadata.assetId, storagePath: asset.storage_path };
    } else {
      return NextResponse.json({ error: "Invalid style reference source." }, { status: 400 });
    }
  }

  if (referenceItems.length + (styleReferenceItem ? 1 : 0) > MAX_REFERENCES) {
    return NextResponse.json({ error: `Too many image inputs (${MAX_REFERENCES} max including Style).` }, { status: 400 });
  }
  const referenceFiles = referenceItems.flatMap((item) => item.file ? [item.file] : []);
  const styleReferenceFile = styleReferenceItem?.file;
  if (referenceFiles.some((file) => !validImageFile(file, MAX_REFERENCE_SIZE))
    || (styleReferenceFile && !validImageFile(styleReferenceFile, MAX_REFERENCE_SIZE))) {
    return NextResponse.json(
      { error: "Invalid image input (PNG, JPEG or WebP, 100 MB max each)." },
      { status: 400 }
    );
  }
  const totalReferenceBytes = referenceFiles.reduce((total, file) => total + file.size, 0) + (styleReferenceFile?.size ?? 0);
  if (totalReferenceBytes > MAX_TOTAL_REFERENCE_SIZE_BYTES) {
    return NextResponse.json(
      { error: "Uploaded content and style images exceed the 500 MB combined limit. Remove an image or upload smaller files." },
      { status: 400 }
    );
  }
  const referenceTags = referenceItems.map((item) => item.tag);
  const referenceRoles = referenceItems.map((item) => item.role);
  if (referenceTags.some((tag) => !/^@img[1-9]\d*$/.test(tag)) || new Set(referenceTags).size !== referenceTags.length) {
    return NextResponse.json({ error: "Invalid or repeated image input labels." }, { status: 400 });
  }

  const rawQuality = form.get("quality");
  const quality: QualityTier = QUALITY_TIERS.includes(rawQuality as QualityTier)
    ? (rawQuality as QualityTier)
    : "standard";
  const rawAspect = form.get("aspectRatio");
  const aspectRatio: string =
    rawAspect === "auto" ||
    (typeof rawAspect === "string" && IMAGE2_ADDITIONAL_ASPECT_RATIOS.includes(rawAspect))
      ? (rawAspect as string)
      : ASPECT_RATIOS.includes(rawAspect as AspectRatio)
        ? (rawAspect as AspectRatio)
        : "1:1";
  const rawResolution = form.get("resolution");
  const resolution: Resolution | "640px" = isTextToImage && rawResolution === "640px"
    ? "640px"
    : RESOLUTIONS.includes(rawResolution as Resolution)
      ? (rawResolution as Resolution)
      : "1K";
  const rawQuantity = Number(form.get("quantity"));
  const quantity = Number.isInteger(rawQuantity)
    ? Math.min(Math.max(rawQuantity, 1), MAX_QUANTITY)
    : 1;

  const sceneDetails = optionalString(form, "sceneDetails")?.slice(0, SCENE_DETAILS_MAX);
  const describedReferenceTags = sceneDetails?.match(/@img[1-9]\d*/g) ?? [];
  const missingReferenceTags = Array.from(new Set(describedReferenceTags)).filter(
    (tag) => !referenceTags.includes(tag),
  );
  if (missingReferenceTags.length > 0) {
    return NextResponse.json(
      {
        error: `Description refers to unattached image tag${missingReferenceTags.length === 1 ? "" : "s"}: ${missingReferenceTags.join(", ")}. Add the image or remove the tag.`,
      },
      { status: 400 },
    );
  }
  const model = optionalString(form, "model"); // choix utilisateur (optionnel)
  const cameraState = parseCameraState(optionalString(form, "cameraState"));
  if (cameraState === "invalid" || (cameraState && feature !== "multi_angle")) {
    return NextResponse.json({ error: "Invalid camera configuration." }, { status: 400 });
  }

  // --- Projet cible : sélection studio, sinon le projet par défaut ---
  const projectIdField = optionalString(form, "projectId");
  const project = projectIdField
    ? await getProject(user.id, projectIdField)
    : await getDefaultProject(user.id);
  if (!project) {
    return NextResponse.json({ error: "Unknown project." }, { status: 400 });
  }

  // --- Coût affiché = coût facturé, quel que soit le modèle servant ---
  const cost = await computeCost({
    feature: feature as Feature,
    quality,
    resolution: resolution === "640px" ? "1K" : resolution,
    quantity,
  });
  const balance = await getBalance();
  if (balance < cost) {
    // Le client affiche le détail chiffré (sans rien révéler du backend).
    return NextResponse.json({ error: "insufficient_credits", required: cost, balance }, { status: 402 });
  }

  // Image principale : soit une URL (rendu précédent, transmise telle
  // quelle), soit le fichier uploadé encodé en data URI. Les data URIs
  // transitent dans le job (jsonb) en attendant le stockage objet.
  // Pour le text-to-image, l'image principale est optionnelle ; si elle
  // est absente, les références optionnelles peuvent guider le style.
  let imageUrl: string | undefined;
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
  } else if (!isTextToImage) {
    // Déjà refusé par la validation ci-dessus — garde-fou pour le typage.
    return NextResponse.json(
      { error: "Please provide a valid image (PNG, JPEG or WebP, 10 MB max)." },
      { status: 400 }
    );
  }
  // Store content references and Style separately. Style must never occupy the @img1 slot.
  const referenceUrls: string[] = [];
  let styleReferenceUrl: string | null = null;
  try {
    for (const reference of referenceItems) {
      if (reference.storagePath) {
        referenceUrls.push(reference.storagePath);
        continue;
      }
      if (!reference.file) {
        return NextResponse.json({ error: "An image input could not be read." }, { status: 400 });
      }
      const buffer = Buffer.from(await reference.file.arrayBuffer());
      const storagePath = await uploadSource(buffer, reference.file.type);
      try {
        await insertSourceAsset({ userId: user.id, projectId: project.id, type: "image", storagePath });
      } catch {
        // Asset-library indexing is optional; the generation input remains valid.
      }
      referenceUrls.push(storagePath);
    }

    if (styleReferenceItem?.storagePath) {
      styleReferenceUrl = styleReferenceItem.storagePath;
    } else if (styleReferenceItem?.file) {
      const buffer = Buffer.from(await styleReferenceItem.file.arrayBuffer());
      const storagePath = await uploadSource(buffer, styleReferenceItem.file.type);
      try {
        await insertSourceAsset({ userId: user.id, projectId: project.id, type: "image", storagePath });
      } catch {
        // Style input stays available even if optional asset-library indexing fails.
      }
      styleReferenceUrl = storagePath;
    }
  } catch {
    return NextResponse.json({ error: "One or more images could not be stored. Try fewer or smaller files." }, { status: 502 });
  }

  // --- Création du job + démarrage côté worker ---
  const jobId = await insertJob({
    userId: user.id,
    projectId: project.id,
    type: feature as Feature,
    jobInput: {
      feature,
      imageUrl,
      // In Image2, the primary source image defines the element identity.
      preserveElementIdentity: isTextToImage && Boolean(imageUrl),
      referenceUrls,
      referenceTags,
      referenceRoles,
      styleReferenceUrl: styleReferenceUrl ?? undefined,
      quality,
      aspectRatio,
      resolution,
      quantity,
      sceneDetails,
      styleFilters: styleFilters.length > 0 ? styleFilters : undefined,
      cameraState: cameraState ?? undefined,
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
