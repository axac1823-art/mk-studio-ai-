"use client";

import { motion } from "framer-motion";
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

export function ToolsArena({
  onToolClick,
}: ToolsArenaProps) {
  const visibleTools = TOOL_ORDER
    .map((id) =>
      TOOLS.find((tool) => tool.id === id),
    )
    .filter(
      (
        tool,
      ): tool is (typeof TOOLS)[number] =>
        Boolean(tool),
    );

  return (

<section
  id="tools"
  data-circuit-section="tools"
  className="
    relative
    overflow-hidden
    border-y
    border-black/[0.07]
    bg-white
    text-black
    dark:border-white/[0.07]
    dark:bg-[#050505]
    dark:text-white
    py-24
    lg:py-28
  "
>
  {/* ======================================================
      BACKGROUND
  ======================================================= */}

  <div className="pointer-events-none absolute inset-0 overflow-hidden">
    {/* ====================================================
        MAIN BLUE ATMOSPHERE
    ==================================================== */}

    <div
      className="
        absolute
        left-1/2
        top-[-180px]
        h-[680px]
        w-[1000px]
        -translate-x-1/2
        rounded-full
        blur-[110px]
      "
      style={{
        background:
          "radial-gradient(circle, hsla(189.16,79.17%,47.06%,0.16) 0%, hsla(189.16,79.17%,47.06%,0.10) 28%, hsla(189.16,79.17%,47.06%,0.045) 48%, transparent 72%)",
      }}
    />

    {/* ====================================================
        SECONDARY MOVING BLUE DEPTH
    ==================================================== */}

    <motion.div
      animate={{
        x: ["-8%", "8%", "-8%"],
        y: ["0%", "3%", "0%"],
        opacity: [0.55, 0.9, 0.55],
      }}
      transition={{
        duration: 14,
        repeat: Infinity,
        ease: "easeInOut",
      }}
      className="
        absolute
        left-1/2
        top-[20%]
        h-[560px]
        w-[900px]
        -translate-x-1/2
        rounded-full
        blur-[125px]
      "
      style={{
        background:
          "radial-gradient(circle, hsla(189.16,79.17%,47.06%,0.075) 0%, hsla(189.16,79.17%,47.06%,0.035) 42%, transparent 72%)",
      }}
    />

    {/* ====================================================
        LEFT BLUE LIGHT
    ==================================================== */}

    <div
      className="
        absolute
        -left-[220px]
        top-[30%]
        h-[520px]
        w-[520px]
        rounded-full
        blur-[125px]
      "
      style={{
        background:
          "radial-gradient(circle, hsla(189.16,79.17%,47.06%,0.065) 0%, transparent 70%)",
      }}
    />

    {/* ====================================================
        RIGHT BLUE LIGHT
    ==================================================== */}

    <div
      className="
        absolute
        -right-[220px]
        top-[38%]
        h-[520px]
        w-[520px]
        rounded-full
        blur-[125px]
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
    ==================================================== */}

    <div
      className="
        absolute
        inset-0
        dark:hidden
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
    ==================================================== */}

    <div
      className="
        absolute
        left-1/2
        top-[42%]
        h-[360px]
        w-[760px]
        -translate-x-1/2
        rounded-full
        blur-[135px]
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

      <div
        className="
          relative
          mx-auto
          max-w-[1600px]
        "
      >
{/* ====================================================
    HEADER
===================================================== */}

<motion.div
  initial={{
    opacity: 0,
    y: 24,
    filter: "blur(10px)",
  }}
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
    duration: 0.8,
    ease: [0.16, 1, 0.3, 1],
  }}
  className="
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

  <div className="pointer-events-none absolute inset-x-0 top-[-100px] mx-auto h-[300px] max-w-[760px]">
    <div
      className="
        absolute
        left-1/2
        top-1/2
        h-[260px]
        w-[620px]
        -translate-x-1/2
        -translate-y-1/2
        rounded-full
        blur-[100px]
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
    <motion.div
      animate={{
        width: ["28px", "54px", "28px"],
        opacity: [0.35, 0.9, 0.35],
      }}
      transition={{
        duration: 3,
        repeat: Infinity,
        ease: "easeInOut",
      }}
      className="h-px bg-[hsl(189.16deg_79.17%_47.06%)]"
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
      <motion.span
        animate={{
          opacity: [0.35, 1, 0.35],
          boxShadow: [
            "0 0 0 rgba(34,211,238,0)",
            "0 0 12px hsla(189,79%,47%,0.75)",
            "0 0 0 rgba(34,211,238,0)",
          ],
        }}
        transition={{
          duration: 2,
          repeat: Infinity,
        }}
        className="
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

    <motion.div
      animate={{
        width: ["28px", "54px", "28px"],
        opacity: [0.35, 0.9, 0.35],
      }}
      transition={{
        duration: 3,
        repeat: Infinity,
        ease: "easeInOut",
        delay: 0.3,
      }}
      className="h-px bg-[hsl(189.16deg_79.17%_47.06%)]"
    />
  </div>

  {/* ==================================================
      MAIN TITLE
  ================================================== */}

  <div className="relative mx-auto max-w-4xl text-center">
    <div className="relative inline-block">
      {/* architectural vertical signal */}
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
              group-hover:scale-x-100
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

    <motion.p
      initial={{
        opacity: 0,
        y: 12,
      }}
      whileInView={{
        opacity: 1,
        y: 0,
      }}
      viewport={{
        once: true,
      }}
      transition={{
        delay: 0.18,
        duration: 0.7,
      }}
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
    </motion.p>
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
</motion.div>

        {/* ====================================================
            AUTO-SCROLL TOOL RAIL
        ===================================================== */}

        <div className="group/tool-rail overflow-hidden pb-8">
          <div className="animate-scroll-horizontal flex w-max gap-4 px-4 [animation-duration:80s] hover:[animation-play-state:paused] sm:px-6 lg:px-8">
          {/*
           * First set
           */}
          {visibleTools.map(
            (tool) => (
              <ToolVisualCard
                key={`first-${tool.id}`}
                tool={tool}
                variant="rail"
                onClick={
                  onToolClick
                }
              />
            ),
          )}

          {/*
           * Duplicate set.
           *
           * This creates the seamless loop.
           */}
          {visibleTools.map(
            (tool) => (
              <ToolVisualCard
                key={`second-${tool.id}`}
                tool={tool}
                variant="rail"
                onClick={
                  onToolClick
                }
              />
            ),
          )}
          </div>
        </div>
      </div>
    </section>
  );
}

