"use client";

import { type ComponentType, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Box,
  FolderOpen,
  Heart,
  Home,
  Image as ImageIcon,
  Menu,
  Mic,
  Settings,
  Trash2,
  Type,
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
        "group/nav relative h-9 w-full justify-start gap-3 rounded-xl border border-transparent px-3 text-sm font-medium transition-colors duration-150",
        "before:absolute before:bottom-2 before:left-1.5 before:top-2 before:w-0.5 before:rounded-full before:transition-colors",
        collapsed && "h-10 justify-center gap-0 px-0 before:hidden",
        active
          ? "border-primary/15 bg-primary/10 text-foreground shadow-sm before:bg-primary hover:bg-primary/10"
          : "text-muted-foreground hover:border-border/60 hover:bg-accent/70 hover:text-foreground before:bg-transparent",
      )}
      title={collapsed ? label : undefined}
    >
      <Link href={href} aria-current={active ? "page" : undefined}>
        <Icon
          className={cn(
            "h-4 w-4 shrink-0 transition-colors",
            active ? "text-primary" : "text-muted-foreground group-hover/nav:text-foreground",
          )}
          aria-hidden="true"
        />
        {!collapsed ? (
          <span className="min-w-0 flex-1 truncate">{label}</span>
        ) : (
          <span className="sr-only">{label}</span>
        )}
      </Link>
    </Button>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="px-3 pb-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground/75">
      {children}
    </p>
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
        aria-label={`${label} tools`}
        title={collapsed ? `${label} tools` : undefined}
        className={cn(
          "group/nav relative h-9 w-full justify-start gap-3 rounded-xl border border-transparent px-3 text-sm font-medium transition-colors duration-150",
          "before:absolute before:bottom-2 before:left-1.5 before:top-2 before:w-0.5 before:rounded-full before:transition-colors",
          collapsed && "h-10 justify-center gap-0 px-0 before:hidden",
          active
            ? "border-primary/15 bg-primary/10 text-foreground shadow-sm before:bg-primary hover:bg-primary/10"
            : "text-muted-foreground hover:border-border/60 hover:bg-accent/70 hover:text-foreground before:bg-transparent",
        )}
      >
        <Icon
          className={cn(
            "h-4 w-4 shrink-0 transition-colors",
            active ? "text-primary" : "text-muted-foreground group-hover/nav:text-foreground",
          )}
          aria-hidden="true"
        />
        {!collapsed ? <span className="min-w-0 flex-1 truncate">{label}</span> : <span className="sr-only">{label}</span>}
      </Button>
    </ToolPickerPopover>
  );
}

function initialsFromEmail(email: string) {
  const userPart = email.split("@")[0]?.trim() ?? "";
  return userPart.slice(0, 2).toUpperCase() || "RU";
}

