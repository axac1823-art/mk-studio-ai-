"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  FolderOpen,
  Heart,
  Image as ImageIcon,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  Upload,
  X,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";

interface ProjectLink {
  id: string;
  name: string;
}

interface SidebarLinkProps {
  href: string;
  label: string;
  icon: LucideIcon;
  active: boolean;
}

type LibraryItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  isActive: (pathname: string, view?: string | null) => boolean;
};

const libraryItems: LibraryItem[] = [
  {
    href: "/app/projects?view=projects&create=1",
    label: "All projects",
    icon: FolderOpen,
    isActive: (pathname: string, view?: string | null) =>
      pathname === "/app/projects?view=projects&create=1" && (!view || view === "projects"),
  },
  {
    href: "/app/projects?view=assets",
    label: "All assets",
    icon: ImageIcon,
    isActive: (pathname: string, view?: string | null) =>
      pathname === "/app/projects" && view === "assets",
  },
  {
    href: "/app/projects?view=favorites",
    label: "Favorites",
    icon: Heart,
    isActive: (pathname: string, view?: string | null) =>
      pathname === "/app/projects" && view === "favorites",
  },
  {
    href: "/app/uploads",
    label: "Uploads",
    icon: Upload,
    isActive: (pathname: string) => pathname.startsWith("/app/uploads"),
  },
  {
    href: "/app/trash",
    label: "Trash",
    icon: Trash2,
    isActive: (pathname: string) => pathname.startsWith("/app/trash"),
  },
];

function SidebarLink({ href, label, icon: Icon, active }: SidebarLinkProps) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group flex h-9 w-full items-center gap-2.5 rounded-lg px-2.5 text-[13px] font-medium transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
        active
          ? "bg-accent text-foreground"
          : "text-muted-foreground hover:bg-accent/65 hover:text-foreground",
      )}
    >
      <span
        className={cn(
          "flex h-7 w-7 shrink-0 items-center justify-center rounded-md transition-colors",
          active
            ? "bg-background text-foreground shadow-sm"
            : "text-muted-foreground group-hover:text-foreground",
        )}
      >
        <Icon className="h-4 w-4" strokeWidth={1.8} aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1 truncate">{label}</span>
    </Link>
  );
}

function ProjectLibraryLinks({ mobile = false }: { mobile?: boolean }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const view = searchParams.get("view");

  if (mobile) {
    return (
      <nav
        aria-label="Project library"
        className="flex gap-1.5 overflow-x-auto border-b bg-background px-3 py-2.5 md:hidden"
      >
        {libraryItems.map(({ href, label, icon: Icon, isActive }) => {
          const active = isActive(pathname, view);
          return (
            <Link
              key={label}
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex h-9 shrink-0 items-center gap-2 rounded-lg border px-3 text-[13px] font-medium transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
                active
                  ? "border-border bg-accent text-foreground shadow-sm"
                  : "border-transparent text-muted-foreground hover:border-border/70 hover:bg-accent/60 hover:text-foreground",
              )}
            >
              <Icon className="h-4 w-4 shrink-0" strokeWidth={1.8} aria-hidden="true" />
              {label}
            </Link>
          );
        })}
      </nav>
    );
  }

  return (
    <nav aria-label="Project library" className="flex flex-col gap-1">
      {libraryItems.map(({ href, label, icon, isActive }) => (
        <SidebarLink
          key={label}
          href={href}
          label={label}
          icon={icon}
          active={isActive(pathname, view)}
        />
      ))}
    </nav>
  );
}

function ProjectRow({
  project,
  active,
}: {
  project: ProjectLink;
  active: boolean;
}) {
  const initial = project.name.trim().charAt(0).toLocaleUpperCase() || "P";

  return (
    <Link
      href={`/app/projects/${project.id}`}
      aria-current={active ? "page" : undefined}
      title={project.name}
      className={cn(
        "group flex h-9 min-w-0 items-center gap-2.5 rounded-lg px-2.5 text-[13px] transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
        active
          ? "bg-accent font-medium text-foreground"
          : "text-muted-foreground hover:bg-accent/65 hover:text-foreground",
      )}
    >
      <span
        className={cn(
          "flex h-7 w-7 shrink-0 items-center justify-center rounded-md border text-[11px] font-semibold transition-colors",
          active
            ? "border-border bg-background text-foreground shadow-sm"
            : "border-border/70 bg-muted/50 text-muted-foreground group-hover:bg-background group-hover:text-foreground",
        )}
        aria-hidden="true"
      >
        {initial}
      </span>
      <span className="min-w-0 flex-1 truncate">{project.name}</span>
      <span
        className={cn(
          "h-1.5 w-1.5 shrink-0 rounded-full bg-primary transition-opacity",
          active ? "opacity-100" : "opacity-0",
        )}
        aria-hidden="true"
      />
    </Link>
  );
}

function ProjectsLoadingState() {
  return (
    <div className="space-y-1.5 px-1 py-1" aria-label="Loading projects">
      {[0, 1, 2].map((item) => (
        <div key={item} className="flex h-9 items-center gap-2.5 px-1.5">
          <div className="h-7 w-7 shrink-0 animate-pulse rounded-md bg-muted" />
          <div
            className={cn(
              "h-2.5 animate-pulse rounded-full bg-muted",
              item === 1 ? "w-24" : "w-32",
            )}
          />
        </div>
      ))}
    </div>
  );
}

