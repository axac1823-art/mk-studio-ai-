"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { FolderOpen, Heart, Image as ImageIcon, Trash2, Upload } from "lucide-react";

import { cn } from "@/lib/utils";

const tabs = [
  { label: "All projects", href: "/app/projects?view=projects", icon: FolderOpen, view: "projects" },
  { label: "All assets", href: "/app/projects?view=assets", icon: ImageIcon, view: "assets" },
  { label: "Favorites", href: "/app/projects?view=favorites", icon: Heart, view: "favorites" },
  { label: "Uploads", href: "/app/uploads", icon: Upload, view: "uploads" },
  { label: "Trash", href: "/app/trash", icon: Trash2, view: "trash" },
] as const;

export function ProjectLibraryTabs() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentView = searchParams.get("view");

  return (
    <nav aria-label="Projects and library" className="-mx-1 flex min-w-0 gap-1 overflow-x-auto border-b px-1">
      {tabs.map(({ label, href, icon: Icon, view }) => {
        const active = view === "uploads" || view === "trash"
          ? pathname.startsWith(href)
          : pathname === "/app/projects" && currentView === view;
        return (
          <Link
            key={view}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex h-10 shrink-0 items-center gap-2 border-b-2 px-3 text-sm font-medium transition-colors",
              active
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon aria-hidden="true" className="h-4 w-4" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
