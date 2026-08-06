"use client";

import { UploadDropzone } from "@/components/upload-dropzone";
import { cn } from "@/lib/utils";

interface FrameDropzoneProps {
  label: string;
  previewUrl: string | null;
  onFileSelected: (file: File) => void;
  className?: string;
}

export function FrameDropzone({ label, previewUrl, onFileSelected, className }: FrameDropzoneProps) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <span className="text-sm font-medium">{label}</span>
      <div className="aspect-square">
        <UploadDropzone previewUrl={previewUrl} onFileSelected={onFileSelected} />
      </div>
    </div>
  );
}
