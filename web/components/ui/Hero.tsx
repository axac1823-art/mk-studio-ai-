// "use client";

// import { useEffect, useMemo, useState } from "react";
// import {
//   ArrowRight,
//   ArrowUpRight,
//   ScanLine,
//   Sparkles,
// } from "lucide-react";
// import { motion, useReducedMotion } from "framer-motion";

// /* ============================================================
//    BRAND
// ============================================================ */

// const BRAND_CYAN = "hsl(189.16deg 79.17% 47.06%)";

// /* ============================================================
//    WORKFLOW DATA
// ============================================================ */

// const WORKFLOW_ITEMS = [
//   "Architectural renders",
//   "Screenshot to render",
//   "Generate images",
//   "Explore materials",
//   "Create multiple angles",
//   "Image to 3D",
//   "Text to 3D",
//   "Generate cinematic video",
//   "Upscale to 4K",
//   "Transform your scene",
// ];

// /* ============================================================
//    HERO AUDIENCE
// ============================================================ */

// const AUDIENCE = [
//   "ARCHITECTS",
//   "REAL ESTATE",
//   "INTERIOR DESIGN",
//   "ARCHVIZ STUDIOS",
// ];

// /* ============================================================
//    WORKFLOW LIST
// ============================================================ */

// function WorkflowList() {
//   const reduceMotion = Boolean(useReducedMotion());
//   const [activeIndex, setActiveIndex] = useState(0);

//   const items = useMemo(
//     () => [
//       ...WORKFLOW_ITEMS,
//       ...WORKFLOW_ITEMS,
//       ...WORKFLOW_ITEMS,
//     ],
//     [],
//   );

//   useEffect(() => {
//     if (reduceMotion) return;

//     const interval = window.setInterval(() => {
//       setActiveIndex((current) => {
//         const next = current + 1;

//         if (next >= WORKFLOW_ITEMS.length * 2) {
//           return WORKFLOW_ITEMS.length;
//         }

//         return next;
//       });
//     }, 1900);

//     return () => window.clearInterval(interval);
//   }, [reduceMotion]);

//   return (
//     <div className="relative hidden items-center gap-3 lg:flex">
//       <style>{`
//         @keyframes workflowElectricFlow {
//           0% {
//             transform: translateX(-120%);
//             opacity: 0;
//           }

//           18% {
//             opacity: 1;
//           }

//           65% {
//             opacity: 1;
//           }

//           100% {
//             transform: translateX(240%);
//             opacity: 0;
//           }
//         }

//         @keyframes workflowElectricPulse {
//           0%,
//           100% {
//             opacity: .48;
//             box-shadow: 0 0 0 rgba(103,232,249,0);
//           }

//           50% {
//             opacity: 1;
//             box-shadow:
//               0 0 10px rgba(103,232,249,.72),
//               0 0 22px rgba(103,232,249,.22);
//           }
//         }

//         @keyframes workflowElectricNode {
//           0%,
//           100% {
//             transform: scale(.82);
//             opacity: .35;
//           }

//           50% {
//             transform: scale(1);
//             opacity: 1;
//           }
//         }

//         @media (prefers-reduced-motion: reduce) {
//           .workflow-electric-flow,
//           .workflow-electric-pulse,
//           .workflow-electric-node {
//             animation: none !important;
//           }
//         }
//       `}</style>

//       {/* POWER BUS */}
//       <div
//         aria-hidden="true"
//         className="relative flex h-[420px] w-9 shrink-0 items-center justify-center"
//       >
//         <div className="absolute left-1/2 top-6 bottom-6 w-px -translate-x-1/2 bg-gradient-to-b from-transparent via-cyan-300/20 to-transparent" />

//         <div className="absolute left-1/2 top-8 bottom-8 w-px -translate-x-1/2 overflow-hidden">
//           {!reduceMotion && (
//             <div
//               className="workflow-electric-flow absolute left-0 top-0 h-20 w-[3px] rounded-full bg-gradient-to-b from-transparent via-cyan-200 to-transparent"
//               style={{
//                 animation:
//                   "workflowElectricFlow 3.2s cubic-bezier(.2,.65,.2,1) infinite",
//               }}
//             />
//           )}
//         </div>

//         <div className="relative z-10 flex h-9 w-9 items-center justify-center rounded-full border border-cyan-300/20 bg-[#071015]/80 shadow-[0_0_30px_rgba(103,232,249,.10)]">
//           <span className="h-2 w-2 rounded-full bg-cyan-300 shadow-[0_0_12px_4px_rgba(103,232,249,.50)]" />
//         </div>

//         <div className="absolute left-1/2 top-1/2 z-20 h-11 w-11 -translate-x-1/2 -translate-y-1/2 rounded-full border border-cyan-300/10" />
//       </div>

