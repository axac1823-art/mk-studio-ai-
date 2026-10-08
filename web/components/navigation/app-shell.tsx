"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";

import { AppSidebar } from "@/components/navigation/Sidebar";
import { AppHeader } from "@/components/navigation/app-header";
import {
  ProjectLibraryMobileNav,
  ProjectLibrarySidebar,
} from "@/components/projects/project-library-sidebar";
import type { DbUser } from "@/lib/db/queries";

interface AppShellProps {
  user: DbUser;
  balance: number;
  lowThreshold: number;
  children: React.ReactNode;
}

export function AppShell({ user, balance, lowThreshold, children }: AppShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const pathname = usePathname();
  const isProjectLibrary =
    pathname.startsWith("/app/projects") ||
    pathname.startsWith("/app/uploads") ||
    pathname.startsWith("/app/trash");

  return (
    <div className="flex min-h-screen w-full">
      <AppSidebar
        user={user}
        balance={balance}
        lowThreshold={lowThreshold}
        open={isProjectLibrary || sidebarOpen}
        showToggle={!isProjectLibrary}
        onToggle={() => {
          if (!isProjectLibrary) setSidebarOpen((open) => !open);
        }}
      />
      {isProjectLibrary && <ProjectLibrarySidebar />}
      <div className="flex min-w-0 flex-1 flex-col">
        {isProjectLibrary && <ProjectLibraryMobileNav />}
        <AppHeader user={user} balance={balance} />
        <main className="flex-1">{children}</main>
      </div>
    </div>
  );
}
