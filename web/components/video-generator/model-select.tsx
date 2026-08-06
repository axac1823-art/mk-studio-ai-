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
  supportsTextToVideo: boolean;
  supportsImageToVideo: boolean;
  supportsStartEndFrame: boolean;
  supportsMultiReference: boolean;
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
};

export function ModelSelect({ models, selectedModel, mode, onChange }: ModelSelectProps) {
  const flag = modeToFlag[mode];
  const compatible = models.filter((m) => Boolean(m[flag]));

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-sm font-medium">Model</span>
      <Select value={selectedModel} onValueChange={onChange} disabled={compatible.length === 0}>
        <SelectTrigger>
          <SelectValue placeholder={compatible.length === 0 ? "No models available" : "Auto"} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="">Auto</SelectItem>
          {compatible.map((model) => (
            <SelectItem key={model.key} value={model.key}>
              <div className="flex flex-col items-start">
                <span className="text-sm font-medium">{model.name}</span>
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
