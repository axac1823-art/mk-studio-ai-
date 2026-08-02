"use client";

// Panneau Animate — vidéo courte de présentation (mouvement de caméra
// simple sur un rendu existant, 4-8 s, SANS narration en V1, scope MVP).
// L'utilisateur ne voit qu'UN bouton "Generate Video" et UN coût : le
// routage entre modèles vidéo et le fallback sont 100% serveur.
import { Check, Loader2, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { UploadDropzone } from "@/components/upload-dropzone";
import { DURATIONS, MOTION_PRESETS } from "@/lib/presets";
import { cn } from "@/lib/utils";

export interface AnimateSource {
  kind: "history" | "upload";
  /** URL d'aperçu (object URL local ou URL de rendu précédent). */
  previewUrl: string | null;
}

interface AnimatePanelProps {
  source: AnimateSource;
  hasHistoryImages: boolean;
  onPickFromHistory: () => void;
  onFileSelected: (file: File) => void;
  motionId: string;
  onMotionChange: (id: string) => void;
  durationSeconds: 4 | 8;
  onDurationChange: (value: 4 | 8) => void;
  sceneDetails: string;
  onSceneDetailsChange: (value: string) => void;
  cost: number;
  balance: number | null;
  isBusy: boolean;
  onGenerate: () => void;
}

export function AnimatePanel({
  source,
  hasHistoryImages,
  onPickFromHistory,
  onFileSelected,
  motionId,
  onMotionChange,
  durationSeconds,
  onDurationChange,
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
          <span className="text-sm font-medium">Source image</span>
          {hasHistoryImages && (
            <Button type="button" variant="outline" size="sm" onClick={onPickFromHistory}>
              Use latest render
            </Button>
          )}
        </div>
        <UploadDropzone previewUrl={source.previewUrl} onFileSelected={onFileSelected} />
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium">Camera movement</span>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {MOTION_PRESETS.map((preset) => {
            const isActive = preset.id === motionId;
            return (
              <button
                key={preset.id}
                type="button"
                aria-pressed={isActive}
                onClick={() => onMotionChange(preset.id)}
                className={cn(
                  "relative rounded-lg border p-2.5 text-left transition-colors",
                  isActive ? "border-primary ring-1 ring-primary" : "hover:border-muted-foreground/40"
                )}
              >
                {isActive && (
                  <span className="absolute right-1.5 top-1.5 rounded-full bg-primary p-0.5 text-primary-foreground">
                    <Check className="h-3 w-3" />
                  </span>
                )}
                <span className="block text-xs font-semibold">{preset.label}</span>
                <span className="mt-0.5 block text-[11px] leading-tight text-muted-foreground">
                  {preset.description}
                </span>
              </button>
            );
          })}
        </div>
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
