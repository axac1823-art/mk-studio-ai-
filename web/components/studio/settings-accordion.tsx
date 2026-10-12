"use client";

import { useState } from "react";
import { ChevronDown, SlidersHorizontal } from "lucide-react";

import { PresetGrid } from "@/components/studio/preset-grid";
import { LIGHTING_PRESETS, MATERIAL_PRESETS } from "@/lib/presets";
import { cn } from "@/lib/utils";

interface SettingsAccordionProps {
  label?: string;
  materialId: string;
  lightingId: string;
  onMaterialChange: (id: string) => void;
  onLightingChange: (id: string) => void;
}

export function SettingsAccordion({
  label = "Advanced design",
  materialId,
  lightingId,
  onMaterialChange,
  onLightingChange,
}: SettingsAccordionProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <section className="overflow-hidden rounded-xl border border-border/70 bg-muted/10">
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        aria-expanded={isOpen}
        className="flex w-full items-center justify-between gap-3 p-3.5 text-left transition-colors hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
      >
        <span className="flex min-w-0 items-start gap-2.5">
          <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border bg-background text-muted-foreground">
            <SlidersHorizontal className="h-4 w-4" />
          </span>
          <span className="flex min-w-0 flex-col gap-0.5">
            <span className="text-sm font-semibold">{label}</span>
            <span className="text-xs text-muted-foreground">Material and lighting</span>
          </span>
        </span>
        <ChevronDown className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform", isOpen && "rotate-180")} />
      </button>
      {isOpen && (
        <div className="flex flex-col gap-5 border-t border-border/70 bg-background p-3.5">
          <div className="flex flex-col gap-2.5">
            <span className="text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">Material style</span>
            <PresetGrid items={MATERIAL_PRESETS} value={materialId} onChange={onMaterialChange} />
          </div>
          <div className="flex flex-col gap-2.5 border-t border-border/70 pt-4">
            <span className="text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">Lighting</span>
            <PresetGrid items={LIGHTING_PRESETS} value={lightingId} onChange={onLightingChange} />
          </div>
        </div>
      )}
    </section>
  );
}
