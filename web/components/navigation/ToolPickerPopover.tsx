"use client";

import { createPortal } from "react-dom";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";

import { ToolCard } from "@/components/navigation/ToolCard";
import { cn } from "@/lib/utils";
import {
  TOOL_CATEGORIES,
  type ToolCategory,
  type ToolDefinition,
  toolsByCategory,
} from "@/config/tools";

interface ToolPickerPopoverProps {
  children: React.ReactNode;
  defaultTab?: ToolCategory;
  placement?: "bottom" | "right";
  /** If set, only tools from this category are shown and tabs are hidden. */
  category?: ToolCategory;
}

export function ToolPickerPopover({
  children,
  defaultTab = "image",
  placement = "bottom",
  category,
}: ToolPickerPopoverProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<ToolCategory>(category ?? defaultTab);
  const [query, setQuery] = useState("");
  const [rect, setRect] = useState<DOMRect | null>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      setActiveTab(category ?? defaultTab);
      setQuery("");
    }
  }, [open, defaultTab, category]);

  useEffect(() => {
    if (!open) return;

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node;
      if (
        popoverRef.current?.contains(target) ||
        triggerRef.current?.contains(target)
      ) {
        return;
      }
      setOpen(false);
    };

    document.addEventListener("keydown", handleEscape);
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown);
    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
    };
  }, [open]);

  const measureTrigger = () => {
    if (triggerRef.current) {
      setRect(triggerRef.current.getBoundingClientRect());
    }
  };

  const handleOpen = () => {
    measureTrigger();
    setOpen(true);
  };

  const handleNavigate = (route: string) => {
    setOpen(false);
    router.push(route);
  };

  const filteredTools = useMemo<ToolDefinition[]>(() => {
    const normalized = query.trim().toLowerCase();
    const categoryTools = toolsByCategory(activeTab);
    if (!normalized) return categoryTools;
    return categoryTools.filter(
      (tool) =>
        tool.name.toLowerCase().includes(normalized) ||
        tool.description.toLowerCase().includes(normalized)
    );
  }, [activeTab, query]);

  const position = useMemo(() => {
    if (!rect) return { top: 0, left: 0 };
    const padding = 16;
    const popoverWidth = 640;

    if (placement === "right") {
      return {
        top: rect.top,
        left: Math.min(rect.right + 8, window.innerWidth - popoverWidth - padding),
      };
    }

    const idealLeft = rect.left + rect.width / 2 - popoverWidth / 2;
    const left = Math.max(padding, Math.min(idealLeft, window.innerWidth - popoverWidth - padding));
    return { top: rect.bottom + 8, left };
  }, [rect, placement]);

  const popover = (
    <div
      ref={popoverRef}
      className={cn(
        "fixed z-50 w-[640px] max-w-[calc(100vw-2rem)] rounded-xl border bg-popover p-4 shadow-2xl",
        "focus:outline-none"
      )}
      style={{ top: position.top, left: position.left }}
      role="dialog"
      aria-label="Tool picker"
    >
      <div className="flex flex-col gap-4">
        {!category && (
          <div className="flex items-center gap-2">
            {TOOL_CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setActiveTab(cat.id)}
                className={cn(
                  "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                  activeTab === cat.id
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
                )}
              >
                {cat.label}
              </button>
            ))}
          </div>
        )}

        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search tools..."
            className="h-10 w-full rounded-md border bg-background pl-9 pr-3 text-sm outline-none focus:border-primary"
            autoFocus
          />
        </div>

        {filteredTools.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">No tools match.</p>
        ) : (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {filteredTools.map((tool) => (
              <ToolCard
                key={tool.id}
                name={tool.name}
                description={tool.description}
                icon={tool.icon}
                onClick={() => handleNavigate(tool.route)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );

  return (
    <>
      <div
        ref={triggerRef}
        onClick={handleOpen}
        className="inline-flex cursor-pointer"
      >
        {children}
      </div>
      {open && typeof document !== "undefined" && createPortal(popover, document.body)}
    </>
  );
}
