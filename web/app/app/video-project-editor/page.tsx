"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Loader2, MonitorPlay, Trash2, Upload } from "lucide-react";

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

export default function VideoProjectEditorPage() {
  const searchParams = useSearchParams();
  const preselectedAssetId = searchParams.get("assetId");
  const [assets, setAssets] = useState<AssetSummary[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [sourceService, setSourceService] = useState("all");
  const [costsConfig, setCostsConfig] = useState<CostsConfig | null>(null);
  const [balance, setBalance] = useState<number | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
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
  }, []);

  const loadAssets = useCallback(() => {
    const featureQuery = sourceService === "all" ? "" : `&feature=${encodeURIComponent(sourceService)}`;
    Promise.all([
      fetch(`/api/assets?type=video${featureQuery}`).then((res) => (res.ok ? res.json() : { assets: [] })),
      preselectedAssetId
        ? fetch(`/api/assets/${encodeURIComponent(preselectedAssetId)}`).then((res) => (res.ok ? res.json() : null))
        : Promise.resolve(null),
    ])
      .then(([data, selectedData]: [{ assets: AssetSummary[] }, { asset?: AssetSummary } | null]) => {
        const list = Array.isArray(data.assets) ? data.assets.filter((asset) => asset.type === "video") : [];
        const selected = selectedData?.asset;
        setAssets(selected?.type === "video" && !list.some((asset) => asset.id === selected.id) ? [selected, ...list] : list);
        if (selected?.type === "video") setSelectedIds((current) => current.includes(selected.id) ? current : [selected.id, ...current]);
      })
      .catch(() => setAssets([]));
  }, [sourceService, preselectedAssetId]);

  useEffect(() => {
    loadAssets();
  }, [loadAssets, resultUrl]);

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

  const handleFilesSelected = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const videoFiles = Array.from(files).filter((f) => f.type.startsWith("video/"));
    if (videoFiles.length === 0) {
      setError("Please upload video files (MP4, WebM or QuickTime).");
      return;
    }
    const oversized = videoFiles.find((f) => f.size > MAX_VIDEO_SIZE_BYTES);
    if (oversized) {
      setError("Each video must be under 100 MB.");
      return;
    }

    setError(null);
    setIsUploading(true);
    const uploaded: AssetSummary[] = [];
    try {
      for (const file of videoFiles) {
        const form = new FormData();
        form.append("file", file);
        const res = await fetch("/api/assets", { method: "POST", body: form });
        const data = await res.json();
        if (!res.ok || !data.asset) {
          throw new Error(data.error ?? "Upload failed.");
        }
        uploaded.push(data.asset as AssetSummary);
      }
      setAssets((current) => [...uploaded, ...current]);
      setSelectedIds((current) => [...current, ...uploaded.map((a) => a.id)]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed, please try again.");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
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
              <div className="relative flex flex-col gap-1.5">
                <span className="text-sm font-medium">Or upload clips</span>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={VIDEO_MIME_TYPES}
                  multiple
                  disabled={isBusy || isUploading}
                  onChange={(e) => handleFilesSelected(e.target.files)}
                  className="hidden"
                />
                <button
                  type="button"
                  disabled={isBusy || isUploading}
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center justify-center gap-2 rounded-md border border-dashed px-4 py-3 text-sm transition-colors hover:bg-accent disabled:opacity-50"
                >
                  {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                  {isUploading ? "Uploading…" : "Choose video files"}
                </button>
                <p className="text-xs text-muted-foreground">MP4, WebM or QuickTime — max 100 MB each</p>
              </div>

              {selectedIds.length > 0 && (
                <div className="flex flex-col gap-1.5">
                  <span className="text-sm font-medium">Order</span>
                  <div className="flex flex-col gap-1 rounded-md border p-2">
                    {selectedIds.map((id, index) => (
                      <div key={id} className="flex items-center justify-between gap-2 text-sm">
                          <span className="truncate">{index + 1}. {id.slice(0, 8)}</span>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              disabled={index === 0 || isBusy}
                              onClick={() => moveUp(index)}
                              className="rounded px-2 py-1 text-xs hover:bg-accent disabled:opacity-50"
                            >
                              ↑
                            </button>
                            <button
                              type="button"
                              disabled={index === selectedIds.length - 1 || isBusy}
                              onClick={() => moveDown(index)}
                              className="rounded px-2 py-1 text-xs hover:bg-accent disabled:opacity-50"
                            >
                              ↓
                            </button>
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() => toggleAsset(id)}
                              className="rounded px-2 py-1 text-xs text-destructive hover:bg-accent disabled:opacity-50"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </div>
                        </div>
                    ))}
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
                  disabled={selectedIds.length < 2 || isBusy || isUploading || !hasEnoughCredits}
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

        <div className="relative flex flex-col items-center justify-start gap-6 overflow-y-auto bg-black/20 p-6">
          {resultUrl ? (
            <div className="flex w-full max-w-4xl flex-col gap-3">
              <span className="text-sm font-medium">Result</span>
              <video src={resultUrl} controls className="w-full rounded-xl bg-black" />
            </div>
          ) : (
            <div className="flex w-full max-w-4xl flex-col items-center gap-4 rounded-xl border bg-background/70 p-8 text-center">
              <MonitorPlay className="h-8 w-8 text-emerald-400" />
              <div>
                <p className="text-lg font-semibold">Build a project</p>
                <p className="text-sm text-muted-foreground">Select previous videos below or upload new clips, then arrange their order.</p>
              </div>
            </div>
          )}
          <Card className="w-full max-w-4xl text-left">
            <CardContent className="flex flex-col gap-3 p-4">
              <div>
                <h2 className="text-sm font-medium">Previous video projects</h2>
                <p className="text-xs text-muted-foreground">Filter by the service that created the clips, then add them to this project.</p>
              </div>
              <select
                value={sourceService}
                onChange={(event) => {
                  setSourceService(event.target.value);
                  setSelectedIds([]);
                }}
                disabled={isBusy || isUploading}
                className="h-9 rounded-md border bg-background px-2 text-sm"
              >
                <option value="all">All video projects</option>
                <option value="text_to_video">Text to Video</option>
                <option value="image_to_video">Image to Video</option>
                <option value="start_end_frame">Start + End Frame</option>
                <option value="multi_reference">Multi-Reference</option>
                <option value="multi_shot">Multi-Shot</option>
                <option value="video_to_video">Modify Video</option>
                <option value="relight">Video Relight</option>
                <option value="video_upscale">Video Speed</option>
                <option value="video_edit_trim">Clip Editor: Trim</option>
                <option value="video_edit_speed">Clip Editor: Speed</option>
                <option value="video_edit_overlay">Clip Editor: Caption</option>
                <option value="video_edit_export">Clip Editor: Export</option>
                <option value="video_edit_concat">Project Editor</option>
              </select>
              {assets.length === 0 ? (
                <p className="text-sm text-muted-foreground">No previous videos for this service yet.</p>
              ) : (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {assets.map((asset) => (
                    <div key={asset.id} className={cn("rounded-md border p-1.5", selectedIds.includes(asset.id) && "border-primary")}>
                      <video src={asset.url} muted className="aspect-video w-full rounded object-cover" />
                      <Button type="button" size="sm" variant={selectedIds.includes(asset.id) ? "default" : "outline"} className="mt-2 w-full" disabled={isBusy || isUploading} onClick={() => toggleAsset(asset.id)}>
                        {selectedIds.includes(asset.id) ? "Added to project" : "Add to project"}
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
