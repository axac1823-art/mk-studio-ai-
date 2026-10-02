"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { deleteAccount } from "./actions";

export function DeleteAccountButton() {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    setBusy(true);
    setError(null);
    const result = await deleteAccount();
    if (result && "error" in result) {
      setError(result.error ?? "Could not delete account.");
      setBusy(false);
      setConfirming(false);
    }
  }

  if (confirming) {
    return (
      <div className="space-y-3 rounded-md border border-destructive/50 bg-destructive/5 p-4">
        <p className="text-sm font-medium text-destructive">Are you sure?</p>
        <p className="text-sm text-muted-foreground">
          This will permanently delete your account, projects, assets and credit history. This action cannot be undone.
        </p>
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={() => setConfirming(false)} disabled={busy}>
            Cancel
          </Button>
          <Button type="button" variant="destructive" onClick={handleDelete} disabled={busy}>
            {busy ? "Deleting…" : "Delete my account"}
          </Button>
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>
    );
  }

  return (
    <Button type="button" variant="outline" className="border-destructive/50 text-destructive hover:bg-destructive/5" onClick={() => setConfirming(true)}>
      Delete account
    </Button>
  );
}
