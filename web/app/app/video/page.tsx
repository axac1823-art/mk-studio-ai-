"use client";

// Video Generator — page unifiée : pas d'onglets de mode, le backend détecte
// le mode (text_to_video, image_to_video, start_end_frame, multi_reference,
// multi_shot) à partir des inputs.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { FrameDropzone } from "@/components/video-generator/frame-dropzone";
import { GenerateBar } from "@/components/video-generator/generate-bar";
import { MediaAttachments, type AttachedMediaItem } from "@/components/video-generator/media-attachments";
import { ModelSelect, type VideoModelOption } from "@/components/video-generator/model-select";
import { ShotEditor } from "@/components/video-generator/shot-editor";
import { BottomToolbar } from "@/components/video-generator/bottom-toolbar";
import {
  fetchCostsConfig,
  computeVideoDisplayCost,
  type CostsConfig,
} from "@/lib/config/action-costs";
import { findMediaTags, type VideoMode } from "@/lib/video-utils";

const POLL_INTERVAL_MS = 2500;
const MAX_ATTACHED_MEDIA = 9;

type VideoDuration = 4 | 5 | 6 | 8 | 10;
type VideoAspectRatio = "16:9" | "9:16" | "1:1";

interface VideoShot {
  id: string;
  prompt: string;
  taggedMediaIds: string[];
}

interface VideoGeneratorState {
  startImage: File | null;
  startImagePreview: string | null;
  endImage: File | null;
  endImagePreview: string | null;
  attachedMedia: AttachedMediaItem[];
  shots: VideoShot[];
  duration: VideoDuration;
  aspectRatio: VideoAspectRatio;
  audioEnabled: boolean;
  selectedModel: string;
}

function resolvePreviewMode(state: VideoGeneratorState): VideoMode {
  if (state.shots.length > 1) return "multi_shot";
  if (state.startImage && state.endImage) return "start_end_frame";
  const firstPrompt = state.shots[0]?.prompt ?? "";
  const taggedCount = findMediaTags(firstPrompt).length;
  if (taggedCount >= 2) return "multi_reference";
  if (state.startImage || taggedCount === 1) return "image_to_video";
  return "text_to_video";
}

function nextTag(media: AttachedMediaItem[], type: "image" | "video") {
  const prefix = type === "image" ? "img" : "vid";
  const existing = media
    .filter((m) => m.type === type)
    .map((m) => Number.parseInt(m.tag.replace(`@${prefix}`, ""), 10) || 0);
  const next = (Math.max(0, ...existing) + 1);
  return `@${prefix}${next}`;
}

