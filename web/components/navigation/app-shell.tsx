"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";

import { AppSidebar } from "@/components/navigation/Sidebar";
import { AppHeader } from "@/components/navigation/app-header";
import {
  ProjectMobileNav,
  ProjectSidebar,
} from "@/components/projects/project-sidebar";
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
  const projectId = pathname.match(/^\/app\/projects\/([^/]+)/)?.[1];
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
      {isProjectLibrary && <ProjectSidebar projectId={projectId} />}
      <div className="flex min-w-0 flex-1 flex-col">
        {isProjectLibrary && <ProjectMobileNav projectId={projectId} />}
        <AppHeader user={user} balance={balance} />
        <main className="flex-1">{children}</main>
      </div>
    </div>
  );
}
