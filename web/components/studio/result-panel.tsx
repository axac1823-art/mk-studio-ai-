"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { KeyboardEvent as ReactKeyboardEvent } from "react";
import Link from "next/link";
import { Download, Expand, Loader2, Minimize2, MoreHorizontal } from "lucide-react";

import { CompareSlider } from "@/components/compare-slider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { saveResult } from "@/lib/download";
import { cn } from "@/lib/utils";

export type ResultState =
  | { status: "idle" }
  | { status: "busy"; stage?: string }
  | { status: "done"; kind: "image" | "video"; beforeUrl: string | null; outputUrls: string[] };

const STAGE_LABELS: Record<string, string> = {
  render: "Generating your render",
  upscaling: "Upscaling to your selected resolution",
  video: "Generating the video",
  narration: "Creating the narration",
  merging: "Assembling the final video",
};

interface NextAction {
  label: string;
  href: string;
}

interface ResultPanelProps {
  result: ResultState;
  error?: string | null;
  nextActions?: NextAction[];
}

function NextActions({ actions }: { actions: NextAction[] }) {
  const headingId = useId();
  if (actions.length === 0) return null;

  return (
    <section className="mt-1 border-t pt-3" aria-labelledby={headingId}>
      <div className="mb-2">
        <h3 id={headingId} className="text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">
          What next?
        </h3>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {actions.slice(0, 3).map((action) => (
          <Button key={action.href} asChild variant="secondary" size="sm" className="h-9">
            <Link href={action.href}>{action.label}</Link>
          </Button>
        ))}
        {actions.length > 3 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" variant="ghost" size="sm" className="h-9 gap-1">
                More <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {actions.slice(3).map((action) => (
                <DropdownMenuItem key={action.href} asChild>
                  <Link href={action.href}>{action.label}</Link>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </section>
  );
}

export function ResultPanel({ result, error, nextActions = [] }: ResultPanelProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const resultTitleId = useId();
  const fullscreenTitleId = useId();
  const fullscreenCloseRef = useRef<HTMLButtonElement>(null);

  const selectedUrl =
    result.status === "done" && result.outputUrls.length > 0
      ? result.outputUrls[Math.min(selectedIndex, result.outputUrls.length - 1)]
      : null;

  useEffect(() => {
    if (!isFullscreen) return;

    const previousOverflow = document.body.style.overflow;
    const previouslyFocusedElement =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const focusFrame = window.requestAnimationFrame(() => fullscreenCloseRef.current?.focus());

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsFullscreen(false);
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
      previouslyFocusedElement?.focus();
    };
  }, [isFullscreen]);

  useEffect(() => {
    if (result.status !== "done") {
      setSelectedIndex(0);
      setIsFullscreen(false);
      return;
    }
    setSelectedIndex((current) => Math.min(current, Math.max(result.outputUrls.length - 1, 0)));
  }, [result]);

  const renderMedia = (fullscreen = false) => {
    if (result.status !== "done" || !selectedUrl) return null;

    if (result.kind === "video") {
      return (
        <video
          key={selectedUrl}
          src={selectedUrl}
          controls
          playsInline
          aria-label="Video preview"
          className={cn(
            "w-full bg-black object-contain",
            fullscreen ? "max-h-[calc(100vh-7rem)]" : "max-h-[70vh]",
          )}
        />
      );
    }

    if (result.beforeUrl) {
      return (
        <div className={cn("w-full", fullscreen && "max-w-[min(94vw,1800px)]")}>
          <CompareSlider
            beforeSrc={result.beforeUrl}
            afterSrc={selectedUrl}
            beforeLabel="Original"
            afterLabel="Result"
          />
        </div>
      );
    }

    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={selectedUrl}
        alt="Generated result"
        className={cn(
          "w-full object-contain",
          fullscreen ? "max-h-[calc(100vh-7rem)] max-w-[96vw]" : "max-h-[72vh]",
        )}
      />
    );
  };

  const helper =
    result.status === "done" && result.kind === "image" && result.beforeUrl
      ? "Compare the generated result with the original using the divider."
      : result.status === "busy"
        ? STAGE_LABELS[result.stage ?? ""] ?? "Working on it"
        : null;

  const handleFullscreenKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Tab") return;

    const focusable = Array.from(
      event.currentTarget.querySelectorAll<HTMLElement>(
        'button:not([disabled]), video[controls], [role="slider"][tabindex="0"]',
      ),
    );
    if (focusable.length === 0) {
      event.preventDefault();
      return;
    }

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

  return (
    <>
      <Card className="min-w-0 overflow-hidden" aria-labelledby={resultTitleId} aria-busy={result.status === "busy"}>
        <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0 pb-3">
          <div className="min-w-0">
            <CardTitle id={resultTitleId} className="text-sm font-semibold">
              {result.status === "done" && result.kind === "video"
                ? "Video preview"
                : result.status === "done"
                  ? "Result"
                  : "Preview"}
            </CardTitle>
            {helper && <p className="mt-1 text-xs text-muted-foreground">{helper}</p>}
          </div>
        </CardHeader>

        <CardContent className="flex min-w-0 flex-col gap-3">
          {error ? (
            <div role="alert" className="flex aspect-[4/3] min-h-[320px] w-full flex-col items-center justify-center gap-2 rounded-lg border border-destructive/25 bg-destructive/5 p-6 text-center sm:min-h-[400px] lg:min-h-[480px]">
              <p className="text-sm font-semibold">Unable to generate this result.</p>
              <p className="max-w-md text-sm text-muted-foreground">{error}</p>
              <p className="text-xs text-muted-foreground">Review the inputs, then use Generate to try again.</p>
            </div>
          ) : result.status === "busy" ? (
            <div className="flex aspect-[4/3] min-h-[320px] w-full flex-col items-center justify-center gap-4 rounded-lg border bg-muted/20 p-4 sm:min-h-[400px] lg:min-h-[480px]" role="status" aria-live="polite" aria-label={helper ?? "Generating result"}>
              <Skeleton aria-hidden="true" className="aspect-[4/3] w-full max-w-3xl rounded-lg" />
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                {STAGE_LABELS[result.stage ?? ""] ?? "Working on it"}
              </p>
            </div>
          ) : result.status === "idle" ? (
            <div className="flex aspect-[4/3] min-h-[320px] w-full items-center justify-center rounded-lg border border-dashed bg-muted/20 p-6 text-center sm:min-h-[400px] lg:min-h-[480px]">
              <div className="max-w-sm space-y-2">
                <p className="text-sm font-medium">Your result will appear here.</p>
                <p className="text-xs leading-relaxed text-muted-foreground">Choose a source or describe an image, then use Generate to preview the output.</p>
              </div>
            </div>
          ) : result.outputUrls.length === 0 ? (
            <div className="flex aspect-[4/3] min-h-[320px] w-full items-center justify-center rounded-lg border border-dashed bg-muted/20 p-6 text-center sm:min-h-[400px] lg:min-h-[480px]" role="status">
              <p className="max-w-sm text-sm text-muted-foreground">Generation finished, but no preview URL was returned. Try generating again.</p>
            </div>
          ) : selectedUrl ? (
            <>
              <div className="flex aspect-[4/3] min-h-[320px] w-full items-center justify-center overflow-hidden rounded-lg border bg-muted/20 p-1 sm:min-h-[400px] lg:min-h-[480px]" aria-label="Generated media preview">
                {renderMedia()}
              </div>

              {result.kind === "image" && result.outputUrls.length > 1 && (
                <div className="flex gap-2 overflow-x-auto pb-1" role="group" aria-label="Result variations">
                  {result.outputUrls.map((url, index) => {
                    const isSelected = index === selectedIndex;
                    return (
                      <button
                        key={`${url}-${index}`}
                        type="button"
                        aria-label={`Show variation ${index + 1} of ${result.outputUrls.length}`}
                        aria-pressed={isSelected}
                        onClick={() => setSelectedIndex(index)}
                        className={cn(
                          "relative h-16 w-16 shrink-0 overflow-hidden rounded-md border-2 bg-muted transition-colors",
                          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                          isSelected
                            ? "border-primary ring-1 ring-primary"
                            : "border-transparent hover:border-muted-foreground/40",
                        )}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={url} alt="" className="h-full w-full object-cover" loading="lazy" />
                        {isSelected && (
                          <span className="absolute inset-x-0 bottom-0 bg-primary px-1 py-0.5 text-[9px] font-medium text-primary-foreground">
                            Selected
                          </span>
                        )}
                      </button>
                    );
                  })}
                  <span className="sr-only" aria-live="polite" aria-atomic="true">
                    Showing variation {selectedIndex + 1} of {result.outputUrls.length}.
                  </span>
                </div>
              )}

              <div className="flex flex-wrap items-center justify-end gap-2 border-t pt-3">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-10"
                  aria-label={`Download ${result.kind === "video" ? "video" : "image"} result`}
                  onClick={() => void saveResult(selectedUrl, result.kind)}
                >
                  <Download className="mr-2 h-4 w-4" aria-hidden="true" />
                  Download
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-10"
                  onClick={() => setIsFullscreen(true)}
                  aria-label="Open fullscreen preview"
                >
                  <Expand className="mr-2 h-4 w-4" aria-hidden="true" />
                  Fullscreen
                </Button>
              </div>
              {result.kind === "image" && <NextActions actions={nextActions} />}
            </>
          ) : (
            <div className="flex aspect-[4/3] min-h-[320px] w-full items-center justify-center rounded-lg border border-dashed bg-muted/20 p-6 text-center sm:min-h-[400px] lg:min-h-[480px]">
              <p className="text-sm text-muted-foreground">
                {result.kind === "video" ? "Your video result will appear here." : "Your image result will appear here."}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {isFullscreen && selectedUrl && result.status === "done" && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby={fullscreenTitleId}
          tabIndex={-1}
          onKeyDown={handleFullscreenKeyDown}
          className="fixed inset-0 z-[100] flex flex-col bg-black/95 p-3 text-white outline-none sm:p-5"
        >
          <div className="flex shrink-0 items-center justify-between gap-3 pb-3">
            <span id={fullscreenTitleId} className="truncate text-sm font-medium">
              {result.kind === "video" ? "Video preview" : "Image preview"}
            </span>
            <Button
              ref={fullscreenCloseRef}
              type="button"
              variant="secondary"
              size="sm"
              className="h-10 gap-2"
              onClick={() => setIsFullscreen(false)}
              aria-label="Close fullscreen preview"
            >
              <Minimize2 className="h-4 w-4" aria-hidden="true" />
              Close
            </Button>
          </div>
          <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto">
            {renderMedia(true)}
          </div>
        </div>
      )}
    </>
  );
}
