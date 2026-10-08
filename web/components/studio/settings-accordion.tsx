"use client";

// Panneau "Render Settings" repliable (chevron) : révèle les sous-options
// propres à la fonctionnalité — pour Print Render : presets de matériau et
// d'éclairage. D'autres features y ajouteront leurs options (ex. Object
// Swap : sélecteur de catégorie catalogue).
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
  label = "Customize Design",
  materialId,
  lightingId,
  onMaterialChange,
  onLightingChange,
}: SettingsAccordionProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="rounded-lg border">
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        aria-expanded={isOpen}
        className="flex w-full items-center justify-between p-3 text-left"
      >
        <span className="text-sm font-medium">{label}</span>
        <ChevronDown
          className={cn("h-4 w-4 text-muted-foreground transition-transform", isOpen && "rotate-180")}
        />
      </button>

      {isOpen && (
        <div className="flex flex-col gap-4 border-t p-3">
          <div className="flex flex-col gap-2">
            <span className="text-xs font-medium text-muted-foreground">Material style</span>
            <PresetGrid items={MATERIAL_PRESETS} value={materialId} onChange={onMaterialChange} />
          </div>
          <div className="flex flex-col gap-2">
            <span className="text-xs font-medium text-muted-foreground">Lighting</span>
            <PresetGrid items={LIGHTING_PRESETS} value={lightingId} onChange={onLightingChange} />
          </div>
        </div>
      )}
    </div>
  );
}
