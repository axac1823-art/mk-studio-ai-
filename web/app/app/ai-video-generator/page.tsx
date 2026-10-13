"use client";

// Video Generator — page unifiée en layout horizontal plein écran.
// Colonne de gauche : contrôles (modèle, références, shots, durée/ratio, generate).
// Colonne de droite : aperçu/resultat large, comme dans la référence.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Plus, Video, Sparkles, Film, Image as ImageIcon, Layers, Camera, RefreshCw, Wand2, Download } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { FrameDropzone } from "@/components/video-generator/frame-dropzone";
import { GenerateBar } from "@/components/video-generator/generate-bar";
import { MediaAttachments, type AttachedMediaItem } from "@/components/video-generator/media-attachments";
import type { VideoModelOption } from "@/components/video-generator/model-select";
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
import { saveResult } from "@/lib/download";

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

const VIDEO_MODES: VideoMode[] = [
  "text_to_video",
  "image_to_video",
  "start_end_frame",
  "multi_reference",
  "multi_shot",
  "video_to_video",
  "relight",
];

type WorkflowSelection = "auto" | VideoMode;

const modeLabels: Record<VideoMode, string> = {
  text_to_video: "Text to Video",
  image_to_video: "Image to Video",
  start_end_frame: "Start + End Frame",
  multi_reference: "Multi-Reference",
  multi_shot: "Multi-Shot",
  video_to_video: "Modify Video",
  relight: "Video Relight",
};

const WORKFLOW_OPTIONS: Array<{
  value: WorkflowSelection;
  label: string;
  description: string;
  icon: LucideIcon;
}> = [
  { value: "auto", label: "Auto", description: "Choose the workflow from your source media.", icon: Sparkles },
  { value: "text_to_video", label: "Text to video", description: "Start with a written scene description.", icon: Wand2 },
  { value: "image_to_video", label: "Image to video", description: "Animate an existing render or image.", icon: ImageIcon },
  { value: "start_end_frame", label: "Start + end", description: "Guide the opening and closing frames.", icon: Camera },
  { value: "multi_reference", label: "References", description: "Guide the result with several images or clips.", icon: Layers },
  { value: "multi_shot", label: "Multi-shot", description: "Build a sequence with a separate description per shot.", icon: Film },
  { value: "video_to_video", label: "Modify video", description: "Transform an existing video.", icon: RefreshCw },
  { value: "relight", label: "Relight", description: "Change the lighting or time of day in a clip.", icon: Video },
];

