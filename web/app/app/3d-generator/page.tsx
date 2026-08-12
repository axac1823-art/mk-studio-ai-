"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Box, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { UploadDropzone } from "@/components/upload-dropzone";
import { fetchCostsConfig, computeDisplayCost, type CostsConfig } from "@/lib/config/action-costs";

const POLL_INTERVAL_MS = 2500;

const VIEWS = ["front", "back", "left", "right", "top", "bottom"] as const;
type ViewName = (typeof VIEWS)[number];

interface ThreeDModelOption {
  key: string;
  name: string;
  description: string;
  configured: boolean;
  supportsImageTo3d?: boolean;
}

function modelViewerIframe(url: string | null): string | null {
  if (!url) return null;
  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <script type="module" src="https://unpkg.com/@google/model-viewer@3.5.0/dist/model-viewer.min.js"></script>
    <style>body{margin:0;background:#0a0a0a;display:flex;align-items:center;justify-content:center;height:100vh}model-viewer{width:100%;height:100%}</style>
  </head>
  <body>
    <model-viewer src="${url}" camera-controls auto-rotate shadow-intensity="1" exposure="1" environment-image="neutral" alt="3D model"></model-viewer>
  </body>
</html>`;
}

export default function ImageTo3DPage() {
  const [views, setViews] = useState<Record<ViewName, File | null>>({
    front: null,
    back: null,
    left: null,
    right: null,
    top: null,
    bottom: null,
  });
  const [previews, setPreviews] = useState<Record<ViewName, string | null>>({
    front: null,
    back: null,
    left: null,
    right: null,
    top: null,
    bottom: null,
  });
  const [models, setModels] = useState<ThreeDModelOption[]>([]);
  const [selectedModel, setSelectedModel] = useState("");
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
    fetch("/api/models")
      .then((res) => (res.ok ? res.json() : { threed: [] }))
      .then((data: { threed?: ThreeDModelOption[] }) => {
        const list = Array.isArray(data.threed) ? data.threed : [];
        setModels(list.filter((m) => m.supportsImageTo3d));
      })
      .catch(() => setModels([]));
    fetch("/api/credits/balance")
      .then((res) => res.json())
      .then((data) => setBalance(typeof data.balance === "number" ? data.balance : null))
      .catch(() => setBalance(null));
  }, []);

  useEffect(() => {
    if (models.length > 0 && !selectedModel) {
      const first = models.find((m) => m.configured) ?? models[0];
      if (first) setSelectedModel(first.key);
    }
  }, [models, selectedModel]);

  const cost = costsConfig
    ? computeDisplayCost(costsConfig, { feature: "3d_generator", quality: "standard", resolution: "1K", quantity: 1 })
    : 0;
  const hasEnoughCredits = balance === null || balance >= cost;

  const hasAnyView = VIEWS.some((v) => views[v] !== null);

  const setView = (view: ViewName, file: File | null) => {
    setViews((current) => ({ ...current, [view]: file }));
    setPreviews((current) => {
      if (current[view]) URL.revokeObjectURL(current[view]!);
      return { ...current, [view]: file ? URL.createObjectURL(file) : null };
    });
    setResultUrl(null);
    setError(null);
  };

  const pollJob = useCallback(
    (jobId: string) => {
      stopPolling();
      setIsBusy(true);
      setResultUrl(null);
      setError(null);
      pollRef.current = setInterval(async () => {
        try {
          const res = await fetch(`/api/3d-generator/${jobId}`);
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
            setError(data.error ?? "Generation failed, please try again.");
          }
        } catch {
          // retry on next tick
        }
      }, POLL_INTERVAL_MS);
    },
    [stopPolling, cost]
  );

  const handleGenerate = async () => {
    if (isBusy || !hasEnoughCredits || !hasAnyView) return;
    setError(null);
    setResultUrl(null);

    const form = new FormData();
    for (const view of VIEWS) {
      const file = views[view];
      if (file) form.append(view, file);
    }
    if (selectedModel) form.append("model", selectedModel);

    try {
      const res = await fetch("/api/3d-generator/generate", { method: "POST", body: form });
      const data = await res.json();
      if (res.status === 402) {
        setBalance(typeof data.balance === "number" ? data.balance : balance);
        setError("You don't have enough credits for this generation.");
        return;
      }
      if (!res.ok) {
        setError(data.error ?? "Generation failed, please try again.");
        return;
      }
      pollJob(data.jobId);
    } catch {
      setError("Network error — please try again.");
    }
  };

  const iframeSrcDoc = modelViewerIframe(resultUrl);

  return (
    <main className="flex min-h-screen w-full flex-col">
      <header className="flex items-center justify-between px-4 py-4 sm:px-6">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Image-to-3D</h1>
          <p className="text-sm text-muted-foreground">Generate a 3D model from up to 6 views.</p>
        </div>
        <div className="text-sm text-muted-foreground">{balance === null ? "…" : `${balance} credits`}</div>
      </header>

      <div className="grid flex-1 lg:grid-cols-[360px_1fr]">
        <div className="flex flex-col gap-4 border-r p-4 sm:p-5">
          <Card>
            <CardContent className="flex flex-col gap-4 p-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium">Views</label>
                <div className="grid grid-cols-2 gap-3">
                  {VIEWS.map((view) => (
                    <div key={view} className="flex flex-col gap-1">
                      <span className="text-xs font-medium capitalize text-muted-foreground">{view} *</span>
                      <UploadDropzone
                        previewUrl={previews[view]}
                        onFileSelected={(file) => setView(view, file)}
                        title={previews[view] ? view : `Drop ${view}`}
                        description=""
                        icon={Box}
                        accept="image/png,image/jpeg,image/webp"
                      />
                    </div>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">Upload at least one view. More views improve quality.</p>
              </div>

              <div className="flex flex-col gap-1.5">
                <label htmlFor="3d-model" className="text-sm font-medium">
                  Model
                </label>
                <select
                  id="3d-model"
                  value={selectedModel}
                  onChange={(e) => setSelectedModel(e.target.value)}
                  disabled={isBusy || models.length === 0}
                  className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:border-primary"
                >
                  {models.length === 0 && <option value="">Auto</option>}
                  {models.map((m) => (
                    <option key={m.key} value={m.key}>
                      {m.name}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-muted-foreground">
                  {models.find((m) => m.key === selectedModel)?.description ?? "Choose a 3D generation model."}
                </p>
              </div>

              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Cost</span>
                  <span className="font-medium">{cost} credits</span>
                </div>
                <Button
                  type="button"
                  onClick={handleGenerate}
                  disabled={isBusy || !hasEnoughCredits || !hasAnyView}
                  className="w-full gap-2"
                >
                  {isBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Box className="h-4 w-4" />}
                  Generate 3D model
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
          {iframeSrcDoc ? (
            <div className="flex h-full w-full max-w-4xl flex-col gap-3">
              <span className="text-sm font-medium">Result</span>
              <iframe title="3D preview" srcDoc={iframeSrcDoc} className="min-h-[480px] w-full flex-1 rounded-lg border-0" />
              <a href={resultUrl ?? undefined} download className="text-sm text-primary underline underline-offset-4">
                Download GLB
              </a>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-4 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-400">
                <Box className="h-8 w-8" />
              </div>
              <div>
                <p className="text-lg font-semibold">Generate a 3D asset</p>
                <p className="text-sm text-muted-foreground">Upload up to 6 views to build a 3D model.</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
