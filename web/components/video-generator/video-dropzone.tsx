"use client";

import { Film } from "lucide-react";
import { UploadDropzone } from "@/components/upload-dropzone";
import { cn } from "@/lib/utils";

interface VideoDropzoneProps {
  previewUrl: string | null;
  onFileSelected: (file: File) => void;
  label?: string;
  className?: string;
}

export function VideoDropzone({
  previewUrl,
  onFileSelected,
  label = "Source video",
  className,
}: VideoDropzoneProps) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <span className="text-sm font-medium">{label}</span>
      <UploadDropzone
        previewUrl={previewUrl}
        onFileSelected={onFileSelected}
        title={previewUrl ? "Source video" : "Drop your video here"}
        description="MP4, WebM, QuickTime — up to 50 MB"
        icon={Film}
        accept="video/mp4,video/webm,video/quicktime"
      />
    </div>
  );
}
