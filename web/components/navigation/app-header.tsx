"use client";

import { usePathname } from "next/navigation";
import { Bell, Zap } from "lucide-react";

import { Button } from "@/components/ui/button";
import { DashboardSearch } from "@/components/navigation/DashboardSearch";
import { UserMenu } from "@/components/navigation/user-menu";
import { useJobNotifications } from "@/components/jobs/job-notifications";
import type { DbUser } from "@/lib/db/queries";

interface AppHeaderProps {
  user: DbUser;
  balance: number;
}

function HeaderNotificationBell() {
  const { unseenCount, markAllSeen } = useJobNotifications();

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      onClick={() => {
        markAllSeen();
        window.location.href = "/app/projects";
      }}
      className="relative h-9 w-9"
      aria-label="Notifications"
    >
      <Bell className="h-[1.1rem] w-[1.1rem]" />
      {unseenCount > 0 && (
        <span className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
          {unseenCount > 9 ? "9+" : unseenCount}
        </span>
      )}
    </Button>
  );
}

function getPageContext(pathname: string): string {
  if (pathname === "/app/dashboard") return "Home";
  if (pathname.startsWith("/app/projects")) return "Projects";
  if (
    pathname.startsWith("/app/favorites") ||
    pathname.startsWith("/app/uploads") ||
    pathname.startsWith("/app/trash")
  ) {
    return "Library";
  }
  if (pathname.startsWith("/app/settings")) return "Settings";

  if (
    pathname.startsWith("/app/ai-image-generator") ||
    pathname.startsWith("/app/image-") ||
    pathname.startsWith("/app/image-generator") ||
    pathname.startsWith("/app/ambiance-change") ||
    pathname.startsWith("/app/plan-to-render") ||
    pathname.startsWith("/app/multi-angle") ||
    pathname.startsWith("/app/variations") ||
    pathname.startsWith("/app/upscale") ||
    pathname.startsWith("/app/background-remover") ||
    pathname.startsWith("/app/exterior-to-interior")
  ) return "Image";

  if (
    pathname.startsWith("/app/ai-video-generator") ||
    pathname.startsWith("/app/video-") ||
    pathname.startsWith("/app/clip-editor")
  ) return "Video";

  if (
    pathname.startsWith("/app/voice") ||
    pathname.startsWith("/app/audio")
  ) return "Audio";

  if (
    pathname.startsWith("/app/3d") ||
    pathname.startsWith("/app/3d-generator") ||
    pathname.startsWith("/app/text-to-3d")
  ) return "3D";

  return "Workspace";
}

export function AppHeader({ user, balance }: AppHeaderProps) {
  const pathname = usePathname();
  const pageContext = getPageContext(pathname);

  return (
    <header className="sticky top-0 z-30 flex h-14 w-full items-center gap-4 border-b bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/80 sm:px-5">
      <div className="min-w-0 shrink-0">
        <span className="truncate text-sm font-medium text-foreground">{pageContext}</span>
      </div>

      <div className="hidden min-w-0 flex-1 justify-center sm:flex">
        <DashboardSearch compact placeholder="Search tools..." />
      </div>

      <div className="ml-auto flex shrink-0 items-center gap-1 sm:gap-2">
        <Button
          asChild
          variant="ghost"
          size="sm"
          className="hidden gap-1.5 text-foreground sm:flex"
        >
          <a href="/pricing">
            <Zap className="h-4 w-4 text-amber-400" />
            {balance.toLocaleString()} credits
          </a>
        </Button>

        <Button
          asChild
          variant="ghost"
          size="icon"
          className="h-9 w-9 sm:hidden"
          aria-label="Credits"
        >
          <a href="/pricing">
            <Zap className="h-[1.1rem] w-[1.1rem] text-amber-400" />
          </a>
        </Button>

        <HeaderNotificationBell />
        <UserMenu user={user} />
      </div>
    </header>
  );
}
