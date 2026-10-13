"use client";

import { createPortal } from "react-dom";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Search, X } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  TOOL_CATEGORIES,
  TOOLS,
  type ToolCategory,
  type ToolDefinition,
  toolsByCategory,
} from "@/config/tools";

interface ToolPickerPopoverProps {
  children: ReactNode;
  defaultTab?: ToolCategory;
  placement?: "bottom" | "right";
  /** If set, only tools from this category are shown and category tabs are hidden. */
  category?: ToolCategory;
}

type ToolPickerTab = ToolCategory | "all";

const POPOVER_WIDTH = 480;
const VIEWPORT_GUTTER = 12;

function getCategoryIconClass(category: ToolCategory) {
  switch (category) {
    case "image":
      return "bg-primary/10 text-primary";
    case "video":
      return "bg-sky-500/10 text-sky-500";
    case "audio":
      return "bg-violet-500/10 text-violet-500";
    case "3d":
      return "bg-emerald-500/10 text-emerald-500";
  }
}

function ToolItem({
  tool,
  onSelect,
}: {
  tool: ToolDefinition;
  onSelect: (route: string) => void;
}) {
  const Icon = tool.icon;

  return (
    <button
      type="button"
      onClick={() => onSelect(tool.route)}
      className={cn(
        "group flex min-h-14 min-w-0 w-full items-center gap-2.5 rounded-lg p-1.5 text-left",
        "transition-colors duration-150 hover:bg-accent/60",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
          "transition-colors group-hover:bg-background",
          getCategoryIconClass(tool.category),
        )}
      >
        <Icon className="h-4 w-4" />
      </span>

      <span className="flex min-w-0 flex-1 flex-col items-start gap-0.5">
        <span className="block w-full truncate text-[13px] font-medium leading-4 text-foreground">
          {tool.name}
        </span>
        <span className="block w-full truncate text-[11px] leading-4 text-muted-foreground">
          {tool.description}
        </span>
      </span>
    </button>
  );
}

