"use client";

// Upscale keeps its existing generation behavior and model routing.
// This panel only presents the existing source, model, scale, and enhance controls.
import { Loader2, Sparkles, X } from "lucide-react";

import { ProjectSourceStrip, type ImageSourceAsset } from "@/components/studio/image-feature-panel";
import { Button } from "@/components/ui/button";
import { ModelPicker, type ModelPickerOption } from "@/components/studio/model-picker";
import { Switch } from "@/components/ui/switch";
import { UploadDropzone } from "@/components/upload-dropzone";
import { UPSCALE_FACTORS, type UpscaleFactor } from "@/lib/presets";
import { cn } from "@/lib/utils";

export type UpscaleModelOption = ModelPickerOption;

interface UpscalePanelProps {
  models: UpscaleModelOption[];
  selectedModel: string;
  uploadFile: File | null;
  uploadPreviewUrl: string | null;
  sourceAssets?: ImageSourceAsset[];
  selectedSourceAssetId?: string | null;
  onSelectSourceAsset?: (asset: ImageSourceAsset) => void;
  factor: UpscaleFactor;
  enhance: boolean;
  cost: number;
  balance: number | null;
  isBusy: boolean;
  onModelChange: (value: string) => void;
  onUploadFileSelected: (file: File, previewUrl: string) => void;
  onClearUpload: () => void;
  onFactorChange: (factor: UpscaleFactor) => void;
  onEnhanceChange: (value: boolean) => void;
  onGenerate: () => void;
}

export function UpscalePanel({
  models,
  selectedModel,
  uploadFile,
  uploadPreviewUrl,
  sourceAssets,
  selectedSourceAssetId,
  onSelectSourceAsset,
  factor,
  enhance,
  cost,
  balance,
  isBusy,
  onModelChange,
  onUploadFileSelected,
  onClearUpload,
  onFactorChange,
  onEnhanceChange,
  onGenerate,
}: UpscalePanelProps) {
  const hasEnoughCredits = balance === null || balance >= cost;
  const hasSource = uploadFile !== null || uploadPreviewUrl !== null;
  const canGenerate = hasSource && hasEnoughCredits && !isBusy;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium">Source image</span>
        <UploadDropzone
          previewUrl={uploadPreviewUrl}
          onFileSelected={(file) => {
            onUploadFileSelected(file, URL.createObjectURL(file));
          }}
          title="Drop an image"
          description="or click to browse — PNG, JPEG, or WebP up to 10 MB"
          ariaLabel="Upload an image to upscale"
        />
        <ProjectSourceStrip
          sourceAssets={sourceAssets}
          selectedSourceAssetId={selectedSourceAssetId}
          onSelectSourceAsset={onSelectSourceAsset}
        />
        {hasSource && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="w-fit gap-1 text-muted-foreground"
            onClick={onClearUpload}
          >
            <X className="h-4 w-4" />
            Clear source
          </Button>
        )}
      </div>

      <ModelPicker models={models} selectedModel={selectedModel} onModelChange={onModelChange} capabilityLabel="Image upscaling" disabled={isBusy} />

      <div className="flex flex-col gap-1">
        <span className="text-sm font-medium">Scale</span>
        <div className="flex overflow-hidden rounded-md border">
          {UPSCALE_FACTORS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              aria-pressed={factor === preset.id}
              onClick={() => onFactorChange(preset.id)}
              className={cn(
                "flex-1 px-3 py-1.5 text-xs font-medium transition-colors",
                factor === preset.id ? "bg-primary text-primary-foreground" : "hover:bg-accent",
              )}
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 rounded-lg border p-3">
        <div className="flex flex-col gap-0.5">
          <span className="text-sm font-medium">Enhance quality</span>
          <span className="text-xs text-muted-foreground">Sharpen and improve details</span>
        </div>
        <Switch checked={enhance} onCheckedChange={onEnhanceChange} />
      </div>

      <div className="flex flex-col gap-1">
        {!hasEnoughCredits && balance !== null && (
          <p role="alert" className="text-xs text-destructive">
            You don&apos;t have enough credits for this upscale. {cost} credits required. You have {balance} credits.
          </p>
        )}
        <Button onClick={onGenerate} disabled={!canGenerate} className="w-full">
          {isBusy ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Upscaling…
            </>
          ) : (
            <>
              <Sparkles className="mr-2 h-4 w-4" />
              Upscale — {cost} credits
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
