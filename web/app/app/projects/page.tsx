"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  FolderOpen,
  Image as ImageIcon,
  Plus,
  Trash2,
} from "lucide-react";

import type { ProjectSummary } from "@/components/projects/project-card";
import {
  AssetCard,
  type AssetSummary,
} from "@/components/projects/asset-card";
import { AssetSelectionToolbar } from "@/components/projects/asset-selection-toolbar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

type ViewMode = "overview" | "projects" | "assets" | "favorites";

type RecentAsset = AssetSummary & {
  projectId?: string | null;
  generationId?: string | null;
  createdAt?: string;
};

function ProjectCover({
  project,
}: {
  project: ProjectSummary;
}) {
  return (
    <div className="relative aspect-[16/9] overflow-hidden rounded-xl bg-muted">
      {project.coverUrl ? (
        <>
          <img
            src={project.coverUrl}
            alt=""
            className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.035]"
          />

          <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-transparent" />

          <div className="absolute left-3 top-3 flex h-7 w-7 items-center justify-center rounded-full bg-black/35 text-white backdrop-blur-sm">
            <FolderOpen className="h-3.5 w-3.5" />
          </div>

          <div className="absolute inset-x-0 bottom-0 p-3">
            <p className="truncate text-sm font-semibold text-white">
              {project.name}
            </p>

            <p className="mt-0.5 text-xs text-white/75">
              {project.assetCount}{" "}
              {project.assetCount === 1 ? "asset" : "assets"}
            </p>
          </div>
        </>
      ) : (
        <>
          <div className="absolute inset-0 bg-gradient-to-br from-muted to-muted/70" />

          <div className="absolute inset-0 flex items-center justify-center">
            <FolderOpen className="h-10 w-10 text-muted-foreground/50" />
          </div>

          <div className="absolute inset-x-0 bottom-0 p-3">
            <p className="truncate text-sm font-semibold">
              {project.name}
            </p>

            <p className="mt-0.5 text-xs text-muted-foreground">
              {project.assetCount}{" "}
              {project.assetCount === 1 ? "asset" : "assets"}
            </p>
          </div>
        </>
      )}
    </div>
  );
}