//       {/* WORKFLOW FRAME */}
//       <div
//         className="
//           group
//           relative
//           h-[420px]
//           w-[440px]
//           overflow-hidden
//           rounded-[28px]
//           border
//           border-white/[0.11]
//           bg-[#06090c]/90
//           shadow-[0_30px_90px_rgba(0,0,0,.30)]
//           dark:border-white/[0.10]
//         "
//       >
//         {/* INNER FRAME */}
//         <div
//           aria-hidden="true"
//           className="pointer-events-none absolute inset-2 rounded-[23px] border border-white/[0.045]"
//         />

//         {/* TECHNICAL RAILS */}
//         <div className="pointer-events-none absolute left-7 right-7 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300/75 to-transparent" />

//         <div className="pointer-events-none absolute left-20 right-20 top-[1px] h-px bg-gradient-to-r from-transparent via-cyan-200/15 to-transparent" />

//         <div className="pointer-events-none absolute bottom-0 left-7 right-7 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

//         {/* CORNERS */}
//         <div className="pointer-events-none absolute left-3 top-3 h-5 w-5 border-l border-t border-cyan-300/35" />
//         <div className="pointer-events-none absolute right-3 top-3 h-5 w-5 border-r border-t border-cyan-300/35" />
//         <div className="pointer-events-none absolute bottom-3 left-3 h-5 w-5 border-b border-l border-white/14" />
//         <div className="pointer-events-none absolute bottom-3 right-3 h-5 w-5 border-b border-r border-white/14" />

//         {/* AMBIENT */}
//         <div
//           aria-hidden="true"
//           className="pointer-events-none absolute left-1/2 top-1/2 h-[310px] w-[310px] -translate-x-1/2 -translate-y-1/2 rounded-full blur-[105px]"
//           style={{
//             background:
//               "radial-gradient(circle, rgba(103,232,249,.095) 0%, rgba(103,232,249,.025) 32%, transparent 72%)",
//           }}
//         />

//         {/* FINE GRID */}
//         <div
//           aria-hidden="true"
//           className="pointer-events-none absolute inset-0 opacity-[0.12]"
//           style={{
//             backgroundImage: `
//               linear-gradient(rgba(255,255,255,.14) 1px, transparent 1px),
//               linear-gradient(90deg, rgba(255,255,255,.14) 1px, transparent 1px)
//             `,
//             backgroundSize: "44px 44px",
//             maskImage:
//               "linear-gradient(to bottom, transparent, black 14%, black 86%, transparent)",
//             WebkitMaskImage:
//               "linear-gradient(to bottom, transparent, black 14%, black 86%, transparent)",
//           }}
//         />

//         {/* LARGE GRID */}
//         <div
//           aria-hidden="true"
//           className="pointer-events-none absolute inset-0 opacity-[0.045]"
//           style={{
//             backgroundImage: `
//               linear-gradient(rgba(103,232,249,.9) 1px, transparent 1px),
//               linear-gradient(90deg, rgba(103,232,249,.9) 1px, transparent 1px)
//             `,
//             backgroundSize: "132px 132px",
//           }}
//         />

//         {/* HEADER */}
//         <div className="absolute left-6 right-6 top-5 z-30 flex items-center justify-between">
//           <div className="flex items-center gap-2.5">
//             <span
//               className="relative h-1.5 w-1.5 rounded-full"
//               style={{
//                 background: BRAND_CYAN,
//                 boxShadow: "0 0 10px rgba(103,232,249,.75)",
//                 animation: reduceMotion
//                   ? undefined
//                   : "workflowElectricPulse 2.1s ease-in-out infinite",
//               }}
//             />

//             <span className="font-mono text-[8px] font-semibold uppercase tracking-[0.28em] text-white/45">
//               Workflow Engine
//             </span>
//           </div>

//           <div className="flex items-center gap-2">
//             <span className="font-mono text-[7px] uppercase tracking-[0.18em] text-white/18">
//               ROUTING
//             </span>

//             <span className="rounded-full border border-cyan-300/15 bg-cyan-300/[0.06] px-2 py-1 font-mono text-[7px] uppercase tracking-[0.16em] text-cyan-200/65">
//               LIVE
//             </span>
//           </div>
//         </div>

//         {/* CENTRAL CIRCUIT */}
//         <div
//           aria-hidden="true"
//           className="pointer-events-none absolute left-[22px] top-[104px] bottom-[58px] w-px bg-gradient-to-b from-transparent via-cyan-300/16 to-transparent"
//         />

//         {/* MAIN LIST */}
//         <div
//           className="absolute inset-x-0 top-0"
//           style={{
//             transform: `translateY(${164 - activeIndex * 58}px)`,
//             transition: reduceMotion
//               ? "none"
//               : "transform 900ms cubic-bezier(.22,1,.36,1)",
//           }}
//         >
//           {items.map((item, index) => {
//             const distance = Math.abs(index - activeIndex);
//             const active = distance === 0;

//             let opacity = 0.09;
//             let scale = 0.97;

//             if (distance === 0) {
//               opacity = 1;
//               scale = 1;
//             } else if (distance === 1) {
//               opacity = 0.42;
//               scale = 0.99;
//             } else if (distance === 2) {
//               opacity = 0.2;
//             } else if (distance === 3) {
//               opacity = 0.11;
//             }

