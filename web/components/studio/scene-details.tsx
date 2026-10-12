"use client";

// "Description" — le SEUL champ texte libre exposé à l'utilisateur.
// Le texte est enveloppé côté serveur dans les templates de prompt
// (lib/ai/prompt-templates.ts), jamais envoyé brut au modèle.
import { Textarea } from "@/components/ui/textarea";
import { SCENE_DETAILS_MAX } from "@/lib/presets";

interface SceneDetailsProps {
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
}

export function SceneDetails({ value, onChange, required = false }: SceneDetailsProps) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <label htmlFor="scene-details" className="text-sm font-medium">
          Description{required ? " *" : ""}
        </label>
        <span className="text-xs text-muted-foreground">
          {value.length}/{SCENE_DETAILS_MAX}
        </span>
      </div>
      <Textarea
        id="scene-details"
        value={value}
        onChange={(e) => onChange(e.target.value.slice(0, SCENE_DETAILS_MAX))}
        placeholder="Describe what you want to create or change&#8230;"
        rows={4}
        aria-required={required}
        className="min-h-[96px] resize-y text-sm"
      />
    </div>
  );
}