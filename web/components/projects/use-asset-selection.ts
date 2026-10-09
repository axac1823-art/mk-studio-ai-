"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export function useAssetSelection(ids: string[]) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const anchorId = useRef<string | null>(null);
  const idOrder = useMemo(() => ids, [ids]);

  useEffect(() => {
    const validIds = new Set(idOrder);
    setSelectedIds((current) => {
      const next = new Set(Array.from(current).filter((id) => validIds.has(id)));
      return next.size === current.size ? current : next;
    });
  }, [idOrder]);

  const clear = useCallback(() => {
    anchorId.current = null;
    setSelectedIds(new Set());
  }, []);

  const selectAll = useCallback(() => {
    anchorId.current = idOrder[0] ?? null;
    setSelectedIds(new Set(idOrder));
  }, [idOrder]);

  const toggle = useCallback((id: string, shiftKey = false) => {
    setSelectedIds((current) => {
      if (shiftKey && anchorId.current) {
        const start = idOrder.indexOf(anchorId.current);
        const end = idOrder.indexOf(id);
        if (start >= 0 && end >= 0) {
          const [from, to] = start < end ? [start, end] : [end, start];
          const next = new Set(current);
          for (const rangeId of idOrder.slice(from, to + 1)) next.add(rangeId);
          return next;
        }
      }
      anchorId.current = id;
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, [idOrder]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isEditing = target?.isContentEditable || Boolean(target?.closest("input, textarea, select"));
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "a" && !isEditing) {
        event.preventDefault();
        selectAll();
      }
      if (event.key === "Escape" && selectedIds.size > 0) clear();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [clear, selectAll, selectedIds.size]);

  return {
    selectedIds,
    selectedCount: selectedIds.size,
    hasSelection: selectedIds.size > 0,
    isSelected: (id: string) => selectedIds.has(id),
    toggle,
    clear,
    selectAll,
  };
}
