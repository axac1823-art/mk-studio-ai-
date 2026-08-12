"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Mic, Video } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { fetchCostsConfig, computeDisplayCost, type CostsConfig } from "@/lib/config/action-costs";

const POLL_INTERVAL_MS = 2500;

export default function LipSyncPage() {
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [videoPreview, setVideoPreview] = useState<string | null>(null);
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
  }, []);

  const cost = costsConfig ? computeDisplayCost(costsConfig, { feature: "lip_sync", quality: "standard", resolution: "1K", quantity: 1 }) : 0;
  const hasEnoughCredits = balance === null || balance >= cost;

  const handleVideoChange = (file: File | null) => {
    setVideoFile(file);
    setResultUrl(null);
    setError(null);
    if (videoPreview) {
      URL.revokeObjectURL(videoPreview);
      setVideoPreview(null);
    }
    if (file) {
      setVideoPreview(URL.createObjectURL(file));
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
          const res = await fetch(`/api/lip-sync/${jobId}`);
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
    if (!videoFile || !audioFile || isBusy || !hasEnoughCredits) return;
    setError(null);
    setResultUrl(null);

    const form = new FormData();
    form.append("video", videoFile);
    form.append("audio", audioFile);

    try {
      const res = await fetch("/api/lip-sync/generate", { method: "POST", body: form });
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

  return (
    <main className="flex min-h-screen w-full flex-col">
      <header className="flex items-center justify-between px-4 py-4 sm:px-6">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Lip Sync</h1>
          <p className="text-sm text-muted-foreground">Synchronize a person&apos;s mouth movement with an audio track.</p>
        </div>
        <div className="text-sm text-muted-foreground">{balance === null ? "…" : `${balance} credits`}</div>
      </header>

      <div className="grid flex-1 lg:grid-cols-[360px_1fr]">
        <div className="flex flex-col gap-4 border-r p-4 sm:p-5">
          <Card>
            <CardContent className="flex flex-col gap-4 p-4">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="lip-video" className="text-sm font-medium">
                  Face video
                </label>
                <input
                  id="lip-video"
                  type="file"
                  accept="video/mp4,video/webm,video/quicktime"
                  onChange={(e) => handleVideoChange(e.target.files?.[0] ?? null)}
                  disabled={isBusy}
                  className="text-sm file:mr-3 file:rounded-md file:border-0 file:bg-secondary file:px-3 file:py-1.5 file:text-sm file:font-medium"
                />
                <p className="text-xs text-muted-foreground">MP4 / WebM / MOV, 50 MB max</p>
              </div>

              <div className="flex flex-col gap-1.5">
                <label htmlFor="lip-audio" className="text-sm font-medium">
                  Audio track
                </label>
                <input
                  id="lip-audio"
                  type="file"
                  accept="audio/mpeg,audio/mp3,audio/wav,audio/x-m4a"
                  onChange={(e) => setAudioFile(e.target.files?.[0] ?? null)}
                  disabled={isBusy}
                  className="text-sm file:mr-3 file:rounded-md file:border-0 file:bg-secondary file:px-3 file:py-1.5 file:text-sm file:font-medium"
                />
                <p className="text-xs text-muted-foreground">MP3 / WAV / M4A, 20 MB max</p>
              </div>

              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Cost</span>
                  <span className="font-medium">{cost} credits</span>
                </div>
                <Button
                  type="button"
                  onClick={handleGenerate}
                  disabled={!videoFile || !audioFile || isBusy || !hasEnoughCredits}
                  className="w-full gap-2"
                >
                  {isBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mic className="h-4 w-4" />}
                  Sync lip movement
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
            <div className="flex w-full max-w-xl flex-col gap-3">
              <span className="text-sm font-medium">Result</span>
              <video src={resultUrl} controls className="w-full rounded-lg" />
            </div>
          ) : videoPreview ? (
            <div className="flex w-full max-w-xl flex-col gap-3">
              <span className="text-sm font-medium">Preview</span>
              <video src={videoPreview} controls className="w-full rounded-lg" />
            </div>
          ) : (
            <div className="flex flex-col items-center gap-4 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-pink-500/15 text-pink-400">
                <Video className="h-8 w-8" />
              </div>
              <div>
                <p className="text-lg font-semibold">Sync lips to audio</p>
                <p className="text-sm text-muted-foreground">Upload a face video and an audio track.</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
