"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Check,
  CheckSquare,
  Download,
  Loader2,
  Square,
  Star,
  Trash2,
  WandSparkles,
  X,
} from "lucide-react";

import type { AssetSummary } from "@/components/projects/asset-card";
import { IMAGE_SERVICES, VIDEO_SERVICES } from "@/components/projects/asset-card";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { saveResult } from "@/lib/download";
import { cn } from "@/lib/utils";

export interface AssetSelectionToolbarProps {
  /** Single asset (for backwards compatibility) */
  asset?: AssetSummary | null;
  /** Multiple selected assets */
  selectedAssets?: AssetSummary[];
  /** Total count of assets available in the current view */
  totalCount?: number;
  /** Callback to clear selection */
  onClear: () => void;
  /** Callback to toggle/select all */
  onSelectAll?: () => void;
  /** Callback to notify parent of changes (favorites, trash, etc.) */
  onChanged?: () => void;
}

/** Gives selected project assets direct paths into workflows, bulk favoriting, bulk download, and bulk trash. */
export function AssetSelectionToolbar({
  asset,
  selectedAssets,
  totalCount,
  onClear,
  onSelectAll,
  onChanged,
}: AssetSelectionToolbarProps) {
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const items = useMemo(() => {
    if (selectedAssets && selectedAssets.length > 0) return selectedAssets;
    if (asset) return [asset];
    return [];
  }, [selectedAssets, asset]);

  if (items.length === 0) return null;

  const count = items.length;
  const firstAsset = items[0];
  const allFavorited = items.every((item) => item.isFavorite);
  const services = firstAsset.type === "video" ? VIDEO_SERVICES : IMAGE_SERVICES;
  const canCreate = firstAsset.type === "image" || firstAsset.type === "video";
  const allSameType = items.every((item) => item.type === firstAsset.type);
  const isAllSelected = totalCount !== undefined && totalCount > 0 && count >= totalCount;

  const handleToggleFavorite = async () => {
    if (busy) return;
    setBusy(true);
    setActionError(null);
    try {
      const nextFavorite = !allFavorited;
      await Promise.all(
        items.map((item) =>
          fetch(`/api/assets/${encodeURIComponent(item.id)}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ isFavorite: nextFavorite }),
          }),
        ),
      );
      onChanged?.();
    } catch {
      setActionError("Could not update favorites.");
    } finally {
      setBusy(false);
    }
  };

  const handleDownload = async () => {
    if (busy) return;
    setBusy(true);
    setActionError(null);
    try {
      for (const item of items) {
        await saveResult(item.url, item.type);
      }
    } catch {
      setActionError("Could not download some assets.");
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    if (busy) return;
    const label = count === 1 ? "this asset" : `these ${count} assets`;
    const confirmed = window.confirm(
      `Move ${label} to Trash? You can restore them later from the Trash page.`,
    );
    if (!confirmed) return;

    setBusy(true);
    setActionError(null);
    try {
      await Promise.all(
        items.map((item) =>
          fetch(`/api/assets/${encodeURIComponent(item.id)}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ isTrashed: true }),
          }),
        ),
      );
      onClear();
      onChanged?.();
    } catch {
      setActionError("Could not move assets to Trash.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-primary/25 bg-primary/[0.06] p-3 sm:px-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Check className="h-4 w-4" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-medium">
              {count === 1 ? "1 asset selected" : `${count} assets selected`}
            </p>
            <p className="text-xs text-muted-foreground">
              {count === 1
                ? `${firstAsset.type === "3d_model" ? "3D model" : firstAsset.type} · ready for workflow or actions`
                : allSameType
                  ? `All ${firstAsset.type === "3d_model" ? "3D models" : `${firstAsset.type}s`} · bulk actions available`
                  : `${count} mixed items · bulk actions available`}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
          {onSelectAll && totalCount !== undefined && totalCount > 1 && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={isAllSelected ? onClear : onSelectAll}
              className="h-8 gap-1.5 text-xs"
            >
              {isAllSelected ? (
                <>
                  <Square className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Deselect all</span>
                </>
              ) : (
                <>
                  <CheckSquare className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Select all ({totalCount})</span>
                </>
              )}
            </Button>
          )}

          {canCreate && count === 1 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button type="button" size="sm" className="h-8 gap-1.5 text-xs" disabled={busy}>
                  <WandSparkles className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Use in workflow</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="max-h-[min(60vh,420px)] overflow-y-auto">
                {services.map(([label, route]) => {
                  const separator = route.includes("?") ? "&" : "?";
                  return (
                    <DropdownMenuItem key={route} asChild>
                      <Link href={`${route}${separator}assetId=${encodeURIComponent(firstAsset.id)}`}>
                        {label}
                      </Link>
                    </DropdownMenuItem>
                  );
                })}
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={busy}
            onClick={() => void handleToggleFavorite()}
            className="h-8 gap-1.5 text-xs"
            title={allFavorited ? "Remove from favorites" : "Add to favorites"}
          >
            {busy ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
            ) : (
              <Star
                className={cn(
                  "h-3.5 w-3.5",
                  allFavorited && "fill-current text-primary",
                )}
                aria-hidden="true"
              />
            )}
            <span>{allFavorited ? "Unfavorite" : "Favorite"}</span>
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={busy}
            onClick={() => void handleDownload()}
            className="h-8 gap-1.5 text-xs"
            title="Download selected"
          >
            {busy ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
            ) : (
              <Download className="h-3.5 w-3.5" aria-hidden="true" />
            )}
            <span>Download</span>
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={busy}
            onClick={() => void handleDelete()}
            className="h-8 gap-1.5 border-destructive/30 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
            title="Move to Trash"
          >
            {busy ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
            ) : (
              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
            )}
            <span>Delete</span>
          </Button>

          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onClear}
            disabled={busy}
            className="h-8 w-8 shrink-0 rounded-lg"
            aria-label="Clear selection"
            title="Clear selection"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {actionError && (
        <p role="alert" className="text-xs text-destructive">
          {actionError}
        </p>
      )}
    </div>
  );
}
