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
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

type TypeFilter = "all" | "image" | "video";

export default function ProjectDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [projectName, setProjectName] = useState<string | null>(null);
  const [assets, setAssets] = useState<AssetSummary[] | null>(null);
  const [filter, setFilter] = useState<TypeFilter>("all");
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchProject = useCallback(
    async (type: TypeFilter) => {
      try {
        const query = type === "all" ? "" : `?type=${type}`;
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
    void fetchProject(filter);
  }, [fetchProject, filter]);

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

      <Tabs value={filter} onValueChange={(value) => setFilter(value as TypeFilter)}>
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="image">Images</TabsTrigger>
          <TabsTrigger value="video">Videos</TabsTrigger>
        </TabsList>
      </Tabs>

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
          <p className="text-sm font-medium">No assets yet</p>
          <p className="text-sm text-muted-foreground">
            Generate something in the studio to fill this project.
          </p>
          <Button asChild variant="outline" size="sm" className="mt-2">
            <Link href="/app/dashboard">Open the studio</Link>
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {assets.map((asset) => (
            <AssetCard key={asset.id} asset={asset} onChanged={() => void fetchProject(filter)} />
          ))}
        </div>
      )}
    </main>
  );
}
