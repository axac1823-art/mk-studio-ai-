"use client";
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  Box,
  Eraser,
  ImageIcon,
  Sparkles,
  Video,
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

type PreviewMedia = {
  type: "image" | "video";
  src: string;
};

type ModelProvider = {
  name: string;
  query: string;
  monogram: string;
  preview?: PreviewMedia;
};

type CategoryId = "image" | "video" | "3d" | "enhance";

type BlueprintNode = ModelProvider & {
  category: CategoryId;
  x: number;
  y: number;
  side: "left" | "right";
};

type Category = {
  id: CategoryId;
  label: string;
  description: string;
  icon: typeof ImageIcon;
};

const ACCENT = "hsl(189.16deg 79.17% 47.06%)";
const ACCENT_SOFT = "hsl(189.16deg 79.17% 47.06% / 0.16)";
const ACCENT_GLOW = "hsl(189.16deg 79.17% 47.06% / 0.22)";
const providers: ModelProvider[] = [
  { name: "Black Forest Labs", query: "Black Forest Labs", monogram: "BFL" },
  { name: "Google", query: "Google", monogram: "G" },
  { name: "OpenAI", query: "OpenAI", monogram: "AI" },
  { name: "Kling", query: "Kling", monogram: "K" },
  { name: "Runway", query: "Runway", monogram: "R" },
  { name: "Magic Hour", query: "Magic Hour", monogram: "MH" },
  { name: "Meshy", query: "Meshy", monogram: "M" },
  { name: "Tripo", query: "Tripo", monogram: "T" },
  { name: "Hunyuan3D", query: "Hunyuan3D", monogram: "H3D" },
  { name: "Trellis", query: "Trellis", monogram: "TR" },
  { name: "ElevenLabs", query: "ElevenLabs", monogram: "11" },
  { name: "Remove.bg", query: "Remove.bg", monogram: "BG" },
];

const categories: Category[] = [
  {
    id: "image",
    label: "IMAGE",
    description: "Generation & ideation",
    icon: ImageIcon,
  },
  {
    id: "video",
    label: "VIDEO",
    description: "Motion & storytelling",
    icon: Video,
  },
  {
    id: "3d",
    label: "3D",
    description: "Models & spatial workflows",
    icon: Box,
  },
  {
    id: "enhance",
    label: "ENHANCE",
    description: "Cleanup, voice & finishing",
    icon: Eraser,
  },
];

const categoryStyles: Record<
  CategoryId,
  { dot: string; line: string; soft: string; glow: string; label: string }
> = {
  image: {
    dot: "#67e8f9",
    line: "rgba(103,232,249,.38)",
    soft: "rgba(103,232,249,.075)",
    glow: "rgba(103,232,249,.20)",
    label: "IMAGE SIGNAL",
  },
  video: {
    dot: "#60a5fa",
    line: "rgba(96,165,250,.36)",
    soft: "rgba(96,165,250,.07)",
    glow: "rgba(96,165,250,.18)",
    label: "VIDEO SIGNAL",
  },
  "3d": {
    dot: "#a78bfa",
    line: "rgba(167,139,250,.34)",
    soft: "rgba(167,139,250,.07)",
    glow: "rgba(167,139,250,.17)",
    label: "3D SIGNAL",
  },
  enhance: {
    dot: "#2dd4bf",
    line: "rgba(45,212,191,.34)",
    soft: "rgba(45,212,191,.07)",
    glow: "rgba(45,212,191,.17)",
    label: "ENHANCE SIGNAL",
  },
};

const categoryPositions: Record<
  CategoryId,
  { side: "left" | "right"; anchorX: number; startY: number; gap: number }
> = {
  image: { side: "left", anchorX: 145, startY: 188, gap: 84 },
  video: { side: "right", anchorX: 1055, startY: 188, gap: 84 },
  "3d": { side: "left", anchorX: 145, startY: 420, gap: 68 },
  enhance: { side: "right", anchorX: 1055, startY: 420, gap: 84 },
};

const assignments: Record<CategoryId, string[]> = {
  image: ["Black Forest Labs", "Google", "OpenAI"],
  video: ["Kling", "Runway", "Magic Hour"],
  "3d": ["Meshy", "Tripo", "Hunyuan3D", "Trellis"],
  enhance: ["ElevenLabs", "Remove.bg"],
};

const ROUTE_PATHS = [
  "M 310 188 C 420 188 468 254 540 320",
  "M 310 272 C 408 272 470 282 540 326",
  "M 310 356 C 405 356 468 348 540 332",
  "M 890 188 C 780 188 732 254 660 320",
  "M 890 272 C 792 272 730 282 660 326",
  "M 890 356 C 795 356 732 348 660 332",
  "M 310 420 C 416 420 462 388 540 348",
  "M 310 488 C 420 488 470 414 540 350",
  "M 310 556 C 424 556 480 440 542 354",
  "M 310 624 C 430 624 496 458 546 356",
  "M 890 420 C 784 420 738 388 660 348",
  "M 890 504 C 788 504 734 414 660 352",
];

