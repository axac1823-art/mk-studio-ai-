"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import {
  CalendarClock,
  Check,
  ChevronDown,
  Copy,
  Download,
  Image as ImageIcon,
  Loader2,
  Sparkles,
  Star,
  WandSparkles,
  X,
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
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function serviceLabel(feature: string | null | undefined): string | null {
  if (!feature) return null;
  return SERVICE_LABELS[feature] ?? humanize(feature);
}

function ProviderMark({ provider }: { provider: ProviderInfo }) {
  return (
    <span
      aria-label={`${provider.name} logo mark`}
      title={provider.name}
      className={cn(
        "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-[11px] font-bold tracking-tight ring-1 ring-inset",
        provider.tone,
      )}
    >
      {provider.mark}
    </span>
  );
}

export function AssetPreviewDialog({
  asset,
  onClose,
  onChanged,
  createServices,
}: AssetPreviewDialogProps) {
  const titleId = useId();
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const [details, setDetails] = useState<AssetDetails | null>(null);
  const [loading, setLoading] = useState(false);
  const [metadataError, setMetadataError] = useState(false);
  const [favoriteBusy, setFavoriteBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [promptCopied, setPromptCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);

  const assetId = asset?.id;
  const assetUrl = asset?.url;
  const assetType = asset?.type;
  const assetIsFavorite = asset?.isFavorite;

  useEffect(() => {
    if (!assetId || !assetUrl || !assetType) return;
    let cancelled = false;
    const previewAsset: PreviewAsset = {
      id: assetId,
      url: assetUrl,
      type: assetType,
      isFavorite: assetIsFavorite,
    };
    setDetails(null);
    setMetadataError(false);
    setActionError(null);
    setPromptCopied(false);
    setCopyError(false);
    setLoading(true);

    fetch(`/api/assets/${encodeURIComponent(assetId)}`, { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = (await response.json()) as { asset?: AssetDetails };
        if (data.asset) return data.asset;
        throw new Error("Asset details were not returned.");
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

    return () => {
      cancelled = true;
    };
  }, [assetId, assetUrl, assetType, assetIsFavorite]);

  useEffect(() => {
    if (!assetId) return;
    const previouslyFocused = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab") return;
      const dialog = document.getElementById(titleId)?.closest('[role="dialog"]');
      const focusable = dialog?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), a[href], input:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
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
  // Prefer the winner recorded by the worker. The selected model is shown only
  // as a fallback and is explicitly labelled as not necessarily the winner.
  const provider = actualModel
    ? providerForModel(actualModel)
    : selectedModel
      ? providerForModel(selectedModel)
      : null;
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

  const toggleFavorite = async () => {
    if (favoriteBusy) return;
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
    if (downloading) return;
    setDownloading(true);
    try {
      await saveResult(displayed.url, displayed.type);
    } finally {
      setDownloading(false);
    }
  };

  const handleCopyDescription = async () => {
    if (!description) return;
    setCopyError(false);
    try {
      await navigator.clipboard.writeText(description);
      setPromptCopied(true);
      window.setTimeout(() => setPromptCopied(false), 1800);
    } catch {
      setCopyError(true);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[150] flex items-center justify-center bg-black/70 p-2 backdrop-blur-sm sm:p-5"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative flex max-h-[94dvh] w-full max-w-[1480px] flex-col overflow-hidden rounded-2xl border bg-background shadow-2xl lg:flex-row"
      >
        <div className="relative flex min-h-[36vh] flex-1 items-center justify-center overflow-hidden bg-neutral-950 p-3 sm:min-h-[48vh] lg:min-h-0">
          {displayed.type === "image" ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={displayed.url}
              alt={tool ? `${tool} result` : "Asset preview"}
              className="max-h-[70dvh] w-full object-contain lg:max-h-[88dvh]"
            />
          ) : displayed.type === "video" ? (
            <video src={displayed.url} controls playsInline className="max-h-[70dvh] w-full object-contain lg:max-h-[88dvh]" />
          ) : displayed.type === "audio" ? (
            <div className="w-full max-w-xl rounded-xl border border-white/15 bg-white/5 p-6 text-white">
              <div className="mb-4 flex items-center gap-3"><Sparkles className="h-6 w-6" /><span className="font-medium">Audio preview</span></div>
              <audio src={displayed.url} controls className="w-full" />
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3 text-white/80">
              <ImageIcon className="h-12 w-12" />
              <p className="text-sm">Preview for this 3D file is not available here.</p>
            </div>
          )}
          <div className="absolute left-3 top-3 flex flex-wrap gap-2">
            <Badge variant="secondary" className="capitalize">{displayed.type === "3d_model" ? "3D model" : displayed.type}</Badge>
            <Badge variant="outline" className="border-white/20 bg-black/45 text-white">
              {sourceBadgeLabel}
            </Badge>
          </div>
        </div>

        <aside className="flex w-full shrink-0 flex-col overflow-y-auto border-t lg:w-[340px] lg:border-l lg:border-t-0 xl:w-[370px]">
          <header className="flex items-start justify-between gap-3 border-b px-5 py-4">
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Asset details</p>
              <h2 id={titleId} className="mt-1 truncate text-base font-semibold tracking-tight">{tool ?? (displayed.source === "generated" ? "Generated asset" : "Uploaded source")}</h2>
              <p className="mt-1 text-xs text-muted-foreground">ID · {displayed.id.slice(0, 8)}</p>
            </div>
            <Button ref={closeButtonRef} type="button" variant="ghost" size="icon" className="h-9 w-9 shrink-0" onClick={onClose} aria-label="Close image preview">
              <X className="h-4 w-4" />
            </Button>
          </header>

          <div className="flex flex-col gap-5 p-5">
            {loading && (
              <p role="status" className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading provenance…
              </p>
            )}
            {metadataError && (
              <p role="status" className="rounded-lg border border-dashed px-3 py-2 text-xs text-muted-foreground">
                The media is available, but its full generation details could not be loaded.
              </p>
            )}

            <section className="flex flex-col gap-3" aria-label="Creation information">
              <div className="flex items-start gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground"><WandSparkles className="h-4 w-4" /></span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-muted-foreground">Service used</p>
                  <p className="mt-0.5 text-sm font-medium">{tool ?? serviceFallback}</p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    {displayed.source === "generated"
                      ? "Read from the saved generation record."
                      : displayed.source === "upload"
                        ? "This file has no linked AI generation record."
                        : "The provenance record has not been loaded or is unavailable."}
                  </p>
                </div>
              </div>

              <div className="h-px bg-border" />

              <div className="flex items-start gap-3">
                {provider ? (
                  <ProviderMark provider={provider} />
                ) : (
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground"><Sparkles className="h-4 w-4" /></span>
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-muted-foreground">AI model used</p>
                  {actualModel ? (
                    <>
                      <p className="mt-0.5 break-words text-sm font-medium">{modelLabel(actualModel)}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{provider?.name ?? "Provider not identified"}</p>
                    </>
                  ) : selectedModel ? (
                    <>
                      <p className="mt-0.5 break-words text-sm font-medium">{modelLabel(selectedModel)}</p>
                      <p className="mt-1 text-xs text-muted-foreground">Selected model · actual fallback model not recorded</p>
                    </>
                  ) : (
                    <p className="mt-0.5 text-sm font-medium">{displayed.source === "generated" ? "Model not recorded" : displayed.source === "upload" ? "Not AI-generated" : "Model information unavailable"}</p>
                  )}
                  {provider && <p className="mt-2 text-[10px] leading-4 text-muted-foreground">Provider mark shown from the recorded model family.</p>}
                </div>
              </div>

              <div className="h-px bg-border" />

              <div className="flex items-start gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground"><CalendarClock className="h-4 w-4" /></span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-muted-foreground">Created / uploaded</p>
                  <p className="mt-0.5 text-sm font-medium">{createdAt ?? (loading ? "Loading timestamp…" : "Timestamp unavailable")}</p>
                  {displayed.generationCreatedAt && displayed.generationCreatedAt !== displayed.createdAt && (
                    <p className="mt-1 text-xs text-muted-foreground">Generation started · {formatTimestamp(displayed.generationCreatedAt) ?? "Timestamp unavailable"}</p>
                  )}
                </div>
              </div>
            </section>

            <section className="rounded-xl border bg-muted/20 p-3.5" aria-label="Saved description prompt">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Description / Prompt</p>
                  <p className="mt-1 text-xs text-muted-foreground">The text saved in the Description field for this task.</p>
                </div>
                {description && (
                  <Button type="button" variant="outline" size="sm" className="h-8 shrink-0 gap-1.5 px-2.5" onClick={() => void handleCopyDescription()}>
                    {promptCopied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                    {promptCopied ? "Copied" : "Copy"}
                  </Button>
                )}
              </div>
              <div className="mt-3 max-h-44 overflow-y-auto rounded-lg border bg-background px-3 py-2.5 text-sm leading-6">
                {description ? (
                  <p className="whitespace-pre-wrap break-words">{description}</p>
                ) : (
                  <p className="text-muted-foreground">
                    {loading
                      ? "Loading saved description…"
                      : displayed.source === "generated"
                        ? "No description was saved with this generation."
                        : "This source was uploaded manually; it has no linked generation description."}
                  </p>
                )}
              </div>
              {copyError && <p role="status" className="mt-2 text-xs text-destructive">Could not copy. Please select the text and copy it manually.</p>}
            </section>

            {actionError && <p role="alert" className="rounded-lg border border-destructive/25 bg-destructive/5 px-3 py-2 text-xs text-destructive">{actionError}</p>}

            <div className="sticky bottom-0 mt-auto flex flex-wrap items-center gap-2 border-t bg-background pt-4">
              {displayed.type !== "3d_model" && (
                <Button type="button" className="h-10 flex-1 gap-2" onClick={() => void handleDownload()} disabled={downloading}>
                  {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                  {downloading ? "Preparing…" : `Download ${displayed.type === "video" ? "video" : displayed.type === "audio" ? "audio" : "image"}`}
                </Button>
              )}
              <Button
                type="button"
                variant={displayed.isFavorite ? "secondary" : "outline"}
                className="h-10 gap-2"
                onClick={() => void toggleFavorite()}
                disabled={favoriteBusy}
                aria-pressed={Boolean(displayed.isFavorite)}
              >
                {favoriteBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Star className={cn("h-4 w-4", displayed.isFavorite && "fill-current text-primary")} />}
                {displayed.isFavorite ? "Favorited" : "Favorite"}
              </Button>
              {createServices.length > 0 && (displayed.type === "image" || displayed.type === "video") && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button type="button" variant="outline" className="h-10 gap-2">
                      <WandSparkles className="h-4 w-4" /> Create <ChevronDown className="h-3.5 w-3.5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="max-h-[min(60vh,420px)] overflow-y-auto">
                    {createServices.map(([label, route]) => {
                      const separator = route.includes("?") ? "&" : "?";
                      return (
                        <DropdownMenuItem key={route} asChild>
                          <Link href={`${route}${separator}assetId=${encodeURIComponent(displayed.id)}`}>{label}</Link>
                        </DropdownMenuItem>
                      );
                    })}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          </div>
        </aside>
      </section>
    </div>
  );
}
