"use client";

// Video Generator — page unifiée en layout horizontal plein écran.
// Colonne de gauche : contrôles (modèle, références, shots, durée/ratio, generate).
// Colonne de droite : aperçu/resultat large, comme dans la référence.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Plus, Video } from "lucide-react";
import { useSearchParams } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { FrameDropzone } from "@/components/video-generator/frame-dropzone";
import { GenerateBar } from "@/components/video-generator/generate-bar";
import { MediaAttachments, type AttachedMediaItem } from "@/components/video-generator/media-attachments";
import { ModelSelect, type VideoModelOption } from "@/components/video-generator/model-select";
import { ShotEditor } from "@/components/video-generator/shot-editor";
import { BottomToolbar } from "@/components/video-generator/bottom-toolbar";
import { VideoDropzone } from "@/components/video-generator/video-dropzone";
import {
  fetchCostsConfig,
  computeVideoDisplayCost,
  type CostsConfig,
} from "@/lib/config/action-costs";
import { findMediaTags, type VideoMode } from "@/lib/video-utils";
import { generateUuid } from "@/lib/generate-uuid";
import { cn } from "@/lib/utils";

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

interface VideoProjectAsset {
  id: string;
  type: "image" | "video";
  url: string;
  createdAt: string;
}

const modeLabels: Record<VideoMode, string> = {
  text_to_video: "Text to Video",
  image_to_video: "Image to Video",
  start_end_frame: "Start + End Frame",
  multi_reference: "Multi-Reference",
  multi_shot: "Multi-Shot",
  video_to_video: "Modify Video",
  relight: "Video Relight",
};

function hasVideoTag(state: VideoGeneratorState): boolean {
  const firstPrompt = state.shots[0]?.prompt ?? "";
  return findMediaTags(firstPrompt).some((tag) =>
    state.attachedMedia.some((m) => m.tag === tag && m.type === "video")
  );
}

