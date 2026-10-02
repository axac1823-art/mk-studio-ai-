"use client";

import HomePage from "@/components/ui/Hero";
import {
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ComponentType,
  type ReactNode,
} from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { RenderuimLogo } from "@/components/icons/renderuim";
import { ThemeToggle } from "@/components/theme-toggle";
import { ElectricalCircuitOverlay } from "@/components/ui/electrical-circuit-overlay";

















const LoginModal = dynamic(() =>
  import("@/components/auth/login-modal").then((mod) => mod.LoginModal)
);
interface LandingPageProps {
  login?: boolean;
}
type LazyLoader<TProps extends object> = () => Promise<ComponentType<TProps>>;

function LazyViewportSection<TProps extends object>({
  id,
  loader,
  props,
  rootMargin = "150px 0px",
  className = "relative min-h-screen",
}: {
  id?: string;
  loader: LazyLoader<TProps>;
  props: TProps;
  rootMargin?: string;
  className?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [LoadedComponent, setLoadedComponent] =
    useState<ComponentType<TProps> | null>(null);

  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;

    let cancelled = false;

    const load = async () => {
      const Component = await loader();

      if (!cancelled) {
        setLoadedComponent(() => Component);
      }
    };

    const isMobile = window.matchMedia("(max-width: 1023px)").matches;

    // Desktop: keep the current behavior.
    if (!isMobile || !("IntersectionObserver" in window)) {
      void load();

      return () => {
        cancelled = true;
      };
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          observer.disconnect();
          void load();
        }
      },
      {
        rootMargin,
      }
    );

    observer.observe(node);

    return () => {
      cancelled = true;
      observer.disconnect();
    };
  }, [loader, rootMargin]);

  return (
    <div ref={containerRef} id={id} className={className}>
      {LoadedComponent ? <LoadedComponent {...props} /> : null}
    </div>
  );
}
const loadAIShowcase = () =>
  import("@/components/ui/ai-showcase").then((mod) => mod.default);

const loadToolsArena = () =>
  import("@/components/ui/tools-arena").then((mod) => mod.ToolsArena);

const loadUseCasesShowcase = () =>
  import("@/components/ui/use-cases-showcase").then((mod) => mod.default);

const loadIndustriesShowcase = () =>
  import("@/components/ui/industries-showcase-section").then(
    (mod) => mod.default
  );
function FooterColumn({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col items-start gap-3">
      <h2 className="mb-1 font-mono text-[9px] font-semibold uppercase tracking-[0.2em] text-black/45 dark:text-white/40">
        {title}
      </h2>
      {children}
    </div>
  );
}
function LazyHowItWorks() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [HowItWorksComponent, setHowItWorksComponent] =
    useState<ComponentType | null>(null);

  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;

    let cancelled = false;

    const load = async () => {
      const mod = await import("@/components/ui/HowItWorks");

      if (!cancelled) {
        setHowItWorksComponent(() => mod.default);
      }
    };

    // Keep desktop behavior immediate.
    const isMobile = window.matchMedia("(max-width: 1023px)").matches;

    if (!isMobile || !("IntersectionObserver" in window)) {
      void load();

      return () => {
        cancelled = true;
      };
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          observer.disconnect();
          void load();
        }
      },
      {
        rootMargin: "600px 0px",
      }
    );

    observer.observe(node);

    return () => {
      cancelled = true;
      observer.disconnect();
    };
  }, []);

  return (
    <div
      ref={containerRef}
      id="how-it-works"
      className="relative min-h-[400vh]"
    >
      {HowItWorksComponent ? <HowItWorksComponent /> : null}
    </div>
  );
}
function FooterLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="text-sm text-black/55 transition-colors hover:text-black dark:text-white/50 dark:hover:text-white"
    >
      {children}
    </Link>
  );
}

export function LandingPage({ login = false }: LandingPageProps) {
  return (
    <Suspense fallback={<LandingSkeleton />}>
      <LandingContent initialLogin={login} />
    </Suspense>
  );
}

function LandingSkeleton() {
  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-background">
      <RenderuimLogo showWordmark />
    </div>
  );
}

