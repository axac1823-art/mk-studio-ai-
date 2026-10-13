"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import {
  Box,
  ChevronDown,
  CircleHelp,
  FolderPlus,
  Grid2X2,
  Image as ImageIcon,
  LayoutGrid,
  List,
  MessageCircle,
  Mic,
  Plus,
  Search,
  SlidersHorizontal,
  Sparkles,
  Square,
  Video,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ASSET_SERVICE_OPTIONS } from "@/components/projects/asset-service-filter";
import type { AssetLayout } from "@/components/projects/asset-layout-controls";
import { cn } from "@/lib/utils";

export type AssetFilterType = "all" | "image" | "video" | "audio";
export type AssetDateRange = "all" | "custom" | "last7Days" | "lastMonth" | "last3Months" | "last6Months";
export type AssetVisualLayout = "row" | "original" | "square";
export type AssetPropertyFilter = "favorited" | "not-favorited" | "has-comments" | "mentions-me";
export type AssetStatusFilter = "needs-review" | "in-progress" | "approved" | "rejected";

export interface AssetProjectFilterOption {
  id: string;
  name: string;
  color?: string;
}

export interface AssetVisibleFields {
  status: boolean;
  tags: boolean;
  comments: boolean;
}

interface AssetLibraryToolbarProps {
  type: AssetFilterType;
  service: string;
  layout: AssetLayout;
  columns: number;
  onFilterChange: (type: AssetFilterType, service: string) => void;
  onLayoutChange: (layout: AssetLayout) => void;
  onColumnsChange: (columns: number) => void;

  /** Optional callbacks expose extra filters only when the current page can apply them. */
  projects?: AssetProjectFilterOption[];
  selectedProjectIds?: string[];
  onProjectIdsChange?: (ids: string[]) => void;
  selectedStatuses?: AssetStatusFilter[];
  onStatusesChange?: (statuses: AssetStatusFilter[]) => void;
  dateRange?: AssetDateRange;
  onDateRangeChange?: (value: AssetDateRange) => void;
  propertyFilters?: AssetPropertyFilter[];
  onPropertyFiltersChange?: (value: AssetPropertyFilter[]) => void;
  visualLayout?: AssetVisualLayout;
  onVisualLayoutChange?: (value: AssetVisualLayout) => void;
  onGroupingChange?: (grouped: boolean) => void;
  visibleFields?: AssetVisibleFields;
  onVisibleFieldsChange?: (value: AssetVisibleFields) => void;
}

const TYPE_OPTIONS = [
  { id: "all", label: "All", Icon: Grid2X2 },
  { id: "image", label: "Image", Icon: ImageIcon },
  { id: "video", label: "Video", Icon: Video },
  { id: "audio", label: "Audio", Icon: Mic },
] as const;

const UNSUPPORTED_TYPES = [
  { label: "Design", Icon: Sparkles, title: "Design assets are not a separate asset type in the current data model." },
  { label: "3D", Icon: Box, title: "3D outputs are not exposed as a filterable asset type in the current assets API." },
] as const;

const STATUS_OPTIONS: Array<{ id: AssetStatusFilter; label: string; tone: string }> = [
  { id: "needs-review", label: "Needs review", tone: "text-amber-700 dark:text-amber-400" },
  { id: "in-progress", label: "In progress", tone: "text-blue-700 dark:text-blue-400" },
  { id: "approved", label: "Approved", tone: "text-emerald-700 dark:text-emerald-400" },
  { id: "rejected", label: "Rejected", tone: "text-red-700 dark:text-red-400" },
];

const DATE_OPTIONS: Array<{ id: AssetDateRange; label: string }> = [
  { id: "custom", label: "Custom" },
  { id: "last7Days", label: "Last 7 days" },
  { id: "lastMonth", label: "Last month" },
  { id: "last3Months", label: "Last 3 months" },
  { id: "last6Months", label: "Last 6 months" },
];

