"use client";

// Asset card shared by Projects, Favorites, Uploads and Trash.
// Preview and selection are deliberately separate interactions.
import { useCallback, useState } from "react";
import Link from "next/link";
import {
  ArchiveRestore,
  Box,
  CheckCircle2,
  Circle,
  Download,
  Eye,
  Loader2,
  MoreHorizontal,
  Music,
  Play,
  Star,
  Trash2,
  WandSparkles,
} from "lucide-react";

import { AssetPreviewDialog, type PreviewAsset } from "@/components/projects/asset-preview-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { saveResult } from "@/lib/download";
import { cn } from "@/lib/utils";

export interface AssetSummary {
  id: string;
  type: "image" | "video" | "audio" | "3d_model";
  url: string;
  isFavorite: boolean;
}

interface AssetCardProps {
  asset: AssetSummary;
  /** Trash mode: offers restore and permanent delete. */
  trashed?: boolean;
  /** Parent refetch callback after a successful action. */
  onChanged: () => void;
  /** Optional callback for permanent deletion in Trash. */
  onDelete?: (assetId: string) => void;
  layout?: "grid" | "list" | "square";
  /** Library selection stays separate from opening the preview. */
  selected?: boolean;
  onSelect?: () => void;
}

export const IMAGE_SERVICES = [
  ["Image Generator", "/app/image-generator"],
  ["Render", "/app/ai-image-generator"],
  ["Change Atmosphere", "/app/ambiance-change"],
  ["Exterior to Interior", "/app/exterior-to-interior"],
  ["Plan to Render", "/app/plan-to-render"],
  ["Multi-Angle", "/app/multi-angle"],
  ["Upscale", "/app/upscale"],
  ["Image Extender", "/app/image-extender"],
  ["Variations", "/app/variations"],
  ["Background Remover", "/app/background-remover"],
] as const;

export const VIDEO_SERVICES = [
  ["Video Generator", "/app/ai-video-generator"],
  ["Video Relight", "/app/ai-video-generator?mode=relight"],
  ["Video Speed", "/app/video-upscaler"],
  ["Clip Editor", "/app/clip-editor"],
  ["Video Project Editor", "/app/video-project-editor"],
] as const;

