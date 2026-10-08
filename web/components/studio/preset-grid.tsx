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
              "group rounded-lg border p-1.5 text-left transition-[border-color,box-shadow,background-color] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              isActive
                ? "border-primary bg-primary/5 ring-1 ring-primary"
                : "hover:border-muted-foreground/40 hover:bg-accent/30",
            )}
          >
            <div
              className={cn(
                "relative flex h-10 w-full items-center justify-center rounded-md bg-gradient-to-br",
                preset.swatch,
              )}
            >
              {isActive && (
                <span className="rounded-full bg-white p-0.5 text-zinc-900 shadow">
                  <Check className="h-3 w-3" />
                </span>
              )}
            </div>
            <span className="mt-1 block truncate px-0.5 text-[11px] font-medium">
              {preset.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
