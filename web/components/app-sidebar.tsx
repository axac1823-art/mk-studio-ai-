"use client";

// Navigation latérale de la section /app (modèle Projects/Assets). L'état
// actif suit le pathname PAR PRÉFIXE : les sous-routes (ex. le détail
// /app/projects/[id]) gardent leur entrée parente active. Le style reprend
// celui du studio (border-r, actif = bg-accent).
import Link from "next/link";
import { usePathname } from "next/navigation";
import { FolderOpen, Home, Search, Star, Trash2, Upload } from "lucide-react";

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
    <aside className="flex w-56 shrink-0 flex-col border-r">
      <nav className="flex flex-col gap-1 p-3">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-accent text-foreground"
                  : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
