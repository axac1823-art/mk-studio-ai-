"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AnimatePresence,
  motion,
  useReducedMotion,
} from "framer-motion";
import {
  ArrowUpRight,
  Box,
  Camera,
  Layers3,
  Play,
  Scan,
  type LucideIcon,
} from "lucide-react";

/* ============================================================
   TYPES
============================================================ */

type UseCase = {
  number: string;
  title: string;
  label: string;
  description: string;
  image: string;
  steps: string[];
  icon: LucideIcon;
  metric: string;
};

/* ============================================================
   BRAND
============================================================ */

const BRAND_CYAN = "hsl(189.16deg 79.17% 47.06%)";

/* ============================================================
   DATA
============================================================ */

const USE_CASES: UseCase[] = [
  {
    number: "01",
    title: "Architects",
    label: "DESIGN → VISUAL",
    description:
      "Transform plans, sketches and massing studies into presentation-ready architectural visuals.",
    image:
      "https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?auto=format&fit=crop&w=1800&q=90",
    steps: ["PLAN", "MASSING", "MATERIAL", "RENDER"],
    icon: Box,
    metric: "PLAN → 3D",
  },
  {
    number: "02",
    title: "Real Estate",
    label: "PROJECT → CAMPAIGN",
    description:
      "Turn one project into a complete visual campaign with renders, angles and cinematic content.",
    image:
      "https://images.unsplash.com/photo-1600585154526-990dced4db0d?auto=format&fit=crop&w=1800&q=90",
    steps: ["PROJECT", "RENDER", "ANGLE", "VIDEO"],
    icon: Camera,
    metric: "1 → MANY",
  },
  {
    number: "03",
    title: "Interior Design",
    label: "SPACE → EXPERIENCE",
    description:
      "Explore furniture, materials, lighting and atmosphere without rebuilding the original scene.",
    image:
      "https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=1800&q=90",
    steps: ["SPACE", "FURNISH", "MATERIAL", "MOOD"],
    icon: Layers3,
    metric: "IDEA → MOOD",
  },
  {
    number: "04",
    title: "Archviz Studios",
    label: "SCENE → CONTENT",
    description:
      "Generate multiple views, visual variations and cinematic sequences from a single creative direction.",
    image:
      "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=1800&q=90",
    steps: ["SCENE", "ANGLE", "VARIATION", "FILM"],
    icon: Play,
    metric: "SCENE → FILM",
  },
];

const AUTO_DELAY = 6500;

/* ============================================================
   MAIN
============================================================ */

