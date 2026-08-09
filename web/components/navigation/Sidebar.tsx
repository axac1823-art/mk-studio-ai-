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
  Plus,
  Search,
  Settings,
  Star,
  Trash2,
  Upload,
  User,
  Video,
  CreditCard,
  LogOut,
  Bell,
} from "lucide-react";

import { ToolPickerPopover } from "@/components/navigation/ToolPickerPopover";
import { cn } from "@/lib/utils";
import { TOOLS } from "@/config/tools";
import { CreditAlert } from "@/components/billing/credit-alert";
import { useJobNotifications } from "@/components/jobs/job-notifications";
import type { DbUser } from "@/lib/db/queries";

const IMAGE_ROUTES = TOOLS.filter((tool) => tool.category === "image").map((tool) => tool.route);
const VIDEO_ROUTE = TOOLS.find((tool) => tool.category === "video")?.route ?? "/app/ai-video-generator";

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
}

function NavLink({ href, icon: Icon, label, active }: NavLinkProps) {
  return (
    <Link
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
}

function NotificationBell() {
  const { unseenCount, markAllSeen } = useJobNotifications();

  return (
    <button
      type="button"
      onClick={() => {
        markAllSeen();
        window.location.href = "/app/projects";
      }}
      className="relative flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground md:h-auto md:w-auto md:justify-start md:px-3"
      aria-label="Notifications"
    >
      <Bell className="h-4 w-4" />
      <span className="hidden md:ml-2 md:inline">Notifications</span>
      {unseenCount > 0 && (
        <span className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground md:relative md:right-auto md:top-auto md:ml-auto">
          {unseenCount > 9 ? "9+" : unseenCount}
        </span>
      )}
    </button>
  );
}

interface AppSidebarProps {
  user: DbUser;
  balance: number;
  lowThreshold: number;
}

export function AppSidebar({ user, balance, lowThreshold }: AppSidebarProps) {
  const pathname = usePathname();
  const isImageActive = IMAGE_ROUTES.some((route) => pathname.startsWith(route));
  const isVideoActive = pathname.startsWith(VIDEO_ROUTE);

  return (
    <aside className="flex w-16 shrink-0 flex-col border-r bg-background md:w-64">
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
        {TOP_LINK_ITEMS.map(({ href, label, icon }) => (
          <NavLink key={href} href={href} icon={icon} label={label} active={pathname.startsWith(href)} />
        ))}

        <ToolPickerPopover defaultTab="image" placement="right">
          <button
            type="button"
            className={cn(
              "flex items-center justify-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors md:justify-start",
              isImageActive
                ? "bg-accent text-foreground"
                : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"
            )}
            aria-label="Image tools"
          >
            <ImageIcon className="h-4 w-4" />
            <span className="hidden md:inline">Image</span>
          </button>
        </ToolPickerPopover>

        <ToolPickerPopover defaultTab="video" placement="right">
          <button
            type="button"
            className={cn(
              "flex items-center justify-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors md:justify-start",
              isVideoActive
                ? "bg-accent text-foreground"
                : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"
            )}
            aria-label="Video tools"
          >
            <Video className="h-4 w-4" />
            <span className="hidden md:inline">Video</span>
          </button>
        </ToolPickerPopover>
      </nav>

      <div className="mt-auto flex flex-col gap-3 p-3">
        <CreditAlert balance={balance} threshold={lowThreshold} />

        <Link
          href="/app/pricing"
          className="flex items-center justify-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground md:justify-start"
        >
          <CreditCard className="h-4 w-4" />
          <span className="hidden md:inline">{balance.toLocaleString()} credits</span>
        </Link>

        <NotificationBell />

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

        <div className="hidden flex-col gap-1 border-t pt-3 md:flex">
          <p className="truncate px-3 text-xs text-muted-foreground">{user.email}</p>
          <Link
            href="/logout"
            className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </Link>
        </div>

        <Link
          href="/logout"
          className="flex items-center justify-center rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground md:hidden"
          aria-label="Sign out"
        >
          <LogOut className="h-4 w-4" />
        </Link>
      </div>
    </aside>
  );
}
