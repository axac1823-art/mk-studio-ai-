"use client";

// Page Favorites — assets marqués is_favorite = true, hors corbeille.
// Même pattern que les autres pages grille : fetch /api/assets?favorite=1,
// AssetCard avec onChanged = refetch (une carte défavorisée disparaît).
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

import { AssetCard, type AssetSummary } from "@/components/projects/asset-card";
import { AssetLayoutControls, assetLayoutClass } from "@/components/projects/asset-layout-controls";
import { AssetServiceFilter } from "@/components/projects/asset-service-filter";
import { useAssetLayout } from "@/components/projects/use-asset-layout";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

type FavoriteTypeFilter = "all" | "image" | "video" | "audio";

export default function FavoritesPage() {
  const [assets, setAssets] = useState<AssetSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<FavoriteTypeFilter>("all");
  const [serviceFilter, setServiceFilter] = useState("all");
  const { layout, columns, setLayout, setColumns } = useAssetLayout("favorites");

  const fetchFavorites = useCallback(async (type: FavoriteTypeFilter, service: string) => {
    try {
      const params = new URLSearchParams({ favorite: "1" });
      if (type !== "all") params.set("type", type);
      if (service !== "all") params.set("feature", service);
      const res = await fetch(`/api/assets?${params.toString()}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { assets: AssetSummary[] };
      setAssets(data.assets);
      setError(null);
    } catch {
      setError("Could not load favorites.");
    }
  }, []);

  useEffect(() => {
    void fetchFavorites(typeFilter, serviceFilter);
  }, [fetchFavorites, typeFilter, serviceFilter]);

  return (
    <main className="flex min-h-screen w-full flex-col gap-5 p-4 sm:p-6">
      <header>
        <h1 className="text-xl font-semibold tracking-tight">Favorites</h1>
        <p className="text-sm text-muted-foreground">Your best results, one click away.</p>
      </header>

      <Tabs value={typeFilter} onValueChange={(value) => { setTypeFilter(value as FavoriteTypeFilter); setServiceFilter("all"); }}>
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="image">Images</TabsTrigger>
          <TabsTrigger value="video">Videos</TabsTrigger>
          <TabsTrigger value="audio">Audio</TabsTrigger>
        </TabsList>
      </Tabs>

      {(typeFilter === "image" || typeFilter === "video") && (
        <AssetServiceFilter type={typeFilter} value={serviceFilter} onChange={setServiceFilter} />
      )}

      <AssetLayoutControls layout={layout} columns={columns} onLayoutChange={setLayout} onColumnsChange={setColumns} />

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      {assets === null ? (
        <div className={assetLayoutClass(layout)} style={layout === "grid" ? { gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` } : undefined}>
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="aspect-[4/3] w-full" />
          ))}
        </div>
      ) : assets.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 py-16 text-center">
          <p className="text-sm font-medium">No favorites match these filters</p>
          <p className="text-sm text-muted-foreground">
            Try another asset type or service, or star an asset from a project.
          </p>
          <Button asChild variant="outline" size="sm" className="mt-2">
            <Link href="/app/projects">Browse projects</Link>
          </Button>
        </div>
      ) : (
        <div className={assetLayoutClass(layout)} style={layout === "grid" ? { gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` } : undefined}>
          {assets.map((asset) => (
            <AssetCard key={asset.id} asset={asset} layout={layout} onChanged={() => fetchFavorites(typeFilter, serviceFilter)} />
          ))}
        </div>
      )}
    </main>
  );
}