//             return (
//               <div
//                 key={`${item}-${index}`}
//                 className="relative flex h-[58px] items-center pl-0 pr-6"
//               >
//                 {/* CIRCUIT PATH */}
//                 <div
//                   aria-hidden="true"
//                   className="absolute left-0 top-1/2 flex -translate-y-1/2 items-center"
//                 >
//                   <span
//                     className="block h-px w-[76px]"
//                     style={{
//                       background: active
//                         ? "linear-gradient(90deg, rgba(103,232,249,.06), rgba(103,232,249,.9), rgba(103,232,249,.25))"
//                         : "linear-gradient(90deg, transparent, rgba(255,255,255,.08))",
//                       boxShadow: active
//                         ? "0 0 9px rgba(103,232,249,.38)"
//                         : undefined,
//                     }}
//                   />

//                   <span
//                     className="relative block h-2 w-2 rounded-full"
//                     style={{
//                       background: active
//                         ? BRAND_CYAN
//                         : "rgba(255,255,255,.18)",
//                       boxShadow: active
//                         ? "0 0 10px rgba(103,232,249,.72)"
//                         : undefined,
//                       animation:
//                         !reduceMotion && active
//                           ? "workflowElectricNode 1.35s ease-in-out infinite"
//                           : undefined,
//                     }}
//                   />

//                   {active && !reduceMotion && (
//                     <span
//                       className="absolute left-[12px] h-[2px] w-10 rounded-full bg-gradient-to-r from-transparent via-cyan-100 to-transparent"
//                       style={{
//                         animation:
//                           "workflowElectricFlow 1.55s cubic-bezier(.16,1,.3,1) infinite",
//                       }}
//                     />
//                   )}
//                 </div>

//                 {/* ACTIVE ENERGY RAIL */}
//                 <div
//                   aria-hidden="true"
//                   className={`absolute left-[74px] right-5 top-2 bottom-2 rounded-[16px] border transition-all duration-500 ${
//                     active
//                       ? "border-cyan-300/18 bg-cyan-300/[0.035] shadow-[inset_0_0_28px_rgba(103,232,249,.035),0_0_26px_rgba(103,232,249,.035)]"
//                       : "border-transparent bg-transparent"
//                   }`}
//                 />

//                 {/* TEXT */}
//                 <span
//                   className="relative z-10 ml-[92px] whitespace-nowrap text-[20px] font-semibold tracking-[-0.035em] text-white xl:text-[22px]"
//                   style={{
//                     opacity,
//                     transform: `scale(${scale})`,
//                     transformOrigin: "left center",
//                     transition:
//                       "opacity 550ms ease, transform 700ms cubic-bezier(.22,1,.36,1)",
//                   }}
//                 >
//                   {item}
//                 </span>

//                 {active && (
//                   <ArrowUpRight className="absolute right-8 z-10 h-4 w-4 text-cyan-300 drop-shadow-[0_0_7px_rgba(103,232,249,.55)]" />
//                 )}
//               </div>
//             );
//           })}
//         </div>

//         {/* TOP FADE */}
//         <div className="pointer-events-none absolute inset-x-0 top-0 z-20 h-28 bg-gradient-to-b from-[#06090c] via-[#06090c]/75 to-transparent" />

//         {/* BOTTOM FADE */}
//         <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 h-36 bg-gradient-to-t from-[#06090c] via-[#06090c]/88 to-transparent" />

//         {/* BOTTOM META */}
//         <div className="absolute bottom-5 left-6 right-6 z-30 flex items-center justify-between">
//           <div className="flex items-center gap-2.5">
//             <span className="font-mono text-[7px] uppercase tracking-[0.22em] text-white/22">
//               Intelligent routing
//             </span>

//             <span className="h-px w-6 bg-cyan-300/25" />

//             <span className="font-mono text-[7px] uppercase tracking-[0.15em] text-cyan-200/28">
//               AI CORE
//             </span>
//           </div>

//           <div className="flex items-center gap-2">
//             <span className="font-mono text-[7px] text-white/22">
//               10
//             </span>

//             <span className="h-1 w-9 rounded-full bg-gradient-to-r from-transparent via-cyan-300/20 to-cyan-300/60" />
//           </div>
//         </div>
//       </div>
//     </div>
//   );
// }

// /* ============================================================
//    AUDIENCE
// ============================================================ */

// function HeroAudience() {
//   return (
//     <div className="mt-8">
//       <div className="mb-3 flex items-center gap-3">
//         <span className="h-px w-8 bg-cyan-300/50" />

//         <span className="font-mono text-[8px] uppercase tracking-[0.28em] text-white/30">
//           Built for
//         </span>
//       </div>

//       <div className="flex flex-wrap gap-2">
//         {AUDIENCE.map((item) => (
//           <span
//             key={item}
//             className="
//               rounded-full
//               border
//               border-white/[0.10]
//               bg-white/[0.045]
//               px-3
//               py-1.5
//               font-mono
//               text-[7px]
//               uppercase
//               tracking-[0.17em]
//               text-white/48
//             "
//           >
//             {item}
//           </span>
//         ))}
//       </div>
//     </div>
//   );
// }

