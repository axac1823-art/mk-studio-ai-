"use client";

import { useRef } from "react";
import { Plus, X } from "lucide-react";

import { MAX_REFERENCES } from "@/lib/presets";
import { cn } from "@/lib/utils";

export interface ReferenceImage {
  id: string;
  tag: string;
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
    <section className="flex flex-col gap-3 border-t border-border/70 pt-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <span className="text-sm font-semibold">Visual references</span>
          <span className="max-w-[240px] text-xs leading-5 text-muted-foreground">
            Use the @img tags in Description to identify which reference the AI should follow. Your source image remains the main input.
          </span>
        </div>
        <span className="shrink-0 rounded-full border bg-background px-2 py-1 text-[11px] font-medium tabular-nums text-muted-foreground">
          {references.length}/{MAX_REFERENCES}
        </span>
      </div>

      <div className="flex items-center gap-2.5 overflow-x-auto pb-1">
        <button
          type="button"
          disabled={isFull}
          onClick={() => inputRef.current?.click()}
          className={cn(
            "flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border-2 border-dashed transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            isFull
              ? "cursor-not-allowed opacity-40"
              : "border-muted-foreground/30 bg-muted/20 hover:border-primary/60 hover:bg-accent/50",
          )}
          aria-label={isFull ? `Maximum ${MAX_REFERENCES} references` : "Add reference images"}
          title={isFull ? `Maximum ${MAX_REFERENCES} references` : "Add reference images"}
        >
          <Plus className="h-5 w-5 text-muted-foreground" />
        </button>

        {references.map((reference, index) => (
          <div key={reference.id} className="group relative h-14 w-14 shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={reference.previewUrl}
              alt={`Visual reference ${index + 1}`}
              className="h-full w-full rounded-xl border border-border/70 object-cover"
            />
            <button
              type="button"
              onClick={() => onRemove(reference.id)}
              aria-label={`Remove visual reference ${index + 1}`}
              className="absolute -right-1.5 -top-1.5 rounded-full bg-foreground p-1 text-background opacity-90 shadow-sm transition-opacity hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <X className="h-3 w-3" />
            </button>
            <span className="absolute inset-x-0 bottom-0 rounded-b-xl bg-black/70 px-1 text-center text-[9px] font-semibold text-white">
              {reference.tag}
            </span>
          </div>
        ))}
      </div>

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
