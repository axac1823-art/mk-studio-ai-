"use client";

// Contenu du dashboard : accueil authentifie partage avec la page racine.
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  FolderOpen,
  Image as ImageIcon,
  Plus,
} from "lucide-react";

import { AssetCard, type AssetSummary } from "@/components/projects/asset-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";

import { WorkflowCard } from "@/components/dashboard/workflow-card";

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 6) return "Good night";
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

interface ProjectSummary {
  id: string;
  name: string;
  assetCount: number;
  coverUrl?: string | null;
}

export function DashboardContent() {
  // Keep server and first client render identical; resolve local time after hydration.
  const [greeting, setGreeting] = useState("Good morning");
  const [projects, setProjects] = useState<ProjectSummary[] | null>(null);
  const [assets, setAssets] = useState<AssetSummary[] | null>(null);
  const [creating, setCreating] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [createBusy, setCreateBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchProjects = useCallback(async () => {
    try {
      const res = await fetch("/api/projects");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { projects: ProjectSummary[] };
      setProjects(data.projects);
    } catch {
      setError("Could not load projects.");
    }
  }, []);

  const fetchAssets = useCallback(async () => {
    try {
      const res = await fetch("/api/assets");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { assets: AssetSummary[] };
      setAssets(data.assets.slice().reverse().slice(0, 6));
    } catch {
      setError("Could not load recent work.");
    }
  }, []);

  useEffect(() => {
    setGreeting(getGreeting());
    void fetchProjects();
    void fetchAssets();
  }, [fetchProjects, fetchAssets]);

  const createProject = async () => {
    const trimmed = newProjectName.trim();
    if (!trimmed || createBusy) return;
    setCreateBusy(true);
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setNewProjectName("");
      setCreating(false);
      await fetchProjects();
    } catch {
      setError("Could not create project.");
    } finally {
      setCreateBusy(false);
    }
  };

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-[1440px] flex-col gap-8 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-[28px]">{greeting}</h1>
        <p className="text-sm text-muted-foreground">Continue where you left off or start something new.</p>
      </header>

      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}

      <section aria-labelledby="continue-working-title" className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 id="continue-working-title" className="text-lg font-semibold tracking-tight">Continue Working</h2>
            <p className="mt-1 text-sm text-muted-foreground">Pick up a project where you left off.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild type="button" variant="ghost" size="sm" className="gap-1">
              <Link href="/app/projects?view=projects">
                All projects <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
            <Button type="button" variant="outline" size="sm" className="shrink-0" onClick={() => setCreating((open) => !open)}>
              <Plus className="mr-1.5 h-4 w-4" />
              New project
            </Button>
          </div>
        </div>

        {creating && (
          <form className="flex max-w-xl items-center gap-2" onSubmit={(event) => { event.preventDefault(); void createProject(); }}>
            <Input
              autoFocus
              type="text"
              value={newProjectName}
              onChange={(event) => setNewProjectName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  setCreating(false);
                  setNewProjectName("");
                }
              }}
              placeholder="Project name"
              aria-label="Project name"
              className="h-9 flex-1"
            />
            <Button type="submit" size="sm" disabled={!newProjectName.trim() || createBusy}>
              {createBusy ? "Creating�" : "Create"}
            </Button>
          </form>
        )}

        {projects === null ? (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 3 }).map((_, index) => <Skeleton key={index} className="h-[92px] w-full rounded-lg" />)}
          </div>
        ) : projects.length === 0 ? (
          <div className="rounded-lg border border-dashed px-5 py-6 text-sm text-muted-foreground">
            No projects yet. Create a project to keep your work together.
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {projects.slice(0, 3).map((project) => (
              <Link
                key={project.id}
                href={`/app/projects/${project.id}`}
                className="group flex min-h-[92px] items-center gap-3 rounded-lg border bg-card p-4 transition-colors hover:border-primary/40 hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <div className="relative h-16 w-24 shrink-0 overflow-hidden rounded-md bg-muted">
                  {project.coverUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={project.coverUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                      <FolderOpen className="h-5 w-5" />
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium group-hover:text-foreground">{project.name}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{project.assetCount} assets</p>
                </div>
                <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
              </Link>
            ))}
          </div>
        )}
      </section>

      <section aria-labelledby="start-workflow-title" className="space-y-4">
        <div>
          <h2 id="start-workflow-title" className="text-lg font-semibold tracking-tight">Start a Workflow</h2>
          <p className="mt-1 text-sm text-muted-foreground">Focused starting points for architectural work.</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <WorkflowCard href="/app/ai-image-generator" title="Render" description="Turn a 3D screenshot into a photorealistic architectural render." image="/appartment.webp" />
          <WorkflowCard href="/app/plan-to-render" title={"Plan \u2192 Render"} description="Bring a 2D floor plan to life as a furnished render." image="/hero_white.webp" />
          <WorkflowCard href="/app/ambiance-change" title="Change Atmosphere" description="Explore a new time of day, season, or mood for your scene." image="/appartment.webp" />
          <WorkflowCard href="/app/multi-angle" title="Multi-Angle" description="Create additional camera views from your source image." image="/mobile_lightmod.webp" />
          <WorkflowCard href="/app/ai-video-generator" title={"Image \u2192 Video"} description="Create a short presentation video from an image." image="/hero.webp" />
          <WorkflowCard href="/app/3d-generator" title={"Image \u2192 3D"} description="Turn an image into a 3D asset." image="/mobile_hero.webp" />
        </div>
      </section>

      <section aria-labelledby="recent-work-title" className="space-y-4">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 id="recent-work-title" className="text-lg font-semibold tracking-tight">Recent Work</h2>
            <p className="mt-1 text-sm text-muted-foreground">Your latest generated assets.</p>
          </div>
          <Button asChild variant="ghost" size="sm" className="shrink-0 gap-1 text-muted-foreground">
            <Link href="/app/projects?view=assets">View all assets<ArrowRight className="h-3.5 w-3.5" /></Link>
          </Button>
        </div>
        {assets === null ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-6">
            {Array.from({ length: 6 }).map((_, index) => <Skeleton key={index} className="aspect-[4/3] w-full rounded-lg" />)}
          </div>
        ) : assets.length === 0 ? (
          <div className="flex flex-col items-start gap-2 rounded-lg border border-dashed px-5 py-6">
            <p className="text-sm font-medium">Your recent work will appear here.</p>
            <p className="text-sm text-muted-foreground">Start with a render and find your outputs here.</p>
            <Button asChild variant="outline" size="sm" className="mt-1">
              <Link href="/app/ai-image-generator"><ImageIcon className="mr-1.5 h-4 w-4" />Create a render</Link>
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {assets.map((asset) => <AssetCard key={asset.id} asset={asset} onChanged={fetchAssets} />)}
          </div>
        )}
      </section>
    </main>
  );
}