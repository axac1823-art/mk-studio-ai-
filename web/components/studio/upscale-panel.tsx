"use client";

// Panneau Upscale — action dédiée sur une image source (upload direct comme
// Render, ou asset existant du projet). L'utilisateur choisit un facteur
// 2×/4× et un toggle "Enhance quality". Le résultat est un NOUVEL asset
// lié à l'original (parent_generation_id) — avant/après conservé.
import { Check, Loader2, Sparkles, X } from "lucide-react";

import { AssetSummary } from "@/components/projects/asset-card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { UPSCALE_FACTORS, type UpscaleFactor } from "@/lib/presets";
import { cn } from "@/lib/utils";
import { UploadDropzone } from "@/components/upload-dropzone";

interface UpscalePanelProps {
  assets: AssetSummary[];
  uploadFile: File | null;
  uploadPreviewUrl: string | null;
  selectedAssetId: string | null;
  factor: UpscaleFactor;
  enhance: boolean;
  cost: number;
  balance: number | null;
  isBusy: boolean;
  onUploadFileSelected: (file: File, previewUrl: string) => void;
  onClearUpload: () => void;
  onSelectAsset: (id: string) => void;
  onFactorChange: (factor: UpscaleFactor) => void;
  onEnhanceChange: (value: boolean) => void;
  onGenerate: () => void;
}

export function UpscalePanel({
  assets,
  uploadFile,
  uploadPreviewUrl,
  selectedAssetId,
  factor,
  enhance,
  cost,
  balance,
  isBusy,
  onUploadFileSelected,
  onClearUpload,
  onSelectAsset,
  onFactorChange,
  onEnhanceChange,
  onGenerate,
}: UpscalePanelProps) {
  const hasEnoughCredits = balance === null || balance >= cost;
  const selectedAsset = assets.find((asset) => asset.id === selectedAssetId);
  const hasSource = uploadFile !== null || selectedAssetId !== null;
  const canGenerate = hasSource && hasEnoughCredits && !isBusy;

  const previewUrl = uploadPreviewUrl ?? selectedAsset?.url ?? null;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium">Source image</span>
        <UploadDropzone
          previewUrl={uploadPreviewUrl}
          onFileSelected={(file) => {
            onUploadFileSelected(file, URL.createObjectURL(file));
          }}
        />
        {uploadFile && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="w-fit gap-1 text-muted-foreground"
            onClick={onClearUpload}
          >
            <X className="h-4 w-4" />
            Clear upload
          </Button>
        )}
      </div>

      {assets.length > 0 && (
        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium text-muted-foreground">Or choose from project</span>
          <div className="grid grid-cols-3 gap-2">
            {assets.map((asset) => {
              const isActive = asset.id === selectedAssetId && !uploadFile;
              return (
                <button
                  key={asset.id}
                  type="button"
                  aria-pressed={isActive}
                  onClick={() => onSelectAsset(asset.id)}
                  className={cn(
                    "relative overflow-hidden rounded-lg border transition-colors",
                    isActive ? "border-primary ring-1 ring-primary" : "hover:border-muted-foreground/40"
                  )}
                >
                  {asset.type === "video" ? (
                    <video
                      src={asset.url}
                      preload="metadata"
                      muted
                      className="aspect-[4/3] w-full object-cover"
                    />
                  ) : (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={asset.url} alt="" className="aspect-[4/3] w-full object-cover" loading="lazy" />
                  )}
                  {isActive && (
                    <span className="absolute right-1 top-1 rounded-full bg-primary p-0.5 text-primary-foreground">
                      <Check className="h-3 w-3" />
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {previewUrl && (
        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium">Selected</span>
          <div className="overflow-hidden rounded-lg border">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={previewUrl} alt="" className="w-full" loading="lazy" />
          </div>
        </div>
      )}

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
                factor === preset.id ? "bg-primary text-primary-foreground" : "hover:bg-accent"
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
              <Loader2 className="animate-spin" />
              Upscaling…
            </>
          ) : (
            <>
              <Sparkles />
              Upscale — {cost} credits
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
