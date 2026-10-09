"use client";

// Page Uploads — images/vidéos sources uploadées par l'utilisateur
// (generation_id IS NULL). Requête : /api/assets?uploads=1.
// Ces assets sont réutilisables comme entrées de génération dans le studio.
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

import { AssetCard, type AssetSummary } from "@/components/projects/asset-card";
import { AssetSelectionToolbar } from "@/components/projects/asset-selection-toolbar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export default function UploadsPage() {
  const [assets, setAssets] = useState<AssetSummary[] | null>(null);
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchUploads = useCallback(async () => {
    try {
      const res = await fetch("/api/assets?uploads=1");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { assets: AssetSummary[] };
      setAssets(data.assets);
      setSelectedAssetId((current) =>
        current && data.assets.some((asset) => asset.id === current) ? current : null,
      );
      setError(null);
    } catch {
      setError("Could not load uploads.");
    }
  }, []);

  useEffect(() => {
    void fetchUploads();
  }, [fetchUploads]);

  return (
    <main className="mx-auto flex min-h-[calc(100vh-3.5rem)] w-full max-w-[1440px] flex-col gap-6 px-4 py-5 sm:px-6 lg:px-8">
      <header className="space-y-2 border-b pb-4">
        <h1 className="text-2xl font-semibold tracking-tight">Uploads</h1>
        <p className="text-sm text-muted-foreground">Source images and videos ready to use.</p>
      </header>

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      {selectedAssetId && assets && (
        <AssetSelectionToolbar
          asset={assets.find((asset) => asset.id === selectedAssetId) ?? null}
          onClear={() => setSelectedAssetId(null)}
        />
      )}

      {assets === null ? (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-3 sm:gap-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="aspect-[4/3] w-full" />
          ))}
        </div>
      ) : assets.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 rounded-lg border border-dashed bg-muted/20 px-5 py-14 text-center">
          <p className="text-base font-semibold">No uploads yet</p>
          <p className="text-sm text-muted-foreground">
            Upload a source image in the studio to start generating.
          </p>
          <Button asChild variant="outline" size="sm" className="mt-2 h-9">
            <Link href="/app/ai-image-generator">Open the studio</Link>
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-3 sm:gap-4">
          {assets.map((asset) => (
            <AssetCard
              key={asset.id}
              asset={asset}
              onChanged={fetchUploads}
              selected={selectedAssetId === asset.id}
              onSelect={() =>
                setSelectedAssetId((current) => current === asset.id ? null : asset.id)
              }
            />
          ))}
        </div>
      )}
    </main>
  );
}