import type { ReactNode } from "react";

interface StudioShellProps {
  header: ReactNode;
  panel: ReactNode;
  stage: ReactNode;
  history?: ReactNode;
  bar?: ReactNode;
}

export function StudioShell({ header, panel, stage, history, bar }: StudioShellProps) {
  return (
    <main className="mx-auto flex min-h-[calc(100vh-3.5rem)] w-full max-w-[1680px] flex-col px-4 pb-8 pt-4 sm:px-6 lg:px-8">
      <div className="border-b border-border/70 pb-5">{header}</div>

      <div className="grid flex-1 items-start gap-6 py-6 lg:grid-cols-[minmax(320px,350px)_minmax(0,1fr)] xl:gap-8">
        <section
          aria-label="Workspace controls"
          className="min-w-0 lg:sticky lg:top-[5rem] lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto lg:overscroll-contain lg:pr-1"
        >
          {panel}
        </section>

        <div className="flex min-w-0 flex-col gap-6">
          <section aria-label="Preview stage" className="min-w-0">
            {stage}
          </section>
          {history && (
            <section aria-label="History" className="min-w-0">
              {history}
            </section>
          )}
        </div>
      </div>

      {bar && (
        <div className="sticky bottom-0 z-30 -mx-4 border-t border-border/70 bg-background/95 px-4 py-3 shadow-[0_-8px_24px_rgba(0,0,0,0.04)] backdrop-blur-xl sm:-mx-6 sm:px-6">
          {bar}
        </div>
      )}
    </main>
  );
}
