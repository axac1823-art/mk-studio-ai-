"use client";

import Link from "next/link";
import { Zap, Bell } from "lucide-react";

import { Button } from "@/components/ui/button";
import { RenderuimLogo } from "@/components/icons/renderuim";
import { ThemeToggle } from "@/components/theme-toggle";
import { UserMenu } from "@/components/navigation/user-menu";
import { useJobNotifications } from "@/components/jobs/job-notifications";
import { cn } from "@/lib/utils";
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

export function AppHeader({ user, balance }: AppHeaderProps) {
  return (
    <header
      className={cn(
        "sticky top-0 z-30 flex h-14 w-full items-center justify-between border-b bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/80"
      )}
    >
      <Link
        href="/app/dashboard"
        className="flex items-center gap-2 text-foreground"
      >
        <RenderuimLogo className="h-6 w-6" />
        <span className="hidden font-semibold md:inline">Renderuim</span>
      </Link>

      <div className="flex items-center gap-1 sm:gap-2">
        <Button
          asChild
          variant="ghost"
          size="sm"
          className="hidden gap-1.5 text-foreground sm:flex"
        >
          <Link href="/app/pricing">
            <Zap className="h-4 w-4 text-amber-400" />
            {balance.toLocaleString()} credits
          </Link>
        </Button>

        <Button
          asChild
          variant="ghost"
          size="icon"
          className="h-9 w-9 sm:hidden"
          aria-label="Credits"
        >
          <Link href="/app/pricing">
            <Zap className="h-[1.1rem] w-[1.1rem] text-amber-400" />
          </Link>
        </Button>

        <HeaderNotificationBell />
        <ThemeToggle variant="ghost" size="icon" />
        <UserMenu user={user} />
      </div>
    </header>
  );
}
