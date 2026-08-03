"use client";

// Panneau Animate — flux simple type Higgsfield : image (+ image de fin
// optionnelle), champ texte libre pour décrire le mouvement, choix du
// modèle vidéo, durée et ratio. Pas de presets de caméra.
import { Loader2, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { UploadDropzone } from "@/components/upload-dropzone";
import { ASPECT_RATIOS, DURATIONS } from "@/lib/presets";
import type { AspectRatio } from "@/lib/ai/types";
import { cn } from "@/lib/utils";

export interface AnimateSource {
  kind: "history" | "upload";
  /** URL d'aperçu (object URL local ou URL de rendu précédent). */
  previewUrl: string | null;
}

export interface VideoModelOption {
  key: string;
  name: string;
  description: string;
}

interface AnimatePanelProps {
  source: AnimateSource;
  endSource: AnimateSource;
  hasHistoryImages: boolean;
  models: VideoModelOption[];
  selectedModel: string;
  onModelChange: (value: string) => void;
  onPickFromHistory: () => void;
  onPickEndFromHistory: () => void;
  onFileSelected: (file: File) => void;
  onEndFileSelected: (file: File) => void;
  motionPrompt: string;
  onMotionPromptChange: (value: string) => void;
  durationSeconds: 4 | 8;
  onDurationChange: (value: 4 | 8) => void;
  aspectRatio: AspectRatio;
  onAspectRatioChange: (value: AspectRatio) => void;
  sceneDetails: string;
  onSceneDetailsChange: (value: string) => void;
  cost: number;
  balance: number | null;
  isBusy: boolean;
  onGenerate: () => void;
}

export function AnimatePanel({
  source,
  endSource,
  hasHistoryImages,
  models,
  selectedModel,
  onModelChange,
  onPickFromHistory,
  onPickEndFromHistory,
  onFileSelected,
  onEndFileSelected,
  motionPrompt,
  onMotionPromptChange,
  durationSeconds,
  onDurationChange,
  aspectRatio,
  onAspectRatioChange,
  sceneDetails,
  onSceneDetailsChange,
  cost,
  balance,
  isBusy,
  onGenerate,
}: AnimatePanelProps) {
  const hasEnoughCredits = balance === null || balance >= cost;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Start frame</span>
          {hasHistoryImages && (
            <Button type="button" variant="outline" size="sm" onClick={onPickFromHistory}>
              Use latest render
            </Button>
          )}
        </div>
        <UploadDropzone previewUrl={source.previewUrl} onFileSelected={onFileSelected} />
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">
            End frame <span className="font-normal text-muted-foreground">(optional)</span>
          </span>
          {hasHistoryImages && (
            <Button type="button" variant="outline" size="sm" onClick={onPickEndFromHistory}>
              Use latest render
            </Button>
          )}
        </div>
        <UploadDropzone previewUrl={endSource.previewUrl} onFileSelected={onEndFileSelected} />
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="animate-motion" className="text-sm font-medium">
          Describe the motion or action <span className="font-normal text-muted-foreground">(optional)</span>
        </label>
        <Textarea
          id="animate-motion"
          value={motionPrompt}
          onChange={(e) => onMotionPromptChange(e.target.value)}
          placeholder="e.g. slow push-in towards the facade, gentle orbit around the building…"
          rows={2}
        />
        <p className="text-xs text-muted-foreground">Leave empty for a default smooth cinematic motion.</p>
      </div>

      <div className="flex flex-col gap-1">
        <span className="text-sm font-medium">Duration</span>
        <div className="flex overflow-hidden rounded-md border">
          {DURATIONS.map((duration) => (
            <button
              key={duration}
              type="button"
              aria-pressed={durationSeconds === duration}
              onClick={() => onDurationChange(duration)}
              className={cn(
                "flex-1 px-3 py-1.5 text-xs font-medium transition-colors",
                durationSeconds === duration ? "bg-primary text-primary-foreground" : "hover:bg-accent"
              )}
            >
              {duration}s
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">Aspect ratio</span>
        <Select value={aspectRatio} onValueChange={(value) => onAspectRatioChange(value as AspectRatio)}>
          <SelectTrigger>
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

      <div className="flex flex-col gap-2">
        <label htmlFor="animate-scene" className="text-sm font-medium">
          Scene details <span className="font-normal text-muted-foreground">(optional)</span>
        </label>
        <Textarea
          id="animate-scene"
          value={sceneDetails}
          onChange={(e) => onSceneDetailsChange(e.target.value)}
          placeholder="The more details, the better the result…"
          rows={2}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">Video model</span>
        <Select value={selectedModel} onValueChange={onModelChange} disabled={models.length === 0}>
          <SelectTrigger>
            <SelectValue placeholder={models.length === 0 ? "No video models configured" : "Default (auto fallback)"} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">Default (auto fallback)</SelectItem>
            {models.length === 0 && (
              <SelectItem value="__empty__" disabled>
                Start the worker and configure at least one video provider
              </SelectItem>
            )}
            {models.map((model) => (
              <SelectItem key={model.key} value={model.key}>
                <div className="flex flex-col items-start">
                  <span className="text-sm font-medium">{model.name}</span>
                  <span className="text-xs text-muted-foreground">{model.description}</span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {models.length === 0 && (
          <p className="text-[11px] text-muted-foreground">No video provider configured on the worker.</p>
        )}
      </div>

      <div className="flex flex-col gap-1">
        {!hasEnoughCredits && balance !== null && (
          <p role="alert" className="text-xs text-destructive">
            You don&apos;t have enough credits for this generation. {cost} credits required. You have{" "}
            {balance} credits.{" "}
            <a href="/app/billing" className="font-medium underline">
              Buy more credits
            </a>
          </p>
        )}
        <Button
          onClick={onGenerate}
          disabled={!source.previewUrl || isBusy || !hasEnoughCredits}
          className="w-full"
        >
          {isBusy ? (
            <>
              <Loader2 className="animate-spin" />
              Generating video…
            </>
          ) : (
            <>
              <Sparkles />
              Generate Video — {cost} credits
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
