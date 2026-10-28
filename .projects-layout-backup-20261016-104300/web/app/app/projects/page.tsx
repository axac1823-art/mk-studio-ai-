"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ChevronLeft,
  ChevronRight,
  FolderOpen,
  Image as ImageIcon,
  Plus,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  assetLayoutClass,
  type AssetLayout,
} from "@/components/projects/asset-layout-controls";
import { AssetCard } from "@/components/projects/asset-card";
import {
  AssetNavigationToolbar,
  type AssetNavigationSort,
  type AssetNavigationTypeFilter,
} from "@/components/projects/asset-navigation-toolbar";
import type { ProjectSummary } from "@/components/projects/project-card";
import { useAssetLayout } from "@/components/projects/use-asset-layout";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

type ViewMode = "overview" | "projects" | "assets" | "favorites";
type AssetTypeFilter = AssetNavigationTypeFilter;

type RecentAsset = {
  id: string;
  projectId?: string | null;
  type: "image" | "video" | "audio" | "3d_model";
  url: string;
  isFavorite: boolean;
  generationId?: string | null;
  createdAt?: string;
};

function ProjectCover({
  project,
  layout = "grid",
}: {
  project: ProjectSummary;
  layout?: AssetLayout;
}) {
  const isGrid = layout === "grid";

  return (
    <div
      className={cn(
        "relative overflow-hidden bg-muted ring-1 ring-black/5 transition-shadow duration-300 group-hover:shadow-lg dark:ring-white/10",
        isGrid
          ? "aspect-[4/3] w-full rounded-xl"
          : "h-20 w-28 shrink-0 rounded-lg sm:h-24 sm:w-36",
      )}
    >
      {project.coverUrl ? (
        <>
          <FadeImage
            src={project.coverUrl}
            className="absolute inset-0 h-full w-full object-cover group-hover:scale-[1.04]"
          />

          {isGrid && (
            <>
              <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-transparent" />
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
          )}
        </>
      ) : (
        <>
          <div className="absolute inset-0 bg-gradient-to-br from-muted to-muted/70" />
          <div className="absolute inset-0 flex items-center justify-center">
            <FolderOpen
              className={cn(
                "text-muted-foreground/50",
                isGrid ? "h-10 w-10" : "h-7 w-7",
              )}
            />
          </div>

          {isGrid && (
            <div className="absolute inset-x-0 bottom-0 p-3">
              <p className="truncate text-sm font-semibold">{project.name}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {project.assetCount}{" "}
                {project.assetCount === 1 ? "asset" : "assets"}
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
function AssetSkeletons({
  layout,
  columns,
  count = 12,
}: {
  layout: AssetLayout;
  columns: Parameters<typeof assetLayoutClass>[1];
  count?: number;
}) {
  return (
    <div className={assetLayoutClass(layout, columns)}>
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton
          key={i}
          className={
            layout === "grid"
              ? "aspect-[4/3] w-full rounded-xl"
              : "h-24 w-full rounded-xl"
          }
        />
      ))}
    </div>
  );
}
function ProjectCardItem({
  project,
  onDelete,
  layout = "grid",
  fixedWidth = false,
}: {
  project: ProjectSummary;
  onDelete?: (id: string) => void;
  layout?: AssetLayout;
  fixedWidth?: boolean; // للشريط الأفقي في صفحة overview
}) {
  const isGrid = layout === "grid";

  return (
    <div
      className={cn(
        "group relative",
        fixedWidth && "w-[200px] shrink-0",
        !isGrid &&
          "rounded-xl border bg-card p-2 pr-14 transition-colors hover:bg-muted/50",
      )}
    >
      <Link
        href={`/app/projects/${project.id}`}
        className={cn(isGrid ? "block" : "flex min-w-0 items-center gap-4")}
      >
        <ProjectCover project={project} layout={layout} />

        {!isGrid && (
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{project.name}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {project.assetCount}{" "}
              {project.assetCount === 1 ? "asset" : "assets"}
            </p>
          </div>
        )}
      </Link>

      {onDelete && (
        <button
          type="button"
          aria-label={`Delete ${project.name}`}
          onClick={() => onDelete(project.id)}
          className={cn(
            "z-20 flex h-8 w-8 items-center justify-center rounded-full transition-opacity",
            "opacity-100 md:opacity-0 md:group-hover:opacity-100 focus-visible:opacity-100",
            isGrid
              ? "absolute bottom-2 right-2 bg-black/45 text-white backdrop-blur-sm hover:bg-destructive"
              : "absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:bg-destructive hover:text-white",
          )}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}
function FadeImage({ src, className }: { src: string; className?: string }) {
  const [loaded, setLoaded] = useState(false);

  return (
    <img
      ref={(el) => {
        if (el?.complete && el.naturalWidth > 0) setLoaded(true); // الصور المخزنة مسبقاً
      }}
      src={src}
      alt=""
      loading="lazy"
      decoding="async"
      onLoad={() => setLoaded(true)}
      className={cn(
        "transition-[opacity,transform] duration-500 ease-out",
        loaded ? "opacity-100" : "opacity-0",
        className,
      )}
    />
  );
}
function NewProjectCard({
  layout,
  creating,
  name,
  busy,
  onStart,
  onNameChange,
  onCreate,
  onCancel,
}: {
  layout?: AssetLayout; // إذا لم تُمرَّر: الشريط الأفقي بعرض ثابت
  creating: boolean;
  name: string;
  busy: boolean;
  onStart: () => void;
  onNameChange: (value: string) => void;
  onCreate: () => void;
  onCancel: () => void;
}) {
  const fixed = layout === undefined;
  const isList = layout !== undefined && layout !== "grid";

  const wrapperClass = fixed ? "w-[200px] shrink-0" : "w-full";
  const boxClass = isList ? "min-h-24" : "aspect-[4/3]";

  if (creating) {
    return (
      <div className={wrapperClass}>
        <div
          className={cn(
            "flex flex-col justify-center gap-3 rounded-xl border bg-muted/40 p-4",
            boxClass,
          )}
        >
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
    <div className={wrapperClass}>
      <button
        type="button"
        onClick={onStart}
        className={cn(
          "flex w-full flex-col items-center justify-center rounded-xl border border-dashed bg-muted/35 p-5 text-center transition-colors hover:bg-muted/70",
          boxClass,
        )}
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

function AssetTile({
  asset,
  onChanged,
  layout = "grid",
}: {
  asset: RecentAsset;
  onChanged: () => void;
  layout?: AssetLayout;
}) {
  return <AssetCard asset={asset} onChanged={onChanged} layout={layout} />;
}
function SectionHeader({
  title,
  count,
  onPrevious,
  onNext,
}: {
  title: string;
  count?: number;
  onPrevious?: () => void;
  onNext?: () => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-muted-foreground">
          {title}
        </span>

        {typeof count === "number" && (
          <span className="text-xs text-muted-foreground/60">{count}</span>
        )}
      </div>

      {(onPrevious || onNext) && (
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={onPrevious}
            disabled={!onPrevious}
            aria-label="Previous projects"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>

          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={onNext}
            disabled={!onNext}
            aria-label="Next projects"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
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

        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}

export default function ProjectsPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const createRequested = searchParams.get("create") === "1";

  const rawView = searchParams.get("view");

  const view: ViewMode =
    rawView === "projects" || rawView === "assets" || rawView === "favorites"
      ? rawView
      : "overview";

  const [projects, setProjects] = useState<ProjectSummary[] | null>(null);
  const [assets, setAssets] = useState<RecentAsset[] | null>(null);
  const [assetTypeFilter, setAssetTypeFilter] =
    useState<AssetTypeFilter>("all");
  const [assetServiceFilter, setAssetServiceFilter] = useState("all");
  const [assetProjectFilter, setAssetProjectFilter] = useState("all");
  const [assetSort, setAssetSort] = useState<AssetNavigationSort>("recent");
  const { layout, columns, setLayout, setColumns } =
    useAssetLayout("library:assets");

  const [error, setError] = useState<string | null>(null);
  const [projectsLoadError, setProjectsLoadError] = useState<string | null>(
    null,
  );
  const [assetsLoadError, setAssetsLoadError] = useState<string | null>(null);

  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  const projectsRailRef = useRef<HTMLDivElement | null>(null);

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
      setProjectsLoadError(null);
    } catch {
      setProjectsLoadError("Could not load projects.");
    }
  }, []);

  const fetchAssets = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      const useLibraryFilters = view === "assets" || view === "favorites";

      if (view === "favorites") params.set("favorite", "1");
      if (
        useLibraryFilters &&
        assetTypeFilter !== "all" &&
        assetTypeFilter !== "3d_model"
      ) {
        params.set("type", assetTypeFilter);
      }
      if (useLibraryFilters && assetServiceFilter !== "all") {
        params.set("feature", assetServiceFilter);
      }

      const query = params.toString();
      const response = await fetch(`/api/assets${query ? `?${query}` : ""}`, {
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = (await response.json()) as {
        assets: RecentAsset[];
      };

      // Show only generated results, never uploaded inputs.
      const resultAssets = data.assets.filter((asset) =>
        Boolean(asset.generationId),
      );

      const nextAssets =
        useLibraryFilters && assetTypeFilter === "3d_model"
          ? resultAssets.filter((asset) => asset.type === "3d_model")
          : resultAssets;

      setAssets(nextAssets);
      setAssetsLoadError(null);
    } catch {
      setAssetsLoadError("Could not load assets.");
    }
  }, [view, assetTypeFilter, assetServiceFilter]);

  useEffect(() => {
    setError(null);
    setProjectsLoadError(null);
    setAssetsLoadError(null);
    setCreating(view === "projects" && createRequested);

    if (
      view === "overview" ||
      view === "projects" ||
      view === "assets" ||
      view === "favorites"
    ) {
      void fetchProjects();
    } else {
      setProjects(null);
    }
  }, [view, fetchProjects, createRequested]);

  useEffect(() => {
    if (view === "overview" || view === "assets" || view === "favorites") {
      void fetchAssets();
    } else {
      setAssets(null);
    }
  }, [view, fetchAssets]);

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
      if (createRequested)
        router.replace("/app/projects?view=projects", { scroll: false });

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

  const recentProjects = useMemo(() => projects?.slice(0, 8) ?? [], [projects]);

  const filteredAssets = useMemo(() => {
    const useLibraryFilters = view === "assets" || view === "favorites";
    const result = (assets ?? []).filter((asset) => {
      if (!useLibraryFilters) return true;
      const matchesType =
        assetTypeFilter === "all" || asset.type === assetTypeFilter;
      const matchesProject =
        assetProjectFilter === "all" || asset.projectId === assetProjectFilter;
      return matchesType && matchesProject;
    });

    result.sort((left, right) => {
      if (assetSort === "type") return left.type.localeCompare(right.type);
      const leftTime = left.createdAt ? new Date(left.createdAt).getTime() : 0;
      const rightTime = right.createdAt
        ? new Date(right.createdAt).getTime()
        : 0;
      return assetSort === "oldest"
        ? leftTime - rightTime
        : rightTime - leftTime;
    });

    return result;
  }, [assets, assetTypeFilter, assetProjectFilter, assetSort, view]);

  const recentAssets = useMemo(
    () => filteredAssets.slice(0, 12),
    [filteredAssets],
  );

  const scrollProjects = (direction: "left" | "right") => {
    const container = projectsRailRef.current;

    if (!container) {
      return;
    }

    container.scrollBy({
      left: direction === "left" ? -440 : 440,
      behavior: "smooth",
    });
  };

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
        <header className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-lg font-semibold tracking-tight">{pageTitle}</h1>

          {showCreateProject && (
            <Button
              type="button"
              size="sm"
              className="h-8 gap-1.5"
              onClick={() => setCreating(true)}
            >
              <Plus className="h-3.5 w-3.5" /> Add project
            </Button>
          )}
        </header>

        {(error || projectsLoadError || assetsLoadError) && (
          <p role="alert" className="text-sm text-destructive">
            {error || projectsLoadError || assetsLoadError}
          </p>
        )}

        {view === "overview" && (
          <>
            <section className="flex flex-col gap-3">
              <SectionHeader
                title="Recent projects"
                count={projects?.length}
                onPrevious={() => scrollProjects("left")}
                onNext={() => scrollProjects("right")}
              />

              {projects === null ? (
                <div className="flex gap-4 overflow-hidden">
                  {Array.from({ length: 5 }).map((_, index) => (
                    <Skeleton
                      key={index}
                      className="aspect-[4/3] w-[200px] shrink-0 rounded-xl"
                    />
                  ))}
                </div>
              ) : recentProjects.length === 0 ? (
                <div className="flex gap-4 overflow-x-auto pb-1">
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
                      if (createRequested)
                        router.replace("/app/projects?view=projects", {
                          scroll: false,
                        });
                    }}
                  />
                </div>
              ) : (
                <div
                  ref={projectsRailRef}
                  className="flex gap-4 overflow-x-auto pb-1 scrollbar-none"
                >
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
                      if (createRequested)
                        router.replace("/app/projects?view=projects", {
                          scroll: false,
                        });
                    }}
                  />

                  {recentProjects.map((project) => (
                    <ProjectCardItem
                      key={project.id}
                      fixedWidth
                      project={project}
                    />
                  ))}
                </div>
              )}
            </section>

            <section className="flex flex-col gap-3">
              <SectionHeader title="Recent assets" count={assets?.length} />

              {assets === null ? (
                <AssetSkeletons layout={layout} columns={columns} count={8} />
              ) : recentAssets.length === 0 ? (
                <EmptyState
                  icon={<ImageIcon className="h-5 w-5 text-muted-foreground" />}
                  title="No recent assets"
                  description="Your generated results will appear here."
                />
              ) : (
                <div className={assetLayoutClass(layout, columns)}>
                  {recentAssets.map((asset) => (
                    <AssetTile
                      key={asset.id}
                      asset={asset}
                      onChanged={() => void fetchAssets()}
                      layout={layout}
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
              <AssetSkeletons layout={layout} columns={columns} count={8} />
            ) : (
              <>
                <div className={assetLayoutClass(layout, columns)}>
                  <NewProjectCard
                    layout={layout}
                    creating={creating}
                    name={name}
                    busy={busy}
                    onStart={() => setCreating(true)}
                    onNameChange={setName}
                    onCreate={() => void createProject()}
                    onCancel={() => {
                      setCreating(false);
                      setName("");
                      if (createRequested)
                        router.replace("/app/projects?view=projects", {
                          scroll: false,
                        });
                    }}
                  />

                  {projects.map((project) => (
                    <ProjectCardItem
                      key={project.id}
                      project={project}
                      layout={layout}
                      onDelete={(id) => void deleteProject(id)}
                    />
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
            <AssetNavigationToolbar
              typeFilter={assetTypeFilter}
              onTypeFilterChange={(value: AssetNavigationTypeFilter) =>
                setAssetTypeFilter(value)
              }
              serviceFilter={assetServiceFilter}
              onServiceFilterChange={setAssetServiceFilter}
              layout={layout}
              columns={columns}
              onLayoutChange={setLayout}
              onColumnsChange={setColumns}
              projects={(projects ?? []).map(({ id, name }) => ({ id, name }))}
              projectFilter={assetProjectFilter}
              onProjectFilterChange={setAssetProjectFilter}
              sortBy={assetSort}
              onSortByChange={setAssetSort}
              onCreateFolder={() =>
                router.push("/app/projects?view=projects&create=1")
              }
            />
            {assets === null ? (
              <AssetSkeletons layout={layout} columns={columns} />
            ) : filteredAssets.length === 0 ? (
              <EmptyState
                icon={<ImageIcon className="h-5 w-5 text-muted-foreground" />}
                title="No assets"
                description="Your generated results will appear here."
              />
            ) : (
              <div className={assetLayoutClass(layout, columns)}>
                {filteredAssets.map((asset) => (
                  <AssetTile
                    key={asset.id}
                    asset={asset}
                    onChanged={() => void fetchAssets()}
                    layout={layout}
                  />
                ))}
              </div>
            )}
          </section>
        )}

        {view === "favorites" && (
          <section className="flex flex-col gap-4">
            <AssetNavigationToolbar
              typeFilter={assetTypeFilter}
              onTypeFilterChange={(value: AssetNavigationTypeFilter) =>
                setAssetTypeFilter(value)
              }
              serviceFilter={assetServiceFilter}
              onServiceFilterChange={setAssetServiceFilter}
              layout={layout}
              columns={columns}
              onLayoutChange={setLayout}
              onColumnsChange={setColumns}
              projects={(projects ?? []).map(({ id, name }) => ({ id, name }))}
              projectFilter={assetProjectFilter}
              onProjectFilterChange={setAssetProjectFilter}
              sortBy={assetSort}
              onSortByChange={setAssetSort}
              onCreateFolder={() =>
                router.push("/app/projects?view=projects&create=1")
              }
            />
            {assets === null ? (
              <AssetSkeletons layout={layout} columns={columns} />
            ) : filteredAssets.length === 0 ? (
              <EmptyState
                icon={<span className="text-lg text-muted-foreground">★</span>}
                title="No favorites yet"
                description="Favorite assets will appear here."
              />
            ) : (
              <div className={assetLayoutClass(layout, columns)}>
                {filteredAssets.map((asset) => (
                  <AssetTile
                    key={asset.id}
                    asset={asset}
                    onChanged={() => void fetchAssets()}
                    layout={layout}
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
