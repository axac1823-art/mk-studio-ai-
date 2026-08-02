"use client";

// Panneau de résultat : états de chargement (avec étape courante,
// libellés PRODUIT génériques), comparateur avant/après pour les images,
// lecteur vidéo pour Animate, et vignettes de variations si quantité > 1.
import { useState } from "react";
import { Download, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { CompareSlider } from "@/components/compare-slider";
import { saveResult } from "@/lib/download";
import { cn } from "@/lib/utils";

export type ResultState =
  | { status: "idle" }
  | { status: "busy"; stage?: string }
  | { status: "done"; kind: "image" | "video"; beforeUrl: string | null; outputUrls: string[] };

/** Traduction des étapes internes en libellés utilisateur — toujours
 *  génériques, jamais de nom de modèle/fournisseur. */
const STAGE_LABELS: Record<string, string> = {
  render: "Generating your render",
  upscaling: "Upscaling to your selected resolution",
  video: "Generating the video",
  narration: "Creating the narration",
  merging: "Assembling the final video",
};

interface ResultPanelProps {
  result: ResultState;
}

export function ResultPanel({ result }: ResultPanelProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  // Sortie actuellement affichée (variation sélectionnée pour les images) —
  // c'est elle que le bouton Download enregistre.
  const selectedUrl =
    result.status === "done"
      ? result.outputUrls[Math.min(selectedIndex, result.outputUrls.length - 1)]
      : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Result</CardTitle>
        <CardDescription>Drag the handle to compare with your original.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {result.status === "busy" && (
          <>
            <Skeleton className="aspect-[4/3] w-full" />
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              {STAGE_LABELS[result.stage ?? ""] ?? "Working on it"} — this can take a moment.
            </p>
          </>
        )}

        {result.status === "idle" && (
          <div className="flex aspect-[4/3] w-full items-center justify-center rounded-lg border bg-muted/40 p-6 text-center text-sm text-muted-foreground">
            Your result will appear here.
          </div>
        )}

        {result.status === "done" && result.kind === "video" && (
          <video
            key={result.outputUrls[0]}
            src={result.outputUrls[0]}
            controls
            className="aspect-video w-full rounded-lg border bg-black"
          />
        )}

        {result.status === "done" && result.kind === "image" && (
          <>
            {result.beforeUrl ? (
              <CompareSlider
                beforeSrc={result.beforeUrl}
                afterSrc={result.outputUrls[Math.min(selectedIndex, result.outputUrls.length - 1)]}
                afterLabel="Render"
              />
            ) : (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={result.outputUrls[Math.min(selectedIndex, result.outputUrls.length - 1)]}
                alt="Generated render"
                className="aspect-[4/3] w-full rounded-lg border object-contain"
              />
            )}
            {result.outputUrls.length > 1 && (
              <div className="flex flex-wrap gap-2">
                {result.outputUrls.map((url, index) => (
                  <button
                    key={url}
                    type="button"
                    aria-label={`Variation ${index + 1}`}
                    aria-pressed={index === selectedIndex}
                    onClick={() => setSelectedIndex(index)}
                    className={cn(
                      "h-14 w-14 overflow-hidden rounded-md border-2 transition-colors",
                      index === selectedIndex ? "border-primary" : "border-transparent hover:border-muted-foreground/40"
                    )}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={url} alt={`Variation ${index + 1}`} className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </>
        )}

        {result.status === "done" && selectedUrl && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="self-end"
            onClick={() => void saveResult(selectedUrl, result.kind)}
          >
            <Download className="mr-2 h-4 w-4" />
            Download
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
