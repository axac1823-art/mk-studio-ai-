"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ChevronDown,
  ChevronRight,
  FolderOpen,
  Heart,
  Image as ImageIcon,
  Music,
  Plus,
  Search,
  Trash2,
  Upload,
  Video,
  MoreHorizontal,
  ArrowLeft,
} from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { cn } from "@/lib/utils";

interface ProjectSidebarProps {
  projectId?: string;
}

interface ProjectSummary {
  id: string;
  name: string;
  coverAssetId?: string | null;
}

function projectColor(id: string) {
  const colors = [
    "bg-yellow-400",
    "bg-violet-300",
    "bg-amber-500",
    "bg-sky-400",
    "bg-emerald-400",
    "bg-rose-400",
    "bg-cyan-400",
    "bg-orange-400",
  ];

  let hash = 0;

  for (let i = 0; i < id.length; i += 1) {
    hash = (hash << 5) - hash + id.charCodeAt(i);
    hash |= 0;
  }

  return colors[Math.abs(hash) % colors.length];
}

function SectionDivider() {
  return (
    <div className="flex h-5 shrink-0 items-center px-2.5 py-1">
      <div className="h-px w-full bg-border/70" />
    </div>
  );
}

function SidebarItem({
  href,
  label,
  icon: Icon,
  active = false,
}: {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  active?: boolean;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group flex h-8 w-full shrink-0 items-center rounded-lg",
        "gap-0 px-0 py-1 text-xs font-medium",
        "transition-colors duration-150",
        active
          ? "bg-accent text-foreground"
          : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
      )}
    >
      <span className="flex h-8 w-8 shrink-0 items-center justify-center">
        <Icon className="h-3.5 w-3.5 shrink-0" />
      </span>

      <span className="min-w-0 flex-1 truncate pr-2">
        {label}
      </span>
    </Link>
  );
}