function ProjectCardItem({
  project,
  onDelete,
}: {
  project: ProjectSummary;
  onDelete?: (id: string) => void;
}) {
  return (
    <div className="group relative w-full min-w-0">
      <Link href={`/app/projects/${project.id}`} className="block">
        <ProjectCover project={project} />
      </Link>

      {onDelete && (
        <button
          type="button"
          aria-label={`Delete ${project.name}`}
          onClick={() => onDelete(project.id)}
          className="absolute bottom-2 right-2 z-20 hidden h-8 w-8 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur-sm hover:bg-destructive group-hover:flex"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

function NewProjectCard({
  creating,
  name,
  busy,
  onStart,
  onNameChange,
  onCreate,
  onCancel,
}: {
  creating: boolean;
  name: string;
  busy: boolean;
  onStart: () => void;
  onNameChange: (value: string) => void;
  onCreate: () => void;
  onCancel: () => void;
}) {
  if (creating) {
    return (
      <div className="w-full min-w-0">
        <div className="flex aspect-[16/9] flex-col justify-center gap-3 rounded-xl border bg-muted/40 p-4">
          <input
            autoFocus
            value={name}
            onChange={(event) => onNameChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") onCreate();
              if (event.key === "Escape") onCancel();
            }}
            placeholder="Project name"
            className="h-9 w-full rounded-md border bg-background px-3 text-sm outline-none focus:border-primary"
          />

          <div className="flex gap-2">
            <Button
              size="sm"
              className="flex-1"
              disabled={!name.trim() || busy}
              onClick={onCreate}
            >
              Create
            </Button>

            <Button
              size="sm"
              variant="ghost"
              onClick={onCancel}
              disabled={busy}
            >
              Cancel
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-[200px] shrink-0">
      <button
        type="button"
        onClick={onStart}
        className="flex aspect-[16/9] w-full flex-col items-center justify-center rounded-xl border border-dashed bg-muted/35 p-5 text-center transition-colors hover:bg-muted/70"
      >
        <span className="mb-3 flex h-9 w-9 items-center justify-center rounded-full bg-background shadow-sm">
          <Plus className="h-4 w-4" />
        </span>

        <span className="text-sm font-semibold">New project</span>

        <span className="mt-1 max-w-[150px] text-xs leading-5 text-muted-foreground">
          Create a project to organize your assets
        </span>
      </button>
    </div>
  );
}

function SectionHeader({
  title,
  count,
}: {
  title: string;
  count?: number;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-muted-foreground">{title}</span>
        {typeof count === "number" && (
          <span className="text-xs text-muted-foreground/60">{count}</span>
        )}
      </div>
    </div>
  );
}

function EmptyState({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="flex min-h-[280px] items-center justify-center rounded-xl border border-dashed bg-muted/20">
      <div className="max-w-sm text-center">
        <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-muted">
          {icon}
        </div>

        <h2 className="text-sm font-semibold">{title}</h2>

        <p className="mt-1 text-sm text-muted-foreground">
          {description}
        </p>
      </div>
    </div>
  );
}

export default function ProjectsPage() {
  const searchParams = useSearchParams();

  const rawView = searchParams.get("view");

  const view: ViewMode =
    rawView === "overview" ||
    rawView === "assets" ||
    rawView === "favorites"
      ? rawView
      : "projects";

  const [projects, setProjects] = useState<ProjectSummary[] | null>(null);
  const [assets, setAssets] = useState<RecentAsset[] | null>(null);
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);

  const [error, setError] = useState<string | null>(null);

  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);


  const fetchProjects = useCallback(async () => {
    try {
      const response = await fetch("/api/projects", {
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = (await response.json()) as {
        projects: ProjectSummary[];
      };

      setProjects(data.projects);
      setError(null);
    } catch {
      setError("Could not load projects.");
    }
  }, []);

  const fetchAssets = useCallback(async () => {
    try {
      const endpoint =
        view === "favorites"
          ? "/api/assets?favorite=1"
          : "/api/assets";

      const response = await fetch(endpoint, {
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = (await response.json()) as {
        assets: RecentAsset[];
      };

      setAssets(data.assets);
      setSelectedAssetId((current) =>
        current && data.assets.some((asset) => asset.id === current)
          ? current
          : null,
      );
      setError(null);
    } catch {
      setError("Could not load assets.");
    }
  }, [view]);

  useEffect(() => {
    setError(null);
    setCreating(false);
    setSelectedAssetId(null);

    if (view === "overview" || view === "projects") {
      void fetchProjects();
    } else {
      setProjects(null);
    }

    if (
      view === "overview" ||
      view === "assets" ||
      view === "favorites"
    ) {
      void fetchAssets();
    } else {
      setAssets(null);
    }
  }, [view, fetchProjects, fetchAssets]);

  const createProject = async () => {
    const trimmed = name.trim();

    if (!trimmed || busy) {
      return;
    }

    setBusy(true);

    try {
      const response = await fetch("/api/projects", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: trimmed,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

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
      const response = await fetch(`/api/projects/${id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      await fetchProjects();
    } catch {
      setError("Could not delete the project.");
    }
  };

  const recentProjects = useMemo(
    () => projects?.slice(0, 3) ?? [],
    [projects]
  );

  const recentAssets = useMemo(
    () => assets?.slice(0, 6) ?? [],
    [assets]
  );



  const pageTitle =
    view === "overview"
      ? "Projects"
      : view === "projects"
        ? "All projects"
        : view === "assets"
          ? "All assets"
          : "Favorites";

  const showCreateProject = view === "overview" || view === "projects";

  return (
    <main className="h-full min-h-0 w-full overflow-y-auto bg-background p-4 sm:p-6">
      <div className="mx-auto flex w-full max-w-screen-3xl flex-col gap-6 rounded-xl bg-panel-4 p-6">
        <header className="flex items-center justify-between gap-4">
          <h1 className="text-lg font-semibold tracking-tight">
            {pageTitle}
          </h1>

          {showCreateProject && (
            <Button
              type="button"
              size="sm"
              className="h-8 gap-1.5"
              onClick={() => setCreating(true)}
            >
              <Plus className="h-3.5 w-3.5" />
              Add
            </Button>
          )}
        </header>

        <nav aria-label="Project library views" className="flex flex-wrap items-center gap-2 border-b pb-3">
          {([
            { label: "All projects", href: "/app/projects?view=projects", active: view === "projects" },
            { label: "All assets", href: "/app/projects?view=assets", active: view === "assets" },
            { label: "Favorites", href: "/app/projects?view=favorites", active: view === "favorites" },
          ] as const).map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={item.active ? "page" : undefined}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                item.active
                  ? "bg-accent text-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground"
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        {error && (
          <p
            role="alert"
            className="text-sm text-destructive"
          >
            {error}
          </p>
        )}

        {selectedAssetId && assets && (
          <AssetSelectionToolbar
            asset={assets.find((asset) => asset.id === selectedAssetId) ?? null}
            onClear={() => setSelectedAssetId(null)}
          />
        )}

        {view === "overview" && (
          <>
            <section className="flex flex-col gap-3">
              <SectionHeader title="Recent projects" count={projects?.length} />

              {projects === null ? (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {Array.from({ length: 3 }).map((_, index) => (
                    <Skeleton key={index} className="aspect-[16/9] w-full rounded-xl" />
                  ))}
                </div>
              ) : recentProjects.length === 0 ? (
                <div className="max-w-md">
                  <NewProjectCard
                    creating={creating}
                    name={name}
                    busy={busy}
                    onStart={() => setCreating(true)}
                    onNameChange={setName}
                    onCreate={() => void createProject()}
                    onCancel={() => {
                      setCreating(false);
                      setName("");
                    }}
                  />
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  <NewProjectCard
                    creating={creating}
                    name={name}
                    busy={busy}
                    onStart={() => setCreating(true)}
                    onNameChange={setName}
                    onCreate={() => void createProject()}
                    onCancel={() => {
                      setCreating(false);
                      setName("");
                    }}
                  />
                  {recentProjects.map((project) => (
                    <ProjectCardItem key={project.id} project={project} />
                  ))}
                </div>
              )}
            </section>

            <section className="flex flex-col gap-3">
              <SectionHeader
                title="Recent assets"
                count={assets?.length}
              />

              {assets === null ? (
                <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-4">
                  {Array.from({ length: 8 }).map((_, index) => (
                    <Skeleton
                      key={index}
                      className="aspect-[16/9] w-full rounded-xl"
                    />
                  ))}
                </div>
              ) : recentAssets.length === 0 ? (
                <EmptyState
                  icon={
                    <ImageIcon className="h-5 w-5 text-muted-foreground" />
                  }
                  title="No recent assets"
                  description="Generated and uploaded assets will appear here."
                />
              ) : (
                <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-4">
                  {recentAssets.map((asset) => (
                    <AssetCard
                      key={asset.id}
                      asset={asset}
                      onChanged={() => void fetchAssets()}
                      selected={selectedAssetId === asset.id}
                      onSelect={() =>
                        setSelectedAssetId((current) => current === asset.id ? null : asset.id)
                      }
                    />
                  ))}
                </div>
              )}
            </section>
          </>
        )}

        {view === "projects" && (
          <section className="flex flex-col gap-4">
            {projects === null ? (
              <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-4">
                {Array.from({ length: 8 }).map((_, index) => (
                  <Skeleton
                    key={index}
                    className="aspect-square w-full rounded-xl"
                  />
                ))}
              </div>
            ) : (
              <>
                <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-4">
                  <NewProjectCard
                    creating={creating}
                    name={name}
                    busy={busy}
                    onStart={() => setCreating(true)}
                    onNameChange={setName}
                    onCreate={() => void createProject()}
                    onCancel={() => {
                      setCreating(false);
                      setName("");
                    }}
                  />

                  {projects.map((project) => (
                    <div
                      key={project.id}
                      className="w-full min-w-0"
                    >
                      <ProjectCardItem
                        project={project}
                        onDelete={(id) => void deleteProject(id)}
                      />
                    </div>
                  ))}
                </div>

                {projects.length === 0 && (
                  <EmptyState
                    icon={
                      <FolderOpen className="h-5 w-5 text-muted-foreground" />
                    }
                    title="No projects yet"
                    description="Create your first project to get started."
                  />
                )}
              </>
            )}
          </section>
        )}

        {view === "assets" && (
          <section className="flex flex-col gap-4">
            {assets === null ? (
              <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-4">
                {Array.from({ length: 12 }).map((_, index) => (
                  <Skeleton
                    key={index}
                    className="aspect-square w-full rounded-xl"
                  />
                ))}
              </div>
            ) : assets.length === 0 ? (
              <EmptyState
                icon={
                  <ImageIcon className="h-5 w-5 text-muted-foreground" />
                }
                title="No assets"
                description="Your images, videos, audio, and 3D assets will appear here."
              />
            ) : (
              <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-4">
                {assets.map((asset) => (
                  <AssetCard
                    key={asset.id}
                    asset={asset}
                    onChanged={() => void fetchAssets()}
                    selected={selectedAssetId === asset.id}
                    onSelect={() =>
                      setSelectedAssetId((current) => current === asset.id ? null : asset.id)
                    }
                  />
                ))}
              </div>
            )}
          </section>
        )}

        {view === "favorites" && (
          <section className="flex flex-col gap-4">
            {assets === null ? (
              <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-4">
                {Array.from({ length: 12 }).map((_, index) => (
                  <Skeleton
                    key={index}
                    className="aspect-square w-full rounded-xl"
                  />
                ))}
              </div>
            ) : assets.length === 0 ? (
              <EmptyState
                icon={
                  <span className="text-lg text-muted-foreground">
                    ★
                  </span>
                }
                title="No favorites yet"
                description="Favorite assets will appear here."
              />
            ) : (
              <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-4">
                {assets.map((asset) => (
                  <AssetCard
                    key={asset.id}
                    asset={asset}
                    onChanged={() => void fetchAssets()}
                    selected={selectedAssetId === asset.id}
                    onSelect={() =>
                      setSelectedAssetId((current) => current === asset.id ? null : asset.id)
                    }
                  />
                ))}
              </div>
            )}
          </section>
        )}
      </div>
    </main>
  );
}