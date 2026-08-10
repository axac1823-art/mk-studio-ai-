"use client";

// Contenu du dashboard, partagé entre /app/dashboard et la landing page.
// Affiche un greeting, une barre de recherche, une ligne de catégories,
// puis les panneaux Projects et Recent work.
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  FolderOpen,
  Image as ImageIcon,
  Mic,
  Plus,
  Video,
  Wand2,
} from "lucide-react";

import { AssetCard, type AssetSummary } from "@/components/projects/asset-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { DashboardSearch } from "@/components/navigation/DashboardSearch";
import { ToolPickerPopover } from "@/components/navigation/ToolPickerPopover";
import { cn } from "@/lib/utils";

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
}

function CategoryTrigger({
  icon: Icon,
  label,
  colorClass,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  colorClass: string;
}) {
  return (
    <div className="flex flex-col items-center gap-2">
      <div
        className={cn(
          "flex h-14 w-14 items-center justify-center rounded-2xl transition-transform hover:scale-105",
          colorClass
        )}
      >
        <Icon className="h-7 w-7" />
      </div>
      <span className="text-sm font-medium text-muted-foreground">{label}</span>
    </div>
  );
}

export function DashboardContent() {
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
      setAssets(data.assets.slice().reverse().slice(0, 4));
    } catch {
      setError("Could not load recent work.");
    }
  }, []);

  useEffect(() => {
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

  const greeting = `${getGreeting()}, start creating!`;
  const recentProjects = projects?.slice(0, 5) ?? [];

  return (
    <main className="flex min-h-screen w-full flex-col gap-8 px-4 py-6 sm:px-6 lg:px-8">
      <div className="flex w-full flex-col items-center gap-8">
        <h1 className="text-center text-3xl font-semibold tracking-tight sm:text-4xl">{greeting}</h1>

        <DashboardSearch />

        <div className="flex flex-wrap items-center justify-center gap-6 sm:gap-8">
          <ToolPickerPopover category="image">
            <CategoryTrigger icon={ImageIcon} label="Image" colorClass="bg-indigo-500/15 text-indigo-400" />
          </ToolPickerPopover>

          <ToolPickerPopover category="video">
            <CategoryTrigger icon={Video} label="Video" colorClass="bg-emerald-500/15 text-emerald-400" />
          </ToolPickerPopover>

          <ToolPickerPopover category="audio">
            <CategoryTrigger icon={Mic} label="Audio" colorClass="bg-violet-500/15 text-violet-400" />
          </ToolPickerPopover>

          <Link href="/app/projects" className="flex flex-col items-center gap-2">
            <CategoryTrigger
              icon={FolderOpen}
              label="Projects"
              colorClass="bg-amber-500/15 text-amber-400"
            />
          </Link>
        </div>
      </div>

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      <div className="grid w-full max-w-5xl gap-6 self-center lg:grid-cols-2">
        <Card className="flex flex-col">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Projects</CardTitle>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setCreating(true)}
              aria-label="Create new project"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {creating && (
              <div className="flex items-center gap-2">
                <Input
                  autoFocus
                  type="text"
                  value={newProjectName}
                  onChange={(event) => setNewProjectName(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") void createProject();
                    if (event.key === "Escape") {
                      setCreating(false);
                      setNewProjectName("");
                    }
                  }}
                  placeholder="Project name"
                  className="h-9 flex-1"
                />
                <Button
                  type="button"
                  size="sm"
                  disabled={!newProjectName.trim() || createBusy}
                  onClick={() => void createProject()}
                >
                  Create
                </Button>
              </div>
            )}

            <Link
              href="/app/projects"
              className="flex items-center gap-3 rounded-md p-2 transition-colors hover:bg-accent"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-md bg-yellow-500/20">
                <span className="text-sm font-semibold text-yellow-500">P</span>
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-medium">Personal</span>
                <span className="text-xs text-muted-foreground">Your private space</span>
              </div>
            </Link>

            {projects === null ? (
              <Skeleton className="h-10 w-full" />
            ) : (
              recentProjects.map((project) => (
                <Link
                  key={project.id}
                  href={`/app/projects/${project.id}`}
                  className="flex items-center gap-3 rounded-md p-2 transition-colors hover:bg-accent"
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-md bg-muted">
                    <FolderOpen className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="min-w-0 flex-1 flex-col">
                    <span className="truncate text-sm font-medium">{project.name}</span>
                    <span className="text-xs text-muted-foreground p-4">{project.assetCount} assets</span>
                  </div>
                </Link>
              ))
            )}

            <Button
              asChild
              variant="ghost"
              className="mt-1 w-full justify-start gap-2 text-muted-foreground"
            >
              <Link href="/app/projects">
                <FolderOpen className="h-4 w-4" />
                View all projects
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="flex flex-col">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Recent work</CardTitle>
            <Button asChild variant="ghost" size="sm" className="h-8 gap-1 text-muted-foreground">
              <Link href="/app/projects">
                Browse all
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col justify-center">
            {assets === null ? (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {Array.from({ length: 4 }).map((_, index) => (
                  <Skeleton key={index} className="aspect-[4/3] w-full" />
                ))}
              </div>
            ) : assets.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted">
                  <Wand2 className="h-6 w-6 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm font-medium">Start a new generation</p>
                  <p className="text-xs text-muted-foreground">
                    Generate your first render to see it here.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button asChild variant="outline" size="sm">
                    <Link href="/app/ai-image-generator">
                      <ImageIcon className="mr-1 h-4 w-4" />
                      Image
                    </Link>
                  </Button>
                  <Button asChild variant="outline" size="sm">
                    <Link href="/app/ai-video-generator">
                      <Video className="mr-1 h-4 w-4" />
                      Video
                    </Link>
                  </Button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {assets.map((asset) => (
                  <AssetCard key={asset.id} asset={asset} onChanged={fetchAssets} />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
