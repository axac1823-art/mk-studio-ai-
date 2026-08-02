"use client";

// Barre d'outils de génération (bas de studio) — TOUT en dropdowns :
// - quantité (variantes)
// - qualité — libellé GÉNÉRIQUE ("Standard/Pro") qui ne révèle rien du
//   modèle sous-jacent (règle non négociable)
// - ratio d'aspect, résolution
// - bouton Generate avec coût en crédits EN DIRECT + état désactivé et
//   message chiffré quand le solde est insuffisant (+ lien d'achat)
//
// AUCUN sélecteur de modèle : le routage entre fournisseurs est 100%
// serveur (scope V1 — agrégateur vertical, le modèle est un détail interne).
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

function DropdownControl<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: ReadonlyArray<{ id: T; label: string } | T>;
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      <Select value={value} onValueChange={(id) => onChange(id as T)}>
        <SelectTrigger className="w-[130px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => {
            const id = typeof option === "string" ? option : option.id;
            const text = typeof option === "string" ? option : option.label;
            return (
              <SelectItem key={id} value={id}>
                {text}
              </SelectItem>
            );
          })}
        </SelectContent>
      </Select>
    </div>
  );
}

interface GenerationControlsProps {
  quantity: number;
  quality: QualityTier;
  aspectRatio: AspectRatio;
  resolution: Resolution;
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

  return (
    <div className="sticky bottom-0 z-10 -mx-4 border-t bg-background/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
      <div className="flex flex-wrap items-end gap-x-5 gap-y-3">
        <DropdownControl
          label="Quantity"
          options={Array.from({ length: MAX_QUANTITY }, (_, index) => String(index + 1))}
          value={String(quantity)}
          onChange={(value) => onQuantityChange(Number(value))}
        />
        <DropdownControl
          label="Quality"
          options={QUALITY_TIERS.map((tier) => ({ id: tier.id, label: tier.label }))}
          value={quality}
          onChange={onQualityChange}
        />
        <DropdownControl
          label="Aspect ratio"
          options={ASPECT_RATIOS}
          value={aspectRatio}
          onChange={onAspectRatioChange}
        />
        <DropdownControl
          label="Resolution"
          options={RESOLUTIONS}
          value={resolution}
          onChange={onResolutionChange}
        />

        <div className="ml-auto flex flex-col items-end gap-1">
          {!hasEnoughCredits && balance !== null && (
            <p role="alert" className="text-xs text-destructive">
              You don&apos;t have enough credits for this generation. {cost} credits required. You
              have {balance} credits.{" "}
              {/* La page /app/billing arrive au jalon Stripe. */}
              <a href="/app/billing" className="font-medium underline">
                Buy more credits
              </a>
            </p>
          )}
          <Button onClick={onGenerate} disabled={!canGenerate || isBusy || !hasEnoughCredits} size="lg">
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
