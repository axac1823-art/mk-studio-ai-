"use client";

import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

interface ToolCardProps {
  name: string;
  description: string;
  icon: LucideIcon;
  onClick?: () => void;
  className?: string;
}

export function ToolCard({ name, description, icon: Icon, onClick, className }: ToolCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-start gap-3 rounded-lg border bg-card p-3 text-left transition-colors",
        "hover:border-primary/40 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        className
      )}
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-muted">
        <Icon className="h-5 w-5 text-muted-foreground" />
      </span>
      <div className="flex min-w-0 flex-col">
        <span className="text-sm font-semibold text-foreground">{name}</span>
        <span className="text-xs text-muted-foreground">{description}</span>
      </div>
    </button>
  );
}
