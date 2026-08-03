"use client";

// Barre d'outils de génération (bas de studio) — Model, Quantity, Quality,
// Aspect ratio, Resolution, Generate.
import { Loader2, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ASPECT_RATIOS, MAX_QUANTITY, QUALITY_TIERS, RESOLUTIONS } from "@/lib/presets";
import type { AspectRatio, QualityTier, Resolution } from "@/lib/ai/types";

export interface ModelOption {
  key: string;
  name: string;
  description: string;
}

function Control({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[11px] font-medium text-muted-foreground">{label}</span>
      {children}
    </div>
  );
}

interface GenerationControlsProps {
  quantity: number;
  quality: QualityTier;
  aspectRatio: AspectRatio;
  resolution: Resolution;
  model: string;
  models: ModelOption[];
  onModelChange: (value: string) => void;
  cost: number;
  balance: number | null;
  isBusy: boolean;
  canGenerate: boolean;
  onQuantityChange: (value: number) => void;
  onQualityChange: (value: QualityTier) => void;
  onAspectRatioChange: (value: AspectRatio) => void;
  onResolutionChange: (value: Resolution) => void;
  onGenerate: () => void;
}

export function GenerationControls({
  quantity,
  quality,
  aspectRatio,
  resolution,
  model,
  models,
  onModelChange,
  cost,
  balance,
  isBusy,
  canGenerate,
  onQuantityChange,
  onQualityChange,
  onAspectRatioChange,
  onResolutionChange,
  onGenerate,
}: GenerationControlsProps) {
  const hasEnoughCredits = balance === null || balance >= cost;
  const modelName = model ? models.find((m) => m.key === model)?.name : null;

  return (
    <div className="sticky bottom-0 z-10 -mx-4 border-t bg-background/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
      <div className="flex flex-wrap items-end gap-4">
        <Control label="Model">
          <Select value={model} onValueChange={onModelChange} disabled={models.length === 0}>
            <SelectTrigger className="h-9 w-[180px] text-xs">
              <SelectValue placeholder="Auto (recommended)">
                {modelName ?? "Auto (recommended)"}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">Auto (recommended)</SelectItem>
              {models.map((m) => (
                <SelectItem key={m.key} value={m.key}>
                  <div className="flex flex-col items-start">
                    <span className="text-sm font-medium">{m.name}</span>
                    <span className="text-xs text-muted-foreground">{m.description}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Control>

        <Control label="Quantity">
          <Select value={String(quantity)} onValueChange={(value) => onQuantityChange(Number(value))}>
            <SelectTrigger className="h-9 w-[72px] text-xs">
              <SelectValue placeholder="1" />
            </SelectTrigger>
            <SelectContent>
              {Array.from({ length: MAX_QUANTITY }, (_, i) => String(i + 1)).map((n) => (
                <SelectItem key={n} value={n}>
                  {n}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Control>

        <Control label="Quality">
          <Select value={quality} onValueChange={(value) => onQualityChange(value as QualityTier)}>
            <SelectTrigger className="h-9 w-[120px] text-xs">
              <SelectValue placeholder="Standard" />
            </SelectTrigger>
            <SelectContent>
              {QUALITY_TIERS.map((tier) => (
                <SelectItem key={tier.id} value={tier.id}>
                  {tier.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Control>

        <Control label="Aspect ratio">
          <Select value={aspectRatio} onValueChange={(value) => onAspectRatioChange(value as AspectRatio)}>
            <SelectTrigger className="h-9 w-[100px] text-xs">
              <SelectValue placeholder="4:3" />
            </SelectTrigger>
            <SelectContent>
              {ASPECT_RATIOS.map((ratio) => (
                <SelectItem key={ratio} value={ratio}>
                  {ratio}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Control>

        <Control label="Resolution">
          <Select value={resolution} onValueChange={(value) => onResolutionChange(value as Resolution)}>
            <SelectTrigger className="h-9 w-[90px] text-xs">
              <SelectValue placeholder="1K" />
            </SelectTrigger>
            <SelectContent>
              {RESOLUTIONS.map((res) => (
                <SelectItem key={res} value={res}>
                  {res}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Control>

        <div className="ml-auto flex flex-col items-end gap-1">
          {!hasEnoughCredits && balance !== null && (
            <p role="alert" className="text-xs text-destructive">
              You don&apos;t have enough credits. {cost} required, {balance} available.{" "}
              <a href="/app/billing" className="font-medium underline">
                Buy more
              </a>
            </p>
          )}
          <Button
            onClick={onGenerate}
            disabled={!canGenerate || isBusy || !hasEnoughCredits}
            size="sm"
          >
            {isBusy ? (
              <>
                <Loader2 className="animate-spin" />
                Generating…
              </>
            ) : (
              <>
                <Sparkles />
                Generate — {cost} credits
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
