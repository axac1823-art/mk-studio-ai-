"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { Trash2 } from "lucide-react";

interface ShotEditorProps {
  index: number;
  prompt: string;
  tags: string[];
  onPromptChange: (value: string) => void;
  disabled?: boolean;
  onDelete?: () => void;
}

const MAX_PROMPT_LENGTH = 1999;

export function ShotEditor({ index, prompt, tags, onPromptChange, disabled, onDelete }: ShotEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [cursor, setCursor] = useState<number | null>(null);

  const filteredTags = useMemo(() => {
    if (!query.startsWith("@")) return [];
    const prefix = query.slice(1).toLowerCase();
    return tags.filter((tag) => tag.toLowerCase().includes(prefix));
  }, [query, tags]);

  useEffect(() => {
    if (filteredTags.length === 0) {
      setShowSuggestions(false);
      return;
    }
    setShowSuggestions(true);
    setActiveIndex(0);
  }, [filteredTags]);

  const updateQuery = () => {
    const el = textareaRef.current;
    if (!el) return;
    const pos = el.selectionStart;
    setCursor(pos);
    const text = el.value.slice(0, pos);
    const lastAt = text.lastIndexOf("@");
    if (lastAt === -1) {
      setQuery("");
      setShowSuggestions(false);
      return;
    }
    const afterAt = text.slice(lastAt + 1);
    if (/\s/.test(afterAt) || afterAt.length > 20) {
      setQuery("");
      setShowSuggestions(false);
      return;
    }
    setQuery("@" + afterAt);
  };

  const insertTag = (tag: string) => {
    const el = textareaRef.current;
    if (!el || cursor === null) return;
    const text = el.value;
    const before = text.slice(0, cursor);
    const lastAt = before.lastIndexOf("@");
    if (lastAt === -1) return;
    const replacement = tag + " ";
    const newValue = text.slice(0, lastAt) + replacement + text.slice(cursor);
    onPromptChange(newValue.slice(0, MAX_PROMPT_LENGTH));
    const newPos = lastAt + replacement.length;
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(newPos, newPos);
      updateQuery();
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (!showSuggestions || filteredTags.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % filteredTags.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => (i - 1 + filteredTags.length) % filteredTags.length);
    } else if (e.key === "Enter" || e.key === "Tab") {
      e.preventDefault();
      insertTag(filteredTags[activeIndex]);
    } else if (e.key === "Escape") {
      setShowSuggestions(false);
    }
  };

  return (
    <div className="relative flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">Shot {index + 1}</span>
        <div className="flex items-center gap-2">
          <span className={cn("text-xs", prompt.length > MAX_PROMPT_LENGTH ? "text-destructive" : "text-muted-foreground")}>
            {prompt.length}/{MAX_PROMPT_LENGTH}
          </span>
          {onDelete && (
            <button
              type="button"
              onClick={onDelete}
              disabled={disabled}
              className="rounded p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-destructive disabled:opacity-50"
              aria-label="Remove shot"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
      <Textarea
        ref={textareaRef}
        disabled={disabled}
        value={prompt}
        onChange={(e) => onPromptChange(e.target.value.slice(0, MAX_PROMPT_LENGTH))}
        onKeyDown={handleKeyDown}
        onKeyUp={updateQuery}
        onClick={updateQuery}
        onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
        placeholder="Reference your video or images using @img1, @vid1…"
        rows={3}
      />
      {showSuggestions && filteredTags.length > 0 && (
        <div className="absolute z-10 mt-1 w-full rounded-md border bg-popover shadow-md" style={{ top: "100%" }}>
          <ul className="max-h-40 overflow-auto py-1">
            {filteredTags.map((tag, i) => (
              <li
                key={tag}
                role="option"
                aria-selected={i === activeIndex}
                onMouseDown={(e) => {
                  e.preventDefault();
                  insertTag(tag);
                }}
                className={cn(
                  "cursor-pointer px-3 py-1.5 text-sm",
                  i === activeIndex ? "bg-accent text-accent-foreground" : "hover:bg-accent/50"
                )}
              >
                {tag}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
