"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Box,
  Check,
  ChevronDown,
  FolderPlus,
  Image as ImageIcon,
  LayoutGrid,
  List,
  Mic,
  Plus,
  SlidersHorizontal,
  Video,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ASSET_SERVICE_OPTIONS } from "@/components/projects/asset-service-filter";
import type { AssetLayout } from "@/components/projects/asset-layout-controls";

export type AssetFilterType = "all" | "image" | "video" | "audio";
type MediaCategory = Exclude<AssetFilterType, "all">;

interface AssetLibraryToolbarProps {
  type: AssetFilterType;
  service: string;
  layout: AssetLayout;
  columns: number;
  onFilterChange: (type: AssetFilterType, service: string) => void;
  onLayoutChange: (layout: AssetLayout) => void;
  onColumnsChange: (columns: number) => void;
}

const FILTER_CATEGORIES: Array<{
  id: MediaCategory;
  label: string;
  Icon: typeof ImageIcon;
}> = [
  { id: "image", label: "Image", Icon: ImageIcon },
  { id: "video", label: "Video", Icon: Video },
  { id: "audio", label: "Audio", Icon: Mic },
];

const CREATE_ITEMS = [
  { label: "Image", href: "/app/ai-image-generator", Icon: ImageIcon, tone: "bg-sky-500/10 text-sky-600 dark:text-sky-400" },
  { label: "Video", href: "/app/ai-video-generator", Icon: Video, tone: "bg-violet-500/10 text-violet-600 dark:text-violet-400" },
  { label: "Audio", href: "/app/voice-generator", Icon: Mic, tone: "bg-amber-500/10 text-amber-600 dark:text-amber-400" },
  { label: "3D", href: "/app/3d-generator", Icon: Box, tone: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" },
] as const;

export function AssetLibraryToolbar({
  type,
  service,
  layout,
  columns,
  onFilterChange,
  onLayoutChange,
  onColumnsChange,
}: AssetLibraryToolbarProps) {
  const [filterOpen, setFilterOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState<MediaCategory>(type === "all" ? "image" : type);
  const activeCategoryMeta = FILTER_CATEGORIES.find((category) => category.id === activeCategory);
  const ActiveCategoryIcon = activeCategoryMeta?.Icon;
  const activeService = ASSET_SERVICE_OPTIONS.find((item) => item.id === service);
  const filterSummary = activeService?.label ?? FILTER_CATEGORIES.find((category) => category.id === type)?.label ?? "All assets";
  const categoryServices = ASSET_SERVICE_OPTIONS.filter((item) => item.types.includes(activeCategory));

  return (
    <div className="flex min-w-0 flex-wrap items-center justify-between gap-3 rounded-2xl border border-border/70 bg-card/80 p-2 shadow-sm">
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <DropdownMenu
          open={filterOpen}
          onOpenChange={(open) => {
            setFilterOpen(open);
            if (open) setActiveCategory(type === "all" ? "image" : type);
          }}
        >
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant={type !== "all" || service !== "all" ? "secondary" : "outline"}
              size="sm"
              className="h-9 gap-2 rounded-xl px-3"
              aria-label={`Filter assets. Current filter: ${filterSummary}`}
            >
              <SlidersHorizontal className="h-4 w-4" />
              Filter
              {(type !== "all" || service !== "all") && (
                <span className="ml-0.5 max-w-28 truncate rounded-md bg-background/80 px-1.5 py-0.5 text-[10px] font-medium">
                  {filterSummary}
                </span>
              )}
              <ChevronDown className="h-3.5 w-3.5 opacity-60" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" sideOffset={8} className="w-[min(92vw,570px)] rounded-2xl p-2">
            <div className="flex min-h-[260px] overflow-hidden">
              <div className="w-[145px] shrink-0 border-r border-border/70 pr-2 sm:w-[180px]">
                <DropdownMenuLabel className="px-3 pb-2 pt-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  Filter by
                </DropdownMenuLabel>
                <DropdownMenuItem
                  onSelect={() => onFilterChange("all", "all")}
                  className="h-9 rounded-lg px-3"
                >
                  <LayoutGrid className="h-4 w-4 text-muted-foreground" />
                  All assets
                  {type === "all" && service === "all" && <Check className="ml-auto h-4 w-4 text-primary" />}
                </DropdownMenuItem>
                <DropdownMenuSeparator className="my-1.5" />
                {FILTER_CATEGORIES.map(({ id, label, Icon }) => {
                  const services = ASSET_SERVICE_OPTIONS.filter((item) => item.types.includes(id));
                  const selected = activeCategory === id;
                  return (
                    <DropdownMenuItem
                      key={id}
                      onSelect={(event) => {
                        event.preventDefault();
                        setActiveCategory(id);
                      }}
                      className={`h-9 rounded-lg px-3 ${selected ? "bg-accent text-accent-foreground" : ""}`}
                    >
                      <span className="flex h-6 w-6 items-center justify-center rounded-md bg-muted/80">
                        <Icon className="h-4 w-4 text-muted-foreground" />
                      </span>
                      <span className="flex-1">{label}</span>
                      <span className="text-[11px] tabular-nums text-muted-foreground">{services.length}</span>
                      {selected && <ChevronDown className="h-3.5 w-3.5 -rotate-90 text-muted-foreground" />}
                    </DropdownMenuItem>
                  );
                })}
              </div>

              <div className="min-w-0 flex-1 pl-2">
                <div className="flex items-center justify-between gap-2 px-3 pb-2 pt-2">
                  <div className="flex min-w-0 items-center gap-2">
                    {ActiveCategoryIcon && <ActiveCategoryIcon className="h-4 w-4 text-muted-foreground" />}
                    <DropdownMenuLabel className="truncate p-0 text-sm font-semibold">
                      {activeCategoryMeta?.label} services
                    </DropdownMenuLabel>
                  </div>
                  <span className="shrink-0 text-[10px] text-muted-foreground">{categoryServices.length} tools</span>
                </div>
                <div className="flex max-h-[300px] flex-col gap-0.5 overflow-y-auto pr-1">
                  <button
                    type="button"
                    onClick={() => {
                      onFilterChange(activeCategory, "all");
                      setFilterOpen(false);
                    }}
                    aria-pressed={type === activeCategory && service === "all"}
                    className={`flex min-h-9 items-center gap-2 rounded-lg px-3 text-left text-sm transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${type === activeCategory && service === "all" ? "bg-accent font-medium" : ""}`}
                  >
                    <span className="flex-1">All {activeCategoryMeta?.label.toLowerCase()} services</span>
                    {type === activeCategory && service === "all" && <Check className="h-4 w-4 text-primary" />}
                  </button>
                  {categoryServices.map((item) => {
                    const selected = type === activeCategory && service === item.id;
                    return (
                      <button
                        type="button"
                        key={item.id}
                        onClick={() => {
                          onFilterChange(activeCategory, item.id);
                          setFilterOpen(false);
                        }}
                        aria-pressed={selected}
                        className={`flex min-h-9 items-center gap-2 rounded-lg px-3 text-left text-sm transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${selected ? "bg-accent font-medium" : ""}`}
                      >
                        <span className="flex-1">{item.label}</span>
                        {selected && <Check className="h-4 w-4 text-primary" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" variant="outline" size="sm" className="h-9 gap-2 rounded-xl px-3">
              {layout === "grid" ? <LayoutGrid className="h-4 w-4" /> : <List className="h-4 w-4" />}
              Layout
              <ChevronDown className="h-3.5 w-3.5 opacity-60" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" sideOffset={8} className="w-[220px] rounded-2xl p-2">
            <DropdownMenuLabel className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              Display layout
            </DropdownMenuLabel>
            <DropdownMenuRadioGroup value={layout} onValueChange={(value) => onLayoutChange(value as AssetLayout)}>
              <DropdownMenuRadioItem value="grid" className="h-9 rounded-lg pl-8">
                <LayoutGrid className="h-4 w-4 text-muted-foreground" /> Grid view
              </DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="list" className="h-9 rounded-lg pl-8">
                <List className="h-4 w-4 text-muted-foreground" /> List view
              </DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
            {layout === "grid" && (
              <>
                <DropdownMenuSeparator className="my-1.5" />
                <DropdownMenuLabel className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  Columns
                </DropdownMenuLabel>
                <DropdownMenuRadioGroup value={String(columns)} onValueChange={(value) => onColumnsChange(Number(value))}>
                  {[2, 3, 4, 5, 6].map((count) => (
                    <DropdownMenuRadioItem key={count} value={String(count)} className="h-8 rounded-lg pl-8">
                      {count} columns
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button type="button" size="sm" className="h-9 gap-2 rounded-xl px-3 shadow-sm">
            <Plus className="h-4 w-4" />
            Add
            <ChevronDown className="h-3.5 w-3.5 opacity-80" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" sideOffset={8} className="w-[190px] rounded-2xl p-2">
          <DropdownMenuLabel className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Create new
          </DropdownMenuLabel>
          <DropdownMenuItem disabled className="h-9 rounded-lg px-3" title="Folder creation is not supported by the current project data model">
            <span className="flex h-6 w-6 items-center justify-center rounded-md bg-muted/80">
              <FolderPlus className="h-4 w-4 text-muted-foreground" />
            </span>
            Folder
            <DropdownMenuShortcut>Soon</DropdownMenuShortcut>
          </DropdownMenuItem>
          <DropdownMenuSeparator className="my-1.5" />
          {CREATE_ITEMS.map(({ label, href, Icon, tone }) => (
            <DropdownMenuItem key={label} asChild className="h-9 rounded-lg px-3">
              <Link href={href}>
                <span className={`flex h-6 w-6 items-center justify-center rounded-md ${tone}`}>
                  <Icon className="h-4 w-4" />
                </span>
                {label}
              </Link>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
