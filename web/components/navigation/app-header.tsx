"use client";

import { useState } from "react";
import Link from "next/link";
import { Bell, Command, Menu, Search, Zap } from "lucide-react";

import { Button } from "@/components/ui/button";
import { CreditAlert } from "@/components/billing/credit-alert";
import { CommandPalette } from "@/components/navigation/CommandPalette";
import { RenderuimLogo } from "@/components/icons/renderuim";
import { ThemeToggle } from "@/components/theme-toggle";
import { UserMenu } from "@/components/navigation/user-menu";
import { useJobNotifications } from "@/components/jobs/job-notifications";
import { usePathname } from "next/navigation";
import type { DbUser } from "@/lib/db/queries";

interface AppHeaderProps {
  user: DbUser;
  balance: number;
  lowThreshold: number;
  onToggleNavigation: () => void;
  mobileNavigationOpen: boolean;
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

export function AppHeader({ user, balance, lowThreshold, onToggleNavigation, mobileNavigationOpen }: AppHeaderProps) {
  const pathname = usePathname();
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);

  return (
    <>
      <header className="sticky top-0 z-30 flex h-14 w-full items-center justify-between border-b bg-background/95 px-2 backdrop-blur supports-[backdrop-filter]:bg-background/80 md:px-4">
        <div className="flex min-w-0 items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-9 w-9 shrink-0 md:hidden"
            onClick={onToggleNavigation}
            aria-label="Toggle navigation menu"
            aria-expanded={mobileNavigationOpen}
          >
            <Menu className="h-5 w-5" />
          </Button>
          <Link
            href="/app/dashboard"
            className="mr-1 flex shrink-0 items-center md:hidden"
            aria-label="Renderuim home"
          >
            <RenderuimLogo className="h-6 w-6" />
          </Link>

          <Button
            asChild
            variant={pathname.startsWith("/app/search") ? "secondary" : "ghost"}
            size="sm"
            className="h-9 gap-2 px-2.5 md:px-3"
          >
            <Link href="/app/search" aria-label="Search projects and assets" title="Search">
              <Search className="h-4 w-4 shrink-0" />
              <span className="hidden md:inline">Search</span>
            </Link>
          </Button>

          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-9 w-9 shrink-0"
            onClick={() => setCommandPaletteOpen(true)}
            aria-label="Open command palette"
            title="Command palette"
          >
            <Command className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex shrink-0 items-center gap-0.5 sm:gap-1">
          {balance <= lowThreshold ? (
            <CreditAlert balance={balance} threshold={lowThreshold} compact />
          ) : (
            <Button
              asChild
              variant="ghost"
              size="sm"
              className="h-9 gap-1.5 px-2.5"
              title="Credits"
            >
              <Link href="/pricing" aria-label={balance.toLocaleString() + " credits"}>
                <Zap className="h-4 w-4 text-amber-400" />
                <span className="hidden sm:inline">{balance.toLocaleString()} credits</span>
              </Link>
            </Button>
          )}

          <HeaderNotificationBell />
          <ThemeToggle variant="ghost" size="icon" />
          <UserMenu user={user} />
        </div>
      </header>
      <CommandPalette
        open={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
      />
    </>
  );
}