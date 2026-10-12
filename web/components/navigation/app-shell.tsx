"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

import { AppSidebar } from "@/components/navigation/Sidebar";
import { AppHeader } from "@/components/navigation/app-header";
import type { DbUser } from "@/lib/db/queries";

interface AppShellProps {
  user: DbUser;
  balance: number;
  lowThreshold: number;
  children: React.ReactNode;
}

export function AppShell({ user, balance, lowThreshold, children }: AppShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const pathname = usePathname();
  useEffect(() => {
    setMobileNavOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!mobileNavOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileNavOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [mobileNavOpen]);

  return (
    <div className="renderuim-app flex min-h-screen w-full bg-background text-foreground">
      <AppSidebar
        user={user}
        open={sidebarOpen}
        mobileOpen={mobileNavOpen}
        showToggle
        onToggle={() => setSidebarOpen((open) => !open)}
      />
      {mobileNavOpen && (
        <button
          type="button"
          aria-label="Close navigation menu"
          onClick={() => setMobileNavOpen(false)}
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
        />
      )}
      <div className="flex min-w-0 flex-1 flex-col">
        <AppHeader
          user={user}
          balance={balance}
          lowThreshold={lowThreshold}
          onToggleNavigation={() => setMobileNavOpen((open) => !open)}
          mobileNavigationOpen={mobileNavOpen}
        />
        <main className="flex-1">{children}</main>
      </div>
    </div>
  );
}