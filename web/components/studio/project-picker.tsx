"use client";

// Sélecteur de projet du studio : chaque génération est rattachée à un
// projet à la création (modèle Projects/Assets). Création inline sans
// quitter le studio. Aucune logique de fetch ici — le dashboard fournit
// la liste et gère la création (il la refetch pour garder la liste à jour).
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
}

export function ProjectPicker({ projects, value, onChange, onCreateProject }: ProjectPickerProps) {
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
      <div className="flex items-center gap-2">
        <input
          autoFocus
          value={name}
          onChange={(event) => setName(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") void submit();
            if (event.key === "Escape") setCreating(false);
          }}
          placeholder="Project name"
          className="h-9 flex-1 rounded-md border bg-background px-3 text-sm outline-none focus:border-primary"
        />
        <Button type="button" size="sm" onClick={() => void submit()} disabled={!name.trim() || busy}>
          <Check className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Select value={value ?? undefined} onValueChange={onChange}>
        <SelectTrigger className="flex-1">
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
      >
        <Plus className="h-4 w-4" />
      </Button>
    </div>
  );
}
