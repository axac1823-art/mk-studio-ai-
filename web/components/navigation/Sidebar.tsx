"use client";

// Sidebar persistente de la section /app.
// Réutilise le même ToolPickerPopover que le dashboard pour les déclencheurs
// "+" rapide et les catégories Image/Video, afin d'éviter toute divergence.
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Box,
  FolderOpen,
  Home,
  Image,
  Plus,
  Search,
  Settings,
  Star,
  Trash2,
  Upload,
  User,
  Video,
} from "lucide-react";

import { ToolPickerPopover } from "@/components/navigation/ToolPickerPopover";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/app/dashboard", label: "Home", icon: Home },
  { href: "/app/search", label: "Search", icon: Search },
  { href: "/app/projects", label: "Projects", icon: FolderOpen },
  { href: "/app/favorites", label: "Favorites", icon: Star },
  { href: "/app/uploads", label: "Uploads", icon: Upload },
  { href: "/app/trash", label: "Trash", icon: Trash2 },
] as const;

export function AppSidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex w-16 shrink-0 flex-col border-r bg-background md:w-56">
      <div className="flex flex-col gap-2 p-3">
        <Link
          href="/app/dashboard"
          className="flex h-10 items-center justify-center gap-2 rounded-md text-foreground md:justify-start md:px-3"
        >
          <Box className="h-6 w-6" />
          <span className="hidden font-semibold md:inline">RenderStudio</span>
        </Link>

        <ToolPickerPopover defaultTab="image" placement="right">
          <button
            type="button"
            className="flex h-9 w-9 items-center justify-center rounded-md bg-primary text-primary-foreground transition-colors hover:bg-primary/90 md:w-full md:gap-2 md:px-3"
            aria-label="Create new"
          >
            <Plus className="h-4 w-4" />
            <span className="hidden text-sm font-medium md:inline">Create</span>
          </button>
        </ToolPickerPopover>
      </div>

      <nav className="flex flex-col gap-1 p-3">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex items-center justify-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors md:justify-start",
                active
                  ? "bg-accent text-foreground"
                  : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"
              )}
            >
              <Icon className="h-4 w-4" />
              <span className="hidden md:inline">{label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="mx-3 my-2 h-px bg-border" />

      <div className="flex flex-col gap-1 p-3">
        <ToolPickerPopover defaultTab="image" placement="right">
          <button
            type="button"
            className={cn(
              "flex items-center justify-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors md:justify-start",
              pathname.startsWith("/app/studio")
                ? "bg-accent text-foreground"
                : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"
            )}
            aria-label="Image tools"
          >
            <Image className="h-4 w-4" />
            <span className="hidden md:inline">Image</span>
          </button>
        </ToolPickerPopover>

        <ToolPickerPopover defaultTab="video" placement="right">
          <button
            type="button"
            className={cn(
              "flex items-center justify-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors md:justify-start",
              pathname.startsWith("/app/video")
                ? "bg-accent text-foreground"
                : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"
            )}
            aria-label="Video tools"
          >
            <Video className="h-4 w-4" />
            <span className="hidden md:inline">Video</span>
          </button>
        </ToolPickerPopover>
      </div>

      <div className="mt-auto flex flex-col gap-1 p-3">
        <Link
          href="/app/settings"
          className={cn(
            "flex items-center justify-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors md:justify-start",
            pathname.startsWith("/app/settings")
              ? "bg-accent text-foreground"
              : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"
          )}
        >
          <Settings className="h-4 w-4" />
          <span className="hidden md:inline">Settings</span>
        </Link>
        <Link
          href="/app/account"
          className={cn(
            "flex items-center justify-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors md:justify-start",
            pathname.startsWith("/app/account")
              ? "bg-accent text-foreground"
              : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"
          )}
        >
          <User className="h-4 w-4" />
          <span className="hidden md:inline">Account</span>
        </Link>
      </div>
    </aside>
  );
}
