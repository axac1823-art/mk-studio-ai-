"use client";

import {
  Children,
  isValidElement,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Box,
  ChevronLeft,
  ChevronRight,
  FolderOpen,
  Heart,
  Image as ImageIcon,
  Music,
  Plus,
  Sparkles,
  Trash2,
  Video as VideoIcon,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { AssetLayout } from "@/components/projects/asset-layout-controls";
import { AssetCard } from "@/components/projects/asset-card";
import {
  AssetNavigationToolbar,
  type AssetNavigationSort,
  type AssetNavigationTypeFilter,
} from "@/components/projects/asset-navigation-toolbar";
import type { ProjectSummary } from "@/components/projects/project-card";
import { useAssetLayout } from "@/components/projects/use-asset-layout";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

/* ========================================================================== */
/*  1) الأنواع                                                                 */
/* ========================================================================== */

type ViewMode = "overview" | "projects" | "assets" | "favorites";

type RecentAsset = {
  id: string;
  projectId?: string | null;
  type: "image" | "video" | "audio" | "3d_model";
  url: string;
  isFavorite: boolean;
  generationId?: string | null;
  createdAt?: string;
  // اختياري: إذا أرجعها الـ API تُستعمل مباشرة، وإلا تُقاس من الصورة نفسها.
  width?: number | null;
  height?: number | null;
  // بيانات الـ generation (تظهر في عنوان وضع Row فقط).
  generationPrompt?: string | null;
  generationAspectRatio?: string | null;
  generationQuality?: string | null;
  generationResolution?: string | null;
  generationSelectedModel?: string | null;
  generationModelUsed?: string | null;
  generationCreatedAt?: string | null;
};

/* ========================================================================== */
/*  2) الإعدادات: عدّل هنا أولاً                                               */
/*                                                                            */
/*  row      → بطاقات ثابتة الحجم + عنوان (prompt) لكل generation             */
/*  square   → مربعات متساوية، شبكة واحدة بدون عناوين                          */
/*  original → Pinterest (masonry): كل عنصر بشكله الأصلي، شبكة واحدة بدون عناوين */
/* ========================================================================== */

type LayoutMode = "row" | "original" | "square";

// تحويل قيمة الـ layout القادمة من الشريط العلوي إلى أحد الأوضاع الثلاثة.
// أي اسم لا يطابق square أو original يعتبر row. عدّل هنا إذا اختلفت الأسماء.
// ربط قيم الأزرار (AssetLayout) بأوضاع العرض. عدّل هنا فقط إن كان الترتيب معكوساً.
const LAYOUT_MODE_BY_VALUE: Record<AssetLayout, LayoutMode> = {
  list: "row",        // زر Row
  square: "square",   // زر Square
  grid: "original",   // زر Original (Pinterest)
};

function resolveLayoutMode(layout: AssetLayout): LayoutMode {
  return LAYOUT_MODE_BY_VALUE[layout] ?? "row";
}

// المسافة بين العناصر في كل الشبكات (8px = gap-2 في Tailwind).
const GRID_GAP = 8;

// أصغر عرض للعنصر عندما لا يختار المستخدم عدد أعمدة.
const AUTO_MIN_TILE = 120;

// نسبة بطاقات وضع Row (يجب كتابتها كاملة حتى يلتقطها Tailwind).
const ROW_CARD_ASPECT = "aspect-[4/3]";

// القيمة التي يُعطاها AssetCard في وضع Original.
// AssetCard هو من يقرر إظهار/إخفاء الـ prompt والتوقيت حسب هذه القيمة،
// فنعطيه نفس قيمة Square ليظهر نظيفاً. غيّرها إذا كانت القيمة الصحيحة مختلفة.
const ORIGINAL_CARD_LAYOUT = "square";

// نسب هياكل التحميل (skeleton) في وضع Original، لتشبه الشكل النهائي.
const SKELETON_ORIGINAL_ASPECTS = [
  "aspect-[2/3]",
  "aspect-[16/9]",
  "aspect-[2/3]",
  "aspect-square",
  "aspect-[16/9]",
  "aspect-[3/4]",
];

/* -------------------------- أصناف CSS المشتركة --------------------------- */
// كلها !important لأنها تتغلب على تنسيقات AssetCard الداخلية.

// تجعل الصورة/الفيديو يملآن الإطار بدون حواف أو ظلال.
const MEDIA_FILL = [
  "[&>*]:!h-full [&>*]:!w-full [&>*]:!min-w-0",
  "[&_img]:!block [&_img]:!h-full [&_img]:!w-full [&_img]:!rounded-none [&_img]:!border-0 [&_img]:!shadow-none [&_img]:!ring-0",
  "[&_video]:!block [&_video]:!h-full [&_video]:!w-full [&_video]:!rounded-none [&_video]:!border-0 [&_video]:!shadow-none [&_video]:!ring-0",
  "[&>div]:!rounded-none [&>div]:!border-0 [&>div]:!ring-0 [&>div]:!shadow-none",
].join(" ");

// تلغي أي aspect-* داخل AssetCard حتى لا يقص الصورة.
const NO_INNER_ASPECT =
  "[&_[class*='aspect-']]:!aspect-auto [&_[class*='aspect-']]:!h-full [&_[class*='aspect-']]:!w-full";

// cover = قص ليملأ الإطار، contain = عرض كامل بدون قص.
const FIT_COVER = "[&_img]:!object-cover [&_video]:!object-cover";

/* ========================================================================== */
/*  3) الأعمدة                                                                 */
/* ========================================================================== */

// عدد الأعمدة الذي اختاره المستخدم (1 إلى 12)، أو null إذا لم يختر.
function parseColumnCount(columns: unknown): number | null {
  const count = Number(columns);
  return Number.isInteger(count) && count > 0 && count <= 12 ? count : null;
}

// قاعدة الأعمدة الوحيدة لكل شبكات CSS في الصفحة.
function columnsStyle(columns: unknown): React.CSSProperties {
  const count = parseColumnCount(columns);

  return {
    gridTemplateColumns:
      count !== null
        ? `repeat(${count}, minmax(0, 1fr))`
        : `repeat(auto-fill, minmax(${AUTO_MIN_TILE}px, 1fr))`,
  };
}

/* ========================================================================== */
/*  4) Masonry (وضع Original)                                                  */
/*     يوزع كل عنصر على أقصر عمود، مثل Pinterest.                              */
/* ========================================================================== */

const useIsoLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

// حركة الانتقال عند إعادة الترتيب (غيّرها أو احذفها لإلغاء الحركة).
const MASONRY_MOVE = "duration-[220ms] ease-[cubic-bezier(0.22,1,0.36,1)]";

// خلية واحدة: موضوعة بـ translate، وتبلّغ الأب بارتفاعها الفعلي.
function MasonryCell({
  id,
  x,
  y,
  width,
  animate,
  onHeight,
  children,
}: {
  id: string;
  x: number;
  y: number;
  width: number;
  animate: boolean;
  onHeight: (id: string, height: number) => void;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement | null>(null);

  useIsoLayoutEffect(() => {
    const element = ref.current;
    if (!element) return undefined;

    const report = () => onHeight(id, element.getBoundingClientRect().height);
    report();

    if (typeof ResizeObserver === "undefined") return undefined;
    const observer = new ResizeObserver(report);
    observer.observe(element);
    return () => observer.disconnect();
  }, [id, onHeight]);

  return (
    <div
      ref={ref}
      className={cn(
        "absolute",
        // لا نستعمل transform هنا: يكسر position:fixed لنافذة View داخل البطاقة.
        animate &&
          `transition-[left,top] ${MASONRY_MOVE} motion-reduce:transition-none`
      )}
      style={{ width, left: x, top: y }}
    >
      {children}
    </div>
  );
}
// ارتفاع تقديري قبل القياس الفعلي (حتى لا تتكدس كل العناصر عند y=0).
function estimateHeight(item: React.ReactElement, itemWidth: number) {
  const props = item.props as { asset?: RecentAsset; className?: string };
  const { asset } = props;

  if (asset?.width && asset?.height && asset.width > 0 && asset.height > 0) {
    return itemWidth * (asset.height / asset.width);
  }

  // هياكل التحميل تحمل صنف aspect-* يمكن قراءته.
  const className = props.className ?? "";
  if (className.includes("aspect-[2/3]")) return itemWidth * 1.5;
  if (className.includes("aspect-[3/4]")) return itemWidth * (4 / 3);
  if (className.includes("aspect-square")) return itemWidth;
  if (className.includes("aspect-[16/9]")) return itemWidth * (9 / 16);
  return itemWidth * (3 / 4);
}

function MasonryGrid({
  columns,
  children,
}: {
  columns: unknown;
  children: React.ReactNode;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [width, setWidth] = useState(0); // عرض الحاوية
  const [heights, setHeights] = useState<Record<string, number>>({}); // ارتفاع كل عنصر
  const [animate, setAnimate] = useState(false); // الحركة تبدأ بعد أول ترتيب

  // قياس عرض الحاوية ومتابعته.
  useIsoLayoutEffect(() => {
    const element = containerRef.current;
    if (!element) return undefined;

    const update = () => {
      const next = Math.round(element.getBoundingClientRect().width * 2) / 2;
      setWidth((previous) => (Math.abs(previous - next) < 0.5 ? previous : next));
    };
    update();

    if (typeof ResizeObserver === "undefined") return undefined;
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const handleHeight = useCallback((id: string, height: number) => {
    setHeights((previous) =>
      Math.abs((previous[id] ?? -1) - height) < 0.5
        ? previous
        : { ...previous, [id]: height }
    );
  }, []);

  const items = Children.toArray(children).filter(
    (child): child is React.ReactElement => isValidElement(child)
  );

  // عدد الأعمدة: الرقم المختار بالضبط، أو يُحسب من العرض إذا لم يُختر.
  const autoCount = Math.max(1, Math.floor((width + GRID_GAP) / (AUTO_MIN_TILE + GRID_GAP)));
  const columnCount = width > 0 ? (parseColumnCount(columns) ?? autoCount) : 1;
  const columnWidth =
    width > 0 ? (width - GRID_GAP * (columnCount - 1)) / columnCount : 0;

  // كل عنصر يذهب إلى أقصر عمود (عند التساوي: الأيسر).
  const columnHeights = new Array<number>(columnCount).fill(0);
  const positions: Record<string, { x: number; y: number }> = {};

  if (width > 0) {
    for (const item of items) {
      const id = String(item.key);

      let target = 0;
      for (let i = 1; i < columnCount; i += 1) {
        if (columnHeights[i] < columnHeights[target] - 0.5) target = i;
      }

      positions[id] = {
        x: target * (columnWidth + GRID_GAP),
        y: columnHeights[target],
      };
      columnHeights[target] +=
        (heights[id] ?? estimateHeight(item, columnWidth)) + GRID_GAP;
    }
  }

  const totalHeight =
    items.length > 0 && width > 0
      ? Math.max(0, Math.max(...columnHeights) - GRID_GAP)
      : 0;

  // نفعّل الحركة فقط بعد قياس كل العناصر، حتى لا تطير من الزاوية.
  const ready =
    width > 0 &&
    items.length > 0 &&
    items.every((item) => heights[String(item.key)] !== undefined);

  useEffect(() => {
    if (!ready) return undefined;
    const frame = requestAnimationFrame(() => setAnimate(true));
    return () => cancelAnimationFrame(frame);
  }, [ready]);

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative w-full",
        animate &&
          `transition-[height] ${MASONRY_MOVE} motion-reduce:transition-none`
      )}
      style={{ height: totalHeight }}
    >
      {width > 0 &&
        items.map((item) => {
          const id = String(item.key);
          const { x, y } = positions[id] ?? { x: 0, y: 0 };

          return (
            <MasonryCell
              key={id}
              id={id}
              x={x}
              y={y}
              width={columnWidth}
              animate={animate}
              onHeight={handleHeight}
            >
              {item}
            </MasonryCell>
          );
        })}
    </div>
  );
}

// original → Masonry، غير ذلك → شبكة CSS عادية.
function LayoutGrid({
  mode,
  columns,
  children,
}: {
  mode: LayoutMode;
  columns: unknown;
  children: React.ReactNode;
}) {
  if (mode === "original") {
    return <MasonryGrid columns={columns}>{children}</MasonryGrid>;
  }

  return (
    <div className="grid items-start gap-2" style={columnsStyle(columns)}>
      {children}
    </div>
  );
}

/* ========================================================================== */
/*  5) قياس النسبة الأصلية للصورة/الفيديو (لوضع Original)                      */
/* ========================================================================== */

function useMediaRatio(asset: RecentAsset) {
  const suppliedRatio =
    asset.width && asset.height && asset.width > 0 && asset.height > 0
      ? asset.width / asset.height
      : null;
  const [ratio, setRatio] = useState<number | null>(suppliedRatio);

  useEffect(() => {
    let cancelled = false;
    setRatio(suppliedRatio);

    // الـ API أعطى الأبعاد، أو لسنا في المتصفح: لا حاجة للقياس.
    if (suppliedRatio !== null || typeof window === "undefined") return undefined;

    if (asset.type === "image") {
      const probe = new window.Image();
      probe.onload = () => {
        if (!cancelled && probe.naturalWidth > 0 && probe.naturalHeight > 0) {
          setRatio(probe.naturalWidth / probe.naturalHeight);
        }
      };
      probe.src = asset.url;
      return () => {
        cancelled = true;
        probe.onload = null;
      };
    }

    if (asset.type === "video") {
      const probe = document.createElement("video");
      probe.preload = "metadata";
      probe.onloadedmetadata = () => {
        if (!cancelled && probe.videoWidth > 0 && probe.videoHeight > 0) {
          setRatio(probe.videoWidth / probe.videoHeight);
        }
      };
      probe.src = asset.url;
      return () => {
        cancelled = true;
        probe.onloadedmetadata = null;
        probe.removeAttribute("src");
        probe.load();
      };
    }

    return undefined;
  }, [asset.type, asset.url, suppliedRatio]);

  return ratio;
}

/* ========================================================================== */
/*  6) عناصر صغيرة مشتركة                                                      */
/* ========================================================================== */

// صورة تظهر بتدرج عند اكتمال تحميلها.
function FadeImage({ src, className }: { src: string; className?: string }) {
  const [loaded, setLoaded] = useState(false);

  return (
    <img
      ref={(el) => {
        // الصور المخزنة مسبقاً لا تطلق onLoad.
        if (el?.complete && el.naturalWidth > 0) setLoaded(true);
      }}
      src={src}
      alt=""
      loading="lazy"
      decoding="async"
      onLoad={() => setLoaded(true)}
      className={cn(
        "transition-[opacity,transform] duration-500 ease-out",
        loaded ? "opacity-100" : "opacity-0",
        className
      )}
    />
  );
}

// هياكل التحميل لكل الأوضاع.
function AssetSkeletons({
  mode,
  columns,
  count = 12,
}: {
  mode: LayoutMode;
  columns: unknown;
  count?: number;
}) {
  return (
    <LayoutGrid mode={mode} columns={columns}>
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton
          key={i}
          className={cn(
            "w-full rounded-xl",
            mode === "square" && "aspect-square",
            mode === "row" && ROW_CARD_ASPECT,
            mode === "original" &&
              SKELETON_ORIGINAL_ASPECTS[i % SKELETON_ORIGINAL_ASPECTS.length]
          )}
        />
      ))}
    </LayoutGrid>
  );
}