// /* ============================================================
//    HERO
// ============================================================ */

// export default function HomePage() {
//   return (
//     <main className="min-h-screen bg-[#f3f7f8] dark:bg-[#040608]">
//       <section
//         id="hero"
//         data-circuit-section="hero"
//         data-cy="section-hero"
//         className="
//           relative
//           isolate
//           flex
//           min-h-screen
//           overflow-hidden
//           bg-[#f3f7f8]
//           text-slate-950
//           dark:bg-[#040608]
//           dark:text-white
//         "
//       >
//         {/* =====================================================
//             IMAGE LAYER
//         ===================================================== */}

//         <div
//           aria-hidden="true"
//           className="pointer-events-none absolute inset-0"
//         >
//           {/* DESKTOP DARK */}
//           <img
//             src="/hero.webp"
//             alt=""
//             fetchPriority="high"
//             decoding="async"
//             className="absolute inset-0 hidden h-full w-full object-cover object-center md:dark:block"
//           />

//           {/* DESKTOP LIGHT */}
//           <img
//             src="/hero_white.webp"
//             alt=""
//             fetchPriority="high"
//             decoding="async"
//             className="absolute inset-0 hidden h-full w-full object-cover object-center md:block md:dark:hidden"
//           />

//           {/* MOBILE DARK */}
//           <img
//             src="/mobile_hero.webp"
//             alt=""
//             fetchPriority="high"
//             decoding="async"
//             className="absolute inset-0 hidden h-full w-full object-cover object-center dark:block md:dark:hidden"
//           />

//           {/* MOBILE LIGHT */}
//           <img
//             src="/mobile_lightmod.webp"
//             alt=""
//             fetchPriority="high"
//             decoding="async"
//             className="absolute inset-0 block h-full w-full object-cover object-center dark:hidden md:hidden"
//           />

//           {/* =================================================
//               DARK IMAGE FINISH
//           ================================================= */}

//           <div
//             className="
//               absolute
//               inset-0
//               hidden
//               dark:block
//               bg-black/[0.06]
//             "
//           />

//           <div
//             className="
//               absolute
//               inset-0
//               hidden
//               dark:block
//               bg-[radial-gradient(circle_at_72%_48%,transparent_0%,rgba(0,0,0,.06)_42%,rgba(0,0,0,.58)_100%)]
//             "
//           />

//           {/* =================================================
//               LIGHT IMAGE FINISH
//           ================================================= */}

//           <div
//             className="
//               absolute
//               inset-0
//               bg-white/[0.015]
//               dark:hidden
//             "
//           />

//           <div
//             className="
//               absolute
//               inset-0
//               dark:hidden
//               bg-[radial-gradient(circle_at_72%_46%,transparent_0%,rgba(255,255,255,.02)_45%,rgba(244,248,249,.24)_100%)]
//             "
//           />

//           {/* =================================================
//               LEFT TEXT READABILITY
//           ================================================= */}

//           <div
//             className="
//               absolute
//               inset-y-0
//               left-0
//               w-[72%]
//               bg-gradient-to-r
//               from-[#f3f7f8]/96
//               via-[#f3f7f8]/78
//               to-transparent
//               dark:from-[#040608]/96
//               dark:via-[#040608]/68
//               dark:to-transparent
//             "
//           />

//           {/* =================================================
//               CYAN ATMOSPHERE
//           ================================================= */}

//           <div
//             className="
//               absolute
//               left-[-170px]
//               top-[18%]
//               h-[560px]
//               w-[560px]
//               rounded-full
//               blur-[120px]
//             "
//             style={{
//               background:
//                 "radial-gradient(circle, hsla(189.16,79.17%,47.06%,0.075) 0%, transparent 72%)",
//             }}
//           />

//           <div
//             className="
//               absolute
//               right-[15%]
//               top-[24%]
//               h-[480px]
//               w-[480px]
//               rounded-full
//               blur-[110px]
//             "
//             style={{
//               background:
//                 "radial-gradient(circle, hsla(189.16,79.17%,47.06%,0.09) 0%, transparent 72%)",
//             }}
//           />

//           {/* =================================================
//               ARCHITECTURAL GRID
//           ================================================= */}

//           <div
//             className="
//               absolute
//               inset-0
//               opacity-[0.17]
//               dark:opacity-[0.11]
//             "
//             style={{
//               backgroundImage: `
//                 linear-gradient(
//                   rgba(103,232,249,.20) 1px,
//                   transparent 1px
//                 ),
//                 linear-gradient(
//                   90deg,
//                   rgba(103,232,249,.20) 1px,
//                   transparent 1px
//                 )
//               `,
//               backgroundSize: "72px 72px",
//               maskImage:
//                 "linear-gradient(to right, black 0%, black 76%, transparent 100%)",
//               WebkitMaskImage:
//                 "linear-gradient(to right, black 0%, black 76%, transparent 100%)",
//             }}
//           />