const blueprintNodes: BlueprintNode[] = categories.flatMap((category) => {
  const position = categoryPositions[category.id];
  return assignments[category.id]
    .map((name) => providers.find((provider) => provider.name === name))
    .filter(Boolean)
    .map((provider, index) => ({
      ...(provider as ModelProvider),
      category: category.id,
      side: position.side,
      x: position.anchorX,
      y: position.startY + index * position.gap,
    }));
});

const sectionVars = {
  "--renderuim-accent": ACCENT,
} as CSSProperties;

export default function ModelDiscovery() {
  const [activeNode, setActiveNode] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<CategoryId | null>(null);
const [isDesktop, setIsDesktop] = useState(false);

useEffect(() => {
  const media = window.matchMedia("(min-width: 1024px)");

  const update = () => setIsDesktop(media.matches);

  update();
  media.addEventListener("change", update);

  return () => media.removeEventListener("change", update);
}, []);
  const nodeMap = useMemo(
    () => new Map(blueprintNodes.map((node) => [node.name, node])),
    [],
  );

  const visibleRoutes = useMemo(() => {
    const hasInteraction = Boolean(activeNode || activeCategory);
    const activeProvider = activeNode ? nodeMap.get(activeNode) : null;

    return ROUTE_PATHS.map((path, index) => {
      const routeCategory: CategoryId =
        index < 3
          ? "image"
          : index < 6
            ? "video"
            : index < 10
              ? "3d"
              : "enhance";

      const active =
        activeNode === "__core__" ||
        (activeProvider ? routeCategory === activeProvider.category : false) ||
        (activeCategory ? routeCategory === activeCategory : false);

      return {
        path,
        index,
        active,
        opacity: hasInteraction ? (active ? 1 : 0.12) : 0.62,
      };
    });
  }, [activeCategory, activeNode, nodeMap]);

  return (
    <section
      id="models"
      data-circuit-section="models"
      aria-labelledby="model-discovery-title"
      style={sectionVars}
      className="relative overflow-hidden border-y border-black/[0.06] bg-white py-20 text-slate-950 dark:border-white/[0.06] dark:bg-[#050608] dark:text-white sm:py-24 lg:py-32"
    >
      <BlueprintAtmosphere />

      <div className="relative mx-auto max-w-[1540px] px-5 sm:px-8">
        <ModelHeader />

        <div className="mt-14 sm:mt-16 lg:mt-20">
          <div className="relative mx-auto max-w-[1260px]">
{isDesktop ? (
  <div className="relative h-[720px]">
    <BlueprintCircuit
      visibleRoutes={visibleRoutes}
      onCoreEnter={() => setActiveNode("__core__")}
    />

{categories.map((category) => {
  const Icon = category.icon;
  const active = activeCategory === category.id;
  const dimmed = Boolean(activeCategory) && !active;

  return (
    <button
      key={category.id}
      type="button"
      onMouseEnter={() => {
        setActiveCategory(category.id);
        setActiveNode(null);
      }}
      onMouseLeave={() => {
        setActiveCategory(null);
        setActiveNode(null);
      }}
      className={[
        "absolute z-20 flex w-[180px] -translate-y-1/2 flex-col items-center text-center",
        "transition-all duration-300",
        dimmed ? "opacity-25" : "opacity-100",
        category.id === "image" ? "left-[30px] top-[115px]" : "",
        category.id === "video" ? "right-[30px] top-[115px]" : "",
        category.id === "3d" ? "left-[30px] top-[350px]" : "",
        category.id === "enhance" ? "right-[30px] top-[350px]" : "",
      ].join(" ")}
    >
      <span
        className={[
          "mb-3 flex h-9 w-9 items-center justify-center rounded-full border",
          "border-slate-300/70 bg-white/75 backdrop-blur-xl",
          "dark:border-white/10 dark:bg-[#0b0d10]/80",
          "transition-shadow duration-300",
        ].join(" ")}
        style={{
          boxShadow: active ? `0 0 28px ${ACCENT_GLOW}` : undefined,
        }}
      >
        <Icon
          className="h-3.5 w-3.5"
          style={{ color: ACCENT }}
        />
      </span>

      <span className="font-mono text-[9px] font-semibold tracking-[0.28em] text-slate-950 dark:text-white">
        {category.label}
      </span>

      <span className="mt-1 text-[10px] text-slate-500 dark:text-white/40">
        {category.description}
      </span>
    </button>
  );
})}

    <div className="absolute inset-x-[214px] top-[145px] bottom-[64px] z-20">
      {blueprintNodes.map((node) => (
        <BlueprintNodeCard
          key={node.name}
          node={node}
          active={activeNode === node.name}
          dimmed={Boolean(activeNode && activeNode !== node.name)}
          onEnter={() => {
            setActiveNode(node.name);
            setActiveCategory(node.category);
          }}
          onLeave={() => {
            setActiveNode(null);
            setActiveCategory(null);
          }}
        />
      ))}
    </div>

    <CoreModule
      active={activeNode === "__core__"}
      onMouseEnter={() => {
        setActiveNode("__core__");
        setActiveCategory(null);
      }}
      onMouseLeave={() => {
        setActiveNode(null);
        setActiveCategory(null);
      }}
    />
  </div>
) : (
  <MobileBlueprintTree
    activeNode={activeNode}
    setActiveNode={setActiveNode}
    activeCategory={activeCategory}
    setActiveCategory={setActiveCategory}
  />
)}



          </div>
        </div>

        <NetworkStatus count={blueprintNodes.length} />

        <div className="mt-12 text-center lg:mt-16">
          <p className="text-[10px] font-mono uppercase tracking-[0.24em] text-slate-500 dark:text-white/30 sm:text-xs">
            One workspace · multiple AI engines
          </p>

          <div className="mt-5 flex justify-center">
            <Link
              href="/models"
              className="group inline-flex items-center gap-3 rounded-2xl border border-black/[0.08] bg-white/75 px-6 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-slate-900 shadow-[0_12px_40px_rgba(15,23,42,0.05)] backdrop-blur-xl transition-all duration-300 hover:-translate-y-0.5 hover:border-[hsl(189.16deg_79.17%_47.06%_/_0.35)] hover:bg-white dark:border-white/[0.09] dark:bg-[#0b0d10]/70 dark:text-white dark:shadow-none dark:hover:border-[hsl(189.16deg_79.17%_47.06%_/_0.35)] dark:hover:bg-[#0e1115]"
            >
              <span>Explore all models</span>
              <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

function BlueprintAtmosphere() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      <div
        className="absolute left-1/2 top-[-180px] h-[760px] w-[1100px] -translate-x-1/2 rounded-full blur-[95px]"
        style={{
          background:
            "radial-gradient(circle, hsla(189.16,79.17%,47.06%,0.22) 0%, hsla(189.16,79.17%,47.06%,0.13) 28%, hsla(189.16,79.17%,47.06%,0.06) 48%, transparent 72%)",
        }}
      />

      <motion.div
        animate={{ x: ["-8%", "8%", "-8%"], y: ["0%", "3%", "0%"], opacity: [0.65, 1, 0.65] }}
        transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
        className="absolute left-1/2 top-[18%] h-[650px] w-[900px] -translate-x-1/2 rounded-full blur-[110px]"
        style={{
          background:
            "radial-gradient(circle, hsla(189.16,79.17%,47.06%,0.12) 0%, hsla(189.16,79.17%,47.06%,0.06) 38%, transparent 72%)",
        }}
      />

      <div
        className="absolute -left-[180px] top-[32%] h-[520px] w-[520px] rounded-full blur-[120px]"
        style={{ background: "radial-gradient(circle, hsla(189.16,79.17%,47.06%,0.095) 0%, transparent 70%)" }}
      />
      <div
        className="absolute -right-[180px] top-[38%] h-[520px] w-[520px] rounded-full blur-[120px]"
        style={{ background: "radial-gradient(circle, hsla(189.16,79.17%,47.06%,0.085) 0%, transparent 70%)" }}
      />

      <div
        className="absolute inset-0 dark:hidden"
        style={{
          opacity: 0.48,
          backgroundImage:
            "linear-gradient(hsla(189.16,79.17%,47.06%,0.22) 1px, transparent 1px), linear-gradient(90deg, hsla(189.16,79.17%,47.06%,0.22) 1px, transparent 1px)",
          backgroundSize: "64px 64px",
        }}
      />
      <div
        className="absolute inset-0 dark:hidden"
        style={{
          opacity: 0.16,
          backgroundImage:
            "linear-gradient(hsla(189.16,79.17%,47.06%,0.18) 1px, transparent 1px), linear-gradient(90deg, hsla(189.16,79.17%,47.06%,0.18) 1px, transparent 1px)",
          backgroundSize: "128px 128px",
        }}
      />
      <div
        className="absolute inset-0 hidden dark:block"
        style={{
          opacity: 0.3,
          backgroundImage:
            "linear-gradient(hsla(189.16,79.17%,47.06%,0.24) 1px, transparent 1px), linear-gradient(90deg, hsla(189.16,79.17%,47.06%,0.24) 1px, transparent 1px)",
          backgroundSize: "64px 64px",
        }}
      />

      <div
        className="absolute left-1/2 top-[44%] h-[440px] w-[820px] -translate-x-1/4 rounded-full blur-[130px]"
        style={{
          background:
            "radial-gradient(circle, hsla(189.16,79.17%,47.06%,0.085) 0%, hsla(189.16,79.17%,47.06%,0.035) 42%, transparent 72%)",
        }}
      />
    </div>
  );
}

