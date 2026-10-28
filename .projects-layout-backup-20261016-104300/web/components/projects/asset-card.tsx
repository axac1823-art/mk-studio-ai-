"use client";

// Shared asset card for Projects, Favorites, Uploads and Trash.
//
// Design: borderless, image-first gallery card inspired by professional
// creative asset libraries. At rest there is NO outer frame, border, or
// shadow — the media thumbnail IS the card. Overlays and actions appear
// on hover/focus; on touch devices the More menu is always reachable.
//
// Keep preview, selection and asset actions as separate interactions.
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

import {
  AssetPreviewDialog,
  type PreviewAsset,
} from "@/components/projects/asset-preview-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
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
  /** Trash mode exposes restore and, when available, permanent deletion. */
  trashed?: boolean;
  /** Called after an action so the parent can refresh its current collection. */
  onChanged: () => void;
  /** Optional callback for permanent deletion from Trash. */
  onDelete?: (assetId: string) => void;
  layout?: "grid" | "list" | "square";
  /** Selection is independent from opening the media preview. */
  selected?: boolean;
  selectionActive?: boolean;
  onSelect?: () => void;
  /** Compatibility with bulk-selection screens already using the shared card. */
  onToggleSelected?: (assetId: string, shiftKey: boolean) => void;
  /** Optional owner-controlled preview callback; otherwise the built-in dialog is used. */
  onPreview?: () => void;
}

// Keep these routes aligned with the services that already exist in the app.
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

