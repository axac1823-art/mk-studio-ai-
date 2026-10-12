"use client";

// Reference images are style/context guidance sent alongside the main source.
// Keep the project's existing data contract: ReferenceImage + onAdd/onRemove.
import { useId, useRef, useState } from "react";
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
  const headingId = useId();
  const helperId = useId();
  const statusId = useId();
  const [notice, setNotice] = useState("");
  const isFull = references.length >= MAX_REFERENCES;
  const remaining = Math.max(0, MAX_REFERENCES - references.length);

  const handleFiles = (files: FileList | null) => {
    if (!files) return;

    const selectedFiles = Array.from(files);
    const filesToAdd = selectedFiles.slice(0, remaining);
    const skippedCount = selectedFiles.length - filesToAdd.length;

    if (filesToAdd.length > 0) {
      onAdd(filesToAdd);
      setNotice(
        `${filesToAdd.length} reference ${filesToAdd.length === 1 ? "image added" : "images added"}.`,
      );
    } else if (isFull && selectedFiles.length > 0) {
      setNotice(`You can add up to ${MAX_REFERENCES} reference images. Remove one to add another.`);
    }

    if (skippedCount > 0) {
      setNotice(
        `${filesToAdd.length} added. ${skippedCount} ${skippedCount === 1 ? "image was" : "images were"} skipped because the limit is ${MAX_REFERENCES}.`,
      );
    }

    // Let the user choose the same file again after removing/replacing it.
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <section className="flex min-w-0 flex-col gap-2" aria-labelledby={headingId}>
      <div className="flex items-center justify-between gap-3">
        <h3 id={headingId} className="text-sm font-medium">
          References
        </h3>
        <span
          className="shrink-0 text-xs tabular-nums text-muted-foreground"
          aria-label={`${references.length} of ${MAX_REFERENCES} reference images selected`}
        >
          {references.length}/{MAX_REFERENCES}
        </span>
      </div>

      <div className="flex min-w-0 items-center gap-2 overflow-x-auto pb-1">
        <button
          type="button"
          disabled={isFull}
          onClick={() => inputRef.current?.click()}
          aria-label={isFull ? `Maximum ${MAX_REFERENCES} reference images reached` : "Add reference images"}
          aria-describedby={`${helperId} ${statusId}`}
          title={isFull ? `Maximum ${MAX_REFERENCES} reference images` : "Add reference images"}
          className={cn(
            "flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border-2 border-dashed transition-colors",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
            isFull
              ? "cursor-not-allowed opacity-40"
              : "border-muted-foreground/30 hover:border-primary/60 hover:bg-accent/50",
          )}
        >
          <Plus className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
        </button>

        {references.map((reference, index) => (
          <div
            key={reference.id}
            className="group relative h-12 w-12 shrink-0 rounded-lg"
            title={reference.file.name}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={reference.previewUrl}
              alt={`Reference image ${index + 1}`}
              className="h-full w-full rounded-lg border object-cover"
              loading="lazy"
            />
            <button
              type="button"
              onClick={() => {
                onRemove(reference.id);
                setNotice(`Reference image ${index + 1} removed.`);
              }}
              aria-label={`Remove reference image ${index + 1}`}
              title={`Remove reference ${index + 1}`}
              className={cn(
                "absolute -right-1 -top-1 flex h-6 w-6 items-center justify-center rounded-full",
                "bg-destructive text-destructive-foreground shadow transition-opacity",
                "opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100",
                "focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
              )}
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>
        ))}
      </div>

      <p id={helperId} className="text-xs leading-relaxed text-muted-foreground">
        Use up to {MAX_REFERENCES} images to guide visual style. References are sent alongside your
        source image; they do not replace it.
      </p>
      <p id={statusId} role="status" aria-live="polite" aria-atomic="true" className="min-h-4 text-xs text-muted-foreground">
        {notice}
      </p>

      <input
        ref={inputRef}
        type="file"
        multiple
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        aria-label="Choose reference images"
        onChange={(event) => handleFiles(event.target.files)}
      />
    </section>
  );
}







