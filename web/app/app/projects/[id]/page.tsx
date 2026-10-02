"use client";

// Détail d'un projet : header (nom + compteur + actions), filtre par type via
// onglets (refetch avec ?type= — le filtre reste côté API, pas côté
// client) et grille d'assets. onChanged = refetch : une carte Trashée ou
// supprimée disparaît d'elle-même au rechargement de la liste.
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Trash2 } from "lucide-react";

import { AssetCard, type AssetSummary } from "@/components/projects/asset-card";
import { AssetLayoutControls, assetLayoutClass } from "@/components/projects/asset-layout-controls";
import { AssetServiceFilter } from "@/components/projects/asset-service-filter";
import { useAssetLayout } from "@/components/projects/use-asset-layout";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

type TypeFilter = "all" | "image" | "video" | "audio";

export default function ProjectDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [projectName, setProjectName] = useState<string | null>(null);
  const [assets, setAssets] = useState<AssetSummary[] | null>(null);
  const [filter, setFilter] = useState<TypeFilter>("all");
  const [serviceFilter, setServiceFilter] = useState("all");
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const { layout, columns, setLayout, setColumns } = useAssetLayout(`project:${params.id}`);

  const fetchProject = useCallback(
    async (type: TypeFilter, service: string) => {
      try {
        const queryParams = new URLSearchParams();
        if (type !== "all") queryParams.set("type", type);
        if (service !== "all") queryParams.set("feature", service);
        const serializedParams = queryParams.toString();
        const query = serializedParams ? `?${serializedParams}` : "";
        const res = await fetch(`/api/projects/${params.id}${query}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as {
          project: { id: string; name: string };
          assets: AssetSummary[];
        };
        setProjectName(data.project.name);
        setAssets(data.assets);
        setError(null);
      } catch {
        setError("Could not load this project.");
      }
    },
    [params.id]
  );

  useEffect(() => {
    void fetchProject(filter, serviceFilter);
  }, [fetchProject, filter, serviceFilter]);

  const deleteProject = async () => {
    if (!window.confirm(`Delete project "${projectName ?? "this project"}" and all its assets? This cannot be undone.`)) {
      return;
    }
    setDeleting(true);
    try {
      const res = await fetch(`/api/projects/${params.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      router.push("/app/projects");
    } catch {
      setError("Could not delete this project.");
      setDeleting(false);
    }
  };

  return (
    <main className="flex min-h-screen w-full flex-col gap-5 p-4 sm:p-6">
      <header className="flex flex-col gap-3">
        <Button asChild variant="ghost" size="sm" className="w-fit gap-2 px-0 text-muted-foreground">
          <Link href="/app/projects">
            <ArrowLeft className="h-4 w-4" />
            All projects 
          </Link>
        </Button>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">{projectName ?? "…"}</h1>
            <p className="text-sm text-muted-foreground">
              {assets === null ? "…" : `${assets.length} assets`}
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-2 text-destructive hover:text-destructive"
            disabled={deleting}
            onClick={() => void deleteProject()}
          >
            <Trash2 className="h-4 w-4" />
            Delete
          </Button>
        </div>
      </header>

      <Tabs value={filter} onValueChange={(value) => { setFilter(value as TypeFilter); setServiceFilter("all"); }}>
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="image">Images</TabsTrigger>
          <TabsTrigger value="video">Videos</TabsTrigger>
          <TabsTrigger value="audio">Audio</TabsTrigger>
        </TabsList>
      </Tabs>

      {(filter === "image" || filter === "video") && (
        <AssetServiceFilter type={filter} value={serviceFilter} onChange={setServiceFilter} />
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
          <p className="text-sm font-medium">No assets match these filters</p>
          <p className="text-sm text-muted-foreground">
            Try another asset type or service, or generate a new result for this project.
          </p>
          <Button asChild variant="outline" size="sm" className="mt-2">
            <Link href="/app/ai-image-generator">Open the studio</Link>
          </Button>
        </div>
      ) : (
        <div className={assetLayoutClass(layout)} style={layout === "grid" ? { gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` } : undefined}>
          {assets.map((asset) => (
            <AssetCard key={asset.id} asset={asset} layout={layout} onChanged={() => void fetchProject(filter, serviceFilter)} />
          ))}
        </div>
      )}
    </main>
  );
}