const PROPERTY_OPTIONS: Array<{ id: AssetPropertyFilter; label: string; Icon?: typeof ImageIcon }> = [
  { id: "favorited", label: "Favorited" },
  { id: "not-favorited", label: "Not favorited" },
  { id: "has-comments", label: "Has comments", Icon: MessageCircle },
  { id: "mentions-me", label: "Mentions me" },
];

const CREATE_ITEMS = [
  { label: "Image", detail: "Generate or transform images", href: "/app/ai-image-generator", Icon: ImageIcon, tone: "bg-sky-500/10 text-sky-600 dark:text-sky-400" },
  { label: "Video", detail: "Create and edit video", href: "/app/ai-video-generator", Icon: Video, tone: "bg-violet-500/10 text-violet-600 dark:text-violet-400" },
  { label: "Audio", detail: "Generate voice and audio", href: "/app/voice-generator", Icon: Mic, tone: "bg-amber-500/10 text-amber-600 dark:text-amber-400" },
  { label: "3D", detail: "Create 3D assets", href: "/app/3d-generator", Icon: Box, tone: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" },
] as const;

function toggleValue<T extends string>(values: T[], value: T): T[] {
  return values.includes(value) ? values.filter((item) => item !== value) : [...values, value];
}

function Chip({
  active,
  disabled = false,
  children,
  onClick,
  title,
}: {
  active: boolean;
  disabled?: boolean;
  children: ReactNode;
  onClick?: () => void;
  title?: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      disabled={disabled}
      title={title}
      onClick={onClick}
      className={cn(
        "inline-flex h-7 items-center justify-center gap-1.5 whitespace-nowrap rounded-full border px-3 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
        active ? "border-transparent bg-secondary text-secondary-foreground" : "border-border/70 bg-background text-muted-foreground hover:bg-accent hover:text-accent-foreground",
        disabled && "cursor-not-allowed opacity-45 hover:bg-background hover:text-muted-foreground",
      )}
    >
      {children}
    </button>
  );
}

function FilterSection({ title, children, className }: { title: string; children: ReactNode; className?: string }) {
  return (
    <section className={cn("flex flex-col gap-2.5", className)}>
      <h3 className="text-[11px] font-semibold uppercase tracking-[0.13em] text-muted-foreground">{title}</h3>
      {children}
    </section>
  );
}

export function AssetLibraryToolbar({
  type,
  service,
  layout,
  columns,
  onFilterChange,
  onLayoutChange,
  onColumnsChange,
  projects = [],
  selectedProjectIds = [],
  onProjectIdsChange,
  selectedStatuses = [],
  onStatusesChange,
  dateRange = "all",
  onDateRangeChange,
  propertyFilters = [],
  onPropertyFiltersChange,
  visualLayout,
  onVisualLayoutChange,
  onGroupingChange,
  visibleFields = { status: false, tags: true, comments: false },
  onVisibleFieldsChange,
}: AssetLibraryToolbarProps) {
  const [filterOpen, setFilterOpen] = useState(false);
  const [layoutOpen, setLayoutOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [activeType, setActiveType] = useState<AssetFilterType>(type);
  const [serviceSearch, setServiceSearch] = useState("");
  const [moreFiltersOpen, setMoreFiltersOpen] = useState(false);
  const supportedServices = ASSET_SERVICE_OPTIONS.filter((item) => item.types.includes(activeType as "image" | "video" | "audio"));
  const visibleServices = supportedServices.filter((item) => item.label.toLowerCase().includes(serviceSearch.trim().toLowerCase()));
  const activeService = ASSET_SERVICE_OPTIONS.find((item) => item.id === service);
  const hasActiveFilter = type !== "all" || service !== "all" || selectedProjectIds.length > 0 || selectedStatuses.length > 0 || dateRange !== "all" || propertyFilters.length > 0;
  const currentTypeLabel = TYPE_OPTIONS.find((item) => item.id === type)?.label ?? "All";
  const currentLayoutMode: AssetVisualLayout = visualLayout ?? (layout === "list" ? "row" : "original");
  const statusAvailable = Boolean(onStatusesChange);
  const dateFilterAvailable = Boolean(onDateRangeChange);
  const propertiesAvailable = Boolean(onPropertyFiltersChange);

  const chooseType = (nextType: AssetFilterType) => {
    setActiveType(nextType);
    setServiceSearch("");
    onFilterChange(nextType, "all");
  };

  const chooseService = (nextService: string) => {
    onFilterChange(activeType === "all" ? "image" : activeType, nextService);
    setFilterOpen(false);
  };

  return (
    <div className="flex min-w-0 flex-wrap items-center justify-between gap-2 rounded-xl border border-border/70 bg-card/80 p-2 shadow-sm">
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        {/* Filter panel follows the structure of the supplied reference: category chips and stacked filter groups. */}
        <DropdownMenu
          open={filterOpen}
          onOpenChange={(open) => {
            setFilterOpen(open);
            if (open) {
              setActiveType(type);
              setServiceSearch("");
            }
          }}
        >
          <DropdownMenuTrigger asChild>
            <Button type="button" variant={hasActiveFilter ? "secondary" : "outline"} size="sm" className="h-9 gap-2 rounded-lg px-3">
              <SlidersHorizontal className="h-4 w-4" />
              Filter
              {hasActiveFilter && <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary/10 px-1.5 text-[10px] font-semibold text-primary">{Number(type !== "all") + Number(service !== "all") + Number(selectedProjectIds.length > 0) + Number(selectedStatuses.length > 0) + Number(dateRange !== "all") + Number(propertyFilters.length > 0)}</span>}
              <ChevronDown className={cn("h-3.5 w-3.5 text-muted-foreground transition-transform", filterOpen && "rotate-180")} />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" sideOffset={8} collisionPadding={12} className="max-h-[min(82vh,760px)] w-[min(94vw,530px)] overflow-y-auto rounded-2xl border border-border/80 bg-popover p-0 text-popover-foreground shadow-2xl">
            <div className="flex items-start justify-between gap-3 border-b border-border/70 px-4 py-3.5">
              <div>
                <p className="text-sm font-semibold tracking-tight">Filter creations</p>
                <p className="mt-0.5 text-xs text-muted-foreground">Narrow the collection by type and creation tool.</p>
              </div>
              <button type="button" disabled={!hasActiveFilter} onClick={() => { chooseType("all"); onProjectIdsChange?.([]); onStatusesChange?.([]); onDateRangeChange?.("all"); onPropertyFiltersChange?.([]); }} className="rounded-md px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-40">Clear all</button>
            </div>

            <div className="flex flex-col gap-6 px-4 py-5">
              <FilterSection title="Type">
                <div className="flex flex-wrap items-center gap-2">
                  {TYPE_OPTIONS.map(({ id, label, Icon }) => (
                    <Chip key={id} active={type === id} onClick={() => chooseType(id)}>
                      <Icon className="h-3.5 w-3.5" />{label}
                    </Chip>
                  ))}
                  {UNSUPPORTED_TYPES.map(({ label, Icon, title }) => (
                    <Chip key={label} active={false} disabled title={title}><Icon className="h-3.5 w-3.5" />{label}</Chip>
                  ))}
                </div>
                {activeType !== "all" && (
                  <div className="mt-1 rounded-xl border border-border/70 bg-muted/20 p-3">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold">{currentTypeLabel} services</span>
                      <span className="text-[11px] tabular-nums text-muted-foreground">{supportedServices.length} tools</span>
                    </div>
                    <label className="mb-2 flex h-8 items-center gap-2 rounded-lg border border-border/70 bg-background px-2.5 text-muted-foreground focus-within:ring-2 focus-within:ring-ring/30">
                      <Search className="h-3.5 w-3.5" />
                      <input value={serviceSearch} onChange={(event) => setServiceSearch(event.target.value)} placeholder={`Search ${currentTypeLabel.toLowerCase()} services`} aria-label={`Search ${currentTypeLabel.toLowerCase()} services`} className="min-w-0 flex-1 bg-transparent text-xs text-foreground outline-none placeholder:text-muted-foreground" />
                      {serviceSearch && <button type="button" onClick={() => setServiceSearch("")} aria-label="Clear service search"><X className="h-3.5 w-3.5" /></button>}
                    </label>
                    <div className="flex flex-wrap gap-1.5">
                      <Chip active={service === "all"} onClick={() => onFilterChange(activeType, "all")}>All {currentTypeLabel.toLowerCase()}</Chip>
                      {visibleServices.map((item) => <Chip key={item.id} active={service === item.id} onClick={() => chooseService(item.id)}>{item.label}</Chip>)}
                    </div>
                    {visibleServices.length === 0 && <p className="pt-2 text-xs text-muted-foreground">No matching tools.</p>}
                  </div>
                )}
              </FilterSection>

              <FilterSection title="Status">
                <div className="flex flex-wrap gap-1.5">
                  {STATUS_OPTIONS.map((item) => (
                    <Chip key={item.id} active={selectedStatuses.includes(item.id)} disabled={!statusAvailable} title={!statusAvailable ? "Status metadata is not available in the current asset data." : undefined} onClick={() => onStatusesChange?.(toggleValue(selectedStatuses, item.id))}>
                      <span className={cn("h-1.5 w-1.5 rounded-full bg-current", item.tone)} />{item.label}
                    </Chip>
                  ))}
                </div>
                {!statusAvailable && <p className="text-[11px] text-muted-foreground">Status filters need review-state metadata, which this asset view does not currently expose.</p>}
              </FilterSection>

              <FilterSection title="Project">
                {projects.length > 0 ? (
                  <div className="flex flex-wrap items-center gap-1.5">
                    {projects.map((project) => {
                      const selected = selectedProjectIds.includes(project.id);
                      return <Chip key={project.id} active={selected} disabled={!onProjectIdsChange} title={!onProjectIdsChange ? "Project filtering is not connected on this page." : undefined} onClick={() => onProjectIdsChange?.(toggleValue(selectedProjectIds, project.id))}>
                        <span className="h-3.5 w-3.5 rounded bg-muted" style={project.color ? { backgroundColor: project.color } : undefined} />
                        <span className="max-w-[180px] truncate">{project.name}</span>
                      </Chip>;
                    })}
                  </div>
                ) : (
                  <div className="flex items-center gap-2 rounded-lg border border-dashed border-border/70 px-3 py-2.5 text-xs text-muted-foreground">
                    <CircleHelp className="h-3.5 w-3.5 shrink-0" /> Project selection is available in the all-projects asset view.
                  </div>
                )}
              </FilterSection>

              <FilterSection title="Date range">
                <div className="flex flex-wrap gap-1.5">
                  {DATE_OPTIONS.map((item) => <Chip key={item.id} active={dateRange === item.id} disabled={!dateFilterAvailable} title={!dateFilterAvailable ? "Date filtering is not connected on this page." : undefined} onClick={() => onDateRangeChange?.(item.id)}>{item.label}</Chip>)}
                </div>
              </FilterSection>

              <FilterSection title="Properties">
                <div className="flex flex-wrap gap-1.5">
                  {PROPERTY_OPTIONS.map((item) => {
                    const disabled = !propertiesAvailable || (item.id === "has-comments" || item.id === "mentions-me");
                    const Icon = item.Icon;
                    return <Chip key={item.id} active={propertyFilters.includes(item.id)} disabled={disabled} title={disabled ? (item.id === "has-comments" || item.id === "mentions-me" ? "Comments and mentions are not part of the current asset model." : "Property filters are not connected on this page.") : undefined} onClick={() => onPropertyFiltersChange?.(toggleValue(propertyFilters, item.id))}>
                      {Icon && <Icon className="h-3.5 w-3.5" />}{item.label}
                    </Chip>;
                  })}
                </div>
              </FilterSection>
              <div className="border-t border-border/70 pt-4">
                <button type="button" aria-expanded={moreFiltersOpen} onClick={() => setMoreFiltersOpen((value) => !value)} className="flex items-center gap-1 rounded-md py-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  More filters <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", moreFiltersOpen && "rotate-180")} />
                </button>
                {moreFiltersOpen && <div className="mt-2 rounded-xl border border-dashed border-border/70 bg-muted/15 p-3 text-xs leading-5 text-muted-foreground">
                  Additional metadata filters can be enabled when the asset records expose tags, comments, ownership, or review status. The current panel only activates filters backed by existing page data.
                </div>}
              </div>
            </div>
            <div className="flex items-center justify-between gap-3 border-t border-border/70 bg-muted/15 px-4 py-3">
              <span className="truncate text-xs text-muted-foreground">Current: <span className="font-medium text-foreground">{activeService?.label ?? (currentTypeLabel === "All" ? "All creations" : currentTypeLabel)}</span></span>
              <Button type="button" size="sm" onClick={() => setFilterOpen(false)} className="h-8 rounded-lg px-4">Done</Button>
            </div>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Layout popover modelled on Magnific's Row / Original / Square selector and density controls. */}
        <DropdownMenu open={layoutOpen} onOpenChange={setLayoutOpen}>
          <DropdownMenuTrigger asChild>
            <Button type="button" variant="outline" size="sm" className="h-9 gap-2 rounded-lg px-3"><LayoutGrid className="h-4 w-4" />Layout<ChevronDown className={cn("h-3.5 w-3.5 text-muted-foreground transition-transform", layoutOpen && "rotate-180")} /></Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" sideOffset={8} collisionPadding={12} className="w-[min(92vw,360px)] rounded-2xl border border-border/80 p-4 shadow-2xl">
            <div className="flex flex-col gap-4">
              <section className="flex flex-col gap-2">
                <p className="text-xs text-muted-foreground">Creations layout</p>
                <div className="grid grid-cols-3 gap-1 rounded-xl border border-border/80 bg-muted/25 p-1">
                  <button type="button" aria-pressed={currentLayoutMode === "row"} onClick={() => { onLayoutChange("list"); onVisualLayoutChange?.("row"); }} className={cn("flex min-h-[58px] flex-col items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-xs transition-colors", currentLayoutMode === "row" ? "bg-background font-semibold shadow-sm" : "text-muted-foreground hover:text-foreground")}><List className="h-4 w-4" />Row</button>
                  <button type="button" aria-pressed={currentLayoutMode === "original"} onClick={() => { onLayoutChange("grid"); onVisualLayoutChange?.("original"); }} className={cn("flex min-h-[58px] flex-col items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-xs transition-colors", currentLayoutMode === "original" ? "bg-background font-semibold shadow-sm" : "text-muted-foreground hover:text-foreground")}><LayoutGrid className="h-4 w-4" />Original</button>
                  <button type="button" aria-pressed={currentLayoutMode === "square"} disabled={!onVisualLayoutChange} title={!onVisualLayoutChange ? "Square thumbnail layout is not connected to this page yet." : undefined} onClick={() => { onLayoutChange("grid"); onVisualLayoutChange?.("square"); }} className={cn("flex min-h-[58px] flex-col items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-xs transition-colors disabled:cursor-not-allowed disabled:opacity-40", currentLayoutMode === "square" ? "bg-background font-semibold shadow-sm" : "text-muted-foreground hover:text-foreground")}><Square className="h-4 w-4" />Square</button>
                </div>
              </section>

              <section className="flex items-center gap-3">
                <p className="w-12 shrink-0 text-xs text-muted-foreground">Size</p>
                <button type="button" aria-label="Smaller thumbnails" disabled={columns >= 6} onClick={() => onColumnsChange(Math.min(6, columns + 1))} className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-border/70 text-muted-foreground hover:bg-accent disabled:opacity-35"><span className="text-base leading-none">−</span></button>
                <input aria-label="Thumbnail size" type="range" min={2} max={6} step={1} value={8 - columns} onChange={(event) => onColumnsChange(8 - Number(event.target.value))} className="h-1.5 min-w-0 flex-1 cursor-pointer accent-primary" />
                <button type="button" aria-label="Larger thumbnails" disabled={columns <= 2} onClick={() => onColumnsChange(Math.max(2, columns - 1))} className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-border/70 text-muted-foreground hover:bg-accent disabled:opacity-35"><Plus className="h-3.5 w-3.5" /></button>
              </section>

              <section className="flex flex-col gap-2">
                <p className="text-xs text-muted-foreground">Edits</p>
                <div className="grid grid-cols-2 gap-1 rounded-lg border border-border/70 bg-muted/20 p-1">
                  <button type="button" disabled={!onGroupingChange} onClick={() => onGroupingChange?.(true)} className="flex h-8 items-center justify-center rounded-md text-xs font-medium hover:bg-background disabled:cursor-not-allowed disabled:opacity-40">Group</button>
                  <button type="button" disabled={!onGroupingChange} onClick={() => onGroupingChange?.(false)} className="flex h-8 items-center justify-center rounded-md text-xs font-medium hover:bg-background disabled:cursor-not-allowed disabled:opacity-40">Ungroup</button>
                </div>
                {!onGroupingChange && <p className="text-[11px] text-muted-foreground">Edit grouping is not supported by the current asset list.</p>}
              </section>

              <section className="flex flex-col gap-2">
                <div className="flex items-center justify-between gap-2"><p className="text-xs text-muted-foreground">Fields</p><span className="text-[11px] text-muted-foreground">Show on items</span></div>
                <div className="flex flex-wrap gap-1.5">
                  {([
                    ["status", "Status"], ["tags", "Tags"], ["comments", "Comments"],
                  ] as const).map(([key, label]) => <Chip key={key} active={visibleFields[key]} disabled={!onVisibleFieldsChange || key !== "tags"} title={key !== "tags" ? `${label} metadata is not supported on the current asset cards.` : !onVisibleFieldsChange ? "Field visibility is not connected to this page." : undefined} onClick={() => onVisibleFieldsChange?.({ ...visibleFields, [key]: !visibleFields[key] })}>{label}</Chip>)}
                </div>
              </section>
            </div>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Add menu follows the compact icon-tile dropdown from the reference. */}
      <DropdownMenu open={addOpen} onOpenChange={setAddOpen}>
        <DropdownMenuTrigger asChild>
          <Button type="button" size="sm" className="h-9 gap-2 rounded-lg px-3 shadow-sm"><Plus className="h-4 w-4" />Add<ChevronDown className={cn("h-3.5 w-3.5 opacity-80 transition-transform", addOpen && "rotate-180")} /></Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" sideOffset={8} className="w-[220px] rounded-2xl border border-border/80 p-2 shadow-xl">
          <DropdownMenuLabel className="px-3 pb-1 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Create new</DropdownMenuLabel>
          <DropdownMenuItem disabled className="h-9 rounded-lg px-3" title="Folder creation is not supported by the current project data model"><span className="flex h-6 w-6 items-center justify-center rounded-lg bg-muted text-muted-foreground"><FolderPlus className="h-3.5 w-3.5" /></span><span className="flex-1 text-xs">Folder</span><DropdownMenuShortcut>Soon</DropdownMenuShortcut></DropdownMenuItem>
          <DropdownMenuSeparator className="my-1.5" />
          {CREATE_ITEMS.map(({ label, detail, href, Icon, tone }) => (
            <DropdownMenuItem key={label} asChild className="h-auto min-h-10 rounded-lg px-3 py-1.5">
              <Link href={href} onClick={() => setAddOpen(false)}>
                <span className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-lg", tone)}><Icon className="h-3.5 w-3.5" /></span>
                <span className="min-w-0 flex-1"><span className="block text-xs font-medium">{label}</span><span className="mt-0.5 block truncate text-[11px] text-muted-foreground">{detail}</span></span>
              </Link>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
