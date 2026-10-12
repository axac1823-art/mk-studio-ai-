"use client";

// Before/after comparison with pointer, touch, and keyboard support.
import { useCallback, useId, useRef, useState } from "react";
import { ChevronsLeftRight } from "lucide-react";

interface CompareSliderProps {
  beforeSrc: string;
  afterSrc: string;
  beforeLabel?: string;
  afterLabel?: string;
}

export function CompareSlider({
  beforeSrc,
  afterSrc,
  beforeLabel = "Before",
  afterLabel = "After",
}: CompareSliderProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const keyboardHelpId = useId();
  const [position, setPosition] = useState(50);

  const updateFromClientX = useCallback((clientX: number) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect || rect.width <= 0) return;
    const pct = ((clientX - rect.left) / rect.width) * 100;
    setPosition(Math.min(100, Math.max(0, pct)));
  }, []);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const step = event.shiftKey ? 10 : 2;
    let nextPosition: number | null = null;

    switch (event.key) {
      case "ArrowLeft":
      case "ArrowDown":
        nextPosition = position - step;
        break;
      case "ArrowRight":
      case "ArrowUp":
        nextPosition = position + step;
        break;
      case "Home":
        nextPosition = 0;
        break;
      case "End":
        nextPosition = 100;
        break;
      default:
        return;
    }

    event.preventDefault();
    setPosition(Math.min(100, Math.max(0, nextPosition)));
  };

  return (
    <div
      ref={containerRef}
      role="slider"
      tabIndex={0}
      aria-label="Before and after comparison divider"
      aria-orientation="horizontal"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(position)}
      aria-valuetext={`Divider ${Math.round(position)} percent from the left`}
      aria-describedby={keyboardHelpId}
      className="relative aspect-[4/3] w-full cursor-ew-resize touch-none select-none overflow-hidden rounded-lg border bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      onKeyDown={handleKeyDown}
      onPointerDown={(event) => {
        event.currentTarget.focus();
        event.currentTarget.setPointerCapture(event.pointerId);
        updateFromClientX(event.clientX);
      }}
      onPointerMove={(event) => {
        if (event.buttons === 1 || event.pointerType === "touch") {
          updateFromClientX(event.clientX);
        }
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={beforeSrc}
        alt={beforeLabel}
        draggable={false}
        className="absolute inset-0 h-full w-full object-contain"
      />
      <div
        className="absolute inset-0 [background-color:#e5e7eb] [background-image:linear-gradient(45deg,#cbd5e1_25%,transparent_25%),linear-gradient(-45deg,#cbd5e1_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#cbd5e1_75%),linear-gradient(-45deg,transparent_75%,#cbd5e1_75%)] [background-position:0_0,0_8px,8px_-8px,-8px_0] [background-size:16px_16px]"
        style={{ clipPath: `inset(0 0 0 ${position}%)` }}
        aria-hidden="true"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={afterSrc}
          alt=""
          draggable={false}
          className="absolute inset-0 h-full w-full object-contain"
        />
      </div>

      <div className="pointer-events-none absolute inset-y-0" style={{ left: `${position}%` }} aria-hidden="true">
        <div className="absolute inset-y-0 -left-px w-0.5 bg-white shadow-[0_0_8px_rgba(0,0,0,0.6)]" />
        <div className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white p-1.5 text-zinc-800 shadow-md">
          <ChevronsLeftRight className="h-4 w-4" />
        </div>
      </div>

      <span className="pointer-events-none absolute left-2 top-2 rounded bg-black/60 px-2 py-0.5 text-xs font-medium text-white" aria-hidden="true">
        {beforeLabel}
      </span>
      <span className="pointer-events-none absolute right-2 top-2 rounded bg-black/60 px-2 py-0.5 text-xs font-medium text-white" aria-hidden="true">
        {afterLabel}
      </span>
      <span id={keyboardHelpId} className="sr-only">
        Use the left and right arrow keys to move the divider. Hold Shift to move faster. Home and End move it to either edge.
      </span>
    </div>
  );
}
