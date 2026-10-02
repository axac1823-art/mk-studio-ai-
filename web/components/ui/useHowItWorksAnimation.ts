import { useEffect, type RefObject } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

interface AnimationRefs {
  sectionRef: RefObject<HTMLElement>;
  pinRef: RefObject<HTMLDivElement>;
  planRef: RefObject<SVGGElement>;
  extrusionRef: RefObject<SVGGElement>;
  scanlineRef: RefObject<SVGLineElement>;
  finalRenderRef: RefObject<HTMLDivElement>;
  stageRef: RefObject<HTMLSpanElement>;
}

function getStep(progress: number) {
  if (progress < 0.22) return 0;
  if (progress < 0.45) return 1;
  if (progress < 0.6) return 2;
  return 3;
}

function syncWorkflowUI(root: HTMLElement, step: number) {
  root.querySelectorAll<HTMLElement>("[data-workflow-step]").forEach((el, index) => {
    el.classList.toggle("is-active", index === step);
  });

  root.querySelectorAll<HTMLElement>("[data-progress-step]").forEach((el, index) => {
    el.classList.toggle("is-complete", index <= step);
  });
}

export function useHowItWorksAnimation({
  sectionRef,
  pinRef,
  planRef,
  extrusionRef,
  scanlineRef,
  finalRenderRef,
  stageRef,
}: AnimationRefs) {
  useEffect(() => {
    const section = sectionRef.current;
    const pin = pinRef.current;
    const planGroup = planRef.current;
    const extrusionGroup = extrusionRef.current;
    const scanline = scanlineRef.current;
    const finalRender = finalRenderRef.current;
    const stage = stageRef.current;

    if (!section || !pin || !planGroup || !extrusionGroup || !finalRender) {
      return;
    }

    let activeStep = -1;

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
            const nextStep = getStep(self.progress);

            if (nextStep === activeStep) return;

            activeStep = nextStep;
            syncWorkflowUI(section, nextStep);

            if (stage) {
              stage.textContent = `STAGE 0${nextStep + 1} / 04`;
            }
          },
        },
      });

      // Initial state.
      masterTl.set(extrusionGroup, {
        opacity: 0,
        filter: "none",
      });

      masterTl.set(finalRender, {
        opacity: 0,
        scale: 1.05,
        filter: "none",
      });

      // PHASE 01.
      masterTl.fromTo(
        planGroup,
        { opacity: 0, scale: 0.95 },
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
            attr: { y1: 20, y2: 20 },
            opacity: 0,
          },
          {
            attr: { y1: 460, y2: 460 },
            opacity: 0.7,
            duration: 0.18,
            ease: "none",
          },
          0,
        );
      }

      // PHASE 02.
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

      const wallVolumes = extrusionGroup.querySelectorAll(".volume-wall");

      masterTl.fromTo(
        wallVolumes,
        {
          opacity: 0,
          transformOrigin: "bottom center",
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

      // PHASE 03.
      const slabs = extrusionGroup.querySelectorAll(".volume-slab");

      masterTl.fromTo(
        slabs,
        { opacity: 0, y: -20 },
        {
          opacity: 0.9,
          y: 0,
          stagger: 0.04,
          duration: 0.18,
          ease: "power3.out",
        },
        0.35,
      );

      const cantilever = extrusionGroup.querySelectorAll(".volume-cantilever");

      masterTl.fromTo(
        cantilever,
        { opacity: 0, scale: 0.8 },
        {
          opacity: 1,
          scale: 1,
          duration: 0.15,
          ease: "power2.out",
        },
        0.45,
      );

      // PHASE 04.
      const glazing = extrusionGroup.querySelectorAll(".volume-glazing");

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

      // PHASE 05.
      // Keep the visual transition, but avoid animating blur filters.
      masterTl.to(
        extrusionGroup,
        {
          opacity: 0,
          scale: 1.03,
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
          duration: 0.2,
          ease: "power2.out",
        },
        0.8,
      );

      // Set the initial UI state without React state updates.
      syncWorkflowUI(section, 0);
      if (stage) stage.textContent = "STAGE 01 / 04";
      activeStep = 0;
    }, section);

    return () => ctx.revert();
  }, [
    sectionRef,
    pinRef,
    planRef,
    extrusionRef,
    scanlineRef,
    finalRenderRef,
    stageRef,
  ]);
}