export function AppSidebar({
  user,
  open,
  mobileOpen,
  onToggle,
  showToggle = true,
}: AppSidebarProps) {
  const pathname = usePathname();
  const [isMobileViewport, setIsMobileViewport] = useState(false);
  const sidebarRef = useRef<HTMLElement>(null);

  // Sur mobile, le tiroir reste toujours développé, même si la sidebar desktop a été réduite.
  const collapsed = !open && !isMobileViewport;

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

  const isLibraryContext =
    pathname.startsWith("/app/projects") ||
    pathname.startsWith("/app/uploads") ||
    pathname.startsWith("/app/trash");

  return (
    <aside
      ref={sidebarRef}
      aria-hidden={isMobileViewport && !mobileOpen}
      className={cn(
        "fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r border-border/80 bg-background/95 shadow-xl backdrop-blur-xl transition-transform duration-200 ease-out md:sticky md:top-0 md:z-auto md:shrink-0 md:shadow-none md:transition-[width]",
        mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0",
        collapsed ? "md:w-16" : "md:w-64",
      )}
      style={{ height: "100dvh", maxHeight: "100dvh" }}
      aria-label="Primary navigation"
    >
      <div
        className={cn(
          "flex h-16 shrink-0 items-center justify-between border-b border-border/70",
          collapsed ? "gap-0 px-1.5" : "gap-2 px-3",
        )}
      >
        <Link
          href="/app/dashboard"
          aria-label="Renderuim home"
          title={collapsed ? "Renderuim" : undefined}
          className={cn(
            "flex min-w-0 items-center rounded-xl text-foreground outline-none transition-opacity hover:opacity-85 focus-visible:ring-2 focus-visible:ring-ring",
            collapsed ? "shrink-0 justify-center" : "flex-1 gap-2.5 px-1.5",
          )}
        >
          <RenderuimLogo className={cn("shrink-0", collapsed ? "h-6 w-6" : "h-7 w-7")} />
          {!collapsed && (
            <span className="truncate text-[15px] font-semibold tracking-[-0.025em]">
              Renderuim
            </span>
          )}
        </Link>

        {showToggle && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onToggle}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-expanded={!collapsed}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className={cn(
              "hidden h-8 w-8 shrink-0 rounded-lg text-muted-foreground hover:text-foreground md:flex",
              collapsed && "h-7 w-7",
            )}
          >
            <Menu className="h-4 w-4" aria-hidden="true" />
          </Button>
        )}
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto overscroll-contain px-2.5 py-4">


        <section className="flex flex-col gap-1" aria-label="Workspace navigation">
          {!collapsed && <SectionLabel>Workspace</SectionLabel>}
          <nav aria-label="Workspace" className="flex flex-col gap-1">
            <NavLink
              href="/app/dashboard"
              icon={Home}
              label="Home"
              active={pathname === "/app/dashboard"}
              collapsed={collapsed}
            />
            <NavLink
              href="/app/projects"
              icon={FolderOpen}
              label="Projects"
              active={pathname.startsWith("/app/projects")}
              collapsed={collapsed}
            />
          </nav>
        </section>

        <section className="flex shrink-0 flex-col gap-1 border-t border-border/70 pt-4" aria-label="Generation tools">
          {!collapsed && <SectionLabel>Generate</SectionLabel>}
          <nav aria-label="Generate tools" className="flex flex-col gap-1">
            <ToolCategoryLink category="image" pathname={pathname} icon={ImageIcon} label="Image" collapsed={collapsed} />
            <ToolCategoryLink category="video" pathname={pathname} icon={Video} label="Video" collapsed={collapsed} />
            <ToolCategoryLink category="audio" pathname={pathname} icon={Mic} label="Audio" collapsed={collapsed} />
            <ToolCategoryLink category="3d" pathname={pathname} icon={Box} label="3D" collapsed={collapsed} />
            <NavLink
              href="/app/image2"
              icon={Type}
              label="Image 2"
              active={pathname.startsWith("/app/image2")}
              collapsed={collapsed}
            />
          </nav>
        </section>

        {!isLibraryContext && (
          <section className="flex shrink-0 flex-col gap-1 border-t border-border/70 pt-4" aria-label="Asset library navigation">
            {!collapsed && <SectionLabel>Library</SectionLabel>}
            <nav aria-label="Library" className="flex flex-col gap-1">
              <NavLink
                href="/app/favorites"
                icon={Heart}
                label="Favorites"
                active={pathname.startsWith("/app/favorites")}
                collapsed={collapsed}
              />
              <NavLink
                href="/app/uploads"
                icon={Upload}
                label="Uploads"
                active={pathname.startsWith("/app/uploads")}
                collapsed={collapsed}
              />
              <NavLink
                href="/app/trash"
                icon={Trash2}
                label="Trash"
                active={pathname.startsWith("/app/trash")}
                collapsed={collapsed}
              />
            </nav>
          </section>
        )}
      </div>

      <footer className="flex shrink-0 flex-col gap-2 border-t border-border/70 p-2.5">
        <NavLink
          href="/app/settings"
          icon={Settings}
          label="Settings"
          active={pathname.startsWith("/app/settings")}
          collapsed={collapsed}
        />

        {!collapsed && (
          <div className="flex min-w-0 items-center gap-2.5 rounded-xl border border-border/70 bg-card/65 px-2.5 py-2">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted text-xs font-semibold text-foreground">
              {initialsFromEmail(user.email)}
            </span>
            <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground" title={user.email}>
              {user.email}
            </span>
          </div>
        )}

        <LogoutButton
          collapsed={collapsed}
          className={cn(
            "h-9 w-full rounded-xl transition-colors hover:bg-destructive/5 hover:text-destructive",
            collapsed ? "justify-center px-0" : "justify-start px-3",
          )}
        />
      </footer>
    </aside>
  );
}