//           <div
//             className="
//               absolute
//               inset-0
//               opacity-[0.045]
//               dark:opacity-[0.035]
//             "
//             style={{
//               backgroundImage: `
//                 linear-gradient(
//                   rgba(15,23,42,.25) 1px,
//                   transparent 1px
//                 ),
//                 linear-gradient(
//                   90deg,
//                   rgba(15,23,42,.25) 1px,
//                   transparent 1px
//                 )
//               `,
//               backgroundSize: "18px 18px",
//               maskImage:
//                 "linear-gradient(to right, black 0%, transparent 70%)",
//               WebkitMaskImage:
//                 "linear-gradient(to right, black 0%, transparent 70%)",
//             }}
//           />

//           {/* edge vignettes */}
//           <div className="absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-black/[0.04] to-transparent dark:from-black/20" />

//           <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-[#f3f7f8]/55 to-transparent dark:from-[#040608]/50" />
//         </div>

//         {/* =====================================================
//             TOP SYSTEM BAR
//         ===================================================== */}

//         <div
//           className="
//             absolute
//             left-0
//             right-0
//             top-0
//             z-40
//             border-b
//             border-black/[0.06]
//             bg-white/[0.18]
//             dark:border-white/[0.055]
//             dark:bg-black/[0.08]
//           "
//         >
//           <div className="mx-auto flex max-w-screen-2xl items-center justify-between px-5 py-3 sm:px-8 lg:px-14 2xl:px-24">
//             <div className="flex items-center gap-3">
//               <span
//                 className="h-1.5 w-1.5 rounded-full"
//                 style={{
//                   background: BRAND_CYAN,
//                   boxShadow:
//                     "0 0 11px rgba(103,232,249,.75)",
//                 }}
//               />

//               <span className="font-mono text-[8px] font-medium uppercase tracking-[0.27em] text-slate-500 dark:text-white/34">
//                 RENDERUIM / AI ARCHITECTURE SYSTEM
//               </span>
//             </div>

//             <span className="hidden font-mono text-[8px] uppercase tracking-[0.24em] text-slate-400 dark:text-white/20 sm:block">
//               SYSTEM ONLINE
//             </span>
//           </div>
//         </div>

//         {/* =====================================================
//             MAIN CONTENT
//         ===================================================== */}

//         <div className="relative z-20 mx-auto flex w-full max-w-screen-2xl flex-1 px-5 pb-7 pt-24 sm:px-8 sm:pb-9 lg:px-14 lg:pt-28 2xl:px-24">
//           <div className="flex w-full flex-col justify-center gap-12 lg:flex-row lg:items-center lg:justify-between lg:gap-16">
//             {/* =================================================
//                 LEFT
//             ================================================= */}

//             <div className="max-w-[680px]">
//               {/* eyebrow */}
//               <motion.div
//                 className="
//                   inline-flex
//                   items-center
//                   gap-2.5
//                   rounded-full
//                   border
//                   border-black/[0.07]
//                   bg-white/65
//                   px-3.5
//                   py-2
//                   dark:border-white/[0.09]
//                   dark:bg-black/[0.20]
//                 "
//               >
//                 <Sparkles
//                   className="h-3.5 w-3.5"
//                   style={{
//                     color: BRAND_CYAN,
//                   }}
//                 />

//                 <span className="font-mono text-[8px] font-semibold uppercase tracking-[0.25em] text-slate-600 dark:text-white/52">
//                   Architectural AI Workspace
//                 </span>

//                 <ArrowUpRight className="h-3 w-3 text-slate-400 dark:text-white/22" />
//               </motion.div>

//               {/* heading */}
//               <motion.h1
//                 className="
//                   mt-7
//                   max-w-[720px]
//                   text-[clamp(3rem,6vw,5.9rem)]
//                   font-semibold
//                   leading-[0.91]
//                   tracking-[-0.067em]
//                   text-slate-950
//                   dark:text-white
//                 "
//               >
//                 <span className="block">
//                   Direct your
//                 </span>

//                 <span className="block">
//                   architecture
//                 </span>

//                 <span
//                   className="block"
//                   style={{
//                     color: BRAND_CYAN,
//                   }}
//                 >
//                   with AI.
//                 </span>
//               </motion.h1>

//               {/* paragraph */}
//               <motion.p
//                 className="
//                   mt-7
//                   max-w-[580px]
//                   text-sm
//                   leading-7
//                   text-slate-600
//                   dark:text-white/50
//                   sm:text-base
//                 "
//               >
//                 Generate, transform and visualize
//                 architectural ideas through one connected
//                 AI workspace — from your first sketch to
//                 polished images, 3D scenes and cinematic
//                 content.
//               </motion.p>

//               {/* =================================================
//                   CTAs
//               ================================================= */}