export function AssetCard({
  asset,
  trashed = false,
  onChanged,
  onDelete,
  layout = "grid",
  selected = false,
  onSelect,
}: AssetCardProps) {
  const [busy, setBusy] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [previewAsset, setPreviewAsset] = useState<PreviewAsset | null>(null);
  const closePreview = useCallback(() => setPreviewAsset(null), []);
  const openPreview = () => setPreviewAsset(asset);

  const patch = async (body: { isFavorite?: boolean; isTrashed?: boolean }) => {
    if (busy) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/assets/${encodeURIComponent(asset.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
    } catch {
      // Refetch so the UI always reflects the server state.
    } finally {
      setBusy(false);
      onChanged();
    }
  };

  const handleDownload = async () => {
    if (downloading) return;
    setDownloading(true);
    try {
      await saveResult(asset.url, asset.type);
    } finally {
      setDownloading(false);
    }
  };

  const handleDelete = async () => {
    if (!onDelete || busy) return;
    if (!window.confirm("Delete this asset permanently? This cannot be undone.")) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/assets/${encodeURIComponent(asset.id)}`, { method: "DELETE" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      onDelete(asset.id);
    } catch {
      onChanged();
    } finally {
      setBusy(false);
    }
  };

  const mediaLabel = asset.type === "3d_model" ? "3D model" : asset.type;

  return (
    <>
      <Card
        className={cn(
          "group min-w-0 overflow-hidden border-border/80 bg-card shadow-sm transition-[border-color,box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:border-border hover:shadow-md",
          selected && "border-primary ring-2 ring-primary/20",
          layout === "list" && "flex min-h-32 flex-row hover:translate-y-0",
        )}
      >
        <div className={cn("relative min-w-0 overflow-hidden bg-muted/40", layout === "list" ? "h-32 w-36 shrink-0 sm:w-52" : layout === "square" ? "aspect-square" : "aspect-[4/3]")}>
          {asset.type === "audio" ? (
            <div className="flex h-full min-h-32 w-full flex-col items-center justify-center gap-3 p-4">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl border bg-background text-muted-foreground"><Music className="h-5 w-5" /></span>
              <audio src={asset.url} controls className="w-full" aria-label="Audio asset preview" />
              {!trashed && (
                <Button type="button" size="sm" variant="outline" className="h-8 gap-1.5" onClick={openPreview}>
                  <Eye className="h-3.5 w-3.5" /> View details
                </Button>
              )}
            </div>
          ) : (
            <button
              type="button"
              onClick={openPreview}
              disabled={trashed}
              aria-label={`View ${mediaLabel} and details`}
              className={cn(
                "absolute inset-0 z-0 flex h-full w-full cursor-zoom-in items-center justify-center text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
                trashed && "cursor-default",
              )}
            >
              {asset.type === "video" ? (
                <>
                  <video src={asset.url} preload="metadata" muted playsInline className="h-full w-full object-cover" />
                  <span className="pointer-events-none absolute flex h-11 w-11 items-center justify-center rounded-full border border-white/25 bg-black/50 text-white shadow-lg backdrop-blur-sm">
                    <Play className="h-5 w-5 fill-current" />
                  </span>
                </>
              ) : asset.type === "3d_model" ? (
                <span className="flex flex-col items-center justify-center gap-2 text-muted-foreground">
                  <Box className="h-10 w-10" />
                  <span className="text-xs">3D model</span>
                </span>
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={asset.url} alt="" className="h-full w-full object-contain p-1.5 transition-transform duration-300 group-hover:scale-[1.02]" loading="lazy" />
              )}
              {!trashed && (
                <span className="pointer-events-none absolute inset-x-2 bottom-2 flex items-center justify-center gap-2 rounded-lg border border-white/15 bg-black/65 px-3 py-2 text-xs font-medium text-white opacity-100 shadow-sm backdrop-blur-md transition-opacity sm:opacity-0 group-hover:opacity-100 group-focus-within:opacity-100">
                  <Eye className="h-3.5 w-3.5" /> View image &amp; details
                </span>
              )}
            </button>
          )}

          <Badge variant="secondary" className="pointer-events-none absolute left-2.5 top-2.5 z-10 border border-background/50 bg-background/90 capitalize shadow-sm backdrop-blur-sm">
            {asset.type === "3d_model" ? "3D model" : asset.type}
          </Badge>

          {asset.isFavorite && !trashed && (
            <span className="pointer-events-none absolute bottom-2.5 left-2.5 z-10 flex h-7 w-7 items-center justify-center rounded-full border border-white/20 bg-black/55 text-white shadow-sm backdrop-blur-sm" aria-label="Favorited">
              <Star className="h-3.5 w-3.5 fill-current" />
            </span>
          )}

          {onSelect && !trashed && (
            <button
              type="button"
              aria-label={selected ? "Deselect asset" : "Select asset for a workflow"}
              aria-pressed={selected}
              onClick={(event) => { event.stopPropagation(); onSelect(); }}
              className={cn(
                "absolute right-2.5 top-2.5 z-20 flex h-8 w-8 items-center justify-center rounded-full border bg-background/95 text-foreground shadow-sm backdrop-blur-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                selected ? "border-primary text-primary" : "border-border hover:border-primary/50",
              )}
              title={selected ? "Deselect asset" : "Select asset"}
            >
              {selected ? <CheckCircle2 className="h-4 w-4" /> : <Circle className="h-4 w-4" />}
            </button>
          )}
        </div>

        <CardContent className={cn("flex min-w-0 flex-wrap items-center gap-1.5 p-2.5", layout === "list" && "flex-1 justify-end self-center sm:gap-2 sm:px-4")}>
          {trashed ? (
            <>
              <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => void patch({ isTrashed: false })} className="h-8 gap-1.5">
                <ArchiveRestore className="h-3.5 w-3.5" /> Restore
              </Button>
              {onDelete && (
                <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={() => void handleDelete()} className="h-8 gap-1.5 text-destructive hover:text-destructive">
                  <Trash2 className="h-3.5 w-3.5" /> Delete permanently
                </Button>
              )}
            </>
          ) : (
            <>
              <Button
                type="button"
                variant={asset.isFavorite ? "secondary" : "ghost"}
                size="sm"
                className="h-8 gap-1.5 px-2.5"
                disabled={busy}
                onClick={() => void patch({ isFavorite: !asset.isFavorite })}
                aria-label={asset.isFavorite ? "Remove from favorites" : "Add to favorites"}
                aria-pressed={asset.isFavorite}
                title={asset.isFavorite ? "Remove from favorites" : "Add to favorites"}
              >
                <Star className={cn("h-3.5 w-3.5", asset.isFavorite && "fill-current text-primary")} />
                <span className="hidden sm:inline">Favorite</span>
              </Button>

              {(asset.type === "image" || asset.type === "video") && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button type="button" size="sm" className="h-8 gap-1.5 px-2.5" disabled={busy}>
                      <WandSparkles className="h-3.5 w-3.5" /> Create
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="max-h-[min(60vh,420px)] overflow-y-auto">
                    {(asset.type === "video" ? VIDEO_SERVICES : IMAGE_SERVICES).map(([label, route]) => {
                      const separator = route.includes("?") ? "&" : "?";
                      return <DropdownMenuItem key={route} asChild><Link href={`${route}${separator}assetId=${encodeURIComponent(asset.id)}`}>{label}</Link></DropdownMenuItem>;
                    })}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}

              {asset.type !== "3d_model" && (
                <Button type="button" variant="outline" size="sm" className="ml-auto h-8 gap-1.5 px-2.5" disabled={busy || downloading} onClick={() => void handleDownload()} aria-label={`Download ${mediaLabel}`}>
                  {downloading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />} {downloading ? "Preparing…" : "Download"}
                </Button>
              )}

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0" disabled={busy} aria-label="More asset actions" title="More actions">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem className="text-destructive focus:text-destructive" onSelect={() => void patch({ isTrashed: true })}>
                    <Trash2 className="mr-2 h-4 w-4" /> Move to trash
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          )}
        </CardContent>
      </Card>

      <AssetPreviewDialog
        asset={previewAsset}
        onClose={closePreview}
        onChanged={onChanged}
        createServices={asset.type === "video" ? VIDEO_SERVICES : IMAGE_SERVICES}
      />
    </>
  );
}
