"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";

interface SubscribeButtonProps {
  plan: string;
  highlighted: boolean;
}

export function SubscribeButton({ plan, highlighted }: SubscribeButtonProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function subscribe() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      const data = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
      if (data.url) {
        window.location.href = data.url;
        return;
      }
      setError(data.error ?? "Could not start checkout.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      <Button
        type="button"
        variant={highlighted ? "default" : "outline"}
        className="w-full"
        onClick={subscribe}
        disabled={busy}
      >
        {busy ? "Redirecting…" : highlighted ? "Subscribe" : "Get Started"}
      </Button>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
