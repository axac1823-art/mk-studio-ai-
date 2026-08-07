"use client";

import { ImagePlus } from "lucide-react";
import { UploadDropzone } from "@/components/upload-dropzone";
import { cn } from "@/lib/utils";

interface FrameDropzoneProps {
  label: string;
  previewUrl: string | null;
  onFileSelected: (file: File) => void;
  className?: string;
  placeholderTitle?: string;
  placeholderDescription?: string;
}

export function FrameDropzone({
  label,
  previewUrl,
  onFileSelected,
  className,
  placeholderTitle,
  placeholderDescription,
}: FrameDropzoneProps) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <span className="text-sm font-medium">{label}</span>
      <UploadDropzone
        previewUrl={previewUrl}
        onFileSelected={onFileSelected}
        title={placeholderTitle ?? `Drop ${label.toLowerCase()} here`}
        description={placeholderDescription ?? "or click to browse"}
        icon={ImagePlus}
      />
    </div>
  );
}
