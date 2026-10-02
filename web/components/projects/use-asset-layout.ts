"use client";

import { useEffect, useState } from "react";

import type { AssetLayout } from "@/components/projects/asset-layout-controls";

export function useAssetLayout(storageKey: string) {
  const [layout, setLayout] = useState<AssetLayout>("grid");
  const [columns, setColumns] = useState(4);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(`asset-layout:${storageKey}`);
      if (!saved) return;
      const parsed = JSON.parse(saved) as { layout?: AssetLayout; columns?: number };
      if (parsed.layout === "grid" || parsed.layout === "list") setLayout(parsed.layout);
      if (typeof parsed.columns === "number" && [2, 3, 4, 5, 6].includes(parsed.columns)) setColumns(parsed.columns);
    } catch {
      // Un stockage local indisponible n'empêche pas l'affichage des assets.
    }
  }, [storageKey]);

  useEffect(() => {
    try {
      window.localStorage.setItem(`asset-layout:${storageKey}`, JSON.stringify({ layout, columns }));
    } catch {
      // Préférence facultative.
    }
  }, [storageKey, layout, columns]);

  return { layout, columns, setLayout, setColumns };
}