const WORKFLOW_HELP: Record<WorkflowSelection, string> = {
  auto: "Start with a description, a render, or a video. Auto selects the matching video workflow from your inputs.",
  text_to_video: "Describe the architectural scene and its motion. No source image is required.",
  image_to_video: "Use a render or image as the opening frame, then describe the camera movement or scene motion.",
  start_end_frame: "Add both an opening frame and an ending frame to guide the transition.",
  multi_reference: "Attach at least two reference items and reference them in Shot 1 with the available @ tags.",
  multi_shot: "Create a sequence by giving each shot its own clear movement or scene description.",
  video_to_video: "Upload an existing video and describe the change you want to see.",
  relight: "Upload a video and describe the new lighting, atmosphere, or time of day.",
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


export default function VideoGeneratorPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawMode = searchParams.get("mode");
  const modeHint = rawMode && VIDEO_MODES.includes(rawMode as VideoMode)
    ? (rawMode as VideoMode)
    : null;
  const selectedWorkflow: WorkflowSelection = modeHint ?? "auto";
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

  // Le changement de workflow conserve uniquement les sources compatibles avec la tâche.
  // Les routes et les gestionnaires API restent inchangés ; Auto conserve les sources actuelles.
  const selectWorkflow = useCallback((nextWorkflow: WorkflowSelection) => {
    if (nextWorkflow === selectedWorkflow) return;

    const keepStartImage = nextWorkflow === "auto" || nextWorkflow === "image_to_video" || nextWorkflow === "start_end_frame" || nextWorkflow === "multi_shot";
    const keepEndImage = nextWorkflow === "auto" || nextWorkflow === "start_end_frame";
    const keepAllMedia = nextWorkflow === "auto" || nextWorkflow === "multi_reference" || nextWorkflow === "multi_shot";
    const keepVideoMedia = nextWorkflow === "video_to_video" || nextWorkflow === "relight";

    const nextMedia = keepAllMedia
      ? state.attachedMedia
      : keepVideoMedia
        ? state.attachedMedia.filter((item) => item.type === "video")
        : [];
    const retainedTags = new Set(nextMedia.map((item) => item.tag));
    const willRemoveSources =
      (!keepStartImage && Boolean(state.startImage)) ||
      (!keepEndImage && Boolean(state.endImage)) ||
      nextMedia.length !== state.attachedMedia.length;
    const willRemoveExtraShots = nextWorkflow !== "auto" && nextWorkflow !== "multi_shot" && state.shots.length > 1;

    if ((willRemoveSources || willRemoveExtraShots) && typeof window !== "undefined") {
      const nextLabel = nextWorkflow === "auto" ? "Auto" : modeLabels[nextWorkflow];
      const confirmed = window.confirm(
        `Switch to ${nextLabel}? Source media or extra shots that this workflow cannot use will be removed. The first shot description will be kept, and references to removed media will be cleared.`,
      );
      if (!confirmed) return;
    }

    setState((current) => {
      const nextShots = current.shots.map((shot) => {
        let prompt = shot.prompt;
        for (const tag of findMediaTags(shot.prompt)) {
          if (!retainedTags.has(tag)) prompt = prompt.split(tag).join(" ");
        }
        return {
          ...shot,
          prompt: prompt.replace(/[ \t]{2,}/g, " ").trim(),
        };
      });

      if (nextWorkflow !== "auto" && nextWorkflow !== "multi_shot" && nextShots.length > 1) {
        nextShots.splice(1);
      }
      if (nextWorkflow === "multi_shot" && nextShots.length < 2) {
        nextShots.push({ id: generateUuid(), prompt: "", taggedMediaIds: [] });
      }

      return {
        ...current,
        startImage: keepStartImage ? current.startImage : null,
        startImagePreview: keepStartImage ? current.startImagePreview : null,
        endImage: keepEndImage ? current.endImage : null,
        endImagePreview: keepEndImage ? current.endImagePreview : null,
        attachedMedia: nextMedia,
        shots: nextShots,
      };
    });

    const params = new URLSearchParams(searchParams.toString());
    if (nextWorkflow === "auto") params.delete("mode");
    else params.set("mode", nextWorkflow);
    const query = params.toString();
    router.replace(query ? `/app/ai-video-generator?${query}` : "/app/ai-video-generator", { scroll: false });
  }, [router, searchParams, selectedWorkflow, state.attachedMedia, state.startImage, state.endImage, state.shots.length]);

  useEffect(() => {
    if (selectedWorkflow !== "multi_shot") return;
    setState((current) => current.shots.length > 1
      ? current
      : { ...current, shots: [...current.shots, { id: generateUuid(), prompt: "", taggedMediaIds: [] }] });
  }, [selectedWorkflow]);

  const previewMode = useMemo(
    () => selectedWorkflow === "auto" ? resolvePreviewMode(state, null) : selectedWorkflow,
    [state, selectedWorkflow],
  );
  const activeFeature = previewMode;

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
    if (!currentCompatible && compatible.length > 0) {
      updateState({ selectedModel: compatible[0].key });
    }
  }, [previewMode, models, state.selectedModel, updateState]);

  const tags = useMemo(() => state.attachedMedia.map((m) => m.tag), [state.attachedMedia]);
  const cost = useMemo(() => {
    if (!costsConfig) return 0;
    return computeVideoDisplayCost(costsConfig, previewMode, state.shots.length, state.selectedModel || undefined);
  }, [costsConfig, previewMode, state.shots.length, state.selectedModel]);
  const hasEnoughCredits = balance === null || balance >= cost;

  const firstShotPrompt = state.shots[0]?.prompt ?? "";
  const referencedTags = findMediaTags(firstShotPrompt).filter((tag) =>
    state.attachedMedia.some((item) => item.tag === tag),
  );
  const hasReferencedImage = referencedTags.some((tag) =>
    state.attachedMedia.some((item) => item.tag === tag && item.type === "image"),
  );
  const hasReferencedVideo = referencedTags.some((tag) =>
    state.attachedMedia.some((item) => item.tag === tag && item.type === "video"),
  );
  const promptsReady = state.shots.every((shot) => shot.prompt.trim().length > 0);
  const modeInputsReady = (() => {
    switch (previewMode) {
      case "text_to_video":
        return firstShotPrompt.trim().length > 0;
      case "image_to_video":
        return Boolean(state.startImage) || hasReferencedImage;
      case "start_end_frame":
        return Boolean(state.startImage && state.endImage);
      case "multi_reference":
        return referencedTags.length >= 2;
      case "multi_shot":
        return state.shots.length >= 2 && promptsReady;
      case "video_to_video":
      case "relight":
        return hasReferencedVideo;
      default:
        return false;
    }
  })();
  const canGenerate = !isBusy && modeInputsReady;

  const requirementText = !modeInputsReady
    ? previewMode === "text_to_video"
      ? "Add a scene and motion description to continue."
      : previewMode === "image_to_video"
        ? "Add a starting image to animate."
        : previewMode === "start_end_frame"
          ? "Add both a starting image and an ending image."
          : previewMode === "multi_reference"
            ? "Add at least two references and include their tags in Shot 1."
            : previewMode === "multi_shot"
              ? "Add a description to every shot in the sequence."
              : "Add a source video to continue."
    : null;

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
    if (!hasEnoughCredits || isBusy || !modeInputsReady) return;
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

  const isVideoMode = previewMode === "video_to_video" || previewMode === "relight";
  const showFrameInputs = selectedWorkflow === "auto" || selectedWorkflow === "image_to_video" || selectedWorkflow === "start_end_frame" || selectedWorkflow === "multi_shot";
  const showBothFrames = selectedWorkflow === "auto" || selectedWorkflow === "start_end_frame";
  const showReferences = selectedWorkflow === "auto" || selectedWorkflow === "multi_reference" || selectedWorkflow === "multi_shot" || isVideoMode;

  return (
    <main className="mx-auto flex min-h-[calc(100vh-3.5rem)] w-full max-w-[1680px] flex-col gap-4 px-3 py-4 sm:px-5 lg:px-7 lg:py-5">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b pb-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Video Studio</h1>
            <Badge variant="outline" className="gap-1.5">
              <Sparkles className="h-3 w-3" />
              {selectedWorkflow === "auto" ? `Auto · ${modeLabels[previewMode]}` : modeLabels[previewMode]}
            </Badge>
          </div>
          <p className="mt-1.5 max-w-2xl text-sm text-muted-foreground">
            Create architectural motion from a render, a set of frames, references, or an existing clip.
          </p>
        </div>
        {isBusy && (
          <Badge variant="secondary" className="shrink-0 gap-1.5">
            <Loader2 className="h-3 w-3 animate-spin" /> Generating
          </Badge>
        )}
      </header>

      {/* Barre des workflows vidéo : sélection de la tâche, sans sélecteur de modèle visible. */}
      <section aria-label="AI video workflow" className="rounded-xl border bg-card p-3 sm:p-4">
        <div className="mb-3 flex items-start gap-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Sparkles className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm font-semibold">AI Video Mode</h2>
            <p className="mt-0.5 text-xs leading-5 text-muted-foreground">{WORKFLOW_HELP[selectedWorkflow]}</p>
          </div>
        </div>
        <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 [scrollbar-width:thin]" role="group" aria-label="Choose a video workflow">
          {WORKFLOW_OPTIONS.map((option) => {
            const Icon = option.icon;
            const selected = selectedWorkflow === option.value;
            return (
              <button
                key={option.value}
                type="button"
                aria-pressed={selected}
                disabled={isBusy}
                onClick={() => selectWorkflow(option.value)}
                title={option.description}
                className={cn(
                  "flex h-9 shrink-0 items-center gap-1.5 rounded-lg border px-3 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
                  selected
                    ? "border-primary bg-primary text-primary-foreground shadow-sm"
                    : "border-border bg-background text-muted-foreground hover:border-primary/40 hover:bg-accent hover:text-foreground",
                )}
              >
                <Icon className="h-3.5 w-3.5 shrink-0" />
                <span>{option.label}</span>
              </button>
            );
          })}
        </div>
      </section>

      <div className="grid min-w-0 flex-1 items-start gap-4 lg:grid-cols-[minmax(320px,380px)_minmax(0,1fr)] xl:grid-cols-[minmax(360px,420px)_minmax(0,1fr)] xl:gap-5">
        <section aria-label="Video inputs and settings" className="min-w-0">
          <Card className="overflow-visible">
            <CardContent className="flex flex-col gap-5 p-4 sm:p-5">
              <section className="flex flex-col gap-3" aria-labelledby="video-source-title">
                <div>
                  <h2 id="video-source-title" className="text-sm font-semibold">Source media</h2>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    {isVideoMode
                      ? "Choose the clip you want to modify."
                      : selectedWorkflow === "text_to_video"
                        ? "This workflow starts from your scene description."
                        : selectedWorkflow === "multi_reference"
                          ? "Use references to guide the visual result and preserve design intent."
                          : "Use a render or frames to guide the result. Source images are optional in Auto mode."}
                  </p>
                </div>

                {isVideoMode ? (
                  <VideoDropzone
                    previewUrl={state.attachedMedia.find((media) => media.type === "video")?.url ?? null}
                    onFileSelected={setSourceVideo}
                    label={selectedWorkflow === "relight" ? "Video to relight" : "Video to modify"}
                  />
                ) : selectedWorkflow === "text_to_video" ? (
                  <div className="flex items-start gap-3 rounded-lg border border-dashed bg-muted/20 p-3.5">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-background text-muted-foreground">
                      <Sparkles className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">Start from an idea</p>
                      <p className="mt-1 text-xs leading-5 text-muted-foreground">Describe the building, atmosphere, and motion in the shot description below.</p>
                    </div>
                  </div>
                ) : showFrameInputs ? (
                  <div className={cn("grid gap-3", showBothFrames ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1")}>
                    <FrameDropzone
                      label={selectedWorkflow === "multi_shot" ? "Opening frame (optional)" : "Starting frame"}
                      previewUrl={state.startImagePreview}
                      onFileSelected={(file) => updateState({ startImage: file, startImagePreview: URL.createObjectURL(file) })}
                      placeholderTitle={selectedWorkflow === "multi_shot" ? "Add an opening frame" : "Drop your render or image"}
                      placeholderDescription={selectedWorkflow === "multi_shot" ? "Optional visual starting point" : "First frame of the animation"}
                    />
                    {showBothFrames && (
                      <FrameDropzone
                        label={selectedWorkflow === "start_end_frame" ? "Ending frame" : "Ending frame (optional)"}
                        previewUrl={state.endImagePreview}
                        onFileSelected={(file) => updateState({ endImage: file, endImagePreview: URL.createObjectURL(file) })}
                        placeholderTitle="Add an ending frame"
                        placeholderDescription={selectedWorkflow === "start_end_frame" ? "Required to guide the transition" : "Optional transition target"}
                      />
                    )}
                  </div>
                ) : (
                  <div className="flex items-start gap-3 rounded-lg border border-dashed bg-muted/20 p-3.5">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-background text-muted-foreground">
                      <Layers className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">Reference-led creation</p>
                      <p className="mt-1 text-xs leading-5 text-muted-foreground">Add at least two references below, then connect them to the shot description using the available reference tags.</p>
                    </div>
                  </div>
                )}
              </section>

              {showReferences && (
                <section className="flex flex-col gap-2 border-t pt-4" aria-label="Reference media">
                  <MediaAttachments
                    media={state.attachedMedia}
                    onAdd={addMedia}
                    onRemove={removeMedia}
                    disabled={isBusy}
                    max={MAX_ATTACHED_MEDIA}
                  />
                </section>
              )}

              <section className="flex flex-col gap-3 border-t pt-4" aria-labelledby="motion-title">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 id="motion-title" className="text-sm font-semibold">Motion & shot descriptions</h2>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">
                      Describe what changes and how the camera should move. Keep each shot focused on one clear action.
                    </p>
                  </div>
                  <Button type="button" variant="outline" size="sm" className="h-8 shrink-0 px-2.5" onClick={addShot} disabled={isBusy}>
                    <Plus className="mr-1 h-3.5 w-3.5" /> Shot
                  </Button>
                </div>

                <div className="flex flex-col gap-3">
                  {state.shots.map((shot, index) => (
                    <div key={shot.id || `shot-${index}`} className="rounded-lg border bg-background p-3">
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
                {previewMode === "multi_reference" && (
                  <p className="text-xs leading-5 text-muted-foreground">In Shot 1, reference at least two attached items (for example, @img1 and @img2) so the system can identify which visuals should guide the generation.</p>
                )}
              </section>

              <section className="flex flex-col gap-3 border-t pt-4" aria-labelledby="video-output-title">
                <div>
                  <h2 id="video-output-title" className="text-sm font-semibold">Output</h2>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">Set the clip length, frame shape, and audio preference.</p>
                </div>
                <BottomToolbar
                  duration={state.duration}
                  onDurationChange={(duration) => updateState({ duration: duration as VideoDuration })}
                  aspectRatio={state.aspectRatio}
                  onAspectRatioChange={(aspectRatio) => updateState({ aspectRatio: aspectRatio as VideoAspectRatio })}
                  audioEnabled={state.audioEnabled}
                  onAudioEnabledChange={(audioEnabled) => updateState({ audioEnabled })}
                  disabled={isBusy}
                />
              </section>

              {requirementText && (
                <p className="rounded-lg border border-amber-500/25 bg-amber-500/5 px-3 py-2 text-xs leading-5 text-muted-foreground" role="status">
                  {requirementText}
                </p>
              )}
            </CardContent>
          </Card>
        </section>

        <section aria-label="Video preview and history" className="flex min-w-0 flex-col gap-4 xl:gap-5">
          <Card className="overflow-hidden">
            <CardContent className="p-3 sm:p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-sm font-semibold">Video Preview</h2>
                  <p className="mt-1 text-xs text-muted-foreground">Review framing and motion before downloading your clip.</p>
                </div>
                <Badge variant={isBusy ? "secondary" : "outline"} className="shrink-0">
                  {isBusy ? "Generating" : resultUrl ? "Ready to review" : "Preview"}
                </Badge>
              </div>

              <div
                className="relative mt-3 flex min-h-[280px] w-full items-center justify-center overflow-hidden rounded-xl border bg-zinc-950 p-3 sm:min-h-[360px]"
                style={{
                  aspectRatio: state.aspectRatio === "9:16" ? "4 / 5" : state.aspectRatio === "1:1" ? "1 / 1" : "16 / 9",
                  maxHeight: "min(72vh, 760px)",
                }}
              >
                {resultUrl ? (
                  <video
                    src={resultUrl}
                    controls
                    playsInline
                    aria-label="Generated video preview"
                    className="h-full w-full rounded-lg bg-black object-contain"
                  />
                ) : isBusy ? (
                  <div className="flex h-full w-full flex-col items-center justify-center gap-3 rounded-lg border border-white/10 bg-white/[0.03] p-6 text-center text-white">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full border border-white/15 bg-white/5">
                      <Loader2 className="h-5 w-5 animate-spin" />
                    </div>
                    <p className="text-sm font-medium">Creating your video</p>
                    {progress ? (
                      <p className="text-xs text-white/65">Generating shot {progress.current} of {progress.total}</p>
                    ) : (
                      <p className="max-w-sm text-xs leading-5 text-white/65">The preview will update when processing is complete. You can keep this page open.</p>
                    )}
                  </div>
                ) : (
                  <div className="flex h-full w-full flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-white/15 bg-white/[0.025] p-6 text-center text-white">
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/5">
                      <Video className="h-6 w-6 text-white/70" />
                    </div>
                    <div className="max-w-sm">
                      <p className="text-sm font-medium">Your video will appear here</p>
                      <p className="mt-1.5 text-xs leading-5 text-white/60">Choose a workflow, add your source if needed, and describe the motion to create a preview.</p>
                    </div>
                  </div>
                )}
              </div>

              {error && <p role="alert" className="mt-3 rounded-lg border border-destructive/25 bg-destructive/5 px-3 py-2 text-sm text-destructive">{error}</p>}

              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                <span>{modeLabels[previewMode]}</span>
                <span>{state.duration}s · {state.aspectRatio}{state.audioEnabled ? " · Audio on" : " · Audio off"}</span>
              </div>
              {resultUrl && (
                <div className="mt-3 flex justify-end">
                  <Button type="button" variant="outline" size="sm" onClick={() => void saveResult(resultUrl, "video")}>
                    <Download className="mr-1.5 h-3.5 w-3.5" /> Download video
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="flex flex-col gap-3 p-4 sm:p-5">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h2 className="text-sm font-semibold">Recent video results</h2>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">Reuse a previous clip as a reference for another generation.</p>
                </div>
                <Badge variant="outline" className="shrink-0">{projectAssets.length}</Badge>
              </div>
              {projectAssets.length === 0 ? (
                <div className="flex items-start gap-3 rounded-lg border border-dashed p-3.5">
                  <Film className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                  <p className="text-xs leading-5 text-muted-foreground">No previous videos for this workflow yet. Completed videos will be available here when the asset service returns them.</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 2xl:grid-cols-4">
                  {projectAssets.map((asset) => {
                    const added = state.attachedMedia.some((item) => item.assetId === asset.id);
                    return (
                      <div key={asset.id} className={cn("min-w-0 rounded-lg border p-2 transition-colors", added ? "border-primary/60 bg-primary/5" : "border-border hover:border-primary/30")}>
                        <video src={asset.url} muted playsInline preload="metadata" aria-label="Previous video result" className="aspect-video w-full rounded-md bg-black object-contain" />
                        <p className="mt-2 truncate text-xs font-medium">Video reference</p>
                        <Button
                          type="button"
                          variant={added ? "secondary" : "outline"}
                          size="sm"
                          className="mt-2 h-8 w-full px-2 text-xs"
                          disabled={isBusy || added || state.attachedMedia.length >= MAX_ATTACHED_MEDIA || !showReferences}
                          onClick={() => addExistingVideo(asset)}
                        >
                          {added ? "Added" : "Add reference"}
                        </Button>
                      </div>
                    );
                  })}
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