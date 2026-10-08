"use client";

import { useEffect, useMemo, useState } from "react";

const BRAND_CYAN = "hsl(189.16deg 79.17% 47.06%)";

const WORKFLOW_ITEMS = [
  "Build workflows",
  "Video upscaling",
  "Direct photoshoots",
  "Cast characters",
  "Stay on brand",
  "Upscale to 4K",
  "Draft storyboards",
  "Scale campaigns",
  "Generate images",
  "Shoot cinematic videos",
];

export function HeroWorkflowList() {
  const [activeIndex, setActiveIndex] = useState(9);

  const items = useMemo(
    () => [
      ...WORKFLOW_ITEMS,
      ...WORKFLOW_ITEMS,
      ...WORKFLOW_ITEMS,
    ],
    []
  );

  useEffect(() => {
    const media = window.matchMedia("(min-width: 1024px)");

    if (!media.matches) {
      return;
    }

    const interval = window.setInterval(() => {
      setActiveIndex((current) => {
        const next = current + 1;

        if (next >= WORKFLOW_ITEMS.length * 2) {
          return WORKFLOW_ITEMS.length;
        }

        return next;
      });
    }, 1800);

    return () => window.clearInterval(interval);
  }, []);

  return (
    <div className="relative hidden gap-4 lg:flex">
      {/* Arrow */}
      <div
        className="relative flex shrink-0 flex-col items-center justify-center"
        style={{ height: 420 }}
      >
        <div className="absolute left-1/2 top-8 bottom-8 w-px -translate-x-1/2 bg-gradient-to-b from-transparent via-cyan-300/25 to-transparent" />

        <svg
          width="28"
          height="28"
          viewBox="0 0 24 24"
          aria-hidden="true"
          className="relative z-10 text-cyan-300"
        >
          <polygon
            points="4,2 22,12 4,22"
            fill="currentColor"
          />
        </svg>
      </div>

      {/* Animated list */}
      <div
        className="
          relative
          overflow-hidden
          rounded-[26px]
          border
          border-white/[0.10]
          shadow-[0_30px_80px_rgba(0,0,0,.25)]
          backdrop-blur-[2px]
          dark:border-white/[0.10]
        "
        style={{
          height: 420,
          width: 420,
        }}
      >
        {/* Inner border */}
        <div className="pointer-events-none absolute inset-2 z-20 rounded-[22px] border border-white/[0.045]" />

        {/* Top glow */}
        <div
          className="pointer-events-none absolute left-10 right-10 top-0 z-20 h-px"
          style={{
            background:
              "linear-gradient(90deg, transparent, rgba(103,232,249,.75), transparent)",
          }}
        />

        {/* Grid */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.13]"
          style={{
            backgroundImage: `
              linear-gradient(rgba(255,255,255,.14) 1px, transparent 1px),
              linear-gradient(90deg, rgba(255,255,255,.14) 1px, transparent 1px)
            `,
            backgroundSize: "48px 48px",
            maskImage:
              "linear-gradient(to bottom, transparent, black 16%, black 84%, transparent)",
            WebkitMaskImage:
              "linear-gradient(to bottom, transparent, black 16%, black 84%, transparent)",
          }}
        />

        <div
          className="pointer-events-none absolute inset-0 opacity-[0.04]"
          style={{
            background:
              "radial-gradient(circle at 50% 50%, rgba(103,232,249,.9), transparent 68%)",
          }}
        />

        {/* Header */}
        <div className="absolute left-6 right-6 top-5 z-30 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span
              className="h-1.5 w-1.5 rounded-full"
              style={{
                background: BRAND_CYAN,
                boxShadow:
                  "0 0 12px rgba(103,232,249,.75)",
              }}
            />

            <span className="font-mono text-[8px] font-semibold uppercase tracking-[0.28em] text-white/50">
              Creative Engine
            </span>
          </div>

          <span className="font-mono text-[8px] uppercase tracking-[0.20em] text-white/25">
            LIVE
          </span>
        </div>

        {/* List */}
        <div
          className="absolute inset-x-0 top-0"
          style={{
            transform: `translateY(${180 - activeIndex * 60}px)`,
            transition: "transform 700ms ease",
          }}
        >
          {items.map((item, index) => {
            const distance = Math.abs(index - activeIndex);

            let opacity = 0.1;
            let scale = 0.96;

            if (distance === 0) {
              opacity = 1;
              scale = 1;
            } else if (distance === 1) {
              opacity = 0.48;
              scale = 0.985;
            } else if (distance === 2) {
              opacity = 0.30;
              scale = 0.975;
            } else if (distance === 3) {
              opacity = 0.20;
            }

            return (
              <div
                key={`${item}-${index}`}
                className="relative flex items-center px-6"
                style={{
                  height: 60,
                }}
              >
                <div
                  aria-hidden="true"
                  className="absolute left-0 flex items-center"
                >
                  <span
                    className="h-px w-8"
                    style={{}}
                  />

                  <span
                    className="ml-1 h-1.5 w-1.5 rounded-full"
                    style={{
                      background:
                        distance === 0
                          ? BRAND_CYAN
                          : "rgba(255,255,255,.18)",
                      boxShadow:
                        distance === 0
                          ? "0 0 8px rgba(103,232,249,.65)"
                          : undefined,
                    }}
                  />
                </div>

                <span
                  className="
                    whitespace-nowrap
                    pl-10
                    text-3xl
                    font-bold
                    tracking-[-0.035em]
                    text-white
                  "
                  style={{
                    opacity,
                    transform: `scale(${scale})`,
                    transformOrigin: "left center",
                    transition:
                      "opacity 500ms ease, transform 500ms ease",
                  }}
                >
                  {item}
                </span>

                {distance === 0 && (
                  <span className="absolute right-6 font-mono text-[9px] uppercase tracking-[0.18em] text-cyan-300/80">
                    ACTIVE
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {/* Bottom fade */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 h-32 bg-gradient-to-t from-black/75 via-black/45 to-transparent" />

        {/* Bottom info */}
        <div className="absolute bottom-5 left-6 right-6 z-30 flex items-center justify-between">
          <span className="font-mono text-[7px] uppercase tracking-[0.22em] text-white/25">
            Intelligent routing
          </span>

          <div className="flex items-center gap-2">
            <span className="font-mono text-[7px] text-white/25">
              10
            </span>

            <span
              className="h-1 w-8 rounded-full"
              style={{
                background:
                  "linear-gradient(90deg, transparent, rgba(103,232,249,.65))",
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
