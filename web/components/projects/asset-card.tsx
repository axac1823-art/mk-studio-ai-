"use client";

// Carte asset réutilisable (grilles Projects/Favorites/Uploads/Trash).
// Les actions PATCHent l'asset puis appellent onChanged : c'est la PAGE
// qui décide du refetch — la carte ne connaît ni la liste ni les filtres
// actifs, ce qui la rend réutilisable partout. En mode corbeille
// (trashed=true), l'action principale est Restore + Delete permanent.
import { useState } from "react";
import { ArchiveRestore, Play, Star, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export interface AssetSummary {
  id: string;
  type: "image" | "video";
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
}

export function AssetCard({ asset, trashed = false, onChanged, onDelete }: AssetCardProps) {
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
    <Card className="overflow-hidden">
      <div className="relative aspect-[4/3] bg-muted">
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
        ) : (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={asset.url} alt="" className="h-full w-full object-cover" loading="lazy" />
        )}
        <Badge variant="secondary" className="absolute left-2 top-2 capitalize">
          {asset.type}
        </Badge>
      </div>
      <CardContent className="flex items-center justify-end gap-1 p-2">
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
          </>
        )}
      </CardContent>
    </Card>
  );
}
