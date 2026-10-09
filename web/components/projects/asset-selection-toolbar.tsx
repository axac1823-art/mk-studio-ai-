"use client";

import Link from "next/link";
import { Check, X } from "lucide-react";

import {
  AssetSummary,
  IMAGE_SERVICES,
  VIDEO_SERVICES,
} from "@/components/projects/asset-card";
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

export function AssetSelectionToolbar({
  asset,
  onClear,
}: AssetSelectionToolbarProps) {
  if (!asset) return null;

  const services =
    asset.type === "image"
      ? IMAGE_SERVICES
      : asset.type === "video"
        ? VIDEO_SERVICES
        : [];

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-primary/25 bg-primary/5 px-3 py-2.5">
      <div className="flex min-w-0 items-center gap-2">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Check className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-medium">1 asset selected</p>
          <p className="text-xs capitalize text-muted-foreground">
            {asset.type === "3d_model" ? "3D model" : asset.type}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {services.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" size="sm" className="h-8">
                Create with selected
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {services.map(([label, route]) => {
                const separator = route.includes("?") ? "&" : "?";
                const href = `${route}${separator}assetId=${encodeURIComponent(asset.id)}`;
                return (
                  <DropdownMenuItem key={route} asChild>
                    <Link href={href}>{label}</Link>
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 gap-1.5 text-muted-foreground"
          onClick={onClear}
        >
          <X className="h-3.5 w-3.5" />
          Clear selection
        </Button>
      </div>
    </div>
  );
}
