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
  Minus,
  Plus,
  RotateCcw,
  Square,
  SlidersHorizontal,
  Video,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { AssetLayout } from "@/components/projects/asset-layout-controls";
import { cn } from "@/lib/utils";

export type AssetNavigationTypeFilter =
  | "all"
  | "image"
  | "video"
  | "audio"
  | "3d_model";

export type AssetNavigationSort = "recent" | "oldest" | "type";

interface ProjectOption {
  id: string;
  name: string;
}

interface ServiceOption {
  value: string;
  label: string;
}

const TYPE_OPTIONS: Array<{
  value: AssetNavigationTypeFilter;
  label: string;
  Icon: typeof ImageIcon;
}> = [
  { value: "all", label: "All", Icon: LayoutGrid },
  { value: "image", label: "Image", Icon: ImageIcon },
  { value: "video", label: "Video", Icon: Video },
  { value: "audio", label: "Audio", Icon: Mic },
  { value: "3d_model", label: "3D", Icon: Box },
];

const SERVICE_OPTIONS: Record<Exclude<AssetNavigationTypeFilter, "all">, ServiceOption[]> = {
  image: [
    { value: "all", label: "All image services" },
    { value: "text_to_image", label: "Image Generator" },
    { value: "print_render", label: "Render" },
    { value: "mood_swap", label: "Mood" },
    { value: "exterior_to_interior", label: "Exterior to Interior" },
    { value: "plan_to_render", label: "Plan to Render" },
    { value: "multi_angle", label: "Multi-Angle" },
    { value: "upscale", label: "Image Upscale" },
    { value: "image_extender", label: "Image Extender" },
    { value: "variations", label: "Image Variations" },
    { value: "background_remover", label: "Background Remover" },
  ],
  video: [
    { value: "all", label: "All video services" },
    { value: "text_to_video", label: "Text to Video" },
    { value: "image_to_video", label: "Image to Video" },
    { value: "start_end_frame", label: "Start + End Frame" },
    { value: "multi_reference", label: "Multi-Reference Video" },
    { value: "multi_shot", label: "Multi-Shot Video" },
    { value: "video_to_video", label: "Modify Video" },
    { value: "relight", label: "Video Relight" },
    { value: "video_upscale", label: "Video Upscale" },
    { value: "video_edit_trim", label: "Clip Editor: Trim" },
    { value: "video_edit_speed", label: "Clip Editor: Speed" },
    { value: "video_edit_overlay", label: "Clip Editor: Text Overlay" },
    { value: "video_edit_export", label: "Clip Editor: Export" },
    { value: "video_edit_concat", label: "Video Project Editor" },
  ],
  audio: [
    { value: "all", label: "All audio services" },
    { value: "voice_generator", label: "Voice Generator" },
    { value: "dialogue_generator", label: "Dialogue Generator" },
  ],
  "3d_model": [
    { value: "all", label: "All 3D services" },
    { value: "3d_generator", label: "3D Generator" },
  ],
};

interface AssetNavigationToolbarProps {
  typeFilter: AssetNavigationTypeFilter;
  onTypeFilterChange: (type: AssetNavigationTypeFilter) => void;
  serviceFilter: string;
  onServiceFilterChange: (service: string) => void;
  availableTypes?: AssetNavigationTypeFilter[];
  layout: AssetLayout;
  columns: number;
  onLayoutChange: (layout: AssetLayout) => void;
  onColumnsChange: (columns: number) => void;
  projects?: ProjectOption[];
  projectFilter?: string;
  onProjectFilterChange?: (projectId: string) => void;
  sortBy?: AssetNavigationSort;
  onSortByChange?: (sort: AssetNavigationSort) => void;
  onCreateFolder: () => void;
  className?: string;
}

