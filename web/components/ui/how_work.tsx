"use client";

import React, { useEffect, useRef, useState } from "react";
import Image from "next/image";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { motion } from "framer-motion";
if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

// ============================================================================
// TYPES & GEOMETRY DATA MODEL
// ============================================================================

export type RoomType =
  | "master"
  | "bedroom"
  | "bath"
  | "dressing"
  | "corridor"
  | "stair"
  | "terrace";

export interface ArchitecturalVolume {
  id: string;
  name: string;
  type: RoomType;
  x: number;
  y: number;
  width: number;
  depth: number;
  height: number;
  elevation: number;
  isCantilever?: boolean;
  hasGlazing?: boolean;
}

export interface SlabGeometry {
  id: string;
  x: number;
  y: number;
  width: number;
  depth: number;
  elevation: number;
  thickness: number;
}

export interface WallSegment {
  id: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  thickness: number;
  isExterior: boolean;
}

// ============================================================================
// COLOR SYSTEM
// ============================================================================

const ACCENT = "hsl(189.16deg 79.17% 47.06%)";

// ============================================================================
// SINGLE SOURCE OF TRUTH GEOMETRY
// ============================================================================

const VILLA_VOLUMES: ArchitecturalVolume[] = [
  {
    id: "v-master",
    name: "Master Suite",
    type: "master",
    x: 60,
    y: 80,
    width: 220,
    depth: 160,
    height: 110,
    elevation: 120,
    isCantilever: true,
    hasGlazing: true,
  },
  {
    id: "v-bath-m",
    name: "Master Bath",
    type: "bath",
    x: 280,
    y: 80,
    width: 110,
    depth: 100,
    height: 110,
    elevation: 120,
  },
  {
    id: "v-dressing",
    name: "Dressing Area",
    type: "dressing",
    x: 280,
    y: 180,
    width: 110,
    depth: 60,
    height: 110,
    elevation: 120,
  },
  {
    id: "v-corridor-2",
    name: "Upper Corridor",
    type: "corridor",
    x: 60,
    y: 240,
    width: 330,
    depth: 50,
    height: 110,
    elevation: 120,
  },
  {
    id: "v-stair",
    name: "Stair Core",
    type: "stair",
    x: 390,
    y: 80,
    width: 90,
    depth: 210,
    height: 260,
    elevation: 0,
  },
  {
    id: "v-bed1",
    name: "Bedroom 01",
    type: "bedroom",
    x: 60,
    y: 290,
    width: 150,
    depth: 130,
    height: 100,
    elevation: 0,
    hasGlazing: true,
  },
  {
    id: "v-bed2",
    name: "Bedroom 02",
    type: "bedroom",
    x: 210,
    y: 290,
    width: 140,
    depth: 130,
    height: 100,
    elevation: 0,
    hasGlazing: true,
  },
  {
    id: "v-bath-s",
    name: "Shared Bath",
    type: "bath",
    x: 350,
    y: 290,
    width: 130,
    depth: 130,
    height: 100,
    elevation: 0,
  },
  {
    id: "v-terrace-g",
    name: "Ground Terrace",
    type: "terrace",
    x: 480,
    y: 220,
    width: 180,
    depth: 200,
    height: 12,
    elevation: 0,
  },
  {
    id: "v-terrace-u",
    name: "Upper Cantilever Deck",
    type: "terrace",
    x: 60,
    y: 40,
    width: 220,
    depth: 40,
    height: 15,
    elevation: 120,
  },
];

const VILLA_SLABS: SlabGeometry[] = [
  {
    id: "s-ground",
    x: 40,
    y: 60,
    width: 640,
    depth: 380,
    elevation: 0,
    thickness: 12,
  },
  {
    id: "s-mid",
    x: 50,
    y: 70,
    width: 440,
    depth: 230,
    elevation: 110,
    thickness: 14,
  },
  {
    id: "s-roof-m",
    x: 50,
    y: 30,
    width: 440,
    depth: 270,
    elevation: 230,
    thickness: 16,
  },
  {
    id: "s-roof-stair",
    x: 385,
    y: 75,
    width: 100,
    depth: 220,
    elevation: 260,
    thickness: 14,
  },
];

