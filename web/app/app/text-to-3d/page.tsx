"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Box, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ModelPicker } from "@/components/studio/model-picker";
import { StudioShell } from "@/components/studio/studio-shell";
import { Card, CardContent } from "@/components/ui/card";
import { fetchCostsConfig, computeDisplayCost, type CostsConfig } from "@/lib/config/action-costs";

const POLL_INTERVAL_MS = 2500;
const MAX_PROMPT_LENGTH = 1024;

interface ThreeDModelOption {
  key: string;
  name: string;
  description: string;
  configured: boolean;
  supportsTextTo3d?: boolean;
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

export default function TextTo3DPage() {
  const [prompt, setPrompt] = useState("");
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
        const textModels = list.filter((m) => m.supportsTextTo3d);
        setModels(textModels);
      })
      .catch(() => setModels([]));
    fetch("/api/credits/balance")
      .then((res) => res.json())
      .then((data) => setBalance(typeof data.balance === "number" ? data.balance : null))
      .catch(() => setBalance(null));
  }, []);

  useEffect(() => {
    if (selectedModel && !models.some((model) => model.key === selectedModel)) {
      setSelectedModel("");
    }
  }, [models, selectedModel]);

  const cost = costsConfig
    ? computeDisplayCost(costsConfig, { feature: "3d_generator", quality: "standard", resolution: "1K", quantity: 1 })
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
    if (isBusy || !hasEnoughCredits || !prompt.trim() || prompt.trim().length > MAX_PROMPT_LENGTH) return;
    setError(null);
    setResultUrl(null);

    const form = new FormData();
    form.append("prompt", prompt.trim());
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
    <StudioShell
      header={
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Text-to-3D</h1>
        <div className="flex items-center gap-3">
          <nav className="flex rounded-md border p-1" aria-label="3D generation mode">
            <Link href="/app/3d-generator" className="rounded px-3 py-1.5 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-foreground">Image-to-3D</Link>
            <Link href="/app/text-to-3d" aria-current="page" className="rounded bg-accent px-3 py-1.5 text-sm font-medium text-foreground">Text-to-3D</Link>
          </nav>
        </div>
      </div>
      }
      panel={
        <section aria-label="3D description" className="min-w-0">
          <Card>
            <CardContent className="flex flex-col gap-5 p-4 sm:p-5">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="3d-prompt" className="text-sm font-medium">
                  Prompt
                </label>
                <textarea
                  id="3d-prompt"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="e.g. a modern concrete villa with large windows"
                  rows={6}
                  disabled={isBusy}
                  className="rounded-md border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
                />
                <p className="text-xs text-muted-foreground">{prompt.length}/{MAX_PROMPT_LENGTH}</p>
                {prompt.trim().length > MAX_PROMPT_LENGTH && (
                  <p role="alert" className="text-xs text-destructive">
                    Tripo supports prompts up to {MAX_PROMPT_LENGTH} characters. Please shorten this prompt.
                  </p>
                )}
              </div>

              <ModelPicker
                models={models.map((model) => ({ ...model, capabilities: ["Text to 3D"] }))}
                selectedModel={selectedModel}
                onModelChange={setSelectedModel}
                showDescription
                disabled={isBusy}
              />



              {error && (
                <p role="alert" className="text-sm text-destructive">
                  {error}
                </p>
              )}
            </CardContent>
          </Card>
        </section>
      }
      stage={
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
      }
      bar={
              <div className="flex w-full flex-col gap-2">
                <Button
                  type="button"
                  onClick={handleGenerate}
                  disabled={isBusy || !hasEnoughCredits || !prompt.trim() || prompt.trim().length > MAX_PROMPT_LENGTH}
                  className="w-full gap-2"
                >
                  {isBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Box className="h-4 w-4" />}
                  Generate &middot; {cost} credits
                </Button>
              </div>
      }
    />
  );
}