export function ProjectLibrarySidebar() {
  const [projects, setProjects] = useState<ProjectLink[]>([]);
  const [projectSearch, setProjectSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const pathname = usePathname();

  useEffect(() => {
    let cancelled = false;

    async function loadProjects() {
      try {
        const response = await fetch("/api/projects", { cache: "no-store" });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const data = (await response.json()) as { projects?: ProjectLink[] };
        if (!cancelled) {
          setProjects(data.projects ?? []);
          setLoadFailed(false);
        }
      } catch {
        if (!cancelled) {
          setProjects([]);
          setLoadFailed(true);
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    void loadProjects();
    window.addEventListener("projects:updated", loadProjects);

    return () => {
      cancelled = true;
      window.removeEventListener("projects:updated", loadProjects);
    };
  }, [reloadKey]);

  const normalizedSearch = projectSearch.trim().toLocaleLowerCase();
  const filteredProjects = projects.filter((project) =>
    project.name.toLocaleLowerCase().includes(normalizedSearch),
  );

  return (
    <aside className="hidden h-screen w-60 shrink-0 flex-col border-r bg-background md:flex">
      <div className="flex h-14 shrink-0 items-center gap-3 border-b px-4">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg border bg-muted/50 text-foreground">
          <FolderOpen className="h-4 w-4" strokeWidth={1.8} aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold tracking-tight">Library</p>
          <p className="truncate text-[11px] text-muted-foreground">Projects and assets</p>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-4">
        <p className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/75">
          Browse
        </p>
        <ProjectLibraryLinks />

        <div className="my-5 h-px bg-border/80" />

        <div className="mb-2 flex h-8 items-center justify-between gap-2 px-2">
          <div className="flex min-w-0 items-center gap-2">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/75">
              Projects
            </p>
            <span className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-muted-foreground">
              {isLoading ? "—" : projects.length}
            </span>
          </div>
          <Link
            href="/app/projects?view=projects&create=1"
            aria-label="Create project"
            title="Create project"
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Plus className="h-4 w-4" strokeWidth={1.8} aria-hidden="true" />
          </Link>
        </div>

        <label className="relative mb-3 block">
          <span className="sr-only">Search projects</span>
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <input
            type="search"
            value={projectSearch}
            onChange={(event) => setProjectSearch(event.target.value)}
            placeholder="Find a project..."
            autoComplete="off"
            className={cn(
              "h-9 w-full rounded-lg border border-border/80 bg-muted/30 pl-9 pr-9 text-[13px] text-foreground outline-none transition-colors",
              "placeholder:text-muted-foreground/75 hover:bg-muted/50 focus:border-ring focus:bg-background focus:ring-2 focus:ring-ring/15",
            )}
          />
          {projectSearch && (
            <button
              type="button"
              onClick={() => setProjectSearch("")}
              aria-label="Clear project search"
              className="absolute right-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          )}
        </label>

        <div className="flex flex-col gap-1">
          {isLoading ? (
            <ProjectsLoadingState />
          ) : loadFailed ? (
            <div className="rounded-lg border border-dashed px-3 py-4 text-center">
              <FolderOpen className="mx-auto h-4 w-4 text-muted-foreground/70" aria-hidden="true" />
              <p className="mt-2 text-xs font-medium text-foreground">Projects unavailable</p>
              <p className="mt-1 text-[11px] leading-4 text-muted-foreground">
                Your project list could not be loaded.
              </p>
              <button
                type="button"
                onClick={() => {
                  setIsLoading(true);
                  setLoadFailed(false);
                  setReloadKey((value) => value + 1);
                }}
                className="mt-2 inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <RefreshCw className="h-3 w-3" aria-hidden="true" />
                Try again
              </button>
            </div>
          ) : filteredProjects.length > 0 ? (
            filteredProjects.map((project) => (
              <ProjectRow
                key={project.id}
                project={project}
                active={pathname === `/app/projects/${project.id}`}
              />
            ))
          ) : (
            <div className="rounded-lg border border-dashed px-3 py-4 text-center">
              <FolderOpen className="mx-auto h-4 w-4 text-muted-foreground/70" aria-hidden="true" />
              <p className="mt-2 text-xs font-medium text-foreground">
                {normalizedSearch ? "No matching projects" : "No projects yet"}
              </p>
              <p className="mt-1 text-[11px] leading-4 text-muted-foreground">
                {normalizedSearch
                  ? "Try another name or clear your search."
                  : "Create a project to keep related assets together."}
              </p>
              {normalizedSearch ? (
                <button
                  type="button"
                  onClick={() => setProjectSearch("")}
                  className="mt-2 text-xs font-medium text-foreground underline-offset-4 hover:underline"
                >
                  Clear search
                </button>
              ) : (
                <Link
                  href="/app/projects?view=projects&create=1"
                  className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-foreground underline-offset-4 hover:underline"
                >
                  <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                  New project
                </Link>
              )}
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}

export function ProjectLibraryMobileNav() {
  return <ProjectLibraryLinks mobile />;
}
