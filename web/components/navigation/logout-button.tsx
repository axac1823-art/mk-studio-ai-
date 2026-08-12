"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";

import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

interface LogoutButtonProps {
  collapsed?: boolean;
  className?: string;
}

export function LogoutButton({ collapsed = false, className }: LogoutButtonProps) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function handleLogout() {
    if (busy) return;
    setBusy(true);
    try {
      await createClient().auth.signOut();
    } finally {
      // Redirect even if signOut errors so the user is not stuck.
      router.push("/login");
      router.refresh();
    }
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={handleLogout}
      disabled={busy}
      className={cn("gap-2 text-muted-foreground hover:text-foreground", className)}
    >
      <LogOut className="h-4 w-4 shrink-0" />
      {!collapsed && <span className="hidden md:inline">{busy ? "Signing out…" : "Sign out"}</span>}
    </Button>
  );
}