export function AssetNavigationToolbar({
  typeFilter,
  onTypeFilterChange,
  serviceFilter,
  onServiceFilterChange,
  availableTypes = ["all", "image", "video", "audio", "3d_model"],
  layout,
  columns,
  onLayoutChange,
  onColumnsChange,
  projects,
  projectFilter,
  onProjectFilterChange,
  sortBy,
  onSortByChange,
  onCreateFolder,
  className,
}: AssetNavigationToolbarProps) {
  const [groupEdits, setGroupEdits] = useState(true);
  const [visibleFields, setVisibleFields] = useState({
    status: true,
    tags: true,
    comments: true,
  });
  const sizeStep = 6 - Math.max(2, Math.min(6, columns));
  const filteredTypeOptions = TYPE_OPTIONS.filter((option) =>
    availableTypes.includes(option.value),
  );
  const services = typeFilter === "all" ? [] : SERVICE_OPTIONS[typeFilter];
  const activeFilters =
    (typeFilter !== "all" ? 1 : 0) +
    (serviceFilter !== "all" ? 1 : 0) +
    (projectFilter && projectFilter !== "all" ? 1 : 0) +
    (sortBy && sortBy !== "recent" ? 1 : 0);

  const resetFilters = () => {
    onTypeFilterChange("all");
    onServiceFilterChange("all");
    onProjectFilterChange?.("all");
    onSortByChange?.("recent");
  };

  return (
    <nav
      aria-label="Asset controls"
      className={cn("flex min-w-0 flex-wrap items-center gap-2", className)}
    >
      {/* FILTER */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button type="button" variant="outline" size="sm" className="h-9 gap-2 rounded-xl">
            <SlidersHorizontal className="h-4 w-4" />
            Filter
            {activeFilters > 0 && (
              <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
                {activeFilters}
              </span>
            )}
            <ChevronDown className="h-3.5 w-3.5 opacity-60" />
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent
          align="start"
          sideOffset={8}
          className="w-[360px] max-w-[calc(100vw-2rem)] rounded-2xl p-3"
        >
          <DropdownMenuLabel className="px-1 pb-2 text-sm">Filter assets</DropdownMenuLabel>

          <p className="px-1 pb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Media type
          </p>
          <div className="grid grid-cols-5 gap-1">
            {filteredTypeOptions.map(({ value, label, Icon }) => {
              const active = typeFilter === value;
              return (
                <button
                  key={value}
                  type="button"
                  aria-pressed={active}
                  onClick={() => {
                    onTypeFilterChange(value);
                    onServiceFilterChange("all");
                  }}
                  className={cn(
                    "flex min-w-0 flex-col items-center justify-center gap-1 rounded-xl border px-1 py-2 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    active
                      ? "border-primary/40 bg-primary/10 text-foreground"
                      : "border-transparent text-muted-foreground hover:bg-accent hover:text-foreground",
                  )}
                >
                  <Icon className="h-4 w-4" />
                  <span>{label}</span>
                </button>
              );
            })}
          </div>

          {services.length > 0 && (
            <>
              <DropdownMenuSeparator className="my-3" />
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {typeFilter === "3d_model" ? "3D services" : `${typeFilter} services`}
                </p>
                <span className="text-[10px] text-muted-foreground">Choose one</span>
              </div>
              <div className="flex min-w-0 gap-1.5 overflow-x-auto pb-1">
                {services.map((service) => {
                  const active = serviceFilter === service.value;
                  return (
                    <button
                      key={service.value}
                      type="button"
                      aria-pressed={active}
                      onClick={() => onServiceFilterChange(service.value)}
                      className={cn(
                        "flex h-8 shrink-0 items-center gap-1.5 rounded-lg border px-2.5 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                        active
                          ? "border-primary/40 bg-primary/10 text-foreground"
                          : "border-border/70 text-muted-foreground hover:bg-accent hover:text-foreground",
                      )}
                    >
                      {active && <Check className="h-3.5 w-3.5" />}
                      {service.label}
                    </button>
                  );
                })}
              </div>
            </>
          )}

          {(projects && onProjectFilterChange) || (sortBy && onSortByChange) ? (
            <>
              <DropdownMenuSeparator className="my-3" />
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {projects && onProjectFilterChange && (
                  <label className="flex min-w-0 flex-col gap-1.5 text-xs font-medium text-muted-foreground">
                    Project
                    <select
                      value={projectFilter ?? "all"}
                      onChange={(event) => onProjectFilterChange(event.target.value)}
                      className="h-9 min-w-0 rounded-lg border bg-background px-2.5 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <option value="all">All projects</option>
                      {projects.map((project) => (
                        <option key={project.id} value={project.id}>{project.name}</option>
                      ))}
                    </select>
                  </label>
                )}

                {sortBy && onSortByChange && (
                  <label className="flex min-w-0 flex-col gap-1.5 text-xs font-medium text-muted-foreground">
                    Sort by
                    <select
                      value={sortBy}
                      onChange={(event) => onSortByChange(event.target.value as AssetNavigationSort)}
                      className="h-9 min-w-0 rounded-lg border bg-background px-2.5 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <option value="recent">Most recent</option>
                      <option value="oldest">Oldest</option>
                      <option value="type">Type</option>
                    </select>
                  </label>
                )}
              </div>
            </>
          ) : null}

          <DropdownMenuSeparator className="my-3" />
          <button
            type="button"
            onClick={resetFilters}
            className="flex h-8 w-full items-center justify-center gap-2 rounded-lg px-3 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Reset filters
          </button>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* LAYOUT */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button type="button" variant="outline" size="sm" className="h-9 gap-2 rounded-xl">
            {layout === "list" ? <List className="h-4 w-4" /> : layout === "square" ? <Square className="h-4 w-4" /> : <LayoutGrid className="h-4 w-4" />}
            Layout
            <ChevronDown className="h-3.5 w-3.5 opacity-60" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" sideOffset={8} className="w-[320px] max-w-[calc(100vw-2rem)] rounded-2xl p-4">
          <div className="flex flex-col gap-4">
            <section className="flex flex-col gap-2">
              <p className="text-xs text-muted-foreground">Creations layout</p>
              <div className="grid grid-cols-3 rounded-lg border bg-muted/40 p-0.5">
                {([
                  { value: "list", label: "Row", Icon: List },
                  { value: "grid", label: "Original", Icon: LayoutGrid },
                  { value: "square", label: "Square", Icon: Square },
                ] as const).map(({ value, label, Icon }) => (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={layout === value}
                    onClick={() => onLayoutChange(value)}
                    className={cn(
                      "flex h-14 flex-col items-center justify-center gap-1 rounded-md px-2 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      layout === value ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {label}
                  </button>
                ))}
              </div>
            </section>

            <section className="flex items-center gap-2">
              <p className="w-14 shrink-0 text-xs text-muted-foreground">Size</p>
              <button
                type="button"
                aria-label="Decrease asset size"
                disabled={columns >= 6}
                onClick={() => onColumnsChange(Math.min(6, columns + 1))}
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-muted-foreground hover:bg-accent disabled:opacity-40"
              >
                <Minus className="h-3 w-3" />
              </button>
              <div className="relative h-5 min-w-0 flex-1 overflow-hidden rounded-md bg-muted">
                <div className="pointer-events-none absolute inset-y-0 left-0 bg-foreground/20" style={{ width: `${(sizeStep / 4) * 100}%` }} />
                {[25, 50, 75].map((position) => <span key={position} className="pointer-events-none absolute top-1/2 h-2 w-px -translate-y-1/2 bg-muted-foreground/50" style={{ left: `${position}%` }} />)}
                <input
                  type="range"
                  min="0"
                  max="4"
                  step="1"
                  value={sizeStep}
                  aria-label="Asset size"
                  onChange={(event) => onColumnsChange(6 - Number(event.target.value))}
                  className="absolute inset-0 h-full w-full cursor-ew-resize opacity-0"
                />
                <span className="pointer-events-none absolute top-1/2 h-2 w-2 -translate-y-1/2 rounded-full bg-primary ring-2 ring-background" style={{ left: `${(sizeStep / 4) * 100}%` }} />
              </div>
              <button
                type="button"
                aria-label="Increase asset size"
                disabled={columns <= 2}
                onClick={() => onColumnsChange(Math.max(2, columns - 1))}
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-muted-foreground hover:bg-accent disabled:opacity-40"
              >
                <Plus className="h-3 w-3" />
              </button>
            </section>

            <section className="flex items-center gap-2">
              <p className="w-14 shrink-0 text-xs text-muted-foreground">Edits</p>
              <div className="grid h-8 min-w-0 flex-1 grid-cols-2 rounded-lg border bg-muted/40 p-0.5">
                {[true, false].map((grouped) => (
                  <button
                    key={String(grouped)}
                    type="button"
                    aria-pressed={groupEdits === grouped}
                    onClick={() => setGroupEdits(grouped)}
                    className={cn("rounded-md px-2 text-xs transition-colors", groupEdits === grouped ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}
                  >
                    {grouped ? "Group" : "Ungroup"}
                  </button>
                ))}
              </div>
            </section>

            <section className="flex flex-col gap-2">
              <p className="text-xs text-muted-foreground">Fields</p>
              <div className="flex flex-wrap gap-1.5">
                {(["status", "tags", "comments"] as const).map((field) => (
                  <button
                    key={field}
                    type="button"
                    aria-pressed={visibleFields[field]}
                    onClick={() => setVisibleFields((current) => ({ ...current, [field]: !current[field] }))}
                    className={cn(
                      "h-6 rounded-full border px-3 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      visibleFields[field] ? "border-transparent bg-secondary text-secondary-foreground" : "border-border text-muted-foreground hover:bg-accent hover:text-foreground",
                    )}
                  >
                    {field[0].toUpperCase()}{field.slice(1)}
                  </button>
                ))}
              </div>
            </section>
          </div>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* ADD */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button type="button" size="sm" className="h-9 gap-2 rounded-xl">
            <Plus className="h-4 w-4" />
            Add
            <ChevronDown className="h-3.5 w-3.5 opacity-80" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" sideOffset={8} className="w-44 rounded-2xl p-2">
          <DropdownMenuLabel className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Create new
          </DropdownMenuLabel>
          <DropdownMenuItem
            onSelect={(event) => {
              event.preventDefault();
              onCreateFolder();
            }}
            className="h-9 gap-2 rounded-lg px-3 text-xs"
          >
            <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-muted">
              <FolderPlus className="h-3.5 w-3.5" />
            </span>
            Folder
          </DropdownMenuItem>
          <DropdownMenuSeparator className="my-1" />
          <DropdownMenuItem asChild className="h-9 gap-2 rounded-lg px-3 text-xs">
            <Link href="/app/ai-image-generator">
              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-violet-500/10 text-violet-600">
                <ImageIcon className="h-3.5 w-3.5" />
              </span>
              Image
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild className="h-9 gap-2 rounded-lg px-3 text-xs">
            <Link href="/app/ai-video-generator">
              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600">
                <Video className="h-3.5 w-3.5" />
              </span>
              Video
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild className="h-9 gap-2 rounded-lg px-3 text-xs">
            <Link href="/app/voice-generator">
              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600">
                <Mic className="h-3.5 w-3.5" />
              </span>
              Audio
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild className="h-9 gap-2 rounded-lg px-3 text-xs">
            <Link href="/app/3d-generator">
              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600">
                <Box className="h-3.5 w-3.5" />
              </span>
              3D
            </Link>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </nav>
  );
}
