"use client";

import { ArchiveRestore, Download, Heart, Trash2, X } from "lucide-react";

import { Button } from "@/components/ui/button";

interface AssetSelectionBarProps {
  count: number;
  allSelected: boolean;
  trashed?: boolean;
  busy?: boolean;
  onSelectAll: () => void;
  onClear: () => void;
  onFavorite?: () => void;
  onDownload?: () => void;
  onTrash?: () => void;
  onRestore?: () => void;
  onDeletePermanently?: () => void;
}

export function AssetSelectionBar({
  count, allSelected, trashed = false, busy = false, onSelectAll, onClear,
  onFavorite, onDownload, onTrash, onRestore, onDeletePermanently,
}: AssetSelectionBarProps) {
  if (count === 0) return null;

  return (
    <div className="fixed bottom-4 left-1/2 z-50 flex w-[min(920px,calc(100vw-2rem))] -translate-x-1/2 flex-wrap items-center gap-2 rounded-xl border bg-card/95 p-3 shadow-xl backdrop-blur">
      <span aria-live="polite" className="mr-auto px-1 text-sm font-medium">
        {busy ? "Updating assets?" : `${count} selected`}
      </span>
      {!allSelected && (
        <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={onSelectAll}>Select all</Button>
      )}
      {!trashed && onFavorite && (
        <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={onFavorite}>
          <Heart className="mr-1.5 h-4 w-4" />Favorite
        </Button>
      )}
      {!trashed && onDownload && (
        <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={onDownload}>
          <Download className="mr-1.5 h-4 w-4" />Download
        </Button>
      )}
      {trashed ? (
        <>
          {onRestore && <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={onRestore}><ArchiveRestore className="mr-1.5 h-4 w-4" />Restore</Button>}
          {onDeletePermanently && <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={onDeletePermanently} className="text-destructive hover:text-destructive"><Trash2 className="mr-1.5 h-4 w-4" />Delete permanently</Button>}
        </>
      ) : onTrash && (
        <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={onTrash}>
          <Trash2 className="mr-1.5 h-4 w-4" />Move to trash
        </Button>
      )}
      <Button type="button" variant="ghost" size="icon" className="h-9 w-9" disabled={busy} onClick={onClear} aria-label="Clear selection">
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}
