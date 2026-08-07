"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowUpRight,
  Camera,
  Image as ImageIcon,
  LayoutGrid,
  Mic,
  Search,
  Video,
  Wand2,
} from "lucide-react";

import { TOOLS, type ToolDefinition } from "@/config/tools";
import { cn } from "@/lib/utils";

const TOOL_BY_ID = new Map(TOOLS.map((tool) => [tool.id, tool]));

const QUICK_ACTIONS: Array<{ id: string; label: string; shortcut: string }> = [
  { id: "screenshot-to-render", label: "Create image", shortcut: "Ctrl⇧I" },
  { id: "ambiance-change", label: "Edit image", shortcut: "Ctrl⇧E" },
  { id: "upscale", label: "Image upscaler", shortcut: "Ctrl⇧U" },
  { id: "video-generator", label: "Create video", shortcut: "Ctrl⇧V" },
  { id: "clip-editor", label: "Edit clip", shortcut: "Ctrl⇧C" },
  { id: "voice-generator", label: "Create voiceover", shortcut: "Ctrl⇧A" },
];

const RECENT_KEY = "rs-recent-tools";

function loadRecents(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(RECENT_KEY);
    const parsed = raw ? (JSON.parse(raw) as string[]) : [];
    return Array.isArray(parsed) ? parsed.filter((id) => TOOL_BY_ID.has(id)) : [];
  } catch {
    return [];
  }
}

function saveRecents(ids: string[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(RECENT_KEY, JSON.stringify(ids.slice(0, 4)));
  } catch {
    // ignore storage errors
  }
}

function pushRecent(id: string) {
  const current = loadRecents().filter((existing) => existing !== id);
  saveRecents([id, ...current]);
}

export function DashboardSearch() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [recents, setRecents] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setRecents(loadRecents());
  }, [open]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        inputRef.current?.focus();
        setOpen(true);
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    if (!open) return;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node;
      if (wrapperRef.current?.contains(target)) return;
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

  const normalizedQuery = query.trim().toLowerCase();

  const filteredTools = useMemo(() => {
    if (!normalizedQuery) return [];
    return TOOLS.filter(
      (tool) =>
        tool.name.toLowerCase().includes(normalizedQuery) ||
        tool.description.toLowerCase().includes(normalizedQuery)
    );
  }, [normalizedQuery]);

  const recentTools = useMemo(
    () => recents.map((id) => TOOL_BY_ID.get(id)).filter(Boolean) as ToolDefinition[],
    [recents]
  );

  const clearRecents = () => {
    saveRecents([]);
    setRecents([]);
  };

  const navigateToTool = (tool: ToolDefinition) => {
    pushRecent(tool.id);
    setQuery("");
    setOpen(false);
    router.push(tool.route);
  };

  const navigate = (route: string) => {
    setQuery("");
    setOpen(false);
    router.push(route);
  };

  return (
    <div ref={wrapperRef} className="relative z-50 w-full max-w-xl">
      <div
        className={cn(
          "flex h-12 w-full items-center gap-3 rounded-xl border bg-card px-4 text-sm transition-colors",
          open && "border-primary/40 ring-2 ring-ring",
          "hover:border-primary/40 hover:bg-accent"
        )}
      >
        <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onFocus={() => setOpen(true)}
          placeholder="Ask RenderStudio or find tutorials..."
          className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
        <div className="hidden items-center gap-2 sm:flex">
          <Mic className="h-4 w-4 text-muted-foreground" />
          <Camera className="h-4 w-4 text-muted-foreground" />
          <kbd className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">Ctrl K</kbd>
        </div>
      </div>

      {open && (
        <div
          className="fixed inset-0 z-40 backdrop-blur-sm bg-black/20"
          onClick={() => setOpen(false)}
          aria-hidden="true"
        />
      )}

      {open && (
        <div className="absolute top-full z-50 mt-2 w-full overflow-hidden rounded-xl border bg-popover shadow-2xl">
          <div className="max-h-[60vh] overflow-auto p-2">
            {normalizedQuery === "" ? (
              <>
                {recentTools.length > 0 && (
                  <div className="mb-3">
                    <div className="flex items-center justify-between px-2 pb-1.5 pt-1">
                      <span className="text-xs font-medium tracking-wide text-muted-foreground">
                        RECENTS
                      </span>
                      <button
                        type="button"
                        onClick={clearRecents}
                        className="text-xs text-muted-foreground transition-colors hover:text-foreground"
                      >
                        Clear
                      </button>
                    </div>
                    <div className="space-y-0.5">
                      {recentTools.map((tool) => (
                        <ResultRow
                          key={tool.id}
                          tool={tool}
                          suffix={<ArrowUpRight className="h-3.5 w-3.5" />}
                          onClick={() => navigateToTool(tool)}
                        />
                      ))}
                    </div>
                  </div>
                )}

                <div className="mb-3">
                  <div className="px-2 pb-1.5 pt-1 text-xs font-medium tracking-wide text-muted-foreground">
                    QUICK ACTIONS
                  </div>
                  <div className="space-y-0.5">
                    {QUICK_ACTIONS.map((action) => {
                      const tool = TOOL_BY_ID.get(action.id);
                      if (!tool) return null;
                      return (
                        <ResultRow
                          key={action.id}
                          tool={tool}
                          label={action.label}
                          suffix={
                            <kbd className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                              {action.shortcut}
                            </kbd>
                          }
                          onClick={() => {
                            pushRecent(tool.id);
                            navigate(tool.route);
                          }}
                        />
                      );
                    })}
                  </div>
                </div>

                <div className="border-t p-2">
                  <div className="flex flex-wrap gap-2">
                    <CategoryChip
                      icon={ImageIcon}
                      label="Image"
                      onClick={() => navigate("/app/ai-image-generator")}
                    />
                    <CategoryChip
                      icon={Video}
                      label="Video"
                      onClick={() => navigate("/app/ai-video-generator")}
                    />
                    <CategoryChip
                      icon={Mic}
                      label="Audio"
                      onClick={() => navigate("/app/voice-generator")}
                    />
                    <CategoryChip
                      icon={LayoutGrid}
                      label="All tools"
                      onClick={() => navigate("/app/models")}
                    />
                  </div>
                  <p className="mt-2 flex items-center gap-2 px-1 text-xs text-muted-foreground">
                    <Wand2 className="h-3 w-3" />
                    Tools. RenderStudio, ChatGPT, Figma, Photoshop, After Effects, and more.
                  </p>
                </div>
              </>
            ) : (
              <>
                {filteredTools.length === 0 ? (
                  <div className="flex flex-col items-center justify-center gap-2 px-3 py-8 text-center">
                    <Search className="h-8 w-8 text-muted-foreground/50" />
                    <p className="text-sm text-muted-foreground">
                      No tools match “{query}”.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-0.5">
                    {filteredTools.map((tool) => (
                      <ResultRow
                        key={tool.id}
                        tool={tool}
                        suffix={<ArrowUpRight className="h-3.5 w-3.5" />}
                        onClick={() => navigateToTool(tool)}
                      />
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function ResultRow({
  tool,
  label,
  suffix,
  onClick,
}: {
  tool: ToolDefinition;
  label?: string;
  suffix: React.ReactNode;
  onClick: () => void;
}) {
  const Icon = tool.icon;
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left text-sm transition-colors hover:bg-accent"
    >
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted">
        <Icon className="h-4 w-4 text-foreground" />
      </div>
      <span className="flex-1">{label ?? tool.name}</span>
      <span className="text-muted-foreground">{suffix}</span>
    </button>
  );
}

function CategoryChip({
  icon: Icon,
  label,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </button>
  );
}