function LandingContent({ initialLogin }: { initialLogin: boolean }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const showLogin = searchParams.get("login") === "true" || initialLogin;

  const openLogin = useCallback(() => {
    router.push("/?login=true", { scroll: false });
  }, [router]);

  const openSignup = useCallback(() => {
    router.push("/?login=true&mode=signup", { scroll: false });
  }, [router]);

  return (
    <>
      <div className="relative min-h-screen w-full overflow-hidden bg-background">
        <ElectricalCircuitOverlay />
        <div className="relative">
          <div className="pointer-events-none absolute -left-20 top-0 h-[500px] w-[500px] rounded-full bg-primary/10 opacity-40 blur-[120px]" />
          <div className="pointer-events-none absolute right-0 top-0 h-[400px] w-[400px] rounded-full bg-blue-500/10 opacity-30 blur-[100px]" />

          <header className="sticky top-0 z-40 w-full border-b border-border bg-background/80 backdrop-blur-md">
            <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
              <Link
                href="/"
                className="flex items-center gap-2 text-foreground"
              >
                <RenderuimLogo showWordmark />
              </Link>
              <nav className="hidden items-center gap-8 text-sm font-medium text-muted-foreground md:flex">
                <Link
                  href="#tools"
                  className="hover:text-foreground transition-colors"
                >
                  Tools
                </Link>
                <Link
                  href="#how-it-works"
                  className="hover:text-foreground transition-colors"
                >
                  How it works
                </Link>
                <Link
                  href="#use-cases"
                  className="hover:text-foreground transition-colors"
                >
                  Use cases
                </Link>
                <Link
                  href="#models"
                  className="hover:text-foreground transition-colors"
                >
                  Models
                </Link>
                <Link
                  href="/pricing"
                  className="hover:text-foreground transition-colors"
                >
                  Pricing
                </Link>
              </nav>
              <div className="flex items-center gap-2">
                <ThemeToggle />
                <Button variant="ghost" onClick={openLogin}>
                  Log in
                </Button>
                <Button onClick={openSignup}>Sign up</Button>
              </div>
            </div>
          </header>

          {/* Hero section */}
          <HomePage />

          <LazyViewportSection
            loader={loadAIShowcase}
            props={{}}
            className="relative min-h-screen"
          />

          <LazyHowItWorks />

          <LazyViewportSection
            id="tools"
            loader={loadToolsArena}
            props={{ onToolClick: openLogin }}
            className="relative min-h-screen"
          />

          <LazyViewportSection
            loader={loadUseCasesShowcase}
            props={{}}
            className="relative min-h-screen"
          />

          <LazyViewportSection
            loader={loadIndustriesShowcase}
            props={{ openLogin }}
            className="relative min-h-screen"
          />
          <footer
            id="footer"
            data-circuit-section="footer"
            className="
    relative
    overflow-hidden
    border-t
    border-black/[0.08]
    bg-white
    text-black

    dark:border-white/[0.07]
    dark:bg-[#050608]
    dark:text-white
  "
          >
            {/* =========================================================
      ATMOSPHERIC BACKGROUND
  ========================================================== */}

            <div className="pointer-events-none absolute inset-0 overflow-hidden">
              {/* Main blue glow */}

              <div
                className="
        absolute
        left-1/2
        top-[-180px]
        h-[460px]
        w-[800px]
        -translate-x-1/2
        rounded-full
        blur-[120px]
      "
                style={{
                  background:
                    "radial-gradient(circle, hsla(189.16,79.17%,47.06%,0.10) 0%, hsla(189.16,79.17%,47.06%,0.035) 42%, transparent 72%)",
                }}
              />

              {/* Architectural grid */}

              <div
                className="
        absolute
        inset-0
        dark:hidden
      "
                style={{
                  opacity: 0.26,
                  backgroundImage: `
          linear-gradient(
            hsla(189.16,79.17%,47.06%,0.16) 1px,
            transparent 1px
          ),
          linear-gradient(
            90deg,
            hsla(189.16,79.17%,47.06%,0.16) 1px,
            transparent 1px
          )
        `,
                  backgroundSize: "64px 64px",
                }}
              />

              <div
                className="
        absolute
        inset-0
        hidden
        dark:block
      "
                style={{
                  opacity: 0.16,
                  backgroundImage: `
          linear-gradient(
            hsla(189.16,79.17%,47.06%,0.20) 1px,
            transparent 1px
          ),
          linear-gradient(
            90deg,
            hsla(189.16,79.17%,47.06%,0.20) 1px,
            transparent 1px
          )
        `,
                  backgroundSize: "64px 64px",
                }}
              />
            </div>

            {/* =========================================================
      TOP ELECTRICAL LINE
  ========================================================== */}

            <div
              aria-hidden="true"
              className="
      absolute
      left-0
      right-0
      top-0
      h-px
      bg-gradient-to-r
      from-transparent
      via-black/10
      to-transparent
      dark:via-white/10
    "
            />

            <div
              aria-hidden="true"
              className="
      absolute
      left-1/2
      top-0
      h-px
      w-32
      -translate-x-1/2
    "
              style={{
                background:
                  "linear-gradient(90deg, transparent, hsl(189.16deg 79.17% 47.06%), transparent)",
                boxShadow: "0 0 16px hsla(189.16,79.17%,47.06%,0.45)",
              }}
            />

            {/* =========================================================
      MAIN CONTENT
  ========================================================== */}

            <div className="relative mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:py-16">
              <div className="grid gap-12 lg:grid-cols-[1.4fr_1fr] lg:gap-20">
                {/* =====================================================
          BRAND COLUMN
      ====================================================== */}

                <div className="max-w-xl">
                  <div className="flex items-center gap-3">
                    <RenderuimLogo showWordmark />

                    <span
                      className="
              hidden
              rounded-full
              border
              border-black/[0.08]
              bg-black/[0.02]
              px-2.5
              py-1
              font-mono
              text-[7px]
              uppercase
              tracking-[0.22em]
              text-black/40

              dark:border-white/[0.08]
              dark:bg-white/[0.025]
              dark:text-white/35

              sm:inline-flex
            "
                    >
                      AI / ARCHITECTURE
                    </span>
                  </div>

                  <p
                    className="
            mt-5
            max-w-md
            text-sm
            leading-7
            text-black/50
            dark:text-white/45
          "
                  >
                    AI rendering for architecture and real estate. From
                    screenshot to stunning visual in seconds.
                  </p>

                  {/* System indicator */}

                  <div className="mt-7 flex items-center gap-3">
                    <span className="relative flex h-2 w-2">
                      <span
                        className="
                absolute
                inline-flex
                h-full
                w-full
                animate-ping
                rounded-full
                opacity-40
              "
                        style={{
                          backgroundColor: "hsl(189.16deg 79.17% 47.06%)",
                        }}
                      />

                      <span
                        className="
                relative
                inline-flex
                h-2
                w-2
                rounded-full
              "
                        style={{
                          backgroundColor: "hsl(189.16deg 79.17% 47.06%)",
                          boxShadow: "0 0 10px hsla(189.16,79.17%,47.06%,0.65)",
                        }}
                      />
                    </span>

                    <span
                      className="
              font-mono
              text-[8px]
              uppercase
              tracking-[0.26em]
              text-black/35
              dark:text-white/30
            "
                    >
                      Renderuim system online
                    </span>
                  </div>
                </div>

                {/* =====================================================
          NAVIGATION
      ====================================================== */}

                <div className="grid grid-cols-2 gap-10 sm:grid-cols-3">
                  {/* Product */}

                  <FooterColumn title="Product">
                    <FooterLink href="#tools">Tools</FooterLink>

                    <FooterLink href="#models">Models</FooterLink>

                    <FooterLink href="/pricing">Pricing</FooterLink>
                  </FooterColumn>

                  {/* Resources */}

                  <FooterColumn title="Resources">
                    <FooterLink href="/login">Log in</FooterLink>

                    <FooterLink href="/signup">Sign up</FooterLink>
                  </FooterColumn>

                  {/* Legal */}

                  <FooterColumn title="Legal">
                    <FooterLink href="/terms">Terms of Service</FooterLink>

                    <FooterLink href="/privacy">Privacy Policy</FooterLink>
                  </FooterColumn>
                </div>
              </div>

              {/* =========================================================
        LOWER SYSTEM BAR
    ========================================================== */}

              <div className="relative mt-12">
                <div
                  aria-hidden="true"
                  className="
          h-px
          w-full
          bg-black/[0.08]
          dark:bg-white/[0.08]
        "
                />

                {/* Moving electrical pulse */}

                <div
                  aria-hidden="true"
                  className="
          absolute
          left-0
          top-0
          h-px
          w-24
          animate-footer-line-pulse
        "
                  style={{
                    background:
                      "linear-gradient(90deg, transparent, hsl(189.16deg 79.17% 47.06%), transparent)",
                    boxShadow: "0 0 14px hsla(189.16,79.17%,47.06%,0.6)",
                  }}
                />

                <div
                  className="
          flex
          flex-col
          gap-5
          pt-5

          sm:flex-row
          sm:items-center
          sm:justify-between
        "
                >
                  {/* Copyright */}

                  <p
                    className="
            text-xs
            text-black/35
            dark:text-white/30
          "
                  >
                    © {new Date().getFullYear()} Renderuim. All rights reserved.
                  </p>

                  {/* Status */}

                  <div className="flex items-center gap-4">
                    <span
                      className="
              font-mono
              text-[8px]
              uppercase
              tracking-[0.22em]
              text-black/30
              dark:text-white/25
            "
                    >
                      AI Infrastructure
                    </span>

                    <span className="h-1 w-1 rounded-full bg-black/20 dark:bg-white/20" />

                    <span
                      className="
              font-mono
              text-[8px]
              uppercase
              tracking-[0.22em]
            "
                      style={{
                        color: "hsl(189.16deg 79.17% 47.06%)",
                      }}
                    >
                      Operational
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </footer>
        </div>
      </div>

      {showLogin && (
        <LoginModal
          initialMode={
            searchParams.get("mode") === "signup" ? "signup" : "login"
          }
          onClose={() => router.push("/", { scroll: false })}
        />
      )}
    </>
  );
}
