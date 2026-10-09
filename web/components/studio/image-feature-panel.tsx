"use client";

import { CheckCircle2, Circle } from "lucide-react";

import { PresetGrid } from "@/components/studio/preset-grid";
import { SceneDetails } from "@/components/studio/scene-details";
import { UploadDropzone } from "@/components/upload-dropzone";
import type { PresetMeta } from "@/lib/presets";
import { cn } from "@/lib/utils";

export interface ImageSourceAsset {
  id: string;
  url: string;
  type: "image" | "video";
  isFavorite: boolean;
  projectId?: string;
}

interface ProjectSourceStripProps {
  sourceAssets?: ImageSourceAsset[];
  selectedSourceAssetId?: string | null;
  onSelectSourceAsset?: (asset: ImageSourceAsset) => void;
  descriptionRequired?: boolean;
}

export function ProjectSourceStrip({
  sourceAssets = [],
  selectedSourceAssetId,
  onSelectSourceAsset,
}: ProjectSourceStripProps) {
  const images = sourceAssets.filter((asset) => asset.type === "image").slice(0, 6);
  if (images.length === 0 || !onSelectSourceAsset) return null;

  return (
    <div className="mt-3 flex min-w-0 flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          From project
        </span>
        <span className="text-[10px] text-muted-foreground">Select an image</span>
      </div>
      <div className="flex min-w-0 gap-2 overflow-x-auto pb-1">
        {images.map((asset, index) => {
          const isSelected = selectedSourceAssetId === asset.id;
          return (
            <button
              key={asset.id}
              type="button"
              aria-label={`Use project image ${index + 1} as source`}
              aria-pressed={isSelected}
              onClick={() => onSelectSourceAsset(asset)}
              className={cn(
                "relative h-14 w-16 shrink-0 overflow-hidden rounded-md border-2 bg-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                isSelected
                  ? "border-primary ring-1 ring-primary"
                  : "border-transparent hover:border-muted-foreground/50",
              )}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={asset.url} alt="" className="h-full w-full object-cover" loading="lazy" />
              <span className="absolute right-1 top-1 rounded-full bg-background/95 p-0.5">
                {isSelected
                  ? <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
                  : <Circle className="h-3.5 w-3.5 text-muted-foreground" />}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
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
  sceneDetails: string;
  onSceneDetailsChange: (value: string) => void;
  sourceAssets?: ImageSourceAsset[];
  selectedSourceAssetId?: string | null;
  onSelectSourceAsset?: (asset: ImageSourceAsset) => void;
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
  sceneDetails,
  onSceneDetailsChange,
  sourceAssets,
  selectedSourceAssetId,
  onSelectSourceAsset,
  descriptionRequired = false,
}: ImageFeaturePanelProps) {
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <span>{uploadLabel ?? "Source"}</span>
          {uploadOptional && (
            <span className="font-normal normal-case tracking-normal">(optional)</span>
          )}
        </div>
        <UploadDropzone
          previewUrl={previewUrl}
          onFileSelected={onFileSelected}
          title={uploadTitle}
          description={uploadDescription}
          ariaLabel={uploadAriaLabel}
        />
        <ProjectSourceStrip
          sourceAssets={sourceAssets}
          selectedSourceAssetId={selectedSourceAssetId}
          onSelectSourceAsset={onSelectSourceAsset}
        />
      </div>
      {options && optionId !== undefined && onOptionChange && (
        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium">{optionsLabel ?? "Preset"}</span>
          <PresetGrid items={options} value={optionId} onChange={onOptionChange} />
        </div>
      )}
      <SceneDetails
        value={sceneDetails}
        onChange={onSceneDetailsChange}
        required={descriptionRequired}
      />
    </div>
  );
}