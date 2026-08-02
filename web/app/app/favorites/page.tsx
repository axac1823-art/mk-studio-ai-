"use client";

// Page Favorites — assets marqués is_favorite = true, hors corbeille.
// Même pattern que les autres pages grille : fetch /api/assets?favorite=1,
// AssetCard avec onChanged = refetch (une carte défavorisée disparaît).
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

import { AssetCard, type AssetSummary } from "@/components/projects/asset-card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export default function FavoritesPage() {
  const [assets, setAssets] = useState<AssetSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchFavorites = useCallback(async () => {
    try {
      const res = await fetch("/api/assets?favorite=1");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { assets: AssetSummary[] };
      setAssets(data.assets);
      setError(null);
    } catch {
      setError("Could not load favorites.");
    }
  }, []);

  useEffect(() => {
    void fetchFavorites();
  }, [fetchFavorites]);

  return (
    <main className="flex min-h-screen w-full flex-col gap-5 p-4 sm:p-6">
      <header>
        <h1 className="text-xl font-semibold tracking-tight">Favorites</h1>
        <p className="text-sm text-muted-foreground">Your best results, one click away.</p>
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
          <p className="text-sm font-medium">No favorites yet</p>
          <p className="text-sm text-muted-foreground">
            Star an asset from a project to see it here.
          </p>
          <Button asChild variant="outline" size="sm" className="mt-2">
            <Link href="/app/projects">Browse projects</Link>
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {assets.map((asset) => (
            <AssetCard key={asset.id} asset={asset} onChanged={fetchFavorites} />
          ))}
        </div>
      )}
    </main>
  );
}