export function ToolPickerPopover({
  children,
  defaultTab,
  placement = "bottom",
  category,
}: ToolPickerPopoverProps) {
  const router = useRouter();
  const dialogId = useId();
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<ToolPickerTab>(category ?? defaultTab ?? "all");
  const [query, setQuery] = useState("");
  const [rect, setRect] = useState<DOMRect | null>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;

    setActiveTab(category ?? defaultTab ?? "all");
    setQuery("");

    const updateTriggerRect = () => {
      if (triggerRef.current) {
        setRect(triggerRef.current.getBoundingClientRect());
      }
    };

    updateTriggerRect();
    window.addEventListener("resize", updateTriggerRect);
    window.addEventListener("scroll", updateTriggerRect, true);

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    const handleOutsidePointer = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (popoverRef.current?.contains(target) || triggerRef.current?.contains(target)) return;
      setOpen(false);
    };

    document.addEventListener("keydown", handleEscape);
    document.addEventListener("pointerdown", handleOutsidePointer);

    return () => {
      window.removeEventListener("resize", updateTriggerRect);
      window.removeEventListener("scroll", updateTriggerRect, true);
      document.removeEventListener("keydown", handleEscape);
      document.removeEventListener("pointerdown", handleOutsidePointer);
    };
  }, [open, defaultTab, category]);

  const filteredTools = useMemo<ToolDefinition[]>(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    const selectedCategory = category ?? activeTab;
    const sourceTools = selectedCategory === "all" ? TOOLS : toolsByCategory(selectedCategory);

    if (!normalizedQuery) return sourceTools;

    return sourceTools.filter((tool) =>
      `${tool.name} ${tool.description}`.toLocaleLowerCase().includes(normalizedQuery),
    );
  }, [activeTab, category, query]);

  const categoriesToRender = useMemo<ToolCategory[]>(() => {
    if (category) return [category];
    if (activeTab !== "all") return [activeTab];
    return TOOL_CATEGORIES.map((item) => item.id);
  }, [activeTab, category]);

  const position = useMemo(() => {
    if (typeof window === "undefined") {
      return { top: 0, left: 0, width: POPOVER_WIDTH };
    }

    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const width = Math.max(0, Math.min(POPOVER_WIDTH, viewportWidth - VIEWPORT_GUTTER * 2));

    if (!rect) {
      return { top: VIEWPORT_GUTTER, left: VIEWPORT_GUTTER, width };
    }

    const right = rect.right + 8;
    const canPlaceRight =
      placement === "right" && right + width <= viewportWidth - VIEWPORT_GUTTER;

    if (canPlaceRight) {
      const estimatedHeight = Math.min(400, viewportHeight - VIEWPORT_GUTTER * 2);
      const maxTop = Math.max(VIEWPORT_GUTTER, viewportHeight - estimatedHeight - VIEWPORT_GUTTER);
      return {
        top: Math.max(VIEWPORT_GUTTER, Math.min(rect.top, maxTop)),
        left: right,
        width,
      };
    }

    const idealLeft = rect.left + rect.width / 2 - width / 2;
    const maxLeft = Math.max(VIEWPORT_GUTTER, viewportWidth - width - VIEWPORT_GUTTER);
    const left = Math.max(VIEWPORT_GUTTER, Math.min(idealLeft, maxLeft));
    const spaceBelow = viewportHeight - rect.bottom - VIEWPORT_GUTTER;
    const estimatedHeight = Math.min(400, viewportHeight - VIEWPORT_GUTTER * 2);
    const preferredTop =
      spaceBelow >= 280
        ? rect.bottom + 8
        : rect.top - estimatedHeight - 8;
    const maxTop = Math.max(VIEWPORT_GUTTER, viewportHeight - estimatedHeight - VIEWPORT_GUTTER);
    const top = Math.max(VIEWPORT_GUTTER, Math.min(preferredTop, maxTop));

    return { top, left, width };
  }, [rect, placement]);

  const handleToggle = () => {
    if (open) {
      setOpen(false);
      return;
    }
    if (triggerRef.current) {
      setRect(triggerRef.current.getBoundingClientRect());
    }
    setActiveTab(category ?? defaultTab ?? "all");
    setQuery("");
    setOpen(true);
  };

  const handleNavigate = (route: string) => {
    setOpen(false);
    router.push(route);
  };

  const popover = (
    <div
      ref={popoverRef}
      className="pointer-events-none fixed z-50 focus:outline-none"
      style={{ top: position.top, left: position.left, width: position.width }}
    >
      <div
        id={dialogId}
        role="dialog"
        aria-label="Choose a tool"
        className={cn(
          "pointer-events-auto flex max-h-[calc(100dvh-24px)] min-w-0 flex-col gap-3 overflow-hidden",
          "rounded-xl border bg-popover p-3 text-popover-foreground shadow-xl",
        )}
      >
        <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          {!category && (
            <div
              role="tablist"
              aria-label="Tool categories"
              className="flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            >
              {([{ id: "all", label: "All" }, ...TOOL_CATEGORIES] as Array<{
                id: ToolPickerTab;
                label: string;
              }>).map((tab) => {
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    onClick={() => setActiveTab(tab.id)}
                    className={cn(
                      "h-8 shrink-0 rounded-full px-3 text-xs font-medium transition-colors",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      isActive
                        ? "bg-accent text-foreground"
                        : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
                    )}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>
          )}

          {category && (
            <span className="shrink-0 px-1 text-xs font-semibold text-muted-foreground">
              {TOOL_CATEGORIES.find((item) => item.id === category)?.label ?? "Tools"}
            </span>
          )}

          <label className="flex h-8 w-full shrink-0 items-center gap-2 rounded-lg border bg-background px-2.5 transition-colors focus-within:border-ring sm:w-[148px]">
            <Search aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <input
              ref={searchRef}
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search tools"
              aria-label="Search tools"
              className="h-full min-w-0 flex-1 bg-transparent text-xs outline-none placeholder:text-muted-foreground/70"
              autoComplete="off"
            />
            {query && (
              <button
                type="button"
                aria-label="Clear search"
                onClick={() => {
                  setQuery("");
                  searchRef.current?.focus();
                }}
                className="flex h-5 w-5 shrink-0 items-center justify-center rounded hover:bg-accent"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </label>
        </div>

        <div className="min-h-0 overflow-y-auto overscroll-contain pr-0.5 [scrollbar-width:thin]">
          {filteredTools.length === 0 ? (
            <div className="flex min-h-28 flex-col items-center justify-center px-4 py-6 text-center">
              <Search className="mb-2 h-4 w-4 text-muted-foreground/70" />
              <p className="text-xs font-medium">No tools found</p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                Try another search or choose a different category.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {categoriesToRender.map((toolCategory) => {
                const categoryTools = filteredTools.filter((tool) => tool.category === toolCategory);
                if (categoryTools.length === 0) return null;

                const label = TOOL_CATEGORIES.find((item) => item.id === toolCategory)?.label ?? toolCategory;
                const showSectionTitle = !category && activeTab === "all";

                return (
                  <section key={toolCategory} aria-label={`${label} tools`} className="min-w-0">
                    {showSectionTitle && (
                      <h3 className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/80">
                        {label}
                      </h3>
                    )}
                    <div className="grid grid-cols-1 content-start gap-0.5 sm:grid-cols-2">
                      {categoryTools.map((tool) => (
                        <ToolItem key={tool.id} tool={tool} onSelect={handleNavigate} />
                      ))}
                    </div>
                  </section>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <>
      <div
        ref={triggerRef}
        onClick={handleToggle}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? dialogId : undefined}
        className="inline-flex min-w-0 cursor-pointer"
      >
        {children}
      </div>
      {open && typeof document !== "undefined" ? createPortal(popover, document.body) : null}
    </>
  );
}