function SectionHeader({
  title,
  count,
  onPrevious,
  onNext,
}: {
  title: string;
  count?: number;
  onPrevious?: () => void;
  onNext?: () => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-muted-foreground">{title}</span>
        {typeof count === "number" && (
          <span className="text-xs tabular-nums text-muted-foreground/60">
            {count}
          </span>
        )}
      </div>

      {(onPrevious || onNext) && (
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={onPrevious}
            disabled={!onPrevious}
            aria-label="Previous projects"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={onNext}
            disabled={!onNext}
            aria-label="Next projects"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}

function EmptyState({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="flex min-h-[260px] items-center justify-center rounded-xl border border-dashed border-white/[0.08] bg-white/[0.015]">
      <div className="max-w-sm px-4 text-center">
        <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-muted">
          {icon}
        </div>
        <h2 className="text-sm font-semibold">{title}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}

/* ========================================================================== */
/*  7) المشاريع (بطاقات المشاريع)                                              */
/* ========================================================================== */

function ProjectCover({
  project,
  mode,
}: {
  project: ProjectSummary;
  mode?: LayoutMode;
}) {
  const aspect = mode === "square" ? "aspect-square" : "aspect-[4/3]";
  const countLabel = `${project.assetCount} ${project.assetCount === 1 ? "asset" : "assets"}`;

  return (
    <div
      className={cn(
        "relative w-full overflow-hidden rounded-xl bg-[#191a1f] ring-1 ring-white/[0.06] transition-shadow duration-200 group-hover:ring-white/[0.16]",
        aspect
      )}
    >
      {project.coverUrl ? (
        <>
          <FadeImage
            src={project.coverUrl}
            className="absolute inset-0 h-full w-full object-cover group-hover:scale-[1.03] motion-reduce:group-hover:scale-100"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 p-3">
            <p className="truncate text-sm font-semibold text-white">{project.name}</p>
            <p className="mt-0.5 text-xs text-white/75">{countLabel}</p>
          </div>
        </>
      ) : (
        <>
          <div className="absolute inset-0 bg-gradient-to-br from-muted to-muted/70" />
          <div className="absolute inset-0 flex items-center justify-center">
            <FolderOpen className="h-10 w-10 text-muted-foreground/50" />
          </div>
          <div className="absolute inset-x-0 bottom-0 p-3">
            <p className="truncate text-sm font-semibold">{project.name}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{countLabel}</p>
          </div>
        </>
      )}
    </div>
  );
}

function ProjectCardItem({
  project,
  onDelete,
  mode,
  fixedWidth = false,
}: {
  project: ProjectSummary;
  onDelete?: (id: string) => void;
  mode?: LayoutMode;
  fixedWidth?: boolean; // true = شريط أفقي في صفحة Overview
}) {
  return (
    <div className={cn("group relative", fixedWidth && "w-[200px] shrink-0")}>
      <Link
        href={`/app/projects/${project.id}`}
        className="block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#a09cff]"
      >
        <ProjectCover project={project} mode={fixedWidth ? undefined : mode} />
      </Link>

      {onDelete && (
        <button
          type="button"
          aria-label={`Delete ${project.name}`}
          onClick={() => onDelete(project.id)}
          className="absolute bottom-2 right-2 z-20 flex h-8 w-8 items-center justify-center rounded-full bg-black/45 text-white opacity-100 backdrop-blur-sm transition-opacity hover:bg-destructive focus-visible:opacity-100 md:opacity-0 md:group-hover:opacity-100"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

function NewProjectCard({
  mode,
  creating,
  name,
  busy,
  onStart,
  onNameChange,
  onCreate,
  onCancel,
}: {
  mode?: LayoutMode; // بدون mode = بطاقة بعرض ثابت للشريط الأفقي
  creating: boolean;
  name: string;
  busy: boolean;
  onStart: () => void;
  onNameChange: (value: string) => void;
  onCreate: () => void;
  onCancel: () => void;
}) {
  const wrapperClass = mode === undefined ? "w-[200px] shrink-0" : "w-full";
  const boxClass = mode === "square" ? "aspect-square" : "aspect-[4/3]";

  // حالة إدخال اسم المشروع.
  if (creating) {
    return (
      <div className={wrapperClass}>
        <div
          className={cn(
            "flex flex-col justify-center gap-3 rounded-xl bg-[#292a30] p-4 ring-1 ring-white/[0.06]",
            boxClass
          )}
        >
          <input
            autoFocus
            value={name}
            onChange={(event) => onNameChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") onCreate();
              if (event.key === "Escape") onCancel();
            }}
            placeholder="Project name"
            aria-label="Project name"
            className="h-9 w-full rounded-md border bg-background px-3 text-sm outline-none focus:border-primary"
          />

          <div className="flex gap-2">
            <Button
              size="sm"
              className="flex-1"
              disabled={!name.trim() || busy}
              onClick={onCreate}
            >
              Create
            </Button>
            <Button size="sm" variant="ghost" onClick={onCancel} disabled={busy}>
              Cancel
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // الحالة العادية: زر "New project".
  return (
    <div className={wrapperClass}>
      <button
        type="button"
        onClick={onStart}
        className={cn(
          "flex w-full flex-col items-center justify-center rounded-xl border border-dashed border-white/[0.10] bg-white/[0.02] p-5 text-center transition-colors hover:bg-white/[0.05] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#a09cff]",
          boxClass
        )}
      >
        <span className="mb-3 flex h-9 w-9 items-center justify-center rounded-full bg-[#292a30] text-[#c9c7ff]">
          <Plus className="h-4 w-4" />
        </span>
        <span className="text-sm font-semibold">New project</span>
        <span className="mt-1 max-w-[150px] text-xs leading-5 text-muted-foreground">
          Create a project to organize your assets
        </span>
      </button>
    </div>
  );
}

/* ========================================================================== */
/*  8) المعرض المسطّح: وضعا Square و Original                                  */
/*     شبكة واحدة، بدون عناوين، كل العناصر من كل الـ prompts معاً.             */
/* ========================================================================== */

function AssetTile({
  asset,
  onChanged,
  layout,
  mode,
}: {
  asset: RecentAsset;
  onChanged: () => void;
  layout: AssetLayout;
  mode: LayoutMode;
}) {
  const ratio = useMediaRatio(asset);
  const isSquare = mode === "square";

  // Square: 1:1. Original: النسبة الأصلية (4:3 مؤقتاً حتى تُقاس).
  const aspectRatio = isSquare ? 1 : (ratio ?? 4 / 3);

  // Original يستعمل نفس مظهر Square النظيف (بدون prompt أو توقيت).
  const cardLayout = (
    isSquare ? layout : ORIGINAL_CARD_LAYOUT
  ) as unknown as AssetLayout;

  return (
    <div
      data-asset-layout={mode}
      data-asset-type={asset.type}
      style={{ aspectRatio: String(aspectRatio) }}
      className="group relative w-full min-w-0 overflow-hidden rounded-xl bg-[#17181c]"
    >
      {/* البطاقة تملأ الإطار بالكامل، والإطار هو من يحدد النسبة */}
      <div
        className={cn(
          "absolute inset-0",
          MEDIA_FILL,
          FIT_COVER,
          !isSquare && NO_INNER_ASPECT
        )}
      >
        <AssetCard asset={asset} onChanged={onChanged} layout={cardLayout} />
      </div>
    </div>
  );
}

function AssetGallery({
  assets,
  columns,
  mode,
  layout,
  onChanged,
}: {
  assets: RecentAsset[];
  columns: unknown;
  mode: LayoutMode;
  layout: AssetLayout;
  onChanged: () => void;
}) {
  return (
    <LayoutGrid mode={mode} columns={columns}>
      {assets.map((asset) => (
        <AssetTile
          key={asset.id}
          asset={asset}
          onChanged={onChanged}
          layout={layout}
          mode={mode}
        />
      ))}
    </LayoutGrid>
  );
}

/* ========================================================================== */
/*  9) وضع Row: مجموعات حسب الـ generation                                     */
/*     عنوان (prompt + الإعدادات) ثم شبكة بطاقات ثابتة الحجم.                  */
/* ========================================================================== */

const TYPE_META: Record<RecentAsset["type"], { label: string; Icon: LucideIcon }> = {
  image: { label: "Image", Icon: ImageIcon },
  video: { label: "Video", Icon: VideoIcon },
  audio: { label: "Audio", Icon: Music },
  "3d_model": { label: "3D model", Icon: Box },
};

type GenerationGroup = {
  key: string;
  head: RecentAsset; // أول عنصر، منه تؤخذ بيانات العنوان
  items: RecentAsset[];
  hasHeader: boolean; // false للعناصر التي لا تنتمي لأي generation
};

// تجميع العناصر حسب generationId مع الحفاظ على الترتيب.
function groupByGeneration(assets: RecentAsset[]): GenerationGroup[] {
  const groups = new Map<string, GenerationGroup>();

  for (const asset of assets) {
    const key = asset.generationId ? `generation:${asset.generationId}` : `asset:${asset.id}`;
    const group = groups.get(key);

    if (group) {
      group.items.push(asset);
    } else {
      groups.set(key, {
        key,
        head: asset,
        items: [asset],
        hasHeader: Boolean(asset.generationId),
      });
    }
  }

  return Array.from(groups.values());
}

function formatGenerationDate(value?: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

// شارة صغيرة (النسبة، الجودة، الدقة، الموديل).
function SettingChip({
  children,
  title,
  className,
}: {
  children: React.ReactNode;
  title?: string;
  className?: string;
}) {
  return (
    <span
      title={title}
      className={cn(
        "inline-flex h-6 max-w-[220px] items-center gap-1 rounded-md bg-[#17181c] px-2 text-[11px] tabular-nums text-[#c3c4cd] ring-1 ring-white/[0.05]",
        className
      )}
    >
      {children}
    </span>
  );
}

// عنوان المجموعة: الـ prompt + التاريخ + عدد النتائج + الشارات.
function GenerationHeader({ asset, count }: { asset: RecentAsset; count: number }) {
  const date = formatGenerationDate(asset.generationCreatedAt ?? asset.createdAt);
  const prompt = asset.generationPrompt?.trim();
  const model = asset.generationSelectedModel
    ? asset.generationSelectedModel
    : asset.generationModelUsed
      ? `Auto · ${asset.generationModelUsed}`
      : "Auto";
  const ratio = asset.generationAspectRatio === "auto" ? "Auto" : asset.generationAspectRatio;

  return (
    <header className="flex flex-wrap items-start justify-between gap-x-6 gap-y-2">
      <div className="min-w-0 flex-1 basis-[320px]">
        <p
          className="line-clamp-2 break-words text-[13px] leading-5 text-[#e4e4ec]"
          title={prompt || undefined}
        >
          {prompt || "Untitled creation"}
        </p>
        <p className="mt-1 flex flex-wrap items-center gap-x-3 text-[11px] text-[#858893]">
          {date && <time dateTime={asset.generationCreatedAt ?? asset.createdAt}>{date}</time>}
          <span>
            {count} {count === 1 ? "result" : "results"}
          </span>
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {ratio && <SettingChip>{ratio}</SettingChip>}
        {asset.generationQuality && (
          <SettingChip className="capitalize">{asset.generationQuality}</SettingChip>
        )}
        {asset.generationResolution && <SettingChip>{asset.generationResolution}</SettingChip>}
        <SettingChip title={model} className="text-[#d0ceff]">
          <Sparkles className="h-3 w-3 shrink-0" />
          <span className="truncate">{model}</span>
        </SettingChip>
      </div>
    </header>
  );
}

// بطاقة Row: إطار بنسبة ثابتة (ROW_CARD_ASPECT) + شريط سفلي (النوع والمفضلة).
function CreationFeedCard({
  asset,
  onChanged,
}: {
  asset: RecentAsset;
  onChanged: () => void;
}) {
  const { label, Icon } = TYPE_META[asset.type];

  return (
    <article
      data-asset-type={asset.type}
      className="group/feed-item relative min-w-0 overflow-hidden rounded-xl bg-[#292a30] ring-1 ring-white/[0.06] transition-shadow duration-200 focus-within:ring-2 focus-within:ring-[#a09cff] hover:ring-white/[0.16]"
    >
      {/* الإطار: كل البطاقات بنفس الحجم، والصورة مقصوصة (cover) */}

        <AssetCard asset={asset} onChanged={onChanged}  />


      {/* الشريط السفلي: احذفه كله إذا لم تعد تريده */}
      <div className="flex h-9 items-center justify-between gap-2 px-2.5">
        <span className="inline-flex min-w-0 items-center gap-1.5 text-[11px] text-[#c5c6ce]">
          <Icon className="h-3.5 w-3.5 shrink-0 text-[#858893]" aria-hidden />
          <span className="truncate">{label}</span>
        </span>

        {asset.isFavorite && (
          <span
            className="inline-flex shrink-0 items-center gap-1 text-[11px] text-[#f2b9d0]"
            title="Favorite"
          >
            <Heart className="h-3.5 w-3.5 fill-current" aria-hidden />
            <span className="sr-only">Favorite</span>
          </span>
        )}
      </div>
    </article>
  );
}

// المسافة بين المجموعات + الخط الفاصل بينها.
const GROUP_SECTION = "flex flex-col gap-3 border-t border-white/[0.06] pt-8 first:border-t-0 first:pt-0";

function CreationsFeed({
  assets,
  columns,
  onChanged,
}: {
  assets: RecentAsset[];
  columns: unknown;
  onChanged: () => void;
}) {
  const groups = useMemo(() => groupByGeneration(assets), [assets]);

  return (
    <div className="flex flex-col gap-8">
      {groups.map((group) => (
        <section
          key={group.key}
          aria-label={group.head.generationPrompt?.trim() || "Creation"}
          className={GROUP_SECTION}
        >
          {group.hasHeader && (
            <GenerationHeader asset={group.head} count={group.items.length} />
          )}

          <div className="grid items-start gap-2" style={columnsStyle(columns)}>
            {group.items.map((asset) => (
              <CreationFeedCard
                key={asset.id}
                asset={asset}
                onChanged={onChanged}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function CreationsSkeleton({ columns }: { columns: unknown }) {
  return (
    <div className="flex flex-col gap-8" aria-hidden>
      {[4, 3].map((count, groupIndex) => (
        <div key={groupIndex} className={GROUP_SECTION}>
          <div className="flex flex-col gap-2">
            <Skeleton className="h-4 w-2/3 max-w-md rounded-md" />
            <Skeleton className="h-3 w-40 rounded-md" />
          </div>
          <div className="grid items-start gap-2" style={columnsStyle(columns)}>
            {Array.from({ length: count }).map((_, i) => (
              <Skeleton key={i} className={cn("w-full rounded-xl", ROW_CARD_ASPECT)} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ========================================================================== */
/*  10) الصفحة                                                                 */
/* ========================================================================== */

export default function ProjectsPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const createRequested = searchParams.get("create") === "1";

  // العرض الحالي من الرابط: ?view=projects | assets | favorites (وإلا overview).
  const rawView = searchParams.get("view");
  const view: ViewMode =
    rawView === "projects" || rawView === "assets" || rawView === "favorites"
      ? rawView
      : "overview";
  const isLibrary = view === "assets" || view === "favorites";

  /* ------------------------------- الحالة -------------------------------- */

  const [projects, setProjects] = useState<ProjectSummary[] | null>(null);
  const [assets, setAssets] = useState<RecentAsset[] | null>(null);

  // الفلاتر (تعمل في All assets و Favorites فقط).
  const [assetTypeFilter, setAssetTypeFilter] = useState<AssetNavigationTypeFilter>("all");
  const [assetServiceFilter, setAssetServiceFilter] = useState("all");
  const [assetProjectFilter, setAssetProjectFilter] = useState("all");
  const [assetSort, setAssetSort] = useState<AssetNavigationSort>("recent");

  // الـ layout وعدد الأعمدة (محفوظان عبر الـ hook).
  const { layout, columns, setLayout, setColumns } = useAssetLayout("library:assets");
  const mode = resolveLayoutMode(layout);

  const [error, setError] = useState<string | null>(null);
  const [projectsLoadError, setProjectsLoadError] = useState<string | null>(null);
  const [assetsLoadError, setAssetsLoadError] = useState<string | null>(null);

  // إنشاء مشروع جديد.
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  const projectsRailRef = useRef<HTMLDivElement | null>(null);
  // لتجاهل ردود الطلبات القديمة عند تبديل الفلاتر بسرعة.
  const assetsRequestRef = useRef(0);

  /* ------------------------------ جلب البيانات --------------------------- */

  const fetchProjects = useCallback(async () => {
    try {
      const response = await fetch("/api/projects", { cache: "no-store" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const data = (await response.json()) as { projects: ProjectSummary[] };
      setProjects(data.projects);
      setProjectsLoadError(null);
    } catch {
      setProjectsLoadError("Could not load projects.");
    }
  }, []);

  const fetchAssets = useCallback(async () => {
    const requestId = ++assetsRequestRef.current;

    try {
      const params = new URLSearchParams();

      if (view === "favorites") params.set("favorite", "1");
      // فلاتر السيرفر: النوع (ماعدا 3d يُفلتر محلياً) والخدمة.
      if (isLibrary && assetTypeFilter !== "all" && assetTypeFilter !== "3d_model") {
        params.set("type", assetTypeFilter);
      }
      if (isLibrary && assetServiceFilter !== "all") {
        params.set("feature", assetServiceFilter);
      }

      const query = params.toString();
      const response = await fetch(`/api/assets${query ? `?${query}` : ""}`, {
        cache: "no-store",
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const data = (await response.json()) as { assets: RecentAsset[] };
      if (requestId !== assetsRequestRef.current) return;

      // نعرض النتائج المولّدة فقط، وليس الملفات المرفوعة.
      const results = data.assets.filter((asset) => Boolean(asset.generationId));

      setAssets(
        isLibrary && assetTypeFilter === "3d_model"
          ? results.filter((asset) => asset.type === "3d_model")
          : results
      );
      setAssetsLoadError(null);
    } catch {
      if (requestId !== assetsRequestRef.current) return;
      setAssetsLoadError("Could not load assets.");
    }
  }, [view, isLibrary, assetTypeFilter, assetServiceFilter]);

  // عند تغيير العرض: تصفير الأخطاء وإعادة جلب المشاريع.
  useEffect(() => {
    setError(null);
    setProjectsLoadError(null);
    setAssetsLoadError(null);
    setCreating(view === "projects" && createRequested);
    void fetchProjects();
  }, [view, fetchProjects, createRequested]);

  // تفريغ القائمة القديمة حتى لا تظهر Favorites داخل All assets لحظياً.
  useEffect(() => {
    setAssets(null);
  }, [view]);

  // جلب الأصول (عرض Projects لا يحتاجها).
  useEffect(() => {
    if (view === "projects") {
      setAssets(null);
    } else {
      void fetchAssets();
    }
  }, [view, fetchAssets]);

  /* ------------------------------- المشاريع ------------------------------ */

  const closeCreateRoute = () => {
    if (createRequested) {
      router.replace("/app/projects?view=projects", { scroll: false });
    }
  };

  const cancelCreating = () => {
    setCreating(false);
    setName("");
    closeCreateRoute();
  };

  const createProject = async () => {
    const trimmed = name.trim();
    if (!trimmed || busy) return;

    setBusy(true);
    try {
      const response = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      setName("");
      setCreating(false);
      closeCreateRoute();
      await fetchProjects();
    } catch {
      setError("Could not create the project.");
    } finally {
      setBusy(false);
    }
  };

  const deleteProject = async (id: string) => {
    try {
      const response = await fetch(`/api/projects/${id}`, { method: "DELETE" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      await fetchProjects();
    } catch {
      setError("Could not delete the project.");
    }
  };

  const scrollProjects = (direction: "left" | "right") => {
    projectsRailRef.current?.scrollBy({
      left: direction === "left" ? -440 : 440,
      behavior: "smooth",
    });
  };

  /* --------------------------- تصفية وترتيب الأصول ------------------------ */

  const recentProjects = useMemo(() => projects?.slice(0, 8) ?? [], [projects]);

  const filteredAssets = useMemo(() => {
    const result = (assets ?? []).filter((asset) => {
      if (!isLibrary) return true; // Overview لا يطبق الفلاتر
      const matchesType = assetTypeFilter === "all" || asset.type === assetTypeFilter;
      const matchesProject =
        assetProjectFilter === "all" || asset.projectId === assetProjectFilter;
      return matchesType && matchesProject;
    });

    const time = (asset: RecentAsset) =>
      asset.createdAt ? new Date(asset.createdAt).getTime() : 0;

    result.sort((a, b) => {
      if (assetSort === "type") return a.type.localeCompare(b.type);
      return assetSort === "oldest" ? time(a) - time(b) : time(b) - time(a);
    });

    return result;
  }, [assets, assetTypeFilter, assetProjectFilter, assetSort, isLibrary]);

  // Overview يعرض آخر 12 عنصراً فقط.
  const recentAssets = useMemo(() => filteredAssets.slice(0, 12), [filteredAssets]);

  /* --------------------------------- العرض -------------------------------- */

  const pageTitle =
    view === "overview"
      ? "Projects"
      : view === "projects"
        ? "All projects"
        : view === "assets"
          ? "All assets"
          : "Favorites";

  const showCreateProject = view === "overview" || view === "projects";

  const newProjectProps = {
    creating,
    name,
    busy,
    onStart: () => setCreating(true),
    onNameChange: setName,
    onCreate: () => void createProject(),
    onCancel: cancelCreating,
  };

  // الشريط العلوي المشترك بين All assets و Favorites.
  const libraryToolbar = (
    <div className="sticky top-0 z-40 -mx-3 -mt-4 mb-1 border-b border-white/[0.07] bg-[#222328] px-3 py-2 md:-mx-4 md:px-4">
      <AssetNavigationToolbar
        typeFilter={assetTypeFilter}
        onTypeFilterChange={(value: AssetNavigationTypeFilter) => setAssetTypeFilter(value)}
        serviceFilter={assetServiceFilter}
        onServiceFilterChange={setAssetServiceFilter}
        layout={layout}
        columns={columns}
        onLayoutChange={setLayout}
        onColumnsChange={setColumns}
        projects={(projects ?? []).map(({ id, name: projectName }) => ({
          id,
          name: projectName,
        }))}
        projectFilter={assetProjectFilter}
        onProjectFilterChange={setAssetProjectFilter}
        sortBy={assetSort}
        onSortByChange={setAssetSort}
        onCreateFolder={() => router.push("/app/projects?view=projects&create=1")}
      />
    </div>
  );

  // محتوى All assets و Favorites: الشريط + (تحميل | فارغ | Row | Square/Original).
  const renderLibrary = (emptyState: React.ReactNode) => {
    const refresh = () => void fetchAssets();

    let content: React.ReactNode;
    if (assets === null) {
      content =
        mode === "row" ? (
          <CreationsSkeleton columns={columns} />
        ) : (
          <AssetSkeletons mode={mode} columns={columns} count={12} />
        );
    } else if (filteredAssets.length === 0) {
      content = emptyState;
    } else if (mode === "row") {
      content = (
        <CreationsFeed
          assets={filteredAssets}
          columns={columns}
          onChanged={refresh}
        />
      );
    } else {
      content = (
        <AssetGallery
          assets={filteredAssets}
          columns={columns}
          mode={mode}
          layout={layout}
          onChanged={refresh}
        />
      );
    }

    return (
      <section className="flex flex-col gap-4">
        {libraryToolbar}
        {content}
      </section>
    );
  };

  return (
    <main className="h-full min-h-0 w-full overflow-y-auto bg-[#17181c] p-3 sm:p-4 lg:p-5">
      <section
        aria-label="Projects and assets workspace"
        className="relative mx-auto flex min-h-full w-full max-w-[1920px] flex-col rounded-xl bg-[#222328]"
      >
        {/* رأس الصفحة */}
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.07] px-3 py-3 md:px-4">
          <div className="min-w-0">
            <h1 className="text-base font-semibold tracking-tight text-[#f2f2f5]">
              {pageTitle}
            </h1>
            <p className="mt-0.5 text-xs text-[#858893]">
              {isLibrary
                ? assets === null
                  ? "Loading assets…"
                  : `${filteredAssets.length} ${filteredAssets.length === 1 ? "item" : "items"}`
                : "Organize and revisit your work"}
            </p>
          </div>

          {showCreateProject && (
            <Button
              type="button"
              size="sm"
              className="h-8 gap-1.5 rounded-lg"
              onClick={() => setCreating(true)}
            >
              <Plus className="h-3.5 w-3.5" /> Add project
            </Button>
          )}
        </header>

        <div className="flex min-w-0 flex-1 flex-col gap-6 px-3 py-4 md:px-4">
          {(error || projectsLoadError || assetsLoadError) && (
            <p role="alert" className="text-sm text-destructive">
              {error || projectsLoadError || assetsLoadError}
            </p>
          )}

          {/* ------------------------- Overview ------------------------- */}
          {view === "overview" && (
            <>
              {/* شريط آخر المشاريع */}
              <section className="flex flex-col gap-3">
                <SectionHeader
                  title="Recent projects"
                  count={projects?.length}
                  onPrevious={() => scrollProjects("left")}
                  onNext={() => scrollProjects("right")}
                />

                {projects === null ? (
                  <div className="flex gap-4 overflow-hidden">
                    {Array.from({ length: 5 }).map((_, index) => (
                      <Skeleton
                        key={index}
                        className="aspect-[4/3] w-[200px] shrink-0 rounded-xl"
                      />
                    ))}
                  </div>
                ) : (
                  <div
                    ref={projectsRailRef}
                    className="flex gap-4 overflow-x-auto pb-1 scrollbar-none"
                  >
                    <NewProjectCard {...newProjectProps} />
                    {recentProjects.map((project) => (
                      <ProjectCardItem key={project.id} fixedWidth project={project} />
                    ))}
                  </div>
                )}
              </section>

              {/* آخر الأصول */}
              <section className="flex flex-col gap-3">
                <SectionHeader title="Recent assets" count={assets?.length} />

                {assets === null ? (
                  <AssetSkeletons mode={mode} columns={columns} count={8} />
                ) : recentAssets.length === 0 ? (
                  <EmptyState
                    icon={<ImageIcon className="h-5 w-5 text-muted-foreground" />}
                    title="No recent assets"
                    description="Your generated results will appear here."
                  />
                ) : (
                  <AssetGallery
                    assets={recentAssets}
                    columns={columns}
                    mode={mode}
                    layout={layout}
                    onChanged={() => void fetchAssets()}
                  />
                )}
              </section>
            </>
          )}

          {/* ------------------------- All projects ------------------------- */}
          {view === "projects" && (
            <section className="flex flex-col gap-4">
              {projects === null ? (
                <AssetSkeletons mode={mode} columns={columns} count={8} />
              ) : (
                <>
                  <LayoutGrid mode={mode} columns={columns}>
                    <NewProjectCard key="new-project" mode={mode} {...newProjectProps} />
                    {projects.map((project) => (
                      <ProjectCardItem
                        key={project.id}
                        project={project}
                        mode={mode}
                        onDelete={(id) => void deleteProject(id)}
                      />
                    ))}
                  </LayoutGrid>

                  {projects.length === 0 && (
                    <EmptyState
                      icon={<FolderOpen className="h-5 w-5 text-muted-foreground" />}
                      title="No projects yet"
                      description="Create your first project to get started."
                    />
                  )}
                </>
              )}
            </section>
          )}

          {/* ------------------------- All assets ------------------------- */}
          {view === "assets" &&
            renderLibrary(
              <EmptyState
                icon={<ImageIcon className="h-5 w-5 text-muted-foreground" />}
                title="No assets"
                description="Your generated results will appear here."
              />
            )}

          {/* ------------------------- Favorites ------------------------- */}
          {view === "favorites" &&
            renderLibrary(
              <EmptyState
                icon={<Heart className="h-5 w-5 text-muted-foreground" />}
                title="No favorites yet"
                description="Favorite assets will appear here."
              />
            )}
        </div>
      </section>
    </main>
  );
}
