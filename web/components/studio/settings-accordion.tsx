"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";

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
  label = "Design",
  materialId,
  lightingId,
  onMaterialChange,
  onLightingChange,
}: SettingsAccordionProps) {
  const [isOpen, setIsOpen] = useState(true);

  return (
    <section className="flex flex-col gap-2" aria-labelledby="design-heading">
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        aria-expanded={isOpen}
        className="flex w-full items-center justify-between py-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span id="design-heading" className="text-sm font-semibold tracking-wide">
          {label}
        </span>
        <ChevronDown
          className={cn(
            "h-4 w-4 text-muted-foreground transition-transform",
            isOpen && "rotate-180",
          )}
        />
      </button>

      {isOpen && (
        <div className="flex flex-col gap-4 border-t pt-3">
          <div className="flex flex-col gap-2">
            <span className="text-xs font-medium text-muted-foreground">Material</span>
            <PresetGrid items={MATERIAL_PRESETS} value={materialId} onChange={onMaterialChange} />
          </div>
          <div className="flex flex-col gap-2">
            <span className="text-xs font-medium text-muted-foreground">Lighting</span>
            <PresetGrid items={LIGHTING_PRESETS} value={lightingId} onChange={onLightingChange} />
          </div>
        </div>
      )}
    </section>
  );
}
