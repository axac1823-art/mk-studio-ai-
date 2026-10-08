"use client";

// Panneau des images de référence : jusqu'à 14 images de conditionnement
// (style/cohérence) envoyées au modèle EN PLUS de l'entrée principale —
// jamais comme entrée principale. Compteur X/14 + bandeau de vignettes.
import { useRef } from "react";
import { Plus, X } from "lucide-react";

import { MAX_REFERENCES } from "@/lib/presets";
import { cn } from "@/lib/utils";

export interface ReferenceImage {
  id: string;
  file: File;
  previewUrl: string;
}

interface ReferencesPanelProps {
  references: ReferenceImage[];
  onAdd: (files: File[]) => void;
  onRemove: (id: string) => void;
}

export function ReferencesPanel({ references, onAdd, onRemove }: ReferencesPanelProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const isFull = references.length >= MAX_REFERENCES;

  const handleFiles = (files: FileList | null) => {
    if (!files) return;
    const remaining = MAX_REFERENCES - references.length;
    onAdd(Array.from(files).slice(0, remaining));
    // Permet de re-sélectionner le même fichier.
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">References</span>
        <span className="text-xs text-muted-foreground">
          {references.length}/{MAX_REFERENCES}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={isFull}
          onClick={() => inputRef.current?.click()}
          className={cn(
            "flex h-16 w-16 items-center justify-center rounded-lg border-2 border-dashed transition-colors",
            isFull
              ? "cursor-not-allowed opacity-40"
              : "border-muted-foreground/30 hover:border-primary/60 hover:bg-accent/50"
          )}
          title={isFull ? `Maximum ${MAX_REFERENCES} references` : "Add reference images"}
        >
          <Plus className="h-5 w-5 text-muted-foreground" />
        </button>

        {references.map((reference) => (
          <div key={reference.id} className="group relative h-16 w-16">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={reference.previewUrl}
              alt="Reference"
              className="h-full w-full rounded-lg border object-cover"
            />
            <button
              type="button"
              onClick={() => onRemove(reference.id)}
              aria-label="Remove reference"
              className="absolute -right-1.5 -top-1.5 rounded-full bg-destructive p-0.5 text-destructive-foreground opacity-0 shadow transition-opacity group-hover:opacity-100"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ))}
      </div>

      <p className="text-xs text-muted-foreground">
        Style or consistency references — the model conditions on them, your upload stays the main input.
      </p>

      <input
        ref={inputRef}
        type="file"
        multiple
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
    </div>
  );
}
