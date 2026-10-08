"use client";

import { useEffect, useState } from "react";
import { Download, Expand, Loader2, Minimize2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { CompareSlider } from "@/components/compare-slider";
import { saveResult } from "@/lib/download";
import { cn } from "@/lib/utils";

export type ResultState =
  | { status: "idle" }
  | { status: "busy"; stage?: string }
  | {
      status: "done";
      kind: "image" | "video";
      beforeUrl: string | null;
      outputUrls: string[];
    };

const STAGE_LABELS: Record<string, string> = {
  render: "Generating your render",
  upscaling: "Upscaling to your selected resolution",
  video: "Generating the video",
  narration: "Creating the narration",
  merging: "Assembling the final video",
};

interface ResultPanelProps {
  result: ResultState;
  error?: string | null;
}

function StageFrame({
  children,
  fullscreen = false,
}: {
  children: React.ReactNode;
  fullscreen?: boolean;
}) {
  return (
    <div
      className={cn(
        "relative flex min-h-[320px] w-full items-center justify-center overflow-hidden rounded-xl border bg-muted/30",
        fullscreen && "h-full min-h-0 rounded-none border-0 bg-black",
      )}
    >
      {children}
    </div>
  );
}

export function ResultPanel({ result, error }: ResultPanelProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const selectedUrl =
    result.status === "done" && result.outputUrls.length > 0
      ? result.outputUrls[Math.min(selectedIndex, result.outputUrls.length - 1)]
      : null;

  useEffect(() => {
    if (!isFullscreen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsFullscreen(false);
    };

    window.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
    };
  }, [isFullscreen]);

  useEffect(() => {
    if (result.status === "done") {
      setSelectedIndex((current) =>
        Math.min(current, Math.max(result.outputUrls.length - 1, 0)),
      );
    } else {
      setSelectedIndex(0);
    }
  }, [result]);

  const heading =
    result.status === "busy"
      ? "Preview"
      : result.status === "done" && result.kind === "video"
        ? "Video Preview"
        : result.status === "done"
          ? "Result"
          : "Preview";

  const helper =
    result.status === "done" && result.kind === "image" && result.beforeUrl
      ? "Compare with the original."
      : result.status === "busy"
        ? STAGE_LABELS[result.stage ?? ""] ?? "Working on it"
        : null;

  const content = (
    <>
      <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0 px-4 py-3 sm:px-5">
        <div className="min-w-0">
          <CardTitle className="text-sm font-semibold">{heading}</CardTitle>
          {helper && (
            <p className="mt-0.5 text-xs text-muted-foreground">{helper}</p>
          )}
        </div>

        {isFullscreen && (
          <Button
            type="button"
            variant="secondary"
            size="icon"
            className="absolute right-4 top-4 z-20 h-9 w-9"
            onClick={() => setIsFullscreen(false)}
            aria-label="Close fullscreen preview"
            title="Close fullscreen"
          >
            <Minimize2 className="h-4 w-4" />
          </Button>
        )}
      </CardHeader>

      <CardContent className="px-4 pb-4 pt-0 sm:px-5 sm:pb-5">
        {error ? (
          <StageFrame fullscreen={isFullscreen}>
            <div className="max-w-sm px-6 text-center">
              <p className="text-sm font-semibold">Unable to generate this result.</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">{error}</p>
              <p className="mt-3 text-xs text-muted-foreground">
                Use the generation controls in this workspace to try again.
              </p>
            </div>
          </StageFrame>
        ) : result.status === "idle" ? (
          <StageFrame fullscreen={isFullscreen}>
            <div className="px-6 text-center">
              <p className="text-sm font-medium text-muted-foreground">
                Your result will appear here.
              </p>
            </div>
          </StageFrame>
        ) : result.status === "busy" ? (
          <StageFrame fullscreen={isFullscreen}>
            <div className="flex w-full max-w-md flex-col items-center gap-4 px-6 text-center">
              <Skeleton className="aspect-[4/3] w-full rounded-lg" />
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                {STAGE_LABELS[result.stage ?? ""] ?? "Working on it"}
              </p>
            </div>
          </StageFrame>
        ) : result.kind === "video" ? (
          <>
            <StageFrame fullscreen={isFullscreen}>
              <video
                key={selectedUrl ?? result.outputUrls[0]}
                src={selectedUrl ?? result.outputUrls[0]}
                controls
                playsInline
                className="max-h-[70vh] w-full object-contain"
              />
            </StageFrame>
            {selectedUrl && (
              <div className="mt-3 flex items-center justify-end gap-2 border-t pt-3">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => void saveResult(selectedUrl, result.kind)}
                >
                  <Download className="mr-2 h-4 w-4" />
                  Download
                </Button>
                {!isFullscreen && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setIsFullscreen(true)}
                  >
                    <Expand className="mr-2 h-4 w-4" />
                    Fullscreen
                  </Button>
                )}
              </div>
            )}
          </>
        ) : (
          <>
            <StageFrame fullscreen={isFullscreen}>
              {result.beforeUrl ? (
                <div className="w-full">
                  <CompareSlider
                    beforeSrc={result.beforeUrl}
                    afterSrc={selectedUrl ?? result.outputUrls[0]}
                    afterLabel="Render"
                  />
                </div>
              ) : (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={selectedUrl ?? result.outputUrls[0]}
                  alt="Generated render"
                  className="max-h-[72vh] w-full object-contain"
                />
              )}
            </StageFrame>

            {result.outputUrls.length > 1 && (
              <div className="mt-3 flex gap-2 overflow-x-auto pb-1" aria-label="Variations">
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
                    <img
                      src={url}
                      alt={`Variation ${index + 1}`}
                      className="h-full w-full object-cover"
                    />
                  </button>
                ))}
              </div>
            )}

            {selectedUrl && (
              <div className="mt-3 flex items-center justify-end gap-2 border-t pt-3">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => void saveResult(selectedUrl, result.kind)}
                >
                  <Download className="mr-2 h-4 w-4" />
                  Download
                </Button>
                {!isFullscreen && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setIsFullscreen(true)}
                  >
                    <Expand className="mr-2 h-4 w-4" />
                    Fullscreen
                  </Button>
                )}
              </div>
            )}
          </>
        )}
      </CardContent>
    </>
  );

  return (
    <Card className={cn("overflow-hidden", isFullscreen && "fixed inset-0 z-[100] h-screen w-screen rounded-none border-0 bg-black")}>
      {isFullscreen ? (
        <div className="flex h-full flex-col">
          <div className="flex-1 overflow-auto">{content}</div>
        </div>
      ) : (
        content
      )}
    </Card>
  );
}