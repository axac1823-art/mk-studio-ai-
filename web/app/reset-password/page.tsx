"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { updatePassword } from "./actions";

export default function ResetPasswordPage() {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const result = await updatePassword(undefined, new FormData(event.currentTarget));
    if (result && "error" in result) {
      setError(result.error ?? null);
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-screen w-full items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-semibold tracking-tight">New password</h1>
          <p className="text-sm text-muted-foreground">Choose a new password for your account.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="password" className="text-sm font-medium">
              New password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              minLength={6}
              autoComplete="new-password"
              className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:border-primary"
            />
          </div>

          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}

          <Button type="submit" className="w-full" disabled={busy}>
            Update password
          </Button>
        </form>
      </div>
    </main>
  );
}
