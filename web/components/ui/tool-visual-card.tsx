"use client";

import { memo, useState } from "react";
import type { ToolDefinition } from "@/config/tools";
import { TOOL_PREVIEWS } from "@/components/ui/tool-previews";

type ToolVisualCardProps = {
  tool: ToolDefinition;
  variant: "rail";
  onClick?: () => void;
};

const ACCENT = "hsl(189.16deg 79.17% 47.06%)";

export const ToolVisualCard = memo(function ToolVisualCard({
  tool,
  onClick,
}: ToolVisualCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [isFocused, setIsFocused] = useState(false);

  const isPreviewActive = isHovered || isFocused;
  const Icon = tool.icon;
  const preview = TOOL_PREVIEWS[tool.id];

  return (
    <button
      type="button"
      onClick={onClick}
      onPointerEnter={() => setIsHovered(true)}
      onPointerLeave={() => setIsHovered(false)}
      onFocus={() => setIsFocused(true)}
      onBlur={() => setIsFocused(false)}
      className="
        group
        relative
        h-[360px]
        w-[280px]
        shrink-0
        snap-start
        overflow-hidden
        rounded-[28px]

        border
        border-black/[0.08]

        bg-white/75
        text-black

        text-left

        shadow-[0_18px_50px_rgba(15,23,42,0.07)]

        backdrop-blur-xl

        transition-all
        duration-500

        hover:-translate-y-[7px]
        hover:border-black/[0.12]
        hover:shadow-[0_26px_70px_rgba(15,23,42,0.12)]

        focus-visible:outline-none

        dark:border-white/[0.10]
        dark:bg-[#090a0c]
        dark:text-white
        dark:shadow-[0_20px_55px_rgba(0,0,0,0.28)]
        dark:hover:border-white/[0.16]
        dark:hover:shadow-[0_28px_80px_rgba(0,0,0,0.38)]

        sm:h-[390px]
        sm:w-[300px]

        lg:h-[420px]
        lg:w-[320px]
      "
    >
      {/* =====================================================
          AMBIENT BACKGROUND
      ====================================================== */}

      <div className="pointer-events-none absolute inset-0">
        <div
          className="
            absolute
            left-1/2
            top-0
            h-[260px]
            w-[320px]
            -translate-x-1/2
            rounded-full
            blur-[100px]
          "
          style={{
            background: `radial-gradient(
              circle,
              hsla(189.16,79.17%,47.06%,0.11) 0%,
              hsla(189.16,79.17%,47.06%,0.035) 42%,
              transparent 72%
            )`,
          }}
        />

        {/* architectural grid */}
        <div
          className="
            absolute
            inset-0
            opacity-[0.42]
            dark:opacity-[0.10]
          "
          style={{
            backgroundImage: `
              linear-gradient(
                hsla(189.16,79.17%,47.06%,0.16) 1px,
                transparent 1px
              ),
              linear-gradient(
                90deg,
                hsla(189.16,79.17%,47.06%,0.16) 1px,
                transparent 1px
              )
            `,
            backgroundSize: "44px 44px",
            maskImage:
              "linear-gradient(to bottom, black, transparent 78%)",
            WebkitMaskImage:
              "linear-gradient(to bottom, black, transparent 78%)",
          }}
        />

        {/* top illumination */}
        <div
          className="absolute inset-x-0 top-0 h-px"
          style={{
            background: `linear-gradient(
              90deg,
              transparent,
              ${ACCENT},
              transparent
            )`,
            opacity: 0.45,
          }}
        />
      </div>

      {/* =====================================================
          HOVER PREVIEW
      ====================================================== */}

      {preview && (
        <div
          className="
            pointer-events-none
            absolute
            inset-0
            z-[2]
            overflow-hidden
            opacity-0
            transition-opacity
            duration-700
            group-hover:opacity-100
            group-focus-within:opacity-100
          "
        >
          {preview.type === "video"
            ? isPreviewActive && (
                <video
                  key={preview.src}
                  src={preview.src}
                  poster={preview.poster}
                  autoPlay
                  muted
                  loop
                  playsInline
                  preload="none"
                  className="
                    h-full
                    w-full
                    scale-[1.10]
                    object-cover
                    transition-transform
                    ease-out
                    group-hover:scale-100
                  "
                  style={{ transitionDuration: "1500ms" }}
                  aria-hidden="true"
                />
              )
            : isPreviewActive && (
                <img
                  src={preview.src}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  draggable={false}
                  className="
                    h-full
                    w-full
                    scale-[1.10]
                    object-cover
                    transition-transform
                    ease-out
                    group-hover:scale-100
                  "
                  style={{ transitionDuration: "1500ms" }}
                />
              )}


          {/* image protection */}
          <div
            className="
              absolute
              inset-0
              bg-black/25
              dark:bg-black/30
            "
          />

          {/* cyan cinematic wash */}
          <div
            className="absolute inset-0"
            style={{
              background: `
                linear-gradient(
                  135deg,
                  hsla(189.16,79.17%,47.06%,0.10),
                  transparent 35%
                )
              `,
            }}
          />

          {/* lower readability */}
          <div
            className="
              absolute
              inset-x-0
              bottom-0
              h-[62%]
              bg-gradient-to-t
              from-black/[0.82]
              via-black/[0.42]
              to-transparent
            "
          />
        </div>
      )}

      {/* =====================================================
          TECHNICAL CORNERS
      ====================================================== */}

      <div className="pointer-events-none absolute inset-0 z-[4]">
        <span
          className="
            absolute
            left-4
            top-4
            h-2
            w-2
            border-l
            border-t
            border-black/20
            dark:border-white/20
          "
        />

        <span
          className="
            absolute
            right-4
            top-4
            h-2
            w-2
            border-r
            border-t
            border-black/20
            dark:border-white/20
          "
        />

        <span
          className="
            absolute
            bottom-4
            left-4
            h-2
            w-2
            border-b
            border-l
            border-black/15
            dark:border-white/15
          "
        />

        <span
          className="
            absolute
            bottom-4
            right-4
            h-2
            w-2
            border-b
            border-r
            border-black/15
            dark:border-white/15
          "
        />
      </div>

      {/* =====================================================
          ELECTRIC NODE
      ====================================================== */}

      <span
        className="
          tool-node-pulse
          absolute
          right-6
          top-6
          z-[5]
          h-1.5
          w-1.5
          rounded-full
        "
        style={{
          backgroundColor: ACCENT,
          boxShadow:
            "0 0 12px 3px hsla(189.16,79.17%,47.06%,0.55)",
        }}
        aria-hidden="true"
      />

      {/* =====================================================
          CONTENT
      ====================================================== */}

      <div
        className="
          relative
          z-[5]
          flex
          h-full
          flex-col
          justify-between
          p-5
          sm:p-6
        "
      >
        {/* ---------------------------------------------------
            TOP
        --------------------------------------------------- */}

        <div className="flex items-start justify-between gap-3">
          <span
            className="
              rounded-full
              border
              border-black/[0.08]
              bg-white/65
              px-3
              py-1.5

              text-[8px]
              font-semibold
              uppercase
              tracking-[0.22em]

              text-black/45

              backdrop-blur-xl

              transition-all
              duration-300

              group-hover:border-black/[0.14]
              group-hover:text-black/70

              dark:border-white/[0.10]
              dark:bg-black/30
              dark:text-white/55
              dark:group-hover:border-white/[0.16]
              dark:group-hover:text-white/75
            "
          >
            {tool.category}
          </span>

          <span
            className="
              flex
              h-9
              w-9
              shrink-0
              items-center
              justify-center
              rounded-full

              border
              border-black/[0.08]

              bg-white/65

              text-black/40

              backdrop-blur-xl

              transition-all
              duration-300

              group-hover:translate-x-0.5
              group-hover:border-[hsl(189.16deg_79.17%_47.06%)]/35
              group-hover:bg-[hsl(189.16deg_79.17%_47.06%)]/[0.08]
              group-hover:text-[hsl(189.16deg_79.17%_47.06%)]

              dark:border-white/[0.10]
              dark:bg-black/30
              dark:text-white/45
              dark:group-hover:border-cyan-300/30
              dark:group-hover:bg-cyan-300/[0.08]
              dark:group-hover:text-cyan-300
            "
          >
            <span className="text-sm">↗</span>
          </span>
        </div>

        {/* ---------------------------------------------------
            CENTER ICON
        --------------------------------------------------- */}

        <div className="absolute left-1/2 top-1/2 z-[3] -translate-x-1/2 -translate-y-1/2">
          <div
            className="
              relative
              flex
              h-28
              w-28
              items-center
              justify-center
              rounded-[30px]

              border
              border-black/[0.08]

              bg-white/55

              shadow-[0_18px_45px_rgba(15,23,42,0.06)]

              backdrop-blur-2xl

              transition-all
              duration-700

              group-hover:scale-[1.06]
              group-hover:rotate-2
              group-hover:border-[hsl(189.16deg_79.17%_47.06%)]/30
              group-hover:shadow-[0_18px_55px_hsla(189.16,79.17%,47.06%,0.12)]

              dark:border-white/[0.10]
              dark:bg-white/[0.04]
              dark:shadow-[0_18px_50px_rgba(0,0,0,.20)]
              dark:group-hover:border-cyan-300/25
            "
          >
            {/* ring */}
            <div
              className="
                absolute
                inset-3
                rounded-[22px]
                border
                border-dashed
                border-black/[0.08]
                transition-transform
                duration-1000
                group-hover:rotate-90
                dark:border-white/[0.09]
              "
            />

            {/* glow */}
            <div
              className="
                absolute
                inset-0
                rounded-[30px]
                opacity-0
                blur-2xl
                transition-opacity
                duration-500
                group-hover:opacity-100
              "
              style={{
                background:
                  "radial-gradient(circle, hsla(189.16,79.17%,47.06%,0.18), transparent 68%)",
              }}
            />

            <Icon
              className="
                relative
                z-10
                h-9
                w-9

                text-black/45

                transition-all
                duration-500

                group-hover:scale-110
                group-hover:text-[hsl(189.16deg_79.17%_47.06%)]

                dark:text-white/55
                dark:group-hover:text-cyan-300
              "
            />
          </div>
        </div>

        {/* ---------------------------------------------------
            BOTTOM INFORMATION
        --------------------------------------------------- */}

        <div className="relative mt-auto">
          <div
            className="
              mb-2
              font-mono
              text-[7px]
              uppercase
              tracking-[0.28em]

              text-black/30
              dark:text-white/25
            "
          >
            AI CREATIVE TOOL
          </div>

          <h3
            className="
              text-xl
              font-semibold
              tracking-[-0.035em]

              text-black

              transition-colors
              duration-300

              dark:text-white

              sm:text-2xl
            "
          >
            {tool.name}
          </h3>

          <p
            className="
              mt-2
              max-w-[270px]

              text-xs
              leading-5

              text-black/50

              transition-colors
              duration-300

              dark:text-white/50

              group-hover:text-black/65
              dark:group-hover:text-white/65
            "
          >
            {tool.description}
          </p>

          {/* signal line */}
          <div className="mt-5 flex items-center gap-2">
            <div
              className="
                h-px
                w-8
                transition-all
                duration-700
                group-hover:w-16
              "
              style={{
                backgroundColor: ACCENT,
                opacity: 0.55,
              }}
            />

            <span
              className="
                tool-signal-dot
                h-1
                w-1
                rounded-full
              "
              style={{
                backgroundColor: ACCENT,
                boxShadow:
                  "0 0 8px 2px hsla(189.16,79.17%,47.06%,0.65)",
              }}
              aria-hidden="true"
            />
          </div>
        </div>
      </div>

      {/* =====================================================
          HOVER EDGE
      ====================================================== */}

      <div
        className="
          pointer-events-none
          absolute
          inset-x-5
          bottom-0
          z-[6]
          h-px
          opacity-0
          transition-opacity
          duration-500
          group-hover:opacity-100
        "
        style={{
          background: `linear-gradient(
            90deg,
            transparent,
            ${ACCENT},
            transparent
          )`,
          boxShadow:
            "0 0 14px hsla(189.16,79.17%,47.06%,0.45)",
        }}
      />

      {/* =====================================================
          LIGHTWEIGHT CSS ANIMATIONS
      ====================================================== */}

      <style jsx>{`
        .tool-node-pulse {
          animation: toolNodePulse 2.2s ease-in-out infinite;
          transform-origin: center;
        }

        .tool-signal-dot {
          animation: toolSignalPulse 1.8s linear infinite;
          transform: translate3d(0, 0, 0);
          will-change: transform, opacity;
        }

        @keyframes toolNodePulse {
          0%,
          100% {
            opacity: 0.35;
            transform: scale(0.85);
          }

          50% {
            opacity: 1;
            transform: scale(1.15);
          }
        }

        @keyframes toolSignalPulse {
          0% {
            opacity: 0;
            transform: translate3d(0, 0, 0);
          }

          12% {
            opacity: 1;
          }

          50% {
            opacity: 0.95;
          }

          88% {
            opacity: 0.2;
          }

          100% {
            opacity: 0;
            transform: translate3d(36px, 0, 0);
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .tool-node-pulse,
          .tool-signal-dot {
            animation: none;
          }
        }
      `}</style>
    </button>
  );
});