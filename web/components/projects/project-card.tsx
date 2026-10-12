"use client";

import Link from "next/link";
import { ArrowUpRight, FolderOpen, Image as ImageIcon, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export interface ProjectSummary {
  id: string;
  name: string;
  coverUrl: string | null;
  assetCount: number;
}

interface ProjectCardProps {
  project: ProjectSummary;
  /** Called after the user confirms permanent project deletion. */
  onDelete?: (projectId: string) => void;
  layout?: "grid" | "list";
}

export function ProjectCard({ project, onDelete, layout = "grid" }: ProjectCardProps) {
  const hasCover = Boolean(project.coverUrl);
  const assetLabel = `${project.assetCount} ${project.assetCount === 1 ? "asset" : "assets"}`;

  return (
    <Card
      className={cn(
        "group relative min-w-0 overflow-hidden border-border/80 bg-card shadow-sm transition-[border-color,box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:border-border hover:shadow-md",
        layout === "list" && "flex min-h-32 flex-row hover:translate-y-0",
      )}
    >
      <Link
        href={`/app/projects/${project.id}`}
        className={cn(
          "relative block min-w-0 overflow-hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
          layout === "list" ? "flex min-h-32 flex-1" : "aspect-[4/3]",
        )}
        aria-label={`Open project ${project.name}`}
      >
        <div className={cn("relative h-full min-w-0 overflow-hidden", layout === "list" ? "min-h-32 w-full" : "w-full")}> 
          {hasCover ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={project.coverUrl!}
                alt=""
                className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.025]"
                loading="lazy"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/15 to-transparent" />
            </>
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-muted via-muted/70 to-accent/40">
              <div className="absolute -right-8 -top-10 h-36 w-36 rounded-full border border-foreground/5" />
              <div className="absolute -right-2 -top-4 h-24 w-24 rounded-full border border-foreground/5" />
            </div>
          )}

          <div className={cn("absolute inset-x-0 bottom-0 flex items-end gap-3 p-3.5", !hasCover && "text-foreground")}>
            <span className={cn(
              "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border",
              hasCover ? "border-white/20 bg-black/25 text-white backdrop-blur-md" : "border-border bg-background/80 text-muted-foreground",
            )}>
              {hasCover ? <FolderOpen className="h-4 w-4" /> : <ImageIcon className="h-4 w-4" />}
            </span>
            <div className="min-w-0 flex-1">
              <p className={cn("truncate text-sm font-semibold tracking-tight", hasCover && "text-white")}>{project.name}</p>
              <p className={cn("mt-1 text-xs", hasCover ? "text-white/75" : "text-muted-foreground")}>
                {project.assetCount === 0 ? "Ready for your first render" : assetLabel}
              </p>
            </div>
            <span className={cn(
              "mb-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full transition-all",
              hasCover ? "bg-white/15 text-white opacity-0 group-hover:translate-x-0.5 group-hover:opacity-100" : "bg-background/70 text-muted-foreground opacity-70 group-hover:text-foreground",
            )} aria-hidden="true">
              <ArrowUpRight className="h-3.5 w-3.5" />
            </span>
          </div>
        </div>
      </Link>

      {onDelete && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="absolute right-2 top-2 z-10 h-8 w-8 border border-white/15 bg-black/45 text-white opacity-100 shadow-sm backdrop-blur-md transition-opacity hover:bg-destructive hover:text-white focus-visible:opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            if (window.confirm(`Delete project "${project.name}" and all its assets? This cannot be undone.`)) {
              onDelete(project.id);
            }
          }}
          aria-label={`Delete project ${project.name}`}
          title="Delete project"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      )}
    </Card>
  );
}
