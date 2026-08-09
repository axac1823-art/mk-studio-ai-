"use client";

import { useEffect, useState } from "react";
import { Box } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  AUTH_SHOWCASE_ITEMS,
  AUTH_SHOWCASE_ROTATION_INTERVAL_MS,
  type ShowcaseItem,
} from "@/config/auth-showcase";

interface AuthShowcasePanelProps {
  items?: ShowcaseItem[];
  intervalMs?: number;
}

export function AuthShowcasePanel({
  items = AUTH_SHOWCASE_ITEMS,
  intervalMs = AUTH_SHOWCASE_ROTATION_INTERVAL_MS,
}: AuthShowcasePanelProps) {
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    if (items.length <= 1) return;
    const timer = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % items.length);
    }, intervalMs);
    return () => clearInterval(timer);
  }, [items.length, intervalMs]);

  const activeItem = items[activeIndex];

  return (
    <div className="relative hidden h-full w-full overflow-hidden bg-black md:flex md:w-[45%]">
      {/* Full-bleed media stack with crossfade */}
      {items.map((item, index) => (
        <div
          key={item.label}
          className={cn(
            "absolute inset-0 transition-opacity duration-1000 ease-in-out",
            index === activeIndex ? "opacity-100" : "opacity-0"
          )}
        >
          {item.mediaType === "video" ? (
            <video
              src={item.mediaUrl}
              autoPlay
              muted
              loop
              playsInline
              className="h-full w-full object-cover"
            />
          ) : (
            <img
              src={item.mediaUrl}
              alt={item.headline}
              className="h-full w-full object-cover"
            />
          )}
          {/* Dark gradient overlay for text readability */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-black/30" />
        </div>
      ))}

      {/* Top-left logo mark */}
      <div className="absolute left-6 top-6 flex items-center gap-2 text-white">
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-white/10 backdrop-blur-sm">
          <Box className="h-5 w-5" strokeWidth={2} />
        </div>
        <span className="text-sm font-semibold tracking-tight">RenderStudio</span>
      </div>

      {/* Bottom-left text overlay */}
      <div className="absolute bottom-20 left-6 right-6 text-white">
        <h2 className="max-w-md text-2xl font-semibold leading-tight tracking-tight">
          {activeItem.headline}
        </h2>
        <p className="mt-2 max-w-md text-sm text-white/80">{activeItem.subtext}</p>
      </div>

      {/* Category labels with progress underlines */}
      <div className="absolute bottom-6 left-6 right-6">
        <div className="flex items-center gap-4">
          {items.map((item, index) => {
            const isActive = index === activeIndex;
            return (
              <button
                key={item.label}
                type="button"
                onClick={() => setActiveIndex(index)}
                className="group flex flex-col items-start gap-1.5"
                aria-label={`Show ${item.label}`}
              >
                <span
                  className={cn(
                    "text-xs font-medium uppercase tracking-wider transition-colors",
                    isActive ? "text-white" : "text-white/60 group-hover:text-white/90"
                  )}
                >
                  {item.label}
                </span>
                <span className="h-0.5 w-12 overflow-hidden rounded-full bg-white/20">
                  <span
                    className={cn(
                      "block h-full rounded-full bg-white transition-all duration-500",
                      isActive ? "w-full" : "w-0"
                    )}
                  />
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
