"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  ScanLine,
  Sparkles,
} from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";

/* ============================================================
   BRAND
============================================================ */

const BRAND_CYAN = "hsl(189.16deg 79.17% 47.06%)";

/* ============================================================
   WORKFLOW DATA
============================================================ */

const WORKFLOW_ITEMS = [
  "Architectural renders",
  "Screenshot to render",
  "Generate images",
  "Explore materials",
  "Create multiple angles",
  "Image to 3D",
  "Text to 3D",
  "Generate cinematic video",
  "Upscale to 4K",
  "Transform your scene",
];

/* ============================================================
   HERO AUDIENCE
============================================================ */

const AUDIENCE = [
  "ARCHITECTS",
  "REAL ESTATE",
  "INTERIOR DESIGN",
  "ARCHVIZ STUDIOS",
];

/* ============================================================
   WORKFLOW LIST
============================================================ */

function WorkflowList({
  reduceMotion,
}: {
  reduceMotion: boolean;
}) {
  const [activeIndex, setActiveIndex] = useState(0);

  const items = useMemo(
    () => [
      ...WORKFLOW_ITEMS,
      ...WORKFLOW_ITEMS,
      ...WORKFLOW_ITEMS,
    ],
    [],
  );

  useEffect(() => {
    if (reduceMotion) return;

    const interval = window.setInterval(() => {
      setActiveIndex((current) => {
        const next = current + 1;

        if (
          next >=
          WORKFLOW_ITEMS.length * 2
        ) {
          return WORKFLOW_ITEMS.length;
        }

        return next;
      });
    }, 1800);

    return () =>
      window.clearInterval(interval);
  }, [reduceMotion]);

  return (
    <div className="relative hidden items-center gap-4 lg:flex">
      {/* ==================================================
          INPUT ARROW
      ================================================== */}

      <div
        aria-hidden="true"
        className="
          relative
          flex
          h-[420px]
          w-8
          shrink-0
          items-center
          justify-center
        "
      >
        <div
          className="
            absolute
            left-1/2
            top-6
            bottom-6
            w-px
            bg-gradient-to-b
            from-transparent
            via-white/15
            to-transparent
            dark:via-white/10
          "
        />

        {!reduceMotion && (
          <motion.div
            animate={{
              y: ["-140%", "140%"],
              opacity: [0, 1, 0],
            }}
            transition={{
              duration: 3.8,
              repeat: Infinity,
              ease: "linear",
            }}
            className="
              absolute
              left-1/2
              top-1/2
              h-12
              w-[3px]
              -translate-x-1/2
              rounded-full
              bg-gradient-to-b
              from-transparent
              via-cyan-300
              to-transparent
              shadow-[0_0_18px_5px_rgba(103,232,249,.42)]
            "
          />
        )}

        <svg
          width="28"
          height="28"
          viewBox="0 0 24 24"
          aria-hidden="true"
          className="
            relative
            z-10
            text-cyan-300
            drop-shadow-[0_0_10px_rgba(103,232,249,.35)]
          "
        >
          <polygon
            points="4,2 22,12 4,22"
            fill="currentColor"
          />
        </svg>
      </div>

      {/* ==================================================
          WORKFLOW FRAME
      ================================================== */}

      <div
        className="
          group
          relative
          h-[420px]
          w-[420px]
          overflow-hidden
          rounded-[28px]
          border
          border-white/[0.11]
          bg-[#080b0e]/85
          shadow-[0_30px_90px_rgba(0,0,0,.30)]
          dark:border-white/[0.10]
        "
      >
        {/* Inner frame */}
        <div
          aria-hidden="true"
          className="
            pointer-events-none
            absolute
            inset-2
            rounded-[23px]
            border
            border-white/[0.045]
          "
        />

        {/* Top technical rail */}
        <div className="pointer-events-none absolute left-7 right-7 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300/70 to-transparent" />

        <div className="pointer-events-none absolute left-16 right-16 top-[1px] h-px bg-gradient-to-r from-transparent via-cyan-300/12 to-transparent" />

        {/* Bottom technical rail */}
        <div className="pointer-events-none absolute bottom-0 left-7 right-7 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

        {/* Corners */}
        <div className="pointer-events-none absolute left-3 top-3 h-5 w-5 border-l border-t border-cyan-300/35" />
        <div className="pointer-events-none absolute right-3 top-3 h-5 w-5 border-r border-t border-cyan-300/35" />
        <div className="pointer-events-none absolute bottom-3 left-3 h-5 w-5 border-b border-l border-white/14" />
        <div className="pointer-events-none absolute bottom-3 right-3 h-5 w-5 border-b border-r border-white/14" />

        {/* Ambient center */}
        <div
          aria-hidden="true"
          className="
            pointer-events-none
            absolute
            left-1/2
            top-1/2
            h-[300px]
            w-[300px]
            -translate-x-1/2
            -translate-y-1/2
            rounded-full
            blur-[95px]
          "
          style={{
            background:
              "radial-gradient(circle, rgba(103,232,249,.08) 0%, transparent 70%)",
          }}
        />

        {/* Grid */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-[0.14]"
          style={{
            backgroundImage: `
              linear-gradient(
                rgba(255,255,255,.16) 1px,
                transparent 1px
              ),
              linear-gradient(
                90deg,
                rgba(255,255,255,.16) 1px,
                transparent 1px
              )
            `,
            backgroundSize: "48px 48px",
            maskImage:
              "linear-gradient(to bottom, transparent, black 16%, black 84%, transparent)",
            WebkitMaskImage:
              "linear-gradient(to bottom, transparent, black 16%, black 84%, transparent)",
          }}
        />

        {/* Large grid */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-[0.055]"
          style={{
            backgroundImage: `
              linear-gradient(
                rgba(103,232,249,.9) 1px,
                transparent 1px
              ),
              linear-gradient(
                90deg,
                rgba(103,232,249,.9) 1px,
                transparent 1px
              )
            `,
            backgroundSize: "144px 144px",
          }}
        />

        {/* ==================================================
            HEADER
        ================================================== */}

        <div className="absolute left-6 right-6 top-5 z-20 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span
              className="h-1.5 w-1.5 rounded-full"
              style={{
                background: BRAND_CYAN,
                boxShadow:
                  "0 0 10px rgba(103,232,249,.75)",
              }}
            />

            <span className="font-mono text-[8px] font-semibold uppercase tracking-[0.28em] text-white/45">
              Workflow Engine
            </span>
          </div>

          <span className="font-mono text-[8px] uppercase tracking-[0.18em] text-white/20">
            LIVE
          </span>
        </div>

        {/* ==================================================
            MAIN LIST
        ================================================== */}

        <div
          className="absolute inset-x-0 top-0"
          style={{
            transform: `translateY(${
              180 - activeIndex * 60
            }px)`,
            transition: reduceMotion
              ? "none"
              : "transform 700ms cubic-bezier(.16,1,.3,1)",
          }}
        >
          {items.map((item, index) => {
            const distance = Math.abs(
              index - activeIndex,
            );

            let opacity = 0.08;
            let scale = 0.96;

            if (distance === 0) {
              opacity = 1;
              scale = 1;
            } else if (distance === 1) {
              opacity = 0.46;
              scale = 0.985;
            } else if (distance === 2) {
              opacity = 0.25;
            } else if (distance === 3) {
              opacity = 0.15;
            }

            return (
              <div
                key={`${item}-${index}`}
                className="
                  relative
                  flex
                  h-[60px]
                  items-center
                  px-6
                "
              >
                {/* Circuit input */}
                <div
                  aria-hidden="true"
                  className="absolute left-0 flex items-center"
                >
                  <span
                    className="h-px w-8"
                    style={{
                      background:
                        distance === 0
                          ? BRAND_CYAN
                          : "rgba(255,255,255,.12)",
                      boxShadow:
                        distance === 0
                          ? "0 0 10px rgba(103,232,249,.55)"
                          : undefined,
                    }}
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
                          ? "0 0 8px rgba(103,232,249,.7)"
                          : undefined,
                    }}
                  />
                </div>

                <span
                  className="
                    whitespace-nowrap
                    pl-10
                    text-[21px]
                    font-semibold
                    tracking-[-0.035em]
                    text-white
                    xl:text-[24px]
                  "
                  style={{
                    opacity,
                    transform: `scale(${scale})`,
                    transformOrigin:
                      "left center",
                    transition:
                      "opacity 450ms ease, transform 450ms ease",
                  }}
                >
                  {item}
                </span>

                {distance === 0 && (
                  <ArrowUpRight
                    className="
                      absolute
                      right-6
                      h-4
                      w-4
                      text-cyan-300
                    "
                  />
                )}
              </div>
            );
          })}
        </div>

        {/* Bottom fade */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-[#080b0e] via-[#080b0e]/80 to-transparent" />

        {/* Bottom metadata */}
        <div className="absolute bottom-5 left-6 right-6 z-20 flex items-center justify-between">
          <span className="font-mono text-[7px] uppercase tracking-[0.22em] text-white/22">
            Intelligent routing
          </span>

          <div className="flex items-center gap-2">
            <span className="font-mono text-[7px] text-white/22">
              10
            </span>

            <span
              className="h-1 w-8 rounded-full"
              style={{
                background:
                  "linear-gradient(90deg, transparent, rgba(103,232,249,.55))",
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   AUDIENCE
============================================================ */

function HeroAudience() {
  return (
    <div className="mt-8">
      <div className="mb-3 flex items-center gap-3">
        <span className="h-px w-8 bg-cyan-300/50" />

        <span className="font-mono text-[8px] uppercase tracking-[0.28em] text-white/30">
          Built for
        </span>
      </div>

      <div className="flex flex-wrap gap-2">
        {AUDIENCE.map((item) => (
          <span
            key={item}
            className="
              rounded-full
              border
              border-white/[0.10]
              bg-white/[0.045]
              px-3
              py-1.5
              font-mono
              text-[7px]
              uppercase
              tracking-[0.17em]
              text-white/48
            "
          >
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}

/* ============================================================
   HERO
============================================================ */

export default function HomePage() {
  const reduceMotion = useReducedMotion();

  return (
    <main className="min-h-screen bg-[#f3f7f8] dark:bg-[#040608]">
      <section
        id="hero"
        data-circuit-section="hero"
        data-cy="section-hero"
        className="
          relative
          isolate
          flex
          min-h-screen
          overflow-hidden
          bg-[#f3f7f8]
          text-slate-950
          dark:bg-[#040608]
          dark:text-white
        "
      >
        {/* =====================================================
            IMAGE LAYER
        ===================================================== */}

        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
        >
          {/* DESKTOP DARK */}
          <img
            src="/hero.jpg"
            alt=""
            fetchPriority="high"
            decoding="async"
            className="absolute inset-0 hidden h-full w-full object-cover object-center md:dark:block"
          />

          {/* DESKTOP LIGHT */}
          <img
            src="/hero_white.png"
            alt=""
            fetchPriority="high"
            decoding="async"
            className="absolute inset-0 hidden h-full w-full object-cover object-center md:block md:dark:hidden"
          />

          {/* MOBILE DARK */}
          <img
            src="/mobile_hero.jpg"
            alt=""
            fetchPriority="high"
            decoding="async"
            className="absolute inset-0 hidden h-full w-full object-cover object-center dark:block md:dark:hidden"
          />

          {/* MOBILE LIGHT */}
          <img
            src="/mobile_lightmod.jpg"
            alt=""
            fetchPriority="high"
            decoding="async"
            className="absolute inset-0 block h-full w-full object-cover object-center dark:hidden md:hidden"
          />

          {/* =================================================
              DARK IMAGE FINISH
          ================================================= */}

          <div
            className="
              absolute
              inset-0
              hidden
              dark:block
              bg-black/[0.06]
            "
          />

          <div
            className="
              absolute
              inset-0
              hidden
              dark:block
              bg-[radial-gradient(circle_at_72%_48%,transparent_0%,rgba(0,0,0,.06)_42%,rgba(0,0,0,.58)_100%)]
            "
          />

          {/* =================================================
              LIGHT IMAGE FINISH
          ================================================= */}

          <div
            className="
              absolute
              inset-0
              bg-white/[0.015]
              dark:hidden
            "
          />

          <div
            className="
              absolute
              inset-0
              dark:hidden
              bg-[radial-gradient(circle_at_72%_46%,transparent_0%,rgba(255,255,255,.02)_45%,rgba(244,248,249,.24)_100%)]
            "
          />

          {/* =================================================
              LEFT TEXT READABILITY
          ================================================= */}

          <div
            className="
              absolute
              inset-y-0
              left-0
              w-[72%]
              bg-gradient-to-r
              from-[#f3f7f8]/96
              via-[#f3f7f8]/78
              to-transparent
              dark:from-[#040608]/96
              dark:via-[#040608]/68
              dark:to-transparent
            "
          />

          {/* =================================================
              CYAN ATMOSPHERE
          ================================================= */}

          <div
            className="
              absolute
              left-[-170px]
              top-[18%]
              h-[560px]
              w-[560px]
              rounded-full
              blur-[120px]
            "
            style={{
              background:
                "radial-gradient(circle, hsla(189.16,79.17%,47.06%,0.075) 0%, transparent 72%)",
            }}
          />

          <div
            className="
              absolute
              right-[15%]
              top-[24%]
              h-[480px]
              w-[480px]
              rounded-full
              blur-[110px]
            "
            style={{
              background:
                "radial-gradient(circle, hsla(189.16,79.17%,47.06%,0.09) 0%, transparent 72%)",
            }}
          />

          {/* =================================================
              ARCHITECTURAL GRID
          ================================================= */}

          <div
            className="
              absolute
              inset-0
              opacity-[0.17]
              dark:opacity-[0.11]
            "
            style={{
              backgroundImage: `
                linear-gradient(
                  rgba(103,232,249,.20) 1px,
                  transparent 1px
                ),
                linear-gradient(
                  90deg,
                  rgba(103,232,249,.20) 1px,
                  transparent 1px
                )
              `,
              backgroundSize: "72px 72px",
              maskImage:
                "linear-gradient(to right, black 0%, black 76%, transparent 100%)",
              WebkitMaskImage:
                "linear-gradient(to right, black 0%, black 76%, transparent 100%)",
            }}
          />

          <div
            className="
              absolute
              inset-0
              opacity-[0.045]
              dark:opacity-[0.035]
            "
            style={{
              backgroundImage: `
                linear-gradient(
                  rgba(15,23,42,.25) 1px,
                  transparent 1px
                ),
                linear-gradient(
                  90deg,
                  rgba(15,23,42,.25) 1px,
                  transparent 1px
                )
              `,
              backgroundSize: "18px 18px",
              maskImage:
                "linear-gradient(to right, black 0%, transparent 70%)",
              WebkitMaskImage:
                "linear-gradient(to right, black 0%, transparent 70%)",
            }}
          />

          {/* edge vignettes */}
          <div className="absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-black/[0.04] to-transparent dark:from-black/20" />

          <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-[#f3f7f8]/55 to-transparent dark:from-[#040608]/50" />
        </div>

        {/* =====================================================
            TOP SYSTEM BAR
        ===================================================== */}

        <div
          className="
            absolute
            left-0
            right-0
            top-0
            z-40
            border-b
            border-black/[0.06]
            bg-white/[0.18]
            dark:border-white/[0.055]
            dark:bg-black/[0.08]
          "
        >
          <div className="mx-auto flex max-w-screen-2xl items-center justify-between px-5 py-3 sm:px-8 lg:px-14 2xl:px-24">
            <div className="flex items-center gap-3">
              <span
                className="h-1.5 w-1.5 rounded-full"
                style={{
                  background: BRAND_CYAN,
                  boxShadow:
                    "0 0 11px rgba(103,232,249,.75)",
                }}
              />

              <span className="font-mono text-[8px] font-medium uppercase tracking-[0.27em] text-slate-500 dark:text-white/34">
                RENDERUIM / AI ARCHITECTURE SYSTEM
              </span>
            </div>

            <span className="hidden font-mono text-[8px] uppercase tracking-[0.24em] text-slate-400 dark:text-white/20 sm:block">
              SYSTEM ONLINE
            </span>
          </div>
        </div>

        {/* =====================================================
            MAIN CONTENT
        ===================================================== */}

        <div className="relative z-20 mx-auto flex w-full max-w-screen-2xl flex-1 px-5 pb-7 pt-24 sm:px-8 sm:pb-9 lg:px-14 lg:pt-28 2xl:px-24">
          <div className="flex w-full flex-col justify-center gap-12 lg:flex-row lg:items-center lg:justify-between lg:gap-16">
            {/* =================================================
                LEFT
            ================================================= */}

            <div className="max-w-[680px]">
              {/* eyebrow */}
              <motion.div
                initial={
                  reduceMotion
                    ? undefined
                    : {
                        opacity: 0,
                        y: 12,
                      }
                }
                animate={{
                  opacity: 1,
                  y: 0,
                }}
                transition={{
                  duration: 0.6,
                  ease: [0.16, 1, 0.3, 1],
                }}
                className="
                  inline-flex
                  items-center
                  gap-2.5
                  rounded-full
                  border
                  border-black/[0.07]
                  bg-white/65
                  px-3.5
                  py-2
                  dark:border-white/[0.09]
                  dark:bg-black/[0.20]
                "
              >
                <Sparkles
                  className="h-3.5 w-3.5"
                  style={{
                    color: BRAND_CYAN,
                  }}
                />

                <span className="font-mono text-[8px] font-semibold uppercase tracking-[0.25em] text-slate-600 dark:text-white/52">
                  Architectural AI Workspace
                </span>

                <ArrowUpRight className="h-3 w-3 text-slate-400 dark:text-white/22" />
              </motion.div>

              {/* heading */}
              <motion.h1
                initial={
                  reduceMotion
                    ? undefined
                    : {
                        opacity: 0,
                        y: 24,
                        filter: "blur(9px)",
                      }
                }
                animate={{
                  opacity: 1,
                  y: 0,
                  filter: "blur(0px)",
                }}
                transition={{
                  delay: 0.08,
                  duration: 0.82,
                  ease: [0.16, 1, 0.3, 1],
                }}
                className="
                  mt-7
                  max-w-[720px]
                  text-[clamp(3rem,6vw,5.9rem)]
                  font-semibold
                  leading-[0.91]
                  tracking-[-0.067em]
                  text-slate-950
                  dark:text-white
                "
              >
                <span className="block">
                  Direct your
                </span>

                <span className="block">
                  architecture
                </span>

                <span
                  className="block"
                  style={{
                    color: BRAND_CYAN,
                  }}
                >
                  with AI.
                </span>
              </motion.h1>

              {/* paragraph */}
              <motion.p
                initial={
                  reduceMotion
                    ? undefined
                    : {
                        opacity: 0,
                        y: 16,
                      }
                }
                animate={{
                  opacity: 1,
                  y: 0,
                }}
                transition={{
                  delay: 0.2,
                  duration: 0.7,
                }}
                className="
                  mt-7
                  max-w-[580px]
                  text-sm
                  leading-7
                  text-slate-600
                  dark:text-white/50
                  sm:text-base
                "
              >
                Generate, transform and visualize
                architectural ideas through one connected
                AI workspace — from your first sketch to
                polished images, 3D scenes and cinematic
                content.
              </motion.p>

              {/* =================================================
                  CTAs
              ================================================= */}

              <motion.div
                initial={
                  reduceMotion
                    ? undefined
                    : {
                        opacity: 0,
                        y: 14,
                      }
                }
                animate={{
                  opacity: 1,
                  y: 0,
                }}
                transition={{
                  delay: 0.32,
                  duration: 0.65,
                }}
                className="mt-8 flex flex-col gap-3 sm:flex-row"
              >
                <a
                  href="#tools"
                  className="
                    group
                    inline-flex
                    items-center
                    justify-center
                    gap-2.5
                    rounded-[14px]
                    bg-slate-950
                    px-6
                    py-3.5
                    text-sm
                    font-semibold
                    text-white
                    shadow-[0_18px_45px_rgba(15,23,42,.14)]
                    transition-all
                    duration-300
                    hover:-translate-y-0.5
                    dark:bg-white
                    dark:text-black
                    dark:shadow-[0_18px_45px_rgba(0,0,0,.30)]
                  "
                >
                  <span>Start creating</span>

                  <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
                </a>

                <a
                  href="#how-it-works"
                  className="
                    group
                    inline-flex
                    items-center
                    justify-center
                    gap-2.5
                    rounded-[14px]
                    border
                    border-black/[0.08]
                    bg-white/60
                    px-6
                    py-3.5
                    text-sm
                    font-semibold
                    text-slate-900
                    transition-all
                    duration-300
                    hover:-translate-y-0.5
                    hover:border-black/[0.14]
                    hover:bg-white/80
                    dark:border-white/[0.10]
                    dark:bg-black/[0.16]
                    dark:text-white
                    dark:hover:border-white/[0.16]
                    dark:hover:bg-black/[0.28]
                  "
                >
                  <ScanLine
                    className="h-4 w-4"
                    style={{
                      color: BRAND_CYAN,
                    }}
                  />

                  <span>See how it works</span>
                </a>
              </motion.div>

              {/* =================================================
                  AUDIENCE
              ================================================= */}

              <motion.div
                initial={
                  reduceMotion
                    ? undefined
                    : {
                        opacity: 0,
                      }
                }
                animate={{
                  opacity: 1,
                }}
                transition={{
                  delay: 0.46,
                  duration: 0.6,
                }}
                className="hidden sm:block"
              >
                <HeroAudience />
              </motion.div>
            </div>

            {/* =================================================
                RIGHT WORKFLOW
            ================================================= */}

            <motion.div
              initial={
                reduceMotion
                  ? undefined
                  : {
                      opacity: 0,
                      x: 28,
                    }
              }
              animate={{
                opacity: 1,
                x: 0,
              }}
              transition={{
                delay: 0.22,
                duration: 0.82,
                ease: [0.16, 1, 0.3, 1],
              }}
              className="shrink-0"
            >
              <WorkflowList
                reduceMotion={Boolean(
                  reduceMotion,
                )}
              />
            </motion.div>
          </div>
        </div>

        {/* =====================================================
            BOTTOM SYSTEM LINE
        ===================================================== */}

        <div className="relative z-30 mx-auto w-full max-w-screen-2xl px-5 pb-5 sm:px-8 lg:px-14 2xl:px-24">
          <div className="flex items-center justify-between border-t border-black/[0.07] pt-4 dark:border-white/[0.06]">
            <div className="flex min-w-0 items-center gap-3">
              <span
                className="h-px w-8 shrink-0"
                style={{
                  background: BRAND_CYAN,
                }}
              />

              <span className="truncate font-mono text-[7px] uppercase tracking-[0.24em] text-slate-500 dark:text-white/28">
                IMAGE / VIDEO / 3D / ENHANCE
              </span>
            </div>

            <div className="flex shrink-0 items-center gap-3">
              <span className="hidden font-mono text-[7px] uppercase tracking-[0.20em] text-slate-400 dark:text-white/18 sm:block">
                ONE WORKSPACE / MULTIPLE ENGINES
              </span>

              <span
                className="h-1.5 w-1.5 rounded-full"
                style={{
                  background: BRAND_CYAN,
                  boxShadow:
                    "0 0 9px rgba(103,232,249,.65)",
                }}
              />
            </div>
          </div>
        </div>

        {/* =====================================================
            MOBILE AUDIENCE
        ===================================================== */}

        <div className="absolute bottom-20 left-5 right-5 z-30 sm:hidden">
          <div className="flex flex-wrap gap-1.5">
            {AUDIENCE.map((item) => (
              <span
                key={item}
                className="
                  rounded-full
                  border
                  border-black/[0.07]
                  bg-white/60
                  px-2.5
                  py-1.5
                  font-mono
                  text-[6.5px]
                  uppercase
                  tracking-[0.15em]
                  text-slate-500
                  dark:border-white/[0.08]
                  dark:bg-black/[0.20]
                  dark:text-white/34
                "
              >
                {item}
              </span>
            ))}
          </div>
        </div>

        {/* =====================================================
            MOBILE SCROLL INDICATOR
        ===================================================== */}

        <div className="absolute bottom-5 left-1/2 z-30 -translate-x-1/2 sm:hidden">
          <a
            href="#ai-showcase"
            aria-label="Scroll to AI Showcase"
            className="flex flex-col items-center gap-2"
          >
            <span className="font-mono text-[7px] uppercase tracking-[0.25em] text-slate-400 dark:text-white/25">
              Explore
            </span>

            <span
              className="h-8 w-px"
              style={{
                background:
                  "linear-gradient(to bottom, rgba(103,232,249,.7), transparent)",
              }}
            />
          </a>
        </div>
      </section>
    </main>
  );
}
