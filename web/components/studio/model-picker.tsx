"use client";

import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";

const AUTO_VALUE = "__auto__";

export interface ModelPickerOption {
  key: string;
  name: string;
  description: string;
  configured: boolean;
  capabilities?: string[];
}

interface ModelPickerProps {
  models: ModelPickerOption[];
  selectedModel: string;
  onModelChange: (value: string) => void;
  mode?: string;
  showDescription?: boolean;
  capabilityLabel?: string;
  disabled?: boolean;
}

export function ModelPicker({
  models,
  selectedModel,
  onModelChange,
  mode,
  showDescription = false,
  capabilityLabel,
  disabled = false,
}: ModelPickerProps) {
  const availableModels = mode
    ? models.filter((model) => model.capabilities?.includes(mode))
    : models;
  const currentModel = availableModels.find((model) => model.key === selectedModel);
  const value = currentModel ? currentModel.key : AUTO_VALUE;

  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <span className="text-sm font-medium">Model</span>
      <Select
        value={value}
        onValueChange={(nextValue) => onModelChange(nextValue === AUTO_VALUE ? "" : nextValue)}
        disabled={disabled}
      >
        <SelectTrigger aria-label="Model" className="h-10 w-full min-w-0">
          <span className="flex min-w-0 items-center gap-2">
            <span className="truncate text-sm">{currentModel?.name ?? "Auto"}</span>
            {!currentModel && (
              <Badge variant="secondary" className="shrink-0">Recommended</Badge>
            )}
          </span>
        </SelectTrigger>
        <SelectContent className="max-h-[min(70vh,420px)]">
          <SelectItem value={AUTO_VALUE}>
            <div className="flex min-w-0 flex-col items-start gap-1 py-0.5">
              <span className="flex items-center gap-2 text-sm font-medium">
                Auto <Badge variant="secondary">Recommended</Badge>
              </span>
              <span className="max-w-[320px] text-xs text-muted-foreground">
                Let Renderuim choose an available model for this task.
              </span>
            </div>
          </SelectItem>
          {availableModels.map((model) => {
            const capabilities = model.capabilities?.length
              ? model.capabilities
              : capabilityLabel
                ? [capabilityLabel]
                : [];
            return (
            <SelectItem key={model.key} value={model.key} disabled={!model.configured}>
              <div className="flex min-w-0 flex-col items-start gap-1 py-0.5">
                <span className="flex items-center gap-2 text-sm font-medium">
                  {model.name}
                  {!model.configured && (
                    <Badge variant="outline" className="text-muted-foreground">Not configured</Badge>
                  )}
                </span>
                <span className="max-w-[320px] truncate text-xs text-muted-foreground">
                  {model.description}
                </span>
                {capabilities.length > 0 && (
                  <span className="flex flex-wrap gap-1">
                    {capabilities.map((capability) => (
                      <Badge key={capability} variant="outline" className="font-normal">
                        {capability.replaceAll("_", " ")}
                      </Badge>
                    ))}
                  </span>
                )}
              </div>
            </SelectItem>
            );
          })}
          {mode && availableModels.length === 0 && (
            <SelectItem value="__no_compatible_models__" disabled>
              No configured model supports this mode.
            </SelectItem>
          )}
        </SelectContent>
      </Select>
      {showDescription && (
        <p className="text-xs leading-5 text-muted-foreground">
          {currentModel?.description ?? "Auto selects the best available model for this task."}
        </p>
      )}
    </div>
  );
}
