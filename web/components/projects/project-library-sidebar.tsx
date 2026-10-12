"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { FolderOpen, Heart, Image as ImageIcon, Search, Trash2, Upload } from "lucide-react";

import { cn } from "@/lib/utils";

interface ProjectLink {
  id: string;
  name: string;
}

interface SidebarLinkProps {
  href: string;
  label: string;
  icon: typeof FolderOpen;
  active: boolean;
}

function SidebarLink({ href, label, icon: Icon, active }: SidebarLinkProps) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex h-8 w-full items-center gap-2 rounded-lg px-3 text-xs font-medium transition-colors",
        active
          ? "bg-accent text-foreground"
          : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
      )}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" />
      <span className="truncate">{label}</span>
    </Link>
  );
}

function ProjectLibraryLinks({ mobile = false }: { mobile?: boolean }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const view = searchParams.get("view");

  if (mobile) {
    const mobileClass = (active: boolean) =>
      cn(
        "flex h-8 shrink-0 items-center gap-1.5 rounded-lg px-2.5 text-xs",
        active
          ? "bg-accent text-foreground"
          : "text-muted-foreground hover:bg-accent hover:text-foreground",
      );

    return (
      <nav aria-label="Project library" className="flex gap-1 overflow-x-auto border-b bg-background px-2 py-2 md:hidden">
        <Link href="/app/projects" className={mobileClass(pathname === "/app/projects" && (!view || view === "projects"))}>
          <FolderOpen className="h-3.5 w-3.5" /> All projects
        </Link>
        <Link href="/app/projects?view=assets" className={mobileClass(pathname === "/app/projects" && view === "assets")}>
          <ImageIcon className="h-3.5 w-3.5" /> All assets
        </Link>
        <Link href="/app/projects?view=favorites" className={mobileClass(pathname === "/app/projects" && view === "favorites")}>
          <Heart className="h-3.5 w-3.5" /> Favorites
        </Link>
        <Link href="/app/uploads" className={mobileClass(pathname.startsWith("/app/uploads"))}>
          <Upload className="h-3.5 w-3.5" /> Uploads
        </Link>
        <Link href="/app/trash" className={mobileClass(pathname.startsWith("/app/trash"))}>
          <Trash2 className="h-3.5 w-3.5" /> Trash
        </Link>
      </nav>
    );
  }

  return (
    <nav aria-label="Project library" className="flex flex-col gap-0.5">
      <SidebarLink
        href="/app/projects"
        label="All projects"
        icon={FolderOpen}
        active={pathname === "/app/projects" && (!view || view === "projects")}
      />
      <SidebarLink
        href="/app/projects?view=assets"
        label="All assets"
        icon={ImageIcon}
        active={pathname === "/app/projects" && view === "assets"}
      />
      <SidebarLink
        href="/app/projects?view=favorites"
        label="Favorites"
        icon={Heart}
        active={pathname === "/app/projects" && view === "favorites"}
      />
      <SidebarLink href="/app/uploads" label="Uploads" icon={Upload} active={pathname.startsWith("/app/uploads")} />
      <SidebarLink href="/app/trash" label="Trash" icon={Trash2} active={pathname.startsWith("/app/trash")} />
    </nav>
  );
}

export function ProjectLibrarySidebar() {
  const [projects, setProjects] = useState<ProjectLink[]>([]);
  const [projectSearch, setProjectSearch] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadProjects() {
      try {
        const response = await fetch("/api/projects", { cache: "no-store" });
        if (!response.ok) return;
        const data = (await response.json()) as { projects?: ProjectLink[] };
        if (!cancelled) setProjects(data.projects ?? []);
      } catch {
        if (!cancelled) setProjects([]);
      }
    }

    void loadProjects();
    window.addEventListener("projects:updated", loadProjects);
    return () => {
      cancelled = true;
      window.removeEventListener("projects:updated", loadProjects);
    };
  }, []);

  const filteredProjects = projects.filter((project) =>
    project.name.toLocaleLowerCase().includes(projectSearch.trim().toLocaleLowerCase()),
  );

  return (
    <aside className="hidden h-screen w-60 shrink-0 border-r bg-background md:flex md:flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto px-2.5 py-4">
        <ProjectLibraryLinks />
        <div className="my-3 h-px bg-border" />
        <label className="relative mb-2 block px-1">
          <span className="sr-only">Search projects</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            value={projectSearch}
            onChange={(event) => setProjectSearch(event.target.value)}
            placeholder="Search projects"
            className="h-8 w-full rounded-lg border bg-background pl-8 pr-3 text-xs outline-none transition-colors placeholder:text-muted-foreground/70 focus:border-ring"
          />
        </label>
        <div className="flex h-8 items-center px-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
          Projects
        </div>
        <div className="flex flex-col gap-0.5">
          {filteredProjects.map((project) => (
            <Link
              key={project.id}
              href={`/app/projects/${project.id}`}
              className="flex h-8 min-w-0 items-center gap-2 rounded-lg px-3 text-xs text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground"
            >
              <span className="flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded bg-accent text-[9px]">
                {project.name.trim().charAt(0).toUpperCase() || "P"}
              </span>
              <span className="truncate">{project.name}</span>
            </Link>
          ))}
          {filteredProjects.length === 0 && (
            <p className="px-3 py-2 text-xs text-muted-foreground">
              {projects.length === 0 ? "No projects yet" : "No projects found"}
            </p>
          )}
        </div>
      </div>
    </aside>
  );
}

export function ProjectLibraryMobileNav() {
  return <ProjectLibraryLinks mobile />;
}