const VILLA_WALLS: WallSegment[] = [
  // Outer Envelope
  {
    id: "w1",
    x1: 60,
    y1: 80,
    x2: 390,
    y2: 80,
    thickness: 6,
    isExterior: true,
  },
  {
    id: "w2",
    x1: 390,
    y1: 80,
    x2: 480,
    y2: 80,
    thickness: 6,
    isExterior: true,
  },
  {
    id: "w3",
    x1: 480,
    y1: 80,
    x2: 480,
    y2: 420,
    thickness: 6,
    isExterior: true,
  },
  {
    id: "w4",
    x1: 480,
    y1: 420,
    x2: 60,
    y2: 420,
    thickness: 6,
    isExterior: true,
  },
  {
    id: "w5",
    x1: 60,
    y1: 420,
    x2: 60,
    y2: 80,
    thickness: 6,
    isExterior: true,
  },

  // Internal Partitions
  {
    id: "w6",
    x1: 280,
    y1: 80,
    x2: 280,
    y2: 240,
    thickness: 3,
    isExterior: false,
  },
  {
    id: "w7",
    x1: 60,
    y1: 240,
    x2: 390,
    y2: 240,
    thickness: 4,
    isExterior: false,
  },
  {
    id: "w8",
    x1: 390,
    y1: 80,
    x2: 390,
    y2: 290,
    thickness: 5,
    isExterior: false,
  },
  {
    id: "w9",
    x1: 210,
    y1: 290,
    x2: 210,
    y2: 420,
    thickness: 3,
    isExterior: false,
  },
  {
    id: "w10",
    x1: 350,
    y1: 290,
    x2: 350,
    y2: 420,
    thickness: 3,
    isExterior: false,
  },
];

// ============================================================================
// WORKFLOW
// ============================================================================

const WORKFLOW_STEPS = [
  {
    id: "step-01",
    phase: "PHASE 01",
    title: "Parametric Floor Plan",
    subtitle: "2D VECTOR VECTORIZATION",
    description:
      "Architectural vectorization of functional zones, internal circulation cores, and precise structural wall thickness.",
  },
  {
    id: "step-02",
    phase: "PHASE 02",
    title: "Structural Extrusion",
    subtitle: "3D WALL & CORE ERECTION",
    description:
      "Vertical extrusion of load-bearing structures, stairwell cores, and architectural slab planes directly from plan geometry.",
  },
  {
    id: "step-03",
    phase: "PHASE 03",
    title: "Volumetric Cantilever",
    subtitle: "MASSING & ELEVATION DEPTH",
    description:
      "Floating upper-level master wing cantilevered over ground living zones, creating architectural shadow planes.",
  },
  {
    id: "step-04",
    phase: "PHASE 04",
    title: "Material & Atmosphere",
    subtitle: "PHOTOREALISTIC RENDERING",
    description:
      "Integration of high-resolution PBR materials, full-height floor-to-ceiling glazing, limestone framing, and physical lighting.",
  },
];

// ============================================================================
// AXONOMETRIC GEOMETRY
// ============================================================================

function projectAxo(
  x: number,
  y: number,
  z: number,
  scale = 0.85,
  originX = 350,
  originY = 280,
) {
  const cos30 = 0.866;
  const sin30 = 0.5;

  const isoX =
    originX + (x - y) * cos30 * scale;

  const isoY =
    originY +
    (x + y) * sin30 * 0.5 * scale -
    z * scale;

  return {
    x: isoX,
    y: isoY,
  };
}

