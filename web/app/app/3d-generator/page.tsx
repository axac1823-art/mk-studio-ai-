"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
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
    <main className="mx-auto flex min-h-[calc(100vh-3.5rem)] w-full max-w-[1600px] flex-col px-4 py-5 sm:px-6 lg:px-8">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b pb-4">
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Image-to-3D</h1>
        <div className="flex items-center gap-3">
          <nav className="flex rounded-md border p-1" aria-label="3D generation mode">
            <Link href="/app/3d-generator" aria-current="page" className="rounded bg-accent px-3 py-1.5 text-sm font-medium text-foreground">Image-to-3D</Link>
            <Link href="/app/text-to-3d" className="rounded px-3 py-1.5 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-foreground">Text-to-3D</Link>
          </nav>
        </div>
      </header>

      <div className="grid flex-1 items-start gap-5 py-5 lg:grid-cols-[minmax(0,440px)_minmax(0,1fr)] xl:gap-6">
        <section aria-label="Image views" className="min-w-0">
          <Card>
            <CardContent className="flex flex-col gap-5 p-4 sm:p-5">
              <div className="flex flex-col gap-1.5">
                <h2 className="text-base font-semibold">Views</h2>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {VIEWS.map((view) => (
                    <div key={view} className="flex flex-col gap-1">
                      <span className="text-xs font-medium capitalize text-muted-foreground">{view}</span>
                      <UploadDropzone
                        previewUrl={previews[view]}
                        onFileSelected={(file) => setView(view, file)}
                        title={previews[view] ? `${view} view selected` : `Drop ${view} view`}
                        description="PNG, JPEG or WebP"
                        ariaLabel={`Upload ${view} view`}
                        icon={Box}
                        accept="image/png,image/jpeg,image/webp"
                      />
                    </div>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">Upload at least one view. More views improve quality.</p>
              </div>

              <div className="sticky bottom-0 z-10 -mx-4 mt-1 flex flex-col gap-2 border-t bg-background/95 px-4 py-3 backdrop-blur sm:-mx-5 sm:px-5">
                <Button
                  type="button"
                  onClick={handleGenerate}
                  disabled={isBusy || !hasEnoughCredits || !hasAnyView}
                  className="w-full gap-2"
                >
                  {isBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Box className="h-4 w-4" />}
                  Generate &middot; {cost} credits
                </Button>
              </div>

              {error && (
                <p role="alert" className="text-sm text-destructive">
                  {error}
                </p>
              )}
            </CardContent>
          </Card>
        </section>

        <section aria-label="3D Viewer" className="min-w-0">
          <Card>
            <CardContent className="flex flex-col gap-4 p-4 sm:p-5">
              <h2 className="text-base font-semibold">3D Viewer</h2>
              {iframeSrcDoc ? (
                <div className="flex w-full flex-col gap-3">
              <iframe title="3D Viewer" srcDoc={iframeSrcDoc} className="min-h-[480px] w-full rounded-lg border-0 sm:min-h-[min(65vh,680px)]" />
              <a href={resultUrl ?? undefined} download className="text-sm text-primary underline underline-offset-4">
                Download GLB
              </a>
                </div>
              ) : isBusy ? (
                <div className="flex min-h-[480px] flex-col items-center justify-center gap-3 rounded-lg border bg-muted/30 text-center sm:min-h-[min(65vh,680px)]">
                  <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
                  <p className="text-sm font-medium">Generating 3D model</p>
                </div>
              ) : (
                <div className="flex min-h-[480px] flex-col items-center justify-center gap-3 rounded-lg border border-dashed bg-muted/20 text-center sm:min-h-[min(65vh,680px)]">
                  <Box className="h-7 w-7 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">Your 3D model will appear here.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </section>
      </div>
    </main>
  );
}
