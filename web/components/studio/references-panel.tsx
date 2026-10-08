"use client";

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
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <section className="flex min-w-0 flex-col gap-2" aria-labelledby="references-heading">
      <div className="flex items-center justify-between gap-3">
        <span id="references-heading" className="text-sm font-semibold tracking-wide">
          References
        </span>
        <span className="shrink-0 text-xs text-muted-foreground">
          {references.length}/{MAX_REFERENCES}
        </span>
      </div>

      <div className="flex min-w-0 gap-2 overflow-x-auto pb-1" aria-label="Reference images">
        <button
          type="button"
          disabled={isFull}
          onClick={() => inputRef.current?.click()}
          className={cn(
            "flex h-14 w-14 shrink-0 items-center justify-center rounded-lg border-2 border-dashed transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            isFull
              ? "cursor-not-allowed opacity-40"
              : "border-muted-foreground/30 hover:border-primary/60 hover:bg-accent/50",
          )}
          title={isFull ? `Maximum ${MAX_REFERENCES} references` : "Add reference images"}
          aria-label={isFull ? `Maximum ${MAX_REFERENCES} references` : "Add reference images"}
        >
          <Plus className="h-4 w-4 text-muted-foreground" />
        </button>

        {references.map((reference) => (
          <div key={reference.id} className="group relative h-14 w-14 shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={reference.previewUrl}
              alt="Reference image"
              className="h-full w-full rounded-lg border object-cover"
            />
            <button
              type="button"
              onClick={() => onRemove(reference.id)}
              aria-label="Remove reference image"
              className="absolute -right-1 -top-1 rounded-full bg-destructive p-0.5 text-destructive-foreground opacity-0 shadow transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 focus-visible:opacity-100"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ))}
      </div>

      <p className="text-[11px] leading-4 text-muted-foreground">
        Optional reference images for style or consistency.
      </p>

      <input
        ref={inputRef}
        type="file"
        multiple
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
    </section>
  );
}
