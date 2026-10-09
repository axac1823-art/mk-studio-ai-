"use client";

import { type ComponentType, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  Box,
  FolderOpen,
  Heart,
  Home,
  Image as ImageIcon,
  Menu,
  Mic,
  Plus,
  Settings,
  Trash2,
  Upload,
  Video,
} from "lucide-react";
import { RenderuimLogo } from "@/components/icons/renderuim";
import { LogoutButton } from "@/components/navigation/logout-button";
import { ToolPickerPopover } from "@/components/navigation/ToolPickerPopover";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toolsByCategory, type ToolCategory } from "@/config/tools";
import type { DbUser } from "@/lib/db/queries";

interface AppSidebarProps {
  user: DbUser;
  open: boolean;
  mobileOpen: boolean;
  onToggle: () => void;
  showToggle?: boolean;
}

interface NavLinkProps {
  href: string;
  icon: ComponentType<{ className?: string }>;
  label: string;
  active: boolean;
  collapsed: boolean;
}

function NavLink({ href, icon: Icon, label, active, collapsed }: NavLinkProps) {
  return (
    <Button
      variant="ghost"
      size="sm"
      asChild
      className={cn(
        "h-8 w-full justify-start gap-2 rounded-lg px-4 text-xs font-medium",
        collapsed && "justify-center px-0",
        active
          ? "bg-accent text-foreground hover:bg-accent"
          : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
      )}
      title={label}
    >
      <Link href={href} aria-current={active ? "page" : undefined}>
        <Icon className="h-3.5 w-3.5 shrink-0" />
        {!collapsed && <span className="min-w-0 truncate">{label}</span>}
      </Link>
    </Button>
  );
}

function ToolCategoryLink({
  category,
  pathname,
  icon: Icon,
  label,
  collapsed,
}: {
  category: ToolCategory;
  pathname: string;
  icon: ComponentType<{ className?: string }>;
  label: string;
  collapsed: boolean;
}) {
  const active = toolsByCategory(category).some((tool) =>
    pathname.startsWith(tool.route.split("?")[0]),
  );

  return (
    <ToolPickerPopover category={category} placement="right">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className={cn(
          "h-8 w-full justify-start gap-2 rounded-lg px-4 text-xs font-medium",
          collapsed && "justify-center px-0",
          active
            ? "bg-accent text-foreground hover:bg-accent"
            : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
        )}
        aria-label={`${label} tools`}
        title={label}
      >
        <Icon className="h-3.5 w-3.5 shrink-0" />
        {!collapsed && <span className="truncate">{label}</span>}
      </Button>
    </ToolPickerPopover>
  );
}