function ModelHeader() {
  return (
    <div className="mx-auto max-w-3xl text-center">
      <div className="inline-flex items-center gap-2 rounded-full border border-[hsl(189.16deg_79.17%_47.06%_/_0.18)] bg-[hsl(189.16deg_79.17%_47.06%_/_0.045)] px-3 py-1.5 backdrop-blur-xl">
        <span className="relative flex h-1.5 w-1.5">
          <span className="absolute inset-0 animate-ping rounded-full bg-[hsl(189.16deg_79.17%_47.06%_/_0.5)]" />
          <span className="relative h-1.5 w-1.5 rounded-full bg-[hsl(189.16deg_79.17%_47.06%)]" />
        </span>
        <span className="font-mono text-[8px] font-semibold uppercase tracking-[0.28em] text-[hsl(189.16deg_79.17%_47.06%)] sm:text-[9px]">
          AI MODEL INFRASTRUCTURE
        </span>
      </div>

      <h2
        id="model-discovery-title"
        className="mt-7 text-4xl font-light leading-[0.98] tracking-[-0.035em] text-slate-950 dark:text-white sm:text-5xl lg:text-7xl"
      >
        The engines behind
        <br />
        <span className="text-slate-400 dark:text-white/38">your workflow.</span>
      </h2>

      <p className="mx-auto mt-6 max-w-2xl text-sm leading-7 text-slate-600 dark:text-white/46 sm:text-base">
        A connected layer of image, video, 3D and finishing models — routed through one architectural AI workspace.
      </p>
    </div>
  );
}

