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
    <main className="mx-auto flex min-h-[calc(100vh-3.5rem)] w-full max-w-[1440px] flex-col gap-6 px-4 py-5 sm:px-6 lg:px-8">
      <header className="space-y-2 border-b pb-4">
        <h1 className="text-2xl font-semibold tracking-tight">Trash</h1>
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
        <div className="grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-3 sm:gap-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="aspect-[4/3] w-full" />
          ))}
        </div>
      ) : assets.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 rounded-lg border border-dashed bg-muted/20 px-5 py-14 text-center">
          <p className="text-base font-semibold">Trash is empty</p>
          <p className="text-sm text-muted-foreground">Assets you delete will appear here.</p>
          <Button asChild variant="outline" size="sm" className="mt-2 h-9">
            <Link href="/app/projects">Browse projects</Link>
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-3 sm:gap-4">
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
