"use client";

// Section "Customize Scene" — le choix du TYPE DE SCÈNE est la base qui
// débloque les bons réglages (matériaux, éclairage) dans l'accordéon en
// dessous. Trois prompts préparés côté serveur, aucun prompt technique
// visible ici.
import { Check } from "lucide-react";

import { SCENE_TYPE_PRESETS } from "@/lib/presets";
import { cn } from "@/lib/utils";

interface SceneTypePickerProps {
  value: string;
  onChange: (id: string) => void;
}

export function SceneTypePicker({ value, onChange }: SceneTypePickerProps) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-medium">Scene</span>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        {SCENE_TYPE_PRESETS.map((preset) => {
          const isActive = preset.id === value;
          return (
            <button
              key={preset.id}
              type="button"
              aria-pressed={isActive}
              onClick={() => onChange(preset.id)}
              className={cn(
                "relative rounded-lg border p-2.5 text-left transition-colors",
                isActive ? "border-primary ring-1 ring-primary" : "hover:border-muted-foreground/40"
              )}
            >
              {isActive && (
                <span className="absolute right-1.5 top-1.5 rounded-full bg-primary p-0.5 text-primary-foreground">
                  <Check className="h-3 w-3" />
                </span>
              )}
              <span className="block text-sm font-medium">{preset.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
