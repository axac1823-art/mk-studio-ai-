"use client";

// Sidebar persistente de la section /app.
// Réutilise le même ToolPickerPopover que le dashboard pour les déclencheurs
// "+" rapides et les catégories Image/Video.
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Box,
  FolderOpen,
  Home,
  Image as ImageIcon,
  Menu,
  Mic,
  Plus,
  Search,
  Settings,
  Star,
  Trash2,
  Upload,
  Video,
  CreditCard,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { RenderuimLogo } from "@/components/icons/renderuim";
import { ToolPickerPopover } from "@/components/navigation/ToolPickerPopover";
import { LogoutButton } from "@/components/navigation/logout-button";
import { cn } from "@/lib/utils";
import { TOOLS } from "@/config/tools";
import { CreditAlert } from "@/components/billing/credit-alert";
import type { DbUser } from "@/lib/db/queries";

const IMAGE_ROUTES = TOOLS.filter((tool) => tool.category === "image").map((tool) => tool.route);
const VIDEO_ROUTE = TOOLS.find((tool) => tool.category === "video")?.route ?? "/app/ai-video-generator";
const AUDIO_ROUTE = TOOLS.find((tool) => tool.category === "audio")?.route ?? "/app/voice-generator";
const THREED_ROUTE = TOOLS.find((tool) => tool.category === "3d")?.route ?? "/app/3d-generator";

const TOP_LINK_ITEMS = [
  { href: "/app/dashboard", label: "Home", icon: Home },
  { href: "/app/search", label: "Search", icon: Search },
  { href: "/app/projects", label: "Projects", icon: FolderOpen },
  { href: "/app/favorites", label: "Favorites", icon: Star },
  { href: "/app/uploads", label: "Uploads", icon: Upload },
  { href: "/app/trash", label: "Trash", icon: Trash2 },
] as const;

interface NavLinkProps {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
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
        "h-9 w-full items-center justify-center gap-3 px-3 transition-colors",
        collapsed ? "justify-center px-0" : "md:justify-start",
        active
          ? "bg-accent text-foreground hover:bg-accent"
          : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"
      )}
      title={label}
    >
      <Link href={href} aria-current={active ? "page" : undefined}>
        <Icon className="h-4 w-4 shrink-0" />
        {!collapsed && <span className="hidden md:inline">{label}</span>}
      </Link>
    </Button>
  );
}

interface AppSidebarProps {
  user: DbUser;
  balance: number;
  lowThreshold: number;
  open: boolean;
  onToggle: () => void;
}

