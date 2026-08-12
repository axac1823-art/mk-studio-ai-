"use client";

// Panneau Upscale — flux simple et autonome : upload d'une image,
// choix du modèle upscaler, facteur 2×/4×, toggle Enhance, puis génération.
// Le résultat est un NOUVEL asset lié à l'original (parent_generation_id) —
// avant/après conservé.
import { Loader2, Sparkles, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { UPSCALE_FACTORS, type UpscaleFactor } from "@/lib/presets";
import { cn } from "@/lib/utils";
import { UploadDropzone } from "@/components/upload-dropzone";

export interface UpscaleModelOption {
  key: string;
  name: string;
  description: string;
  configured: boolean;
}

interface UpscalePanelProps {
  models: UpscaleModelOption[];
  selectedModel: string;
  uploadFile: File | null;
  uploadPreviewUrl: string | null;
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
  const hasSource = uploadFile !== null;
  const canGenerate = hasSource && hasEnoughCredits && !isBusy;
  const modelName = selectedModel ? models.find((m) => m.key === selectedModel)?.name : null;

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

      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">Upscale model</span>
        <Select value={selectedModel} onValueChange={onModelChange} disabled={models.length === 0}>
          <SelectTrigger>
            <SelectValue placeholder={models.length === 0 ? "No upscale models configured" : "Auto (recommended)"}>
              {modelName ?? "Auto (recommended)"}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">Auto (recommended)</SelectItem>
            {models.map((model) => (
              <SelectItem key={model.key} value={model.key}>
                <div className="flex flex-col items-start">
                  <span className="text-sm font-medium">
                    {model.name}
                    {!model.configured && (
                      <span className="ml-2 text-[10px] text-amber-500">(not configured)</span>
                    )}
                  </span>
                  <span className="text-xs text-muted-foreground">{model.description}</span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {models.length === 0 && (
          <p className="text-[11px] text-muted-foreground">No upscale provider configured on the worker.</p>
        )}
      </div>

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
