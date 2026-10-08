"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowLeft,
  FolderOpen,
  Image as ImageIcon,
  Video,
  Mic,
  Layers3,
  LockKeyhole,
} from "lucide-react";

import { cn } from "@/lib/utils";

interface ProjectSidebarProps {
  projectId: string;
  projectName: string;
  privateProject?: boolean;
}

interface ProjectNavItemProps {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  active?: boolean;
}

function ProjectNavItem({
  href,
  label,
  icon: Icon,
  active,
}: ProjectNavItemProps) {
  return (
    <Link
      href={href}
      className={cn(
        "flex h-8 w-full items-center gap-2 rounded-lg px-3 text-xs font-medium",
        "transition-colors duration-150 outline-none",
        "focus-visible:ring-2 focus-visible:ring-ring",
        active
          ? "bg-accent text-foreground"
          : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"
      )}
      aria-current={active ? "page" : undefined}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" />
      <span className="min-w-0 flex-1 truncate">{label}</span>
    </Link>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-3 pb-1 pt-4 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
      {children}
    </div>
  );
}

export function ProjectSidebar({
  projectId,
  projectName,
  privateProject = true,
}: ProjectSidebarProps) {
  const pathname = usePathname();

  const basePath = `/app/projects/${projectId}`;

  const isOverview = pathname === basePath;

  return (
    <aside className="hidden w-60 shrink-0 border-r bg-background md:flex md:flex-col">
      <div className="flex h-full min-h-0 flex-col">
        {/* Back to projects */}
        <div className="p-3">
          <Link
            href="/app/projects"
            className={cn(
              "flex h-8 w-full items-center gap-2 rounded-lg px-3",
              "text-xs font-medium text-muted-foreground",
              "transition-colors duration-150",
              "hover:bg-accent/60 hover:text-foreground"
            )}
          >
            <ArrowLeft className="h-3.5 w-3.5 shrink-0" />
            <span>All projects</span>
          </Link>
        </div>

        <div className="px-3">
          <div className="h-px bg-border" />
        </div>

        {/* Current project */}
        <div className="p-3">
          <div className="flex min-w-0 items-center gap-2 rounded-lg px-2 py-2">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-accent text-xs font-semibold text-foreground">
              {projectName.trim().charAt(0).toUpperCase() || "P"}
            </div>

            <div className="min-w-0 flex-1">
              <div className="truncate text-xs font-semibold text-foreground">
                {projectName}
              </div>

              {privateProject && (
                <div className="mt-0.5 flex items-center gap-1 text-[10px] text-muted-foreground">
                  <LockKeyhole className="h-2.5 w-2.5" />
                  <span>Private</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="min-h-0 flex-1 overflow-y-auto px-2 pb-4">
          <SectionLabel>Project</SectionLabel>

          <div className="flex flex-col gap-0.5">
            <ProjectNavItem
              href={basePath}
              label="Overview"
              icon={FolderOpen}
              active={isOverview}
            />

            <ProjectNavItem
              href={`${basePath}?type=all`}
              label="All assets"
              icon={Layers3}
            />

            <ProjectNavItem
              href={`${basePath}?type=image`}
              label="Images"
              icon={ImageIcon}
            />

            <ProjectNavItem
              href={`${basePath}?type=video`}
              label="Videos"
              icon={Video}
            />

            <ProjectNavItem
              href={`${basePath}?type=audio`}
              label="Audio"
              icon={Mic}
            />
          </div>

          <SectionLabel>Organize</SectionLabel>

          <div className="flex flex-col gap-0.5">
            <ProjectNavItem
              href="/app/favorites"
              label="Favorites"
              icon={Layers3}
            />

            <ProjectNavItem
              href="/app/uploads"
              label="Uploads"
              icon={Layers3}
            />

            <ProjectNavItem
              href="/app/trash"
              label="Trash"
              icon={Layers3}
            />
          </div>
        </nav>

        {/* Bottom */}
        <div className="border-t p-3">
          <div className="px-3 text-[10px] text-muted-foreground">
            Project
          </div>

          <div className="mt-1 px-3 text-[11px] text-muted-foreground">
            {projectId.slice(0, 8)}
          </div>
        </div>
      </div>
    </aside>
  );
}