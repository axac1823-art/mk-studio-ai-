"use client";

// Carte asset réutilisable (grilles Projects/Favorites/Uploads/Trash).
// Les actions PATCHent l'asset puis appellent onChanged : c'est la PAGE
// qui décide du refetch — la carte ne connaît ni la liste ni les filtres
// actifs, ce qui la rend réutilisable partout. En mode corbeille
// (trashed=true), l'action principale est Restore + Delete permanent.
import { useState } from "react";
import Link from "next/link";
import { ArchiveRestore, Box, Download, Music, Play, Star, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { saveResult } from "@/lib/download";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export interface AssetSummary {
  id: string;
  type: "image" | "video" | "audio" | "3d_model";
  url: string;
  isFavorite: boolean;
}

interface AssetCardProps {
  asset: AssetSummary;
  /** Mode corbeille : affiche Restore + Delete permanent. */
  trashed?: boolean;
  /** Callback après une action réussie — la page refetch sa liste. */
  onChanged: () => void;
  /** Callback pour suppression définitive (optionnel ; si absent, pas de bouton Delete). */
  onDelete?: (assetId: string) => void;
  layout?: "grid" | "list";
}

const IMAGE_SERVICES = [
  ["Image Generator", "/app/image-generator"],
  ["Render", "/app/ai-image-generator"],
  ["Mood", "/app/ambiance-change"],
  ["Exterior to Interior", "/app/exterior-to-interior"],
  ["Plan to Render", "/app/plan-to-render"],
  ["Multi-Angle", "/app/multi-angle"],
  ["Upscale", "/app/upscale"],
  ["Extend", "/app/image-extender"],
  ["Variations", "/app/variations"],
  ["Background Remover", "/app/background-remover"],
] as const;

const VIDEO_SERVICES = [
  ["Video Generator", "/app/ai-video-generator"],
  ["Video Relight", "/app/ai-video-generator?mode=relight"],
  ["Video Speed", "/app/video-upscaler"],
  ["Clip Editor", "/app/clip-editor"],
  ["Video Project Editor", "/app/video-project-editor"],
] as const;

export function AssetCard({ asset, trashed = false, onChanged, onDelete, layout = "grid" }: AssetCardProps) {
  const [busy, setBusy] = useState(false);

  // Pas de logique métier ici : simple bascule de flag côté API, puis
  // notification à la page (qui refetch et fait disparaître la carte si
  // elle sort du filtre courant — ex. défavoriser dans /app/favorites).
  const patch = async (body: { isFavorite?: boolean; isTrashed?: boolean }) => {
    if (busy) return;
    setBusy(true);
    try {
      await fetch(`/api/assets/${asset.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    } finally {
      setBusy(false);
      onChanged();
    }
  };

  const handleDelete = async () => {
    if (!onDelete) return;
    if (!window.confirm("Delete this asset permanently? This cannot be undone.")) return;
    setBusy(true);
    try {
      await fetch(`/api/assets/${asset.id}`, { method: "DELETE" });
      onDelete(asset.id);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className={cn("overflow-hidden", layout === "list" && "flex min-h-32 flex-row")}>
      <div className={cn("relative bg-muted", layout === "list" ? "w-40 shrink-0 sm:w-56" : "aspect-[4/3]")}>
        {asset.type === "video" ? (
          <>
            {/* Pas d'autoplay : simple aperçu muet, overlay Play indicatif. */}
            <video src={asset.url} preload="metadata" muted className="h-full w-full object-cover" />
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <span className="rounded-full bg-background/70 p-2">
                <Play className="h-5 w-5 fill-current" />
              </span>
            </div>
          </>
        ) : asset.type === "audio" ? (
          <div className="flex h-full w-full flex-col items-center justify-center gap-2">
            <Music className="h-10 w-10 text-muted-foreground" />
            <audio src={asset.url} controls className="w-[90%]" />
          </div>
        ) : asset.type === "3d_model" ? (
          <div className="flex h-full w-full flex-col items-center justify-center gap-2">
            <Box className="h-10 w-10 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">3D model</span>
          </div>
        ) : (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={asset.url} alt="" className="h-full w-full object-cover" loading="lazy" />
        )}
        <Badge variant="secondary" className="absolute left-2 top-2 capitalize">
          {asset.type === "3d_model" ? "3D" : asset.type}
        </Badge>
      </div>
      {layout === "list" && (
        <div className="flex min-w-0 flex-1 flex-col justify-center gap-1 px-4">
          <p className="truncate text-sm font-medium capitalize">{asset.type === "3d_model" ? "3D model" : asset.type}</p>
          <p className="truncate text-xs text-muted-foreground">Project item · {asset.id.slice(0, 8)}</p>
        </div>
      )}
      <CardContent className={cn("flex flex-wrap items-center justify-end gap-1 p-2", layout === "list" && "flex-1 self-center")}>
        {trashed ? (
          <>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={busy}
              onClick={() => void patch({ isTrashed: false })}
              className="gap-2"
              aria-label="Restore"
            >
              <ArchiveRestore className="h-4 w-4" />
              Restore
            </Button>
            {onDelete && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={busy}
                onClick={() => void handleDelete()}
                className="gap-2 text-destructive hover:text-destructive"
                aria-label="Delete permanently"
              >
                <Trash2 className="h-4 w-4" />
                Delete
              </Button>
            )}
          </>
        ) : (
          <>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              disabled={busy}
              onClick={() => void saveResult(asset.url, asset.type)}
              aria-label="Download"
            >
              <Download className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              disabled={busy}
              onClick={() => void patch({ isFavorite: !asset.isFavorite })}
              aria-label={asset.isFavorite ? "Remove from favorites" : "Add to favorites"}
            >
              <Star className={cn("h-4 w-4", asset.isFavorite && "fill-current text-yellow-500")} />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              disabled={busy}
              onClick={() => void patch({ isTrashed: true })}
              aria-label="Move to trash"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
            {(asset.type === "image" || asset.type === "video") && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button type="button" variant="outline" size="sm" disabled={busy} className="whitespace-nowrap">
                    Create with
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {(asset.type === "image" ? IMAGE_SERVICES : VIDEO_SERVICES).map(([label, route]) => {
                    const separator = route.includes("?") ? "&" : "?";
                    return (
                      <DropdownMenuItem key={route} asChild>
                        <Link href={`${route}${separator}assetId=${encodeURIComponent(asset.id)}`}>{label}</Link>
                      </DropdownMenuItem>
                    );
                  })}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