export default function UseCasesShowcase() {
  const reduceMotion = useReducedMotion();

  const [activeIndex, setActiveIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  const activeCase = USE_CASES[activeIndex];

  useEffect(() => {
    if (isPaused || reduceMotion) return;

    const timer = window.setInterval(() => {
      setActiveIndex(
        (current) => (current + 1) % USE_CASES.length,
      );
    }, AUTO_DELAY);

    return () => window.clearInterval(timer);
  }, [isPaused, reduceMotion]);

  const progress = useMemo(
    () =>
      `${((activeIndex + 1) / USE_CASES.length) * 100}%`,
    [activeIndex],
  );

  return (
    <section
      id="use-cases"
      data-circuit-section="use-cases"
      className="
        relative
        overflow-hidden
        border-y
        border-black/[0.07]
        bg-[#f7fafb]
        text-slate-950
        dark:border-white/[0.06]
        dark:bg-[#050607]
        dark:text-white
      "
    >
      {/* =====================================================
          BACKGROUND
      ===================================================== */}

      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 overflow-hidden"
      >
        {/* =================================================
            MAIN ATMOSPHERE
        ================================================= */}

        <div
          className="
            absolute
            left-1/2
            top-[-180px]
            h-[760px]
            w-[1100px]
            -translate-x-1/2
            rounded-full
            blur-[95px]
          "
          style={{
            background:
              "radial-gradient(circle, hsla(189.16,79.17%,47.06%,0.22) 0%, hsla(189.16,79.17%,47.06%,0.13) 28%, hsla(189.16,79.17%,47.06%,0.06) 48%, transparent 72%)",
          }}
        />

        {/* =================================================
            MOVING DEPTH GLOW
        ================================================= */}

        <motion.div
          animate={
            reduceMotion
              ? undefined
              : {
                  x: ["-8%", "8%", "-8%"],
                  y: ["0%", "3%", "0%"],
                  opacity: [0.62, 1, 0.62],
                }
          }
          transition={{
            duration: 12,
            repeat: Infinity,
            ease: "easeInOut",
          }}
          className="
            absolute
            left-1/2
            top-[18%]
            h-[650px]
            w-[900px]
            -translate-x-1/2
            rounded-full
            blur-[110px]
          "
          style={{
            background:
              "radial-gradient(circle, hsla(189.16,79.17%,47.06%,0.12) 0%, hsla(189.16,79.17%,47.06%,0.06) 38%, transparent 72%)",
          }}
        />

        {/* =================================================
            LEFT LIGHT
        ================================================= */}

        <div
          className="
            absolute
            -left-[180px]
            top-[32%]
            h-[520px]
            w-[520px]
            rounded-full
            blur-[120px]
          "
          style={{
            background:
              "radial-gradient(circle, hsla(189.16,79.17%,47.06%,0.095) 0%, transparent 70%)",
          }}
        />

        {/* =================================================
            RIGHT LIGHT
        ================================================= */}

        <div
          className="
            absolute
            -right-[180px]
            top-[38%]
            h-[520px]
            w-[520px]
            rounded-full
            blur-[120px]
          "
          style={{
            background:
              "radial-gradient(circle, hsla(189.16,79.17%,47.06%,0.085) 0%, transparent 70%)",
          }}
        />

        {/* =================================================
            LIGHT PRIMARY GRID
        ================================================= */}

        <div
          className="absolute inset-0 dark:hidden"
          style={{
            opacity: 0.44,
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
            backgroundSize: "64px 64px",
            maskImage:
              "linear-gradient(to bottom, black 0%, black 88%, transparent 100%)",
            WebkitMaskImage:
              "linear-gradient(to bottom, black 0%, black 88%, transparent 100%)",
          }}
        />

        {/* =================================================
            LIGHT SECONDARY GRID
        ================================================= */}

        <div
          className="absolute inset-0 dark:hidden"
          style={{
            opacity: 0.12,
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
            backgroundSize: "128px 128px",
          }}
        />

        {/* =================================================
            DARK PRIMARY GRID
        ================================================= */}

        <div
          className="absolute inset-0 hidden dark:block"
          style={{
            opacity: 0.26,
            backgroundImage: `
              linear-gradient(
                hsla(189.16,79.17%,47.06%,0.24) 1px,
                transparent 1px
              ),
              linear-gradient(
                90deg,
                hsla(189.16,79.17%,47.06%,0.24) 1px,
                transparent 1px
              )
            `,
            backgroundSize: "64px 64px",
            maskImage:
              "linear-gradient(to bottom, black 0%, black 90%, transparent 100%)",
            WebkitMaskImage:
              "linear-gradient(to bottom, black 0%, black 90%, transparent 100%)",
          }}
        />

        {/* =================================================
            DARK VIGNETTE
        ================================================= */}

        <div className="absolute inset-0 hidden bg-gradient-to-b from-transparent via-transparent to-black/10 dark:block" />

        {/* =================================================
            CENTRAL HAZE
        ================================================= */}

        <div
          className="
            absolute
            left-1/2
            top-[46%]
            h-[460px]
            w-[860px]
            -translate-x-1/2
            rounded-full
            blur-[130px]
          "
          style={{
            background:
              "radial-gradient(circle, hsla(189.16,79.17%,47.06%,0.075) 0%, hsla(189.16,79.17%,47.06%,0.025) 46%, transparent 74%)",
          }}
        />
      </div>

      {/* =====================================================
          CONTENT
      ===================================================== */}

      <div className="relative z-10 mx-auto max-w-[1600px] px-4 py-20 sm:px-6 lg:px-16 lg:py-28">
        {/* =====================================================
            HEADER
        ===================================================== */}

        <div className="flex flex-col items-center text-center">
          <NeuralTitle reduceMotion={Boolean(reduceMotion)} />

          <motion.p
            initial={
              reduceMotion
                ? undefined
                : { opacity: 0, y: 15 }
            }
            whileInView={{
              opacity: 1,
              y: 0,
            }}
            viewport={{
              once: true,
              amount: 0.5,
            }}
            transition={{
              delay: 0.18,
              duration: 0.7,
            }}
            className="
              mt-9
              max-w-2xl
              text-sm
              leading-7
              text-slate-600
              dark:text-white/48
              sm:text-base
            "
          >
            One creative engine for architecture, real estate
            and visualization. Explore how Renderuim
            transforms the way visual content is created.
          </motion.p>

          <motion.div
            initial={
              reduceMotion
                ? undefined
                : { opacity: 0 }
            }
            whileInView={{
              opacity: 1,
            }}
            viewport={{
              once: true,
            }}
            transition={{
              delay: 0.32,
            }}
            className="
              mt-4
              flex
              items-center
              gap-3
              font-mono
              text-[8px]
              uppercase
              tracking-[0.3em]
              text-slate-400
              dark:text-white/25
            "
          >
            <span className="h-px w-8 bg-black/10 dark:bg-white/10" />

            <span>Select a workflow</span>

            <span className="h-px w-8 bg-black/10 dark:bg-white/10" />
          </motion.div>

          {/* ==================================================
              TITLE → USE CASES BRIDGE
          ================================================== */}

          <TitleToCasesCircuit
            reduceMotion={Boolean(reduceMotion)}
          />
        </div>

        {/* =====================================================
            SHOWCASE
        ===================================================== */}

        <div
          className="
            relative
            mt-7
            flex
            flex-col
            gap-5
            lg:mt-2
            lg:flex-row
            lg:gap-5
          "
          onMouseEnter={() => setIsPaused(true)}
          onMouseLeave={() => setIsPaused(false)}
          onFocusCapture={() => setIsPaused(true)}
          onBlurCapture={() => setIsPaused(false)}
        >
          {/* =================================================
              DESKTOP VISUAL
          ================================================= */}

          <div className="relative hidden min-h-[640px] flex-1 lg:flex">
            <VisualStage
              activeCase={activeCase}
              reduceMotion={Boolean(reduceMotion)}
            />
          </div>

          {/* =================================================
              MOBILE VISUAL
          ================================================= */}

          <MobileVisual
            activeCase={activeCase}
            reduceMotion={Boolean(reduceMotion)}
          />

          {/* =================================================
              NAVIGATION
          ================================================= */}

          <UseCaseNavigation
            activeIndex={activeIndex}
            setActiveIndex={setActiveIndex}
            isPaused={isPaused}
            reduceMotion={Boolean(reduceMotion)}
          />
        </div>

        {/* =====================================================
            STATUS BAR
        ===================================================== */}

        <div
          className="
            mt-7
            flex
            items-center
            justify-between
            border-t
            border-black/[0.07]
            pt-5
            dark:border-white/[0.07]
          "
        >
          <div className="flex items-center gap-3">
            <div
              className="
                relative
                flex
                h-5
                w-5
                items-center
                justify-center
                rounded-full
                border
                border-black/[0.07]
                bg-white/55
                dark:border-white/[0.07]
                dark:bg-white/[0.02]
              "
            >
              <Scan className="h-3 w-3 text-slate-500 dark:text-white/30" />

              <span
                className="absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full"
                style={{
                  background: BRAND_CYAN,
                  boxShadow:
                    "0 0 8px rgba(103,232,249,.7)",
                }}
              />
            </div>

            <span
              className="
                font-mono
                text-[8px]
                uppercase
                tracking-[0.25em]
                text-slate-500
                dark:text-white/28
              "
            >
              Renderuim / Workflow Engine
            </span>
          </div>

          <div className="flex items-center gap-3">
            <div
              className="
                h-px
                w-16
                overflow-hidden
                bg-black/10
                dark:bg-white/10
                sm:w-24
              "
            >
              <motion.div
                animate={{ width: progress }}
                transition={{
                  duration: 0.55,
                  ease: "easeOut",
                }}
                className="h-full"
                style={{
                  background: BRAND_CYAN,
                  boxShadow:
                    "0 0 10px rgba(103,232,249,.5)",
                }}
              />
            </div>

            <span
              className="
                font-mono
                text-[8px]
                text-slate-400
                dark:text-white/25
              "
            >
              {activeCase.number} / 04
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ============================================================
   TITLE → CASES CIRCUIT
============================================================ */

function TitleToCasesCircuit({
  reduceMotion,
}: {
  reduceMotion: boolean;
}) {
  return (
    <div
      aria-hidden="true"
      className="
        pointer-events-none
        relative
        mt-6
        h-[68px]
        w-full
        max-w-[1200px]
        overflow-visible
      "
    >
      {/* =================================================
          DESKTOP
      ================================================= */}

      <svg
        viewBox="0 0 1200 68"
        preserveAspectRatio="none"
        className="
          absolute
          inset-0
          hidden
          h-full
          w-full
          lg:block
        "
      >
        <defs>
          <filter
            id="usecase-bridge-glow"
            x="-100%"
            y="-100%"
            width="300%"
            height="300%"
          >
            <feGaussianBlur
              stdDeviation="3"
              result="blur"
            />

            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* base */}
        <path
          d="M600 0 V18 H1010 V68"
          fill="none"
          stroke="rgba(15,23,42,.10)"
          strokeWidth="1"
          className="dark:hidden"
        />

        <path
          d="M600 0 V18 H1010 V68"
          fill="none"
          stroke="rgba(255,255,255,.10)"
          strokeWidth="1"
          className="hidden dark:block"
        />

        {/* secondary guide */}
        <path
          d="M600 18 H430"
          fill="none"
          stroke="rgba(103,232,249,.10)"
          strokeWidth="1"
          strokeDasharray="2 8"
        />

        {/* signal */}
        {!reduceMotion && (
          <motion.path
            d="M600 0 V18 H1010 V68"
            fill="none"
            stroke={BRAND_CYAN}
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeDasharray="22 999"
            animate={{
              strokeDashoffset: [0, -430],
              opacity: [0, 1, 0],
            }}
            transition={{
              duration: 2.8,
              repeat: Infinity,
              ease: "linear",
            }}
            filter="url(#usecase-bridge-glow)"
          />
        )}

        {/* junctions */}
        <circle
          cx="600"
          cy="18"
          r="2"
          fill={BRAND_CYAN}
          opacity=".8"
        />

        <circle
          cx="1010"
          cy="18"
          r="3"
          fill={BRAND_CYAN}
        />

        <circle
          cx="1010"
          cy="68"
          r="2.5"
          fill={BRAND_CYAN}
        />
      </svg>

      {/* =================================================
          MOBILE
      ================================================= */}

      <svg
        viewBox="0 0 100 68"
        preserveAspectRatio="none"
        className="
          absolute
          inset-0
          h-full
          w-full
          lg:hidden
        "
      >
        <path
          d="M50 0 V68"
          fill="none"
          stroke="rgba(15,23,42,.10)"
          strokeWidth="1"
          className="dark:hidden"
        />

        <path
          d="M50 0 V68"
          fill="none"
          stroke="rgba(255,255,255,.10)"
          strokeWidth="1"
          className="hidden dark:block"
        />

        {!reduceMotion && (
          <motion.path
            d="M50 0 V68"
            fill="none"
            stroke={BRAND_CYAN}
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeDasharray="10 58"
            animate={{
              strokeDashoffset: [0, -68],
              opacity: [0.15, 1, 0.15],
            }}
            transition={{
              duration: 2.2,
              repeat: Infinity,
              ease: "linear",
            }}
            style={{
              filter:
                "drop-shadow(0 0 5px rgba(103,232,249,.75))",
            }}
          />
        )}

        <circle
          cx="50"
          cy="66"
          r="2"
          fill={BRAND_CYAN}
        />
      </svg>
    </div>
  );
}

/* ============================================================
   USE CASE NAVIGATION
============================================================ */

function UseCaseNavigation({
  activeIndex,
  setActiveIndex,
  isPaused,
  reduceMotion,
}: {
  activeIndex: number;
  setActiveIndex: (index: number) => void;
  isPaused: boolean;
  reduceMotion: boolean;
}) {
  return (
    <div className="relative flex w-full flex-col lg:w-[410px]">
      {/* =================================================
          MAIN RAIL
      ================================================= */}

      <div
        aria-hidden="true"
        className="
          pointer-events-none
          absolute
          left-[11px]
          top-[12px]
          bottom-[12px]
          hidden
          w-px
          bg-black/[0.10]
          dark:bg-white/[0.09]
          sm:block
        "
      />

      {/* rail glow */}
      <div
        aria-hidden="true"
        className="
          pointer-events-none
          absolute
          left-[10px]
          top-0
          bottom-0
          hidden
          w-[3px]
          bg-gradient-to-b
          from-transparent
          via-cyan-400/[0.08]
          to-transparent
          sm:block
        "
      />

      {/* travelling energy */}
      {!reduceMotion && (
        <motion.div
          aria-hidden="true"
          animate={{
            top: [
              "8px",
              "calc(100% - 18px)",
            ],
            opacity: [0, 1, 1, 0],
          }}
          transition={{
            duration: 5,
            repeat: Infinity,
            ease: "linear",
          }}
          className="
            pointer-events-none
            absolute
            left-[9px]
            z-30
            hidden
            h-12
            w-[3px]
            rounded-full
            bg-gradient-to-b
            from-transparent
            via-cyan-400
            to-transparent
            shadow-[0_0_18px_5px_rgba(103,232,249,.45)]
            dark:via-cyan-300
            dark:shadow-[0_0_20px_6px_rgba(103,232,249,.70)]
            sm:block
          "
        />
      )}

      <div className="relative flex flex-col gap-2 sm:pl-7 lg:gap-3">
        {USE_CASES.map((item, index) => {
          const isActive = index === activeIndex;
          const Icon = item.icon;

          return (
            <div
              key={item.number}
              className="relative"
            >
              {/* =================================================
                  INPUT NODE
              ================================================= */}

              <motion.div
                aria-hidden="true"
                animate={
                  reduceMotion
                    ? undefined
                    : {
                        scale: isActive
                          ? [0.8, 1.18, 0.8]
                          : 1,
                        opacity: isActive
                          ? [0.45, 1, 0.45]
                          : 0.5,
                      }
                }
                transition={{
                  duration: 1.8,
                  repeat: isActive
                    ? Infinity
                    : 0,
                  ease: "easeInOut",
                }}
                className="
                  absolute
                  left-[5px]
                  top-[30px]
                  z-40
                  hidden
                  h-3
                  w-3
                  -translate-x-1/2
                  -translate-y-1/2
                  rounded-full
                  border
                  bg-white
                  sm:block
                  dark:bg-[#07090b]
                "
                style={{
                  borderColor: isActive
                    ? "rgba(103,232,249,.55)"
                    : "rgba(103,232,249,.22)",
                  boxShadow: isActive
                    ? "0 0 14px rgba(103,232,249,.28)"
                    : undefined,
                }}
              >
                <span
                  className="absolute left-1/2 top-1/2 h-1 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full"
                  style={{
                    background: BRAND_CYAN,
                    boxShadow:
                      "0 0 10px 3px rgba(103,232,249,.6)",
                  }}
                />
              </motion.div>

              {/* horizontal signal */}
              {isActive && !reduceMotion && (
                <motion.div
                  aria-hidden="true"
                  animate={{
                    x: ["-100%", "0%"],
                    opacity: [0, 1, 0],
                  }}
                  transition={{
                    duration: 1.5,
                    repeat: Infinity,
                    ease: "linear",
                  }}
                  className="
                    pointer-events-none
                    absolute
                    left-0
                    top-[30px]
                    z-30
                    hidden
                    h-[2px]
                    w-11
                    -translate-y-1/2
                    rounded-full
                    bg-gradient-to-r
                    from-transparent
                    via-cyan-400
                    to-transparent
                    shadow-[0_0_15px_4px_rgba(103,232,249,.5)]
                    dark:via-cyan-300
                    sm:block
                  "
                />
              )}

              <button
                type="button"
                onClick={() => setActiveIndex(index)}
                aria-pressed={isActive}
                className="group relative block w-full text-left outline-none"
              >
                <motion.div
                  layout
                  animate={{
                    x: isActive ? 4 : 0,
                  }}
                  transition={{
                    type: "spring",
                    stiffness: 320,
                    damping: 28,
                  }}
                  className={`
                    relative
                    overflow-hidden
                    rounded-[24px]
                    border
                    p-4
                    transition-all
                    duration-500
                    sm:p-5
                    lg:rounded-[26px]
                    lg:p-6
                    ${
                      isActive
                        ? `
                          border-black/[0.08]
                          bg-[#080b0d]
                          text-white
                          shadow-[0_22px_65px_rgba(0,0,0,.13)]
                          dark:border-cyan-300/[0.16]
                          dark:bg-[#0a0e11]
                          dark:text-white
                          dark:shadow-[0_24px_70px_rgba(0,0,0,.38)]
                        `
                        : `
                          border-black/[0.065]
                          bg-white/[0.45]
                          text-slate-950
                          shadow-[0_14px_35px_rgba(15,23,42,.025)]
                          hover:border-black/[0.12]
                          hover:bg-white/[0.70]
                          dark:border-white/[0.065]
                          dark:bg-white/[0.025]
                          dark:text-white
                          dark:hover:border-white/[0.11]
                          dark:hover:bg-white/[0.045]
                        `
                    }
                  `}
                >
                  {/* =================================================
                      ACTIVE EDGE
                  ================================================= */}

                  {isActive && (
                    <>
                      <motion.div
                        layoutId="use-case-active-edge"
                        className="
                          pointer-events-none
                          absolute
                          bottom-0
                          left-0
                          top-0
                          w-[2px]
                          bg-cyan-300
                        "
                        style={{
                          boxShadow:
                            "0 0 14px 2px rgba(103,232,249,.42)",
                        }}
                      />

                      <div
                        className="
                          pointer-events-none
                          absolute
                          left-4
                          right-4
                          top-0
                          h-px
                        "
                        style={{
                          background:
                            "linear-gradient(90deg, transparent, rgba(103,232,249,.60), transparent)",
                        }}
                      />

                      <div
                        className="
                          pointer-events-none
                          absolute
                          -right-16
                          -top-20
                          h-36
                          w-36
                          rounded-full
                          blur-[55px]
                        "
                        style={{
                          background:
                            "rgba(103,232,249,.09)",
                        }}
                      />
                    </>
                  )}

                  <div className="relative z-10">
                    {/* =================================================
                        TOP ROW
                    ================================================= */}

                    <div className="flex items-center justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <span
                          className={`
                            shrink-0
                            font-mono
                            text-[9px]
                            ${
                              isActive
                                ? "text-white/35"
                                : "text-slate-400 dark:text-white/22"
                            }
                          `}
                        >
                          {item.number}
                        </span>

                        <div
                          className="
                            flex
                            h-9
                            w-9
                            shrink-0
                            items-center
                            justify-center
                            rounded-xl
                            border
                          "
                          style={{
                            borderColor: isActive
                              ? "rgba(103,232,249,.18)"
                              : "rgba(15,23,42,.08)",
                            background: isActive
                              ? "rgba(103,232,249,.055)"
                              : "rgba(15,23,42,.02)",
                          }}
                        >
                          <Icon
                            className="h-4 w-4"
                            style={{
                              color: isActive
                                ? BRAND_CYAN
                                : undefined,
                            }}
                          />
                        </div>

                        <div className="min-w-0">
                          <h3
                            className={`
                              truncate
                              text-lg
                              font-semibold
                              tracking-[-0.035em]
                              sm:text-xl
                              lg:text-[23px]
                              ${
                                isActive
                                  ? "text-white"
                                  : "text-slate-900 dark:text-white/82"
                              }
                            `}
                          >
                            {item.title}
                          </h3>

                          <div
                            className={`
                              mt-0.5
                              truncate
                              text-[8px]
                              font-bold
                              uppercase
                              tracking-[0.2em]
                              ${
                                isActive
                                  ? "text-white/35"
                                  : "text-slate-400 dark:text-white/22"
                              }
                            `}
                          >
                            {item.label}
                          </div>
                        </div>
                      </div>

                      <motion.div
                        animate={{
                          rotate: isActive ? 45 : 0,
                        }}
                        transition={{
                          duration: 0.3,
                        }}
                        className="shrink-0"
                      >
                        <ArrowUpRight
                          className={`h-4 w-4 sm:h-5 sm:w-5 ${
                            isActive
                              ? "text-cyan-300"
                              : "text-slate-300 dark:text-white/20"
                          }`}
                        />
                      </motion.div>
                    </div>

                    {/* =================================================
                        DESCRIPTION
                    ================================================= */}

                    <AnimatePresence initial={false}>
                      {isActive && (
                        <motion.div
                          initial={{
                            opacity: 0,
                            height: 0,
                          }}
                          animate={{
                            opacity: 1,
                            height: "auto",
                          }}
                          exit={{
                            opacity: 0,
                            height: 0,
                          }}
                          transition={{
                            duration: 0.42,
                            ease: [
                              0.16,
                              1,
                              0.3,
                              1,
                            ],
                          }}
                          className="overflow-hidden"
                        >
                          <p
                            className="
                              max-w-[340px]
                              pt-3
                              text-xs
                              leading-5
                              text-white/52
                              sm:pt-4
                              sm:text-sm
                              sm:leading-6
                            "
                          >
                            {item.description}
                          </p>

                          {/* =================================================
                              STEPS
                          ================================================= */}

                          <div className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-1.5 sm:mt-5">
                            {item.steps.map(
                              (
                                step,
                                stepIndex,
                              ) => (
                                <div
                                  key={step}
                                  className="flex items-center"
                                >
                                  <span className="font-mono text-[7px] tracking-[0.13em] text-white/42 sm:text-[8px]">
                                    {step}
                                  </span>

                                  {stepIndex <
                                    item.steps.length -
                                      1 && (
                                    <span className="mx-1.5 h-px w-2 bg-white/12 sm:mx-2 sm:w-3" />
                                  )}
                                </div>
                              ),
                            )}
                          </div>

                          {/* =================================================
                              METRIC / WORKFLOW
                          ================================================= */}

                          <div className="mt-4 flex items-center justify-between gap-3 sm:mt-5">
                            <span
                              className="
                                rounded-full
                                border
                                border-cyan-300/20
                                bg-cyan-300/[0.045]
                                px-2.5
                                py-1
                                font-mono
                                text-[7px]
                                uppercase
                                tracking-[0.16em]
                                text-cyan-300
                              "
                            >
                              {item.metric}
                            </span>

                            <span className="font-mono text-[7px] uppercase tracking-[0.16em] text-white/20">
                              WORKFLOW
                            </span>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* =================================================
                        PROGRESS
                    ================================================= */}

                    <div
                      className={`
                        mt-4
                        h-px
                        overflow-hidden
                        sm:mt-5
                        ${
                          isActive
                            ? "bg-white/10"
                            : "bg-black/[0.045] dark:bg-white/[0.045]"
                        }
                      `}
                    >
                      {isActive && (
                        <motion.div
                          key={`${activeIndex}-${isPaused}`}
                          initial={{
                            width: "0%",
                          }}
                          animate={{
                            width: isPaused
                              ? "34%"
                              : "100%",
                          }}
                          transition={{
                            duration: isPaused
                              ? 0.25
                              : AUTO_DELAY /
                                1000,
                            ease: "linear",
                          }}
                          className="h-full"
                          style={{
                            background:
                              BRAND_CYAN,
                            boxShadow:
                              "0 0 12px rgba(103,232,249,.55)",
                          }}
                        />
                      )}
                    </div>
                  </div>
                </motion.div>
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ============================================================
   NEURAL TITLE
============================================================ */

function NeuralTitle({
  reduceMotion,
}: {
  reduceMotion: boolean;
}) {
  return (
    <motion.div
      initial={
        reduceMotion
          ? undefined
          : {
              opacity: 0,
              y: 24,
              filter: "blur(12px)",
            }
      }
      whileInView={{
        opacity: 1,
        y: 0,
        filter: "blur(0px)",
      }}
      viewport={{
        once: true,
        amount: 0.5,
      }}
      transition={{
        duration: 0.9,
        ease: [0.16, 1, 0.3, 1],
      }}
      className="relative"
    >
      {/* =================================================
          TITLE UNIT
      ================================================= */}

      <div className="relative flex items-center">
        {/* left circuit */}
        <div className="relative mr-3 hidden h-[72px] w-20 sm:block">
          <CircuitTrack
            reverse={false}
            reduceMotion={reduceMotion}
          />

          <CircuitNode className="left-0 top-1/2" />
          <CircuitNode className="right-0 top-1/2" />

          <div className="absolute right-0 top-1/2 h-8 w-px -translate-y-1/2 bg-black/10 dark:bg-white/12" />
        </div>

        {/* USE */}
        <CircuitBox
          label="USE"
          reduceMotion={reduceMotion}
        />

        {/* CENTER */}
        <div className="relative h-[72px] w-12 sm:w-20 lg:w-28">
          <div className="absolute left-0 right-0 top-1/2 h-px bg-black/12 dark:bg-white/16" />

          <div className="absolute left-1/2 top-0 h-full w-px bg-black/[0.05] dark:bg-white/[0.05]" />

          <div className="absolute left-1/2 top-0 h-5 w-px bg-black/10 dark:bg-white/12" />

          <div className="absolute bottom-0 left-1/2 h-5 w-px bg-black/10 dark:bg-white/12" />

          <ElectricalPulse
            reduceMotion={reduceMotion}
          />

          <CircuitNode className="left-0 top-1/2" />
          <CircuitNode className="right-0 top-1/2" />

          <div
            className="absolute left-1/2 top-0 h-1.5 w-1.5 -translate-x-1/2 rounded-full"
            style={{
              background: BRAND_CYAN,
              boxShadow:
                "0 0 8px rgba(103,232,249,.45)",
            }}
          />

          <div
            className="absolute bottom-0 left-1/2 h-1.5 w-1.5 -translate-x-1/2 rounded-full"
            style={{
              background: BRAND_CYAN,
            }}
          />
        </div>

        {/* CASES */}
        <CircuitBox
          label="CASES"
          reduceMotion={reduceMotion}
        />

        {/* right circuit */}
        <div className="relative ml-3 hidden h-[72px] w-20 sm:block">
          <CircuitTrack
            reverse
            reduceMotion={reduceMotion}
          />

          <CircuitNode className="left-0 top-1/2" />
          <CircuitNode className="right-0 top-1/2" />

          <div className="absolute left-0 top-1/2 h-8 w-px -translate-y-1/2 bg-black/10 dark:bg-white/12" />
        </div>
      </div>

      {/* =================================================
          STATUS
      ================================================= */}

      <div className="mt-5 flex items-center justify-center gap-3">
        {!reduceMotion ? (
          <motion.span
            animate={{
              opacity: [0.25, 1, 0.25],
              boxShadow: [
                "0 0 0 rgba(103,232,249,0)",
                "0 0 14px rgba(103,232,249,.85)",
                "0 0 0 rgba(103,232,249,0)",
              ],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
            }}
            className="h-1.5 w-1.5 rounded-full bg-cyan-400"
          />
        ) : (
          <span
            className="h-1.5 w-1.5 rounded-full"
            style={{
              background: BRAND_CYAN,
            }}
          />
        )}

        <span className="font-mono text-[8px] uppercase tracking-[0.35em] text-slate-400 dark:text-white/24">
          Neural workflow / active
        </span>

        <span className="h-px w-8 bg-black/10 dark:bg-white/10" />

        <span className="font-mono text-[8px] text-slate-300 dark:text-white/18">
          01—04
        </span>
      </div>
    </motion.div>
  );
}

/* ============================================================
   CIRCUIT BOX
============================================================ */

function CircuitBox({
  label,
  reduceMotion,
}: {
  label: string;
  reduceMotion: boolean;
}) {
  return (
    <motion.div
      whileHover={
        reduceMotion
          ? undefined
          : {
              y: -3,
              scale: 1.012,
            }
      }
      transition={{
        type: "spring",
        stiffness: 400,
        damping: 25,
      }}
      className="
        group
        relative
        h-[72px]
        overflow-hidden
        rounded-[19px]
        border
        border-black/[0.11]
        bg-white/55
        px-6
        shadow-[0_18px_50px_rgba(15,23,42,.045)]
        backdrop-blur-xl
        dark:border-white/[0.12]
        dark:bg-[#0a0d10]
        dark:shadow-[0_20px_60px_rgba(0,0,0,.30)]
        sm:px-9
        lg:px-12
      "
    >
      {/* interior glow */}
      <div className="pointer-events-none absolute inset-0 rounded-[19px] opacity-0 transition-opacity duration-500 group-hover:opacity-100">
        <div
          className="absolute inset-0 rounded-[19px]"
          style={{
            background:
              "radial-gradient(circle at 50% 0%, rgba(103,232,249,.07), transparent 62%)",
          }}
        />

        <div
          className="absolute inset-0 rounded-[19px]"
          style={{
            boxShadow:
              "inset 0 0 36px rgba(103,232,249,.055)",
          }}
        />
      </div>

      {/* top rail */}
      <div
        className="
          absolute
          left-5
          right-5
          top-0
          h-px
          bg-gradient-to-r
          from-transparent
          via-black/15
          to-transparent
          dark:via-white/18
        "
      />

      {/* bottom rail */}
      <div
        className="
          absolute
          bottom-0
          left-5
          right-5
          h-px
          bg-gradient-to-r
          from-transparent
          via-black/10
          to-transparent
          dark:via-white/10
        "
      />

      {/* corners */}
      <div className="absolute left-2 top-2 h-1 w-1 rounded-full bg-black/20 dark:bg-white/25" />
      <div className="absolute right-2 top-2 h-1 w-1 rounded-full bg-black/20 dark:bg-white/25" />
      <div className="absolute bottom-2 left-2 h-1 w-1 rounded-full bg-black/15 dark:bg-white/18" />
      <div className="absolute bottom-2 right-2 h-1 w-1 rounded-full bg-black/15 dark:bg-white/18" />

      {/* label */}
      <div className="relative flex h-full items-center justify-center">
        <span className="text-[25px] font-black tracking-[-0.055em] text-slate-950 dark:text-white sm:text-[34px] lg:text-[43px]">
          {label}
        </span>
      </div>

      {/* electrical sweep */}
      {!reduceMotion && (
        <motion.div
          animate={{
            x: ["-150%", "250%"],
          }}
          transition={{
            duration: 3.5,
            repeat: Infinity,
            ease: "linear",
          }}
          className="
            absolute
            bottom-0
            left-0
            h-px
            w-16
            bg-gradient-to-r
            from-transparent
            via-cyan-500
            to-transparent
            shadow-[0_0_12px_2px_rgba(103,232,249,.45)]
            dark:via-cyan-300
            dark:shadow-[0_0_12px_2px_rgba(103,232,249,.65)]
          "
        />
      )}
    </motion.div>
  );
}

/* ============================================================
   ELECTRICAL PULSE
============================================================ */

function ElectricalPulse({
  reduceMotion,
}: {
  reduceMotion: boolean;
}) {
  if (reduceMotion) return null;

  return (
    <>
      <motion.div
        animate={{
          x: ["-20%", "120%"],
          opacity: [0, 1, 1, 0],
        }}
        transition={{
          duration: 1.8,
          repeat: Infinity,
          ease: "linear",
        }}
        className="
          absolute
          left-0
          top-1/2
          h-[3px]
          w-8
          rounded-full
          bg-cyan-500
          shadow-[0_0_12px_3px_rgba(103,232,249,.55)]
          dark:bg-cyan-300
          dark:shadow-[0_0_12px_3px_rgba(103,232,249,.85)]
        "
      />

      <motion.div
        animate={{
          x: ["-20%", "120%"],
          opacity: [0, 0.75, 0],
        }}
        transition={{
          duration: 1.8,
          delay: 0.9,
          repeat: Infinity,
          ease: "linear",
        }}
        className="
          absolute
          left-0
          top-[calc(50%+6px)]
          h-px
          w-5
          bg-blue-500
          shadow-[0_0_10px_2px_rgba(59,130,246,.45)]
          dark:bg-blue-400
        "
      />
    </>
  );
}

/* ============================================================
   CIRCUIT TRACK
============================================================ */

function CircuitTrack({
  reverse = false,
  reduceMotion,
}: {
  reverse?: boolean;
  reduceMotion: boolean;
}) {
  return (
    <>
      <div
        className="
          absolute
          left-0
          top-1/2
          h-px
          w-full
          bg-black/10
          dark:bg-white/12
        "
      />

      {!reduceMotion && (
        <motion.div
          animate={{
            x: reverse
              ? ["70%", "0%", "70%"]
              : ["0%", "70%", "0%"],
            opacity: [0, 1, 0],
          }}
          transition={{
            duration: 2.2,
            repeat: Infinity,
            ease: "linear",
          }}
          className="
            absolute
            top-1/2
            h-[2px]
            w-7
            bg-cyan-500
            shadow-[0_0_14px_4px_rgba(103,232,249,.45)]
            dark:bg-cyan-300
            dark:shadow-[0_0_14px_4px_rgba(103,232,249,.7)]
          "
        />
      )}
    </>
  );
}

/* ============================================================
   CIRCUIT NODE
============================================================ */

function CircuitNode({
  className,
}: {
  className: string;
}) {
  return (
    <div
      className={`
        absolute
        z-20
        -translate-x-1/2
        -translate-y-1/2
        ${className}
      `}
    >
      <motion.div
        animate={{
          scale: [0.8, 1.2, 0.8],
          opacity: [0.48, 1, 0.48],
        }}
        transition={{
          duration: 2,
          repeat: Infinity,
          ease: "easeInOut",
        }}
        className="
          relative
          h-3
          w-3
          rounded-full
          border
          bg-white
          dark:bg-[#080a0c]
        "
        style={{
          borderColor:
            "rgba(103,232,249,.35)",
        }}
      >
        <div
          className="
            absolute
            left-1/2
            top-1/2
            h-1
            w-1
            -translate-x-1/2
            -translate-y-1/2
            rounded-full
          "
          style={{
            background: BRAND_CYAN,
            boxShadow:
              "0 0 10px 3px rgba(103,232,249,.55)",
          }}
        />
      </motion.div>
    </div>
  );
}

/* ============================================================
   DESKTOP VISUAL
============================================================ */

function VisualStage({
  activeCase,
  reduceMotion,
}: {
  activeCase: UseCase;
  reduceMotion: boolean;
}) {
  return (
    <div
      className="
        relative
        h-full
        w-full
        overflow-hidden
        rounded-[40px]
        border
        border-black/[0.07]
        bg-white/[0.30]
        p-[2px]
        shadow-[0_30px_90px_rgba(15,23,42,.06)]
        dark:border-white/[0.09]
        dark:bg-[#080a0c]
        dark:shadow-[0_35px_100px_rgba(0,0,0,.42)]
      "
    >
      {/* =================================================
          ROTATING BORDER
      ================================================= */}

      {!reduceMotion && (
        <motion.div
          animate={{ rotate: 360 }}
          transition={{
            duration: 9,
            repeat: Infinity,
            ease: "linear",
          }}
          className="
            pointer-events-none
            absolute
            -inset-[90%]
            bg-[conic-gradient(from_0deg,transparent_0deg,transparent_285deg,rgba(103,232,249,.42)_320deg,transparent_358deg)]
            opacity-35
            dark:opacity-30
          "
        />
      )}

      <div
        className="
          relative
          h-full
          overflow-hidden
          rounded-[38px]
          bg-[#edf2f4]
          dark:bg-[#080a0c]
        "
      >
        {/* =================================================
            IMAGE
        ================================================= */}

        <AnimatePresence mode="wait">
          <motion.div
            key={activeCase.number}
            initial={{
              opacity: 0,
              scale: 1.045,
              filter: "blur(14px)",
            }}
            animate={{
              opacity: 1,
              scale: 1,
              filter: "blur(0px)",
            }}
            exit={{
              opacity: 0,
              scale: 0.975,
              filter: "blur(10px)",
            }}
            transition={{
              duration: 0.8,
              ease: [0.16, 1, 0.3, 1],
            }}
            className="absolute inset-0"
          >
            <img
              src={activeCase.image}
              alt={activeCase.title}
              className="h-full w-full object-cover"
            />

            {/* image contrast */}
            <div className="absolute inset-0 bg-black/[0.18] dark:bg-black/[0.28]" />

            <div className="absolute inset-0 bg-[radial-gradient(circle_at_62%_42%,transparent_0%,rgba(0,0,0,.06)_42%,rgba(0,0,0,.42)_100%)] dark:bg-[radial-gradient(circle_at_62%_42%,transparent_0%,rgba(0,0,0,.18)_42%,rgba(0,0,0,.74)_100%)]" />

            {/* =================================================
                ARCHITECTURAL GRID
            ================================================= */}

            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0"
              style={{
                opacity: 0.095,
                backgroundImage: `
                  linear-gradient(
                    rgba(255,255,255,.95) 1px,
                    transparent 1px
                  ),
                  linear-gradient(
                    90deg,
                    rgba(255,255,255,.95) 1px,
                    transparent 1px
                  )
                `,
                backgroundSize:
                  "56px 56px",
                maskImage:
                  "linear-gradient(to bottom, transparent 0%, black 12%, black 82%, transparent 100%)",
                WebkitMaskImage:
                  "linear-gradient(to bottom, transparent 0%, black 12%, black 82%, transparent 100%)",
              }}
            />

            {/* cyan technical grid glow */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 opacity-[0.06]"
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
                backgroundSize:
                  "224px 224px",
              }}
            />

            {/* =================================================
                SCAN LINE
            ================================================= */}

            {!reduceMotion && (
              <motion.div
                animate={{
                  y: ["-5%", "680%"],
                }}
                transition={{
                  duration: 5.5,
                  repeat: Infinity,
                  ease: "linear",
                }}
                className="
                  absolute
                  left-0
                  top-0
                  h-px
                  w-full
                  bg-cyan-300/60
                  shadow-[0_0_28px_7px_rgba(103,232,249,.10)]
                "
              />
            )}

            {/* =================================================
                TECHNICAL TARGETS
            ================================================= */}

            <TechnicalNode
              className="left-[13%] top-[23%]"
              delay={0}
              reduceMotion={reduceMotion}
            />

            <TechnicalNode
              className="right-[20%] top-[30%]"
              delay={0.7}
              reduceMotion={reduceMotion}
            />

            <TechnicalNode
              className="left-[33%] bottom-[28%]"
              delay={1.25}
              reduceMotion={reduceMotion}
            />

            <TechnicalNode
              className="right-[15%] bottom-[18%]"
              delay={1.9}
              reduceMotion={reduceMotion}
            />

            {/* =================================================
                CONNECTION PATHS
            ================================================= */}

            <svg
              className="
                pointer-events-none
                absolute
                inset-0
                h-full
                w-full
                opacity-45
              "
              viewBox="0 0 1000 700"
              preserveAspectRatio="none"
            >
              <path
                d="M130 160 C300 100 350 320 520 280 S750 200 850 220"
                fill="none"
                stroke="rgba(103,232,249,.22)"
                strokeWidth="1"
                strokeDasharray="3 10"
              />

              <path
                d="M280 500 C400 430 500 520 650 440 S800 350 900 390"
                fill="none"
                stroke="rgba(103,232,249,.14)"
                strokeWidth="1"
                strokeDasharray="2 12"
              />

              {!reduceMotion && (
                <>
                  <motion.circle
                    r="3"
                    fill={BRAND_CYAN}
                    animate={{
                      opacity: [0.15, 1, 0.15],
                    }}
                  >
                    <animateMotion
                      dur="5s"
                      repeatCount="indefinite"
                      path="M130 160 C300 100 350 320 520 280 S750 200 850 220"
                    />
                  </motion.circle>

                  <motion.circle
                    r="2.5"
                    fill="#60a5fa"
                    animate={{
                      opacity: [0.1, 0.9, 0.1],
                    }}
                  >
                    <animateMotion
                      dur="6.5s"
                      repeatCount="indefinite"
                      path="M280 500 C400 430 500 520 650 440 S800 350 900 390"
                    />
                  </motion.circle>
                </>
              )}
            </svg>

            {/* =================================================
                TOP HUD
            ================================================= */}

            <div className="absolute left-7 right-7 top-7 flex items-start justify-between sm:left-8 sm:right-8 sm:top-8">
              <div>
                <div className="flex items-center gap-2">
                  <span
                    className="h-1.5 w-1.5 rounded-full"
                    style={{
                      background: BRAND_CYAN,
                      boxShadow:
                        "0 0 12px 3px rgba(103,232,249,.5)",
                    }}
                  />

                  <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-white/75">
                    Renderuim Engine
                  </span>
                </div>

                <div className="mt-2 text-[9px] uppercase tracking-[0.2em] text-white/36">
                  {activeCase.label}
                </div>
              </div>

              <div className="rounded-full border border-white/10 bg-black/20 px-2.5 py-1.5 font-mono text-[8px] text-white/45 backdrop-blur-xl">
                {activeCase.number} / 04
              </div>
            </div>

            {/* =================================================
                SIDE TECH LABEL
            ================================================= */}

            <div className="absolute right-6 top-1/2 hidden -translate-y-1/2 rotate-90 md:block">
              <span className="font-mono text-[7px] uppercase tracking-[0.35em] text-white/25">
                ARCHITECTURAL VISUAL SYSTEM
              </span>
            </div>

            {/* =================================================
                ACTIVE WORKFLOW
            ================================================= */}

            <motion.div
              initial={{
                opacity: 0,
                y: 18,
              }}
              animate={{
                opacity: 1,
                y: 0,
              }}
              transition={{
                delay: 0.24,
              }}
              className="absolute bottom-7 left-7 sm:bottom-8 sm:left-8"
            >
              <div className="mb-2 font-mono text-[9px] uppercase tracking-[0.3em] text-white/36">
                ACTIVE WORKFLOW
              </div>

              <div className="text-4xl font-black tracking-[-0.05em] text-white sm:text-5xl">
                {activeCase.metric}
              </div>
            </motion.div>

            {/* =================================================
                PIPELINE
            ================================================= */}

            <div className="absolute bottom-7 right-7 hidden items-center gap-1.5 sm:bottom-8 sm:right-8 md:flex">
              {activeCase.steps.map(
                (step, index) => (
                  <div
                    key={step}
                    className="flex items-center"
                  >
                    <motion.div
                      initial={{
                        opacity: 0,
                        y: 8,
                      }}
                      animate={{
                        opacity: 1,
                        y: 0,
                      }}
                      transition={{
                        delay:
                          0.12 +
                          index * 0.07,
                      }}
                      className="
                        rounded-xl
                        border
                        border-white/[0.12]
                        bg-black/30
                        px-3
                        py-2
                        backdrop-blur-xl
                      "
                    >
                      <span className="font-mono text-[8px] tracking-[0.18em] text-white/68">
                        {step}
                      </span>
                    </motion.div>

                    {index <
                      activeCase.steps.length -
                        1 && (
                      <div className="mx-1 h-px w-3 bg-white/15" />
                    )}
                  </div>
                ),
              )}
            </div>

            {/* oversized index */}
            <div
              aria-hidden="true"
              className="
                pointer-events-none
                absolute
                bottom-[-35px]
                right-[-10px]
                select-none
                text-[190px]
                font-black
                leading-none
                text-white/[0.035]
              "
            >
              {activeCase.number}
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

/* ============================================================
   MOBILE VISUAL
============================================================ */

function MobileVisual({
  activeCase,
  reduceMotion,
}: {
  activeCase: UseCase;
  reduceMotion: boolean;
}) {
  return (
    <div
      className="
        relative
        aspect-[16/10]
        overflow-hidden
        rounded-[26px]
        border
        border-black/[0.07]
        bg-black
        shadow-[0_20px_55px_rgba(15,23,42,.05)]
        dark:border-white/[0.08]
        dark:shadow-[0_24px_70px_rgba(0,0,0,.28)]
        lg:hidden
      "
    >
      <AnimatePresence mode="wait">
        <motion.img
          key={activeCase.image}
          src={activeCase.image}
          alt={activeCase.title}
          initial={
            reduceMotion
              ? undefined
              : {
                  opacity: 0,
                  scale: 1.07,
                  filter: "blur(10px)",
                }
          }
          animate={{
            opacity: 1,
            scale: 1,
            filter: "blur(0px)",
          }}
          exit={{
            opacity: 0,
          }}
          transition={{
            duration: 0.7,
            ease: [0.16, 1, 0.3, 1],
          }}
          className="absolute inset-0 h-full w-full object-cover"
        />
      </AnimatePresence>

      {/* contrast */}
      <div className="absolute inset-0 bg-black/40" />

      {/* =================================================
          MOBILE GRID
      ================================================= */}

      <div
        aria-hidden="true"
        className="absolute inset-0"
        style={{
          opacity: 0.16,
          backgroundImage: `
            linear-gradient(
              rgba(255,255,255,.9) 1px,
              transparent 1px
            ),
            linear-gradient(
              90deg,
              rgba(255,255,255,.9) 1px,
              transparent 1px
            )
          `,
          backgroundSize: "36px 36px",
          maskImage:
            "linear-gradient(to bottom, transparent 0%, black 15%, black 82%, transparent 100%)",
          WebkitMaskImage:
            "linear-gradient(to bottom, transparent 0%, black 15%, black 82%, transparent 100%)",
        }}
      />

      {/* cyan major grid */}
      <div
        aria-hidden="true"
        className="absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage: `
            linear-gradient(
              rgba(103,232,249,.95) 1px,
              transparent 1px
            ),
            linear-gradient(
              90deg,
              rgba(103,232,249,.95) 1px,
              transparent 1px
            )
          `,
          backgroundSize: "108px 108px",
        }}
      />

      {/* scan */}
      {!reduceMotion && (
        <motion.div
          animate={{
            y: ["0%", "650%"],
          }}
          transition={{
            duration: 4.8,
            repeat: Infinity,
            ease: "linear",
          }}
          className="
            absolute
            left-0
            top-0
            h-px
            w-full
            bg-cyan-300/60
            shadow-[0_0_24px_7px_rgba(103,232,249,.12)]
          "
        />
      )}

      {/* top HUD */}
      <div className="absolute left-5 right-5 top-5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span
            className="h-1.5 w-1.5 rounded-full"
            style={{
              background: BRAND_CYAN,
              boxShadow:
                "0 0 10px rgba(103,232,249,.7)",
            }}
          />

          <span className="font-mono text-[8px] uppercase tracking-[0.24em] text-white/55">
            {activeCase.label}
          </span>
        </div>

        <span className="rounded-full border border-white/10 bg-black/25 px-2 py-1 font-mono text-[8px] text-white/45 backdrop-blur-xl">
          {activeCase.number} / 04
        </span>
      </div>

      {/* bottom */}
      <div className="absolute bottom-5 left-5">
        <div className="mb-1 font-mono text-[8px] uppercase tracking-[0.24em] text-white/38">
          Active workflow
        </div>

        <div className="text-2xl font-black tracking-[-0.04em] text-white">
          {activeCase.metric}
        </div>
      </div>

      {/* corner brackets */}
      <div className="absolute left-3 top-3 h-4 w-4 border-l border-t border-cyan-300/35" />
      <div className="absolute right-3 top-3 h-4 w-4 border-r border-t border-cyan-300/35" />
      <div className="absolute bottom-3 left-3 h-4 w-4 border-b border-l border-cyan-300/25" />
      <div className="absolute bottom-3 right-3 h-4 w-4 border-b border-r border-cyan-300/25" />
    </div>
  );
}

/* ============================================================
   TECHNICAL NODE
============================================================ */

function TechnicalNode({
  className,
  delay,
  reduceMotion,
}: {
  className: string;
  delay: number;
  reduceMotion: boolean;
}) {
  return (
    <motion.div
      className={`absolute z-20 ${className}`}
      initial={{
        opacity: reduceMotion ? 1 : 0,
      }}
      animate={
        reduceMotion
          ? {
              opacity: 1,
            }
          : {
              opacity: [0.2, 1, 0.2],
              scale: [0.8, 1.15, 0.8],
            }
      }
      transition={{
        duration: 2.8,
        delay,
        repeat: reduceMotion
          ? 0
          : Infinity,
        ease: "easeInOut",
      }}
    >
      <div
        className="
          relative
          h-3
          w-3
          rounded-full
          border
          bg-black/10
        "
        style={{
          borderColor:
            "rgba(103,232,249,.62)",
          boxShadow:
            "0 0 12px rgba(103,232,249,.14)",
        }}
      >
        <div
          className="
            absolute
            inset-1
            rounded-full
          "
          style={{
            background: BRAND_CYAN,
            boxShadow:
              "0 0 15px 4px rgba(103,232,249,.35)",
          }}
        />
      </div>
    </motion.div>
  );
}

