"use client";

import Link from "next/link";
import { ArrowUpRight, FolderOpen, MoreHorizontal, Trash2 } from "lucide-react";

import type { ProjectSummary } from "@/components/projects/project-card";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export interface ProjectLibraryItem extends ProjectSummary {
  updatedAt?: string;
}

interface ProjectLibraryCardProps {
  project: ProjectLibraryItem;
  deleting?: boolean;
  onDelete: () => void;
}

function formatUpdatedAt(value?: string): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return null;
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" }).format(date);
}

export function ProjectLibraryCard({ project, deleting = false, onDelete }: ProjectLibraryCardProps) {
  const updatedLabel = formatUpdatedAt(project.updatedAt);

  return (
    <Card className="group relative min-w-0 overflow-hidden border-border bg-card transition-[border-color,box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:border-foreground/20 hover:shadow-lg hover:shadow-black/5">
      <div className="relative">
        <Link
          href={`/app/projects/${project.id}`}
          aria-label={`Open project ${project.name}`}
          className="relative block aspect-[4/3] overflow-hidden bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
        >
          {project.coverUrl ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={project.coverUrl}
                alt=""
                loading="lazy"
                className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.035]"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-black/10 opacity-80 transition-opacity group-hover:opacity-100" />
            </>
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-gradient-to-br from-muted via-background to-muted/70 p-6 text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-border/80 bg-background/80 text-muted-foreground shadow-sm">
                <FolderOpen className="h-5 w-5" />
              </span>
              <span className="max-w-[85%] text-xs text-muted-foreground">No cover image yet</span>
            </div>
          )}
          <span className={cn(
            "absolute left-3 top-3 inline-flex items-center rounded-full border border-white/15 bg-black/35 px-2.5 py-1 text-[11px] font-medium text-white shadow-sm backdrop-blur-md",
            !project.coverUrl && "border-border/70 bg-background/80 text-muted-foreground",
          )}>
            {project.assetCount} {project.assetCount === 1 ? "asset" : "assets"}
          </span>
          <span className="absolute bottom-3 right-3 inline-flex items-center gap-1 rounded-full bg-background/90 px-3 py-1.5 text-xs font-medium text-foreground opacity-0 shadow-sm backdrop-blur transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
            Open project <ArrowUpRight className="h-3.5 w-3.5" />
          </span>
        </Link>

        <div className="absolute right-2 top-2 z-10">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" variant="ghost" size="icon" disabled={deleting} className="h-8 w-8 border border-white/15 bg-black/35 text-white shadow-sm backdrop-blur-md hover:bg-black/60 hover:text-white" aria-label={`More actions for ${project.name}`}>
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={onDelete} disabled={deleting}>
                <Trash2 className="mr-2 h-4 w-4" />Delete project
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="flex min-w-0 items-center justify-between gap-3 p-4">
        <div className="min-w-0 flex-1">
          <Link href={`/app/projects/${project.id}`} className="block rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <h2 className="truncate text-sm font-semibold tracking-tight transition-colors group-hover:text-foreground">{project.name}</h2>
          </Link>
          <p className="mt-1 truncate text-xs text-muted-foreground">
            {updatedLabel ? `Updated ${updatedLabel}` : project.assetCount === 0 ? "Ready for your first asset" : "Project workspace"}
          </p>
        </div>
        <Button asChild size="icon" variant="outline" className="h-9 w-9 shrink-0 rounded-lg" aria-label={`Open project ${project.name}`}>
          <Link href={`/app/projects/${project.id}`}><ArrowUpRight className="h-4 w-4" /></Link>
        </Button>
      </div>
    </Card>
  );
}