function BlueprintCircuit({
  visibleRoutes,
  onCoreEnter,
}: {
  visibleRoutes: {
    path: string;
    index: number;
    active: boolean;
    opacity: number;
  }[];
  onCoreEnter: () => void;
}) {
  return (
    <svg
      viewBox="0 0 1200 720"
      className="absolute inset-0 h-full w-full"
      fill="none"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <defs>
        <filter id="renderuim-blueprint-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="4" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>

        <radialGradient id="renderuim-core-glow">
          <stop offset="0" stopColor={ACCENT} stopOpacity=".26" />
          <stop offset="0.55" stopColor={ACCENT} stopOpacity=".08" />
          <stop offset="1" stopColor={ACCENT} stopOpacity="0" />
        </radialGradient>

        <linearGradient id="renderuim-core-line" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={ACCENT} stopOpacity=".14" />
          <stop offset="0.5" stopColor={ACCENT} stopOpacity=".65" />
          <stop offset="1" stopColor={ACCENT} stopOpacity=".14" />
        </linearGradient>
      </defs>

      <circle cx="600" cy="340" r="142" fill="url(#renderuim-core-glow)" opacity=".65" />

      <g>
        <circle
          cx="600"
          cy="340"
          r="118"
          stroke={ACCENT}
          strokeOpacity=".055"
          strokeWidth="1"
          strokeDasharray="2 11"
        />
        <circle
          cx="600"
          cy="340"
          r="92"
          stroke={ACCENT}
          strokeOpacity=".12"
          strokeWidth="1"
          strokeDasharray="2 8"
        />
        <circle cx="600" cy="340" r="66" stroke={ACCENT} strokeOpacity=".18" strokeWidth="1" />
      </g>

      {visibleRoutes.map(({ path, index, active, opacity }) => {
        const category: CategoryId =
          index < 3
            ? "image"
            : index < 6
              ? "video"
              : index < 10
                ? "3d"
                : "enhance";
        const tone = categoryStyles[category];

        return (
          <g key={path} opacity={opacity}>
            <path
              d={path}
              stroke={tone.dot}
              strokeOpacity={active ? 0.92 : 0.38}
              strokeWidth={active ? 1.6 : 1}
              strokeDasharray="3 7"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />

            <path
              d={path}
              stroke={tone.dot}
              strokeOpacity={active ? 0.15 : 0.045}
              strokeWidth="7"
              filter="url(#renderuim-blueprint-glow)"
              vectorEffect="non-scaling-stroke"
            />

            <circle
              r={active ? 3.4 : 2.4}
              fill={tone.dot}
              opacity={active ? 1 : 0.72}
              filter={active ? "url(#renderuim-blueprint-glow)" : undefined}
            >
              <animateMotion
                dur={`${8.2 + (index % 3) * 1.6}s`}
                begin={`${index * 0.8}s`}
                repeatCount="indefinite"
                path={path}
              />
            </circle>
          </g>
        );
      })}

      <path d="M 540 326 H 474 V 320 H 430" stroke="url(#renderuim-core-line)" strokeWidth="1" />
      <path d="M 660 326 H 726 V 320 H 770" stroke="url(#renderuim-core-line)" strokeWidth="1" />
      <path d="M 540 352 H 498 V 366 H 448" stroke={ACCENT} strokeOpacity=".10" strokeWidth="1" />
      <path d="M 660 352 H 702 V 366 H 752" stroke={ACCENT} strokeOpacity=".10" strokeWidth="1" />

      <circle cx="600" cy="340" r="5" fill={ACCENT} filter="url(#renderuim-blueprint-glow)" />

      <g onMouseEnter={onCoreEnter}>
        <circle cx="600" cy="340" r="54" fill="transparent" />
      </g>
    </svg>
  );
}

