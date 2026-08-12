"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { VideoMode } from "@/lib/video-utils";

export interface VideoModelOption {
  key: string;
  name: string;
  description: string;
  configured: boolean;
  supportsTextToVideo: boolean;
  supportsImageToVideo: boolean;
  supportsStartEndFrame: boolean;
  supportsMultiReference: boolean;
  supportsVideoToVideo: boolean;
  supportsRelight: boolean;
}

interface ModelSelectProps {
  models: VideoModelOption[];
  selectedModel: string;
  mode: VideoMode;
  onChange: (value: string) => void;
}

const modeToFlag: Record<VideoMode, keyof VideoModelOption> = {
  text_to_video: "supportsTextToVideo",
  image_to_video: "supportsImageToVideo",
  start_end_frame: "supportsStartEndFrame",
  multi_reference: "supportsMultiReference",
  multi_shot: "supportsImageToVideo",
  video_to_video: "supportsVideoToVideo",
  relight: "supportsRelight",
};

export function ModelSelect({ models, selectedModel, mode, onChange }: ModelSelectProps) {
  const flag = modeToFlag[mode];
  const compatible = models.filter((m) => Boolean(m[flag]));

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-sm font-medium">Model</span>
      <Select value={selectedModel} onValueChange={onChange} disabled={compatible.length === 0}>
        <SelectTrigger>
          <SelectValue placeholder={compatible.length === 0 ? "No models available" : "Choose a model"} />
        </SelectTrigger>
        <SelectContent>
          {compatible.map((model) => (
            <SelectItem key={model.key} value={model.key}>
              <div className="flex flex-col items-start">
                <span className="text-sm font-medium">
                  {model.name}
                  {!model.configured && (
                    <span className="ml-2 text-[10px] text-amber-500">(not configured)</span>
                  )}
                </span>
                <span className="text-xs text-muted-foreground">{model.description}</span>
              </div>
            </SelectItem>
          ))}
          {compatible.length === 0 && (
            <SelectItem value="__empty__" disabled>
              No model supports this input combination
            </SelectItem>
          )}
        </SelectContent>
      </Select>
    </div>
  );
}
