"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { FastForward, Loader2, Upload, X } from "lucide-react";

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
const VIDEO_MIME_TYPES = "video/mp4,video/webm,video/quicktime";
const MAX_VIDEO_SIZE_BYTES = 100 * 1024 * 1024;

export default function VideoUpscalerPage() {
  const searchParams = useSearchParams();
  const preselectedAssetId = searchParams.get("assetId");
  const [assets, setAssets] = useState<AssetSummary[]>([]);
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [uploadPreviewUrl, setUploadPreviewUrl] = useState<string | null>(null);
  const [speedFactor, setSpeedFactor] = useState<1 | 2 | 4 | 8 | 16 | 32>(1);
  const [costsConfig, setCostsConfig] = useState<CostsConfig | null>(null);
  const [balance, setBalance] = useState<number | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
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
  }, []);

  useEffect(() => {
    Promise.all([
      fetch("/api/assets?type=video&feature=video_upscale").then((res) => (res.ok ? res.json() : { assets: [] })),
      preselectedAssetId
        ? fetch(`/api/assets/${encodeURIComponent(preselectedAssetId)}`).then((res) => (res.ok ? res.json() : null))
        : Promise.resolve(null),
    ])
      .then(([data, selectedData]: [{ assets: AssetSummary[] }, { asset?: AssetSummary } | null]) => {
        const list = Array.isArray(data.assets) ? data.assets.filter((asset) => asset.type === "video") : [];
        const selected = selectedData?.asset;
        setAssets(selected?.type === "video" && !list.some((asset) => asset.id === selected.id) ? [selected, ...list] : list);
        if (selected?.type === "video") setSelectedAssetId(selected.id);
      })
      .catch(() => setAssets([]));
  }, [resultUrl, preselectedAssetId]);

  const cost = costsConfig
    ? computeDisplayCost(costsConfig, {
        feature: "video_upscale",
        quality: "standard",
        resolution: "1K",
        quantity: 1,
      })
    : 20;
  const hasEnoughCredits = balance === null || balance >= cost;
  const hasSource = Boolean(selectedAssetId || uploadedFile);

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
            setError(data.error ?? "Video processing failed, please try again.");
          }
        } catch {
          // retry
        }
      }, POLL_INTERVAL_MS);
    },
    [stopPolling, cost]
  );

  const handleFileChange = (file: File | null) => {
    setError(null);
    if (!file) return;
    if (!file.type.startsWith("video/")) {
      setError("Please upload a video file (MP4, WebM or QuickTime).");
      return;
    }
    if (file.size > MAX_VIDEO_SIZE_BYTES) {
      setError("Video must be under 100 MB.");
      return;
    }
    setSelectedAssetId(null);
    setUploadedFile(file);
    setUploadPreviewUrl(URL.createObjectURL(file));
    setResultUrl(null);
  };

  const clearUpload = () => {
    setUploadedFile(null);
    setUploadPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSelectAsset = (id: string) => {
    setSelectedAssetId(id);
    clearUpload();
    setResultUrl(null);
    setError(null);
  };

  const handleUpscale = async () => {
    if (!hasSource || isBusy || !hasEnoughCredits) return;
    setError(null);
    setResultUrl(null);

    const form = new FormData();
    form.append("speedFactor", String(speedFactor));
    if (uploadedFile) {
      form.append("video", uploadedFile);
    } else if (selectedAssetId) {
      form.append("assetId", selectedAssetId);
    }

    try {
      const res = await fetch("/api/video/upscale", { method: "POST", body: form });
      const data = await res.json();
      if (res.status === 402) {
        setBalance(typeof data.balance === "number" ? data.balance : balance);
        setError("You don't have enough credits for this processing job.");
        return;
      }
      if (!res.ok) {
        setError(data.error ?? "Video processing failed, please try again.");
        return;
      }
      pollJob(data.jobId);
    } catch {
      setError("Network error — please try again.");
    }
  };

  useEffect(() => {
    return () => {
      if (uploadPreviewUrl) URL.revokeObjectURL(uploadPreviewUrl);
    };
  }, [uploadPreviewUrl]);

  return (
    <main className="flex min-h-screen w-full flex-col">
      <header className="flex items-center justify-between px-4 py-4 sm:px-6">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Video Speed</h1>
          <p className="text-sm text-muted-foreground">Change the playback speed of an existing video. No external AI service is used.</p>
        </div>
        <div className="text-sm text-muted-foreground">{balance === null ? "…" : `${balance} credits`}</div>
      </header>

      <div className="grid flex-1 lg:grid-cols-[360px_1fr]">
        <div className="flex flex-col gap-4 border-r p-4 sm:p-5">
          <Card>
            <CardContent className="flex flex-col gap-4 p-4">
              <div className="relative flex flex-col gap-1.5">
                <span className="text-sm font-medium">Upload a video</span>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={VIDEO_MIME_TYPES}
                  disabled={isBusy}
                  onChange={(e) => handleFileChange(e.target.files?.[0] ?? null)}
                  className="hidden"
                />
                <button
                  type="button"
                  disabled={isBusy}
                  onClick={() => fileInputRef.current?.click()}
                  className={cn(
                    "flex items-center justify-center gap-2 rounded-md border border-dashed px-4 py-3 text-sm transition-colors hover:bg-accent",
                    selectedAssetId && "opacity-50"
                  )}
                >
                  <Upload className="h-4 w-4" />
                  {uploadedFile ? uploadedFile.name : "Choose video file"}
                </button>
                {uploadedFile && (
                  <button
                    type="button"
                    onClick={clearUpload}
                    disabled={isBusy}
                    className="absolute right-2 top-6 rounded-full p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
                <p className="text-xs text-muted-foreground">MP4, WebM or QuickTime — max 100 MB</p>
              </div>

              <div className="flex flex-col gap-1.5">
                <span className="text-sm font-medium">Playback speed</span>
                <div className="flex overflow-hidden rounded-md border">
                  {([1, 2, 4, 8, 16, 32] as const).map((speed) => (
                    <button
                      key={speed}
                      type="button"
                      aria-pressed={speedFactor === speed}
                      disabled={isBusy}
                      onClick={() => setSpeedFactor(speed)}
                      className={cn(
                        "flex-1 px-2 py-1.5 text-xs font-medium transition-colors",
                        speedFactor === speed ? "bg-primary text-primary-foreground" : "hover:bg-accent disabled:opacity-50"
                      )}
                    >
                      {speed}×
                    </button>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  Processing costs 20 credits. {speedFactor > 1 ? `Output duration will be divided by ${speedFactor}.` : "1× keeps the original duration."}
                </p>
              </div>

              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Cost</span>
                  <span className="font-medium">{cost} credits</span>
                </div>
                <Button
                  type="button"
                  onClick={handleUpscale}
                  disabled={!hasSource || isBusy || !hasEnoughCredits}
                  className="w-full gap-2"
                >
                  {isBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <FastForward className="h-4 w-4" />}
                  Change video speed
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

        <div className="relative flex flex-col items-center justify-start gap-6 overflow-y-auto bg-black/20 p-6">
          {resultUrl ? (
            <div className="flex w-full max-w-4xl flex-col gap-3">
              <span className="text-sm font-medium">Result</span>
              <video src={resultUrl} controls className="w-full rounded-xl bg-black" />
            </div>
          ) : uploadPreviewUrl ? (
            <div className="flex w-full max-w-4xl flex-col gap-3">
              <span className="text-sm font-medium">Source</span>
              <video src={uploadPreviewUrl} controls className="w-full rounded-xl bg-black" />
            </div>
          ) : selectedAsset ? (
            <div className="flex w-full max-w-4xl flex-col gap-3">
              <span className="text-sm font-medium">Source</span>
              <video src={selectedAsset.url} controls className="w-full rounded-xl bg-black" />
            </div>
          ) : (
            <div className="flex flex-col items-center gap-4 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-400">
                <FastForward className="h-8 w-8" />
              </div>
              <div>
                <p className="text-lg font-semibold">Change video speed</p>
                <p className="text-sm text-muted-foreground">Select a video from your assets or upload one.</p>
              </div>
            </div>
          )}
          <Card className="w-full max-w-4xl text-left">
            <CardContent className="flex flex-col gap-3 p-4">
              <div>
                <h2 className="text-sm font-medium">Previous Video Speed projects</h2>
                <p className="text-xs text-muted-foreground">Choose a previous speed result to process again.</p>
              </div>
              {selectedAsset && !uploadedFile && (
                <div className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                  <span>Selected project video</span>
                  <Button type="button" size="sm" variant="ghost" onClick={() => setSelectedAssetId(null)}>Remove selection</Button>
                </div>
              )}
              {assets.length === 0 ? (
                <p className="text-sm text-muted-foreground">No previous Video Speed projects yet.</p>
              ) : (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {assets.map((asset) => (
                    <div key={asset.id} className={cn("rounded-md border p-1.5", selectedAssetId === asset.id && "border-primary")}>
                      <video src={asset.url} muted className="aspect-video w-full rounded object-cover" />
                      <Button type="button" size="sm" variant={selectedAssetId === asset.id ? "default" : "outline"} className="mt-2 w-full" disabled={isBusy} onClick={() => handleSelectAsset(asset.id)}>
                        {selectedAssetId === asset.id ? "Selected as source" : "Use as source"}
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  );
}
