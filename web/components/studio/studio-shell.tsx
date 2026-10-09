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
    <main className="mx-auto flex min-h-[calc(100vh-3.5rem)] w-full max-w-[1600px] flex-col px-4 py-5 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-4 border-b pb-4 sm:flex-row sm:items-center sm:justify-between">
        {header}
      </div>
      <div className="grid flex-1 items-start gap-5 py-5 lg:grid-cols-[minmax(340px,400px)_minmax(0,1fr)] xl:gap-6">
        <section aria-label="Workspace controls" className="min-w-0 lg:sticky lg:top-[4.5rem] lg:max-h-[calc(100vh-5.5rem)] lg:overflow-y-auto lg:overscroll-contain">
          {panel}
        </section>
        <div className="flex min-w-0 flex-col gap-5">
          <section aria-label="Preview stage" className="min-w-0">{stage}</section>
          {history && <section aria-label="History" className="min-w-0">{history}</section>}
        </div>
      </div>
      {bar && (
        <div className="sticky bottom-0 z-30 -mx-4 border-t bg-background/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
          {bar}
        </div>
      )}
    </main>
  );
}
