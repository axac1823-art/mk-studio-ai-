"use client";

import { useState } from "react";
import { CheckCircle2, ChevronDown, Circle } from "lucide-react";

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
}

export function ProjectSourceStrip({
  sourceAssets = [],
  selectedSourceAssetId,
  onSelectSourceAsset,
}: ProjectSourceStripProps) {
  const [showAll, setShowAll] = useState(false);
  const images = sourceAssets.filter((asset) => asset.type === "image");
  if (images.length === 0 || !onSelectSourceAsset) return null;
  const visibleImages = showAll ? images : images.slice(0, 6);

  return (
    <div className="mt-1 flex min-w-0 flex-col gap-2.5 rounded-xl border border-border/70 bg-muted/20 p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <span className="block text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
            From this project
          </span>
          <span className="mt-0.5 block text-xs text-muted-foreground">
            {images.length} {images.length === 1 ? "image available" : "images available"}
          </span>
        </div>
        {images.length > 6 && (
          <button
            type="button"
            onClick={() => setShowAll((current) => !current)}
            aria-expanded={showAll}
            className="inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-foreground transition-colors hover:bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {showAll ? "Show less" : "View all"}
            <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", showAll && "rotate-180")} />
          </button>
        )}
      </div>

      <div className={showAll ? "grid grid-cols-3 gap-2 sm:grid-cols-4" : "flex min-w-0 gap-2 overflow-x-auto pb-1"}>
        {visibleImages.map((asset, index) => {
          const isSelected = selectedSourceAssetId === asset.id;
          return (
            <button
              key={asset.id}
              type="button"
              aria-label={`Use project image ${index + 1} as source`}
              aria-pressed={isSelected}
              onClick={() => onSelectSourceAsset?.(asset)}
              className={cn(
                "group relative aspect-[4/3] min-w-0 overflow-hidden rounded-lg border-2 bg-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                showAll ? "w-full" : "h-14 w-16 shrink-0 sm:h-16 sm:w-[72px]",
                isSelected ? "border-primary ring-2 ring-primary/15" : "border-transparent hover:border-muted-foreground/50",
              )}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={asset.url} alt="" className="h-full w-full object-cover" loading="lazy" />
              <span className="absolute right-1 top-1 rounded-full bg-background/95 p-0.5 shadow-sm">
                {isSelected
                  ? <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
                  : <Circle className="h-3.5 w-3.5 text-muted-foreground/80" />}
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
  descriptionLabel?: string;
  descriptionPlaceholder?: string;
  descriptionHelperText?: string;
  showDescription?: boolean;
  descriptionRequired?: boolean;
  referenceTags?: string[];
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
  descriptionLabel,
  descriptionPlaceholder,
  descriptionHelperText,
  showDescription = true,
  descriptionRequired = false,
  referenceTags = [],
}: ImageFeaturePanelProps) {
  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-2.5">
        <div className="flex items-center justify-between gap-3">
          <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
            {uploadLabel ?? "Source image"}
            {uploadOptional && <span className="ml-1.5 font-normal normal-case tracking-normal">(optional)</span>}
          </span>
          {previewUrl && <span className="text-[10px] font-medium text-muted-foreground">Source selected</span>}
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
      </section>

      {options && optionId !== undefined && onOptionChange && (
        <section className="flex flex-col gap-3 border-t border-border/70 pt-5">
          <div className="flex flex-col gap-1">
            <span className="text-sm font-semibold">{optionsLabel ?? "Choose a preset"}</span>
            <span className="text-xs leading-5 text-muted-foreground">Choose a starting point, then refine it with your notes.</span>
          </div>
          <PresetGrid items={options} value={optionId} onChange={onOptionChange} />
        </section>
      )}

      {showDescription && (
        <section className="border-t border-border/70 pt-5">
          <SceneDetails
            value={sceneDetails}
            onChange={onSceneDetailsChange}
            label={descriptionLabel}
            placeholder={descriptionPlaceholder}
            helperText={descriptionHelperText}
            required={descriptionRequired}
            referenceTags={referenceTags}
          />
        </section>
      )}
    </div>
  );
}