export default function VideoGeneratorPage() {
  const [state, setState] = useState<VideoGeneratorState>({
    startImage: null,
    startImagePreview: null,
    endImage: null,
    endImagePreview: null,
    attachedMedia: [],
    shots: [{ id: crypto.randomUUID(), prompt: "", taggedMediaIds: [] }],
    duration: 4,
    aspectRatio: "16:9",
    audioEnabled: false,
    selectedModel: "",
  });

  const [models, setModels] = useState<VideoModelOption[]>([]);
  const [costsConfig, setCostsConfig] = useState<CostsConfig | null>(null);
  const [balance, setBalance] = useState<number | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);
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
      .then((res) => (res.ok ? res.json() : { video: [] }))
      .then((data: { video?: VideoModelOption[] }) => setModels(Array.isArray(data.video) ? data.video : []))
      .catch(() => setModels([]));
    fetch("/api/credits/balance")
      .then((res) => res.json())
      .then((data) => setBalance(typeof data.balance === "number" ? data.balance : null))
      .catch(() => setBalance(null));
  }, []);

  const updateState = useCallback((patch: Partial<VideoGeneratorState>) => {
    setState((current) => ({ ...current, ...patch }));
  }, []);

  const previewMode = useMemo(() => resolvePreviewMode(state), [state]);

  // Si le modèle choisi n'est plus compatible avec le mode détecté, on retourne en Auto.
  useEffect(() => {
    if (!state.selectedModel) return;
    const flagMap: Record<VideoMode, keyof VideoModelOption> = {
      text_to_video: "supportsTextToVideo",
      image_to_video: "supportsImageToVideo",
      start_end_frame: "supportsStartEndFrame",
      multi_reference: "supportsMultiReference",
      multi_shot: "supportsImageToVideo",
    };
    const flag = flagMap[previewMode];
    const compatible = models.some((m) => m.key === state.selectedModel && Boolean(m[flag]));
    if (!compatible) updateState({ selectedModel: "" });
  }, [previewMode, models, state.selectedModel, updateState]);

  const tags = useMemo(() => state.attachedMedia.map((m) => m.tag), [state.attachedMedia]);
  const cost = useMemo(() => {
    if (!costsConfig) return 0;
    return computeVideoDisplayCost(costsConfig, previewMode, state.shots.length);
  }, [costsConfig, previewMode, state.shots.length]);
  const hasEnoughCredits = balance === null || balance >= cost;
  const canGenerate = !isBusy;

  const updateShot = useCallback((id: string, patch: Partial<VideoShot>) => {
    setState((current) => ({
      ...current,
      shots: current.shots.map((shot) => (shot.id === id ? { ...shot, ...patch } : shot)),
    }));
  }, []);

  const addShot = useCallback(() => {
    setState((current) => ({
      ...current,
      shots: [...current.shots, { id: crypto.randomUUID(), prompt: "", taggedMediaIds: [] }],
    }));
  }, []);

  const removeShot = useCallback((id: string) => {
    setState((current) => ({
      ...current,
      shots: current.shots.filter((shot) => shot.id !== id),
    }));
  }, []);

  const addMedia = useCallback((file: File, type: "image" | "video") => {
    setState((current) => {
      if (current.attachedMedia.length >= MAX_ATTACHED_MEDIA) return current;
      const tag = nextTag(current.attachedMedia, type);
      return {
        ...current,
        attachedMedia: [
          ...current.attachedMedia,
          { tag, url: URL.createObjectURL(file), file, type },
        ],
      };
    });
  }, []);

  const removeMedia = useCallback((tag: string) => {
    setState((current) => ({
      ...current,
      attachedMedia: current.attachedMedia.filter((m) => m.tag !== tag),
      // Nettoyer les tags dans les prompts pour éviter les références mortes.
      shots: current.shots.map((shot) => ({
        ...shot,
        prompt: shot.prompt
          .replace(new RegExp(tag.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g"), "")
          .replace(/\s+/g, " ")
          .trim(),
      })),
    }));
  }, []);

  const pollJob = useCallback(
    (jobId: string) => {
      stopPolling();
      setIsBusy(true);
      setResultUrl(null);
      setError(null);
      pollRef.current = setInterval(async () => {
        try {
          const res = await fetch(`/api/video/${jobId}`);
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
          } else if (data.status === "processing") {
            setProgress(data.progress ?? null);
          }
        } catch {
          // retry on next tick
        }
      }, POLL_INTERVAL_MS);
    },
    [stopPolling, cost]
  );

  const handleGenerate = async () => {
    if (!hasEnoughCredits || isBusy) return;
    setError(null);
    setResultUrl(null);
    setProgress(null);

    const form = new FormData();
    if (state.startImage) form.append("startImage", state.startImage);
    if (state.endImage) form.append("endImage", state.endImage);

    const mediaMeta = state.attachedMedia.map((m) => ({ tag: m.tag, type: m.type }));
    for (const media of state.attachedMedia) {
      form.append(media.tag, media.file);
    }

    const shotsPayload = state.shots.map((shot) => ({
      id: shot.id,
      prompt: shot.prompt,
      taggedMediaIds: findMediaTags(shot.prompt).map((tag) => tag.replace("@", "")),
    }));

    form.append(
      "payload",
      JSON.stringify({
        duration: state.duration,
        aspectRatio: state.aspectRatio,
        audioEnabled: state.audioEnabled,
        selectedModel: state.selectedModel || undefined,
        shots: shotsPayload,
        mediaMeta,
      })
    );

    try {
      const res = await fetch("/api/video/generate", { method: "POST", body: form });
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
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-6 p-4 pb-10 sm:p-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Video Generator</h1>
          <p className="text-sm text-muted-foreground">Describe camera motion and choose references — the AI mode is detected automatically.</p>
        </div>
        <Badge variant="secondary" className="gap-1">
          {balance === null ? "…" : balance} credits
        </Badge>
      </header>

      <Card>
        <CardContent className="flex flex-col gap-6 p-4 sm:p-6">
          <ModelSelect
            models={models}
            selectedModel={state.selectedModel}
            mode={previewMode}
            onChange={(value) => updateState({ selectedModel: value })}
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <FrameDropzone
              label="Start image"
              previewUrl={state.startImagePreview}
              onFileSelected={(file) =>
                updateState({ startImage: file, startImagePreview: URL.createObjectURL(file) })
              }
            />
            <FrameDropzone
              label="End image (optional)"
              previewUrl={state.endImagePreview}
              onFileSelected={(file) =>
                updateState({ endImage: file, endImagePreview: URL.createObjectURL(file) })
              }
            />
          </div>

          <MediaAttachments
            media={state.attachedMedia}
            onAdd={addMedia}
            onRemove={removeMedia}
            disabled={isBusy}
            max={MAX_ATTACHED_MEDIA}
          />

          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Shots</span>
              <Button type="button" variant="outline" size="sm" onClick={addShot} disabled={isBusy}>
                <Plus className="mr-1 h-4 w-4" />
                Add shot
              </Button>
            </div>
            {state.shots.map((shot, index) => (
              <div key={shot.id} className="relative rounded-lg border p-4">
                {state.shots.length > 1 && (
                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={() => removeShot(shot.id)}
                    className="absolute right-2 top-2 rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-destructive"
                    aria-label="Remove shot"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
                <ShotEditor
                  index={index}
                  prompt={shot.prompt}
                  tags={tags}
                  onPromptChange={(value) => updateShot(shot.id, { prompt: value })}
                  disabled={isBusy}
                />
              </div>
            ))}
          </div>

          <BottomToolbar
            duration={state.duration}
            onDurationChange={(d) => updateState({ duration: d as VideoDuration })}
            aspectRatio={state.aspectRatio}
            onAspectRatioChange={(r) => updateState({ aspectRatio: r as VideoAspectRatio })}
            audioEnabled={state.audioEnabled}
            onAudioEnabledChange={(a) => updateState({ audioEnabled: a })}
            disabled={isBusy}
          />

          <GenerateBar
            cost={cost}
            hasEnoughCredits={hasEnoughCredits}
            balance={balance}
            isBusy={isBusy}
            canGenerate={canGenerate}
            onGenerate={handleGenerate}
          />

          {isBusy && progress && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Generating shot {progress.current} of {progress.total}…
            </div>
          )}

          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}

          {resultUrl && (
            <div className="flex flex-col gap-2">
              <span className="text-sm font-medium">Result</span>
              <video
                src={resultUrl}
                controls
                className="aspect-video w-full rounded-lg bg-black"
              />
            </div>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
