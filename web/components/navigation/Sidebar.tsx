"use client";

import { type ComponentType } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Box,
  CreditCard,
  FolderOpen,
  Home,
  Image as ImageIcon,
  Menu,
  Mic,
  Search,
  Settings,
  Video,
} from "lucide-react";

import { CreditAlert } from "@/components/billing/credit-alert";
import { RenderuimLogo } from "@/components/icons/renderuim";
import { LogoutButton } from "@/components/navigation/logout-button";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { DbUser } from "@/lib/db/queries";

interface AppSidebarProps {
  user: DbUser;
  balance: number;
  lowThreshold: number;
  open: boolean;
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
        {!collapsed && <span className="hidden min-w-0 truncate md:inline">{label}</span>}
      </Link>
    </Button>
  );
}

export function AppSidebar({
  user,
  balance,
  lowThreshold,
  open,
  onToggle,
  showToggle = true,
}: AppSidebarProps) {
  const pathname = usePathname();
  const collapsed = !open;

  return (
    <aside
      className={cn(
        "sticky top-0 flex shrink-0 flex-col border-r bg-background transition-[width] duration-200 ease-in-out",
        collapsed ? "w-0 md:w-16" : "w-16 md:w-64",
      )}
      style={{ height: "100vh", maxHeight: "100vh" }}
    >
      <div className="flex h-14 shrink-0 items-center justify-between gap-2 border-b px-3">
        {!collapsed && (
          <Link href="/app/dashboard" className="hidden min-w-0 items-center gap-2 text-foreground md:flex">
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
            className="h-8 w-8 shrink-0"
          >
            <Menu className="h-5 w-5" />
          </Button>
        )}
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto px-2.5 py-3">
        <nav aria-label="Main navigation" className="flex shrink-0 flex-col gap-0.5">
          <NavLink href="/app/dashboard" icon={Home} label="Home" active={pathname === "/app/dashboard"} collapsed={collapsed} />
          <NavLink href="/app/search" icon={Search} label="Search" active={pathname.startsWith("/app/search")} collapsed={collapsed} />
          <NavLink
            href="/app/projects"
            icon={FolderOpen}
            label="Projects"
            active={pathname.startsWith("/app/projects")}
            collapsed={collapsed}
          />
        </nav>

        {!collapsed && (
          <section className="hidden shrink-0 flex-col gap-0.5 border-t border-border pt-2 md:flex">
            <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">Create</p>
            <NavLink href="/app/ai-image-generator" icon={ImageIcon} label="Image" active={pathname.startsWith("/app/ai-image-generator")} collapsed={false} />
            <NavLink href="/app/ai-video-generator" icon={Video} label="Video" active={pathname.startsWith("/app/ai-video-generator")} collapsed={false} />
            <NavLink href="/app/voice-generator" icon={Mic} label="Audio" active={pathname.startsWith("/app/voice-generator")} collapsed={false} />
            <NavLink href="/app/3d-generator" icon={Box} label="3D" active={pathname.startsWith("/app/3d-generator")} collapsed={false} />
          </section>
        )}
      </div>

      <div className="flex shrink-0 flex-col gap-1.5 border-t p-2.5">
        <CreditAlert balance={balance} threshold={lowThreshold} />
        <Button
          variant="ghost"
          size="sm"
          asChild
          className={cn("h-8 w-full justify-start gap-2 px-3 text-muted-foreground hover:text-foreground", collapsed && "justify-center px-0")}
          title="Credits"
        >
          <Link href="/pricing">
            <CreditCard className="h-3.5 w-3.5 shrink-0" />
            {!collapsed && <span className="hidden text-xs md:inline">{balance.toLocaleString()} credits</span>}
          </Link>
        </Button>
        <NavLink href="/app/settings" icon={Settings} label="Settings" active={pathname.startsWith("/app/settings")} collapsed={collapsed} />
        <div className="hidden border-t pt-2 md:block">
          {!collapsed && <p className="truncate px-3 pb-1 text-xs text-muted-foreground">{user.email}</p>}
          <LogoutButton collapsed={collapsed} className="h-8 w-full justify-start px-3" />
        </div>
        <div className="md:hidden">
          <LogoutButton collapsed className="h-8 w-full justify-center px-0" aria-label="Sign out" />
        </div>
      </div>
    </aside>
  );
}