export function AppSidebar({ user, balance, lowThreshold, open, onToggle }: AppSidebarProps) {
  const pathname = usePathname();
  const collapsed = !open;
  const isImageActive = IMAGE_ROUTES.some((route) => pathname.startsWith(route));
  const isVideoActive = pathname.startsWith(VIDEO_ROUTE);
  const isAudioActive = pathname.startsWith(AUDIO_ROUTE);
  const is3dActive = pathname.startsWith(THREED_ROUTE);

  return (
    <aside
      className={cn(
        "sticky top-0 flex shrink-0 flex-col border-r bg-background transition-[width] duration-200 ease-in-out",
        collapsed ? "w-0 md:w-16" : "w-16 md:w-64"
      )}
      style={{ height: "100vh", maxHeight: "100vh" }}
    >
      <div className="flex flex-col gap-2 overflow-hidden p-3">
        <div
          className={cn(
            "flex h-10 items-center justify-center gap-2",
            !collapsed && "md:justify-between md:px-3"
          )}
        >
          {!collapsed && (
            <Link
              href="/app/dashboard"
              className="flex items-center gap-2 text-foreground"
            >
              <RenderuimLogo className="h-6 w-6 shrink-0" />
              <span className="hidden font-semibold md:inline">Renderuim</span>
            </Link>
          )}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onToggle}
            aria-label="Toggle sidebar"
            className="h-9 w-9 shrink-0"
          >
            <Menu className="h-5 w-5" />
          </Button>
        </div>

        <ToolPickerPopover defaultTab="image" placement="right">
          <Button
            type="button"
            size="sm"
            className={cn(
              "h-9 items-center justify-center rounded-md p-0",
              collapsed ? "w-9" : "w-9 md:w-full md:gap-2 md:px-3"
            )}
            aria-label="Create new"
          >
            <Plus className="h-4 w-4 shrink-0" />
            {!collapsed && <span className="hidden text-sm font-medium md:inline">Create</span>}
          </Button>
        </ToolPickerPopover>
      </div>

      <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-3">
        {TOP_LINK_ITEMS.map(({ href, label, icon }) => (
          <NavLink
            key={href}
            href={href}
            icon={icon}
            label={label}
            active={pathname.startsWith(href)}
            collapsed={collapsed}
          />
        ))}

        <ToolPickerPopover category="image" placement="right">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className={cn(
              "h-9 w-full items-center justify-center gap-3 px-3 transition-colors",
              collapsed ? "px-0" : "md:justify-start",
              isImageActive
                ? "bg-accent text-foreground hover:bg-accent"
                : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"
            )}
            aria-label="Image tools"
            title="Image"
          >
            <ImageIcon className="h-4 w-4 shrink-0" />
            {!collapsed && <span className="hidden md:inline">Image</span>}
          </Button>
        </ToolPickerPopover>

        <ToolPickerPopover category="video" placement="right">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className={cn(
              "h-9 w-full items-center justify-center gap-3 px-3 transition-colors",
              collapsed ? "px-0" : "md:justify-start",
              isVideoActive
                ? "bg-accent text-foreground hover:bg-accent"
                : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"
            )}
            aria-label="Video tools"
            title="Video"
          >
            <Video className="h-4 w-4 shrink-0" />
            {!collapsed && <span className="hidden md:inline">Video</span>}
          </Button>
        </ToolPickerPopover>

        <ToolPickerPopover category="audio" placement="right">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className={cn(
              "h-9 w-full items-center justify-center gap-3 px-3 transition-colors",
              collapsed ? "px-0" : "md:justify-start",
              isAudioActive
                ? "bg-accent text-foreground hover:bg-accent"
                : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"
            )}
            aria-label="Audio tools"
            title="Audio"
          >
            <Mic className="h-4 w-4 shrink-0" />
            {!collapsed && <span className="hidden md:inline">Audio</span>}
          </Button>
        </ToolPickerPopover>

        <ToolPickerPopover category="3d" placement="right">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className={cn(
              "h-9 w-full items-center justify-center gap-3 px-3 transition-colors",
              collapsed ? "px-0" : "md:justify-start",
              is3dActive
                ? "bg-accent text-foreground hover:bg-accent"
                : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"
            )}
            aria-label="3D tools"
            title="3D"
          >
            <Box className="h-4 w-4 shrink-0" />
            {!collapsed && <span className="hidden md:inline">3D</span>}
          </Button>
        </ToolPickerPopover>
      </nav>

      <div className="mt-auto flex flex-col gap-2 overflow-hidden p-3">
        <CreditAlert balance={balance} threshold={lowThreshold} />

        <Button
          variant="ghost"
          size="sm"
          asChild
          className={cn(
            "h-9 w-full items-center justify-center gap-3 px-3 text-muted-foreground hover:text-foreground",
            collapsed ? "px-0" : "md:justify-start"
          )}
          title="Credits"
        >
          <Link href="/app/pricing">
            <CreditCard className="h-4 w-4 shrink-0" />
            {!collapsed && <span className="hidden md:inline">{balance.toLocaleString()} credits</span>}
          </Link>
        </Button>

        <NavLink
          href="/app/settings"
          icon={Settings}
          label="Settings"
          active={pathname.startsWith("/app/settings")}
          collapsed={collapsed}
        />

        <div className={cn("hidden flex-col gap-1 border-t pt-3", !collapsed && "md:flex")}>
          <p className="truncate px-3 text-xs text-muted-foreground">{user.email}</p>
          <LogoutButton
            collapsed={collapsed}
            className="h-9 w-full items-center justify-start px-3"
          />
        </div>

        <LogoutButton
          collapsed={collapsed}
          className={cn(
            "h-9 w-full items-center justify-center px-3 md:hidden",
            collapsed && "px-0"
          )}
          aria-label="Sign out"
        />
      </div>
    </aside>
  );
}
