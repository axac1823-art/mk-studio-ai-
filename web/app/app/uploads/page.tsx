"use client";

// Page Uploads — images/vidéos sources uploadées par l'utilisateur
// (generation_id IS NULL). Requête : /api/assets?uploads=1.
// Ces assets sont réutilisables comme entrées de génération dans le studio.
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

import { AssetCard, type AssetSummary } from "@/components/projects/asset-card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export default function UploadsPage() {
  const [assets, setAssets] = useState<AssetSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchUploads = useCallback(async () => {
    try {
      const res = await fetch("/api/assets?uploads=1");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { assets: AssetSummary[] };
      setAssets(data.assets);
      setError(null);
    } catch {
      setError("Could not load uploads.");
    }
  }, []);

  useEffect(() => {
    void fetchUploads();
  }, [fetchUploads]);

  return (
    <main className="flex min-h-screen w-full flex-col gap-5 p-4 sm:p-6">
      <header>
        <h1 className="text-xl font-semibold tracking-tight">Uploads</h1>
        <p className="text-sm text-muted-foreground">Source images and videos ready to use.</p>
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
          <p className="text-sm font-medium">No uploads yet</p>
          <p className="text-sm text-muted-foreground">
            Upload a source image in the studio to start generating.
          </p>
          <Button asChild variant="outline" size="sm" className="mt-2">
            <Link href="/app/dashboard">Open the studio</Link>
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {assets.map((asset) => (
            <AssetCard key={asset.id} asset={asset} onChanged={fetchUploads} />
          ))}
        </div>
      )}
    </main>
  );
}
