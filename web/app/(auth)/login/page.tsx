import { Suspense } from "react";

import { AuthForm } from "./auth-form";
import { AuthShowcasePanel } from "./auth-showcase-panel";

export default function LoginPage() {
  return (
    <>
      <AuthShowcasePanel />
      <main className="flex w-full flex-col items-center justify-center p-6 md:w-[55%]">
        <Suspense
          fallback={
            <div className="w-full max-w-sm space-y-6 text-center">
              <div className="h-10 w-10 animate-pulse rounded-md bg-muted" />
              <h1 className="text-2xl font-semibold tracking-tight">Welcome to RenderStudio</h1>
              <p className="text-sm text-muted-foreground">Loading…</p>
            </div>
          }
        >
          <AuthForm />
        </Suspense>
      </main>
    </>
  );
}
