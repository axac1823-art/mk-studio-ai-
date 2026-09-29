"use client";

// Carte projet (grille Projects et résultats de Search). La cover occupe
// toute la hauteur de la carte avec un overlay dégradé pour le nom et le
// compteur d'assets. Sans cover, un placeholder clair affiche le nom et
// l'icône. Le bouton Delete apparaît au hover en haut à droite.
import Link from "next/link";
import { ImageIcon, Trash2 } from "lucide-react";

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
  /** Appelé après confirmation — la page refetch sa liste. */
  onDelete?: (projectId: string) => void;
  layout?: "grid" | "list";
}

export function ProjectCard({ project, onDelete, layout = "grid" }: ProjectCardProps) {
  const hasCover = Boolean(project.coverUrl);

  return (
    <Card className={cn("group relative overflow-hidden transition-all hover:ring-1 hover:ring-foreground/20", layout === "list" && "flex min-h-32 flex-row")}>
      <Link href={`/app/projects/${project.id}`} className={cn("block", layout === "list" && "flex flex-1")}>
        <div className={cn("relative overflow-hidden bg-muted", layout === "list" ? "w-40 shrink-0 sm:w-56" : "aspect-[4/3]")}>
          {hasCover ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={project.coverUrl!}
                alt=""
                className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 p-3">
                <p className="truncate text-base font-semibold text-white">{project.name}</p>
                {project.assetCount === 0 ? (
                  <p className="text-xs text-white/90">Generate your first render</p>
                ) : (
                  <p className="text-xs text-white/80">{project.assetCount} assets</p>
                )}
              </div>
            </>
          ) : (
            <div className={cn("flex h-full w-full flex-col items-center justify-center gap-3 bg-muted p-4 text-center text-muted-foreground", layout === "list" && "min-h-32")}>
              <ImageIcon className="h-10 w-10" />
              <div>
                <p className="truncate text-base font-semibold text-foreground">{project.name}</p>
                {project.assetCount === 0 ? (
                  <p className="text-xs text-primary">Generate your first render</p>
                ) : (
                  <p className="text-xs text-muted-foreground">{project.assetCount} assets</p>
                )}
              </div>
            </div>
          )}
        </div>
      </Link>

      {onDelete && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="absolute right-2 top-2 h-8 w-8 bg-black/40 text-white/90 opacity-0 transition-opacity hover:bg-black/60 hover:text-white group-hover:opacity-100"
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            if (window.confirm(`Delete project "${project.name}" and all its assets? This cannot be undone.`)) {
              onDelete(project.id);
            }
          }}
          aria-label="Delete project"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      )}
    </Card>
  );
}
