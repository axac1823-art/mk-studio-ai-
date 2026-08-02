"use client";

// Page Trash — assets soft-deleted (is_trashed = true). Actions : Restore
// (remet is_trashed = false) ou Delete permanent (suppression en DB).
// La purge automatique > 30 j est gérée par scripts/purge-trash.ts.
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

import { AssetCard, type AssetSummary } from "@/components/projects/asset-card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export default function TrashPage() {
  const [assets, setAssets] = useState<AssetSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchTrash = useCallback(async () => {
    try {
      const res = await fetch("/api/assets?trashed=1");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { assets: AssetSummary[] };
      setAssets(data.assets);
      setError(null);
    } catch {
      setError("Could not load trash.");
    }
  }, []);

  useEffect(() => {
    void fetchTrash();
  }, [fetchTrash]);

  return (
    <main className="flex min-h-screen w-full flex-col gap-5 p-4 sm:p-6">
      <header>
        <h1 className="text-xl font-semibold tracking-tight">Trash</h1>
        <p className="text-sm text-muted-foreground">
          Deleted assets are kept for 30 days before permanent removal.
        </p>
      </header>

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      {assets === null ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="aspect-[4/3] w-full" />
          ))}
        </div>
      ) : assets.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 py-16 text-center">
          <p className="text-sm font-medium">Trash is empty</p>
          <p className="text-sm text-muted-foreground">Assets you delete will appear here.</p>
          <Button asChild variant="outline" size="sm" className="mt-2">
            <Link href="/app/projects">Browse projects</Link>
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {assets.map((asset) => (
            <AssetCard
              key={asset.id}
              asset={asset}
              trashed
              onChanged={fetchTrash}
              onDelete={fetchTrash}
            />
          ))}
        </div>
      )}
    </main>
  );
}
