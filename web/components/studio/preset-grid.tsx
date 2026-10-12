"use client";

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
    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
      {items.map((preset) => {
        const isActive = preset.id === value;
        return (
          <button
            key={preset.id}
            type="button"
            onClick={() => onChange(preset.id)}
            aria-pressed={isActive}
            className={cn(
              "group rounded-xl border p-2 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              isActive
                ? "border-primary bg-primary/[0.035] ring-2 ring-primary/10"
                : "border-border/70 bg-background hover:border-muted-foreground/40 hover:bg-muted/20",
            )}
          >
            <div
              className={cn(
                "relative flex h-[60px] w-full items-center justify-center overflow-hidden rounded-lg bg-gradient-to-br",
                preset.swatch,
              )}
            >
              {isActive && (
                <span className="absolute right-1.5 top-1.5 rounded-full bg-background p-1 text-foreground shadow-sm">
                  <Check className="h-3.5 w-3.5" />
                </span>
              )}
              <span
                aria-hidden="true"
                className={cn(
                  "h-5 w-5 rounded-full border border-white/50 bg-white/20 shadow-inner transition-opacity",
                  isActive ? "opacity-100" : "opacity-0 group-hover:opacity-70",
                )}
              />
            </div>
            <span className="mt-2 block px-0.5 text-xs font-semibold leading-4">{preset.label}</span>
          </button>
        );
      })}
    </div>
  );
}
