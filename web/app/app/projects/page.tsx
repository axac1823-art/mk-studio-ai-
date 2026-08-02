"use client";

// Page "All projects" — point d'entrée du modèle Projects/Assets. La carte
// "New project" se transforme en formulaire inline (même pattern que le
// ProjectPicker du studio) puis POST + refetch pour garder la grille à jour.
import { useCallback, useEffect, useState } from "react";
import { Plus } from "lucide-react";

import { ProjectCard, type ProjectSummary } from "@/components/projects/project-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function ProjectsPage() {
  const [projects, setProjects] = useState<ProjectSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

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

  useEffect(() => {
    void fetchProjects();
  }, [fetchProjects]);

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
    } catch {
      setError("Could not delete the project.");
    }
  };

  return (
    <main className="flex min-h-screen w-full flex-col gap-5 p-4 sm:p-6">
      <header>
        <h1 className="text-xl font-semibold tracking-tight">All projects</h1>
        <p className="text-sm text-muted-foreground">
          Your generations, organized by project.
        </p>
      </header>

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      {projects === null ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="aspect-[4/3] w-full" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {projects.map((project) => (
            <ProjectCard key={project.id} project={project} onDelete={deleteProject} />
          ))}

          <Card className="overflow-hidden">
            {creating ? (
              <CardContent className="flex aspect-[4/3] flex-col justify-center gap-2 p-3">
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
                className="flex aspect-[4/3] w-full flex-col items-center justify-center gap-2 text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground"
              >
                <Plus className="h-6 w-6" />
                <span className="text-sm font-medium">New project</span>
              </button>
            )}
          </Card>
        </div>
      )}
    </main>
  );
}
