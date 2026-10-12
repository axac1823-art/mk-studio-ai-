"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { SCENE_DETAILS_MAX } from "@/lib/presets";
import { cn } from "@/lib/utils";

interface SceneDetailsProps {
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  label?: string;
  placeholder?: string;
  helperText?: string;
  referenceTags?: string[];
}

export function SceneDetails({
  value,
  onChange,
  required = false,
  label = "Description",
  placeholder = "Describe what you want to create or change…",
  helperText,
  referenceTags = [],
}: SceneDetailsProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState<number | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const filteredTags = useMemo(() => {
    const prefix = query.slice(1).toLowerCase();
    return query.startsWith("@") ? referenceTags.filter((tag) => tag.toLowerCase().includes(prefix)) : [];
  }, [query, referenceTags]);

  useEffect(() => {
    setShowSuggestions(filteredTags.length > 0);
    setActiveIndex(0);
  }, [filteredTags]);

  const updateQuery = () => {
    const element = textareaRef.current;
    if (!element) return;
    const position = element.selectionStart;
    setCursor(position);
    const prefix = element.value.slice(0, position);
    const at = prefix.lastIndexOf("@");
    const typed = at < 0 ? "" : prefix.slice(at + 1);
    if (at < 0 || /\s/.test(typed) || typed.length > 20) {
      setQuery("");
      setShowSuggestions(false);
      return;
    }
    setQuery(`@${typed}`);
  };

  const insertTag = (tag: string) => {
    const element = textareaRef.current;
    if (!element || cursor === null) return;
    const before = element.value.slice(0, cursor);
    const at = before.lastIndexOf("@");
    if (at < 0) return;
    const insertion = `${tag} `;
    const next = `${element.value.slice(0, at)}${insertion}${element.value.slice(cursor)}`.slice(0, SCENE_DETAILS_MAX);
    onChange(next);
    const nextCursor = at + insertion.length;
    requestAnimationFrame(() => {
      element.focus();
      element.setSelectionRange(nextCursor, nextCursor);
      updateQuery();
    });
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (!showSuggestions || filteredTags.length === 0) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((index) => (index + 1) % filteredTags.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((index) => (index - 1 + filteredTags.length) % filteredTags.length);
    } else if (event.key === "Enter" || event.key === "Tab") {
      event.preventDefault();
      insertTag(filteredTags[activeIndex]);
    } else if (event.key === "Escape") {
      setShowSuggestions(false);
    }
  };

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-center justify-between gap-3">
        <label htmlFor="scene-details" className="text-sm font-semibold">
          {label}{required ? " *" : ""}
        </label>
        <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
          {value.length}/{SCENE_DETAILS_MAX}
        </span>
      </div>
      <div className="relative">
      <Textarea
        ref={textareaRef}
        id="scene-details"
        value={value}
        onChange={(e) => { onChange(e.target.value.slice(0, SCENE_DETAILS_MAX)); updateQuery(); }}
        onKeyDown={handleKeyDown}
        onKeyUp={updateQuery}
        onClick={updateQuery}
        onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
        placeholder={placeholder}
        rows={4}
        aria-required={required}
        className="min-h-[112px] resize-y rounded-xl border-border/70 bg-background text-sm leading-6 focus-visible:ring-2"
      />
      {showSuggestions && filteredTags.length > 0 && (
        <div className="absolute z-20 mt-1 w-full rounded-md border bg-popover shadow-md">
          <ul className="max-h-40 overflow-auto py-1">
            {filteredTags.map((tag, index) => (
              <li key={tag} role="option" aria-selected={index === activeIndex}
                onMouseDown={(event) => { event.preventDefault(); insertTag(tag); }}
                className={cn("cursor-pointer px-3 py-1.5 text-sm", index === activeIndex ? "bg-accent text-accent-foreground" : "hover:bg-accent/50")}>
                {tag}
              </li>
            ))}
          </ul>
        </div>
      )}
      </div>
      {helperText && <p className="text-xs leading-5 text-muted-foreground">{helperText}</p>}
      {referenceTags.length > 0 && (
        <p className="text-xs leading-5 text-muted-foreground">
          Type @ in Description and choose a reference tag so the AI can match your instruction to the right image.
        </p>
      )}
    </div>
  );
}
