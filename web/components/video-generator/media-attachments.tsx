"use client";

import { useRef, useState } from "react";
import { Film, ImagePlus, Plus, X } from "lucide-react";

import { Button } from "@/components/ui/button";

export interface AttachedMediaItem {
  tag: string;
  url: string;
  file: File;
  type: "image" | "video";
}

interface MediaAttachmentsProps {
  media: AttachedMediaItem[];
  onAdd: (file: File, type: "image" | "video") => void;
  onRemove: (tag: string) => void;
  disabled?: boolean;
  max?: number;
}

export function MediaAttachments({ media, onAdd, onRemove, disabled, max = 9 }: MediaAttachmentsProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [pendingType, setPendingType] = useState<"image" | "video" | "all">("all");

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const type = pendingType === "video" || file.type.startsWith("video/") ? "video" : "image";
    onAdd(file, type);
    e.target.value = "";
  };

  const open = (type: "image" | "video" | "all") => {
    setPendingType(type);
    inputRef.current?.click();
  };

  const acceptMap = {
    image: "image/png,image/jpeg,image/webp",
    video: "video/mp4,video/webm,video/quicktime",
    all: "image/png,image/jpeg,image/webp,video/mp4,video/webm,video/quicktime",
  };

  const canAdd = media.length < max;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium">References</span>
        {media.map((item) => (
          <div
            key={item.tag}
            className="inline-flex items-center gap-1.5 rounded-md border bg-background px-2 py-1 text-xs"
          >
            {item.type === "image" ? (
              <ImagePlus className="h-3 w-3 text-muted-foreground" />
            ) : (
              <Film className="h-3 w-3 text-muted-foreground" />
            )}
            <span>{item.tag}</span>
            <button
              type="button"
              disabled={disabled}
              onClick={() => onRemove(item.tag)}
              className="ml-1 rounded-full hover:bg-accent"
              aria-label={`Remove ${item.tag}`}
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <Button type="button" variant="outline" size="sm" disabled={!canAdd || disabled} onClick={() => open("image")}>
          <ImagePlus className="mr-1 h-4 w-4" />
          Image
        </Button>
        <Button type="button" variant="outline" size="sm" disabled={!canAdd || disabled} onClick={() => open("video")}>
          <Film className="mr-1 h-4 w-4" />
          Video
        </Button>
        <Button type="button" variant="outline" size="sm" disabled={!canAdd || disabled} onClick={() => open("all")}>
          <Plus className="mr-1 h-4 w-4" />
          Add
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept={acceptMap[pendingType]}
          className="hidden"
          onChange={handleFileChange}
        />
      </div>
      <p className="text-xs text-muted-foreground">
        Up to {max} attached images or videos. Each gets an auto tag like @img1 or @vid1.
      </p>
    </div>
  );
}