function getMediaLabel(type: AssetSummary["type"]) {
  switch (type) {
    case "3d_model":
      return "3D model";
    case "image":
      return "Image";
    case "video":
      return "Video";
    case "audio":
      return "Audio";
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AssetCard({
  asset,
  trashed = false,
  onChanged,
  onDelete,
  layout = "grid",
  selected = false,
  selectionActive = false,
  onSelect,
  onToggleSelected,
  onPreview,
}: AssetCardProps) {
  const [busy, setBusy] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [previewAsset, setPreviewAsset] = useState<PreviewAsset | null>(null);

  const closePreview = useCallback(() => setPreviewAsset(null), []);
  const openPreview = useCallback(() => {
    if (trashed) return;
    if (onPreview) {
      onPreview();
      return;
    }
    setPreviewAsset(asset);
  }, [asset, onPreview, trashed]);

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
      // Refresh either way: the server remains the source of truth for asset state.
    } finally {
      setBusy(false);
      onChanged();
    }
  };

  const handleDownload = async () => {
    if (downloading || busy || asset.type === "3d_model") return;

    setDownloading(true);
    try {
      await saveResult(asset.url, asset.type);
    } catch {
      // Keep a download failure from breaking the rest of the library UI.
    } finally {
      setDownloading(false);
    }
  };

  const handleDelete = async () => {
    if (!onDelete || busy) return;
    if (!window.confirm("Delete this asset permanently? This cannot be undone.")) return;

    setBusy(true);
    try {
      const response = await fetch(`/api/assets/${encodeURIComponent(asset.id)}`, {
        method: "DELETE",
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      onDelete(asset.id);
    } catch {
      onChanged();
    } finally {
      setBusy(false);
    }
  };

  const mediaLabel = getMediaLabel(asset.type);
  const isList = layout === "list";
  const isSquare = layout === "square";
  const services = asset.type === "video" ? VIDEO_SERVICES : IMAGE_SERVICES;

  // -------------------------------------------------------------------------
  // List layout — clean horizontal row, subtle bottom separator, no card box
  // -------------------------------------------------------------------------
  if (isList) {
    return (
      <>
        <div
          className={cn(
            "group/asset relative flex min-h-[72px] items-center gap-4 border-b border-border/40 px-1 py-2 transition-colors duration-150 hover:bg-muted/30 sm:gap-5 sm:px-2",
            selected && "bg-primary/5",
          )}
        >
          {/* Selection checkbox */}
          {(onSelect || onToggleSelected) && !trashed && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={selected ? "Deselect asset" : "Select asset"}
              aria-pressed={selected}
              onClick={(event) => {
                event.stopPropagation();
                if (onToggleSelected) {
                  onToggleSelected(asset.id, event.shiftKey);
                } else {
                  onSelect?.();
                }
              }}
              className={cn(
                "h-7 w-7 shrink-0 rounded-full transition-all focus-visible:ring-2 focus-visible:ring-ring",
                selected
                  ? "bg-primary text-primary-foreground hover:bg-primary/90"
                  : "text-muted-foreground hover:text-foreground md:opacity-0 md:group-hover/asset:opacity-100 md:group-focus-within/asset:opacity-100",
              )}
              title={selected ? "Deselect asset" : "Select asset"}
            >
              {selected ? (
                <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
              ) : (
                <Circle className="h-4 w-4" aria-hidden="true" />
              )}
            </Button>
          )}

          {/* Thumbnail */}
          <button
            type="button"
            onClick={openPreview}
            disabled={trashed}
            aria-label={`Preview ${mediaLabel.toLowerCase()}`}
            className={cn(
              "relative h-14 w-20 shrink-0 overflow-hidden rounded-lg bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:h-16 sm:w-24",
              !trashed && "cursor-zoom-in",
              trashed && "cursor-default opacity-60",
            )}
          >
            {asset.type === "audio" ? (
              <span className="flex h-full w-full items-center justify-center text-muted-foreground">
                <Music className="h-5 w-5" aria-hidden="true" />
              </span>
            ) : asset.type === "video" ? (
              <>
                <video
                  src={asset.url}
                  preload="metadata"
                  muted
                  playsInline
                  className="h-full w-full object-cover"
                />
                <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-sm">
                    <Play className="ml-0.5 h-3 w-3 fill-current" aria-hidden="true" />
                  </span>
                </span>
              </>
            ) : asset.type === "3d_model" ? (
              <span className="flex h-full w-full items-center justify-center text-muted-foreground">
                <Box className="h-5 w-5" aria-hidden="true" />
              </span>
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={asset.url}
                alt=""
                loading="lazy"
                decoding="async"
                className="h-full w-full object-cover"
              />
            )}
          </button>

          {/* Meta */}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-foreground">
              {mediaLabel}
            </p>
            <p className="mt-0.5 truncate text-xs text-muted-foreground">
              {asset.id.slice(0, 8)}
            </p>
          </div>

          {/* Favorite indicator */}
          {asset.isFavorite && !trashed && (
            <Star
              className="h-3.5 w-3.5 shrink-0 fill-current text-primary"
              aria-label="Favorited"
            />
          )}

          {/* Actions */}
          {trashed ? (
            <div className="flex shrink-0 items-center gap-1.5">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={busy}
                onClick={() => void patch({ isTrashed: false })}
                className="h-8 gap-1.5 rounded-lg px-3"
              >
                {busy ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                ) : (
                  <ArchiveRestore className="h-3.5 w-3.5" aria-hidden="true" />
                )}
                Restore
              </Button>
              {onDelete && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={busy}
                  onClick={() => void handleDelete()}
                  className="h-8 gap-1.5 rounded-lg px-2.5 text-destructive hover:bg-destructive/10 hover:text-destructive"
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                  <span className="hidden sm:inline">Delete permanently</span>
                  <span className="sm:hidden">Delete</span>
                </Button>
              )}
            </div>
          ) : (
            <div className="flex shrink-0 items-center gap-1">
              {/* Favorite toggle */}
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0 rounded-lg"
                disabled={busy}
                onClick={() => void patch({ isFavorite: !asset.isFavorite })}
                aria-label={asset.isFavorite ? "Remove from favorites" : "Add to favorites"}
                aria-pressed={asset.isFavorite}
                title={asset.isFavorite ? "Remove from favorites" : "Add to favorites"}
              >
                {busy ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                ) : (
                  <Star className={cn("h-3.5 w-3.5", asset.isFavorite && "fill-current text-primary")} aria-hidden="true" />
                )}
              </Button>

              {/* Create menu */}
              {(asset.type === "image" || asset.type === "video") && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      className="h-8 min-w-0 gap-1.5 rounded-lg px-2.5 text-xs font-medium sm:px-3"
                      disabled={busy}
                    >
                      <WandSparkles className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                      <span>Create</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="max-h-[min(65vh,420px)] w-56 overflow-y-auto rounded-xl p-1.5">
                    <DropdownMenuLabel className="px-2 py-1.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                      Create from this {asset.type}
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {services.map(([label, route]) => {
                      const separator = route.includes("?") ? "&" : "?";
                      const href = `${route}${separator}assetId=${encodeURIComponent(asset.id)}`;
                      return (
                        <DropdownMenuItem key={route} asChild className="cursor-pointer rounded-lg py-2">
                          <Link href={href}>{label}</Link>
                        </DropdownMenuItem>
                      );
                    })}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}

              {/* Download */}
              {asset.type !== "3d_model" && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0 rounded-lg"
                  disabled={busy || downloading}
                  onClick={() => void handleDownload()}
                  aria-label={`Download ${mediaLabel.toLowerCase()}`}
                  title={downloading ? "Preparing download" : "Download"}
                >
                  {downloading ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                  ) : (
                    <Download className="h-3.5 w-3.5" aria-hidden="true" />
                  )}
                </Button>
              )}

              {/* More */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0 rounded-lg"
                    disabled={busy}
                    aria-label="More asset actions"
                    title="More actions"
                  >
                    <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48 rounded-xl p-1.5">
                  <DropdownMenuItem
                    className="cursor-pointer rounded-lg py-2 text-destructive focus:bg-destructive/10 focus:text-destructive"
                    disabled={busy}
                    onSelect={() => void patch({ isTrashed: true })}
                  >
                    <Trash2 className="mr-2 h-4 w-4" aria-hidden="true" />
                    Move to trash
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}
        </div>

        <AssetPreviewDialog
          asset={previewAsset}
          onClose={closePreview}
          onChanged={onChanged}
          createServices={asset.type === "video" ? VIDEO_SERVICES : IMAGE_SERVICES}
        />
      </>
    );
  }

  // -------------------------------------------------------------------------
  // Grid / Square layout — borderless, image-first thumbnail
  // -------------------------------------------------------------------------
  return (
    <>
      <div
        className={cn(
          "group/asset relative min-w-0 overflow-hidden rounded-xl transition-[box-shadow] duration-150",
          // No border, no bg, no shadow at rest.
          // Selected state: restrained accent ring.
          selected && "ring-2 ring-primary/60 ring-offset-2 ring-offset-background",
          // Focus-within for keyboard navigation (when overlay buttons get focus).
          "focus-within:ring-2 focus-within:ring-ring/50 focus-within:ring-offset-1 focus-within:ring-offset-background",
          // Override: don't double-ring when selected.
          selected && "focus-within:ring-primary/60",
        )}
      >
        {/* Media surface */}
        <div
          className={cn(
            "relative isolate min-w-0 overflow-hidden rounded-xl bg-muted/30",
            isSquare ? "aspect-square" : "aspect-[4/3]",
          )}
        >
          {asset.type === "audio" ? (
            /* Audio: compact placeholder with inline player */
            <div className="flex h-full w-full flex-col items-center justify-center gap-3 p-4">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted/60 text-muted-foreground">
                <Music className="h-5 w-5" aria-hidden="true" />
              </span>
              <audio
                src={asset.url}
                controls
                preload="metadata"
                className="h-8 w-full max-w-[260px]"
                aria-label="Audio asset preview"
              />
              {!trashed && (
                <button
                  type="button"
                  onClick={openPreview}
                  className="mt-1 inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <Eye className="h-3 w-3" aria-hidden="true" />
                  Details
                </button>
              )}
            </div>
          ) : (
            /* Image / Video / 3D: clickable preview surface */
            <button
              type="button"
              onClick={openPreview}
              disabled={trashed}
              aria-label={`Preview ${mediaLabel.toLowerCase()}`}
              className={cn(
                "absolute inset-0 z-0 flex h-full w-full items-center justify-center overflow-hidden text-left focus-visible:outline-none",
                !trashed && "cursor-zoom-in",
                trashed && "cursor-default opacity-60",
              )}
            >
              {asset.type === "video" ? (
                <>
                  <video
                    src={asset.url}
                    preload="metadata"
                    muted
                    playsInline
                    className="h-full w-full object-contain"
                  />
                  {/* Persistent play indicator */}
                  <span className="pointer-events-none absolute left-1/2 top-1/2 flex h-10 w-10 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-black/50 text-white shadow-lg backdrop-blur-sm">
                    <Play className="ml-0.5 h-4 w-4 fill-current" aria-hidden="true" />
                  </span>
                </>
              ) : asset.type === "3d_model" ? (
                <span className="flex h-full w-full flex-col items-center justify-center gap-2 text-muted-foreground">
                  <Box className="h-8 w-8" aria-hidden="true" />
                  <span className="text-[11px] font-medium">3D model</span>
                </span>
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={asset.url}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  className="h-full w-full object-contain"
                />
              )}

              {/* Hover scrim — very subtle, just enough to read overlay icons */}
              {!trashed && (
                <span
                  className="pointer-events-none absolute inset-0 bg-black/0 transition-[background-color] duration-150 group-hover/asset:bg-black/10"
                  aria-hidden="true"
                />
              )}
            </button>
          )}

          {/* ---- Overlays (positioned inside the media container) ---- */}

          {/* Type label — small, quiet pill in top-left */}
          <span
            className="pointer-events-none absolute left-2 top-2 z-10 select-none rounded-md bg-black/50 px-1.5 py-0.5 text-[10px] font-semibold uppercase leading-tight tracking-wide text-white backdrop-blur-sm"
            aria-label={mediaLabel}
          >
            {mediaLabel}
          </span>

          {/* Selection toggle — separate hit target, never opens preview */}
          {(onSelect || onToggleSelected) && !trashed && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={selected ? "Deselect asset" : "Select asset"}
              aria-pressed={selected}
              onClick={(event) => {
                event.stopPropagation();
                if (onToggleSelected) {
                  onToggleSelected(asset.id, event.shiftKey);
                } else {
                  onSelect?.();
                }
              }}
              className={cn(
                "absolute right-2 top-2 z-20 h-7 w-7 rounded-full transition-all focus-visible:ring-2 focus-visible:ring-ring",
                selected || selectionActive
                  ? "bg-primary text-primary-foreground opacity-100 hover:bg-primary/90"
                  : "bg-black/40 text-white opacity-100 backdrop-blur-sm hover:bg-black/60 md:opacity-0 md:group-hover/asset:opacity-100 md:group-focus-within/asset:opacity-100",
              )}
              title={selected ? "Deselect asset" : "Select asset"}
            >
              {selected ? (
                <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
              ) : (
                <Circle className="h-3.5 w-3.5" aria-hidden="true" />
              )}
            </Button>
          )}

          {/* Favorite star — small, always visible when favorited */}
          {asset.isFavorite && !trashed && (
            <span
              className="pointer-events-none absolute bottom-2 left-2 z-10 flex h-6 w-6 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-sm"
              aria-label="Favorited"
            >
              <Star className="h-3 w-3 fill-current" aria-hidden="true" />
            </span>
          )}

          {/* Bottom action bar — revealed on hover/focus, always visible on touch */}
          {!trashed && asset.type !== "audio" && (
            <div
              className={cn(
                "absolute bottom-0 left-0 right-0 z-10 flex items-center justify-end gap-1 p-1.5",
                "bg-gradient-to-t from-black/40 to-transparent",
                "opacity-100 transition-opacity duration-150 md:opacity-0 md:group-hover/asset:opacity-100 md:group-focus-within/asset:opacity-100",
              )}
            >
              {/* Favorite toggle */}
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7 rounded-full text-white hover:bg-white/20 hover:text-white"
                disabled={busy}
                onClick={(e) => {
                  e.stopPropagation();
                  void patch({ isFavorite: !asset.isFavorite });
                }}
                aria-label={asset.isFavorite ? "Remove from favorites" : "Add to favorites"}
                aria-pressed={asset.isFavorite}
                title={asset.isFavorite ? "Remove from favorites" : "Add to favorites"}
              >
                {busy ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                ) : (
                  <Star className={cn("h-3.5 w-3.5", asset.isFavorite && "fill-current")} aria-hidden="true" />
                )}
              </Button>

              {/* Download */}
              {asset.type !== "3d_model" && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 rounded-full text-white hover:bg-white/20 hover:text-white"
                  disabled={busy || downloading}
                  onClick={(e) => {
                    e.stopPropagation();
                    void handleDownload();
                  }}
                  aria-label={`Download ${mediaLabel.toLowerCase()}`}
                  title={downloading ? "Preparing download" : "Download"}
                >
                  {downloading ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                  ) : (
                    <Download className="h-3.5 w-3.5" aria-hidden="true" />
                  )}
                </Button>
              )}

              {/* More menu (Create + Trash) */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 rounded-full text-white hover:bg-white/20 hover:text-white"
                    disabled={busy}
                    aria-label="More asset actions"
                    title="More actions"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="max-h-[min(65vh,420px)] w-52 overflow-y-auto rounded-xl p-1.5">
                  {/* Create sub-section */}
                  {(asset.type === "image" || asset.type === "video") && (
                    <>
                      <DropdownMenuLabel className="px-2 py-1.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                        <span className="flex items-center gap-1.5">
                          <WandSparkles className="h-3 w-3" aria-hidden="true" />
                          Create from this {asset.type}
                        </span>
                      </DropdownMenuLabel>
                      {services.map(([label, route]) => {
                        const separator = route.includes("?") ? "&" : "?";
                        const href = `${route}${separator}assetId=${encodeURIComponent(asset.id)}`;
                        return (
                          <DropdownMenuItem key={route} asChild className="cursor-pointer rounded-lg py-1.5">
                            <Link href={href}>{label}</Link>
                          </DropdownMenuItem>
                        );
                      })}
                      <DropdownMenuSeparator />
                    </>
                  )}
                  <DropdownMenuItem
                    className="cursor-pointer rounded-lg py-2 text-destructive focus:bg-destructive/10 focus:text-destructive"
                    disabled={busy}
                    onSelect={() => void patch({ isTrashed: true })}
                  >
                    <Trash2 className="mr-2 h-4 w-4" aria-hidden="true" />
                    Move to trash
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}

          {/* Trash mode actions — always visible */}
          {trashed && (
            <div className="absolute bottom-0 left-0 right-0 z-10 flex items-center gap-1.5 bg-gradient-to-t from-black/50 to-transparent p-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={busy}
                onClick={(e) => {
                  e.stopPropagation();
                  void patch({ isTrashed: false });
                }}
                className="h-7 gap-1 rounded-lg px-2 text-xs"
              >
                {busy ? (
                  <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
                ) : (
                  <ArchiveRestore className="h-3 w-3" aria-hidden="true" />
                )}
                Restore
              </Button>
              {onDelete && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={busy}
                  onClick={(e) => {
                    e.stopPropagation();
                    void handleDelete();
                  }}
                  className="h-7 gap-1 rounded-lg px-2 text-xs text-white hover:bg-destructive/80 hover:text-white"
                >
                  <Trash2 className="h-3 w-3" aria-hidden="true" />
                  Delete
                </Button>
              )}
            </div>
          )}
        </div>
      </div>

      <AssetPreviewDialog
        asset={previewAsset}
        onClose={closePreview}
        onChanged={onChanged}
        createServices={asset.type === "video" ? VIDEO_SERVICES : IMAGE_SERVICES}
      />
    </>
  );
}
