"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ProjectSettingsForm({
  projectId,
  initialName,
}: {
  projectId: string;
  initialName: string;
}) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function saveName(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextName = name.trim();
    if (!nextName) {
      setError("Project name cannot be empty.");
      return;
    }

    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      const response = await fetch(`/api/projects/${projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: nextName }),
      });
      if (!response.ok) throw new Error("Could not update project name.");
      setName(nextName);
      setSaved(true);
      window.dispatchEvent(new Event("projects:updated"));
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save changes.");
    } finally {
      setBusy(false);
    }
  }

  async function deleteProject() {
    if (!window.confirm(`Delete project "${name}" and all its assets? This cannot be undone.`)) {
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/projects/${projectId}`, { method: "DELETE" });
      if (!response.ok) throw new Error("Could not delete project.");
      window.dispatchEvent(new Event("projects:updated"));
      router.push("/app/projects");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not delete project.");
      setBusy(false);
    }
  }

  return (
    <div className="space-y-8">
      <form onSubmit={saveName} className="max-w-xl space-y-4">
        <div className="space-y-2">
          <Label htmlFor="project-name">Project name</Label>
          <Input
            id="project-name"
            value={name}
            maxLength={120}
            onChange={(event) => {
              setName(event.target.value);
              setSaved(false);
            }}
            disabled={busy}
          />
        </div>
        <div className="flex items-center gap-3">
          <Button type="submit" disabled={busy || !name.trim()}>
            Save changes
          </Button>
          {saved && <p className="text-sm text-muted-foreground">Changes saved.</p>}
        </div>
      </form>

      <div className="border-t border-destructive/30 pt-6">
        <h2 className="font-medium text-destructive">Delete project</h2>
        <p className="mt-1 max-w-xl text-sm text-muted-foreground">
          Permanently delete this project and its assets. This action cannot be undone.
        </p>
        <Button
          type="button"
          variant="destructive"
          className="mt-4"
          disabled={busy}
          onClick={() => void deleteProject()}
        >
          Delete project
        </Button>
      </div>

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