//               <motion.div
//                 className="mt-8 flex flex-col gap-3 sm:flex-row"
//               >
//                 <a
//                   href="#tools"
//                   className="
//                     group
//                     inline-flex
//                     items-center
//                     justify-center
//                     gap-2.5
//                     rounded-[14px]
//                     bg-slate-950
//                     px-6
//                     py-3.5
//                     text-sm
//                     font-semibold
//                     text-white
//                     shadow-[0_18px_45px_rgba(15,23,42,.14)]
//                     transition-all
//                     duration-300
//                     hover:-translate-y-0.5
//                     dark:bg-white
//                     dark:text-black
//                     dark:shadow-[0_18px_45px_rgba(0,0,0,.30)]
//                   "
//                 >
//                   <span>Start creating</span>

//                   <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
//                 </a>

//                 <a
//                   href="#how-it-works"
//                   className="
//                     group
//                     inline-flex
//                     items-center
//                     justify-center
//                     gap-2.5
//                     rounded-[14px]
//                     border
//                     border-black/[0.08]
//                     bg-white/60
//                     px-6
//                     py-3.5
//                     text-sm
//                     font-semibold
//                     text-slate-900
//                     transition-all
//                     duration-300
//                     hover:-translate-y-0.5
//                     hover:border-black/[0.14]
//                     hover:bg-white/80
//                     dark:border-white/[0.10]
//                     dark:bg-black/[0.16]
//                     dark:text-white
//                     dark:hover:border-white/[0.16]
//                     dark:hover:bg-black/[0.28]
//                   "
//                 >
//                   <ScanLine
//                     className="h-4 w-4"
//                     style={{
//                       color: BRAND_CYAN,
//                     }}
//                   />

//                   <span>See how it works</span>
//                 </a>
//               </motion.div>

//               {/* =================================================
//                   AUDIENCE
//               ================================================= */}

//               <motion.div
//                 className="hidden sm:block"
//               >
//                 <HeroAudience />
//               </motion.div>
//             </div>

//             {/* =================================================
//                 RIGHT WORKFLOW
//             ================================================= */}

//             <motion.div
//               className="shrink-0"
//             >
//               <WorkflowList />
//             </motion.div>
//           </div>
//         </div>

//         {/* =====================================================
//             BOTTOM SYSTEM LINE
//         ===================================================== */}

//         <div className="relative z-30 mx-auto w-full max-w-screen-2xl px-5 pb-5 sm:px-8 lg:px-14 2xl:px-24">
//           <div className="flex items-center justify-between border-t border-black/[0.07] pt-4 dark:border-white/[0.06]">
//             <div className="flex min-w-0 items-center gap-3">
//               <span
//                 className="h-px w-8 shrink-0"
//                 style={{
//                   background: BRAND_CYAN,
//                 }}
//               />

//               <span className="truncate font-mono text-[7px] uppercase tracking-[0.24em] text-slate-500 dark:text-white/28">
//                 IMAGE / VIDEO / 3D / ENHANCE
//               </span>
//             </div>

//             <div className="flex shrink-0 items-center gap-3">
//               <span className="hidden font-mono text-[7px] uppercase tracking-[0.20em] text-slate-400 dark:text-white/18 sm:block">
//                 ONE WORKSPACE / MULTIPLE ENGINES
//               </span>

//               <span
//                 className="h-1.5 w-1.5 rounded-full"
//                 style={{
//                   background: BRAND_CYAN,
//                   boxShadow:
//                     "0 0 9px rgba(103,232,249,.65)",
//                 }}
//               />
//             </div>
//           </div>
//         </div>

//         {/* =====================================================
//             MOBILE AUDIENCE
//         ===================================================== */}

//         <div className="absolute bottom-20 left-5 right-5 z-30 sm:hidden">
//           <div className="flex flex-wrap gap-1.5">
//             {AUDIENCE.map((item) => (
//               <span
//                 key={item}
//                 className="
//                   rounded-full
//                   border
//                   border-black/[0.07]
//                   bg-white/60
//                   px-2.5
//                   py-1.5
//                   font-mono
//                   text-[6.5px]
//                   uppercase
//                   tracking-[0.15em]
//                   text-slate-500
//                   dark:border-white/[0.08]
//                   dark:bg-black/[0.20]
//                   dark:text-white/34
//                 "
//               >
//                 {item}
//               </span>
//             ))}
//           </div>
//         </div>

//         {/* =====================================================
//             MOBILE SCROLL INDICATOR
//         ===================================================== */}

//         <div className="absolute bottom-5 left-1/2 z-30 -translate-x-1/2 sm:hidden">
//           <a
//             href="#ai-showcase"
//             aria-label="Scroll to AI Showcase"
//             className="flex flex-col items-center gap-2"
//           >
//             <span className="font-mono text-[7px] uppercase tracking-[0.25em] text-slate-400 dark:text-white/25">
//               Explore
//             </span>

//             <span
//               className="h-8 w-px"
//               style={{
//                 background:
//                   "linear-gradient(to bottom, rgba(103,232,249,.7), transparent)",
//               }}
//             />
//           </a>
//         </div>
//       </section>
//     </main>
//   );
// }

