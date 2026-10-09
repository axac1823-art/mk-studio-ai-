"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, Download } from "lucide-react";
import { toast } from "sonner";

import { AssetCard, IMAGE_SERVICES, VIDEO_SERVICES, type AssetSummary } from "@/components/projects/asset-card";
import { AssetSelectionBar } from "@/components/projects/asset-selection-bar";
import { useAssetSelection } from "@/components/projects/use-asset-selection";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { saveResult } from "@/lib/download";
import { cn } from "@/lib/utils";

interface AssetLibraryGridProps {
  assets: AssetSummary[];
  onChanged: () => void | Promise<void>;
  trashed?: boolean;
  layout?: "grid" | "list";
  className?: string;
}

export function AssetLibraryGrid({ assets, onChanged, trashed = false, layout = "grid", className }: AssetLibraryGridProps) {
  const ids = useMemo(() => assets.map((asset) => asset.id), [assets]);
  const selection = useAssetSelection(ids);
  const selectedAssets = assets.filter((asset) => selection.selectedIds.has(asset.id));
  const [busy, setBusy] = useState(false);
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const previewAsset = previewIndex === null ? null : assets[previewIndex] ?? null;

  const applyFlags = async (flags: { isFavorite?: boolean; isTrashed?: boolean }, label: string) => {
    if (busy || selectedAssets.length === 0) return;
    setBusy(true);
    const toastId = toast.loading(`Updating ${selectedAssets.length} assets?`);
    const results = await Promise.allSettled(selectedAssets.map(async (asset) => {
      const response = await fetch(`/api/assets/${asset.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(flags),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
    }));
    const succeeded = results.filter((result) => result.status === "fulfilled").length;
    const failed = results.length - succeeded;
    toast.dismiss(toastId);
    if (failed > 0) toast.error(`${succeeded} updated; ${failed} failed.`);
    else toast.success(`${succeeded} assets ${label}.`);
    setBusy(false);
    selection.clear();
    await onChanged();
  };

  const downloadSelected = async () => {
    if (busy || selectedAssets.length === 0) return;
    setBusy(true);
    const toastId = toast.loading(`Preparing ${selectedAssets.length} downloads?`);
    const results = await Promise.allSettled(selectedAssets.map((asset) => saveResult(asset.url, asset.type)));
    const failed = results.filter((result) => result.status === "rejected").length;
    toast.dismiss(toastId);
    if (failed > 0) toast.error(`${results.length - failed} downloaded; ${failed} failed.`);
    else toast.success(`${results.length} downloads started.`);
    setBusy(false);
    selection.clear();
  };

  const deleteSelected = async () => {
    if (busy || selectedAssets.length === 0) return;
    if (!window.confirm(`Permanently delete ${selectedAssets.length} selected assets? This cannot be undone.`)) return;
    setBusy(true);
    const toastId = toast.loading(`Deleting ${selectedAssets.length} assets?`);
    const results = await Promise.allSettled(selectedAssets.map(async (asset) => {
      const response = await fetch(`/api/assets/${asset.id}`, { method: "DELETE" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
    }));
    const succeeded = results.filter((result) => result.status === "fulfilled").length;
    const failed = results.length - succeeded;
    toast.dismiss(toastId);
    if (failed > 0) toast.error(`${succeeded} deleted; ${failed} failed.`);
    else toast.success(`${succeeded} assets permanently deleted.`);
    setBusy(false);
    selection.clear();
    await onChanged();
  };

  useEffect(() => {
    if (previewIndex === null) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setPreviewIndex(null);
      if (event.key === "ArrowLeft") setPreviewIndex((index) => index === null ? null : (index - 1 + assets.length) % assets.length);
      if (event.key === "ArrowRight") setPreviewIndex((index) => index === null ? null : (index + 1) % assets.length);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [assets.length, previewIndex]);

  return (
    <>
      <div className={cn(className ?? (layout === "grid" ? "grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-3 sm:gap-4" : "flex flex-col gap-3"))}>
        {assets.map((asset, index) => (
          <AssetCard
            key={asset.id}
            asset={asset}
            layout={layout}
            trashed={trashed}
            onChanged={onChanged}
            onDelete={() => void onChanged()}
            selected={selection.isSelected(asset.id)}
            selectionActive={selection.hasSelection}
            onToggleSelected={selection.toggle}
            onPreview={() => setPreviewIndex(index)}
          />
        ))}
      </div>

      <AssetSelectionBar
        count={selection.selectedCount}
        allSelected={assets.length > 0 && selection.selectedCount === assets.length}
        trashed={trashed}
        busy={busy}
        onSelectAll={selection.selectAll}
        onClear={selection.clear}
        onFavorite={() => {
          const shouldFavorite = !selectedAssets.every((asset) => asset.isFavorite);
          void applyFlags({ isFavorite: shouldFavorite }, shouldFavorite ? "added to favorites" : "removed from favorites");
        }}
        onDownload={() => void downloadSelected()}
        onTrash={() => void applyFlags({ isTrashed: true }, "moved to trash")}
        onRestore={() => void applyFlags({ isTrashed: false }, "restored")}
        onDeletePermanently={() => void deleteSelected()}
      />

      {previewAsset && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/75 p-3 backdrop-blur-sm sm:p-6"
          role="presentation"
          onMouseDown={(event) => { if (event.target === event.currentTarget) setPreviewIndex(null); }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-label={`${previewAsset.type === "3d_model" ? "3D model" : previewAsset.type} preview`}
            className="flex max-h-[92vh] w-full max-w-5xl flex-col gap-4 overflow-y-auto rounded-xl border bg-card p-4 shadow-2xl sm:p-6"
          >
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-base font-semibold capitalize">{previewAsset.type === "3d_model" ? "3D model preview" : `${previewAsset.type} preview`}</h2>
              <Button type="button" variant="ghost" size="icon" className="h-9 w-9" onClick={() => setPreviewIndex(null)} aria-label="Close preview">?</Button>
            </div>
            <p className="sr-only">Use the arrow keys to move between assets.</p>
            <div className="relative flex min-h-[40vh] max-h-[68vh] items-center justify-center overflow-hidden rounded-lg bg-muted/40">
              {previewAsset.type === "image" ? (
                <img src={previewAsset.url} alt="Selected asset" className="max-h-[68vh] max-w-full object-contain" />
              ) : previewAsset.type === "video" ? (
                <video src={previewAsset.url} controls className="max-h-[68vh] max-w-full" />
              ) : previewAsset.type === "audio" ? (
                <audio src={previewAsset.url} controls className="w-full max-w-xl" />
              ) : (
                <div className="flex flex-col items-center gap-4 p-8 text-center">
                  <p className="text-sm text-muted-foreground">Preview this model in a compatible 3D viewer.</p>
                  <Button asChild variant="outline"><a href={previewAsset.url} target="_blank" rel="noreferrer">Open 3D file</a></Button>
                </div>
              )}
              <Button type="button" variant="secondary" size="icon" aria-label="Previous asset" className="absolute left-3 top-1/2 -translate-y-1/2" onClick={() => setPreviewIndex((index) => index === null ? null : (index - 1 + assets.length) % assets.length)}><ArrowLeft className="h-4 w-4" /></Button>
              <Button type="button" variant="secondary" size="icon" aria-label="Next asset" className="absolute right-3 top-1/2 -translate-y-1/2" onClick={() => setPreviewIndex((index) => index === null ? null : (index + 1) % assets.length)}><ArrowRight className="h-4 w-4" /></Button>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="text-sm text-muted-foreground">{previewIndex === null ? "" : `${previewIndex + 1} of ${assets.length}`}</span>
              <div className="flex items-center gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => void saveResult(previewAsset.url, previewAsset.type)}><Download className="mr-1.5 h-4 w-4" />Download</Button>
                {!trashed && (previewAsset.type === "image" || previewAsset.type === "video") && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild><Button type="button" size="sm">Use as source</Button></DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {(previewAsset.type === "image" ? IMAGE_SERVICES : VIDEO_SERVICES).map(([label, route]) => {
                        const separator = route.includes("?") ? "&" : "?";
                        return <DropdownMenuItem key={route} asChild><a href={`${route}${separator}assetId=${encodeURIComponent(previewAsset.id)}`}>{label}</a></DropdownMenuItem>;
                      })}
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