function ProjectRow({
  project,
  activeProjectId,
  expanded,
  onToggle,
}: {
  project: ProjectSummary;
  activeProjectId: string;
  expanded: boolean;
  onToggle: () => void;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const basePath = `/app/projects/${project.id}`;
  const isCurrentProject = project.id === activeProjectId;

  const type = searchParams.get("type");

  const overviewActive =
    isCurrentProject &&
    pathname === basePath &&
    !searchParams.has("type");

  const assetsActive =
    isCurrentProject &&
    pathname === basePath &&
    type === "all";

  const imageActive =
    isCurrentProject &&
    pathname === basePath &&
    type === "image";

  const videoActive =
    isCurrentProject &&
    pathname === basePath &&
    type === "video";

  const audioActive =
    isCurrentProject &&
    pathname === basePath &&
    type === "audio";

  return (
    <div className="group/project min-w-0">
      {/* Project row */}
      <div
        className={cn(
          "group/row flex h-8 w-full min-w-0 items-center rounded-lg",
          "px-0.5 py-1.5 text-left text-xs font-medium",
          "transition-colors duration-150",
          isCurrentProject
            ? "bg-accent/50 text-foreground"
            : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
        )}
      >
        <div className="flex min-w-0 flex-1 items-center gap-2">
          {/* Expand */}
          <div className="flex shrink-0 items-center gap-0.5">
            <button
              type="button"
              onClick={onToggle}
              className={cn(
                "flex size-3 items-center justify-center rounded",
                "text-muted-foreground transition-colors",
                "hover:bg-accent hover:text-foreground",
              )}
              aria-label={
                expanded
                  ? "Collapse project"
                  : "Expand project"
              }
            >
              {expanded ? (
                <ChevronDown className="h-3.5 w-3.5" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5" />
              )}
            </button>

            {/* Project color */}
            <Link
              href={basePath}
              className="flex shrink-0 items-center justify-center"
              aria-label={project.name}
            >
              <span
                className={cn(
                  "size-3.5 shrink-0 rounded",
                  projectColor(project.id),
                )}
              />
            </Link>
          </div>

          {/* Project name */}
          <Link
            href={basePath}
            className="flex min-w-0 flex-1 items-center gap-2"
            aria-current={overviewActive ? "page" : undefined}
          >
            <span
              title={project.name}
              className={cn(
                "min-w-0 flex-1 truncate",
                isCurrentProject &&
                  "font-medium text-foreground",
              )}
            >
              {project.name}
            </span>
          </Link>
        </div>

        {/* Actions */}
        <button
          type="button"
          aria-label={`Actions for ${project.name}`}
          className={cn(
            "mr-1 flex size-4 shrink-0 items-center justify-center",
            "rounded text-muted-foreground/50",
            "opacity-0 transition-opacity duration-150",
            "group-hover/row:opacity-100",
            "hover:bg-accent hover:text-foreground",
          )}
        >
          <MoreHorizontal className="h-3 w-3" />
        </button>
      </div>

      {/* Expanded project links */}
      {expanded && (
        <div className="ml-4 mt-0.5 flex min-w-0 flex-col gap-0.5 border-l border-border/60 pl-2">
          <SidebarItem
            href={basePath}
            label="Overview"
            icon={FolderOpen}
            active={overviewActive}
          />

          <SidebarItem
            href={`${basePath}?type=all`}
            label="Assets"
            icon={FolderOpen}
            active={assetsActive}
          />

          <SidebarItem
            href={`${basePath}?type=image`}
            label="Images"
            icon={ImageIcon}
            active={imageActive}
          />

          <SidebarItem
            href={`${basePath}?type=video`}
            label="Videos"
            icon={Video}
            active={videoActive}
          />

          <SidebarItem
            href={`${basePath}?type=audio`}
            label="Audio"
            icon={Music}
            active={audioActive}
          />
        </div>
      )}
    </div>
  );
}

export function ProjectSidebar({
  projectId,
}: ProjectSidebarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const activeProjectId =
    projectId ??
    pathname.match(/^\/app\/projects\/([^/]+)/)?.[1] ??
    "";

  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [projectsError, setProjectsError] = useState<string | null>(null);

  const [searchOpen, setSearchOpen] = useState(false);
  const [search, setSearch] = useState("");

  const [creating, setCreating] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [busy, setBusy] = useState(false);

  const [expandedProjects, setExpandedProjects] = useState<
    Record<string, boolean>
  >({});

  const loadProjects = useCallback(async () => {
    try {
      const response = await fetch("/api/projects", {
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = (await response.json()) as {
        projects?: ProjectSummary[];
      };

      setProjects(data.projects ?? []);
      setProjectsError(null);
    } catch {
      setProjectsError("Could not load projects.");
    }
  }, []);

  useEffect(() => {
    void loadProjects();

    const handleProjectsUpdated = () => {
      void loadProjects();
    };

    window.addEventListener(
      "projects:updated",
      handleProjectsUpdated,
    );

    return () => {
      window.removeEventListener(
        "projects:updated",
        handleProjectsUpdated,
      );
    };
  }, [loadProjects]);

  useEffect(() => {
    if (!activeProjectId) {
      return;
    }

    setExpandedProjects((current) => ({
      ...current,
      [activeProjectId]: true,
    }));
  }, [activeProjectId]);

  const filteredProjects = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) {
      return projects;
    }

    return projects.filter((project) =>
      project.name.toLowerCase().includes(query),
    );
  }, [projects, search]);

  const createProject = async () => {
    const trimmed = newProjectName.trim();

    if (!trimmed || busy) {
      return;
    }

    setBusy(true);
    setProjectsError(null);

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

      const data = (await response.json().catch(() => null)) as
        | {
            project?: {
              id: string;
            };
          }
        | null;

      setNewProjectName("");
      setCreating(false);

      await loadProjects();

      if (data?.project?.id) {
        router.push(`/app/projects/${data.project.id}`);
      }
    } catch {
      setProjectsError("Could not create the project.");
    } finally {
      setBusy(false);
    }
  };

  const isAllProjectsActive =
    pathname === "/app/projects" &&
    (!searchParams.get("view") ||
      searchParams.get("view") === "projects");

  const isAllAssetsActive =
    pathname === "/app/projects" &&
    searchParams.get("view") === "assets";

  const isFavoritesActive =
    pathname === "/app/projects" &&
    searchParams.get("view") === "favorites";

  const isUploadsActive =
    pathname.startsWith("/app/uploads");

  const isTrashActive =
    pathname.startsWith("/app/trash");

  return (
    <aside className="hidden h-full w-60 shrink-0 md:flex">
      <div
        className="
          m-2
          flex
          h-[calc(100vh-1rem)]
          min-h-0
          w-full
          flex-col
          overflow-hidden
          rounded-xl
          bg-background
        "
      >
        <div
          className="
            group/sidebar
            flex
            h-full
            min-h-0
            w-full
            flex-col
            gap-0.5
            overflow-hidden
            px-2.5
            py-5
          "
        >
          {/* Top resources */}
          <section className="flex shrink-0 flex-col gap-0.5">
            <SidebarItem
              href="/app/projects"
              label="All projects"
              icon={FolderOpen}
              active={isAllProjectsActive}
            />

            <SidebarItem
              href="/app/projects?view=assets"
              label="All assets"
              icon={ImageIcon}
              active={isAllAssetsActive}
            />

            <SidebarItem
              href="/app/projects?view=favorites"
              label="Favorites"
              icon={Heart}
              active={isFavoritesActive}
            />

            <SidebarItem
              href="/app/uploads"
              label="Uploads"
              icon={Upload}
              active={isUploadsActive}
            />

            <SidebarItem
              href="/app/trash"
              label="Trash"
              icon={Trash2}
              active={isTrashActive}
            />
          </section>

          <SectionDivider />

          {/* Projects header */}
          <div className="flex h-8 shrink-0 items-center justify-between pb-1 pl-4 pr-0">
            <span className="text-[10px] font-medium uppercase tracking-[0.05em] text-muted-foreground/60">
              Projects
            </span>

            <div className="flex items-center">
              {/* Search */}
              <button
                type="button"
                onClick={() => {
                  setSearchOpen((value) => !value);

                  if (searchOpen) {
                    setSearch("");
                  }
                }}
                aria-label="Search projects"
                title="Search projects"
                className={cn(
                  "inline-flex size-8 items-center justify-center rounded-lg",
                  "text-muted-foreground transition-colors duration-150",
                  "hover:bg-accent hover:text-foreground",
                  searchOpen &&
                    "bg-accent text-foreground",
                )}
              >
                <Search className="h-3.5 w-3.5" />
              </button>

              {/* Create project */}
              <button
                type="button"
                onClick={() =>
                  setCreating((value) => !value)
                }
                aria-label="Create project"
                title="Create project"
                className={cn(
                  "inline-flex size-8 items-center justify-center rounded-lg",
                  "text-muted-foreground transition-colors duration-150",
                  "hover:bg-accent hover:text-foreground",
                  creating &&
                    "bg-accent text-foreground",
                )}
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* Search */}
          {searchOpen && (
            <div className="px-2 pb-1.5">
              <div
                className="
                  flex
                  h-8
                  items-center
                  gap-2
                  rounded-lg
                  bg-muted/30
                  px-3
                "
              >
                <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />

                <input
                  value={search}
                  onChange={(event) =>
                    setSearch(event.target.value)
                  }
                  placeholder="Search"
                  className="
                    h-full
                    min-w-0
                    flex-1
                    bg-transparent
                    text-xs
                    outline-none
                    placeholder:text-muted-foreground/50
                  "
                  autoFocus
                />
              </div>
            </div>
          )}

          {/* Create */}
          {creating && (
            <div className="px-2 pb-1.5">
              <div className="rounded-lg bg-muted/20 p-2">
                <input
                  value={newProjectName}
                  onChange={(event) =>
                    setNewProjectName(event.target.value)
                  }
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      void createProject();
                    }

                    if (event.key === "Escape") {
                      setCreating(false);
                      setNewProjectName("");
                    }
                  }}
                  placeholder="Project name"
                  className="
                    h-8
                    w-full
                    rounded-md
                    border
                    bg-background
                    px-2.5
                    text-xs
                    outline-none
                    focus:border-primary
                  "
                  autoFocus
                  disabled={busy}
                />

                <div className="mt-2 flex gap-1">
                  <button
                    type="button"
                    onClick={() => void createProject()}
                    disabled={!newProjectName.trim() || busy}
                    className="
                      h-7
                      rounded-md
                      bg-foreground
                      px-3
                      text-xs
                      font-medium
                      text-background
                      transition-opacity
                      disabled:opacity-40
                    "
                  >
                    {busy ? "Creating…" : "Create"}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setCreating(false);
                      setNewProjectName("");
                    }}
                    className="
                      h-7
                      rounded-md
                      px-3
                      text-xs
                      text-muted-foreground
                      hover:bg-accent
                      hover:text-foreground
                    "
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Projects scroll area */}
          <div
            className="
              -mr-3
              min-h-0
              flex-1
              overflow-y-auto
              overflow-x-hidden
              pr-2
              scrollbar-thin
            "
          >
            {projectsError && (
              <p className="px-3 py-2 text-[11px] text-destructive">
                {projectsError}
              </p>
            )}

            {!projectsError &&
              filteredProjects.length === 0 && (
                <div className="px-3 py-8 text-center">
                  <p className="text-xs text-muted-foreground">
                    No projects found
                  </p>
                </div>
              )}

            <div className="flex min-w-0 flex-col gap-0.5">
              {filteredProjects.map((project) => (
                <ProjectRow
                  key={project.id}
                  project={project}
                  activeProjectId={activeProjectId}
                  expanded={Boolean(
                    expandedProjects[project.id],
                  )}
                  onToggle={() => {
                    setExpandedProjects((current) => ({
                      ...current,
                      [project.id]:
                        !current[project.id],
                    }));
                  }}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}

export function ProjectMobileNav({
  projectId,
}: {
  projectId?: string;
}) {
  if (!projectId) {
    return null;
  }

  return (
    <nav
      aria-label="Project navigation"
      className="
        flex
        gap-1
        overflow-x-auto
        border-b
        bg-background
        px-2
        py-2
        md:hidden
      "
    >
      <Link
        href="/app/projects"
        className="
          flex
          h-8
          shrink-0
          items-center
          gap-1.5
          rounded-lg
          px-2.5
          text-xs
          text-muted-foreground
          hover:bg-accent
          hover:text-foreground
        "
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Projects
      </Link>

      <Link
        href={`/app/projects/${projectId}`}
        className="
          flex
          h-8
          shrink-0
          items-center
          gap-1.5
          rounded-lg
          bg-accent
          px-2.5
          text-xs
          text-foreground
        "
      >
        Overview
      </Link>

      <Link
        href={`/app/projects/${projectId}?type=all`}
        className="
          flex
          h-8
          shrink-0
          items-center
          rounded-lg
          px-2.5
          text-xs
          text-muted-foreground
          hover:bg-accent
          hover:text-foreground
        "
      >
        Assets
      </Link>

      <Link
        href={`/app/projects/${projectId}?type=image`}
        className="
          flex
          h-8
          shrink-0
          items-center
          rounded-lg
          px-2.5
          text-xs
          text-muted-foreground
          hover:bg-accent
          hover:text-foreground
        "
      >
        Images
      </Link>

      <Link
        href={`/app/projects/${projectId}?type=video`}
        className="
          flex
          h-8
          shrink-0
          items-center
          rounded-lg
          px-2.5
          text-xs
          text-muted-foreground
          hover:bg-accent
          hover:text-foreground
        "
      >
        Videos
      </Link>

      <Link
        href={`/app/projects/${projectId}?type=audio`}
        className="
          flex
          h-8
          shrink-0
          items-center
          rounded-lg
          px-2.5
          text-xs
          text-muted-foreground
          hover:bg-accent
          hover:text-foreground
        "
      >
        Audio
      </Link>
    </nav>
  );
}
