"use client";

// Grille générique de presets visuels (style, matériau, éclairage,
// mouvement...) : vignettes cliquables, aucune zone de prompt technique.
import { Check } from "lucide-react";

import type { PresetMeta } from "@/lib/presets";
import { cn } from "@/lib/utils";

interface PresetGridProps {
  items: PresetMeta[];
  value: string;
  onChange: (id: string) => void;
}

export function PresetGrid({ items, value, onChange }: PresetGridProps) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {items.map((preset) => {
        const isActive = preset.id === value;
        return (
          <button
            key={preset.id}
            type="button"
            onClick={() => onChange(preset.id)}
            aria-pressed={isActive}
            className={cn(
              "group rounded-lg border p-1.5 text-left transition-colors",
              isActive ? "border-primary ring-1 ring-primary" : "hover:border-muted-foreground/40"
            )}
          >
            <div
              className={cn(
                "relative flex h-12 w-full items-center justify-center rounded-md bg-gradient-to-br",
                preset.swatch
              )}
            >
              {isActive && (
                <span className="rounded-full bg-white p-0.5 text-zinc-900 shadow">
                  <Check className="h-3.5 w-3.5" />
                </span>
              )}
            </div>
            <span className="mt-1 block px-0.5 text-xs font-medium">{preset.label}</span>
          </button>
        );
      })}
    </div>
  );
}
