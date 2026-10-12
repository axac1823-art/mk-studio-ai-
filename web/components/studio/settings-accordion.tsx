"use client";

// Contrôles créatifs Render : les matériaux et l'éclairage restent visibles.
import { useId } from "react";

import { PresetGrid } from "@/components/studio/preset-grid";
import { LIGHTING_PRESETS, MATERIAL_PRESETS } from "@/lib/presets";

interface SettingsAccordionProps {
  /** Titre conservé pour compatibilité avec l'appelant existant. */
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
  const sectionId = useId();
  const designTitleId = `${sectionId}-design-title`;
  const materialTitleId = `${sectionId}-material-title`;
  const lightingTitleId = `${sectionId}-lighting-title`;

  return (
    <section className="flex min-w-0 flex-col gap-4 border-t pt-4" aria-labelledby={designTitleId}>
      <div className="flex flex-col gap-1">
        <h3 id={designTitleId} className="text-sm font-semibold tracking-tight">
          {label}
        </h3>
        <p className="text-xs leading-5 text-muted-foreground">
          Choose the material character and lighting mood for this render.
        </p>
      </div>

      <section className="flex min-w-0 flex-col gap-2" aria-labelledby={materialTitleId}>
        <div className="flex items-baseline justify-between gap-2">
          <h4 id={materialTitleId} className="text-sm font-medium">Material</h4>
          <span className="text-xs text-muted-foreground">Surface character</span>
        </div>
        <PresetGrid items={MATERIAL_PRESETS} value={materialId} onChange={onMaterialChange} />
      </section>

      <section className="flex min-w-0 flex-col gap-2 border-t pt-3" aria-labelledby={lightingTitleId}>
        <div className="flex items-baseline justify-between gap-2">
          <h4 id={lightingTitleId} className="text-sm font-medium">Lighting</h4>
          <span className="text-xs text-muted-foreground">Time and atmosphere</span>
        </div>
        <PresetGrid items={LIGHTING_PRESETS} value={lightingId} onChange={onLightingChange} />
      </section>
    </section>
  );
}
