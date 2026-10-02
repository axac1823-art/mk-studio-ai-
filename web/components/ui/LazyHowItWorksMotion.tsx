"use client";

import { useEffect, useState, type ComponentType } from "react";

/**
 * Tiny client island. The actual GSAP/ScrollTrigger code is not downloaded
 * until this section is close to the viewport.
 */
export default function LazyHowItWorksMotion() {
  const [Motion, setMotion] = useState<ComponentType | null>(null);

  useEffect(() => {
    const section = document.getElementById("how-it-works");
    if (!section) return;

    let cancelled = false;

    const load = async () => {
      const motionModule = await import("./HowItWorksMotion");
      if (!cancelled) setMotion(() => motionModule.default);
    };

    if ("IntersectionObserver" in window) {
      const observer = new IntersectionObserver(
        ([entry]) => {
          if (!entry.isIntersecting) return;
          observer.disconnect();
          void load();
        },
        { rootMargin: "200px 0px" },
      );

      observer.observe(section);

      return () => {
        cancelled = true;
        observer.disconnect();
      };
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, []);

  return Motion ? <Motion /> : null;
}