function BlueprintNodeCard({
  node,
  active,
  dimmed,
  onEnter,
  onLeave,
}: {
  node: BlueprintNode;
  active: boolean;
  dimmed: boolean;
  onEnter: () => void;
  onLeave: () => void;
}) {
  const left = node.side === "left" ? "0%" : "82%";
  const top = `${(node.y / 720) * 100}%`;
  const tone = categoryStyles[node.category];

  return (
    <Link
      href={`/models?q=${encodeURIComponent(node.query)}`}
      aria-label={`Explore ${node.name}`}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      className={[
        "group absolute w-[172px] -translate-y-1/2 overflow-hidden rounded-[18px] border px-3.5 py-3",
        "backdrop-blur-xl transition-all duration-300",
        "border-black/[0.08] bg-white/72 shadow-[0_10px_30px_rgba(15,23,42,0.05)]",
        "dark:border-white/[0.09] dark:bg-[#090b0e]/82 dark:shadow-[0_14px_45px_rgba(0,0,0,0.26)]",
        active
          ? "shadow-[0_0_36px_rgba(0,0,0,0.10)] dark:shadow-[0_0_42px_rgba(0,0,0,0.42)]"
          : "hover:-translate-y-[53%]",
        dimmed ? "opacity-25" : "opacity-100",
      ].join(" ")}
      style={{ left, top }}
    >
      <div
        className="absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{
          background: `linear-gradient(135deg, ${tone.soft}, transparent 62%)`,
        }}
      />

      <div className="relative flex items-center gap-3">
        <span
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border text-[10px] font-semibold"
          style={{
            borderColor: active ? tone.dot : tone.line,
            background: tone.soft,
            color: tone.dot,
            boxShadow: active ? `0 0 18px ${tone.glow}` : undefined,
          }}
        >
          {node.monogram}
        </span>

        <span className="min-w-0 text-left">
          <span className="block truncate text-[12px] font-medium tracking-tight text-slate-900 dark:text-white">
            {node.name}
          </span>
          <span className="mt-1 block font-mono text-[7px] uppercase tracking-[0.18em] text-slate-500 dark:text-white/30">
            {node.category === "3d" ? "SPATIAL ENGINE" : "AI ENGINE"}
          </span>
        </span>

        <motion.span
          className="relative ml-auto h-1.5 w-1.5 shrink-0 rounded-full"
          style={{ backgroundColor: tone.dot }}
          animate={{
            opacity: active ? [0.35, 1, 0.35] : [0.45, 0.8, 0.45],
            boxShadow: active
              ? [`0 0 0px ${tone.dot}`, `0 0 12px ${tone.dot}`, `0 0 0px ${tone.dot}`]
              : `0 0 8px ${tone.glow}`,
          }}
          transition={{ duration: active ? 1.35 : 2.2, repeat: Infinity, ease: "easeInOut" }}
        />
      </div>

      {node.preview ? (
        <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-[18px] opacity-0 transition-opacity duration-300 group-hover:opacity-100">
          {node.preview.type === "video" ? (
            <video src={node.preview.src} autoPlay muted loop playsInline className="absolute inset-0 h-full w-full object-cover" />
          ) : (
            <Image src={node.preview.src} alt="" fill sizes="180px" className="object-cover" />
          )}
          <div className="absolute inset-0 bg-black/66" />
          <div className="absolute inset-x-3 bottom-3 h-px bg-gradient-to-r from-transparent via-[hsl(189.16deg_79.17%_47.06%_/_0.7)] to-transparent" />
        </div>
      ) : null}
    </Link>
  );
}

function CoreModule({
  active,
  onMouseEnter,
  onMouseLeave,
}: {
  active: boolean;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}) {
  return (
    <motion.div
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      className="absolute left-1/2 top-1/2 z-30 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center"
      animate={{ y: [-2, 2, -2] }}
      transition={{ duration: 4.8, repeat: Infinity, ease: "easeInOut" }}
    >
      <div
        className={[
          "relative flex h-[146px] w-[202px] items-center justify-center overflow-hidden rounded-[30px] border px-5",
          "backdrop-blur-2xl transition-all duration-300",
          "border-black/[0.08] bg-white/78 shadow-[0_24px_80px_rgba(15,23,42,0.08)]",
          "dark:border-white/[0.10] dark:bg-[#090b0e]/88 dark:shadow-[0_24px_90px_rgba(0,0,0,0.34)]",
          active
            ? "border-[hsl(189.16deg_79.17%_47.06%_/_0.42)] shadow-[0_0_70px_hsl(189.16deg_79.17%_47.06%_/_0.14)]"
            : "",
        ].join(" ")}
      >
        <div className="absolute inset-3 rounded-[24px] border border-black/[0.05] dark:border-white/[0.045]" />
        <div className="absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-[hsl(189.16deg_79.17%_47.06%_/_0.72)] to-transparent" />
        <div className="absolute inset-x-10 bottom-0 h-px bg-gradient-to-r from-transparent via-[hsl(189.16deg_79.17%_47.06%_/_0.24)] to-transparent" />

        <div className="relative z-10 flex flex-col items-center text-center">
          <span
            className="mb-3 flex h-10 w-10 items-center justify-center rounded-full border"
            style={{
              borderColor: `hsl(189.16deg 79.17% 47.06% / ${active ? 0.42 : 0.2})`,
              background: ACCENT_SOFT,
              boxShadow: active ? `0 0 22px ${ACCENT_SOFT}` : undefined,
            }}
          >
            <Sparkles className="h-4 w-4" style={{ color: ACCENT }} />
          </span>

          <span className="font-mono text-[8px] font-semibold uppercase tracking-[0.28em]" style={{ color: ACCENT }}>
            AI ROUTING CORE
          </span>

          <span className="mt-2 max-w-[140px] text-[11px] leading-5 text-slate-600 dark:text-white/40">
            One workspace. Multiple engines. One connected workflow.
          </span>
        </div>

        <motion.span
          className="absolute -inset-2 rounded-[34px] border"
          style={{ borderColor: `hsl(189.16deg 79.17% 47.06% / 0.11)` }}
          animate={{ opacity: active ? [0.2, 0.7, 0.2] : [0.14, 0.34, 0.14], scale: [0.985, 1.02, 0.985] }}
          transition={{ duration: active ? 2.1 : 3.4, repeat: Infinity, ease: "easeInOut" }}
        />
      </div>
    </motion.div>
  );
}

