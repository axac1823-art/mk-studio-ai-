"use client";

import { PresetGrid } from "@/components/studio/preset-grid";
import { SceneDetails } from "@/components/studio/scene-details";
import { UploadDropzone } from "@/components/upload-dropzone";
import type { PresetMeta } from "@/lib/presets";

interface SourceAsset {
  id: string;
  url: string;
  type: "image" | "video";
}

interface ImageFeaturePanelProps {
  previewUrl: string | null;
  onFileSelected: (file: File) => void;
  uploadOptional?: boolean;
  uploadLabel?: string;
  uploadTitle?: string;
  uploadDescription?: string;
  uploadAriaLabel?: string;
  options?: PresetMeta[];
  optionsLabel?: string;
  optionId?: string;
  onOptionChange?: (id: string) => void;
  sourceAssets?: SourceAsset[];
  selectedSourceAssetId?: string | null;
  onSelectSourceAsset?: (asset: SourceAsset) => void;
  sceneDetails: string;
  onSceneDetailsChange: (value: string) => void;
  descriptionRequired?: boolean;
}

export function ImageFeaturePanel({
  previewUrl,
  onFileSelected,
  uploadOptional,
  uploadLabel,
  uploadTitle,
  uploadDescription,
  uploadAriaLabel,
  options,
  optionsLabel,
  optionId,
  onOptionChange,
  sourceAssets = [],
  selectedSourceAssetId,
  onSelectSourceAsset,
  sceneDetails,
  onSceneDetailsChange,
  descriptionRequired = false,
}: ImageFeaturePanelProps) {
  return (
    <div className="flex flex-col gap-5">
      <section className="flex flex-col gap-2" aria-labelledby="simple-source-heading">
        <div className="flex items-center justify-between gap-2">
          <span id="simple-source-heading" className="text-sm font-semibold tracking-wide">
            {uploadLabel ?? "Source"}
            {uploadOptional && (
              <span className="ml-1 text-xs font-normal text-muted-foreground">(optional)</span>
            )}
          </span>
        </div>

        <UploadDropzone
          previewUrl={previewUrl}
          onFileSelected={onFileSelected}
          title={uploadTitle}
          description={uploadDescription}
          ariaLabel={uploadAriaLabel}
          previewAlt={uploadLabel ? `${uploadLabel} preview` : "Source image preview"}
        />

        {sourceAssets.length > 0 && onSelectSourceAsset && (
          <div className="flex flex-col gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              From project
            </span>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {sourceAssets.slice(0, 6).map((asset) => (
                <button
                  key={asset.id}
                  type="button"
                  aria-pressed={selectedSourceAssetId === asset.id}
                  onClick={() => onSelectSourceAsset(asset)}
                  className={`h-14 w-14 shrink-0 overflow-hidden rounded-md border-2 bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                    selectedSourceAssetId === asset.id ? "border-primary ring-1 ring-primary" : "border-transparent"
                  }`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={asset.url} alt="Project source" className="h-full w-full object-cover" loading="lazy" />
                </button>
              ))}
            </div>
          </div>
        )}
      </section>

      {options && optionId !== undefined && onOptionChange && (
        <section className="flex flex-col gap-2" aria-labelledby="feature-option-heading">
          <span id="feature-option-heading" className="text-sm font-semibold tracking-wide">
            {optionsLabel ?? "Preset"}
          </span>
          <PresetGrid items={options} value={optionId} onChange={onOptionChange} />
        </section>
      )}

      <SceneDetails
        value={sceneDetails}
        onChange={onSceneDetailsChange}
        required={descriptionRequired}
      />
    </div>
  );
}
