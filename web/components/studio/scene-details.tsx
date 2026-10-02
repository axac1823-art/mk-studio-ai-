"use client";

// "Scene details" — le SEUL champ texte libre exposé à l'utilisateur.
// Le texte est enveloppé côté serveur dans les templates de prompt
// (lib/ai/prompt-templates.ts), jamais envoyé brut au modèle.
import { Textarea } from "@/components/ui/textarea";
import { SCENE_DETAILS_MAX } from "@/lib/presets";

interface SceneDetailsProps {
  value: string;
  onChange: (value: string) => void;
}

export function SceneDetails({ value, onChange }: SceneDetailsProps) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <label htmlFor="scene-details" className="text-sm font-medium">
          Scene details
        </label>
        <span className="text-xs text-muted-foreground">
          {value.length}/{SCENE_DETAILS_MAX}
        </span>
      </div>
      <Textarea
        id="scene-details"
        value={value}
        onChange={(e) => onChange(e.target.value.slice(0, SCENE_DETAILS_MAX))}
        placeholder="The more details, the better the result…"
        rows={4}
      />
    </div>
  );
}
