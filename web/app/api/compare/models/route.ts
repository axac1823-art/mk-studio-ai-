import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import { getComparePricingConfig } from "@/lib/credits";
import { calculateCompareCredits } from "@/lib/compare/pricing";
import { getCompareSelectionId } from "@/lib/compare/selection";
import type {
  CompareModelOption,
  CompareModelsResponse,
} from "@/lib/compare/types";
import { baseUrl } from "@/lib/worker-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface WorkerTextToImageModel {
  key?: unknown;
  name?: unknown;
  provider?: unknown;
  description?: unknown;
  configured?: unknown;

  supportsImageInput?: unknown;
  supportsStyleReference?: unknown;
  maxReferences?: unknown;

  resolutions?: unknown;
  frameRatios?: unknown;
  textToImageGeneratorFrameRatios?: unknown;

  costPerGeneration?: unknown;
}

function readString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function readStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  return value.filter(
    (item): item is string => typeof item === "string"
  );
}

function readNonNegativeInteger(value: unknown): number {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value < 0
  ) {
    return 0;
  }

  return Math.floor(value);
}

function serializeModel(
  model: WorkerTextToImageModel,
  marginConfig: Awaited<ReturnType<typeof getComparePricingConfig>>
): CompareModelOption | null {
  const internalKey = readString(model.key);
  const name = readString(model.name);
  const provider = readString(model.provider);

  if (!internalKey || !name || !provider) {
    return null;
  }

  const supportsImageInput = model.supportsImageInput === true;
  const supportsStyleReference = model.supportsStyleReference === true;

  const frameRatios = readStringArray(model.frameRatios);

  const generatorFrameRatios =
    readStringArray(model.textToImageGeneratorFrameRatios);

  const resolutions = readStringArray(model.resolutions);

  const providerCost =
    typeof model.costPerGeneration === "number" &&
    Number.isFinite(model.costPerGeneration) &&
    model.costPerGeneration >= 0
      ? model.costPerGeneration
      : null;

  const estimatedCreditsPerImage =
    providerCost === null
      ? null
      : calculateCompareCredits(providerCost, marginConfig);

  return {
    selectionId: getCompareSelectionId(internalKey),

    name,
    provider,
    description: readString(model.description),
    configured: model.configured === true,

    supportsImageInput,
    supportsStyleReference,

    maxReferences: supportsImageInput
      ? readNonNegativeInteger(model.maxReferences)
      : 0,

    resolutions,

    frameRatiosWithoutReferences:
      generatorFrameRatios.length > 0
        ? generatorFrameRatios
        : frameRatios,

    frameRatiosWithReferences:
      supportsImageInput ? frameRatios : [],

    qualityMode: "provider_default",

    estimatedCreditsPerImage,
    pricingBasis: "estimated",
  };
}

export async function GET() {
  try {
    // API privée : ne renvoie aucun catalogue à un utilisateur non authentifié.
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { error: "Authentication required." },
        { status: 401 }
      );
    }

    const [workerResponse, pricingConfig] = await Promise.all([
      fetch(`${baseUrl()}/models/text_to_image`, {
        cache: "no-store",
      }),
      getComparePricingConfig(),
    ]);

    if (!workerResponse.ok) {
      throw new Error(
        `Worker model catalogue failed (${workerResponse.status}).`
      );
    }

    const workerData: unknown = await workerResponse.json();

    if (!Array.isArray(workerData)) {
      throw new Error("Invalid worker model catalogue response.");
    }

    const models = workerData
      .map((item) =>
        serializeModel(
          item as WorkerTextToImageModel,
          pricingConfig
        )
      )
      .filter(
        (item): item is CompareModelOption => item !== null
      );

    const response: CompareModelsResponse = {
      feature: "text_to_image",
      pricingBasis: "estimated",
      models,
    };

    return NextResponse.json(response, {
      headers: {
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("[Compare Models API]", error);

    return NextResponse.json(
      { error: "Failed to load Compare models." },
      { status: 502 }
    );
  }
}