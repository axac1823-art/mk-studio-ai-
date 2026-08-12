"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Mic, Volume2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { fetchCostsConfig, computeDisplayCost, type CostsConfig } from "@/lib/config/action-costs";

const POLL_INTERVAL_MS = 2500;
const MAX_TEXT_LENGTH = 5000;

interface VoiceOption {
  key: string;
  name: string;
  description: string;
}

export default function VoiceGeneratorPage() {
  const [text, setText] = useState("");
  const [voiceId, setVoiceId] = useState("");
  const [voices, setVoices] = useState<VoiceOption[]>([]);
  const [costsConfig, setCostsConfig] = useState<CostsConfig | null>(null);
  const [balance, setBalance] = useState<number | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
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
      .then((res) => (res.ok ? res.json() : { audio: [] }))
      .then((data: { audio?: VoiceOption[] }) => {
        const list = Array.isArray(data.audio) ? data.audio : [];
        setVoices(list);
        if (list.length > 0) {
          setVoiceId((current) => current || list[0].key);
        }
      })
      .catch(() => setVoices([]));
    fetch("/api/credits/balance")
      .then((res) => res.json())
      .then((data) => setBalance(typeof data.balance === "number" ? data.balance : null))
      .catch(() => setBalance(null));
  }, []);

  const cost = costsConfig ? computeDisplayCost(costsConfig, { feature: "voice_generator", quality: "standard", resolution: "1K", quantity: 1 }) : 0;
  const hasEnoughCredits = balance === null || balance >= cost;

  const pollJob = useCallback(
    (jobId: string) => {
      stopPolling();
      setIsBusy(true);
      setAudioUrl(null);
      setError(null);
      pollRef.current = setInterval(async () => {
        try {
          const res = await fetch(`/api/audio/${jobId}`);
          if (!res.ok) throw new Error("polling failed");
          const data = await res.json();
          if (data.status === "complete") {
            stopPolling();
            setIsBusy(false);
            setAudioUrl(data.resultUrl ?? null);
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
    if (!text.trim() || isBusy || !hasEnoughCredits) return;
    setError(null);
    setAudioUrl(null);

    const form = new FormData();
    form.append("text", text.trim());
    if (voiceId) form.append("voiceId", voiceId);

    try {
      const res = await fetch("/api/audio/generate", { method: "POST", body: form });
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
          <h1 className="text-xl font-semibold tracking-tight">Voice Generator</h1>
          <p className="text-sm text-muted-foreground">Generate realistic voiceovers from text.</p>
        </div>
        <div className="text-sm text-muted-foreground">{balance === null ? "…" : `${balance} credits`}</div>
      </header>

      <div className="grid flex-1 lg:grid-cols-[360px_1fr]">
        <div className="flex flex-col gap-4 border-r p-4 sm:p-5">
          <Card>
            <CardContent className="flex flex-col gap-4 p-4">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="voice-id" className="text-sm font-medium">
                  Voice
                </label>
                <select
                  id="voice-id"
                  value={voiceId}
                  onChange={(e) => setVoiceId(e.target.value)}
                  disabled={isBusy || voices.length === 0}
                  className="h-10 rounded-md border bg-background px-3 text-sm outline-none focus:border-primary"
                >
                  {voices.length === 0 && <option value="">Default</option>}
                  {voices.map((voice) => (
                    <option key={voice.key} value={voice.key}>
                      {voice.name}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-muted-foreground">
                  {voices.find((v) => v.key === voiceId)?.description ?? "Choose a voice for the narration."}
                </p>
              </div>

              <div className="flex flex-col gap-1.5">
                <label htmlFor="voice-text" className="text-sm font-medium">
                  Text
                </label>
                <textarea
                  id="voice-text"
                  value={text}
                  onChange={(e) => setText(e.target.value.slice(0, MAX_TEXT_LENGTH))}
                  placeholder="Type the script you want to narrate..."
                  rows={8}
                  disabled={isBusy}
                  className="rounded-md border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
                />
                <p className="text-xs text-muted-foreground">{text.length}/{MAX_TEXT_LENGTH}</p>
              </div>

              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Cost</span>
                  <span className="font-medium">{cost} credits</span>
                </div>
                <Button
                  type="button"
                  onClick={handleGenerate}
                  disabled={!text.trim() || isBusy || !hasEnoughCredits}
                  className="w-full gap-2"
                >
                  {isBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mic className="h-4 w-4" />}
                  Generate voice
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
          {audioUrl ? (
            <div className="flex w-full max-w-xl flex-col gap-3">
              <span className="text-sm font-medium">Result</span>
              <audio src={audioUrl} controls className="w-full" />
            </div>
          ) : (
            <div className="flex flex-col items-center gap-4 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-violet-500/15 text-violet-400">
                <Volume2 className="h-8 w-8" />
              </div>
              <div>
                <p className="text-lg font-semibold">Generate a voiceover</p>
                <p className="text-sm text-muted-foreground">Type a script and click Generate.</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
