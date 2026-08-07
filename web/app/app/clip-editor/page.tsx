"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Scissors, Video } from "lucide-react";

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

export default function ClipEditorPage() {
  const [assets, setAssets] = useState<AssetSummary[]>([]);
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [startSeconds, setStartSeconds] = useState(0);
  const [endSeconds, setEndSeconds] = useState(5);
  const [costsConfig, setCostsConfig] = useState<CostsConfig | null>(null);
  const [balance, setBalance] = useState<number | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const selectedAsset = assets.find((a) => a.id === selectedAssetId);

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
    ? computeDisplayCost(costsConfig, { feature: "video_edit_trim", quality: "standard", resolution: "1K", quantity: 1 })
    : 0;
  const hasEnoughCredits = balance === null || balance >= cost;

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
    if (!selectedAssetId || isBusy || !hasEnoughCredits || endSeconds <= startSeconds) return;
    setError(null);
    setResultUrl(null);

    const form = new FormData();
    form.append("assetId", selectedAssetId);
    form.append("operation", "trim");
    form.append("startSeconds", String(startSeconds));
    form.append("endSeconds", String(endSeconds));

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
          <h1 className="text-xl font-semibold tracking-tight">Clip Editor</h1>
          <p className="text-sm text-muted-foreground">Trim, cut, and edit video clips.</p>
        </div>
        <div className="text-sm text-muted-foreground">{balance === null ? "…" : `${balance} credits`}</div>
      </header>

      <div className="grid flex-1 lg:grid-cols-[360px_1fr]">
        <div className="flex flex-col gap-4 border-r p-4 sm:p-5">
          <Card>
            <CardContent className="flex flex-col gap-4 p-4">
              <div className="flex flex-col gap-1.5">
                <span className="text-sm font-medium">Select a video</span>
                <div className="max-h-60 overflow-y-auto rounded-md border">
                  {assets.length === 0 ? (
                    <p className="p-3 text-sm text-muted-foreground">No videos available. Generate one first.</p>
                  ) : (
                    assets.map((asset) => (
                      <button
                        key={asset.id}
                        type="button"
                        onClick={() => setSelectedAssetId(asset.id)}
                        className={cn(
                          "flex w-full items-center gap-2 p-2 text-left text-sm transition-colors",
                          selectedAssetId === asset.id ? "bg-accent" : "hover:bg-accent/60"
                        )}
                      >
                        <Video className="h-4 w-4 shrink-0 text-muted-foreground" />
                        <span className="truncate">{asset.id.slice(0, 8)}</span>
                      </button>
                    ))
                  )}
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <span className="text-sm font-medium">Trim range</span>
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1">
                    <label className="text-xs text-muted-foreground">Start (s)</label>
                    <input
                      type="number"
                      min={0}
                      value={startSeconds}
                      onChange={(e) => setStartSeconds(Math.max(0, Number(e.target.value)))}
                      disabled={isBusy}
                      className="h-9 rounded-md border bg-background px-3 text-sm outline-none focus:border-primary"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs text-muted-foreground">End (s)</label>
                    <input
                      type="number"
                      min={0}
                      value={endSeconds}
                      onChange={(e) => setEndSeconds(Math.max(0, Number(e.target.value)))}
                      disabled={isBusy}
                      className="h-9 rounded-md border bg-background px-3 text-sm outline-none focus:border-primary"
                    />
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Cost</span>
                  <span className="font-medium">{cost} credits</span>
                </div>
                <Button
                  type="button"
                  onClick={handleEdit}
                  disabled={!selectedAssetId || isBusy || !hasEnoughCredits || endSeconds <= startSeconds}
                  className="w-full gap-2"
                >
                  {isBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Scissors className="h-4 w-4" />}
                  Trim clip
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
          ) : selectedAsset ? (
            <div className="flex w-full max-w-4xl flex-col gap-3">
              <span className="text-sm font-medium">Source</span>
              <video src={selectedAsset.url} controls className="w-full rounded-xl bg-black" />
            </div>
          ) : (
            <div className="flex flex-col items-center gap-4 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-400">
                <Scissors className="h-8 w-8" />
              </div>
              <div>
                <p className="text-lg font-semibold">Edit a clip</p>
                <p className="text-sm text-muted-foreground">Select a video and set the trim range.</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
