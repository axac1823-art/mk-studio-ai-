"use client";

import { useId, useState } from "react";
import { CheckCircle2, Circle, ChevronDown, ChevronUp, Images } from "lucide-react";

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

const QUICK_SOURCE_LIMIT = 6;

export function ProjectSourceStrip({
  sourceAssets = [],
  selectedSourceAssetId,
  onSelectSourceAsset,
}: ProjectSourceStripProps) {
  const [showAllImages, setShowAllImages] = useState(false);
  const allImagesId = useId();
  const images = sourceAssets.filter((asset) => asset.type === "image");

  if (images.length === 0 || !onSelectSourceAsset) return null;

  const quickImages = images.slice(0, QUICK_SOURCE_LIMIT);

  const renderSourceButton = (asset: ImageSourceAsset, index: number, compact = false) => {
    const isSelected = selectedSourceAssetId === asset.id;
    return (
      <button
        key={asset.id}
        type="button"
        aria-label={`Use project image ${index + 1} of ${images.length} as source`}
        aria-pressed={isSelected}
        title={isSelected ? "Current source" : `Use project image ${index + 1} as source`}
        onClick={() => onSelectSourceAsset(asset)}
        className={cn(
          "group relative shrink-0 overflow-hidden rounded-lg border-2 bg-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          compact ? "h-14 w-[4.25rem]" : "aspect-[4/3] w-full min-w-0",
          isSelected
            ? "border-primary ring-1 ring-primary"
            : "border-transparent hover:border-muted-foreground/50",
        )}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={asset.url}
          alt=""
          className="h-full w-full object-cover transition-transform duration-150 group-hover:scale-[1.03]"
          loading="lazy"
        />
        <span className="absolute right-1 top-1 rounded-full bg-background/95 p-0.5 shadow-sm">
          {isSelected ? (
            <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
          ) : (
            <Circle className="h-3.5 w-3.5 text-muted-foreground" />
          )}
        </span>
      </button>
    );
  };

  return (
    <section className="mt-3 flex min-w-0 flex-col gap-2" aria-label="Choose an image from this project">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          From this project
        </span>
        <span className="text-xs tabular-nums text-muted-foreground">
          {images.length} {images.length === 1 ? "image" : "images"}
        </span>
      </div>

      <div className="flex min-w-0 items-center gap-2 overflow-x-auto overscroll-x-contain pb-1 [scrollbar-width:thin]">
        {quickImages.map((asset, index) => renderSourceButton(asset, index, true))}
        {images.length > QUICK_SOURCE_LIMIT && (
          <button
            type="button"
            aria-expanded={showAllImages}
            aria-controls={allImagesId}
            onClick={() => setShowAllImages((visible) => !visible)}
            className="flex h-14 shrink-0 items-center gap-1 rounded-lg border border-dashed px-3 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/50 hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <Images className="h-4 w-4" />
            {showAllImages ? "Hide all" : `View all ${images.length}`}
            {showAllImages ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </button>
        )}
      </div>

      {images.length > QUICK_SOURCE_LIMIT && (
        <div
          id={allImagesId}
          hidden={!showAllImages}
          className="max-h-72 overflow-y-auto rounded-lg border bg-muted/10 p-2"
          aria-label="All images in this project"
        >
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {images.map((asset, index) => renderSourceButton(asset, index))}
          </div>
        </div>
      )}

      <p className="text-xs leading-5 text-muted-foreground">
        Select any project image to use it as the current source. Your uploaded file and project assets remain separate.
      </p>
    </section>
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
