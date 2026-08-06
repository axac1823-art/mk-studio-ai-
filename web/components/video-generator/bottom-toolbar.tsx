"use client";

import { cn } from "@/lib/utils";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const DURATIONS = [4, 5, 6, 8, 10];
const ASPECT_RATIOS = ["16:9", "9:16", "1:1"];

interface BottomToolbarProps {
  duration: number;
  onDurationChange: (value: number) => void;
  aspectRatio: string;
  onAspectRatioChange: (value: string) => void;
  audioEnabled: boolean;
  onAudioEnabledChange: (value: boolean) => void;
  disabled?: boolean;
}

export function BottomToolbar({
  duration,
  onDurationChange,
  aspectRatio,
  onAspectRatioChange,
  audioEnabled,
  onAudioEnabledChange,
  disabled,
}: BottomToolbarProps) {
  return (
    <div className="flex flex-wrap items-end gap-4">
      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">Duration</span>
        <div className="flex overflow-hidden rounded-md border">
          {DURATIONS.map((d) => (
            <button
              key={d}
              type="button"
              aria-pressed={duration === d}
              disabled={disabled}
              onClick={() => onDurationChange(d)}
              className={cn(
                "px-3 py-1.5 text-xs font-medium transition-colors",
                duration === d
                  ? "bg-primary text-primary-foreground"
                  : "hover:bg-accent disabled:opacity-50"
              )}
            >
              {d}s
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">Aspect ratio</span>
        <Select value={aspectRatio} onValueChange={onAspectRatioChange} disabled={disabled}>
          <SelectTrigger className="w-28">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ASPECT_RATIOS.map((ratio) => (
              <SelectItem key={ratio} value={ratio}>
                {ratio}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center gap-2 pb-1.5">
        <Switch
          id="audio-toggle"
          checked={audioEnabled}
          onCheckedChange={onAudioEnabledChange}
          disabled={disabled}
        />
        <label htmlFor="audio-toggle" className="text-sm font-medium">
          Audio {audioEnabled ? "ON" : "OFF"}
        </label>
      </div>
    </div>
  );
}
