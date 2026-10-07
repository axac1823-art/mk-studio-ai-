"use client";

import { useCallback, useEffect, useRef, useState, type ComponentType } from "react";
import { useRouter } from "next/navigation";

type LazyLoader<TProps extends object> = () => Promise<ComponentType<TProps>>;

function LazyViewportSection<TProps extends object>({
  id,
  loader,
  props,
  rootMargin = "150px 0px",
  className = "relative min-h-screen",
}: {
  id?: string;
  loader: LazyLoader<TProps>;
  props: TProps;
  rootMargin?: string;
  className?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [LoadedComponent, setLoadedComponent] =
    useState<ComponentType<TProps> | null>(null);

  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;

    let cancelled = false;

    const load = async () => {
      const Component = await loader();

      if (!cancelled) {
        setLoadedComponent(() => Component);
      }
    };

    const isMobile = window.matchMedia("(max-width: 1023px)").matches;

    // Desktop: keep the current behavior.
    if (!isMobile || !("IntersectionObserver" in window)) {
      void load();

      return () => {
        cancelled = true;
      };
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          observer.disconnect();
          void load();
        }
      },
      {
        rootMargin,
      }
    );

    observer.observe(node);

    return () => {
      cancelled = true;
      observer.disconnect();
    };
  }, [loader, rootMargin]);

  return (
    <div ref={containerRef} id={id} className={className}>
      {LoadedComponent ? <LoadedComponent {...props} /> : null}
    </div>
  );
}
const loadAIShowcase = () =>
  import("@/components/ui/ai-showcase").then((mod) => mod.default);

const loadToolsArena = () =>
  import("@/components/ui/tools-arena").then((mod) => mod.ToolsArena);

const loadUseCasesShowcase = () =>
  import("@/components/ui/use-cases-showcase").then((mod) => mod.default);

const loadIndustriesShowcase = () =>
  import("@/components/ui/industries-showcase-section").then(
    (mod) => mod.default
  );
function LazyHowItWorks() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [HowItWorksComponent, setHowItWorksComponent] =
    useState<ComponentType | null>(null);

  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;

    let cancelled = false;

    const load = async () => {
      const mod = await import("@/components/ui/HowItWorks");

      if (!cancelled) {
        setHowItWorksComponent(() => mod.default);
      }
    };

    // Keep desktop behavior immediate.
    const isMobile = window.matchMedia("(max-width: 1023px)").matches;

    if (!isMobile || !("IntersectionObserver" in window)) {
      void load();

      return () => {
        cancelled = true;
      };
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          observer.disconnect();
          void load();
        }
      },
      {
        rootMargin: "600px 0px",
      }
    );

    observer.observe(node);

    return () => {
      cancelled = true;
      observer.disconnect();
    };
  }, []);

  return (
    <div
      ref={containerRef}
      id="how-it-works"
      className="relative min-h-[400vh]"
    >
      {HowItWorksComponent ? <HowItWorksComponent /> : null}
    </div>
  );
}

export function LandingLazySections() {
  const router = useRouter();
  const openLogin = useCallback(() => {
    router.push("/?login=true", { scroll: false });
  }, [router]);

  return (
    <>
      <LazyViewportSection loader={loadAIShowcase} props={{}} className="relative min-h-screen" />
      <LazyHowItWorks />
      <LazyViewportSection
        id="tools"
        loader={loadToolsArena}
        props={{ onToolClick: openLogin }}
        className="relative min-h-screen"
      />
      <LazyViewportSection loader={loadUseCasesShowcase} props={{}} className="relative min-h-screen" />
      <LazyViewportSection
        loader={loadIndustriesShowcase}
        props={{ openLogin }}
        className="relative min-h-screen"
      />
    </>
  );
}