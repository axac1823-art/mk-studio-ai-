"use client";

import { Suspense } from "react";
import { Image2Workspace } from "@/components/studio/image2-workspace";

export default function Image2Page() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-[70vh] items-center justify-center bg-[#17181c] p-6 text-[#eeeef2]">
          <p className="text-sm text-[#9699a4]">Loading Image Generator…</p>
        </main>
      }
    >
      <Image2Workspace />
    </Suspense>
  );
}
