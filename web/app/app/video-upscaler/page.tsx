"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Maximize2, Video } from "lucide-react";

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

export default function VideoUpscalerPage() {
  const [assets, setAssets] = useState<AssetSummary[]>([]);
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [factor, setFactor] = useState<2 | 4>(2);
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
    ? computeDisplayCost(costsConfig, { feature: "video_upscale", quality: "standard", resolution: "1K", quantity: 1, upscaleFactor: factor })
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
          const res = await fetch(`/api/video/upscale/${jobId}`);
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
            setError(data.error ?? "Upscale failed, please try again.");
          }
        } catch {
          // retry
        }
      }, POLL_INTERVAL_MS);
    },
    [stopPolling, cost]
  );

  const handleUpscale = async () => {
    if (!selectedAssetId || isBusy || !hasEnoughCredits) return;
    setError(null);
    setResultUrl(null);

    const form = new FormData();
    form.append("assetId", selectedAssetId);
    form.append("factor", String(factor));

    try {
      const res = await fetch("/api/video/upscale", { method: "POST", body: form });
      const data = await res.json();
      if (res.status === 402) {
        setBalance(typeof data.balance === "number" ? data.balance : balance);
        setError("You don't have enough credits for this upscale.");
        return;
      }
      if (!res.ok) {
        setError(data.error ?? "Upscale failed, please try again.");
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
          <h1 className="text-xl font-semibold tracking-tight">Video Upscaler</h1>
          <p className="text-sm text-muted-foreground">Enhance resolution and detail on an existing video.</p>
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
                <span className="text-sm font-medium">Upscale factor</span>
                <div className="flex overflow-hidden rounded-md border">
                  {[2, 4].map((f) => (
                    <button
                      key={f}
                      type="button"
                      aria-pressed={factor === f}
                      disabled={isBusy}
                      onClick={() => setFactor(f as 2 | 4)}
                      className={cn(
                        "px-4 py-1.5 text-xs font-medium transition-colors",
                        factor === f ? "bg-primary text-primary-foreground" : "hover:bg-accent disabled:opacity-50"
                      )}
                    >
                      {f}×
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Cost</span>
                  <span className="font-medium">{cost} credits</span>
                </div>
                <Button
                  type="button"
                  onClick={handleUpscale}
                  disabled={!selectedAssetId || isBusy || !hasEnoughCredits}
                  className="w-full gap-2"
                >
                  {isBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Maximize2 className="h-4 w-4" />}
                  Upscale video
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
                <Maximize2 className="h-8 w-8" />
              </div>
              <div>
                <p className="text-lg font-semibold">Upscale a video</p>
                <p className="text-sm text-muted-foreground">Select a video from your assets and choose a factor.</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
