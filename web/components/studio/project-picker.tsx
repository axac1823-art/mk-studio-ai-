"use client";

import { useState } from "react";
import { Check, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export interface ProjectOption {
  id: string;
  name: string;
}

interface ProjectPickerProps {
  projects: ProjectOption[];
  value: string | null;
  onChange: (id: string) => void;
  onCreateProject: (name: string) => Promise<void>;
  compact?: boolean;
}

export function ProjectPicker({
  projects,
  value,
  onChange,
  onCreateProject,
  compact = false,
}: ProjectPickerProps) {
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const trimmed = name.trim();
    if (!trimmed || busy) return;
    setBusy(true);
    try {
      await onCreateProject(trimmed);
      setName("");
      setCreating(false);
    } finally {
      setBusy(false);
    }
  };

  if (creating) {
    return (
      <div className={compact ? "flex items-center gap-1.5" : "flex items-center gap-2"}>
        <input
          autoFocus
          value={name}
          onChange={(event) => setName(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") void submit();
            if (event.key === "Escape") setCreating(false);
          }}
          placeholder="Project name"
          className={compact
            ? "h-8 min-w-0 flex-1 rounded-md border bg-background px-2.5 text-xs outline-none focus:border-primary"
            : "h-9 flex-1 rounded-md border bg-background px-3 text-sm outline-none focus:border-primary"}
        />
        <Button type="button" size="sm" onClick={() => void submit()} disabled={!name.trim() || busy} aria-label="Create project">
          <Check className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  return (
    <div className={compact ? "flex items-center gap-1.5" : "flex items-center gap-2"}>
      <Select value={value ?? undefined} onValueChange={onChange}>
        <SelectTrigger className={compact ? "h-8 w-[min(240px,calc(100vw-9rem))] text-xs" : "flex-1"}>
          <SelectValue placeholder="Select a project" />
        </SelectTrigger>
        <SelectContent>
          {projects.map((project) => (
            <SelectItem key={project.id} value={project.id}>
              {project.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setCreating(true)}
        aria-label="New project"
        className={compact ? "h-8 w-8 p-0" : undefined}
      >
        <Plus className="h-4 w-4" />
      </Button>
    </div>
  );
}