function MobileBlueprintTree({
  activeNode,
  setActiveNode,
  activeCategory,
  setActiveCategory,
}: {
  activeNode: string | null;
  setActiveNode: (value: string | null) => void;
  activeCategory: CategoryId | null;
  setActiveCategory: (value: CategoryId | null) => void;
}) {
  return (
    <div className="relative mx-auto w-full max-w-[520px] px-2 py-3">
      {/* Mobile blueprint field */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 overflow-hidden rounded-[30px]"
      >
        <div
          className="absolute inset-0 opacity-[0.75] dark:opacity-[0.52]"
          style={{
            backgroundImage: `linear-gradient(to right, rgba(15,23,42,.09) 1px, transparent 1px), linear-gradient(to bottom, rgba(15,23,42,.09) 1px, transparent 1px)`,
            backgroundSize: "32px 32px",
            maskImage:
              "linear-gradient(to bottom, transparent 0%, black 8%, black 92%, transparent 100%)",
            WebkitMaskImage:
              "linear-gradient(to bottom, transparent 0%, black 8%, black 92%, transparent 100%)",
          }}
        />
        <div
          className="absolute inset-0 hidden opacity-[0.34] dark:block"
          style={{
            backgroundImage: `linear-gradient(to right, rgba(255,255,255,.075) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,.075) 1px, transparent 1px)`,
            backgroundSize: "160px 160px",
          }}
        />
        <div className="absolute left-1/2 top-0 h-80 w-80 -translate-x-1/2 rounded-full bg-[hsl(189.16deg_79.17%_47.06%_/_0.07)] blur-[95px] dark:bg-[hsl(189.16deg_79.17%_47.06%_/_0.05)]" />
      </div>

      {/* Architectural guide rails */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-3 top-3 bottom-3 rounded-[28px] border border-black/[0.07] dark:border-white/[0.07]" />
      <div aria-hidden="true" className="pointer-events-none absolute left-4 top-4 h-5 w-5 border-l border-t border-[hsl(189.16deg_79.17%_47.06%_/_0.45)]" />
      <div aria-hidden="true" className="pointer-events-none absolute right-4 top-4 h-5 w-5 border-r border-t border-[hsl(189.16deg_79.17%_47.06%_/_0.45)]" />
      <div aria-hidden="true" className="pointer-events-none absolute bottom-4 left-4 h-5 w-5 border-b border-l border-[hsl(189.16deg_79.17%_47.06%_/_0.25)]" />
      <div aria-hidden="true" className="pointer-events-none absolute bottom-4 right-4 h-5 w-5 border-b border-r border-[hsl(189.16deg_79.17%_47.06%_/_0.25)]" />

      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative z-10 mx-auto w-full max-w-[296px]"
      >
        <div className="relative overflow-hidden rounded-[26px] border border-[hsl(189.16deg_79.17%_47.06%_/_0.30)] bg-white/88 px-5 py-5 text-center shadow-[0_20px_70px_rgba(15,23,42,0.08)] backdrop-blur-xl dark:border-[hsl(189.16deg_79.17%_47.06%_/_0.24)] dark:bg-[#090b0e]/92 dark:shadow-[0_24px_80px_rgba(0,0,0,0.34)]">
          <div className="absolute inset-0 bg-gradient-to-b from-[hsl(189.16deg_79.17%_47.06%_/_0.06)] via-transparent to-transparent" />
          <div className="absolute inset-x-7 top-0 h-px bg-gradient-to-r from-transparent via-[hsl(189.16deg_79.17%_47.06%_/_0.85)] to-transparent" />

          <div className="relative z-10 mb-3 flex items-center justify-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inset-0 animate-ping rounded-full bg-[hsl(189.16deg_79.17%_47.06%_/_0.42)]" />
              <span className="relative h-2.5 w-2.5 rounded-full bg-[hsl(189.16deg_79.17%_47.06%)] shadow-[0_0_12px_hsl(189.16deg_79.17%_47.06%_/_0.45)]" />
            </span>
            <span className="font-mono text-[8px] font-semibold uppercase tracking-[0.30em]" style={{ color: ACCENT }}>
              LIVE SYSTEM
            </span>
          </div>

          <div className="relative z-10 text-[15px] font-semibold tracking-[0.18em] text-slate-950 dark:text-white">
            AI ROUTING CORE
          </div>
          <div className="relative z-10 mt-2 text-[10px] leading-relaxed text-slate-500 dark:text-white/42">
            Intelligent model routing
            <br />
            for image, video, 3D and enhancement
          </div>
        </div>
      </motion.div>

      {/* Main electrical trunk */}
      <div className="relative z-10 mx-auto h-14 w-8">
        <div className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-gradient-to-b from-[hsl(189.16deg_79.17%_47.06%_/_0.85)] via-[hsl(189.16deg_79.17%_47.06%_/_0.34)] to-transparent" />
        <div className="absolute left-1/2 top-0 h-full w-3 -translate-x-1/2 border-x border-[hsl(189.16deg_79.17%_47.06%_/_0.07)]" />
        <motion.div
          className="absolute left-1/2 top-0 h-5 w-[3px] -translate-x-1/2 rounded-full bg-[hsl(189.16deg_79.17%_47.06%)] blur-[1px]"
          animate={{ y: [-20, 60] }}
          transition={{ duration: 1.55, repeat: Infinity, ease: "linear" }}
        />
      </div>

      <div className="relative z-10">
        {categories.map((category, index) => {
          const providersForCategory = blueprintNodes.filter((node) => node.category === category.id);
          const isActive = activeCategory === category.id;
          const tone = categoryStyles[category.id];

          return (
            <motion.div
              key={category.id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.08 }}
              className="relative"
            >
              {/* Central square rail */}
              <div aria-hidden="true" className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-black/[0.10] dark:bg-white/[0.085]" />

              {/* Connector to category module */}
              <div
                aria-hidden="true"
                className="absolute left-1/2 top-[31px] h-px w-[calc(50%-16px)]"
                style={{
                  background: `linear-gradient(to right, ${tone.dot}, transparent)`,
                  opacity: isActive ? 0.9 : 0.48,
                  boxShadow: `0 0 10px ${tone.glow}`,
                }}
              />

              <button
                type="button"
                onClick={() => {
                  setActiveCategory(isActive ? null : category.id);
                  setActiveNode(null);
                }}
                className="group relative z-10 flex w-full items-center gap-3 overflow-hidden rounded-[20px] border p-3 text-left backdrop-blur-xl transition-all duration-300"
                style={{
                  borderColor: isActive ? tone.dot : `${tone.dot}45`,
                  background: `linear-gradient(135deg, ${tone.soft}, rgba(255,255,255,.74))`,
                  boxShadow: isActive ? `0 0 34px ${tone.glow}` : "0 8px 28px rgba(15,23,42,.04)",
                }}
              >
                {/* Category blueprint square */}
                <div
                  className="absolute right-3 top-2 h-3 w-3 border-r border-t"
                  style={{ borderColor: `${tone.dot}90` }}
                />
                <div
                  className="absolute bottom-2 right-3 h-3 w-3 border-b border-r"
                  style={{ borderColor: `${tone.dot}45` }}
                />

                <div
                  className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border bg-white/60 dark:bg-black/20"
                  style={{
                    borderColor: isActive ? tone.dot : tone.line,
                    boxShadow: isActive ? `inset 0 0 0 1px ${tone.dot}20, 0 0 18px ${tone.glow}` : undefined,
                  }}
                >
                  <span
                    aria-hidden="true"
                    className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full"
                    style={{
                      backgroundColor: tone.dot,
                      boxShadow: `0 0 10px ${tone.glow}`,
                    }}
                  />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-950 dark:text-white">
                        {category.label}
                      </div>
                      <div className="mt-1 text-[10px] leading-relaxed text-slate-500 dark:text-white/42">
                        {category.description}
                      </div>
                    </div>
                    <div className="font-mono text-[10px] font-medium" style={{ color: tone.dot }}>
                      {String(providersForCategory.length).padStart(2, "0")}
                    </div>
                  </div>

                  <div className="mt-2 flex items-center gap-2">
                    <span className="h-px flex-1" style={{ background: tone.line }} />
                    <span className="font-mono text-[7px] uppercase tracking-[0.18em] text-slate-400 dark:text-white/25">
                      {tone.label}
                    </span>
                  </div>
                </div>

                <motion.div animate={{ rotate: isActive ? 90 : 0 }} className="shrink-0 text-slate-400 dark:text-white/32">
                  <ArrowRight className="h-4 w-4" />
                </motion.div>
              </button>

              <AnimatePresence initial={false}>
                {isActive && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.28, ease: "easeOut" }}
                    className="relative ml-8 overflow-hidden"
                  >
                    <div className="relative mt-2 pl-5">
                      {/* Branch spine */}
                      <div
                        aria-hidden="true"
                        className="absolute left-0 top-1 bottom-1 w-px"
                        style={{
                          background: `linear-gradient(to bottom, ${tone.dot}, ${tone.line}, transparent)`,
                          boxShadow: `0 0 12px ${tone.glow}`,
                        }}
                      />

                      {providersForCategory.map((node, nodeIndex) => {
                        const selected = activeNode === node.name;

                        return (
                          <Link
                            key={node.name}
                            href={`/models?q=${encodeURIComponent(node.query)}`}
                            onMouseEnter={() => setActiveNode(node.name)}
                            onMouseLeave={() => setActiveNode(null)}
                            onFocus={() => setActiveNode(node.name)}
                            onBlur={() => setActiveNode(null)}
                            className="group relative mb-2 flex w-full items-center gap-3 overflow-hidden rounded-[17px] border px-3 py-2.5 text-left transition-all duration-300 last:mb-0"
                            style={{
                              borderColor: selected ? tone.dot : `${tone.dot}35`,
                              background: selected ? tone.soft : "rgba(255,255,255,.68)",
                              boxShadow: selected ? `0 0 26px ${tone.glow}` : "0 6px 20px rgba(15,23,42,.035)",
                            }}
                          >
                            {/* Explicit branch line */}
                            <span
                              aria-hidden="true"
                              className="absolute -left-5 top-1/2 h-px w-5 -translate-y-1/2"
                              style={{
                                background: `linear-gradient(to right, ${tone.dot}, ${tone.line})`,
                                boxShadow: `0 0 8px ${tone.glow}`,
                              }}
                            />

                            {/* Corner geometry */}
                            <span
                              aria-hidden="true"
                              className="absolute right-2 top-2 h-2.5 w-2.5 border-r border-t"
                              style={{ borderColor: `${tone.dot}65` }}
                            />

                            <span
                              className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border text-[10px] font-bold"
                              style={{
                                borderColor: selected ? tone.dot : tone.line,
                                background: tone.soft,
                                color: tone.dot,
                              }}
                            >
                              {node.monogram}

                              {selected && (
                                <motion.span
                                  className="absolute inset-0 rounded-xl border"
                                  style={{ borderColor: tone.dot }}
                                  initial={{ opacity: 0.8, scale: 0.9 }}
                                  animate={{ opacity: [0, 1, 0], scale: [0.9, 1.12, 1.24] }}
                                  transition={{ duration: 1.25, repeat: Infinity }}
                                />
                              )}
                            </span>

                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-[11px] font-medium text-slate-900 dark:text-white">
                                {node.name}
                              </span>
                              <span className="mt-0.5 block font-mono text-[8px] uppercase tracking-[0.16em] text-slate-400 dark:text-white/28">
                                online
                              </span>
                            </span>

                            <span className="relative h-4 w-8 overflow-hidden rounded-full border" style={{ borderColor: `${tone.dot}22` }}>
                              <span
                                aria-hidden="true"
                                className="absolute left-1 top-1/2 h-px w-6 -translate-y-1/2"
                                style={{ background: tone.line }}
                              />
                              <motion.span
                                className="absolute left-1 top-1/2 h-1 w-1 -translate-y-1/2 rounded-full"
                                style={{ backgroundColor: tone.dot, boxShadow: `0 0 8px ${tone.dot}` }}
                                animate={{ x: [0, 22] }}
                                transition={{ duration: 1.05, repeat: Infinity, ease: "linear", delay: nodeIndex * 0.12 }}
                              />
                            </span>
                          </Link>
                        );
                      })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {index < categories.length - 1 ? <div className="h-4" /> : null}
            </motion.div>
          );
        })}
      </div>

      <div className="relative z-10 mt-6 flex items-center justify-between overflow-hidden rounded-[18px] border border-[hsl(189.16deg_79.17%_47.06%_/_0.13)] bg-white/68 px-4 py-3 backdrop-blur-xl dark:bg-[#090b0e]/72">
        <div className="absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-[hsl(189.16deg_79.17%_47.06%_/_0.35)] to-transparent" />
        <div>
          <div className="font-mono text-[8px] font-semibold uppercase tracking-[0.24em] text-slate-400 dark:text-white/30">
            Network status
          </div>
          <div className="mt-1 text-[11px] text-slate-900 dark:text-white/72">
            12 AI engines connected
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-[hsl(189.16deg_79.17%_47.06%)] shadow-[0_0_10px_hsl(189.16deg_79.17%_47.06%_/_0.6)]" />
          <span className="font-mono text-[9px] font-medium uppercase tracking-[0.18em]" style={{ color: ACCENT }}>
            Live
          </span>
        </div>
      </div>
    </div>
  );
}

function NetworkStatus({ count }: { count: number }) {
  return (
    <div className="mt-8 flex flex-col gap-5 px-1 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3">
        <span className="relative flex h-2 w-2">
          <span className="absolute inset-0 animate-ping rounded-full bg-[hsl(189.16deg_79.17%_47.06%_/_0.45)]" />
          <span className="relative h-2 w-2 rounded-full bg-[hsl(189.16deg_79.17%_47.06%)] shadow-[0_0_10px_hsl(189.16deg_79.17%_47.06%_/_0.52)]" />
        </span>
        <span className="font-mono text-[8px] uppercase tracking-[0.25em] text-slate-500 dark:text-white/30">
          BLUEPRINT NETWORK / ONLINE
        </span>
      </div>

      <div className="flex items-center gap-4">
        <span className="font-mono text-[8px] uppercase tracking-[0.2em] text-slate-400 dark:text-white/26">
          {count} engines connected
        </span>
        <span className="rounded-full border border-[hsl(189.16deg_79.17%_47.06%_/_0.17)] bg-[hsl(189.16deg_79.17%_47.06%_/_0.045)] px-2 py-1 font-mono text-[7px] uppercase tracking-[0.16em]" style={{ color: ACCENT }}>
          SIGNALS LIVE
        </span>
      </div>
    </div>
  );
}