export function AppSidebar({
  user,
  open,
  mobileOpen,
  onToggle,
  showToggle = true,
}: AppSidebarProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const projectView = searchParams.get("view");
  const isProjectsOverview = pathname === "/app/projects" && (!projectView || projectView === "overview");
  const isAllProjects = pathname === "/app/projects" && projectView === "projects";
  const isAllAssets = pathname === "/app/projects" && projectView === "assets";
  const isFavorites = pathname === "/app/projects" && projectView === "favorites";
  const [isMobileViewport, setIsMobileViewport] = useState(false);
  const sidebarRef = useRef<HTMLElement>(null);
  const collapsed = !open;

  useEffect(() => {
    const media = window.matchMedia("(max-width: 767px)");
    const updateViewport = () => setIsMobileViewport(media.matches);
    updateViewport();
    media.addEventListener("change", updateViewport);
    return () => media.removeEventListener("change", updateViewport);
  }, []);

  useEffect(() => {
    if (sidebarRef.current) {
      sidebarRef.current.inert = isMobileViewport && !mobileOpen;
    }
  }, [isMobileViewport, mobileOpen]);

  return (
    <aside
      ref={sidebarRef}
      aria-hidden={isMobileViewport && !mobileOpen}
      className={cn(
        "fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r bg-background shadow-xl transition-transform duration-200 ease-in-out md:sticky md:top-0 md:z-auto md:w-auto md:shrink-0 md:shadow-none md:transition-[width]",
        mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0",
        collapsed ? "md:w-16" : "md:w-64",
      )}
      style={{ height: "100dvh", maxHeight: "100dvh" }}
      aria-label="Primary navigation"
    >
      <div className="flex h-14 shrink-0 items-center justify-between gap-2 border-b px-3">
        {!collapsed && (
          <Link href="/app/dashboard" className="flex min-w-0 items-center gap-2 text-foreground">
            <RenderuimLogo className="h-6 w-6 shrink-0" />
            <span className="truncate font-semibold">Renderuim</span>
          </Link>
        )}
        {showToggle && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onToggle}
            aria-label="Toggle sidebar"
            className="hidden h-8 w-8 shrink-0 md:flex"
          >
            <Menu className="h-5 w-5" />
          </Button>
        )}
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-2.5 py-3">
        <ToolPickerPopover>
          <Button
            type="button"
            variant="default"
            size="sm"
            className={cn(
              "h-9 w-full justify-start gap-2 rounded-lg px-3",
              collapsed && "justify-center px-0",
            )}
            aria-label="Create"
          >
            <Plus className="h-4 w-4 shrink-0" />
            {!collapsed && <span className="text-sm">Create</span>}
          </Button>
        </ToolPickerPopover>

        <section className="flex flex-col gap-0.5">
          {!collapsed && (
            <p className="px-3 pb-1 text-xs font-semibold tracking-wider text-muted-foreground">
              WORKSPACE
            </p>
          )}
          <nav aria-label="Workspace" className="flex flex-col gap-0.5">
            <NavLink href="/app/dashboard" icon={Home} label="Home" active={pathname === "/app/dashboard"} collapsed={collapsed} />
            <NavLink
              href="/app/projects"
              icon={FolderOpen}
              label="Projects"
              active={isProjectsOverview}
              collapsed={collapsed}
            />
            <NavLink
              href="/app/projects?view=projects"
              icon={FolderOpen}
              label="All projects"
              active={isAllProjects}
              collapsed={collapsed}
            />
          </nav>
        </section>

        <section className="flex shrink-0 flex-col gap-0.5 border-t border-border pt-3">
          {!collapsed && (
            <p className="px-3 pb-1 text-xs font-semibold tracking-wider text-muted-foreground">
              GENERATE
            </p>
          )}
          <ToolCategoryLink category="image" pathname={pathname} icon={ImageIcon} label="Image" collapsed={collapsed} />
          <ToolCategoryLink category="video" pathname={pathname} icon={Video} label="Video" collapsed={collapsed} />
          <ToolCategoryLink category="3d" pathname={pathname} icon={Box} label="3D" collapsed={collapsed} />
          <ToolCategoryLink category="audio" pathname={pathname} icon={Mic} label="Audio" collapsed={collapsed} />
        </section>

        <section className="flex shrink-0 flex-col gap-0.5 border-t border-border pt-3">
          {!collapsed && (
            <p className="px-3 pb-1 text-xs font-semibold tracking-wider text-muted-foreground">
              LIBRARY
            </p>
          )}
          <nav aria-label="Library" className="flex flex-col gap-0.5">
            <NavLink href="/app/projects?view=assets" icon={ImageIcon} label="All assets" active={isAllAssets} collapsed={collapsed} />
            <NavLink href="/app/projects?view=favorites" icon={Heart} label="Favorites" active={isFavorites || pathname.startsWith("/app/favorites")} collapsed={collapsed} />
            <NavLink href="/app/uploads" icon={Upload} label="Uploads" active={pathname.startsWith("/app/uploads")} collapsed={collapsed} />
            <NavLink href="/app/trash" icon={Trash2} label="Trash" active={pathname.startsWith("/app/trash")} collapsed={collapsed} />
          </nav>
        </section>
      </div>
      <div className="flex shrink-0 flex-col gap-1.5 border-t p-2.5">
        <NavLink href="/app/settings" icon={Settings} label="Settings" active={pathname.startsWith("/app/settings")} collapsed={collapsed} />
        <div className="border-t pt-2">
          {!collapsed && <p className="truncate px-3 pb-1 text-xs text-muted-foreground">{user.email}</p>}
          <LogoutButton collapsed={collapsed} className="h-8 w-full justify-start px-3" />
        </div>

      </div>
    </aside>
  );
}