"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Image as ImageIcon, Wand2 } from "lucide-react";

import { AssetCard, type AssetSummary } from "@/components/projects/asset-card";
import { ProjectCard, type ProjectSummary } from "@/components/projects/project-card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ToolPickerPopover } from "@/components/navigation/ToolPickerPopover";
import { WorkflowCard } from "@/components/dashboard/workflow-card";

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 6) return "Good night";
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

const WORKFLOWS = [
  { title: "Render", description: "Create a visual render from your source.", href: "/app/ai-image-generator", image: "/image-960.webp" },
  { title: "Plan → Render", description: "Turn a floor plan into a visualization.", href: "/app/plan-to-render", image: "/appartment.webp" },
  { title: "Change Atmosphere", description: "Explore different lighting and mood.", href: "/app/ambiance-change", image: "/hero.webp" },
  { title: "Multi-Angle", description: "Generate additional design views.", href: "/app/multi-angle", image: "/image.webp" },
  { title: "Image → Video", description: "Animate an architectural image.", href: "/app/ai-video-generator", image: "/hero_white.webp" },
  { title: "Image → 3D", description: "Create a 3D asset from an image.", href: "/app/3d-generator", image: "/mobile_hero.webp" },
] as const;

export function DashboardContent() {
  const [greeting, setGreeting] = useState("Good morning");
  const [projects, setProjects] = useState<ProjectSummary[] | null>(null);
  const [assets, setAssets] = useState<AssetSummary[] | null>(null);
  const [projectError, setProjectError] = useState<string | null>(null);
  const [assetError, setAssetError] = useState<string | null>(null);

  const fetchProjects = useCallback(async () => {
    try {
      const res = await fetch("/api/projects");
      if (!res.ok) throw new Error("HTTP " + res.status);
      const data = (await res.json()) as { projects: ProjectSummary[] };
      setProjects(data.projects);
      setProjectError(null);
    } catch {
      setProjectError("Unable to load projects");
    }
  }, []);

  const fetchAssets = useCallback(async () => {
    try {
      const res = await fetch("/api/assets");
      if (!res.ok) throw new Error("HTTP " + res.status);
      const data = (await res.json()) as { assets: AssetSummary[] };
      setAssets(data.assets.slice().reverse().slice(0, 6));
      setAssetError(null);
    } catch {
      setAssetError("Unable to load recent work");
    }
  }, []);

  useEffect(() => {
    setGreeting(getGreeting());
    void fetchProjects();
    void fetchAssets();
  }, [fetchProjects, fetchAssets]);

  const recentProjects = projects?.slice(0, 3) ?? [];

  return (
    <main className="w-full px-4 py-6 sm:px-6 lg:px-8 xl:px-10">
      <div className="flex w-full flex-col">
        <section aria-labelledby="home-greeting" className="pb-6">
          <h1 id="home-greeting" className="text-2xl font-semibold tracking-tight sm:text-[26px]">
            {greeting}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Continue where you left off or start something new.
          </p>
        </section>

        <section aria-labelledby="continue-working" className="space-y-3">
          <SectionHeader title="Continue Working" href="/app/projects" />
          {projectError ? (
            <InlineState message={projectError} onAction={() => void fetchProjects()} />
          ) : projects === null ? (
            <div className="flex gap-4 overflow-x-auto pb-1 sm:grid sm:grid-cols-2 sm:overflow-visible xl:grid-cols-3">
              {Array.from({ length: 3 }).map((_, index) => (
                <div key={index} className="min-w-[280px] shrink-0 overflow-hidden rounded-xl border bg-card sm:min-w-0">
                  <Skeleton className="aspect-[16/9] w-full rounded-none" />
                  <div className="space-y-2 p-3.5">
                    <Skeleton className="h-4 w-2/3" />
                    <Skeleton className="h-3 w-1/3" />
                  </div>
                </div>
              ))}
            </div>
          ) : recentProjects.length === 0 ? (
            <div className="flex min-h-32 flex-col items-start justify-center gap-3 rounded-xl border bg-card px-5 py-5">
              <div>
                <p className="text-sm font-semibold">Start your first project</p>
                <p className="mt-1 max-w-lg text-xs leading-5 text-muted-foreground">
                  Create a project to keep your renders, videos and assets together.
                </p>
              </div>
              <Button asChild size="sm">
                <Link href="/app/projects">Create project</Link>
              </Button>
            </div>
          ) : (
            <div className="flex gap-4 overflow-x-auto pb-1 sm:grid sm:grid-cols-2 sm:overflow-visible xl:grid-cols-3">
              {recentProjects.map((project) => (
                <div key={project.id} className="min-w-[280px] shrink-0 sm:min-w-0">
                  <ProjectCard project={project} layout="grid" home />
                </div>
              ))}
            </div>
          )}
        </section>

        <section aria-labelledby="start-workflow" className="mt-8 space-y-3">
          <WorkflowSectionHeader />
          <div className="flex gap-3 overflow-x-auto pb-1 sm:grid sm:grid-cols-2 sm:overflow-visible xl:grid-cols-3 xl:gap-4">
            {WORKFLOWS.map((workflow) => (
              <div key={workflow.href} className="min-w-[280px] shrink-0 sm:min-w-0">
                <WorkflowCard {...workflow} />
              </div>
            ))}
          </div>
        </section>

        <section aria-labelledby="recent-work" className="mt-8 space-y-3 pb-8">
          <SectionHeader title="Recent Work" href="/app/projects" />
          {assetError ? (
            <InlineState message={assetError} onAction={() => void fetchAssets()} />
          ) : assets === null ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
              {Array.from({ length: 6 }).map((_, index) => (
                <Skeleton key={index} className="aspect-[4/3] w-full rounded-xl" />
              ))}
            </div>
          ) : assets.length === 0 ? (
            <div className="flex min-h-32 flex-col items-center justify-center gap-3 rounded-xl border bg-card px-5 py-8 text-center">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted">
                <Wand2 className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm font-semibold">No work yet</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Your generated images and videos will appear here.
                </p>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-2">
                <Button asChild size="sm">
                  <Link href="/app/ai-image-generator">
                    <ImageIcon className="mr-1.5 h-4 w-4" />
                    Start a Render
                  </Link>
                </Button>
                <ToolPickerPopover defaultTab="image" placement="bottom">
                  <button type="button" className="inline-flex h-9 items-center justify-center rounded-md border bg-background px-3 text-sm font-medium transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                    Explore tools
                  </button>
                </ToolPickerPopover>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
              {assets.map((asset) => (
                <AssetCard key={asset.id} asset={asset} onChanged={fetchAssets} compact />
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function SectionHeader({ title, href }: { title: string; href: string }) {
  return (
    <div className="flex items-center justify-between">
      <h2 className="text-sm font-semibold tracking-wide">{title}</h2>
      <Link
        href={href}
        className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        View all
        <ArrowRight className="h-3.5 w-3.5" />
      </Link>
    </div>
  );
}

function WorkflowSectionHeader() {
  return (
    <div className="flex items-center justify-between">
      <h2 className="text-sm font-semibold tracking-wide">Start a Workflow</h2>
      <ToolPickerPopover defaultTab="image" placement="bottom">
        <button
          type="button"
          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          View all
          <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </ToolPickerPopover>
    </div>
  );
}

function InlineState({ message, onAction }: { message: string; onAction: () => void }) {
  return (
    <div className="flex min-h-24 items-center justify-between rounded-xl border bg-card px-4 py-3 sm:px-5">
      <p role="alert" className="text-sm text-muted-foreground">{message}</p>
      <Button type="button" variant="outline" size="sm" onClick={onAction}>
        Retry
      </Button>
    </div>
  );
}