"use client";

import { useEffect, useId, useRef, useState, type PointerEvent as ReactPointerEvent, type WheelEvent as ReactWheelEvent } from "react";
import Link from "next/link";
import {
  CalendarClock,
  Check,
  ChevronDown,
  Copy,
  Download,
  Image as ImageIcon,
  Loader2,
  Scan,
  Sparkles,
  Star,
  Trash2,
  WandSparkles,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { saveResult } from "@/lib/download";
import { cn } from "@/lib/utils";

export interface PreviewAsset {
  id: string;
  type: "image" | "video" | "audio" | "3d_model";
  url: string;
  isFavorite?: boolean;
}

interface AssetDetails extends PreviewAsset {
  projectId?: string | null;
  createdAt?: string | null;
  generationId?: string | null;
  videoJobId?: string | null;
  source?: "generated" | "upload";
  feature?: string | null;
  modelUsed?: string | null;
  selectedModel?: string | null;
  generationCreatedAt?: string | null;
  description?: string | null;
}

type CreateService = readonly [string, string];

interface AssetPreviewDialogProps {
  asset: PreviewAsset | null;
  onClose: () => void;
  onChanged: () => void;
  createServices: readonly CreateService[];
}

const SERVICE_LABELS: Record<string, string> = {
  text_to_image: "Image Generator",
  print_render: "Render",
  mood_swap: "Change Atmosphere",
  exterior_to_interior: "Exterior to Interior",
  plan_to_render: "Plan to Render",
  multi_angle: "Multi-Angle",
  image_extender: "Image Extender",
  variations: "Variations",
  background_remover: "Background Remover",
  upscale: "Upscale",
  animate: "Image to Video",
  image_to_video: "Image to Video",
  text_to_video: "Text to Video",
  start_end_frame: "Start / End Frame Video",
  multi_reference: "Multi-Reference Video",
  multi_shot: "Multi-Shot Video",
  video_to_video: "Modify Video",
  relight: "Video Relight",
  video_upscale: "Video Upscale",
  video_edit_trim: "Clip Editor · Trim",
  video_edit_speed: "Clip Editor · Speed",
  video_edit_overlay: "Clip Editor · Text Overlay",
  video_edit_export: "Clip Editor · Export",
  video_edit_concat: "Video Project Editor",
  voice_generator: "Voice Generator",
  "3d_generator": "Image to 3D",
};

const MODEL_LABELS: Record<string, string> = {
  "flux-kontext-max": "FLUX.1 Kontext Max",
  "flux-pro": "FLUX Pro",
  "flux-dev": "FLUX Dev",
  "flux-kontext-pro": "FLUX.1 Kontext Pro",
  "gemini-3-pro": "Gemini 3 Pro Image",
  "gemini-2.5-flash": "Gemini 2.5 Flash Image",
  "gpt-image-1.5": "GPT Image 1.5",
  "gpt-image-1": "GPT Image 1",
  "magichour-flux-2-klein": "FLUX 2 Klein · Magic Hour",
  "magichour-flux-2-klein-text": "FLUX 2 Klein · Magic Hour",
  "magichour-video": "Magic Hour Video",
  "magichour-video-to-video": "Magic Hour Video-to-Video",
  "magichour-video-relight": "Magic Hour Video Relight",
  "magichour-lip-sync": "Magic Hour Lip Sync",
  "comfyui-minimax-h3": "MiniMax H3 · ComfyUI",
  "kling-seedance-1.6": "Kling Seedance 1.6",
  "kling-3.0-pro": "Kling 3.0 Pro",
  "kling-3.0": "Kling 3.0",
  "kling-v3": "Kling v3",
  "kling-v2.5-turbo": "Kling v2.5 Turbo",
  "runway-gen4": "Runway Gen-4",
  "runway-gen4-turbo": "Runway Gen-4 Turbo",
  "sora-2-pro": "Sora 2 Pro",
  "sora-2": "Sora 2",
  meshy: "Meshy",
  tripo: "Tripo AI",
  "hunyuan3d-2": "Hunyuan3D 2",
  trellis: "Trellis",
};

interface ProviderInfo {
  name: string;
  mark: string;
  tone: string;
}

function humanize(value: string): string {
  return value
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function modelLabel(value: string): string {
  return MODEL_LABELS[value] ?? humanize(value);
}

function providerForModel(value: string): ProviderInfo {
  const model = value.toLowerCase();
  if (model.startsWith("flux-kontext") || model.startsWith("flux-")) {
    return { name: "Black Forest Labs", mark: "BFL", tone: "bg-amber-100 text-amber-950 ring-amber-200 dark:bg-amber-300/15 dark:text-amber-200 dark:ring-amber-300/25" };
  }
  if (model.startsWith("gemini")) {
    return { name: "Google", mark: "G", tone: "bg-blue-100 text-blue-800 ring-blue-200 dark:bg-blue-400/15 dark:text-blue-200 dark:ring-blue-300/25" };
  }
  if (model.startsWith("gpt-") || model.startsWith("sora-")) {
    return { name: "OpenAI", mark: "AI", tone: "bg-emerald-100 text-emerald-900 ring-emerald-200 dark:bg-emerald-400/15 dark:text-emerald-200 dark:ring-emerald-300/25" };
  }
  if (model.startsWith("magichour-")) {
    return { name: "Magic Hour", mark: "MH", tone: "bg-violet-100 text-violet-900 ring-violet-200 dark:bg-violet-400/15 dark:text-violet-200 dark:ring-violet-300/25" };
  }
  if (model.startsWith("kling-")) {
    return { name: "Kling AI", mark: "K", tone: "bg-indigo-100 text-indigo-900 ring-indigo-200 dark:bg-indigo-400/15 dark:text-indigo-200 dark:ring-indigo-300/25" };
  }
  if (model.startsWith("runway-")) {
    return { name: "Runway", mark: "R", tone: "bg-zinc-200 text-zinc-900 ring-zinc-300 dark:bg-zinc-700 dark:text-zinc-100 dark:ring-zinc-600" };
  }
  if (model.startsWith("comfyui-")) {
    return { name: "ComfyUI", mark: "C", tone: "bg-cyan-100 text-cyan-900 ring-cyan-200 dark:bg-cyan-400/15 dark:text-cyan-200 dark:ring-cyan-300/25" };
  }
  if (model === "meshy" || model.startsWith("meshy-")) {
    return { name: "Meshy", mark: "M", tone: "bg-pink-100 text-pink-900 ring-pink-200 dark:bg-pink-400/15 dark:text-pink-200 dark:ring-pink-300/25" };
  }
  if (model === "tripo" || model.startsWith("tripo-")) {
    return { name: "Tripo AI", mark: "T", tone: "bg-sky-100 text-sky-900 ring-sky-200 dark:bg-sky-400/15 dark:text-sky-200 dark:ring-sky-300/25" };
  }
  if (model.startsWith("hunyuan3d")) {
    return { name: "Tencent Hunyuan", mark: "H", tone: "bg-rose-100 text-rose-900 ring-rose-200 dark:bg-rose-400/15 dark:text-rose-200 dark:ring-rose-300/25" };
  }
  if (model === "trellis" || model.startsWith("trellis-")) {
    return { name: "Trellis", mark: "T", tone: "bg-teal-100 text-teal-900 ring-teal-200 dark:bg-teal-400/15 dark:text-teal-200 dark:ring-teal-300/25" };
  }
  if (model.startsWith("elevenlabs") || model.startsWith("eleven-labs")) {
    return { name: "ElevenLabs", mark: "11", tone: "bg-orange-100 text-orange-900 ring-orange-200 dark:bg-orange-400/15 dark:text-orange-200 dark:ring-orange-300/25" };
  }
  if (model.includes("removebg") || model.includes("remove-bg")) {
    return { name: "remove.bg", mark: "RBG", tone: "bg-slate-200 text-slate-900 ring-slate-300 dark:bg-slate-700 dark:text-slate-100 dark:ring-slate-600" };
  }
  return { name: "AI provider", mark: "AI", tone: "bg-muted text-foreground ring-border" };
}

function formatTimestamp(value: string | null | undefined): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function serviceLabel(feature: string | null | undefined): string | null {
  if (!feature) return null;
  return SERVICE_LABELS[feature] ?? humanize(feature);
}

async function copyToClipboard(text: string): Promise<boolean> {
  if (typeof window === "undefined") return false;

  if (navigator?.clipboard && typeof navigator.clipboard.writeText === "function") {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Insecure context or permission denied; fallback to execCommand
    }
  }

  try {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.style.position = "fixed";
    textArea.style.top = "0";
    textArea.style.left = "-9999px";
    textArea.style.opacity = "0";
    textArea.style.pointerEvents = "none";
    textArea.setAttribute("readonly", "");
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    textArea.setSelectionRange(0, textArea.value.length);
    const successful = document.execCommand("copy");
    document.body.removeChild(textArea);
    return successful;
  } catch {
    return false;
  }
}

function ProviderMark({ provider }: { provider: ProviderInfo }) {
  return (
    <span
      aria-label={`${provider.name} logo mark`}
      title={provider.name}
      className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-[11px] font-bold tracking-tight ring-1 ring-inset", provider.tone)}
    >
      {provider.mark}
    </span>
  );
}

export function AssetPreviewDialog({ asset, onClose, onChanged, createServices }: AssetPreviewDialogProps) {
  const titleId = useId();
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const dragStartRef = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null);
  const [details, setDetails] = useState<AssetDetails | null>(null);
  const [loading, setLoading] = useState(false);
  const [metadataError, setMetadataError] = useState(false);
  const [favoriteBusy, setFavoriteBusy] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [promptCopied, setPromptCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });

  const assetId = asset?.id;
  const assetUrl = asset?.url;
  const assetType = asset?.type;
  const assetIsFavorite = asset?.isFavorite;

  useEffect(() => {
    if (!assetId || !assetUrl || !assetType) return;
    let cancelled = false;
    const previewAsset: PreviewAsset = { id: assetId, url: assetUrl, type: assetType, isFavorite: assetIsFavorite };
    setDetails(null);
    setMetadataError(false);
    setActionError(null);
    setPromptCopied(false);
    setCopyError(false);
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setLoading(true);

    fetch(`/api/assets/${encodeURIComponent(assetId)}`, { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = (await response.json()) as { asset?: AssetDetails };
        if (!data.asset) throw new Error("Asset details were not returned.");
        return data.asset;
      })
      .then((data) => {
        if (!cancelled) setDetails({ ...previewAsset, ...data, url: data.url || previewAsset.url });
      })
      .catch(() => {
        if (!cancelled) {
          setDetails(previewAsset);
          setMetadataError(true);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [assetId, assetUrl, assetType, assetIsFavorite]);

  useEffect(() => {
    if (!assetId) return;
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (event.defaultPrevented) return;
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab") return;
      const dialog = document.getElementById(titleId)?.closest('[role="dialog"]');
      const focusable = dialog?.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], input:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])');
      if (!focusable?.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);
    window.requestAnimationFrame(() => closeButtonRef.current?.focus());
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
      previouslyFocused?.focus();
    };
  }, [assetId, onClose, titleId]);

  if (!asset) return null;

  const displayed: AssetDetails = { ...asset, ...(details ?? {}) };
  const createdAt = formatTimestamp(displayed.createdAt);
  const tool = serviceLabel(displayed.feature);
  const actualModel = displayed.modelUsed;
  const selectedModel = displayed.selectedModel;
  const provider = actualModel ? providerForModel(actualModel) : selectedModel ? providerForModel(selectedModel) : null;
  const description = displayed.description?.trim() ?? "";
  const sourceBadgeLabel = loading
    ? "Loading details…"
    : displayed.source === "generated"
      ? "AI result"
      : displayed.source === "upload"
        ? "Source upload"
        : "Source unknown";
  const serviceFallback = loading
    ? "Loading service details…"
    : displayed.source === "generated"
      ? "Generation service not recorded"
      : displayed.source === "upload"
        ? "Uploaded by you"
        : "Service information unavailable";

  const handleZoom = (next: number) => {
    const value = Math.min(4, Math.max(1, Number(next.toFixed(2))));
    setZoom(value);
    if (value === 1) setPan({ x: 0, y: 0 });
  };

  const handleImagePointerDown = (event: ReactPointerEvent<HTMLImageElement>) => {
    if (zoom <= 1) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragStartRef.current = { x: event.clientX, y: event.clientY, panX: pan.x, panY: pan.y };
  };

  const handleImagePointerMove = (event: ReactPointerEvent<HTMLImageElement>) => {
    if (!dragStartRef.current || zoom <= 1) return;
    setPan({
      x: dragStartRef.current.panX + event.clientX - dragStartRef.current.x,
      y: dragStartRef.current.panY + event.clientY - dragStartRef.current.y,
    });
  };

  const handleImagePointerUp = (event: ReactPointerEvent<HTMLImageElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    dragStartRef.current = null;
  };

  const handleWheelZoom = (event: ReactWheelEvent<HTMLDivElement>) => {
    if (displayed.type === "image" && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      handleZoom(zoom + (event.deltaY < 0 ? 0.15 : -0.15));
    }
  };

  const toggleFavorite = async () => {
    if (favoriteBusy || deleteBusy) return;
    const nextFavorite = !Boolean(displayed.isFavorite);
    setFavoriteBusy(true);
    setActionError(null);
    try {
      const response = await fetch(`/api/assets/${encodeURIComponent(displayed.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isFavorite: nextFavorite }),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      setDetails((current) => ({ ...(current ?? displayed), isFavorite: nextFavorite }));
      onChanged();
    } catch {
      setActionError("Could not update Favorite. Please try again.");
    } finally {
      setFavoriteBusy(false);
    }
  };

  const handleDownload = async () => {
    if (downloading || deleteBusy) return;
    setDownloading(true);
    setActionError(null);
    try {
      await saveResult(displayed.url, displayed.type);
    } catch {
      setActionError("Could not prepare the download. Please try again.");
    } finally {
      setDownloading(false);
    }
  };

  const handleDelete = async () => {
    if (deleteBusy || favoriteBusy) return;
    const confirmed = window.confirm("Move this asset to Trash? You can restore it later from the Trash page.");
    if (!confirmed) return;
    setDeleteBusy(true);
    setActionError(null);
    try {
      const response = await fetch(`/api/assets/${encodeURIComponent(displayed.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isTrashed: true }),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      onChanged();
      onClose();
    } catch {
      setActionError("Could not move this asset to Trash. Please try again.");
    } finally {
      setDeleteBusy(false);
    }
  };

  const handleCopyDescription = async () => {
    if (!description) return;
    setCopyError(false);
    const success = await copyToClipboard(description);
    if (success) {
      setPromptCopied(true);
      window.setTimeout(() => setPromptCopied(false), 1800);
    } else {
      setCopyError(true);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[150] flex items-center justify-center bg-black/75 p-2 backdrop-blur-sm sm:p-4 lg:p-5"
      onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative flex h-[min(94dvh,920px)] max-h-[94dvh] w-full max-w-[1480px] flex-col overflow-hidden rounded-2xl border border-border/80 bg-background shadow-2xl lg:flex-row"
      >
        <div
          className="relative flex h-[34dvh] min-h-[220px] shrink-0 items-center justify-center overflow-hidden bg-neutral-950 lg:h-auto lg:min-h-0 lg:flex-1"
          onWheel={handleWheelZoom}
        >
          {displayed.type === "image" ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={displayed.url}
              alt={tool ? `${tool} result` : "Asset preview"}
              draggable={false}
              onPointerDown={handleImagePointerDown}
              onPointerMove={handleImagePointerMove}
              onPointerUp={handleImagePointerUp}
              onPointerCancel={handleImagePointerUp}
              onDoubleClick={() => handleZoom(zoom === 1 ? 2 : 1)}
              className={cn("max-h-full max-w-full select-none object-contain transition-transform duration-100", zoom > 1 ? "cursor-grab active:cursor-grabbing" : "cursor-zoom-in")}
              style={{ transform: `translate3d(${pan.x}px, ${pan.y}px, 0) scale(${zoom})`, transformOrigin: "center center", touchAction: zoom > 1 ? "none" : "auto" }}
            />
          ) : displayed.type === "video" ? (
            <video src={displayed.url} controls playsInline className="max-h-full w-full object-contain" />
          ) : displayed.type === "audio" ? (
            <div className="w-full max-w-xl rounded-xl border border-white/15 bg-white/5 p-6 text-white">
              <div className="mb-4 flex items-center gap-3"><Sparkles className="h-6 w-6" aria-hidden="true" /><span className="font-medium">Audio preview</span></div>
              <audio src={displayed.url} controls className="w-full" />
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3 text-white/80">
              <ImageIcon className="h-12 w-12" aria-hidden="true" />
              <p className="text-sm">Preview for this 3D file is not available here.</p>
            </div>
          )}

          <div className="absolute left-3 top-3 flex flex-wrap gap-2">
            <Badge variant="secondary" className="border border-white/10 bg-black/45 capitalize text-white shadow-sm backdrop-blur-md">{displayed.type === "3d_model" ? "3D model" : displayed.type}</Badge>
            <Badge variant="outline" className="border-white/20 bg-black/45 text-white shadow-sm backdrop-blur-md">{sourceBadgeLabel}</Badge>
          </div>

          {displayed.type === "image" && (
            <div className="absolute right-3 top-3 flex items-center gap-0.5 rounded-xl border border-white/15 bg-black/55 p-1 text-white shadow-lg backdrop-blur-md" aria-label="Image zoom controls">
              <Button type="button" size="icon" variant="ghost" className="h-8 w-8 rounded-lg text-white hover:bg-white/15 hover:text-white" aria-label="Zoom out" title="Zoom out" onClick={() => handleZoom(zoom - 0.25)} disabled={zoom <= 1}>
                <ZoomOut className="h-4 w-4" aria-hidden="true" />
              </Button>
              <span className="min-w-[46px] text-center font-mono text-[11px] tabular-nums">{Math.round(zoom * 100)}%</span>
              <Button type="button" size="icon" variant="ghost" className="h-8 w-8 rounded-lg text-white hover:bg-white/15 hover:text-white" aria-label="Zoom in" title="Zoom in" onClick={() => handleZoom(zoom + 0.25)} disabled={zoom >= 4}>
                <ZoomIn className="h-4 w-4" aria-hidden="true" />
              </Button>
              <span className="mx-0.5 h-5 w-px bg-white/15" />
              <Button type="button" size="icon" variant="ghost" className="h-8 w-8 rounded-lg text-white hover:bg-white/15 hover:text-white" aria-label="Fit image to view" title="Fit image" onClick={() => handleZoom(1)} disabled={zoom === 1 && pan.x === 0 && pan.y === 0}>
                <Scan className="h-4 w-4" aria-hidden="true" />
              </Button>
            </div>
          )}
          {displayed.type === "image" && zoom > 1 && <p className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full border border-white/15 bg-black/55 px-3 py-1.5 text-[11px] text-white/85 backdrop-blur-md">Drag to inspect details · Ctrl/⌘ + scroll to zoom</p>}
        </div>

        <aside className="flex min-h-0 w-full flex-1 flex-col overflow-hidden border-t lg:w-[370px] lg:flex-none lg:border-l lg:border-t-0 xl:w-[400px]">
          <header className="flex shrink-0 items-start justify-between gap-3 px-4 pb-3 pt-4 sm:px-5">
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Asset workspace</p>
              <h2 id={titleId} className="mt-1 truncate text-base font-semibold tracking-tight">{tool ?? (displayed.source === "generated" ? "Generated asset" : "Uploaded source")}</h2>
              <p className="mt-1 text-xs text-muted-foreground">ID · {displayed.id.slice(0, 8)}</p>
            </div>
            <Button ref={closeButtonRef} type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0 rounded-lg" onClick={onClose} aria-label="Close asset preview">
              <X className="h-4 w-4" aria-hidden="true" />
            </Button>
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
            <div className="flex flex-col gap-5 p-4 sm:p-5">
              {loading && <p role="status" className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> Loading provenance…</p>}
              {metadataError && <p role="status" className="rounded-lg border border-dashed px-3 py-2 text-xs text-muted-foreground">The media is available, but its full generation details could not be loaded.</p>}

              <section className="flex flex-col gap-3" aria-label="Creation information">
                <div className="flex items-start gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground"><WandSparkles className="h-4 w-4" aria-hidden="true" /></span>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-muted-foreground">Service used</p>
                    <p className="mt-0.5 text-sm font-medium">{tool ?? serviceFallback}</p>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">{displayed.source === "generated" ? "Read from the saved generation record." : displayed.source === "upload" ? "This file has no linked AI generation record." : "The provenance record has not been loaded or is unavailable."}</p>
                  </div>
                </div>
                <div className="h-px bg-border" />
                <div className="flex items-start gap-3">
                  {provider ? <ProviderMark provider={provider} /> : <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground"><Sparkles className="h-4 w-4" aria-hidden="true" /></span>}
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-muted-foreground">AI model used</p>
                    {actualModel ? <><p className="mt-0.5 break-words text-sm font-medium">{modelLabel(actualModel)}</p><p className="mt-1 text-xs text-muted-foreground">{provider?.name ?? "Provider not identified"}</p></> : selectedModel ? <><p className="mt-0.5 break-words text-sm font-medium">{modelLabel(selectedModel)}</p><p className="mt-1 text-xs text-muted-foreground">Selected model · actual fallback model not recorded</p></> : <p className="mt-0.5 text-sm font-medium">{displayed.source === "generated" ? "Model not recorded" : displayed.source === "upload" ? "Not AI-generated" : "Model information unavailable"}</p>}
                    {provider && <p className="mt-2 text-[10px] leading-4 text-muted-foreground">Provider label inferred from the recorded model family.</p>}
                  </div>
                </div>
                <div className="h-px bg-border" />
                <div className="flex items-start gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground"><CalendarClock className="h-4 w-4" aria-hidden="true" /></span>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-muted-foreground">Created / uploaded</p>
                    <p className="mt-0.5 text-sm font-medium">{createdAt ?? (loading ? "Loading timestamp…" : "Timestamp unavailable")}</p>
                    {displayed.generationCreatedAt && displayed.generationCreatedAt !== displayed.createdAt && <p className="mt-1 text-xs text-muted-foreground">Generation started · {formatTimestamp(displayed.generationCreatedAt) ?? "Timestamp unavailable"}</p>}
                  </div>
                </div>
              </section>

              <section className="rounded-xl border bg-muted/20 p-3.5" aria-label="Saved description prompt">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0"><p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Description / Prompt</p><p className="mt-1 text-xs text-muted-foreground">The text saved in the Description field for this task.</p></div>
                  {description && <Button type="button" variant="outline" size="sm" className="h-8 shrink-0 gap-1.5 px-2.5" onClick={() => void handleCopyDescription()}>{promptCopied ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : <Copy className="h-3.5 w-3.5" aria-hidden="true" />}{promptCopied ? "Copied" : "Copy"}</Button>}
                </div>
                <div className="mt-3 max-h-44 overflow-y-auto rounded-lg border bg-background px-3 py-2.5 text-sm leading-6">{description ? <p className="whitespace-pre-wrap break-words select-text">{description}</p> : <p className="text-muted-foreground">{loading ? "Loading saved description…" : displayed.source === "generated" ? "No description was saved with this generation." : "This source was uploaded manually; it has no linked generation description."}</p>}</div>
                {copyError && <p role="status" className="mt-2 text-xs text-destructive">Could not copy. Please select the text and copy it manually.</p>}
              </section>
            </div>
          </div>

          {actionError && <p role="alert" className="mx-4 mt-2 rounded-lg border border-destructive/25 bg-destructive/5 px-3 py-2 text-xs text-destructive sm:mx-5">{actionError}</p>}

          <footer className="flex shrink-0 flex-wrap items-center gap-2 border-t bg-background px-3 py-3 sm:px-4">
            {displayed.type !== "3d_model" && <Button type="button" className="h-9 flex-1 gap-1.5 rounded-lg px-2.5 text-xs" onClick={() => void handleDownload()} disabled={downloading || deleteBusy}>{downloading ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : <Download className="h-3.5 w-3.5" aria-hidden="true" />}{downloading ? "Preparing…" : "Download"}</Button>}
            <Button type="button" variant={displayed.isFavorite ? "secondary" : "outline"} className="h-9 gap-1.5 rounded-lg px-2.5 text-xs" onClick={() => void toggleFavorite()} disabled={favoriteBusy || deleteBusy} aria-pressed={Boolean(displayed.isFavorite)}>{favoriteBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : <Star className={cn("h-3.5 w-3.5", displayed.isFavorite && "fill-current text-primary")} aria-hidden="true" />}{displayed.isFavorite ? "Saved" : "Favorite"}</Button>
            {createServices.length > 0 && (displayed.type === "image" || displayed.type === "video") && <DropdownMenu><DropdownMenuTrigger asChild><Button type="button" variant="outline" className="h-9 gap-1 rounded-lg px-2.5 text-xs"><WandSparkles className="h-3.5 w-3.5" aria-hidden="true" />Create<ChevronDown className="h-3 w-3" aria-hidden="true" /></Button></DropdownMenuTrigger><DropdownMenuContent align="end" className="max-h-[min(60vh,420px)] overflow-y-auto">{createServices.map(([label, route]) => { const separator = route.includes("?") ? "&" : "?"; return <DropdownMenuItem key={route} asChild><Link href={`${route}${separator}assetId=${encodeURIComponent(displayed.id)}`}>{label}</Link></DropdownMenuItem>; })}</DropdownMenuContent></DropdownMenu>}
            <Button type="button" variant="outline" className="h-9 gap-1.5 rounded-lg border-destructive/30 px-2.5 text-xs text-destructive hover:bg-destructive/5 hover:text-destructive" onClick={() => void handleDelete()} disabled={deleteBusy || favoriteBusy} aria-label="Delete asset" title="Move to Trash">{deleteBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />}<span>Delete</span></Button>
          </footer>
        </aside>
      </section>
    </div>
  );
}
