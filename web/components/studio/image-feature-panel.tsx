"use client";

// Panneau générique des fonctions image hors Print Render (Mood Shift,
// Exterior -> Interior, Plan to Render, Multi-Angle) : upload, presets
// dédiés éventuels, détails libres. Le bouton Generate vit dans la barre
// basse (GenerationControls), comme pour Print Render.
import { PresetGrid } from "@/components/studio/preset-grid";
import { SceneDetails } from "@/components/studio/scene-details";
import { UploadDropzone } from "@/components/upload-dropzone";
import type { PresetMeta } from "@/lib/presets";

interface ImageFeaturePanelProps {
  previewUrl: string | null;
  onFileSelected: (file: File) => void;
  /** L'upload est-il optionnel ? (text-to-image : l'image guide le style). */
  uploadOptional?: boolean;
  uploadLabel?: string;
  /** Presets de la fonction (ex. ambiances Mood) — omis si la fonction
   *  n'en a pas (Exterior -> Interior en V1). */
  options?: PresetMeta[];
  optionsLabel?: string;
  optionId?: string;
  onOptionChange?: (id: string) => void;
  sceneDetails: string;
  onSceneDetailsChange: (value: string) => void;
}

export function ImageFeaturePanel({
  previewUrl,
  onFileSelected,
  uploadOptional,
  uploadLabel,
  options,
  optionsLabel,
  optionId,
  onOptionChange,
  sceneDetails,
  onSceneDetailsChange,
}: ImageFeaturePanelProps) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">
          {uploadLabel ?? "Source image"}
          {uploadOptional && (
            <span className="ml-1 text-xs font-normal text-muted-foreground">(optional)</span>
          )}
        </span>
        <UploadDropzone previewUrl={previewUrl} onFileSelected={onFileSelected} />
      </div>
      {options && optionId !== undefined && onOptionChange && (
        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium">{optionsLabel ?? "Preset"}</span>
          <PresetGrid items={options} value={optionId} onChange={onOptionChange} />
        </div>
      )}
      <SceneDetails value={sceneDetails} onChange={onSceneDetailsChange} />
    </div>
  );
}
