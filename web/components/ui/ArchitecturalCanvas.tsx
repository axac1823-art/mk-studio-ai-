
import Image from "next/image";
import { ACCENT, PRECOMPUTED_GLAZING, PRECOMPUTED_SLABS, PRECOMPUTED_VOLUMES, VILLA_VOLUMES, VILLA_WALLS } from "./geometry";

interface ArchitecturalCanvasProps {
  planRef: React.RefObject<SVGGElement>;
  extrusionRef: React.RefObject<SVGGElement>;
  scanlineRef: React.RefObject<SVGLineElement>;
  finalRenderRef: React.RefObject<HTMLDivElement>;
  stageRef: React.RefObject<HTMLSpanElement>;
}

export default function ArchitecturalCanvas({
  planRef,
  extrusionRef,
  scanlineRef,
  finalRenderRef,
  stageRef,
}: ArchitecturalCanvasProps) {
  return (
    <div
      className="
        order-1
        relative
        flex
        h-[min(45vh,420px)]
        min-h-[300px]
        w-full
        items-center
        justify-center
        overflow-hidden
        rounded-[24px]
        border
        border-black/[0.08]
        bg-white/65
        shadow-[0_30px_80px_rgba(15,23,42,0.08)]
        backdrop-blur-xl
        dark:border-white/[0.10]
        dark:bg-[#0F1013]
        dark:shadow-[0_30px_80px_rgba(0,0,0,0.32)]
        sm:h-[min(55vh,520px)]
        md:h-[min(65vh,600px)]
        lg:order-2
        lg:col-span-8
        lg:h-[min(70vh,640px)]
      "
    >
      <div
        className="pointer-events-none absolute inset-0 rounded-[24px]"
        style={{
          boxShadow: `inset 0 0 90px hsla(189.16,79.17%,47.06%,0.035)`,
        }}
      />

      <div className="absolute left-4 top-4 z-30 h-4 w-4 border-l-2 border-t-2 border-black/20 dark:border-white/30" />
      <div className="absolute right-4 top-4 z-30 h-4 w-4 border-r-2 border-t-2 border-black/20 dark:border-white/30" />
      <div className="absolute bottom-4 left-4 z-30 h-4 w-4 border-b-2 border-l-2 border-black/15 dark:border-white/25" />
      <div className="absolute bottom-4 right-4 z-30 h-4 w-4 border-b-2 border-r-2 border-black/15 dark:border-white/25" />

      <svg
        viewBox="0 0 700 500"
        className="absolute inset-0 z-10 h-full w-full object-contain p-4"
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          <pattern
            id="archHatch"
            width="8"
            height="8"
            patternTransform="rotate(45 0 0)"
            patternUnits="userSpaceOnUse"
          >
            <line
              x1="0"
              y1="0"
              x2="0"
              y2="8"
              stroke="var(--how-line)"
              strokeWidth="0.8"
              strokeOpacity="0.6"
            />
          </pattern>

          <linearGradient id="wallTopGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="var(--how-wall-top)" />
            <stop offset="100%" stopColor="var(--how-room)" />
          </linearGradient>

          <linearGradient id="wallSideGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="var(--how-wall-left)" />
            <stop offset="100%" stopColor="var(--how-wall-right)" />
          </linearGradient>

          <linearGradient id="glassGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="var(--how-glass)" stopOpacity="0.42" />
            <stop offset="100%" stopColor="var(--how-glass)" stopOpacity="0.08" />
          </linearGradient>
        </defs>

        {/* STAGE 01 — 2D PLAN */}
        <g ref={planRef} className="origin-center">
          <rect
            x="40"
            y="60"
            width="600"
            height="380"
            fill="var(--how-plan-bg)"
            stroke="var(--how-line)"
            strokeWidth="1"
            rx="4"
          />

          <rect
            x="40"
            y="60"
            width="600"
            height="380"
            fill="url(#archHatch)"
          />

          {[100, 200, 300, 400, 500, 600].map((x) => (
            <line
              key={`gx-${x}`}
              x1={x}
              y1="40"
              x2={x}
              y2="460"
              stroke="var(--how-grid)"
              strokeWidth="1"
              strokeDasharray="4 4"
            />
          ))}

          {[100, 200, 300, 400].map((y) => (
            <line
              key={`gy-${y}`}
              x1="20"
              y1={y}
              x2="660"
              y2={y}
              stroke="var(--how-grid)"
              strokeWidth="1"
              strokeDasharray="4 4"
            />
          ))}

          {VILLA_VOLUMES.map((vol) => (
            <g key={`plan-vol-${vol.id}`}>
              <rect
                x={vol.x}
                y={vol.y}
                width={vol.width}
                height={vol.depth}
                fill={
                  vol.type === "terrace"
                    ? "var(--how-terrace)"
                    : "var(--how-room)"
                }
                stroke="var(--how-line)"
                strokeWidth="1"
              />
            </g>
          ))}

          {VILLA_WALLS.map((wall) => (
            <line
              key={`plan-${wall.id}`}
              x1={wall.x1}
              y1={wall.y1}
              x2={wall.x2}
              y2={wall.y2}
              stroke={
                wall.isExterior
                  ? "var(--how-line-strong)"
                  : "var(--how-line)"
              }
              strokeWidth={wall.thickness}
              strokeLinecap="square"
            />
          ))}

          <g transform="translate(390, 80)">
            {[15, 30, 45, 60, 75, 90, 105, 120, 135].map((sY) => (
              <line
                key={`stair-${sY}`}
                x1="10"
                y1={sY}
                x2="80"
                y2={sY}
                stroke="var(--how-line)"
                strokeWidth="1"
              />
            ))}

            <path
              d="M 45 140 L 45 20 M 40 25 L 45 20 L 50 25"
              stroke="var(--how-glass)"
              strokeWidth="1.5"
              fill="none"
            />
          </g>

          <path
            d="M 210 290 A 40 40 0 0 1 250 330"
            stroke="var(--how-glass)"
            strokeWidth="1"
            fill="none"
            strokeDasharray="2 2"
          />

          <path
            d="M 350 290 A 40 40 0 0 1 390 330"
            stroke="var(--how-glass)"
            strokeWidth="1"
            fill="none"
            strokeDasharray="2 2"
          />

          <line
            ref={scanlineRef}
            x1="30"
            y1="20"
            x2="670"
            y2="20"
            stroke="var(--how-glass)"
            strokeWidth="2"
            style={{
              filter: `drop-shadow(0 0 8px ${ACCENT})`,
            }}
          />
        </g>

        {/* STAGE 02 + 03 — 3D EXTRUSION */}
        <g ref={extrusionRef} className="origin-center">
          {PRECOMPUTED_SLABS.map((slab) => (
            <g key={`slab-${slab.id}`} className="volume-slab">
              <path d={slab.paths.top} fill="var(--how-wall-top)" stroke="var(--how-line)" strokeWidth="0.75" />
              <path d={slab.paths.left} fill="var(--how-wall-left)" stroke="var(--how-line)" strokeWidth="0.75" />
              <path d={slab.paths.right} fill="var(--how-wall-right)" stroke="var(--how-line)" strokeWidth="0.75" />
            </g>
          ))}

          {PRECOMPUTED_VOLUMES.map((volume) => {
            const isUpper = volume.elevation > 0;

            return (
              <g
                key={`ext-${volume.id}`}
                className={`volume-wall ${isUpper ? "volume-cantilever" : ""}`}
              >
                <path d={volume.paths.top} fill="url(#wallTopGrad)" stroke="var(--how-line-strong)" strokeWidth="0.75" />
                <path d={volume.paths.left} fill="url(#wallSideGrad)" stroke="var(--how-line)" strokeWidth="0.75" />
                <path d={volume.paths.right} fill="var(--how-wall-right)" stroke="var(--how-line)" strokeWidth="0.75" />
              </g>
            );
          })}

          {PRECOMPUTED_GLAZING.map((volume) => (
            <g key={`glazing-${volume.id}`} className="volume-glazing">
              <path
                d={volume.paths.right}
                fill="url(#glassGrad)"
                stroke="var(--how-glass)"
                strokeOpacity="0.65"
                strokeWidth="1"
              />
            </g>
          ))}
        </g>
      </svg>

      {/* STAGE 04 — FINAL RENDER */}
      <div
        ref={finalRenderRef}
        className="pointer-events-none absolute inset-0 z-20 h-full w-full"
      >
        <Image
          src="/appartment.webp"
          alt="Contemporary apartment architectural visualization"
          fill
          sizes="(max-width: 768px) 100vw, 840px"
          className="object-cover"
        />

        <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent dark:from-[#0B0C0E]/75" />
        <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-black/10 to-transparent dark:from-black/20" />
      </div>

      <div
        className="
          absolute
          bottom-4
          left-4
          right-4
          z-30
          flex
          items-center
          justify-between
          rounded-b-lg
          border-t
          border-black/[0.08]
          bg-white/72
          px-3
          pt-3
          font-mono
          text-[9px]
          text-black/45
          backdrop-blur-md
          dark:border-white/[0.10]
          dark:bg-[#0B0C0E]/80
          dark:text-white/40
          sm:left-6
          sm:right-6
          sm:text-xs
        "
      >
        <div className="flex items-center gap-2">
          <span
            className="h-2 w-2 animate-pulse rounded-full"
            style={{
              backgroundColor: ACCENT,
              boxShadow: "0 0 10px hsla(189.16,79.17%,47.06%,0.7)",
            }}
          />
          <span>
            COORD: 31&#176;37&apos;50.2&quot;N 8&#176;00&apos;42.1&quot;W
          </span>
        </div>

        <div className="hidden sm:block">SCALE 1:100 @ A1</div>

        <div className="font-semibold text-[hsl(189.16deg_79.17%_47.06%)]">
          <span ref={stageRef}>STAGE 01 / 04</span>
        </div>
      </div>

      <div
        className="
          absolute
          left-6
          top-6
          z-30
          hidden
          rounded-full
          border
          border-black/[0.08]
          bg-white/65
          px-3
          py-1.5
          font-mono
          text-[8px]
          uppercase
          tracking-[0.2em]
          text-black/40
          backdrop-blur-md
          dark:border-white/[0.08]
          dark:bg-black/25
          dark:text-white/35
          sm:block
        "
      >
        Spatial Transformation
      </div>
    </div>
  );
}
