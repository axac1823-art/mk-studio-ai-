"use client";

import { Check } from "lucide-react";

import { SCENE_TYPE_PRESETS } from "@/lib/presets";
import { cn } from "@/lib/utils";

interface SceneTypePickerProps {
  value: string;
  onChange: (id: string) => void;
}

export function SceneTypePicker({ value, onChange }: SceneTypePickerProps) {
  return (
    <section className="flex flex-col gap-2" aria-labelledby="scene-type-heading">
      <div className="flex items-center justify-between">
        <span id="scene-type-heading" className="text-sm font-semibold tracking-wide">
          Scene
        </span>
      </div>

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
                "relative min-h-[72px] rounded-lg border bg-background p-2.5 text-left transition-[border-color,box-shadow,background-color] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                isActive
                  ? "border-primary bg-primary/5 ring-1 ring-primary"
                  : "hover:border-muted-foreground/40 hover:bg-accent/30",
              )}
            >
              {isActive && (
                <span className="absolute right-2 top-2 rounded-full bg-primary p-0.5 text-primary-foreground">
                  <Check className="h-3 w-3" />
                </span>
              )}
              <span className="block pr-5 text-xs font-semibold leading-4">{preset.label}</span>
              <span className="mt-0.5 block text-[11px] leading-4 text-muted-foreground">
                {preset.description}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
