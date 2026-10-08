"use client";

import { Textarea } from "@/components/ui/textarea";
import { SCENE_DETAILS_MAX } from "@/lib/presets";

interface SceneDetailsProps {
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
}

export function SceneDetails({ value, onChange, required = false }: SceneDetailsProps) {
  return (
    <section className="flex flex-col gap-2" aria-labelledby="description-heading">
      <div className="flex items-center justify-between gap-3">
        <label htmlFor="scene-details" id="description-heading" className="text-sm font-semibold tracking-wide">
          Description{required ? " *" : ""}
        </label>
        <span className="shrink-0 text-[11px] text-muted-foreground">
          {value.length}/{SCENE_DETAILS_MAX}
        </span>
      </div>
      <Textarea
        id="scene-details"
        value={value}
        onChange={(e) => onChange(e.target.value.slice(0, SCENE_DETAILS_MAX))}
        placeholder="Describe what you want to create or change…"
        rows={4}
        aria-required={required}
        className="min-h-[96px] resize-y text-sm"
      />
    </section>
  );
}
