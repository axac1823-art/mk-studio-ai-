"use client";

// Page Search — recherche simple client-side sur projets et assets non
// corbeille. La DB n'a pas encore de recherche full-text : on charge la
// liste complète et on filtre par nom de projet et par type d'asset.
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";

import { AssetCard, type AssetSummary } from "@/components/projects/asset-card";
import { ProjectCard, type ProjectSummary } from "@/components/projects/project-card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

type TypeFilter = "all" | "image" | "video";

export default function SearchPage() {
  const [projects, setProjects] = useState<ProjectSummary[] | null>(null);
  const [assets, setAssets] = useState<AssetSummary[] | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<TypeFilter>("all");
  const [error, setError] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    try {
      const [projectsRes, assetsRes] = await Promise.all([
        fetch("/api/projects"),
        fetch("/api/assets"),
      ]);
      if (!projectsRes.ok || !assetsRes.ok) throw new Error("HTTP error");
      const projectsData = (await projectsRes.json()) as { projects: ProjectSummary[] };
      const assetsData = (await assetsRes.json()) as { assets: AssetSummary[] };
      setProjects(projectsData.projects);
      setAssets(assetsData.assets);
      setError(null);
    } catch {
      setError("Could not load search data.");
    }
  }, []);

  useEffect(() => {
    void fetchAll();
  }, [fetchAll]);

  const filteredProjects = useMemo(() => {
    if (!projects) return [];
    const q = query.trim().toLowerCase();
    if (!q) return projects;
    return projects.filter((project) => project.name.toLowerCase().includes(q));
  }, [projects, query]);

  const filteredAssets = useMemo(() => {
    if (!assets) return [];
    const q = query.trim().toLowerCase();
    const byType = filter === "all" ? assets : assets.filter((asset) => asset.type === filter);
    if (!q) return byType;
    return byType.filter((asset) => asset.type.toLowerCase().includes(q));
  }, [assets, query, filter]);

  const deleteProject = async (id: string) => {
    try {
      const res = await fetch(`/api/projects/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await fetchAll();
    } catch {
      setError("Could not delete project.");
    }
  };

  const deleteAsset = async () => {
    await fetchAll();
  };

  return (
    <main className="flex min-h-screen w-full flex-col gap-5 p-4 sm:p-6">
      <header>
        <h1 className="text-xl font-semibold tracking-tight">Search</h1>
        <p className="text-sm text-muted-foreground">Find your projects and assets.</p>
      </header>

      <input
        type="text"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search projects or asset types..."
        className="h-10 w-full max-w-md rounded-md border bg-background px-3 text-sm outline-none focus:border-primary"
      />

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

      {projects === null || assets === null ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="aspect-[4/3] w-full" />
          ))}
        </div>
      ) : (
        <>
          <section className="flex flex-col gap-3">
            <h2 className="text-sm font-medium text-muted-foreground">Projects</h2>
            {filteredProjects.length === 0 ? (
              <p className="text-sm text-muted-foreground">No project matches.</p>
            ) : (
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                {filteredProjects.map((project) => (
                  <ProjectCard key={project.id} project={project} onDelete={deleteProject} />
                ))}
              </div>
            )}
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="text-sm font-medium text-muted-foreground">Assets</h2>
            {filteredAssets.length === 0 ? (
              <p className="text-sm text-muted-foreground">No asset matches.</p>
            ) : (
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                {filteredAssets.map((asset) => (
                  <AssetCard key={asset.id} asset={asset} onChanged={fetchAll} onDelete={deleteAsset} />
                ))}
              </div>
            )}
          </section>
        </>
      )}

      <Button asChild variant="outline" size="sm" className="w-fit">
        <Link href="/app/dashboard">Open the studio</Link>
      </Button>
    </main>
  );
}
