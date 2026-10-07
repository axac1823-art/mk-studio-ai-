"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Plus } from "lucide-react";

import { AssetCard, type AssetSummary } from "@/components/projects/asset-card";
import { AssetLayoutControls, assetLayoutClass } from "@/components/projects/asset-layout-controls";
import { AssetServiceFilter } from "@/components/projects/asset-service-filter";
import { ProjectCard, type ProjectSummary } from "@/components/projects/project-card";
import { useAssetLayout } from "@/components/projects/use-asset-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

type ProjectsView = "projects" | "assets" | "favorites";
type FavoriteTypeFilter = "all" | "image" | "video" | "audio";

export default function ProjectsPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const viewParam = searchParams.get("view");
  const view: ProjectsView =
    viewParam === "assets" || viewParam === "favorites" ? viewParam : "projects";
  const [projects, setProjects] = useState<ProjectSummary[] | null>(null);
  const [assets, setAssets] = useState<AssetSummary[] | null>(null);
  const [assetType, setAssetType] = useState<FavoriteTypeFilter>("all");
  const [serviceFilter, setServiceFilter] = useState("all");
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const projectsLayout = useAssetLayout("all-projects");
  const allAssetsLayout = useAssetLayout("all-assets");
  const favoritesLayout = useAssetLayout("project-favorites");
  const { layout, columns, setLayout, setColumns } =
    view === "favorites"
      ? favoritesLayout
      : view === "assets"
        ? allAssetsLayout
        : projectsLayout;

  const fetchProjects = useCallback(async () => {
    try {
      const res = await fetch("/api/projects");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { projects: ProjectSummary[] };
      setProjects(data.projects);
      setError(null);
    } catch {
      setError("Could not load projects.");
    }
  }, []);

  const fetchAssets = useCallback(async (
    type: FavoriteTypeFilter,
    service: string,
    favoritesOnly: boolean,
  ) => {
    try {
      const params = new URLSearchParams();
      if (favoritesOnly) params.set("favorite", "1");
      if (type !== "all") params.set("type", type);
      if (service !== "all") params.set("feature", service);
      const query = params.toString();
      const res = await fetch(query ? `/api/assets?${query}` : "/api/assets");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { assets: AssetSummary[] };
      setAssets(data.assets);
      setError(null);
    } catch {
      setError(favoritesOnly ? "Could not load favorite assets." : "Could not load assets.");
    }
  }, []);

  useEffect(() => {
    void fetchProjects();
  }, [fetchProjects]);

  useEffect(() => {
    if (view !== "projects") {
      void fetchAssets(assetType, serviceFilter, view === "favorites");
    }
  }, [view, assetType, serviceFilter, fetchAssets]);

  useEffect(() => {
    if (searchParams.get("create") !== "1") return;
    setCreating(true);
    const params = new URLSearchParams(searchParams.toString());
    params.delete("create");
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }, [pathname, router, searchParams]);

  const createProject = async () => {
    const trimmed = name.trim();
    if (!trimmed || busy) return;
    setBusy(true);
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setName("");
      setCreating(false);
      await fetchProjects();
      window.dispatchEvent(new Event("projects:updated"));
    } catch {
      setError("Could not create the project.");
    } finally {
      setBusy(false);
    }
  };

  const deleteProject = async (id: string) => {
    try {
      const res = await fetch(`/api/projects/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await fetchProjects();
      window.dispatchEvent(new Event("projects:updated"));
    } catch {
      setError("Could not delete the project.");
    }
  };

  return (
    <main className="flex min-h-[calc(100vh-3.5rem)] w-full flex-col gap-5 p-4 sm:p-6">
      <header>
        <h1 className="text-xl font-semibold tracking-tight">
          {view === "projects" ? "All projects" : view === "favorites" ? "Favorites" : "All assets"}
        </h1>
        <p className="text-sm text-muted-foreground">
          {view === "projects"
            ? "Your generations, organized by project."
            : view === "favorites"
              ? "Favorite assets from all your projects."
              : "Images, videos, and audio from all your projects."}
        </p>
      </header>

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      {view !== "projects" ? (
        <>
          <Tabs
            value={assetType}
            onValueChange={(value) => {
              setAssetType(value as FavoriteTypeFilter);
              setServiceFilter("all");
            }}
          >
            <TabsList>
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="image">Images</TabsTrigger>
              <TabsTrigger value="video">Videos</TabsTrigger>
              <TabsTrigger value="audio">Audio</TabsTrigger>
            </TabsList>
          </Tabs>

          {(assetType === "image" || assetType === "video") && (
            <AssetServiceFilter
              type={assetType}
              value={serviceFilter}
              onChange={setServiceFilter}
            />
          )}

          <AssetLayoutControls
            layout={layout}
            columns={columns}
            onLayoutChange={setLayout}
            onColumnsChange={setColumns}
          />

          {assets === null ? (
            <div
              className={assetLayoutClass(layout)}
              style={
                layout === "grid"
                  ? { gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }
                  : undefined
              }
            >
              {Array.from({ length: 4 }).map((_, index) => (
                <Skeleton key={index} className="aspect-[4/3] w-full" />
              ))}
            </div>
          ) : assets.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 py-16 text-center">
              <p className="text-sm font-medium">
                {view === "favorites" ? "No favorite assets yet" : "No assets yet"}
              </p>
              <p className="text-sm text-muted-foreground">
                {view === "favorites"
                  ? "Mark an asset as a favorite from any project to find it here."
                  : "Create an image, video, or audio asset to see it here."}
              </p>
            </div>
          ) : (
            <div
              className={assetLayoutClass(layout)}
              style={
                layout === "grid"
                  ? { gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }
                  : undefined
              }
            >
              {assets.map((asset) => (
                <AssetCard
                  key={asset.id}
                  asset={asset}
                  layout={layout}
                  onChanged={() => void fetchAssets(assetType, serviceFilter, view === "favorites")}
                />
              ))}
            </div>
          )}
        </>
      ) : (
        <>
          <AssetLayoutControls
            layout={layout}
            columns={columns}
            onLayoutChange={setLayout}
            onColumnsChange={setColumns}
          />

          {projects === null ? (
            <div
              className={assetLayoutClass(layout)}
              style={
                layout === "grid"
                  ? { gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }
                  : undefined
              }
            >
              {Array.from({ length: 4 }).map((_, index) => (
                <Skeleton key={index} className="aspect-[4/3] w-full" />
              ))}
            </div>
          ) : (
            <div
              className={assetLayoutClass(layout)}
              style={
                layout === "grid"
                  ? { gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }
                  : undefined
              }
            >
              {projects.map((project) => (
                <ProjectCard
                  key={project.id}
                  project={project}
                  layout={layout}
                  onDelete={deleteProject}
                />
              ))}

              <Card className="overflow-hidden">
                {creating ? (
                  <CardContent
                    className={
                      layout === "grid"
                        ? "flex aspect-[4/3] flex-col justify-center gap-2 p-3"
                        : "flex min-h-32 flex-col justify-center gap-2 p-3"
                    }
                  >
                    <input
                      autoFocus
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") void createProject();
                        if (event.key === "Escape") setCreating(false);
                      }}
                      placeholder="Project name"
                      className="h-9 w-full rounded-md border bg-background px-3 text-sm outline-none focus:border-primary"
                    />
                    <Button
                      type="button"
                      size="sm"
                      disabled={!name.trim() || busy}
                      onClick={() => void createProject()}
                    >
                      Create
                    </Button>
                  </CardContent>
                ) : (
                  <button
                    type="button"
                    onClick={() => setCreating(true)}
                    className={
                      layout === "grid"
                        ? "flex aspect-[4/3] w-full flex-col items-center justify-center gap-2 text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground"
                        : "flex min-h-32 w-full flex-row items-center justify-center gap-2 text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground"
                    }
                  >
                    <Plus className="h-6 w-6" />
                    <span className="text-sm font-medium">New project</span>
                  </button>
                )}
              </Card>
            </div>
          )}
        </>
      )}
    </main>
  );
}