function resolvePreviewMode(state: VideoGeneratorState, modeHint: VideoMode | null): VideoMode {
  if (state.shots.length > 1) return "multi_shot";
  if (state.startImage && state.endImage) return "start_end_frame";
  const firstPrompt = state.shots[0]?.prompt ?? "";
  const taggedCount = findMediaTags(firstPrompt).length;
  if (taggedCount >= 2) return "multi_reference";

  const videoTag = hasVideoTag(state);
  if (!state.startImage && videoTag) {
    if (modeHint === "relight") return "relight";
    return "video_to_video";
  }

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

function aspectRatioClass(ratio: VideoAspectRatio): string {
  switch (ratio) {
    case "9:16":
      return "aspect-[9/16]";
    case "1:1":
      return "aspect-square";
    case "16:9":
    default:
      return "aspect-video";
  }
}

export default function VideoGeneratorPage() {
  const searchParams = useSearchParams();
  const modeHint = (searchParams.get("mode") as VideoMode | null) || null;
  const preselectedAssetId = searchParams.get("assetId");

  const [state, setState] = useState<VideoGeneratorState>({
    startImage: null,
    startImagePreview: null,
    endImage: null,
    endImagePreview: null,
    attachedMedia: [],
    // Keep server rendering and hydration deterministic; the client effect
    // assigns a UUID after mount.
    shots: [{ id: "", prompt: "", taggedMediaIds: [] }],
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
  const [projectAssets, setProjectAssets] = useState<VideoProjectAsset[]>([]);
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
    const initialShotId = generateUuid();
    setState((current) => {
      if (!current.shots[0] || current.shots[0].id) return current;
      return {
        ...current,
        shots: current.shots.map((shot, index) =>
          index === 0 ? { ...shot, id: initialShotId } : shot,
        ),
      };
    });
  }, []);

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

  const previewMode = useMemo(() => resolvePreviewMode(state, modeHint), [state, modeHint]);
  const activeFeature = modeHint || previewMode;

  useEffect(() => {
    fetch(`/api/assets?type=video&feature=${encodeURIComponent(activeFeature)}`)
      .then((res) => (res.ok ? res.json() : { assets: [] }))
      .then((data: { assets: VideoProjectAsset[] }) => setProjectAssets(Array.isArray(data.assets) ? data.assets : []))
      .catch(() => setProjectAssets([]));
  }, [activeFeature, resultUrl]);

  // Si le modèle choisi n'est plus compatible avec le mode détecté, on bascule
  // sur le premier modèle compatible disponible (ou on garde Auto si aucun).
  useEffect(() => {
    const flagMap: Record<VideoMode, keyof VideoModelOption> = {
      text_to_video: "supportsTextToVideo",
      image_to_video: "supportsImageToVideo",
      start_end_frame: "supportsStartEndFrame",
      multi_reference: "supportsMultiReference",
      multi_shot: "supportsImageToVideo",
      video_to_video: "supportsVideoToVideo",
      relight: "supportsRelight",
    };
    const flag = flagMap[previewMode];
    const compatible = models.filter((m) => Boolean(m[flag]));
    const current = models.find((m) => m.key === state.selectedModel);
    const currentCompatible = current && Boolean(current[flag]);
    // An empty selection means Auto (recommended). Only replace a model
    // when the user-selected model becomes incompatible with the current mode.
    if (state.selectedModel && !currentCompatible) {
      updateState({ selectedModel: compatible[0]?.key ?? "" });
    }
  }, [previewMode, models, state.selectedModel, updateState]);

  const tags = useMemo(() => state.attachedMedia.map((m) => m.tag), [state.attachedMedia]);
  const cost = useMemo(() => {
    if (!costsConfig) return 0;
    return computeVideoDisplayCost(costsConfig, previewMode, state.shots.length, state.selectedModel || undefined);
  }, [costsConfig, previewMode, state.shots.length, state.selectedModel]);
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
      shots: [...current.shots, { id: generateUuid(), prompt: "", taggedMediaIds: [] }],
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

  const isVideoMode = modeHint === "video_to_video" || modeHint === "relight";

  const setSourceVideo = useCallback((file: File) => {
    setState((current) => {
      // Remplace une éventuelle vidéo source précédente pour ces modes.
      const existingVideoTag = current.attachedMedia.find((m) => m.type === "video")?.tag;
      const cleanedMedia = existingVideoTag
        ? current.attachedMedia.filter((m) => m.tag !== existingVideoTag)
        : current.attachedMedia;
      const cleanedPrompts = existingVideoTag
        ? current.shots.map((shot) => ({
            ...shot,
            prompt: shot.prompt
              .replace(new RegExp(existingVideoTag.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g"), "")
              .replace(/\s+/g, " ")
              .trim(),
          }))
        : current.shots;

      const tag = nextTag(cleanedMedia, "video");
      return {
        ...current,
        attachedMedia: [
          ...cleanedMedia,
          { tag, url: URL.createObjectURL(file), file, type: "video" },
        ],
        shots: cleanedPrompts.map((shot, index) =>
          index === 0 ? { ...shot, prompt: `${tag} ${shot.prompt}`.trim() } : shot
        ),
      };
    });
  }, []);

  const addExistingVideo = useCallback((asset: VideoProjectAsset) => {
    setState((current) => {
      if (current.attachedMedia.length >= MAX_ATTACHED_MEDIA) return current;
      if (current.attachedMedia.some((item) => item.assetId === asset.id)) return current;
      const tag = nextTag(current.attachedMedia, "video");
      return {
        ...current,
        attachedMedia: [...current.attachedMedia, { tag, url: asset.url, assetId: asset.id, type: "video" }],
        shots: current.shots.map((shot, index) => index === 0 ? { ...shot, prompt: `${tag} ${shot.prompt}`.trim() } : shot),
      };
    });
    setResultUrl(null);
  }, []);

  useEffect(() => {
    if (!preselectedAssetId) return;
    fetch(`/api/assets/${encodeURIComponent(preselectedAssetId)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { asset?: VideoProjectAsset } | null) => {
        if (data?.asset?.type === "video") addExistingVideo(data.asset);
      })
      .catch(() => undefined);
  }, [addExistingVideo, preselectedAssetId]);

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

    const mediaMeta = state.attachedMedia.map((m) => ({ tag: m.tag, type: m.type, assetId: m.assetId }));
    for (const media of state.attachedMedia) {
      if (media.file) form.append(media.tag, media.file);
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
        mode: modeHint || previewMode,
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
    <main className="mx-auto flex min-h-[calc(100vh-3.5rem)] w-full max-w-[1600px] flex-col px-4 py-5 sm:px-6 lg:px-8">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b pb-4">
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Video Generator</h1>
          <Badge variant="outline">{modeLabels[previewMode]}</Badge>
        </div>
      </header>

      <div className="grid flex-1 items-start gap-5 py-5 lg:grid-cols-[minmax(360px,440px)_minmax(0,1fr)] xl:gap-6">
        <section aria-label="Video sources and controls" className="min-w-0">
          <Card>
            <CardContent className="flex flex-col gap-5 p-4 sm:p-5">
              <div className="flex flex-col gap-3">
                <h2 className="text-base font-semibold">Sources</h2>
                {isVideoMode ? (
                  <VideoDropzone
                    previewUrl={state.attachedMedia.find((m) => m.type === "video")?.url ?? null}
                    onFileSelected={setSourceVideo}
                    label={modeHint === "relight" ? "Video to relight" : "Video to modify"}
                  />
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    <FrameDropzone
                      label="Start image"
                      previewUrl={state.startImagePreview}
                      onFileSelected={(file) =>
                        updateState({ startImage: file, startImagePreview: URL.createObjectURL(file) })
                      }
                      placeholderTitle="Start image"
                      placeholderDescription="Drop or click"
                    />
                    <FrameDropzone
                      label="End image"
                      previewUrl={state.endImagePreview}
                      onFileSelected={(file) =>
                        updateState({ endImage: file, endImagePreview: URL.createObjectURL(file) })
                      }
                      placeholderTitle="End image"
                      placeholderDescription="Optional"
                    />
                  </div>
                )}
                <MediaAttachments
                  media={state.attachedMedia}
                  onAdd={addMedia}
                  onRemove={removeMedia}
                  disabled={isBusy}
                  max={MAX_ATTACHED_MEDIA}
                />
              </div>

              <div className="flex flex-col gap-3 border-t pt-4">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-base font-semibold">Shots</h2>
                  <Button type="button" variant="outline" size="sm" onClick={addShot} disabled={isBusy}>
                    <Plus className="mr-1 h-4 w-4" />
                    Add shot
                  </Button>
                </div>
                {state.shots.map((shot, index) => (
                  <div key={shot.id} className="rounded-lg border bg-card p-3">
                    <ShotEditor
                      index={index}
                      prompt={shot.prompt}
                      tags={tags}
                      onPromptChange={(value) => updateShot(shot.id, { prompt: value })}
                      disabled={isBusy}
                      onDelete={state.shots.length > 1 ? () => removeShot(shot.id) : undefined}
                    />
                  </div>
                ))}
              </div>

              <div className="border-t pt-4">
                <h2 className="mb-3 text-base font-semibold">Output</h2>
                <BottomToolbar
                  duration={state.duration}
                  onDurationChange={(d) => updateState({ duration: d as VideoDuration })}
                  aspectRatio={state.aspectRatio}
                  onAspectRatioChange={(r) => updateState({ aspectRatio: r as VideoAspectRatio })}
                  audioEnabled={state.audioEnabled}
                  onAudioEnabledChange={(a) => updateState({ audioEnabled: a })}
                  disabled={isBusy}
                />
              </div>

              <div className="border-t pt-4">
                <ModelSelect
                  models={models}
                  selectedModel={state.selectedModel}
                  mode={previewMode}
                  onChange={(value) => updateState({ selectedModel: value })}
                />
              </div>
            </CardContent>
          </Card>
        </section>

        <section aria-label="Video preview and history" className="flex min-w-0 flex-col gap-5">
          <Card>
            <CardContent className="flex flex-col gap-4 p-4 sm:p-5">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold">Video Preview</h2>
                {isBusy && <Badge variant="secondary">Generating</Badge>}
              </div>
              {resultUrl ? (
                <video
                  src={resultUrl}
                  controls
                  aria-label="Video Preview"
                  className={cn("w-full rounded-lg bg-black", aspectRatioClass(state.aspectRatio))}
                />
              ) : isBusy ? (
                <div className={cn("flex w-full flex-col items-center justify-center gap-3 rounded-lg border bg-muted/30 p-6 text-center", aspectRatioClass(state.aspectRatio))}>
                  <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
                  <p className="text-sm font-medium">Generating video</p>
                  {progress && <p className="text-sm text-muted-foreground">Generating shot {progress.current} of {progress.total}</p>}
                </div>
              ) : (
                <div className={cn("flex w-full flex-col items-center justify-center gap-3 rounded-lg border border-dashed bg-muted/30 p-6 text-center", aspectRatioClass(state.aspectRatio))}>
                  <Video className="h-7 w-7 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">Your video will appear here.</p>
                </div>
              )}
              {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="flex flex-col gap-3 p-4 sm:p-5">
              <div>
                <h2 className="text-base font-semibold">History</h2>
                <p className="mt-1 text-sm text-muted-foreground">Add a previous video as a tagged reference.</p>
              </div>
              {projectAssets.length === 0 ? (
                <p className="py-2 text-sm text-muted-foreground">No previous videos for this service yet.</p>
              ) : (
                <div className="flex gap-3 overflow-x-auto pb-2">
                  {projectAssets.map((asset) => (
                    <div key={asset.id} className="w-36 shrink-0 rounded-md border p-1.5">
                      <video src={asset.url} muted aria-label="Previous video" className="aspect-video w-full rounded bg-black object-cover" />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="mt-2 h-9 w-full px-2 text-xs"
                        disabled={isBusy || state.attachedMedia.some((item) => item.assetId === asset.id)}
                        onClick={() => addExistingVideo(asset)}
                      >
                        {state.attachedMedia.some((item) => item.assetId === asset.id) ? "Added as reference" : "Add as reference"}
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </section>
      </div>

      <GenerateBar
        cost={cost}
        hasEnoughCredits={hasEnoughCredits}
        balance={balance}
        isBusy={isBusy}
        canGenerate={canGenerate}
        onGenerate={handleGenerate}
      />
    </main>
  );
}