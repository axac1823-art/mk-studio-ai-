"use client";

import { useState } from "react";

export function HeroVideoButton() {
  const [videoOpen, setVideoOpen] = useState(false);

  return (
    <>
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
        <span style={{ color: "hsl(189.16deg 79.17% 47.06%)" }}>
          &#9654;
        </span>
        Why Magnific?
      </button>

      {videoOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-5 backdrop-blur-sm"
          onClick={() => setVideoOpen(false)}
        >
          <div
            className="relative w-full max-w-4xl overflow-hidden rounded-2xl border border-white/10 bg-black shadow-[0_30px_100px_rgba(0,0,0,.55)]"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setVideoOpen(false)}
              className="absolute right-4 top-4 z-10 rounded-full border border-white/10 bg-black/40 px-4 py-2 text-white backdrop-blur transition hover:bg-black/65"
            >
              &#10005;
            </button>
            <div className="aspect-video">
              <video className="h-full w-full object-cover" controls autoPlay>
                <source src="/videos/magnific.mp4" type="video/mp4" />
              </video>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
