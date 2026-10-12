"use client";

import { useEffect, useState } from "react";
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
  if (actions.length === 0) return null;

  return (
    <section className="mt-1 border-t pt-3" aria-labelledby="next-actions-heading">
      <div className="mb-2">
        <h3 id="next-actions-heading" className="text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">
          What next?
        </h3>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {actions.slice(0, 3).map((action) => (
          <Button key={action.href} asChild variant="secondary" size="sm" className="h-8">
            <Link href={action.href}>{action.label}</Link>
          </Button>
        ))}
        {actions.length > 3 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" variant="ghost" size="sm" className="h-8 gap-1">
                More <MoreHorizontal className="h-4 w-4" />
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

  const selectedUrl =
    result.status === "done" && result.outputUrls.length > 0
      ? result.outputUrls[Math.min(selectedIndex, result.outputUrls.length - 1)]
      : null;

  useEffect(() => {
    if (!isFullscreen) return;

    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsFullscreen(false);
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
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
          aria-label="Video Preview"
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
            afterLabel="Render"
          />
        </div>
      );
    }

    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={selectedUrl}
        alt="Generated render"
        className={cn(
          "w-full object-contain",
          fullscreen ? "max-h-[calc(100vh-7rem)] max-w-[96vw]" : "max-h-[72vh]",
        )}
      />
    );
  };

  const helper =
    result.status === "done" && result.kind === "image" && result.beforeUrl
      ? "Compare with the original."
      : result.status === "busy"
        ? STAGE_LABELS[result.stage ?? ""] ?? "Working on it"
        : null;

  return (
    <>
      <Card className="min-w-0 overflow-hidden">
        <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0 pb-3">
          <div className="min-w-0">
            <CardTitle className="text-sm font-semibold">
              {result.status === "done" && result.kind === "video" ? "Video Preview" : result.status === "done" ? "Result" : "Preview"}
            </CardTitle>
            {helper && <p className="mt-1 text-xs text-muted-foreground">{helper}</p>}
          </div>

        </CardHeader>

        <CardContent className="flex min-w-0 flex-col gap-3">
          {error ? (
            <div role="alert" className="flex aspect-[4/3] min-h-[320px] w-full flex-col items-center justify-center gap-2 rounded-lg border border-destructive/25 bg-destructive/5 p-6 text-center sm:min-h-[400px] lg:min-h-[480px]">
              <p className="text-sm font-semibold">Unable to generate this result.</p>
              <p className="max-w-md text-sm text-muted-foreground">{error}</p>
              <p className="text-xs text-muted-foreground">Use the generation controls in this workspace to try again.</p>
            </div>
          ) : result.status === "busy" ? (
            <div className="flex aspect-[4/3] min-h-[320px] w-full flex-col items-center justify-center gap-4 rounded-lg border bg-muted/20 p-4 sm:min-h-[400px] lg:min-h-[480px]">
              <Skeleton className="aspect-[4/3] w-full max-w-3xl rounded-lg" />
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                {STAGE_LABELS[result.stage ?? ""] ?? "Working on it"}
              </p>
            </div>
          ) : result.status === "idle" ? (
            <div className="flex aspect-[4/3] min-h-[320px] w-full items-center justify-center rounded-lg border border-dashed bg-muted/20 p-6 text-center sm:min-h-[400px] lg:min-h-[480px]">
              <p className="text-sm text-muted-foreground">Your result will appear here.</p>
            </div>
          ) : selectedUrl ? (
            <>
              <div className="flex aspect-[4/3] min-h-[320px] w-full items-center justify-center overflow-hidden rounded-lg border bg-muted/20 p-1 sm:min-h-[400px] lg:min-h-[480px]">
                {renderMedia()}
              </div>

              {result.kind === "image" && result.outputUrls.length > 1 && (
                <div className="flex gap-2 overflow-x-auto pb-1" aria-label="Image variations">
                  {result.outputUrls.map((url, index) => (
                    <button
                      key={url}
                      type="button"
                      aria-label={`Variation ${index + 1}`}
                      aria-pressed={index === selectedIndex}
                      onClick={() => setSelectedIndex(index)}
                      className={cn(
                        "h-14 w-14 shrink-0 overflow-hidden rounded-md border-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                        index === selectedIndex
                          ? "border-primary ring-1 ring-primary"
                          : "border-transparent hover:border-muted-foreground/40",
                      )}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={url} alt="" className="h-full w-full object-cover" />
                    </button>
                  ))}
                </div>
              )}

              <div className="flex flex-wrap items-center justify-end gap-2 border-t pt-3">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => void saveResult(selectedUrl, result.kind)}
                >
                  <Download className="mr-2 h-4 w-4" />
                  Download
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsFullscreen(true)}
                >
                  <Expand className="mr-2 h-4 w-4" />
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
          aria-label="Fullscreen media preview"
          className="fixed inset-0 z-[100] flex flex-col bg-black/95 p-3 text-white sm:p-5"
        >
          <div className="flex shrink-0 items-center justify-between gap-3 pb-3">
            <span className="truncate text-sm font-medium">
              {result.kind === "video" ? "Video Preview" : "Image Preview"}
            </span>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="gap-2"
              onClick={() => setIsFullscreen(false)}
              aria-label="Close fullscreen preview"
            >
              <Minimize2 className="h-4 w-4" />
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