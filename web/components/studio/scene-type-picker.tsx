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
    <section className="flex flex-col gap-3 border-t border-border/70 pt-5">
      <div className="flex flex-col gap-1">
        <span className="text-sm font-semibold">Scene type</span>
        <span className="text-xs leading-5 text-muted-foreground">Choose the context that best matches your project.</span>
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
                "relative flex min-h-[92px] flex-col items-start justify-center rounded-xl border p-3 pr-8 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                isActive
                  ? "border-primary bg-primary/[0.04] ring-2 ring-primary/10"
                  : "border-border/70 bg-background hover:border-muted-foreground/40 hover:bg-muted/30",
              )}
            >
              {isActive && (
                <span className="absolute right-2 top-2 rounded-full bg-primary p-0.5 text-primary-foreground">
                  <Check className="h-3 w-3" />
                </span>
              )}
              <span className="block text-sm font-semibold">{preset.label}</span>
              <span className="mt-1 block text-xs leading-4 text-muted-foreground">{preset.description}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
