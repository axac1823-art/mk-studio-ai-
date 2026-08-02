"use client";

// Carte projet (grilles Projects et résultats de Search). La cover vient
// de l'API ; sans cover on affiche un placeholder gradient pour garder une
// grille visuellement régulière. Le bouton Delete est intégré dans la carte
// et stoppe la propagation pour ne pas ouvrir le projet.
import Link from "next/link";
import { Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

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
}

export function ProjectCard({ project, onDelete }: ProjectCardProps) {
  return (
    <Card className="group overflow-hidden transition-colors hover:border-foreground/25">
      <Link href={`/app/projects/${project.id}`} className="block">
        <div className="aspect-[4/3] bg-muted">
          {project.coverUrl ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={project.coverUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="h-full w-full bg-gradient-to-br from-zinc-700/50 via-zinc-800/40 to-zinc-950/80" />
          )}
        </div>
        <CardContent className="p-3">
          <p className="truncate text-sm font-medium">{project.name}</p>
          <p className="text-xs text-muted-foreground">{project.assetCount} assets</p>
        </CardContent>
      </Link>
      {onDelete && (
        <div className="border-t px-3 py-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 w-full justify-start gap-2 text-destructive hover:text-destructive"
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              if (window.confirm(`Delete project "${project.name}" and all its assets? This cannot be undone.`)) {
                onDelete(project.id);
              }
            }}
          >
            <Trash2 className="h-4 w-4" />
            Delete
          </Button>
        </div>
      )}
    </Card>
  );
}
