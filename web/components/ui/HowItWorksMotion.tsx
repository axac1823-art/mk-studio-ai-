"use client";

import { useEffect } from "react";

const STEP_LABELS = ["STAGE 01 / 04", "STAGE 02 / 04", "STAGE 03 / 04", "STAGE 04 / 04"];

function setActiveStep(index: number) {
  document.querySelectorAll<HTMLElement>("[data-how-step]").forEach((el) => {
    el.dataset.active = String(Number(el.dataset.howStep) === index);
  });

  document.querySelectorAll<HTMLElement>("[data-how-rail]").forEach((el) => {
    el.dataset.active = String(Number(el.dataset.howRail) <= index);
  });

  const label = document.getElementById("how-stage-label");
  if (label) label.textContent = STEP_LABELS[index] ?? STEP_LABELS[0];
}

export default function HowItWorksMotion() {
  useEffect(() => {
    let cleanup: (() => void) | undefined;
    let cancelled = false;

    async function init() {
      const [gsapModule, scrollTriggerModule] = await Promise.all([
        import("gsap"),
        import("gsap/ScrollTrigger"),
      ]);

      const gsap = gsapModule.default;
      const { ScrollTrigger } = scrollTriggerModule;

      if (cancelled) return;

      gsap.registerPlugin(ScrollTrigger);

      const section = document.getElementById("how-it-works");
      const pin = document.getElementById("how-it-works-pin");
      const planGroup = document.getElementById("how-svg-plan");
      const extrusionGroup = document.getElementById("how-svg-extrusion");
      const scanline = document.getElementById("how-scanline");
      const finalRender = document.getElementById("how-final-render");

      if (!section || !pin || !planGroup || !extrusionGroup || !finalRender) return;

      const ctx = gsap.context(() => {
        const masterTl = gsap.timeline({
          scrollTrigger: {
            trigger: section,
            start: "top top",
            end: "+=300%",
            pin,
            scrub: 1,
            anticipatePin: 1,
            invalidateOnRefresh: true,
            onUpdate: (self) => {
              const p = self.progress;
              const nextStep = p < 0.22 ? 0 : p < 0.45 ? 1 : p < 0.6 ? 2 : 3;
              setActiveStep(nextStep);
            },
          },
        });

        masterTl.set(extrusionGroup, { opacity: 0 });
        masterTl.set(finalRender, {
          opacity: 0,
          scale: 1.05,
          filter: "blur(12px)",
        });

        masterTl.fromTo(
          planGroup,
          { opacity: 0, scale: 0.95 },
          { opacity: 1, scale: 1, duration: 0.18, ease: "power2.out" },
          0,
        );

        if (scanline) {
          masterTl.fromTo(
            scanline,
            { attr: { y1: 20, y2: 20 }, opacity: 0 },
            {
              attr: { y1: 460, y2: 460 },
              opacity: 0.7,
              duration: 0.18,
              ease: "none",
            },
            0,
          );
        }

        masterTl.to(
          planGroup,
          { opacity: 0.15, scale: 0.9, y: 30, duration: 0.17, ease: "power2.inOut" },
          0.18,
        );

        masterTl.to(
          extrusionGroup,
          { opacity: 1, duration: 0.12, ease: "power2.out" },
          0.22,
        );

        const wallVolumes = extrusionGroup.querySelectorAll(".volume-wall");
        masterTl.fromTo(
          wallVolumes,
          { opacity: 0, transformOrigin: "bottom center", scaleY: 0 },
          { opacity: 1, scaleY: 1, stagger: 0.02, duration: 0.15, ease: "back.out(1.2)" },
          0.25,
        );

        const slabs = extrusionGroup.querySelectorAll(".volume-slab");
        masterTl.fromTo(
          slabs,
          { opacity: 0, y: -20 },
          { opacity: 0.9, y: 0, stagger: 0.04, duration: 0.18, ease: "power3.out" },
          0.35,
        );

        const cantilever = extrusionGroup.querySelectorAll(".volume-cantilever");
        masterTl.fromTo(
          cantilever,
          { opacity: 0, scale: 0.8 },
          { opacity: 1, scale: 1, duration: 0.15, ease: "power2.out" },
          0.45,
        );

        const glazing = extrusionGroup.querySelectorAll(".volume-glazing");
        masterTl.fromTo(
          glazing,
          { opacity: 0, strokeDasharray: "200", strokeDashoffset: "200" },
          { opacity: 0.85, strokeDashoffset: "0", duration: 0.15, ease: "power1.inOut" },
          0.6,
        );

        masterTl.to(
          extrusionGroup,
          { opacity: 0, scale: 1.03, filter: "blur(6px)", duration: 0.15, ease: "power2.in" },
          0.78,
        );

        masterTl.to(
          finalRender,
          { opacity: 1, scale: 1, filter: "blur(0px)", duration: 0.2, ease: "power2.out" },
          0.8,
        );

        setActiveStep(0);
      }, section);

      // The canvas is dynamically mounted, so make ScrollTrigger measure
      // the final layout after React/Next has painted the section.
      requestAnimationFrame(() => ScrollTrigger.refresh());

      cleanup = () => ctx.revert();
    }

    void init();

    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, []);

  return null;
}
