export type CompareQualityMode = "provider_default";

export interface CompareModelOption {
  selectionId: string;
  name: string;
  provider: string;
  description: string;
  configured: boolean;

  supportsImageInput: boolean;
  supportsStyleReference: boolean;
  maxReferences: number;

  resolutions: string[];
  frameRatiosWithoutReferences: string[];
  frameRatiosWithReferences: string[];

  qualityMode: CompareQualityMode;

  estimatedCreditsPerImage: number | null;
  pricingBasis: "estimated";
}

export interface CompareModelsResponse {
  feature: "text_to_image";
  pricingBasis: "estimated";
  models: CompareModelOption[];
}