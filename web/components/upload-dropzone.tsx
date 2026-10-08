"use client";

import { useCallback, useRef, useState } from "react";
import { ImagePlus, Info, RefreshCw } from "lucide-react";

import { cn } from "@/lib/utils";

interface UploadDropzoneProps {
  previewUrl: string | null;
  onFileSelected: (file: File) => void;
  title?: string;
  description?: string;
  icon?: React.ComponentType<{ className?: string }>;
  showHint?: boolean;
  accept?: string;
  ariaLabel?: string;
  previewAlt?: string;
}

export function UploadDropzone({
  previewUrl,
  onFileSelected,
  title = "Drop your 3D screenshot here",
  description = "or click to browse — PNG, JPEG, WebP up to 10 MB",
  icon: Icon = ImagePlus,
  showHint = false,
  accept = "image/png,image/jpeg,image/webp",
  ariaLabel = "Upload an image",
  previewAlt = "Uploaded image",
}: UploadDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleFiles = useCallback(
    (files: FileList | null) => {
      const file = files?.[0];
      if (file) onFileSelected(file);
    },
    [onFileSelected],
  );

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={ariaLabel}
      onClick={() => inputRef.current?.click()}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          inputRef.current?.click();
        }
      }}
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setIsDragging(false);
        handleFiles(e.dataTransfer.files);
      }}
      className={cn(
        "flex aspect-[4/3] w-full cursor-pointer items-center justify-center overflow-hidden rounded-lg border-2 border-dashed transition-colors",
        isDragging
          ? "border-primary bg-accent"
          : "border-muted-foreground/30 hover:border-primary/60 hover:bg-accent/50",
      )}
    >
      {previewUrl ? (
        <div className="relative h-full w-full">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={previewUrl} alt={previewAlt} className="h-full w-full object-contain" />
          <span className="absolute bottom-2 right-2 inline-flex items-center gap-1 rounded bg-black/60 px-2 py-1 text-xs text-white">
            <RefreshCw className="h-3 w-3" /> Replace
          </span>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-2 p-6 text-center">
          {Icon ? <Icon className="h-8 w-8 text-muted-foreground" /> : null}
          <p className="text-sm font-medium">{title}</p>
          {description ? <p className="text-xs text-muted-foreground">{description}</p> : null}
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />

      {showHint && !previewUrl && (
        <div className="absolute bottom-2 left-2 right-2 flex items-start gap-2 rounded-md border bg-background/90 p-2 text-xs text-muted-foreground backdrop-blur">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <div className="flex flex-col gap-0.5">
            <span className="font-medium text-foreground">More about this input</span>
            <span>Use a clear source image with the geometry visible.</span>
          </div>
        </div>
      )}
    </div>
  );
}
