"use client";

import { createPortal } from "react-dom";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, Wand2, FolderOpen, Image, Video, Settings, Mic, Maximize2, Scissors, MonitorPlay } from "lucide-react";

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
}

interface CommandItem {
  id: string;
  name: string;
  shortcut?: string;
  icon: React.ComponentType<{ className?: string }>;
  action: () => void;
}

export function CommandPalette({ open, onClose }: CommandPaletteProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const commands = useMemo<CommandItem[]>(() => {
    const navigate = (route: string) => {
      onClose();
      router.push(route);
    };
    return [
      { id: "generate", name: "Generate image render", icon: Wand2, action: () => navigate("/app/ai-image-generator") },
      { id: "video", name: "Generate video", icon: Video, action: () => navigate("/app/ai-video-generator") },
      { id: "video-upscale", name: "Upscale video", icon: Maximize2, action: () => navigate("/app/video-upscaler") },
      { id: "clip-editor", name: "Edit clip", icon: Scissors, action: () => navigate("/app/clip-editor") },
      { id: "video-project", name: "Edit video project", icon: MonitorPlay, action: () => navigate("/app/video-project-editor") },
      { id: "voice", name: "Generate voiceover", icon: Mic, action: () => navigate("/app/voice-generator") },
      { id: "projects", name: "Open projects", icon: FolderOpen, action: () => navigate("/app/projects") },
      { id: "uploads", name: "Open uploads", icon: Image, action: () => navigate("/app/uploads") },
      { id: "settings", name: "Open settings", icon: Settings, action: () => navigate("/app/settings") },
    ];
  }, [router, onClose]);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return commands;
    return commands.filter((command) => command.name.toLowerCase().includes(normalized));
  }, [commands, query]);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    inputRef.current?.focus();

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node;
      if (panelRef.current?.contains(target)) return;
      onClose();
    };

    document.addEventListener("keydown", handleEscape);
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown);
    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
    };
  }, [open, onClose]);

  if (!open) return null;

  const content = (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 pt-[15vh]">
      <div
        ref={panelRef}
        className="w-full max-w-xl overflow-hidden rounded-xl border bg-popover shadow-2xl"
        role="dialog"
        aria-label="Command palette"
      >
        <div className="flex items-center gap-2 border-b px-3 py-2">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Ask RenderStudio or find tutorials..."
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
          <kbd className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">ESC</kbd>
        </div>
        <div className="max-h-[60vh] overflow-auto p-1">
          {filtered.length === 0 ? (
            <p className="px-3 py-4 text-sm text-muted-foreground">No commands found.</p>
          ) : (
            filtered.map((command) => {
              const Icon = command.icon;
              return (
                <button
                  key={command.id}
                  type="button"
                  onClick={command.action}
                  className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-accent"
                >
                  <Icon className="h-4 w-4 text-muted-foreground" />
                  <span className="flex-1">{command.name}</span>
                  {command.shortcut && (
                    <kbd className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                      {command.shortcut}
                    </kbd>
                  )}
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );

  return typeof document !== "undefined" ? createPortal(content, document.body) : null;
}

export function useCommandPaletteShortcut(onOpen: () => void) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        onOpen();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onOpen]);
}
