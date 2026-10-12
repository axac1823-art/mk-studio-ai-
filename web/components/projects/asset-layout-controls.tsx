"use client";

import { LayoutGrid, List } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type AssetLayout = "grid" | "list";

interface AssetLayoutControlsProps {
  layout: AssetLayout;
  columns: number;
  onLayoutChange: (layout: AssetLayout) => void;
  onColumnsChange: (columns: number) => void;
}

export function AssetLayoutControls({
  layout,
  columns,
  onLayoutChange,
  onColumnsChange,
}: AssetLayoutControlsProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card p-2">
      <div className="flex items-center gap-1">
        <Button type="button" size="sm" variant={layout === "grid" ? "secondary" : "ghost"} onClick={() => onLayoutChange("grid")} aria-pressed={layout === "grid"} className="gap-2">
          <LayoutGrid className="h-4 w-4" /> Grid
        </Button>
        <Button type="button" size="sm" variant={layout === "list" ? "secondary" : "ghost"} onClick={() => onLayoutChange("list")} aria-pressed={layout === "list"} className="gap-2">
          <List className="h-4 w-4" /> List
        </Button>
      </div>
      {layout === "grid" && (
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          Items per row
          <select
            value={columns}
            onChange={(event) => onColumnsChange(Number(event.target.value))}
            className="h-9 rounded-md border bg-background px-2 text-sm text-foreground"
          >
            {[2, 3, 4, 5, 6].map((count) => <option key={count} value={count}>{count}</option>)}
          </select>
        </label>
      )}
    </div>
  );
}

const GRID_COLUMN_CLASSES: Record<number, string> = {
  2: "grid-cols-2 md:grid-cols-1 lg:grid-cols-2",
  3: "grid-cols-2 md:grid-cols-1 lg:grid-cols-2 xl:grid-cols-3",
  4: "grid-cols-2 md:grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4",
  5: "grid-cols-2 md:grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5",
  6: "grid-cols-2 md:grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6",
};

export function assetLayoutClass(layout: AssetLayout, columns = 4): string {
  return cn(
    layout === "list"
      ? "flex flex-col gap-3"
      : cn("grid gap-4", GRID_COLUMN_CLASSES[columns] ?? GRID_COLUMN_CLASSES[4]),
  );
}