// ///////////////////////////////////////////////////////////////////////
// CURRENT ACTIVE VERSION
// ///////////////////////////////////////////////////////////////////////

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

const COMPANIES = [
  {
    name: "coca-cola",
    src: "https://media.magnific.com/home/relaunch/media/hero/companies/coca-cola.svg",
    width: 100,
    height: 28,
  },
  {
    name: "ogilvy",
    src: "https://media.magnific.com/home/relaunch/media/hero/companies/ogilvy.svg",
    width: 80,
    height: 28,
  },
  {
    name: "rga",
    src: "https://media.magnific.com/home/relaunch/media/hero/companies/rga.svg",
    width: 60,
    height: 20,
  },
  {
    name: "wonder",
    src: "https://media.magnific.com/home/relaunch/media/hero/companies/wonder.svg",
    width: 110,
    height: 20,
  },
  {
    name: "guess",
    src: "https://media.magnific.com/home/relaunch/media/hero/companies/guess.svg",
    width: 100,
    height: 20,
  },
  {
    name: "deliveryhero",
    src: "https://media.magnific.com/home/relaunch/media/hero/companies/deliveryhero.svg",
    width: 110,
    height: 24,
  },
];

function WorkflowList() {
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

function CompanyLogos() {
  return (
    <div className="mt-8 lg:mt-12">
      <div className="flex flex-col items-center gap-6">
        <p className="text-center text-sm text-slate-600 dark:text-white/55">
          Trusted by 1M+ subscribers—creatives, enterprises,
          agencies and studios
        </p>

        {/* Desktop */}
        <div className="hidden items-center justify-center gap-8 lg:flex xl:gap-12">
          {COMPANIES.map((company) => (
            <img
              key={company.name}
              src={company.src}
              alt={company.name}
              width={company.width}
              height={company.height}
              loading="lazy"
              decoding="async"
              className="
                object-contain
                opacity-45
                grayscale
                brightness-0
                transition-all
                duration-200
                hover:opacity-100
                dark:grayscale-0
                dark:brightness-0
                dark:invert
              "
            />
          ))}
        </div>

        {/* Mobile */}
        <div className="w-full overflow-hidden lg:hidden">
          <div className="flex w-max animate-scroll-horizontal items-center gap-8">
            {[...COMPANIES, ...COMPANIES].map(
              (company, index) => (
                <img
                  key={`${company.name}-${index}`}
                  src={company.src}
                  alt={company.name}
                  width={company.width}
                  height={company.height}
                  loading="lazy"
                  decoding="async"
                  className="
                    shrink-0
                    object-contain
                    opacity-45
                    grayscale
                    brightness-0
                    dark:grayscale-0
                    dark:brightness-0
                    dark:invert
                  "
                />
              )
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function HomePage() {
  const [videoOpen, setVideoOpen] = useState(false);

  return (
    <main className="min-h-screen bg-[#f3f7f8] dark:bg-[#040608]">
      <section
        id="hero"
        data-circuit-section="hero"
        data-cy="section-hero"
        className="
          relative
          flex
          min-h-screen
          flex-col
          overflow-hidden
          bg-[#f3f7f8]
          text-slate-950
          dark:bg-[#040608]
          dark:text-white
        "
      >
        {/* One responsive background URL is selected by theme and viewport CSS. */}
        <div
          aria-hidden="true"
          className="hero-responsive-image pointer-events-none absolute inset-0 bg-cover bg-center"
        />

        {/* Dark finish */}
        <div className="pointer-events-none absolute inset-0 hidden bg-black/[0.08] dark:block" />

        <div
          className="
            pointer-events-none
            absolute
            inset-0
            hidden
            dark:block
            bg-[radial-gradient(circle_at_72%_48%,transparent_0%,rgba(0,0,0,.08)_45%,rgba(0,0,0,.58)_100%)]
          "
        />

        {/* Light finish */}
        <div className="pointer-events-none absolute inset-0 bg-white/[0.025] dark:hidden" />

        <div
          className="
            pointer-events-none
            absolute
            inset-0
            dark:hidden
            bg-[radial-gradient(circle_at_72%_46%,transparent_0%,rgba(255,255,255,.02)_45%,rgba(243,247,248,.28)_100%)]
          "
        />

        {/* Left readability */}
        <div
          className="
            pointer-events-none
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

        {/* Cyan atmosphere */}
        <div
          className="
            pointer-events-none
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
            pointer-events-none
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

        {/* Architectural grid */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.17] dark:opacity-[0.11]"
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
          className="pointer-events-none absolute inset-0 opacity-[0.045] dark:opacity-[0.035]"
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

        <div className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-black/[0.04] to-transparent dark:from-black/20" />

        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-[#f3f7f8]/55 to-transparent dark:from-[#040608]/50" />

        {/* Top system bar */}
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
                CREATIVE / AI PRODUCTION SYSTEM
              </span>
            </div>

            <span className="hidden font-mono text-[8px] uppercase tracking-[0.24em] text-slate-400 dark:text-white/20 sm:block">
              SYSTEM ONLINE
            </span>
          </div>
        </div>

        {/* Content */}
        <div className="relative mx-auto flex w-full max-w-screen-2xl flex-1 flex-col justify-end px-5 pb-8 pt-24 sm:px-10 lg:px-20 2xl:px-40">
          <div className="flex flex-1 flex-col justify-center gap-8 py-10 lg:flex-row lg:items-center lg:gap-12 lg:py-20">

            {/* Text */}
            <div className="flex max-w-2xl flex-col gap-6">

              {/* Badge */}
              <a
                href="https://a16z.com/100-gen-ai-apps-6/"
                target="_blank"
                rel="noopener noreferrer"
                className="
                  group
                  inline-flex
                  w-fit
                  items-center
                  gap-3
                  whitespace-nowrap
                  rounded-[12px]
                  border
                  border-black/[0.07]
                  bg-white/60
                  px-4
                  py-2
                  text-xs
                  backdrop-blur-sm
                  transition
                  hover:bg-white/80
                  dark:border-white/[0.10]
                  dark:bg-black/20
                  dark:hover:bg-black/30
                "
              >
                <span
                  className="transition-transform duration-200 group-hover:translate-x-1"
                  style={{ color: BRAND_CYAN }}
                >
                  →
                </span>
              </a>

              {/* Heading */}
              <h1
                className="
                  text-4xl
                  font-bold
                  leading-[1.05]
                  tracking-tight
                  text-slate-950
                  dark:text-white
                  sm:text-5xl
                  lg:text-[55px]
                "
              >
                <span className="block">
                  The creative platform
                </span>

                <span className="block">
                  to direct your best
                </span>

                <span
                  className="block"
                  style={{ color: BRAND_CYAN }}
                >
                  work with AI.
                </span>
              </h1>

              {/* Paragraph */}
              <p className="max-w-xl text-sm leading-[1.55] text-slate-600 dark:text-white/68 sm:text-lg">
                Every AI model for video, image, and audio.
                Intelligent workflows for professional control
                and collaboration. On-brand production at any
                scale.
              </p>

              {/* CTAs */}
              <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
                <a
                  href="https://www.magnific.com/sign-up?client_id=magnific&lang=en"
                  className="
                    rounded-[12px]
                    bg-slate-950
                    px-6
                    py-3
                    text-base
                    font-medium
                    text-white
                    shadow-[0_14px_35px_rgba(15,23,42,.18)]
                    transition
                    hover:-translate-y-0.5
                    hover:bg-slate-800
                    dark:bg-white
                    dark:text-slate-950
                    dark:hover:bg-white/90
                  "
                >
                  Start creating
                </a>

                <button
                  type="button"
                  onClick={() => setVideoOpen(true)}
                  className="
                    inline-flex
                    items-center
                    gap-2
                    rounded-[12px]
                    border
                    border-black/[0.10]
                    bg-white/45
                    px-6
                    py-3
                    text-base
                    font-medium
                    text-slate-900
                    backdrop-blur-sm
                    transition
                    hover:-translate-y-0.5
                    hover:bg-white/70
                    dark:border-white/[0.12]
                    dark:bg-black/10
                    dark:text-white
                    dark:hover:bg-white/10
                  "
                >
                  <span
                    style={{ color: BRAND_CYAN }}
                  >
                    ▶
                  </span>

                  Why Magnific?
                </button>
              </div>
            </div>

            {/* Workflow */}
            <WorkflowList />
          </div>

          <CompanyLogos />
        </div>

        {/* Bottom system line */}
        <div className="relative z-30 mx-auto w-full max-w-screen-2xl px-5 pb-5 sm:px-10 lg:px-20 2xl:px-40">
          <div className="flex items-center justify-between border-t border-black/[0.07] pt-4 dark:border-white/[0.06]">
            <div className="flex min-w-0 items-center gap-3">
              <span
                className="h-px w-8 shrink-0"
                style={{
                  background: BRAND_CYAN,
                }}
              />

              <span className="truncate font-mono text-[7px] uppercase tracking-[0.24em] text-slate-500 dark:text-white/28">
                IMAGE / VIDEO / AUDIO / UPSCALE
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
      </section>

      {/* Video modal */}
      {videoOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-5 backdrop-blur-sm"
          onClick={() => setVideoOpen(false)}
        >
          <div
            className="
              relative
              w-full
              max-w-4xl
              overflow-hidden
              rounded-2xl
              border
              border-white/10
              bg-black
              shadow-[0_30px_100px_rgba(0,0,0,.55)]
            "
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setVideoOpen(false)}
              className="
                absolute
                right-4
                top-4
                z-10
                rounded-full
                border
                border-white/10
                bg-black/40
                px-4
                py-2
                text-white
                backdrop-blur
                transition
                hover:bg-black/65
              "
            >
              ✕
            </button>

            <div className="aspect-video">
              <video
                className="h-full w-full object-cover"
                controls
                autoPlay
              >
                <source
                  src="/videos/magnific.mp4"
                  type="video/mp4"
                />
              </video>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}