function getAxoBoxPaths(
  x: number,
  y: number,
  width: number,
  depth: number,
  height: number,
  elevation: number,
  scale = 0.85,
  originX = 350,
  originY = 280,
) {
  const z0 = elevation;
  const z1 = elevation + height;

  const p0 = projectAxo(
    x,
    y,
    z0,
    scale,
    originX,
    originY,
  );

  const p2 = projectAxo(
    x + width,
    y + depth,
    z0,
    scale,
    originX,
    originY,
  );

  const p3 = projectAxo(
    x,
    y + depth,
    z0,
    scale,
    originX,
    originY,
  );

  const p4 = projectAxo(
    x,
    y,
    z1,
    scale,
    originX,
    originY,
  );

  const p5 = projectAxo(
    x + width,
    y,
    z1,
    scale,
    originX,
    originY,
  );

  const p6 = projectAxo(
    x + width,
    y + depth,
    z1,
    scale,
    originX,
    originY,
  );

  const p7 = projectAxo(
    x,
    y + depth,
    z1,
    scale,
    originX,
    originY,
  );

  return {
    top: `M ${p4.x} ${p4.y} L ${p5.x} ${p5.y} L ${p6.x} ${p6.y} L ${p7.x} ${p7.y} Z`,
    left: `M ${p4.x} ${p4.y} L ${p7.x} ${p7.y} L ${p3.x} ${p3.y} L ${p0.x} ${p0.y} Z`,
    right: `M ${p7.x} ${p7.y} L ${p6.x} ${p6.y} L ${p2.x} ${p2.y} L ${p3.x} ${p3.y} Z`,
  };
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function HowItWorks() {
  const sectionRef = useRef<HTMLElement>(null);
  const pinRef = useRef<HTMLDivElement>(null);

  const svgPlanGroupRef = useRef<SVGGElement>(null);
  const svgExtrusionGroupRef =
    useRef<SVGGElement>(null);

  const scanlineRef =
    useRef<SVGLineElement>(null);

  const finalImageRef =
    useRef<HTMLDivElement>(null);

  const [activeStepIndex, setActiveStepIndex] =
    useState(0);

  useEffect(() => {
    const ctx = gsap.context(() => {
      const section = sectionRef.current;
      const pin = pinRef.current;

      if (!section || !pin) return;

      const masterTl = gsap.timeline({
        scrollTrigger: {
          trigger: section,
          start: "top top",
          end: "+=300%",
          pin: pin,
          scrub: 1,
          anticipatePin: 1,
          invalidateOnRefresh: true,

          onUpdate: (self) => {
            const p = self.progress;

            const nextStep =
              p < 0.22
                ? 0
                : p < 0.45
                  ? 1
                  : p < 0.6
                    ? 2
                    : 3;

            setActiveStepIndex((current) =>
              current === nextStep
                ? current
                : nextStep,
            );
          },
        },
      });

      const planGroup =
        svgPlanGroupRef.current;

      const extrusionGroup =
        svgExtrusionGroupRef.current;

      const scanline =
        scanlineRef.current;

      const finalRender =
        finalImageRef.current;

      if (
        !planGroup ||
        !extrusionGroup ||
        !finalRender
      ) {
        return;
      }

      // --------------------------------------------------------
      // INITIAL STATE
      // --------------------------------------------------------

      masterTl.set(extrusionGroup, {
        opacity: 0,
      });

      masterTl.set(finalRender, {
        opacity: 0,
        scale: 1.05,
        filter: "blur(12px)",
      });

      // --------------------------------------------------------
      // PHASE 01
      // --------------------------------------------------------

      masterTl.fromTo(
        planGroup,
        {
          opacity: 0,
          scale: 0.95,
        },
        {
          opacity: 1,
          scale: 1,
          duration: 0.18,
          ease: "power2.out",
        },
        0,
      );

      if (scanline) {
        masterTl.fromTo(
          scanline,
          {
            attr: {
              y1: 20,
              y2: 20,
            },
            opacity: 0,
          },
          {
            attr: {
              y1: 460,
              y2: 460,
            },
            opacity: 0.7,
            duration: 0.18,
            ease: "none",
          },
          0,
        );
      }

      // --------------------------------------------------------
      // PHASE 02
      // --------------------------------------------------------

      masterTl.to(
        planGroup,
        {
          opacity: 0.15,
          scale: 0.9,
          y: 30,
          duration: 0.17,
          ease: "power2.inOut",
        },
        0.18,
      );

      masterTl.to(
        extrusionGroup,
        {
          opacity: 1,
          duration: 0.12,
          ease: "power2.out",
        },
        0.22,
      );

      const wallVolumes =
        extrusionGroup.querySelectorAll(
          ".volume-wall",
        );

      masterTl.fromTo(
        wallVolumes,
        {
          opacity: 0,
          transformOrigin:
            "bottom center",
          scaleY: 0,
        },
        {
          opacity: 1,
          scaleY: 1,
          stagger: 0.02,
          duration: 0.15,
          ease: "back.out(1.2)",
        },
        0.25,
      );

      // --------------------------------------------------------
      // PHASE 03
      // --------------------------------------------------------

      const slabs =
        extrusionGroup.querySelectorAll(
          ".volume-slab",
        );

      masterTl.fromTo(
        slabs,
        {
          opacity: 0,
          y: -20,
        },
        {
          opacity: 0.9,
          y: 0,
          stagger: 0.04,
          duration: 0.18,
          ease: "power3.out",
        },
        0.35,
      );

      const cantilever =
        extrusionGroup.querySelectorAll(
          ".volume-cantilever",
        );

      masterTl.fromTo(
        cantilever,
        {
          opacity: 0,
          scale: 0.8,
        },
        {
          opacity: 1,
          scale: 1,
          duration: 0.15,
          ease: "power2.out",
        },
        0.45,
      );

      // --------------------------------------------------------
      // PHASE 04
      // --------------------------------------------------------

      const glazing =
        extrusionGroup.querySelectorAll(
          ".volume-glazing",
        );

      masterTl.fromTo(
        glazing,
        {
          opacity: 0,
          strokeDasharray: "200",
          strokeDashoffset: "200",
        },
        {
          opacity: 0.85,
          strokeDashoffset: "0",
          duration: 0.15,
          ease: "power1.inOut",
        },
        0.6,
      );

      // --------------------------------------------------------
      // PHASE 05
      // --------------------------------------------------------

      masterTl.to(
        extrusionGroup,
        {
          opacity: 0,
          scale: 1.03,
          filter: "blur(6px)",
          duration: 0.15,
          ease: "power2.in",
        },
        0.78,
      );

      masterTl.to(
        finalRender,
        {
          opacity: 1,
          scale: 1,
          filter: "blur(0px)",
          duration: 0.2,
          ease: "power2.out",
        },
        0.8,
      );
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  return (
    <>
      <style jsx global>{`
        .how-it-works-theme {
          --how-bg: #ffffff;
          --how-panel: rgba(255, 255, 255, 0.72);
          --how-panel-solid: #f7f9fa;

          --how-plan-bg: #f7f9fa;
          --how-room: #eef3f5;
          --how-terrace: #e5ecef;

          --how-grid: rgba(15, 23, 42, 0.08);
          --how-line: rgba(15, 23, 42, 0.22);
          --how-line-strong: rgba(15, 23, 42, 0.52);

          --how-wall-top: #d9e2e6;
          --how-wall-left: #c6d1d6;
          --how-wall-right: #b6c2c8;

          --how-text: #0f172a;
          --how-muted: rgba(15, 23, 42, 0.5);
          --how-subtle: rgba(15, 23, 42, 0.34);

          --how-glass: ${ACCENT};
          --how-accent-soft: hsla(
            189.16,
            79.17%,
            47.06%,
            0.12
          );
        }

        .dark .how-it-works-theme {
          --how-bg: #050608;
          --how-panel: rgba(15, 16, 19, 0.78);
          --how-panel-solid: #0f1013;

          --how-plan-bg: #14161b;
          --how-room: #1a1c23;
          --how-terrace: #1e232d;

          --how-grid: rgba(255, 255, 255, 0.055);
          --how-line: rgba(255, 255, 255, 0.25);
          --how-line-strong: rgba(
            255,
            255,
            255,
            0.65
          );

          --how-wall-top: #2a2d34;
          --how-wall-left: #181a1f;
          --how-wall-right: #0c0d10;

          --how-text: #ffffff;
          --how-muted: rgba(255, 255, 255, 0.43);
          --how-subtle: rgba(255, 255, 255, 0.26);

          --how-glass: #38bdf8;
          --how-accent-soft: rgba(
            103,
            232,
            249,
            0.08
          );
        }
      `}</style>

      <section
        id="how-it-works"
        data-circuit-section="how-it-works"
        ref={sectionRef}
        aria-label="Architectural Process and Transformation"
        className="
          how-it-works-theme
          relative
          w-full
          overflow-hidden
          font-sans

          bg-white
          text-black

          dark:bg-[#050608]
          dark:text-white
        "
      >
        {/* ======================================================
            ATMOSPHERIC BACKGROUND
        ======================================================= */}

        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          {/* Main blue atmosphere */}

          <div
            className="
              absolute
              left-1/2
              top-[-180px]
              h-[720px]
              w-[1050px]
              -translate-x-1/2
              rounded-full
              blur-[110px]
            "
            style={{
              background:
                "radial-gradient(circle, hsla(189.16,79.17%,47.06%,0.14) 0%, hsla(189.16,79.17%,47.06%,0.07) 32%, transparent 72%)",
            }}
          />

          {/* Secondary left glow */}

          <div
            className="
              absolute
              -left-[180px]
              top-[34%]
              h-[520px]
              w-[520px]
              rounded-full
              blur-[120px]
            "
            style={{
              background:
                "radial-gradient(circle, hsla(189.16,79.17%,47.06%,0.065), transparent 72%)",
            }}
          />

          {/* Secondary right glow */}

          <div
            className="
              absolute
              -right-[180px]
              top-[44%]
              h-[500px]
              w-[500px]
              rounded-full
              blur-[120px]
            "
            style={{
              background:
                "radial-gradient(circle, hsla(189.16,79.17%,47.06%,0.055), transparent 72%)",
            }}
          />

          {/* Light grid */}

          <div
            className="
              absolute
              inset-0
              dark:hidden
            "
            style={{
              opacity: 0.38,
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
              backgroundSize: "64px 64px",
            }}
          />

          {/* Dark grid */}

          <div
            className="
              absolute
              inset-0
              hidden
              dark:block
            "
            style={{
              opacity: 0.22,
              backgroundImage: `
                linear-gradient(
                  hsla(189.16,79.17%,47.06%,0.25) 1px,
                  transparent 1px
                ),
                linear-gradient(
                  90deg,
                  hsla(189.16,79.17%,47.06%,0.25) 1px,
                  transparent 1px
                )
              `,
              backgroundSize: "64px 64px",
            }}
          />
        </div>

        {/* ======================================================
            PINNED CONTAINER
        ======================================================= */}

        <div
          ref={pinRef}
          className="
            relative
            flex
            min-h-screen
            w-full
            flex-col
            justify-between
            p-5

            sm:p-8
            md:p-12
            lg:p-16
          "
        >
          {/* ==================================================
              HEADER
          ================================================== */}


<header
  className="
    relative
    z-20
    mb-8
    overflow-hidden
    border-b
    border-black/[0.08]
    pb-7

    dark:border-white/[0.10]

    md:mb-10
    md:pb-8
  "
>
  {/* ==================================================
      LOCAL HEADER GLOW
  ================================================== */}

  <div className="pointer-events-none absolute inset-0">
    <div
      className="
        absolute
        left-0
        top-[-120px]
        h-[280px]
        w-[520px]
        rounded-full
        blur-[110px]
      "
      style={{
        background:
          "radial-gradient(circle, hsla(189.16,79.17%,47.06%,0.10) 0%, transparent 72%)",
      }}
    />

    <div
      className="
        absolute
        right-[8%]
        top-[15%]
        h-[180px]
        w-[280px]
        rounded-full
        blur-[100px]
      "
      style={{
        background:
          "radial-gradient(circle, hsla(189.16,79.17%,47.06%,0.045) 0%, transparent 72%)",
      }}
    />
  </div>

  <div
    className="
      relative
      flex
      flex-col
      gap-7

      md:flex-row
      md:items-end
      md:justify-between
      md:gap-10
    "
  >
    {/* ==================================================
        LEFT
    ================================================== */}

    <div className="min-w-0">
      {/* system label */}

      <div className="flex items-center gap-3">
        <div className="relative flex items-center">
          <span
            className="
              block
              h-px
              w-8
            "
            style={{
              backgroundColor: ACCENT,
              boxShadow:
                "0 0 10px hsla(189.16,79.17%,47.06%,0.45)",
            }}
          />

          <motion.span
            animate={{
              x: [0, 22, 0],
              opacity: [0.2, 1, 0.2],
            }}
            transition={{
              duration: 2.2,
              repeat: Infinity,
              ease: "linear",
            }}
            className="
              absolute
              left-0
              h-1
              w-1
              rounded-full
            "
            style={{
              backgroundColor: ACCENT,
              boxShadow:
                "0 0 8px 2px hsla(189.16,79.17%,47.06%,0.7)",
            }}
          />
        </div>

        <span
          className="
            font-mono
            text-[9px]
            font-semibold
            uppercase
            tracking-[0.32em]
          "
          style={{
            color: ACCENT,
          }}
        >
          Process / Transformation
        </span>

        <span
          className="
            hidden
            h-1
            w-1
            rounded-full
            bg-black/15
            dark:bg-white/15
            sm:block
          "
        />

        <span
          className="
            hidden
            font-mono
            text-[8px]
            uppercase
            tracking-[0.2em]
            text-black/30
            dark:text-white/30
            sm:block
          "
        >
          04 Stages
        </span>
      </div>

      {/* title */}

      <div className="relative mt-3">
        <h2
          className="
            text-3xl
            font-light
            leading-[1.02]
            tracking-[-0.045em]
            text-black

            dark:text-white

            sm:text-4xl
            md:text-5xl
            lg:text-[3.4rem]
          "
        >
          From plan
          <span className="text-black/30 dark:text-white/30">
            {" "}
            to realization.
          </span>
        </h2>

        {/* subtle signal under title */}

        <div className="mt-4 flex items-center gap-2">
          <div
            className="
              h-px
              w-14
              sm:w-20
            "
            style={{
              background: `linear-gradient(
                90deg,
                ${ACCENT},
                transparent
              )`,
            }}
          />

          <motion.span
            animate={{
              opacity: [0.25, 1, 0.25],
              scale: [0.8, 1.15, 0.8],
            }}
            transition={{
              duration: 1.8,
              repeat: Infinity,
            }}
            className="h-1.5 w-1.5 rounded-full"
            style={{
              backgroundColor: ACCENT,
              boxShadow:
                "0 0 10px 3px hsla(189.16,79.17%,47.06%,0.55)",
            }}
          />

          <span
            className="
              font-mono
              text-[7px]
              uppercase
              tracking-[0.24em]
              text-black/25
              dark:text-white/25
            "
          >
            spatial engine active
          </span>
        </div>
      </div>
    </div>

    {/* ==================================================
        RIGHT DESCRIPTION
    ================================================== */}

    <div className="relative max-w-lg md:pb-1">
      <p
        className="
          text-sm
          font-light
          leading-7
          text-black/55
          dark:text-white/50
          md:text-[15px]
          md:leading-7
        "
      >
        Watch Renderuim transform a structured architectural
        plan into spatial massing, structural volume, and a
        presentation-ready visual.
      </p>

      {/* technical metadata */}

      <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="flex items-center gap-2">
          <span
            className="
              h-1.5
              w-1.5
              rounded-full
            "
            style={{
              backgroundColor: ACCENT,
              boxShadow:
                "0 0 8px 2px hsla(189.16,79.17%,47.06%,0.5)",
            }}
          />

          <span
            className="
              font-mono
              text-[7px]
              uppercase
              tracking-[0.2em]
              text-black/35
              dark:text-white/30
            "
          >
            2D VECTOR
          </span>
        </div>

        <span className="h-px w-5 bg-black/10 dark:bg-white/10" />

        <span
          className="
            font-mono
            text-[7px]
            uppercase
            tracking-[0.2em]
            text-black/35
            dark:text-white/30
          "
        >
          3D MASSING
        </span>

        <span className="h-px w-5 bg-black/10 dark:bg-white/10" />

        <span
          className="
            font-mono
            text-[7px]
            uppercase
            tracking-[0.2em]
            text-black/35
            dark:text-white/30
          "
        >
          FINAL RENDER
        </span>
      </div>
    </div>
  </div>

  {/* ==================================================
      BOTTOM TECHNICAL RAIL
  ================================================== */}

  <div
    className="
      relative
      mt-7
      flex
      items-center
      justify-between
      border-t
      border-black/[0.06]
      pt-3

      dark:border-white/[0.07]
    "
  >
    <span
      className="
        font-mono
        text-[7px]
        uppercase
        tracking-[0.24em]
        text-black/25
        dark:text-white/25
      "
    >
      ARCHITECTURAL WORKFLOW
    </span>

    <div className="flex items-center gap-2">
      <span
        className="
          h-px
          w-10
          bg-black/10
          dark:bg-white/10
          sm:w-16
        "
      />

      <motion.span
        animate={{
          x: [-18, 18, -18],
          opacity: [0.15, 1, 0.15],
        }}
        transition={{
          duration: 2.8,
          repeat: Infinity,
          ease: "linear",
        }}
        className="h-px w-6"
        style={{
          backgroundColor: ACCENT,
          boxShadow:
            "0 0 8px hsla(189.16,79.17%,47.06%,0.65)",
        }}
      />

      <span
        className="
          font-mono
          text-[7px]
          text-black/25
          dark:text-white/25
        "
      >
        01 — 04
      </span>
    </div>

    <span
      className="
        hidden
        font-mono
        text-[7px]
        uppercase
        tracking-[0.24em]
        text-black/25
        dark:text-white/25
        sm:block
      "
    >
      SPATIAL ENGINE
    </span>
  </div>
</header>



          {/* ==================================================
              MAIN DISPLAY GRID
          ================================================== */}

          <div
            className="
              relative
              z-10
              my-auto
              grid
              flex-1
              grid-cols-1
              items-center
              gap-8

              lg:grid-cols-12
            "
          >
            {/* ==================================================
                LEFT WORKFLOW
            ================================================== */}

            <div
              className="
                order-2
                flex
                flex-col
                justify-center
                space-y-2

                lg:order-1
                lg:col-span-4
                lg:space-y-5
              "
            >
              {WORKFLOW_STEPS.map(
                (step, idx) => {
                  const isActive =
                    activeStepIndex === idx;

                  return (
                    <div
                      key={step.id}
                      className={`
                        relative
                        border-l-2
                        py-2
                        pl-4
                        transition-all
                        duration-500
                        sm:pl-6

                        ${
                          isActive
                            ? `
                              border-[hsl(189.16deg_79.17%_47.06%)]
                              bg-black/[0.025]
                              backdrop-blur-sm

                              dark:bg-white/[0.035]
                            `
                            : `
                              border-black/[0.08]
                              opacity-40

                              hover:opacity-70

                              dark:border-white/[0.10]
                            `
                        }
                      `}
                    >
                      <div
                        className="
                          mb-1
                          flex
                          items-center
                          gap-3
                          font-mono
                          text-[9px]
                          tracking-[0.16em]

                          text-[hsl(189.16deg_79.17%_47.06%)]
                        "
                      >
                        <span>{step.phase}</span>

                        <span className="text-black/20 dark:text-white/20">
                          •
                        </span>

                        <span className="text-black/40 dark:text-white/35">
                          {step.subtitle}
                        </span>
                      </div>

                      <h3
                        className="
                          mb-1
                          text-base
                          font-medium
                          text-black
                          dark:text-white

                          sm:text-lg
                          md:text-xl
                        "
                      >
                        {step.title}
                      </h3>

                      <p
                        className="
                          hidden
                          text-xs
                          font-light
                          leading-relaxed
                          text-black/45
                          dark:text-white/40

                          sm:block
                          md:text-sm
                        "
                      >
                        {step.description}
                      </p>
                    </div>
                  );
                },
              )}
            </div>

            {/* ==================================================
                CENTER ARCHITECTURAL FRAME
            ================================================== */}

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
              {/* Architectural frame glow */}

              <div
                className="
                  pointer-events-none
                  absolute
                  inset-0
                  rounded-[24px]
                "
                style={{
                  boxShadow: `inset 0 0 90px hsla(189.16,79.17%,47.06%,0.035)`,
                }}
              />

              {/* Corner marks */}

              <div
                className="
                  absolute
                  left-4
                  top-4
                  z-30
                  h-4
                  w-4
                  border-l-2
                  border-t-2
                  border-black/20
                  dark:border-white/30
                "
              />

              <div
                className="
                  absolute
                  right-4
                  top-4
                  z-30
                  h-4
                  w-4
                  border-r-2
                  border-t-2
                  border-black/20
                  dark:border-white/30
                "
              />

              <div
                className="
                  absolute
                  bottom-4
                  left-4
                  z-30
                  h-4
                  w-4
                  border-b-2
                  border-l-2
                  border-black/15
                  dark:border-white/25
                "
              />

              <div
                className="
                  absolute
                  bottom-4
                  right-4
                  z-30
                  h-4
                  w-4
                  border-b-2
                  border-r-2
                  border-black/15
                  dark:border-white/25
                "
              />

              {/* ==================================================
                  SVG ARCHITECTURAL CANVAS
              ================================================== */}

              <svg
                viewBox="0 0 700 500"
                className="
                  absolute
                  inset-0
                  z-10
                  h-full
                  w-full
                  object-contain
                  p-4
                "
                preserveAspectRatio="xMidYMid meet"
              >
                <defs>
                  {/* Architectural Hatch */}

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

                  {/* Wall gradients */}

                  <linearGradient
                    id="wallTopGrad"
                    x1="0%"
                    y1="0%"
                    x2="100%"
                    y2="100%"
                  >
                    <stop
                      offset="0%"
                      stopColor="var(--how-wall-top)"
                    />

                    <stop
                      offset="100%"
                      stopColor="var(--how-room)"
                    />
                  </linearGradient>

                  <linearGradient
                    id="wallSideGrad"
                    x1="0%"
                    y1="0%"
                    x2="0%"
                    y2="100%"
                  >
                    <stop
                      offset="0%"
                      stopColor="var(--how-wall-left)"
                    />

                    <stop
                      offset="100%"
                      stopColor="var(--how-wall-right)"
                    />
                  </linearGradient>

                  {/* Glass */}

                  <linearGradient
                    id="glassGrad"
                    x1="0%"
                    y1="0%"
                    x2="100%"
                    y2="100%"
                  >
                    <stop
                      offset="0%"
                      stopColor="var(--how-glass)"
                      stopOpacity="0.42"
                    />

                    <stop
                      offset="100%"
                      stopColor="var(--how-glass)"
                      stopOpacity="0.08"
                    />
                  </linearGradient>
                </defs>

                {/* ==================================================
                    STAGE 01 — 2D PLAN
                ================================================== */}

                <g
                  ref={svgPlanGroupRef}
                  className="origin-center"
                >
                  {/* Base plan */}

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

                  {/* Architectural grid */}

                  {[100, 200, 300, 400, 500, 600].map(
                    (x) => (
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
                    ),
                  )}

                  {[100, 200, 300, 400].map(
                    (y) => (
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
                    ),
                  )}

                  {/* Rooms */}

                  {VILLA_VOLUMES.map((vol) => (
                    <g
                      key={`plan-vol-${vol.id}`}
                    >
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

                  {/* Walls */}

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

                  {/* Stair */}

                  <g transform="translate(390, 80)">
                    {[15, 30, 45, 60, 75, 90, 105, 120, 135].map(
                      (sY) => (
                        <line
                          key={`stair-${sY}`}
                          x1="10"
                          y1={sY}
                          x2="80"
                          y2={sY}
                          stroke="var(--how-line)"
                          strokeWidth="1"
                        />
                      ),
                    )}

                    <path
                      d="M 45 140 L 45 20 M 40 25 L 45 20 L 50 25"
                      stroke="var(--how-glass)"
                      strokeWidth="1.5"
                      fill="none"
                    />
                  </g>

                  {/* Door swing */}

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

                  {/* Scanline */}

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

                {/* ==================================================
                    STAGE 02 + 03 — 3D EXTRUSION
                ================================================== */}

                <g
                  ref={svgExtrusionGroupRef}
                  className="origin-center"
                >
                  {/* Slabs */}

                  {VILLA_SLABS.map((slab) => {
                    const paths =
                      getAxoBoxPaths(
                        slab.x,
                        slab.y,
                        slab.width,
                        slab.depth,
                        slab.thickness,
                        slab.elevation,
                      );

                    return (
                      <g
                        key={`slab-${slab.id}`}
                        className="volume-slab"
                      >
                        <path
                          d={paths.top}
                          fill="var(--how-wall-top)"
                          stroke="var(--how-line)"
                          strokeWidth="0.75"
                        />

                        <path
                          d={paths.left}
                          fill="var(--how-wall-left)"
                          stroke="var(--how-line)"
                          strokeWidth="0.75"
                        />

                        <path
                          d={paths.right}
                          fill="var(--how-wall-right)"
                          stroke="var(--how-line)"
                          strokeWidth="0.75"
                        />
                      </g>
                    );
                  })}

                  {/* Extruded volumes */}

                  {VILLA_VOLUMES.filter(
                    (volume) =>
                      volume.type !== "terrace",
                  ).map((volume) => {
                    const paths =
                      getAxoBoxPaths(
                        volume.x,
                        volume.y,
                        volume.width,
                        volume.depth,
                        volume.height,
                        volume.elevation,
                      );

                    const isUpper =
                      volume.elevation > 0;

                    return (
                      <g
                        key={`ext-${volume.id}`}
                        className={`volume-wall ${
                          isUpper
                            ? "volume-cantilever"
                            : ""
                        }`}
                      >
                        {/* top */}

                        <path
                          d={paths.top}
                          fill="url(#wallTopGrad)"
                          stroke="var(--how-line-strong)"
                          strokeWidth="0.75"
                        />

                        {/* left */}

                        <path
                          d={paths.left}
                          fill="url(#wallSideGrad)"
                          stroke="var(--how-line)"
                          strokeWidth="0.75"
                        />

                        {/* right */}

                        <path
                          d={paths.right}
                          fill="var(--how-wall-right)"
                          stroke="var(--how-line)"
                          strokeWidth="0.75"
                        />
                      </g>
                    );
                  })}

                  {/* Glazing */}

                  {VILLA_VOLUMES.filter(
                    (volume) =>
                      volume.hasGlazing,
                  ).map((volume) => {
                    const paths =
                      getAxoBoxPaths(
                        volume.x + 4,
                        volume.y + 4,
                        volume.width - 8,
                        volume.depth - 8,
                        volume.height - 10,
                        volume.elevation + 5,
                      );

                    return (
                      <g
                        key={`glazing-${volume.id}`}
                        className="volume-glazing"
                      >
                        <path
                          d={paths.right}
                          fill="url(#glassGrad)"
                          stroke="var(--how-glass)"
                          strokeOpacity="0.65"
                          strokeWidth="1"
                        />
                      </g>
                    );
                  })}
                </g>
              </svg>

              {/* ==================================================
                  STAGE 04 — FINAL RENDER
              ================================================== */}

              <div
                ref={finalImageRef}
                className="
                  pointer-events-none
                  absolute
                  inset-0
                  z-20
                  h-full
                  w-full
                "
              >
                <Image
                  src="/appartment.webp"
                  alt="Contemporary apartment architectural visualization"
                  fill
                  sizes="(max-width: 768px) 100vw, 840px"
                  className="object-cover"
                />

                <div
                  className="
                    absolute
                    inset-0
                    bg-gradient-to-t
                    from-black/30
                    via-transparent
                    to-transparent

                    dark:from-[#0B0C0E]/75
                  "
                />

                <div
                  className="
                    absolute
                    inset-x-0
                    top-0
                    h-24
                    bg-gradient-to-b
                    from-black/10
                    to-transparent
                    dark:from-black/20
                  "
                />
              </div>

              {/* ==================================================
                  TECHNICAL SPEC BAR
              ================================================== */}

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
                    className="
                      h-2
                      w-2
                      animate-pulse
                      rounded-full
                    "
                    style={{
                      backgroundColor: ACCENT,
                      boxShadow:
                        "0 0 10px hsla(189.16,79.17%,47.06%,0.7)",
                    }}
                  />

                  <span>
                    COORD: 31&#176;37&apos;50.2&quot;N{" "}
                    8&#176;00&apos;42.1&quot;W
                  </span>
                </div>

                <div className="hidden sm:block">
                  SCALE 1:100 @ A1
                </div>

                <div
                  className="
                    font-semibold
                    text-[hsl(189.16deg_79.17%_47.06%)]
                  "
                >
                  STAGE 0
                  {activeStepIndex + 1} / 04
                </div>
              </div>

              {/* top technical label */}

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
          </div>

          {/* ==================================================
              FOOTER / PROGRESS
          ================================================== */}

          <footer
            className="
              relative
              z-20
              mt-6
              flex
              items-center
              justify-between
              border-t
              border-black/[0.08]
              pt-4

              font-mono
              text-[9px]
              text-black/40

              dark:border-white/[0.10]
              dark:text-white/40
            "
          >
            <div className="hidden sm:block">
              ARCHITECTURAL MASSING GENERATOR
            </div>

            <div className="flex items-center gap-1.5">
              {[0, 1, 2, 3].map(
                (stepIdx) => (
                  <div
                    key={`rail-${stepIdx}`}
                    className={`
                      h-1
                      w-7
                      rounded-full
                      transition-all
                      duration-300
                      md:w-12

                      ${
                        activeStepIndex >=
                        stepIdx
                          ? `
                            bg-[hsl(189.16deg_79.17%_47.06%)]
                            shadow-[0_0_10px_hsla(189,79%,47%,0.45)]
                          `
                          : `
                            bg-black/[0.08]
                            dark:bg-white/[0.10]
                          `
                      }
                    `}
                  />
                ),
              )}
            </div>

            <div className="hidden sm:block">
              PROPRIETARY SPATIAL ENGINE
            </div>
          </footer>
        </div>
      </section>
    </>
  );
}

