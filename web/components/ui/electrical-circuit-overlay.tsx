"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";

type CircuitNode = {
  x: number;
  y: number;
  progress: number;
};

type CircuitLayout = {
  width: number;
  height: number;
  path: string;
  nodes: CircuitNode[];
  duration: number;
};

const SECTION_ORDER = [
  "hero",
  "models",
  "how-it-works",
  "one-capture",
  "tools",
  "use-cases",
  "get-started",
  "footer",
];

/** Mesure les sections existantes pour tracer un circuit décoratif derrière la page. */
export function ElectricalCircuitOverlay() {
  const overlayRef = useRef<SVGSVGElement>(null);
  const [layout, setLayout] = useState<CircuitLayout | null>(null);

  useEffect(() => {
    const overlay = overlayRef.current;
    const page = overlay?.parentElement;
    if (!overlay || !page) return;

    const updateLayout = () => {
      const pageRect = page.getBoundingClientRect();
      const width = page.clientWidth;
      const height = page.scrollHeight;
      if (!width || !height) return;

      const isMobile = width < 640;
      const isTablet = width < 1024;
      const sections = SECTION_ORDER.flatMap((id) => {
        const section = page.querySelector<HTMLElement>(
          `[data-circuit-section="${id}"]`,
        );
        if (!section) return [];
        const rect = section.getBoundingClientRect();
        return [{ id, top: rect.top - pageRect.top, height: rect.height }];
      });

      if (!sections.length) return;

      const nodes = sections.map((section, index) => {
        const x = isMobile
          ? width * 0.965
          : isTablet
            ? width * 0.95
            : width * (index % 3 === 1 ? 0.92 : 0.945);
        const y = Math.min(section.top + (isMobile ? 30 : 48), section.top + section.height / 2);
        return { x, y, progress: y / height };
      });

      const laneOffset = isMobile ? 0 : isTablet ? 14 : 22;
      const path = nodes
        .slice(0, -1)
        .map((node, index) => {
          const next = nodes[index + 1];
          const laneX = Math.min(width - 8, Math.max(node.x, next.x) + laneOffset);
          const turnY = Math.min(
            next.y - 12,
            Math.max(node.y + 18, node.y + (next.y - node.y) * 0.58),
          );
          return `M ${node.x} ${node.y} L ${laneX} ${node.y + 18} L ${laneX} ${turnY} L ${next.x} ${next.y}`;
        })
        .join(" ");

      setLayout({
        width,
        height,
        path,
        nodes,
        duration: Math.max(26, height / 105),
      });
    };

    updateLayout();
    const observer = new ResizeObserver(updateLayout);
    observer.observe(page);
    page
      .querySelectorAll<HTMLElement>("[data-circuit-section]")
      .forEach((section) => observer.observe(section));
    window.addEventListener("resize", updateLayout);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", updateLayout);
    };
  }, []);

  return (
    <svg
      ref={overlayRef}
      aria-hidden="true"
      focusable="false"
      className="electrical-circuit-overlay"
      preserveAspectRatio="none"
      viewBox={layout ? `0 0 ${layout.width} ${layout.height}` : "0 0 1 1"}
      style={
        layout
          ? ({ "--circuit-duration": `${layout.duration}s` } as CSSProperties)
          : undefined
      }
    >
      {layout && (
        <>
          <path className="electrical-circuit-base" d={layout.path} />
          <path pathLength={1} className="electrical-circuit-pulse" d={layout.path} />
          <path
            pathLength={1}
            className="electrical-circuit-pulse electrical-circuit-pulse-secondary"
            d={layout.path}
            style={{ animationDelay: `${-layout.duration * 0.46}s` }}
          />
          {layout.nodes.map((node, index) => (
            <g key={`circuit-node-${index}`}>
              {!((layout.width < 640)) && (
                <path
                  className="electrical-circuit-branch"
                  d={`M ${node.x} ${node.y + 7} h -13 v 15 h 8`}
                />
              )}
              <circle
                className="electrical-circuit-node-halo"
                cx={node.x}
                cy={node.y}
                r={layout.width < 640 ? 5 : 7}
                style={{
                  animationDelay: `${node.progress * layout.duration}s`,
                }}
              />
              <circle
                className="electrical-circuit-node"
                cx={node.x}
                cy={node.y}
                r={layout.width < 640 ? 1.7 : 2.2}
              />
            </g>
          ))}
        </>
      )}
    </svg>
  );
}
