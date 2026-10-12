"use client";

import Link from "next/link";
import { Check, X } from "lucide-react";

import type { AssetSummary } from "@/components/projects/asset-card";
import { IMAGE_SERVICES, VIDEO_SERVICES } from "@/components/projects/asset-card";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface AssetSelectionToolbarProps {
  asset: AssetSummary | null;
  onClear: () => void;
}

/** Gives a selected project asset a direct path into a compatible creation workflow. */
export function AssetSelectionToolbar({
  asset,
  onClear,
}: AssetSelectionToolbarProps) {
  if (!asset) return null;

  const services = asset.type === "video" ? VIDEO_SERVICES : IMAGE_SERVICES;
  const canCreate = asset.type === "image" || asset.type === "video";

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary/25 bg-primary/[0.06] px-4 py-3">
      <div className="flex min-w-0 items-center gap-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Check className="h-4 w-4" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-medium">Asset selected</p>
          <p className="text-xs capitalize text-muted-foreground">
            {asset.type === "3d_model" ? "3D model" : asset.type} · ready to use in a workflow
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {canCreate && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" size="sm">Use in a workflow</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="max-h-[min(60vh,420px)] overflow-y-auto">
              {services.map(([label, route]) => {
                const separator = route.includes("?") ? "&" : "?";
                return (
                  <DropdownMenuItem key={route} asChild>
                    <Link href={`${route}${separator}assetId=${encodeURIComponent(asset.id)}`}>
                      {label}
                    </Link>
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        <Button type="button" variant="ghost" size="sm" onClick={onClear} aria-label="Clear selected asset">
          <X className="h-4 w-4" />
          <span className="sr-only">Clear selection</span>
        </Button>
      </div>
    </div>
  );
}
