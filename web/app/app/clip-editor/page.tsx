"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Scissors, Upload, Video, X } from "lucide-react";

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

export default function ClipEditorPage() {
  const [assets, setAssets] = useState<AssetSummary[]>([]);
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [uploadPreviewUrl, setUploadPreviewUrl] = useState<string | null>(null);
  const [operation, setOperation] = useState<"trim" | "speed" | "overlay" | "export">("trim");
  const [startSeconds, setStartSeconds] = useState(0);
  const [endSeconds, setEndSeconds] = useState(5);
  const [speed, setSpeed] = useState(1.5);
  const [overlayText, setOverlayText] = useState("");
  const [overlayPosition, setOverlayPosition] = useState<"top" | "bottom" | "center">("bottom");
  const [exportWidth, setExportWidth] = useState(1920);
  const [exportHeight, setExportHeight] = useState(1080);
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
    fetch("/api/assets?type=video")
      .then((res) => (res.ok ? res.json() : { assets: [] }))
      .then((data: { assets: AssetSummary[] }) => setAssets(data.assets.filter((a) => a.type === "video")))
      .catch(() => setAssets([]));
  }, []);

  const featureForOperation: Record<typeof operation, string> = {
    trim: "video_edit_trim",
    speed: "video_edit_speed",
    overlay: "video_edit_overlay",
    export: "video_edit_export",
  };
  const cost = costsConfig
    ? computeDisplayCost(costsConfig, { feature: featureForOperation[operation], quality: "standard", resolution: "1K", quantity: 1 })
    : 0;
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

  const handleEdit = async () => {
    if (!hasSource || isBusy || !hasEnoughCredits) return;
    if (operation === "trim" && endSeconds <= startSeconds) return;
    if (operation === "overlay" && overlayText.trim().length === 0) return;
    setError(null);
    setResultUrl(null);

    const form = new FormData();
    form.append("operation", operation);
    if (uploadedFile) {
      form.append("video", uploadedFile);
    } else if (selectedAssetId) {
      form.append("assetId", selectedAssetId);
    }
    if (operation === "trim") {
      form.append("startSeconds", String(startSeconds));
      form.append("endSeconds", String(endSeconds));
    } else if (operation === "speed") {
      form.append("speed", String(speed));
    } else if (operation === "overlay") {
      form.append("text", overlayText.trim());
      form.append("position", overlayPosition);
    } else if (operation === "export") {
      form.append("width", String(exportWidth));
      form.append("height", String(exportHeight));
    }

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

  useEffect(() => {
    return () => {
      if (uploadPreviewUrl) URL.revokeObjectURL(uploadPreviewUrl);
    };
  }, [uploadPreviewUrl]);

  return (
    <main className="flex min-h-screen w-full flex-col">
      <header className="flex items-center justify-between px-4 py-4 sm:px-6">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Clip Editor</h1>
          <p className="text-sm text-muted-foreground">Trim, speed up, caption, and resize video clips.</p>
        </div>
        <div className="text-sm text-muted-foreground">{balance === null ? "…" : `${balance} credits`}</div>
      </header>

      <div className="grid flex-1 lg:grid-cols-[360px_1fr]">
        <div className="flex flex-col gap-4 border-r p-4 sm:p-5">
          <Card>
            <CardContent className="flex flex-col gap-4 p-4">
              <div className="flex flex-col gap-1.5">
                <span className="text-sm font-medium">Select a video</span>
                <div className={cn("max-h-60 overflow-y-auto rounded-md border", uploadedFile && "opacity-50")}>
                  {assets.length === 0 ? (
                    <p className="p-3 text-sm text-muted-foreground">No videos available yet.</p>
                  ) : (
                    assets.map((asset) => (
                      <button
                        key={asset.id}
                        type="button"
                        disabled={Boolean(uploadedFile) || isBusy}
                        onClick={() => handleSelectAsset(asset.id)}
                        className={cn(
                          "flex w-full items-center gap-2 p-2 text-left text-sm transition-colors",
                          selectedAssetId === asset.id ? "bg-accent" : "hover:bg-accent/60",
                          (uploadedFile || isBusy) && "pointer-events-none"
                        )}
                      >
                        <Video className="h-4 w-4 shrink-0 text-muted-foreground" />
                        <span className="truncate">{asset.id.slice(0, 8)}</span>
                      </button>
                    ))
                  )}
                </div>
              </div>

              <div className="relative flex flex-col gap-1.5">
                <span className="text-sm font-medium">Or upload a video</span>
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
                <span className="text-sm font-medium">Operation</span>
                <select
                  value={operation}
                  onChange={(e) => setOperation(e.target.value as typeof operation)}
                  disabled={isBusy}
                  className="h-9 rounded-md border bg-background px-2 text-sm outline-none focus:border-primary"
                >
                  <option value="trim">Trim</option>
                  <option value="speed">Speed</option>
                  <option value="overlay">Text overlay</option>
                  <option value="export">Export resolution</option>
                </select>
              </div>

              {operation === "trim" && (
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
              )}

              {operation === "speed" && (
                <div className="flex flex-col gap-1.5">
                  <span className="text-sm font-medium">Playback speed</span>
                  <input
                    type="range"
                    min={0.5}
                    max={4}
                    step={0.1}
                    value={speed}
                    onChange={(e) => setSpeed(Number(e.target.value))}
                    disabled={isBusy}
                    className="w-full"
                  />
                  <div className="text-xs text-muted-foreground">{speed.toFixed(1)}x</div>
                </div>
              )}

              {operation === "overlay" && (
                <div className="flex flex-col gap-1.5">
                  <span className="text-sm font-medium">Caption</span>
                  <input
                    type="text"
                    value={overlayText}
                    onChange={(e) => setOverlayText(e.target.value.slice(0, 200))}
                    placeholder="Your caption..."
                    disabled={isBusy}
                    className="h-9 rounded-md border bg-background px-3 text-sm outline-none focus:border-primary"
                  />
                  <select
                    value={overlayPosition}
                    onChange={(e) => setOverlayPosition(e.target.value as typeof overlayPosition)}
                    disabled={isBusy}
                    className="h-9 rounded-md border bg-background px-2 text-sm outline-none focus:border-primary"
                  >
                    <option value="bottom">Bottom</option>
                    <option value="center">Center</option>
                    <option value="top">Top</option>
                  </select>
                </div>
              )}

              {operation === "export" && (
                <div className="flex flex-col gap-1.5">
                  <span className="text-sm font-medium">Resolution</span>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1">
                      <label className="text-xs text-muted-foreground">Width</label>
                      <input
                        type="number"
                        min={240}
                        value={exportWidth}
                        onChange={(e) => setExportWidth(Math.max(240, Number(e.target.value)))}
                        disabled={isBusy}
                        className="h-9 rounded-md border bg-background px-3 text-sm outline-none focus:border-primary"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-xs text-muted-foreground">Height</label>
                      <input
                        type="number"
                        min={240}
                        value={exportHeight}
                        onChange={(e) => setExportHeight(Math.max(240, Number(e.target.value)))}
                        disabled={isBusy}
                        className="h-9 rounded-md border bg-background px-3 text-sm outline-none focus:border-primary"
                      />
                    </div>
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
                  disabled={
                    !hasSource ||
                    isBusy ||
                    !hasEnoughCredits ||
                    (operation === "trim" && endSeconds <= startSeconds) ||
                    (operation === "overlay" && overlayText.trim().length === 0)
                  }
                  className="w-full gap-2"
                >
                  {isBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Scissors className="h-4 w-4" />}
                  {operation === "trim" && "Trim clip"}
                  {operation === "speed" && "Change speed"}
                  {operation === "overlay" && "Add caption"}
                  {operation === "export" && "Export video"}
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
                <Scissors className="h-8 w-8" />
              </div>
              <div>
                <p className="text-lg font-semibold">Edit a clip</p>
                <p className="text-sm text-muted-foreground">Select a video from your assets or upload one.</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
