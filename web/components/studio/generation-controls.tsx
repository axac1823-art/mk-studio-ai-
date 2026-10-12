"use client";

import { useState } from "react";
import { ChevronDown, Loader2, Sparkles } from "lucide-react";

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

/** Modèle fourni par le catalogue déjà exposé à cette feature. */
export interface ModelOption {
  key: string;
  name: string;
  description: string;
  configured: boolean;
}

function Control({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </div>
  );
}

function CreditEstimate({ value }: { value?: number }) {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return (
    <span className="shrink-0 rounded-md bg-muted px-2 py-1 text-xs font-semibold tabular-nums text-foreground">
      {value} cr
    </span>
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
  /** Cost of the current selection, computed by the existing pricing function. */
  cost: number;
  /** False while the existing cost config has not loaded or is unavailable. */
  costReady?: boolean;
  /** Exact client-side estimates from computeDisplayCost, keyed by model key. */
  modelCosts?: Record<string, number>;
  /** Estimate for the existing empty-string / server-default selection. */
  autoCost?: number;
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
  costReady = true,
  modelCosts,
  autoCost,
  balance,
  isBusy,
  canGenerate,
  onQuantityChange,
  onQualityChange,
  onAspectRatioChange,
  onResolutionChange,
  onGenerate,
}: GenerationControlsProps) {
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const hasEnoughCredits = !costReady || balance === null || balance >= cost;
  const selectedModel = models.find((candidate) => candidate.key === model);

  return (
    <div className="sticky bottom-0 z-20 -mx-4 border-t bg-background/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/85 sm:-mx-6 sm:px-6">
      <div className="flex flex-wrap items-end gap-x-3 gap-y-2.5">
        <div className="mr-1 flex shrink-0 flex-col justify-end pb-1">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Output</span>
        </div>

        <Control label="Quality">
          <Select value={quality} onValueChange={(value) => onQualityChange(value as QualityTier)}>
            <SelectTrigger className="h-9 w-[108px] text-sm">
              <SelectValue placeholder="Standard" />
            </SelectTrigger>
            <SelectContent>
              {QUALITY_TIERS.map((tier) => (
                <SelectItem key={tier.id} value={tier.id}>{tier.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Control>

        <Control label="Aspect ratio">
          <Select value={aspectRatio} onValueChange={(value) => onAspectRatioChange(value as AspectRatio)}>
            <SelectTrigger className="h-9 w-[92px] text-sm">
              <SelectValue placeholder="4:3" />
            </SelectTrigger>
            <SelectContent>
              {ASPECT_RATIOS.map((ratio) => <SelectItem key={ratio} value={ratio}>{ratio}</SelectItem>)}
            </SelectContent>
          </Select>
        </Control>

        <Control label="Resolution">
          <Select value={resolution} onValueChange={(value) => onResolutionChange(value as Resolution)}>
            <SelectTrigger className="h-9 w-[86px] text-sm">
              <SelectValue placeholder="1K" />
            </SelectTrigger>
            <SelectContent>
              {RESOLUTIONS.map((res) => <SelectItem key={res} value={res}>{res}</SelectItem>)}
            </SelectContent>
          </Select>
        </Control>

        <Control label="Quantity">
          <Select value={String(quantity)} onValueChange={(value) => onQuantityChange(Number(value))}>
            <SelectTrigger className="h-9 w-[76px] text-sm">
              <SelectValue placeholder="1" />
            </SelectTrigger>
            <SelectContent>
              {Array.from({ length: MAX_QUANTITY }, (_, index) => String(index + 1)).map((value) => (
                <SelectItem key={value} value={value}>{value}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Control>

        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-9 gap-1.5 px-2.5 text-sm text-muted-foreground"
          aria-expanded={advancedOpen}
          onClick={() => setAdvancedOpen((open) => !open)}
        >
          Advanced
          <ChevronDown className={`h-4 w-4 transition-transform ${advancedOpen ? "rotate-180" : ""}`} />
        </Button>

        <div className="ml-auto flex w-full flex-col items-stretch gap-1.5 sm:w-auto sm:min-w-[200px] sm:items-end">
          {costReady && !hasEnoughCredits && balance !== null && (
            <p role="alert" className="max-w-[360px] text-left text-xs leading-5 text-destructive sm:text-right">
              This generation needs {cost} credits; your balance is {balance}.{" "}
              <a href="/app/billing" className="font-medium underline underline-offset-2">Buy more</a>
            </p>
          )}
          <Button
            type="button"
            onClick={onGenerate}
            disabled={!canGenerate || isBusy || !hasEnoughCredits}
            className="h-10 w-full min-w-[170px] sm:w-auto"
          >
            {isBusy ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Generating…</>
            ) : (
              <><Sparkles className="mr-2 h-4 w-4" />{costReady ? `Generate · ${cost} credits` : "Generate"}</>
            )}
          </Button>
        </div>

        {advancedOpen && (
          <div className="basis-full border-t pt-3">
            <div className="grid gap-3 md:grid-cols-[minmax(260px,380px)_minmax(0,1fr)] md:items-start">
              <Control label="AI version">
                <Select
                  value={model || "__auto__"}
                  onValueChange={(value) => onModelChange(value === "__auto__" ? "" : value)}
                  disabled={models.length === 0 || isBusy}
                >
                  <SelectTrigger className="h-10 w-full text-sm">
                    <SelectValue placeholder={models.length === 0 ? "No AI versions available" : "Auto (recommended)"} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__auto__">
                      <div className="flex w-full min-w-0 items-center justify-between gap-4">
                        <div className="min-w-0">
                          <span className="block text-sm font-medium">Auto (recommended)</span>
                          <span className="block text-xs text-muted-foreground">Use the current service default</span>
                        </div>
                        <CreditEstimate value={autoCost} />
                      </div>
                    </SelectItem>
                    {models.map((option) => (
                      <SelectItem key={option.key} value={option.key}>
                        <div className="flex w-full min-w-0 items-center justify-between gap-4">
                          <div className="min-w-0">
                            <span className="block text-sm font-medium">
                              {option.name}
                              {!option.configured && <span className="ml-2 text-xs font-normal text-amber-600">Not configured</span>}
                            </span>
                            <span className="block max-w-[240px] truncate text-xs text-muted-foreground">{option.description}</span>
                          </div>
                          {option.configured ? <CreditEstimate value={modelCosts?.[option.key]} /> : null}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Control>

              <div className="rounded-lg border bg-muted/20 p-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">Selected AI version</p>
                    <p className="mt-0.5 truncate text-sm font-semibold">{selectedModel?.name ?? "Auto (recommended)"}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-xs text-muted-foreground">Estimated total</p>
                    {costReady ? (
                      <p className="mt-0.5 text-base font-semibold tabular-nums">{cost} <span className="text-xs font-medium text-muted-foreground">credits</span></p>
                    ) : (
                      <p className="mt-0.5 text-sm font-medium text-muted-foreground">Estimate unavailable</p>
                    )}
                  </div>
                </div>
                {selectedModel && !selectedModel.configured && (
                  <p role="status" className="mt-2 text-xs leading-5 text-amber-600">
                    This version is listed as not configured. Check its availability before generating.
                  </p>
                )}
                <p className="mt-2 text-xs leading-5 text-muted-foreground">
                  Estimates use the existing pricing configuration. The generation service remains responsible for the final charge.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
