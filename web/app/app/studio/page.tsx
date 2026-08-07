"use client";

// Route legacy /app/studio : pré-sélectionne l'onglet via ?tab=... et affiche
// la barre d'onglets. Les nouvelles pages d'outils utilisent directement
// ImageStudioWorkspace sans tabs.
import { Suspense, useMemo } from "react";
import { useSearchParams } from "next/navigation";

import { ImageStudioWorkspace } from "@/components/studio/image-studio-workspace";
import { STUDIO_TABS, type StudioTab } from "@/lib/features";

function resolveInitialTab(param: string | null): StudioTab {
  if (!param) return "print_render";
  return STUDIO_TABS.some((tab) => tab.id === param) ? (param as StudioTab) : "print_render";
}

function StudioWithParams() {
  const searchParams = useSearchParams();
  const initialTab = useMemo(() => resolveInitialTab(searchParams.get("tab")), [searchParams]);
  return <ImageStudioWorkspace feature={initialTab} showTabs />;
}

export default function StudioPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen w-full items-center justify-center p-4">
          <p className="text-sm text-muted-foreground">Loading studio…</p>
        </main>
      }
    >
      <StudioWithParams />
    </Suspense>
  );
}
