"use client";

import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  ArrowRight,
  Check,
  ChevronRight,
  LogIn,
  Sparkles,
  Wand2,
} from "lucide-react";

type Step = {
  number: string;
  title: string;
  description: string;
  icon: typeof LogIn;
  action: string;
  code: string;
};

const STEPS: Step[] = [
  {
    number: "01",
    title: "Sign up or log in",
    description:
      "Create your Renderuim account and enter your workspace in seconds.",
    icon: LogIn,
    action: "Create your account",
    code: "AUTH / WORKSPACE",
  },
  {
    number: "02",
    title: "Choose your AI tool",
    description:
      "Pick the workflow you need — renders, angles, upscaling, 3D, video and more.",
    icon: Wand2,
    action: "Explore the tools",
    code: "ROUTE / TOOL",
  },
  {
    number: "03",
    title: "Generate & iterate",
    description:
      "Upload your input, generate your result, refine it and keep building.",
    icon: Sparkles,
    action: "Start creating",
    code: "RUN / ITERATE",
  },
];

export default function IndustriesShowcase({
  openLogin,
}: {
  openLogin: () => void;
}) {
  const [activeStep, setActiveStep] = useState(0);
  const shouldReduceMotion = useReducedMotion();

  useEffect(() => {
    if (shouldReduceMotion) return;

    const timer = window.setInterval(() => {
      setActiveStep((current) => (current + 1) % STEPS.length);
    }, 3000);

    return () => window.clearInterval(timer);
  }, [shouldReduceMotion]);

  return (
    <section
      id="get-started"
      data-circuit-section="get-started"
      className="
        relative
        isolate
        overflow-hidden
        border-y
        border-black/[0.06]
        bg-[#f6f8f9]
        py-20
        text-[#0a0d0f]
        dark:border-white/[0.05]
        dark:bg-[#050607]
        dark:text-white
        sm:py-24
        lg:py-28
      "
    >
      {/* ============================================================
          ATMOSPHERE
      ============================================================ */}

      <div className="pointer-events-none absolute inset-0">
        {/* Cyan glow */}
        <div
          className="
            absolute
            left-[5%]
            top-[6%]
            h-[420px]
            w-[420px]
            rounded-full
            bg-cyan-400/[0.055]
            blur-[140px]
            dark:bg-cyan-400/[0.035]
          "
        />

        {/* Blue lower glow */}
        <div
          className="
            absolute
            bottom-[-12%]
            right-[-6%]
            h-[480px]
            w-[480px]
            rounded-full
            bg-blue-500/[0.045]
            blur-[160px]
            dark:bg-blue-500/[0.025]
          "
        />

        {/* Blueprint grid */}
        <div
          className="
            absolute
            inset-0
            opacity-[0.65]
            [background-image:linear-gradient(rgba(0,0,0,.035)_1px,transparent_1px),linear-gradient(90deg,rgba(0,0,0,.035)_1px,transparent_1px)]
            [background-size:64px_64px]
            dark:opacity-100
            dark:[background-image:linear-gradient(rgba(255,255,255,.032)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.032)_1px,transparent_1px)]
          "
        />

        {/* Major grid */}
        <div
          className="
            absolute
            inset-0
            opacity-[0.35]
            [background-image:linear-gradient(rgba(6,182,212,.045)_1px,transparent_1px),linear-gradient(90deg,rgba(6,182,212,.045)_1px,transparent_1px)]
            [background-size:256px_256px]
            dark:opacity-50
          "
        />

        {/* Edge fade */}
        <div
          className="
            absolute
            inset-0
            bg-[radial-gradient(circle_at_center,transparent_28%,rgba(246,248,249,.78)_100%)]
            dark:bg-[radial-gradient(circle_at_center,transparent_28%,rgba(5,6,7,.88)_100%)]
          "
        />
      </div>

      <div className="relative mx-auto max-w-[1400px] px-5 sm:px-8 lg:px-12">
        <div className="grid gap-14 lg:grid-cols-[0.82fr_1.18fr] lg:gap-20">
          {/* ==========================================================
              LEFT / INTRO
          ========================================================== */}

{/* ==========================================================
    LEFT / SECTION HEADER
========================================================== */}

<div className="lg:sticky lg:top-28 lg:self-start">
  <motion.div
    initial={
      shouldReduceMotion
        ? undefined
        : {
            opacity: 0,
            y: 20,
            filter: "blur(10px)",
          }
    }
    whileInView={
      shouldReduceMotion
        ? undefined
        : {
            opacity: 1,
            y: 0,
            filter: "blur(0px)",
          }
    }
    viewport={{
      once: true,
      amount: 0.4,
    }}
    transition={{
      duration: 0.9,
      ease: [0.16, 1, 0.3, 1],
    }}
    className="relative"
  >
    {/* ========================================================
        DESKTOP HEADER
    ======================================================== */}

    <div className="hidden sm:block">
      {/* Technical label */}
      <div className="mb-7 flex items-center gap-3">
        <div className="relative flex h-8 w-8 items-center justify-center">
          <div
            className="
              absolute
              inset-0
              rounded-full
              border
              border-cyan-500/20
              dark:border-cyan-300/20
            "
          />

          <div
            className="
              h-1.5
              w-1.5
              rounded-full
              bg-cyan-500
              shadow-[0_0_12px_4px_rgba(6,182,212,.3)]
              dark:bg-cyan-300
              dark:shadow-[0_0_12px_4px_rgba(103,232,249,.65)]
            "
          />

          <span
            className="
              absolute
              left-full
              top-1/2
              h-px
              w-5
              -translate-y-1/2
              bg-cyan-500/20
              dark:bg-cyan-300/20
            "
          />
        </div>

        <div
          className="
            flex
            items-center
            gap-2.5
            rounded-full
            border
            border-black/[0.08]
            bg-black/[0.02]
            px-3
            py-1.5
            dark:border-white/[0.09]
            dark:bg-white/[0.025]
          "
        >
          <span
            className="
              font-mono
              text-[8px]
              uppercase
              tracking-[0.3em]
              text-black/35
              dark:text-white/30
            "
          >
            GET STARTED
          </span>

          <span className="h-1 w-1 rounded-full bg-cyan-500 dark:bg-cyan-300" />

          <span
            className="
              font-mono
              text-[8px]
              uppercase
              tracking-[0.22em]
              text-cyan-700/70
              dark:text-cyan-300/70
            "
          >
            WORKFLOW
          </span>
        </div>
      </div>

      {/* Desktop title */}
      <div className="relative">
        <div
          className="
            pointer-events-none
            absolute
            left-0
            top-[22px]
            h-px
            w-24
            bg-gradient-to-r
            from-cyan-500/50
            to-transparent
            dark:from-cyan-300/40
          "
        />

        <div
          className="
            pointer-events-none
            absolute
            left-0
            top-[18px]
            h-2
            w-2
            rounded-full
            border
            border-cyan-500/50
            bg-[#f6f8f9]
            dark:border-cyan-300/50
            dark:bg-[#050607]
          "
        />

        <h2
          className="
            relative
            max-w-xl
            pl-14
            text-[4.3rem]
            font-light
            leading-[0.92]
            tracking-[-0.065em]
            text-[#090d10]
            dark:text-white
            lg:text-[5rem]
          "
        >
          <span className="block">From idea</span>

          <span
            className="
              relative
              mt-2
              block
              text-black/18
              dark:text-white/18
            "
          >
            to

            <span
              className="
                ml-2
                text-cyan-600
                dark:text-cyan-300
              "
            >
              output.
            </span>

            <span
              className="
                absolute
                -bottom-3
                left-0
                h-px
                w-28
                bg-gradient-to-r
                from-cyan-500
                via-cyan-500/30
                to-transparent
                dark:from-cyan-300
                dark:via-cyan-300/30
              "
            />
          </span>
        </h2>

        {/* Vertical signal */}
        <div
          className="
            pointer-events-none
            absolute
            bottom-0
            left-2
            top-0
            w-px
            bg-black/[0.08]
            dark:bg-white/[0.08]
          "
        />

        {!shouldReduceMotion && (
          <motion.div
            animate={{
              top: ["5%", "88%"],
              opacity: [0, 1, 1, 0],
            }}
            transition={{
              duration: 3.8,
              repeat: Infinity,
              ease: "linear",
            }}
            className="
              pointer-events-none
              absolute
              left-[1px]
              top-[5%]
              h-8
              w-[3px]
              rounded-full
              bg-gradient-to-b
              from-transparent
              via-cyan-500
              to-transparent
              shadow-[0_0_14px_4px_rgba(6,182,212,.3)]
              dark:via-cyan-300
              dark:shadow-[0_0_14px_4px_rgba(103,232,249,.6)]
            "
          />
        )}
      </div>
    </div>

    {/* ========================================================
        MOBILE HEADER
    ======================================================== */}

    <div className="sm:hidden">
      {/* Mobile identifier */}
      <div className="mb-6 flex justify-center">
        <div
          className="
            inline-flex
            items-center
            gap-2.5
            rounded-full
            border
            border-black/[0.08]
            bg-black/[0.025]
            px-3
            py-1.5
            dark:border-white/[0.09]
            dark:bg-white/[0.025]
          "
        >
          <span
            className="
              h-1.5
              w-1.5
              rounded-full
              bg-cyan-500
              shadow-[0_0_10px_3px_rgba(6,182,212,.25)]
              dark:bg-cyan-300
              dark:shadow-[0_0_10px_3px_rgba(103,232,249,.55)]
            "
          />

          <span
            className="
              font-mono
              text-[8px]
              uppercase
              tracking-[0.28em]
              text-black/35
              dark:text-white/30
            "
          >
            GET STARTED
          </span>

          <span className="h-1 w-1 rounded-full bg-cyan-500 dark:bg-cyan-300" />
        </div>
      </div>

      {/* Mobile centered title */}
      <div className="relative text-center">
        <h2
          className="
            text-[3.15rem]
            font-light
            leading-[0.9]
            tracking-[-0.065em]
            text-[#090d10]
            dark:text-white
          "
        >
          <span className="block">From idea</span>

          <span
            className="
              mt-2
              block
              text-black/18
              dark:text-white/18
            "
          >
            to{" "}
            <span className="text-cyan-600 dark:text-cyan-300">
              output.
            </span>
          </span>
        </h2>

        {/* Mobile signal line */}
        <div className="mt-5 flex items-center justify-center gap-2.5">
          <span className="h-px w-10 bg-black/10 dark:bg-white/10" />

          <span
            className="
              h-1.5
              w-1.5
              rounded-full
              bg-cyan-500
              shadow-[0_0_10px_3px_rgba(6,182,212,.28)]
              dark:bg-cyan-300
              dark:shadow-[0_0_10px_3px_rgba(103,232,249,.6)]
            "
          />

          <span className="h-px w-10 bg-black/10 dark:bg-white/10" />
        </div>

        <div className="mt-3 flex items-center justify-center gap-2">
          <span
            className="
              font-mono
              text-[7px]
              uppercase
              tracking-[0.28em]
              text-black/25
              dark:text-white/20
            "
          >
            WORKFLOW SYSTEM
          </span>

          <span className="h-1 w-1 rounded-full bg-cyan-500 dark:bg-cyan-300" />

          <span
            className="
              font-mono
              text-[7px]
              uppercase
              tracking-[0.2em]
              text-cyan-700/60
              dark:text-cyan-300/60
            "
          >
            ONLINE
          </span>
        </div>
      </div>
    </div>

    {/* ========================================================
        DESCRIPTION
    ======================================================== */}

    <motion.p
      initial={
        shouldReduceMotion
          ? undefined
          : {
              opacity: 0,
              y: 12,
            }
      }
      whileInView={
        shouldReduceMotion
          ? undefined
          : {
              opacity: 1,
              y: 0,
            }
      }
      viewport={{
        once: true,
        amount: 0.35,
      }}
      transition={{
        duration: 0.7,
        delay: 0.15,
      }}
      className="
        mx-auto
        mt-7
        max-w-md
        text-sm
        leading-7
        text-black/45
        dark:text-white/40
        sm:mx-0
        sm:mt-8
        sm:text-base
      "
    >
      Create your account, choose a workflow and start turning
      architectural ideas into finished visuals.
    </motion.p>

    {/* ========================================================
        CTA
    ======================================================== */}

    <div className="flex justify-center sm:block">
      <motion.button
        type="button"
        onClick={openLogin}
        whileHover={
          shouldReduceMotion
            ? undefined
            : {
                y: -2,
              }
        }
        whileTap={
          shouldReduceMotion
            ? undefined
            : {
                scale: 0.98,
              }
        }
        className="
          group
          mt-8
          inline-flex
          items-center
          gap-3
          rounded-xl
          bg-[#090c0f]
          px-5
          py-3.5
          text-sm
          font-medium
          text-white
          shadow-[0_18px_45px_rgba(0,0,0,.10)]
          transition
          hover:shadow-[0_20px_55px_rgba(0,0,0,.16)]
          dark:bg-white
          dark:text-black
          dark:shadow-[0_18px_50px_rgba(255,255,255,.05)]
        "
      >
        Start creating free

        <ArrowRight
          className="
            h-4
            w-4
            transition-transform
            duration-300
            group-hover:translate-x-0.5
          "
        />
      </motion.button>
    </div>

    {/* ========================================================
        TRUST
    ======================================================== */}

    <div className="mt-4 flex justify-center sm:justify-start">
      <div className="flex items-center gap-2.5">
        <div
          className="
            flex
            h-4
            w-4
            items-center
            justify-center
            rounded-full
            border
            border-cyan-500/20
            bg-cyan-500/[0.04]
            dark:border-cyan-300/20
            dark:bg-cyan-300/[0.04]
          "
        >
          <Check className="h-2.5 w-2.5 text-cyan-600 dark:text-cyan-300" />
        </div>

        <span
          className="
            font-mono
            text-[8px]
            uppercase
            tracking-[0.18em]
            text-black/28
            dark:text-white/20
          "
        >
          No complex setup
        </span>
      </div>
    </div>

    {/* ========================================================
        SYSTEM FOOTER
    ======================================================== */}

    <div
      className="
        mt-12
        hidden
        max-w-sm
        sm:block
      "
    >
      <div className="flex items-center gap-3">
        <span
          className="
            font-mono
            text-[7px]
            uppercase
            tracking-[0.22em]
            text-black/25
            dark:text-white/20
          "
        >
          RENDERUIM
        </span>

        <span className="h-px w-8 bg-black/10 dark:bg-white/10" />

        <span
          className="
            font-mono
            text-[7px]
            uppercase
            tracking-[0.2em]
            text-cyan-700/60
            dark:text-cyan-300/60
          "
        >
          ENGINE ONLINE
        </span>

        <span className="h-1 w-1 rounded-full bg-cyan-500 dark:bg-cyan-300" />
      </div>

      <div className="mt-3 h-px w-full bg-gradient-to-r from-cyan-500/30 via-cyan-500/10 to-transparent dark:from-cyan-300/30 dark:via-cyan-300/10" />

      <div className="mt-2 flex items-center justify-between">
        <span className="font-mono text-[6px] uppercase tracking-[0.2em] text-black/15 dark:text-white/10">
          INPUT
        </span>

        <span className="font-mono text-[6px] uppercase tracking-[0.2em] text-black/15 dark:text-white/10">
          ROUTE
        </span>

        <span className="font-mono text-[6px] uppercase tracking-[0.2em] text-black/15 dark:text-white/10">
          OUTPUT
        </span>
      </div>
    </div>
  </motion.div>
</div>

          {/* ==========================================================
              RIGHT / WORKFLOW
          ========================================================== */}

          <div className="relative">
            {/* Top technical header */}
            <div
              className="
                mb-5
                flex
                items-center
                justify-between
                border-b
                border-black/[0.07]
                pb-3
                dark:border-white/[0.07]
              "
            >
              <span
                className="
                  font-mono
                  text-[7px]
                  uppercase
                  tracking-[0.25em]
                  text-black/30
                  dark:text-white/20
                "
              >
                Workflow sequence
              </span>

              <span
                className="
                  font-mono
                  text-[7px]
                  uppercase
                  tracking-[0.22em]
                  text-cyan-700/60
                  dark:text-cyan-300/60
                "
              >
                01 → 02 → 03
              </span>
            </div>

            {/* Main system frame */}
            <div
              className="
                relative
                overflow-hidden
                rounded-[28px]
                border
                border-black/[0.08]
                bg-white/70
                shadow-[0_30px_100px_rgba(0,0,0,.06)]
                dark:border-white/[0.08]
                dark:bg-[#070a0d]/85
                dark:shadow-[0_35px_120px_rgba(0,0,0,.28)]
              "
            >
              {/* Inner blueprint grid */}
              <div
                className="
                  pointer-events-none
                  absolute
                  inset-0
                  opacity-60
                  [background-image:linear-gradient(rgba(0,0,0,.028)_1px,transparent_1px),linear-gradient(90deg,rgba(0,0,0,.028)_1px,transparent_1px)]
                  [background-size:32px_32px]
                  dark:opacity-100
                  dark:[background-image:linear-gradient(rgba(255,255,255,.026)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.026)_1px,transparent_1px)]
                "
              />

              {/* Cyan center atmosphere */}
              <div
                className="
                  pointer-events-none
                  absolute
                  left-[12%]
                  top-[20%]
                  h-72
                  w-72
                  rounded-full
                  bg-cyan-400/[0.035]
                  blur-[110px]
                  dark:bg-cyan-300/[0.035]
                "
              />

              {/* Corner technical marks */}
              <div className="pointer-events-none absolute left-4 top-4 h-3 w-3 border-l border-t border-cyan-600/35 dark:border-cyan-300/30" />
              <div className="pointer-events-none absolute right-4 top-4 h-3 w-3 border-r border-t border-cyan-600/35 dark:border-cyan-300/30" />
              <div className="pointer-events-none absolute bottom-4 left-4 h-3 w-3 border-b border-l border-cyan-600/25 dark:border-cyan-300/25" />
              <div className="pointer-events-none absolute bottom-4 right-4 h-3 w-3 border-b border-r border-cyan-600/25 dark:border-cyan-300/25" />

              <div className="relative z-10 px-4 py-4 sm:px-6 sm:py-6">
                {/* Main rail */}
                <div className="relative">
                  <div
                    className="
                      pointer-events-none
                      absolute
                      left-[31px]
                      top-5
                      bottom-5
                      w-px
                      bg-black/[0.10]
                      dark:bg-white/[0.09]
                    "
                  />

                  {/* Main traveling energy */}
                  {!shouldReduceMotion && (
                    <motion.div
                      animate={{
                        top: ["20px", "calc(100% - 20px)"],
                        opacity: [0, 1, 1, 0],
                      }}
                      transition={{
                        duration: 4.8,
                        repeat: Infinity,
                        ease: "linear",
                      }}
                      className="
                        pointer-events-none
                        absolute
                        left-[30px]
                        z-30
                        h-14
                        w-[3px]
                        rounded-full
                        bg-gradient-to-b
                        from-transparent
                        via-cyan-500
                        to-transparent
                        shadow-[0_0_18px_5px_rgba(6,182,212,.38)]
                        dark:via-cyan-300
                        dark:shadow-[0_0_18px_5px_rgba(103,232,249,.62)]
                      "
                    />
                  )}

                  {STEPS.map((step, index) => {
                    const Icon = step.icon;
                    const isActive = index === activeStep;

                    return (
                      <motion.div
                        key={step.number}
                        initial={
                          shouldReduceMotion
                            ? undefined
                            : {
                                opacity: 0,
                                y: 22,
                              }
                        }
                        whileInView={
                          shouldReduceMotion
                            ? undefined
                            : {
                                opacity: 1,
                                y: 0,
                              }
                        }
                        viewport={{
                          once: true,
                          amount: 0.25,
                        }}
                        transition={{
                          duration: 0.65,
                          delay: index * 0.1,
                          ease: [0.16, 1, 0.3, 1],
                        }}
                        className={`
                          relative
                          border-b
                          border-black/[0.07]
                          py-7
                          last:border-b-0
                          sm:py-9
                          lg:py-10
                        `}
                      >
                        {/* Connector segment */}
                        {index < STEPS.length - 1 && (
                          <div
                            className="
                              pointer-events-none
                              absolute
                              bottom-0
                              left-[31px]
                              h-8
                              w-px
                              bg-black/[0.08]
                              dark:bg-white/[0.07]
                              sm:h-9
                            "
                          >
                            {!shouldReduceMotion && (
                              <motion.div
                                animate={{
                                  y: ["0%", "100%"],
                                  opacity: [0, 1, 0],
                                }}
                                transition={{
                                  duration: 1.8,
                                  delay: index * 0.55,
                                  repeat: Infinity,
                                  ease: "linear",
                                }}
                                className="
                                  absolute
                                  left-[-1px]
                                  top-0
                                  h-5
                                  w-[3px]
                                  rounded-full
                                  bg-cyan-500
                                  shadow-[0_0_14px_4px_rgba(6,182,212,.35)]
                                  dark:bg-cyan-300
                                  dark:shadow-[0_0_14px_4px_rgba(103,232,249,.7)]
                                "
                              />
                            )}
                          </div>
                        )}

                        <div className="flex gap-4 sm:gap-6">
                          {/* ====================================================
                              NODE
                          ==================================================== */}

                          <button
                            type="button"
                            onClick={() => setActiveStep(index)}
                            aria-label={`Show step ${step.number}: ${step.title}`}
                            className="relative z-20 h-[62px] w-[62px] shrink-0"
                          >
                            <motion.div
                              animate={
                                shouldReduceMotion
                                  ? undefined
                                  : {
                                      scale: isActive
                                        ? [1, 1.06, 1]
                                        : 1,
                                    }
                              }
                              transition={{
                                duration: 1.6,
                                repeat: isActive ? Infinity : 0,
                              }}
                              className={`
                                relative
                                flex
                                h-full
                                w-full
                                items-center
                                justify-center
                                rounded-2xl
                                border
                                transition-all
                                duration-500
                                ${
                                  isActive
                                    ? `
                                      border-cyan-500/30
                                      bg-cyan-500/[0.07]
                                      shadow-[0_12px_40px_rgba(6,182,212,.08)]
                                      dark:border-cyan-300/30
                                      dark:bg-cyan-300/[0.045]
                                      dark:shadow-[0_12px_40px_rgba(103,232,249,.08)]
                                    `
                                    : `
                                      border-black/[0.08]
                                      bg-white/80
                                      dark:border-white/[0.09]
                                      dark:bg-[#080b0e]
                                    `
                                }
                              `}
                            >
                              {/* Active pulse */}
                              {isActive && !shouldReduceMotion && (
                                <motion.span
                                  animate={{
                                    scale: [0.7, 1.7, 0.7],
                                    opacity: [0.18, 0.9, 0.18],
                                  }}
                                  transition={{
                                    duration: 1.6,
                                    repeat: Infinity,
                                  }}
                                  className="
                                    absolute
                                    h-2
                                    w-2
                                    rounded-full
                                    bg-cyan-500
                                    shadow-[0_0_16px_5px_rgba(6,182,212,.35)]
                                    dark:bg-cyan-300
                                    dark:shadow-[0_0_16px_5px_rgba(103,232,249,.75)]
                                  "
                                />
                              )}

                              <Icon
                                className={`
                                  relative
                                  z-10
                                  h-5
                                  w-5
                                  transition-colors
                                  duration-500
                                  ${
                                    isActive
                                      ? "text-cyan-600 dark:text-cyan-300"
                                      : "text-black/25 dark:text-white/25"
                                  }
                                `}
                              />
                            </motion.div>
                          </button>

                          {/* ====================================================
                              CONTENT
                          ==================================================== */}

                          <div className="min-w-0 flex-1">
                            {/* Heading row */}
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                              <div className="flex min-w-0 items-baseline gap-3 sm:gap-4">
                                <span
                                  className={`
                                    shrink-0
                                    font-mono
                                    text-[9px]
                                    tracking-[0.2em]
                                    transition-colors
                                    ${
                                      isActive
                                        ? "text-cyan-600/80 dark:text-cyan-300/70"
                                        : "text-black/20 dark:text-white/15"
                                    }
                                  `}
                                >
                                  {step.number}
                                </span>

                                <h3
                                  className={`
                                    truncate
                                    text-[1.55rem]
                                    font-light
                                    tracking-[-0.04em]
                                    transition-colors
                                    duration-500
                                    sm:text-3xl
                                    ${
                                      isActive
                                        ? "text-[#090d10] dark:text-white"
                                        : "text-black/50 dark:text-white/55"
                                    }
                                  `}
                                >
                                  {step.title}
                                </h3>
                              </div>

                              <div className="flex items-center gap-2 pl-7 sm:pl-0">
                                <span
                                  className={`
                                    font-mono
                                    text-[7px]
                                    uppercase
                                    tracking-[0.2em]
                                    ${
                                      isActive
                                        ? "text-cyan-700/70 dark:text-cyan-300/70"
                                        : "text-black/20 dark:text-white/15"
                                    }
                                  `}
                                >
                                  {isActive ? "ACTIVE" : "READY"}
                                </span>

                                <span
                                  className={`
                                    h-1
                                    w-1
                                    rounded-full
                                    ${
                                      isActive
                                        ? "bg-cyan-500 dark:bg-cyan-300"
                                        : "bg-black/15 dark:bg-white/10"
                                    }
                                  `}
                                />
                              </div>
                            </div>

                            {/* Description */}
                            <p
                              className="
                                mt-4
                                max-w-2xl
                                text-sm
                                leading-7
                                text-black/45
                                dark:text-white/35
                                sm:text-base
                              "
                            >
                              {step.description}
                            </p>

                            {/* Technical footer */}
                            <div className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-2">
                              <div
                                className={`
                                  h-px
                                  w-16
                                  transition-all
                                  duration-500
                                  sm:w-24
                                  ${
                                    isActive
                                      ? "bg-gradient-to-r from-cyan-500/60 to-transparent dark:from-cyan-300/60"
                                      : "bg-black/[0.08] dark:bg-white/[0.07]"
                                  }
                                `}
                              />

                              <span
                                className="
                                  font-mono
                                  text-[7px]
                                  uppercase
                                  tracking-[0.2em]
                                  text-black/22
                                  dark:text-white/15
                                "
                              >
                                {step.code}
                              </span>

                              <span
                                className={`
                                  font-mono
                                  text-[7px]
                                  uppercase
                                  tracking-[0.2em]
                                  transition-colors
                                  ${
                                    isActive
                                      ? "text-cyan-700/70 dark:text-cyan-300/70"
                                      : "text-black/18 dark:text-white/10"
                                  }
                                `}
                              >
                                {step.action}
                              </span>
                            </div>
                          </div>

                          {/* Small active marker */}
                          <div
                            className={`
                              mt-6
                              hidden
                              h-5
                              w-5
                              shrink-0
                              items-center
                              justify-center
                              rounded-full
                              border
                              sm:flex
                              ${
                                isActive
                                  ? "border-cyan-500/25 bg-cyan-500/[0.05] dark:border-cyan-300/25 dark:bg-cyan-300/[0.04]"
                                  : "border-black/[0.06] dark:border-white/[0.06]"
                              }
                            `}
                          >
                            <ChevronRight
                              className={`
                                h-3
                                w-3
                                transition-colors
                                ${
                                  isActive
                                    ? "text-cyan-600 dark:text-cyan-300"
                                    : "text-black/20 dark:text-white/15"
                                }
                              `}
                            />
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>

                {/* ==========================================================
                    FINAL OUTPUT
                ========================================================== */}

                <motion.div
                  initial={
                    shouldReduceMotion
                      ? undefined
                      : {
                          opacity: 0,
                          y: 12,
                        }
                  }
                  whileInView={
                    shouldReduceMotion
                      ? undefined
                      : {
                          opacity: 1,
                          y: 0,
                        }
                  }
                  viewport={{
                    once: true,
                    amount: 0.3,
                  }}
                  transition={{
                    duration: 0.7,
                  }}
                  className="
                    relative
                    mt-1
                    flex
                    items-center
                    gap-4
                    border-t
                    border-black/[0.07]
                    pt-6
                    dark:border-white/[0.07]
                  "
                >
                  {/* Output node */}
                  <motion.div
                    animate={
                      shouldReduceMotion
                        ? undefined
                        : {
                            scale: [0.9, 1.08, 0.9],
                            opacity: [0.55, 1, 0.55],
                          }
                    }
                    transition={{
                      duration: 1.8,
                      repeat: Infinity,
                    }}
                    className="
                      relative
                      z-20
                      flex
                      h-[62px]
                      w-[62px]
                      shrink-0
                      items-center
                      justify-center
                      rounded-2xl
                      border
                      border-cyan-500/25
                      bg-cyan-500/[0.045]
                      dark:border-cyan-300/20
                      dark:bg-cyan-300/[0.04]
                    "
                  >
                    <span
                      className="
                        h-2
                        w-2
                        rounded-full
                        bg-cyan-500
                        shadow-[0_0_16px_5px_rgba(6,182,212,.35)]
                        dark:bg-cyan-300
                        dark:shadow-[0_0_16px_5px_rgba(103,232,249,.7)]
                      "
                    />
                  </motion.div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span
                        className="
                          font-mono
                          text-[8px]
                          uppercase
                          tracking-[0.25em]
                          text-cyan-700/70
                          dark:text-cyan-300/70
                        "
                      >
                        OUTPUT READY
                      </span>

                      <span className="h-1 w-1 rounded-full bg-cyan-500 dark:bg-cyan-300" />
                    </div>

                    <div
                      className="
                        mt-1
                        text-sm
                        text-black/45
                        dark:text-white/45
                      "
                    >
                      Your first result starts here.
                    </div>
                  </div>
                </motion.div>
              </div>
            </div>

            {/* Active step selector */}
            <div className="mt-5 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                {STEPS.map((step, index) => {
                  const isActive = activeStep === index;

                  return (
                    <button
                      key={step.number}
                      type="button"
                      onClick={() => setActiveStep(index)}
                      aria-label={`Select ${step.title}`}
                      className={`
                        group
                        h-1.5
                        overflow-hidden
                        rounded-full
                        transition-all
                        duration-500
                        ${
                          isActive
                            ? "w-12 bg-cyan-500/70 dark:bg-cyan-300/70"
                            : "w-5 bg-black/10 hover:bg-black/20 dark:bg-white/10 dark:hover:bg-white/20"
                        }
                      `}
                    >
                      <span
                        className={`
                          block
                          h-full
                          rounded-full
                          ${
                            isActive
                              ? "bg-cyan-500 dark:bg-cyan-300"
                              : "bg-transparent"
                          }
                        `}
                      />
                    </button>
                  );
                })}
              </div>

              <span
                className="
                  font-mono
                  text-[7px]
                  uppercase
                  tracking-[0.22em]
                  text-black/25
                  dark:text-white/15
                "
              >
                {STEPS[activeStep].number} / {STEPS.length.toString().padStart(2, "0")}
              </span>
            </div>
          </div>
        </div>

        {/* ==============================================================
            BOTTOM STATUS
        ============================================================== */}

        <div
          className="
            mt-10
            border-t
            border-black/[0.07]
            pt-5
            dark:border-white/[0.06]
            sm:mt-14
          "
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <span
                className="
                  h-1.5
                  w-1.5
                  rounded-full
                  bg-cyan-500
                  shadow-[0_0_10px_3px_rgba(6,182,212,.28)]
                  dark:bg-cyan-300
                  dark:shadow-[0_0_10px_3px_rgba(103,232,249,.55)]
                "
              />

              <span
                className="
                  font-mono
                  text-[7px]
                  uppercase
                  tracking-[0.22em]
                  text-black/25
                  dark:text-white/20
                "
              >
                Renderuim engine online
              </span>
            </div>

            <div className="flex items-center gap-4">
              <span
                className="
                  font-mono
                  text-[7px]
                  uppercase
                  tracking-[0.22em]
                  text-black/20
                  dark:text-white/15
                "
              >
                SYSTEM / 3 STEPS
              </span>

              <span
                className="
                  h-px
                  w-12
                  bg-gradient-to-r
                  from-cyan-500/30
                  to-transparent
                  dark:from-cyan-300/30
                "
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}