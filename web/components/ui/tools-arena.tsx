"use client";

import Link from "next/link";

import { TOOLS } from "@/config/tools";
import { ToolVisualCard } from "./tool-visual-card";

type ToolsArenaProps = {
  onToolClick?: () => void;
};

const TOOL_ORDER = [
  "image-generator",
  "screenshot-to-render",
  "upscale",
  "ambiance-change",
  "image-to-3d",
  "text-to-3d",
  "video-generator",
  "modify-video",
  "background-remover",
  "multi-angle",
];

const VISIBLE_TOOLS = TOOL_ORDER
  .map((id) =>
    TOOLS.find((tool) => tool.id === id),
  )
  .filter(
    (tool): tool is (typeof TOOLS)[number] =>
      Boolean(tool),
  );

export function ToolsArena({
  onToolClick,
}: ToolsArenaProps) {
  return (
    <>
      <style jsx>{`
        @keyframes toolsDepthDrift {
          0%,
          100% {
            transform: translate3d(-50%, 0, 0);
            opacity: 0.55;
          }

          50% {
            transform: translate3d(calc(-50% + 72px), 18px, 0);
            opacity: 0.85;
          }
        }

        @keyframes toolsSystemLine {
          0%,
          100% {
            width: 28px;
            opacity: 0.35;
          }

          50% {
            width: 54px;
            opacity: 0.9;
          }
        }

        @keyframes toolsBadgePulse {
          0%,
          100% {
            opacity: 0.35;
            box-shadow: 0 0 0 hsla(189, 79%, 47%, 0);
          }

          50% {
            opacity: 1;
            box-shadow: 0 0 12px hsla(189, 79%, 47%, 0.75);
          }
        }

        @keyframes toolsHeaderReveal {
          from {
            opacity: 0;
            transform: translate3d(0, 24px, 0);
          }

          to {
            opacity: 1;
            transform: translate3d(0, 0, 0);
          }
        }

.tools-marquee-track {
  display: flex;
  width: max-content;
  transform: translate3d(0, 0, 0);
  will-change: transform;
  animation: toolsMarquee 38s linear infinite;
}

.tools-marquee-set {
  display: flex;
  flex-shrink: 0;
}

@keyframes toolsMarquee {
  from {
    transform: translate3d(0, 0, 0);
  }

  to {
    transform: translate3d(-50%, 0, 0);
  }
}

/* Tablet */
@media (min-width: 640px) and (max-width: 1023px) {
  .tools-marquee-track {
    animation-duration: 32s;
  }
}

/* Mobile */
@media (max-width: 639px) {
  .tools-marquee-track {
    animation-duration: 28s;
  }

  .tools-marquee-set {
    gap: 0.75rem;
    padding-left: 0.75rem;
    padding-right: 0.75rem;
  }
}

/* Accessibility */
@media (prefers-reduced-motion: reduce) {
  .tools-marquee-track {
    animation-play-state: paused;
  }
}
        .tools-depth-motion {
          animation: toolsDepthDrift 14s ease-in-out infinite;
        }

        .tools-system-line {
          animation: toolsSystemLine 3s ease-in-out infinite;
        }

        .tools-badge-pulse {
          animation: toolsBadgePulse 2s ease-in-out infinite;
        }

        .tools-header-reveal {
          animation:
            toolsHeaderReveal 0.8s
            cubic-bezier(0.16, 1, 0.3, 1)
            both;
        }

        /*
         * Desktop gets the continuous marquee.
         * Mobile gets native horizontal touch scrolling.
         */
        .tools-mobile-rail {
          display: flex;
          width: max-content;
          gap: 1rem;
        }

        /*
         * Keep duplicate cards only for desktop.
         */
        .tools-duplicate-set {
          display: flex;
        }

        /*
         * Hide native scrollbar while keeping touch/trackpad scrolling.
         */
        .tools-touch-scroll {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }

        .tools-touch-scroll::-webkit-scrollbar {
          display: none;
        }

        @media (max-width: 1023px) {
          /*
           * Mobile performance mode:
           * remove all continuous decorative animation.
           */
          .tools-depth-motion,
          .tools-system-line,
          .tools-badge-pulse,
          .tools-header-reveal {
            animation: none !important;
          }

          /*
           * Reveal header immediately.
           */
          .tools-header-reveal {
            opacity: 1 !important;
            transform: none !important;
          }

          /*
           * Mobile rail is native scrolling, never a marquee.
           */
          .tools-mobile-rail {
            animation: none !important;
            transform: none !important;
            will-change: auto !important;
          }

          /*
           * Duplicate cards are unnecessary on mobile.
           */
          .tools-duplicate-set {
            display: none !important;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .tools-depth-motion,
          .tools-system-line,
          .tools-badge-pulse,
          .tools-header-reveal,
          .tools-mobile-rail {
            animation: none !important;
          }

          .tools-header-reveal {
            opacity: 1 !important;
            transform: none !important;
          }
        }
      `}</style>

      <section
        id="tools"
        data-circuit-section="tools"
        className="
          relative
          overflow-hidden
          border-y
          border-black/[0.07]
          bg-white
          py-24
          text-black
          dark:border-white/[0.07]
          dark:bg-[#050505]
          dark:text-white
          lg:py-28
        "
        style={{
          contain: "layout paint",
        }}
      >
        {/* ======================================================
            BACKGROUND
        ======================================================= */}

        <div
          className="
            pointer-events-none
            absolute
            inset-0
            overflow-hidden
          "
          aria-hidden="true"
          style={{
            contain: "paint",
          }}
        >
          {/* ====================================================
              MAIN BLUE ATMOSPHERE
          ==================================================== */}

          <div
            className="
              absolute
              left-1/2
              top-[-110px]
              h-[290px]
              w-[440px]
              -translate-x-1/2
              rounded-full
              blur-[45px]

              sm:h-[340px]
              sm:w-[560px]
              sm:blur-[60px]

              lg:top-[-180px]
              lg:h-[680px]
              lg:w-[1000px]
              lg:blur-[110px]
            "
            style={{
              background:
                "radial-gradient(circle, hsla(189.16,79.17%,47.06%,0.16) 0%, hsla(189.16,79.17%,47.06%,0.10) 28%, hsla(189.16,79.17%,47.06%,0.045) 48%, transparent 72%)",
            }}
          />

          {/* ====================================================
              SECONDARY BLUE DEPTH
          ==================================================== */}

          <div
            className="
              tools-depth-motion
              absolute
              left-1/2
              top-[20%]
              h-[240px]
              w-[420px]
              -translate-x-1/2
              rounded-full
              blur-[45px]

              sm:h-[300px]
              sm:w-[520px]
              sm:blur-[65px]

              lg:h-[560px]
              lg:w-[900px]
              lg:blur-[125px]
            "
            style={{
              background:
                "radial-gradient(circle, hsla(189.16,79.17%,47.06%,0.075) 0%, hsla(189.16,79.17%,47.06%,0.035) 42%, transparent 72%)",
            }}
          />

          {/* ====================================================
              LEFT BLUE LIGHT
              Desktop only.
          ==================================================== */}

          <div
            className="
              absolute
              -left-[220px]
              top-[30%]
              hidden
              h-[520px]
              w-[520px]
              rounded-full
              blur-[125px]
              lg:block
            "
            style={{
              background:
                "radial-gradient(circle, hsla(189.16,79.17%,47.06%,0.065) 0%, transparent 70%)",
            }}
          />

          {/* ====================================================
              RIGHT BLUE LIGHT
              Desktop only.
          ==================================================== */}

          <div
            className="
              absolute
              -right-[220px]
              top-[38%]
              hidden
              h-[520px]
              w-[520px]
              rounded-full
              blur-[125px]
              lg:block
            "
            style={{
              background:
                "radial-gradient(circle, hsla(189.16,79.17%,47.06%,0.055) 0%, transparent 70%)",
            }}
          />

          {/* ====================================================
              LIGHT MODE ARCHITECTURAL GRID
          ==================================================== */}

          <div
            className="
              absolute
              inset-0
              dark:hidden
            "
            style={{
              opacity: 0.42,
              backgroundImage: `
                linear-gradient(
                  hsla(189.16,79.17%,47.06%,0.20) 1px,
                  transparent 1px
                ),
                linear-gradient(
                  90deg,
                  hsla(189.16,79.17%,47.06%,0.20) 1px,
                  transparent 1px
                )
              `,
              backgroundSize: "80px 80px",
            }}
          />

          {/* ====================================================
              LIGHT MODE SECONDARY GRID
              Desktop only.
          ==================================================== */}

          <div
            className="
              absolute
              inset-0
              hidden
              dark:hidden
              lg:block
            "
            style={{
              opacity: 0.14,
              backgroundImage: `
                linear-gradient(
                  hsla(189.16,79.17%,47.06%,0.18) 1px,
                  transparent 1px
                ),
                linear-gradient(
                  90deg,
                  hsla(189.16,79.17%,47.06%,0.18) 1px,
                  transparent 1px
                )
              `,
              backgroundSize: "160px 160px",
            }}
          />

          {/* ====================================================
              DARK MODE ARCHITECTURAL GRID
          ==================================================== */}

          <div
            className="
              absolute
              inset-0
              hidden
              dark:block
            "
            style={{
              opacity: 0.26,
              backgroundImage: `
                linear-gradient(
                  hsla(189.16,79.17%,47.06%,0.23) 1px,
                  transparent 1px
                ),
                linear-gradient(
                  90deg,
                  hsla(189.16,79.17%,47.06%,0.23) 1px,
                  transparent 1px
                )
              `,
              backgroundSize: "80px 80px",
            }}
          />

          {/* ====================================================
              CENTRAL SOFT BLUE HAZE
              Desktop only.
          ==================================================== */}

          <div
            className="
              absolute
              left-1/2
              top-[42%]
              hidden
              h-[360px]
              w-[760px]
              -translate-x-1/2
              rounded-full
              blur-[135px]
              lg:block
            "
            style={{
              background:
                "radial-gradient(circle, hsla(189.16,79.17%,47.06%,0.055) 0%, transparent 72%)",
            }}
          />
        </div>

        {/* ======================================================
            CONTENT
        ======================================================= */}

        <div className="relative mx-auto max-w-[1600px]">
          {/* ====================================================
              HEADER
          ==================================================== */}

          <div
            className="
              tools-header-reveal
              relative
              mb-12
              px-4
              sm:px-6
              lg:px-8
            "
          >
            {/* ==================================================
                LOCAL ATMOSPHERE
            ================================================== */}

            <div
              className="
                pointer-events-none
                absolute
                inset-x-0
                top-[-100px]
                mx-auto
                h-[240px]
                max-w-[760px]
              "
              aria-hidden="true"
            >
              <div
                className="
                  absolute
                  left-1/2
                  top-1/2
                  h-[160px]
                  w-[360px]
                  -translate-x-1/2
                  -translate-y-1/2
                  rounded-full
                  blur-[55px]

                  sm:h-[220px]
                  sm:w-[520px]
                  sm:blur-[85px]

                  lg:h-[260px]
                  lg:w-[620px]
                  lg:blur-[100px]
                "
                style={{
                  background:
                    "radial-gradient(circle, hsla(189.16,79.17%,47.06%,0.12) 0%, hsla(189.16,79.17%,47.06%,0.045) 42%, transparent 72%)",
                }}
              />
            </div>

            {/* ==================================================
                TOP SYSTEM LINE
            ================================================== */}

            <div className="relative mx-auto mb-7 flex max-w-[720px] items-center justify-center gap-3">
              <div
                className="
                  tools-system-line
                  h-px
                  bg-[hsl(189.16deg_79.17%_47.06%)]
                "
              />

              <div
                className="
                  relative
                  flex
                  items-center
                  gap-2
                  rounded-full
                  border
                  border-black/[0.08]
                  bg-white/60
                  px-3
                  py-1.5
                  backdrop-blur-md
                  dark:border-white/[0.08]
                  dark:bg-white/[0.035]
                "
              >
                <span
                  className="
                    tools-badge-pulse
                    h-1.5
                    w-1.5
                    rounded-full
                    bg-[hsl(189.16deg_79.17%_47.06%)]
                  "
                />

                <span
                  className="
                    font-mono
                    text-[8px]
                    font-medium
                    uppercase
                    tracking-[0.3em]
                    text-black/45
                    dark:text-white/45
                  "
                >
                  AI Toolkit
                </span>
              </div>

              <div
                className="
                  tools-system-line
                  h-px
                  bg-[hsl(189.16deg_79.17%_47.06%)]
                "
                style={{
                  animationDelay: "300ms",
                }}
              />
            </div>

            {/* ==================================================
                MAIN TITLE
            ================================================== */}

            <div className="relative mx-auto max-w-4xl text-center">
              <div className="relative inline-block">
                <div
                  className="
                    absolute
                    left-[-22px]
                    top-1/2
                    hidden
                    h-16
                    w-px
                    -translate-y-1/2
                    bg-gradient-to-b
                    from-transparent
                    via-[hsl(189.16deg_79.17%_47.06%)]
                    to-transparent
                    opacity-60
                    sm:block
                  "
                  aria-hidden="true"
                />

                <h2
                  className="
                    text-4xl
                    font-semibold
                    tracking-[-0.045em]
                    text-black
                    dark:text-white
                    sm:text-5xl
                    lg:text-[56px]
                    lg:leading-[1.02]
                  "
                >
                  Your creative{" "}
                  <span
                    className="
                      relative
                      inline-block
                      text-black/42
                      dark:text-white/42
                    "
                  >
                    arsenal

                    <span
                      className="
                        absolute
                        -bottom-1
                        left-0
                        h-px
                        w-full
                        origin-left
                        scale-x-0
                        bg-[hsl(189.16deg_79.17%_47.06%)]
                        opacity-70
                        transition-transform
                        duration-500
                      "
                    />
                  </span>

                  <span
                    className="
                      text-[hsl(189.16deg_79.17%_47.06%)]
                      drop-shadow-[0_0_22px_hsla(189,79%,47%,0.18)]
                    "
                  >
                    .
                  </span>
                </h2>
              </div>

              {/* ==================================================
                  SUBTITLE
              ================================================== */}

              <p
                className="
                  mx-auto
                  mt-5
                  max-w-[620px]
                  text-sm
                  leading-7
                  text-black/55
                  dark:text-white/50
                  sm:text-base
                  sm:leading-7
                "
              >
                Generate, transform and visualize
                <span className="text-black/75 dark:text-white/75">
                  {" "}architectural ideas{" "}
                </span>
                with AI.
              </p>
            </div>

            {/* ==================================================
                LOWER STATUS / ROUTING LINE
            ================================================== */}

            <div className="relative mx-auto mt-7 flex max-w-[620px] items-center justify-center">
              <div className="hidden h-px flex-1 bg-gradient-to-r from-transparent to-black/[0.08] dark:to-white/[0.08] sm:block" />

              <div
                className="
                  mx-4
                  flex
                  items-center
                  gap-2.5
                  rounded-full
                  border
                  border-black/[0.07]
                  bg-white/50
                  px-3
                  py-1.5
                  backdrop-blur-md
                  dark:border-white/[0.07]
                  dark:bg-white/[0.025]
                "
              >
                <span className="font-mono text-[7px] uppercase tracking-[0.22em] text-black/30 dark:text-white/30">
                  10 Creative Tools
                </span>

                <span className="h-1 w-1 rounded-full bg-[hsl(189.16deg_79.17%_47.06%)] shadow-[0_0_8px_hsla(189,79%,47%,0.7)]" />

                <span className="font-mono text-[7px] uppercase tracking-[0.22em] text-black/30 dark:text-white/30">
                  Architectural AI
                </span>
              </div>

              <div className="hidden h-px flex-1 bg-gradient-to-l from-transparent to-black/[0.08] dark:to-white/[0.08] sm:block" />
            </div>

            {/* ==================================================
                EXPLORE ALL
            ================================================== */}

            <div className="mt-7 flex justify-center">
              <Link
                href="#all-tools"
                className="
                  group
                  inline-flex
                  items-center
                  gap-2.5
                  rounded-full
                  border
                  border-black/[0.09]
                  bg-white/60
                  px-4
                  py-2
                  text-[9px]
                  font-medium
                  uppercase
                  tracking-[0.2em]
                  text-black/55
                  backdrop-blur-md
                  transition-all
                  duration-300
                  hover:-translate-y-0.5
                  hover:border-[hsl(189.16deg_79.17%_47.06%)]/35
                  hover:bg-white
                  hover:text-black
                  dark:border-white/[0.09]
                  dark:bg-white/[0.03]
                  dark:text-white/50
                  dark:hover:border-cyan-300/25
                  dark:hover:bg-white/[0.055]
                  dark:hover:text-white
                "
              >
                <span>Explore all</span>

                <span
                  className="
                    flex
                    h-5
                    w-5
                    items-center
                    justify-center
                    rounded-full
                    border
                    border-black/[0.10]
                    transition-all
                    duration-300
                    group-hover:border-[hsl(189.16deg_79.17%_47.06%)]/40
                    group-hover:bg-[hsl(189.16deg_79.17%_47.06%)]/[0.08]
                    dark:border-white/[0.10]
                    dark:group-hover:border-cyan-300/30
                  "
                >
                  <span className="transition-transform duration-300 group-hover:translate-x-0.5">
                    →
                  </span>
                </span>
              </Link>
            </div>
          </div>

          {/* ====================================================
              TOOL RAIL
          ==================================================== */}

          <div
            className="
              tools-touch-scroll
              overflow-x-auto
              overflow-y-hidden
              pb-8
              lg:overflow-x-hidden
            "
          >
{/* ====================================================
    INFINITE TOOL RAIL
===================================================== */}
<div className="relative mt-2 overflow-hidden pb-8">
  <div
    className="
      tools-marquee-track
      flex
      w-max
      items-stretch
      will-change-transform
    "
  >
    {/* SET 1 */}
    <div
      className="
        tools-marquee-set
        flex
        shrink-0
        items-stretch
        gap-4
        px-4
        sm:px-6
        lg:px-8
      "
    >
      {VISIBLE_TOOLS.map((tool) => (
        <div
          key={`tool-first-${tool.id}`}
          className="
            w-[280px]
            shrink-0
            sm:w-[300px]
            lg:w-[320px]
          "
        >
          <ToolVisualCard
            tool={tool}
            variant="rail"
            onClick={onToolClick}
          />
        </div>
      ))}
    </div>

    {/* SET 2 — identical copy for seamless loop */}
    <div
      className="
        tools-marquee-set
        flex
        shrink-0
        items-stretch
        gap-4
        px-4
        sm:px-6
        lg:px-8
      "
      aria-hidden="true"
    >
      {VISIBLE_TOOLS.map((tool) => (
        <div
          key={`tool-second-${tool.id}`}
          className="
            w-[280px]
            shrink-0
            sm:w-[300px]
            lg:w-[320px]
          "
        >
          <ToolVisualCard
            tool={tool}
            variant="rail"
            onClick={onToolClick}
          />
        </div>
      ))}
    </div>
  </div>
</div>
          </div>
        </div>
      </section>
    </>
  );
}