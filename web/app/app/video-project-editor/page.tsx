"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, MonitorPlay, Trash2, Video } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { fetchCostsConfig, computeDisplayCost, type CostsConfig } from "@/lib/config/action-costs";
import { cn } from "@/lib/utils";

interface AssetSummary {
  id: string;
  type: "image" | "video" | "audio";
  url: string;
  createdAt: string;
}

const POLL_INTERVAL_MS = 2500;

export default function VideoProjectEditorPage() {
  const [assets, setAssets] = useState<AssetSummary[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [costsConfig, setCostsConfig] = useState<CostsConfig | null>(null);
  const [balance, setBalance] = useState<number | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  useEffect(() => stopPolling, [stopPolling]);

  useEffect(() => {
    fetchCostsConfig().then(setCostsConfig).catch(() => setCostsConfig(null));
    fetch("/api/credits/balance")
      .then((res) => res.json())
      .then((data) => setBalance(typeof data.balance === "number" ? data.balance : null))
      .catch(() => setBalance(null));
    fetch("/api/assets?type=video")
      .then((res) => (res.ok ? res.json() : { assets: [] }))
      .then((data: { assets: AssetSummary[] }) => setAssets(data.assets.filter((a) => a.type === "video")))
      .catch(() => setAssets([]));
  }, []);

  const cost = costsConfig
    ? computeDisplayCost(costsConfig, { feature: "video_edit_concat", quality: "standard", resolution: "1K", quantity: 1 })
    : 0;
  const hasEnoughCredits = balance === null || balance >= cost;

  const toggleAsset = (id: string) => {
    setSelectedIds((current) => (current.includes(id) ? current.filter((x) => x !== id) : [...current, id]));
  };

  const moveUp = (index: number) => {
    if (index === 0) return;
    setSelectedIds((current) => {
      const next = [...current];
      [next[index - 1], next[index]] = [next[index], next[index - 1]];
      return next;
    });
  };

  const moveDown = (index: number) => {
    setSelectedIds((current) => {
      if (index >= current.length - 1) return current;
      const next = [...current];
      [next[index], next[index + 1]] = [next[index + 1], next[index]];
      return next;
    });
  };

  const pollJob = useCallback(
    (jobId: string) => {
      stopPolling();
      setIsBusy(true);
      setResultUrl(null);
      setError(null);
      pollRef.current = setInterval(async () => {
        try {
          const res = await fetch(`/api/video/edit/${jobId}`);
          if (!res.ok) throw new Error("polling failed");
          const data = await res.json();
          if (data.status === "complete") {
            stopPolling();
            setIsBusy(false);
            setResultUrl(data.resultUrl ?? null);
            setBalance((b) => (typeof b === "number" ? b - cost : b));
          } else if (data.status === "failed") {
            stopPolling();
            setIsBusy(false);
            setError(data.error ?? "Edit failed, please try again.");
          }
        } catch {
          // retry
        }
      }, POLL_INTERVAL_MS);
    },
    [stopPolling, cost]
  );

  const handleEdit = async () => {
    if (selectedIds.length < 2 || isBusy || !hasEnoughCredits) return;
    setError(null);
    setResultUrl(null);

    const form = new FormData();
    selectedIds.forEach((id) => form.append("assetIds", id));
    form.append("operation", "concat");

    try {
      const res = await fetch("/api/video/edit", { method: "POST", body: form });
      const data = await res.json();
      if (res.status === 402) {
        setBalance(typeof data.balance === "number" ? data.balance : balance);
        setError("You don't have enough credits for this edit.");
        return;
      }
      if (!res.ok) {
        setError(data.error ?? "Edit failed, please try again.");
        return;
      }
      pollJob(data.jobId);
    } catch {
      setError("Network error — please try again.");
    }
  };

  return (
    <main className="flex min-h-screen w-full flex-col">
      <header className="flex items-center justify-between px-4 py-4 sm:px-6">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Video Project Editor</h1>
          <p className="text-sm text-muted-foreground">Edit multi-clip video projects.</p>
        </div>
        <div className="text-sm text-muted-foreground">{balance === null ? "…" : `${balance} credits`}</div>
      </header>

      <div className="grid flex-1 lg:grid-cols-[360px_1fr]">
        <div className="flex flex-col gap-4 border-r p-4 sm:p-5">
          <Card>
            <CardContent className="flex flex-col gap-4 p-4">
              <div className="flex flex-col gap-1.5">
                <span className="text-sm font-medium">Select clips to concatenate</span>
                <div className="max-h-48 overflow-y-auto rounded-md border">
                  {assets.length === 0 ? (
                    <p className="p-3 text-sm text-muted-foreground">No videos available. Generate some first.</p>
                  ) : (
                    assets.map((asset) => (
                      <button
                        key={asset.id}
                        type="button"
                        onClick={() => toggleAsset(asset.id)}
                        className={cn(
                          "flex w-full items-center gap-2 p-2 text-left text-sm transition-colors",
                          selectedIds.includes(asset.id) ? "bg-accent" : "hover:bg-accent/60"
                        )}
                      >
                        <Video className="h-4 w-4 shrink-0 text-muted-foreground" />
                        <span className="truncate">{asset.id.slice(0, 8)}</span>
                      </button>
                    ))
                  )}
                </div>
              </div>

              {selectedIds.length > 0 && (
                <div className="flex flex-col gap-1.5">
                  <span className="text-sm font-medium">Order</span>
                  <div className="flex flex-col gap-1 rounded-md border p-2">
                    {selectedIds.map((id, index) => {
                      const asset = assets.find((a) => a.id === id);
                      return (
                        <div key={id} className="flex items-center justify-between gap-2 text-sm">
                          <span className="truncate">{index + 1}. {id.slice(0, 8)}</span>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              disabled={index === 0}
                              onClick={() => moveUp(index)}
                              className="rounded px-2 py-1 text-xs hover:bg-accent disabled:opacity-50"
                            >
                              ↑
                            </button>
                            <button
                              type="button"
                              disabled={index === selectedIds.length - 1}
                              onClick={() => moveDown(index)}
                              className="rounded px-2 py-1 text-xs hover:bg-accent disabled:opacity-50"
                            >
                              ↓
                            </button>
                            <button
                              type="button"
                              onClick={() => toggleAsset(id)}
                              className="rounded px-2 py-1 text-xs text-destructive hover:bg-accent"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Cost</span>
                  <span className="font-medium">{cost} credits</span>
                </div>
                <Button
                  type="button"
                  onClick={handleEdit}
                  disabled={selectedIds.length < 2 || isBusy || !hasEnoughCredits}
                  className="w-full gap-2"
                >
                  {isBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <MonitorPlay className="h-4 w-4" />}
                  Concatenate clips
                </Button>
              </div>

              {error && (
                <p role="alert" className="text-sm text-destructive">
                  {error}
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="relative flex flex-col items-center justify-center overflow-y-auto bg-black/20 p-6">
          {resultUrl ? (
            <div className="flex w-full max-w-4xl flex-col gap-3">
              <span className="text-sm font-medium">Result</span>
              <video src={resultUrl} controls className="w-full rounded-xl bg-black" />
            </div>
          ) : (
            <div className="flex flex-col items-center gap-4 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-400">
                <MonitorPlay className="h-8 w-8" />
              </div>
              <div>
                <p className="text-lg font-semibold">Build a project</p>
                <p className="text-sm text-muted-foreground">Select two or more clips and arrange their order.</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
