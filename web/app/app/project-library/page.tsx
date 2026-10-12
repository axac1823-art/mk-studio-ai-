"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowDownAZ, Clock3, FolderOpen, Loader2, Plus, Search, X } from "lucide-react";

import { ProjectLibraryCard, type ProjectLibraryItem } from "../../../components/projects/project-library-card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

type SortMode = "recent" | "name" | "assets";

export default function ProjectLibraryPage() {
  const [projects, setProjects] = useState<ProjectLibraryItem[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [sortMode, setSortMode] = useState<SortMode>("recent");
  const [creatingOpen, setCreatingOpen] = useState(false);
  const [projectName, setProjectName] = useState("");
  const [creating, setCreating] = useState(false);
  const [deletingProjectId, setDeletingProjectId] = useState<string | null>(null);

  const fetchProjects = useCallback(async () => {
    setLoadError(null);
    try {
      const response = await fetch("/api/projects", { cache: "no-store" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = (await response.json()) as { projects?: ProjectLibraryItem[] };
      setProjects(Array.isArray(data.projects) ? data.projects : []);
    } catch {
      setProjects([]);
      setLoadError("We couldn’t load your projects. Check your connection and try again.");
    }
  }, []);

  useEffect(() => {
    void fetchProjects();
  }, [fetchProjects]);

  const visibleProjects = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    const filtered = (projects ?? []).filter((project) =>
      project.name.toLocaleLowerCase().includes(normalizedQuery),
    );

    return filtered.sort((a, b) => {
      if (sortMode === "name") return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
      if (sortMode === "assets") return b.assetCount - a.assetCount || a.name.localeCompare(b.name);
      const aTime = a.updatedAt ? Date.parse(a.updatedAt) : 0;
      const bTime = b.updatedAt ? Date.parse(b.updatedAt) : 0;
      return (Number.isFinite(bTime) ? bTime : 0) - (Number.isFinite(aTime) ? aTime : 0);
    });
  }, [projects, query, sortMode]);

  const createProject = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const name = projectName.trim();
    if (!name || creating) return;

    setCreating(true);
    setActionError(null);
    try {
      const response = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = (await response.json().catch(() => ({}))) as { error?: string; project?: { id?: string } };
      if (!response.ok) throw new Error(data.error ?? "Couldn’t create this project.");

      setProjectName("");
      setCreatingOpen(false);
      await fetchProjects();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Couldn’t create this project.");
    } finally {
      setCreating(false);
    }
  };

  const deleteProject = async (project: ProjectLibraryItem) => {
    const confirmed = window.confirm(`Delete project “${project.name}” and all its assets? This cannot be undone.`);
    if (!confirmed || deletingProjectId) return;

    setDeletingProjectId(project.id);
    setActionError(null);
    try {
      const response = await fetch(`/api/projects/${project.id}`, { method: "DELETE" });
      if (!response.ok) throw new Error("Couldn’t delete this project.");
      setProjects((current) => current?.filter((item) => item.id !== project.id) ?? []);
    } catch {
      setActionError("Couldn’t delete this project. Please try again.");
    } finally {
      setDeletingProjectId(null);
    }
  };

  return (
    <main className="mx-auto min-h-[calc(100vh-3.5rem)] w-full max-w-[1600px] px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      <div className="mx-auto flex w-full flex-col gap-6">
        <header className="flex flex-col gap-4 border-b border-border pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <div className="mb-3 flex items-center gap-2 text-xs text-muted-foreground">
              <Link href="/app/dashboard" className="transition-colors hover:text-foreground">Workspace</Link>
              <span aria-hidden="true" className="text-muted-foreground/50">/</span>
              <span className="text-foreground">All projects</span>
            </div>
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">All projects</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              Keep every architectural study, interior concept, and visualization together in one place.
            </p>
          </div>
          <Button type="button" onClick={() => { setCreatingOpen((open) => !open); setActionError(null); }} className="h-10 shrink-0 gap-2">
            {creatingOpen ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            {creatingOpen ? "Cancel" : "New project"}
          </Button>
        </header>

        {creatingOpen && (
          <form onSubmit={createProject} className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 sm:flex-row sm:items-end sm:p-5">
            <div className="min-w-0 flex-1">
              <label htmlFor="project-library-name" className="mb-1.5 block text-sm font-medium">Project name</label>
              <input
                id="project-library-name"
                autoFocus
                maxLength={120}
                value={projectName}
                onChange={(event) => setProjectName(event.target.value)}
                onKeyDown={(event) => { if (event.key === "Escape" && !creating) setCreatingOpen(false); }}
                placeholder="e.g. Villa Marrakech — Exterior studies"
                className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none transition-shadow placeholder:text-muted-foreground/75 focus-visible:ring-2 focus-visible:ring-ring"
                required
              />
              <p className="mt-1.5 text-xs text-muted-foreground">Use a project per client, property, or design study.</p>
            </div>
            <Button type="submit" disabled={!projectName.trim() || creating} className="h-10 min-w-32 gap-2">
              {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              {creating ? "Creating…" : "Create project"}
            </Button>
          </form>
        )}

        {(actionError || loadError) && (
          <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-destructive/25 bg-destructive/5 px-4 py-3 text-sm">
            <span className="text-destructive">{actionError ?? loadError}</span>
            {loadError && <Button type="button" size="sm" variant="outline" onClick={() => void fetchProjects()}>Try again</Button>}
          </div>
        )}

        <section aria-label="Project library" className="flex flex-col gap-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center gap-2 text-sm text-muted-foreground">
              <FolderOpen className="h-4 w-4 shrink-0" />
              <span className="font-medium text-foreground">{projects === null ? "Loading projects" : `${projects.length} ${projects.length === 1 ? "project" : "projects"}`}</span>
              {query.trim() && projects !== null && <span>· {visibleProjects.length} matching</span>}
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <label className="relative block min-w-0 sm:w-72">
                <span className="sr-only">Search projects</span>
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search projects…"
                  className="h-10 w-full rounded-lg border border-input bg-background pl-9 pr-9 text-sm outline-none transition-shadow placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
                />
                {query && (
                  <button type="button" aria-label="Clear project search" onClick={() => setQuery("")} className="absolute right-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground">
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </label>
              <label className="flex h-10 items-center gap-2 rounded-lg border border-input bg-background px-3 text-sm">
                {sortMode === "name" ? <ArrowDownAZ className="h-4 w-4 text-muted-foreground" /> : <Clock3 className="h-4 w-4 text-muted-foreground" />}
                <span className="sr-only">Sort projects</span>
                <select value={sortMode} onChange={(event) => setSortMode(event.target.value as SortMode)} className="min-w-0 bg-transparent pr-1 text-sm outline-none">
                  <option value="recent">Recently updated</option>
                  <option value="name">Name A–Z</option>
                  <option value="assets">Most assets</option>
                </select>
              </label>
            </div>
          </div>

          {projects === null ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
              {Array.from({ length: 8 }).map((_, index) => <Skeleton key={index} className="aspect-[4/3] w-full rounded-xl" />)}
            </div>
          ) : loadError ? null : projects.length === 0 ? (
            <div className="flex min-h-[320px] flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card/50 px-6 py-12 text-center">
              <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl border bg-background text-muted-foreground"><FolderOpen className="h-5 w-5" /></span>
              <h2 className="text-base font-semibold">Your work starts with a project</h2>
              <p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">Create a project for a property, client, or design concept. Your saved work can stay organized here.</p>
              <Button type="button" onClick={() => setCreatingOpen(true)} className="mt-5 gap-2"><Plus className="h-4 w-4" />Create your first project</Button>
            </div>
          ) : visibleProjects.length === 0 ? (
            <div className="flex min-h-[240px] flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card/40 px-6 py-10 text-center">
              <Search className="mb-3 h-5 w-5 text-muted-foreground" />
              <h2 className="text-sm font-semibold">No projects match your search</h2>
              <p className="mt-1 text-sm text-muted-foreground">Try a different name or clear the search.</p>
              <Button type="button" variant="outline" size="sm" className="mt-4 gap-1.5" onClick={() => setQuery("")}><X className="h-3.5 w-3.5" />Clear search</Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
              {visibleProjects.map((project) => (
                <ProjectLibraryCard key={project.id} project={project} deleting={deletingProjectId === project.id} onDelete={() => void deleteProject(project)} />
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
