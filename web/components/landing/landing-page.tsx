"use client";
import HomePage from "@/components/ui/Hero";
import { Suspense, useCallback, type ReactNode } from "react";
import Link from "next/link";
import HowItWorks from "@/components/ui/how_work";
import { ToolsArena } from "@/components/ui/tools-arena";
import HeroVisualAI from "@/components/ui/HeroVisualAI";
import { useRouter, useSearchParams } from "next/navigation";
import IndustriesShowcase from "@/components/ui/industries-showcase-section";
import UseCasesShowcase from "@/components/ui/use-cases-showcase";
import AIShowcase from "@/components/ui/ai-showcase";
import { Button } from "@/components/ui/button";
import { LoginModal } from "@/components/auth/login-modal";
import { RenderuimLogo } from "@/components/icons/renderuim";
import { ThemeToggle } from "@/components/theme-toggle";
import { ElectricalCircuitOverlay } from "@/components/ui/electrical-circuit-overlay";
import { motion } from "framer-motion";
interface LandingPageProps {
  login?: boolean;
}

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

function FooterLink({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className="text-sm text-black/55 transition-colors hover:text-black dark:text-white/50 dark:hover:text-white"
    >
      {children}
    </Link>
  );
}

function FooterExternalLink({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="text-sm text-black/55 transition-colors hover:text-black dark:text-white/50 dark:hover:text-white"
    >
      {children}
    </a>
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

  return (
    <>
      <div className="relative min-h-screen w-full overflow-hidden bg-background">
        <ElectricalCircuitOverlay />
        <div className="relative">
        <div className="pointer-events-none absolute -left-20 top-0 h-[500px] w-[500px] rounded-full bg-primary/10 opacity-40 blur-[120px]" />
        <div className="pointer-events-none absolute right-0 top-0 h-[400px] w-[400px] rounded-full bg-blue-500/10 opacity-30 blur-[100px]" />

        <header className="sticky top-0 z-40 w-full border-b border-border bg-background/80 backdrop-blur-md">
          <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
            <Link href="/" className="flex items-center gap-2 text-foreground">
              <RenderuimLogo showWordmark />
            </Link>
            <nav className="hidden items-center gap-8 text-sm font-medium text-muted-foreground md:flex">
              <Link href="#tools" className="hover:text-foreground transition-colors">
                Tools
              </Link>
              <Link href="#how-it-works" className="hover:text-foreground transition-colors">
                How it works
              </Link>
              <Link href="#use-cases" className="hover:text-foreground transition-colors">
                Use cases
              </Link>
              <Link href="#models" className="hover:text-foreground transition-colors">
                Models
              </Link>
              <Link href="/pricing" className="hover:text-foreground transition-colors">
                Pricing
              </Link>
            </nav>
            <div className="flex items-center gap-2">
              <ThemeToggle />
              <Button variant="ghost" onClick={openLogin}>
                Log in
              </Button>
              <Button onClick={openLogin}>Sign up</Button>
            </div>
          </div>
        </header>

        {/* <section className="relative mx-auto max-w-7xl px-4 pb-16 pt-12 sm:px-6 sm:pt-16 lg:pt-24">
          <div className="grid items-center gap-12 lg:grid-cols-2">
            <div className="space-y-8">
              <Badge variant="outline" className="gap-1.5 px-3 py-1.5">
                <Sparkles className="h-3.5 w-3.5 text-primary" />
                AI for architecture & real estate
              </Badge>
              <h1 className="text-4xl font-bold leading-tight tracking-tight text-foreground sm:text-5xl lg:text-6xl">
                From screenshot to stunning visual in seconds
              </h1>
              <p className="max-w-lg text-lg text-muted-foreground">
                Renderuim turns rough 3D viewport captures into photorealistic renders, cinematic
                videos, and voiceovers — built for architects, archviz artists, and real estate
                pros.
              </p>
              <div className="flex flex-wrap items-center gap-4">
                <Button size="lg" onClick={openLogin}>
                  Get started free
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
                <Button size="lg" variant="outline" onClick={openLogin}>
                  Log in
                </Button>
              </div>
              <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <Check className="h-4 w-4 text-primary" />
                  No credit card required
                </span>
                <span className="flex items-center gap-1.5">
                  <Check className="h-4 w-4 text-primary" />
                  Works with SketchUp, Revit, 3ds Max
                </span>
              </div>
            </div>

            <div className="relative">
              <Card className="relative aspect-[4/3] overflow-hidden border-border shadow-2xl">
                <img
                  src={HERO_IMAGE}
                  alt="AI architectural render"
                  className="h-full w-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-transparent to-transparent" />
                <CardContent className="absolute bottom-6 left-6 right-6 p-0">
                  <Card className="border-border bg-card/90 p-4 backdrop-blur-md">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <Wand2 className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-foreground">Screenshot-to-Render</p>
                        <p className="text-xs text-muted-foreground">
                          Generated in seconds from a SketchUp capture
                        </p>
                      </div>
                    </div>
                  </Card>
                </CardContent>
              </Card>
              <Card className="absolute -bottom-6 -right-6 hidden aspect-square w-48 overflow-hidden border-border shadow-xl lg:block p-0">
                <img
                  src={HERO_AFTER_IMAGE}
                  alt="Photorealistic render result"
                  className="h-full w-full object-cover"
                />
              </Card>
            </div>
          </div>
        </section> */}
        {/* Hero section */}
        <HomePage  />
{/* 
        <section className="border-y border-border bg-card/50">
          <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
            <div className="grid gap-8 md:grid-cols-3">
              <div className="text-center">
                <p className="text-3xl font-bold text-foreground">10+</p>
                <p className="text-sm text-muted-foreground">AI models under one roof</p>
              </div>
              <div className="text-center">
                <p className="text-3xl font-bold text-foreground">Image, Video & Voice</p>
                <p className="text-sm text-muted-foreground">Everything you need to present spaces</p>
              </div>
              <div className="text-center">
                <p className="text-3xl font-bold text-foreground">Architect-first</p>
                <p className="text-sm text-muted-foreground">Built for professional workflows</p>
              </div>
            </div>
          </div>
        </section> */}
<AIShowcase />
<HowItWorks />
<HeroVisualAI />

{/*  */}


{/* 
        <section id="tools" className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
          <div className="mb-10 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-3xl font-bold tracking-tight text-foreground">Popular Tools</h2>
              <p className="mt-2 text-muted-foreground">
                Every tool you need to visualize spaces faster.
              </p>
            </div>
            <Link
              href="#all-tools"
              className="text-sm font-medium text-primary hover:text-foreground"
            >
              See all categories →
            </Link>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {TOOLS.slice(0, 6).map((tool) => {
              const Icon = tool.icon;
              return (
                <ToolCard
                  key={tool.id}
                  icon={<Icon className="h-5 w-5" />}
                  title={tool.name}
                  description={tool.description}
                  tag={tool.category}
                  onClick={openLogin}
                />
              );
            })}
          </div>

          <div id="all-tools" className="mt-12 grid gap-6 md:grid-cols-3">
            {CATEGORIES.map((cat) => {
              const Icon = cat.icon;
              return (
                <Card key={cat.id} className="border-border transition-colors hover:border-primary/30">
                  <CardHeader>
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <Icon className="h-6 w-6" />
                    </div>
                    <CardTitle className="pt-2">{cat.label}</CardTitle>
                    <CardDescription>{cat.description}</CardDescription>
                  </CardHeader>
                </Card>
              );
            })}
          </div>
        </section> */}
<ToolsArena onToolClick={openLogin} />

        {/* <section id="use-cases" className="border-y border-border bg-card/50">
          <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
            <div className="text-center">
              <h2 className="text-3xl font-bold tracking-tight text-foreground">
                Built for your workflow
              </h2>
              <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
                Renderuim fits how architects, agents, and designers actually work.
              </p>
            </div>
            <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {USE_CASES.map((useCase) => (
                <Card key={useCase.title} className="border-border">
                  <CardHeader>
                    <Badge variant="secondary">{useCase.stat}</Badge>
                    <CardTitle className="pt-2">{useCase.title}</CardTitle>
                    <CardDescription>{useCase.description}</CardDescription>
                  </CardHeader>
                </Card>
              ))}
            </div>
          </div>
        </section> */}










<UseCasesShowcase />





















































<IndustriesShowcase openLogin={openLogin} />
{/* 
        <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
          <Card className="overflow-hidden border-border bg-card p-0 lg:grid lg:grid-cols-2 lg:items-center">
            <CardHeader className="p-8 lg:p-12">
              <Badge variant="outline" className="w-fit gap-1.5 px-3 py-1.5">
                <Play className="h-3.5 w-3.5 text-primary" />
                See it in action
              </Badge>
              <CardTitle className="pt-4 text-3xl">One capture, endless outputs</CardTitle>
              <CardDescription className="text-base">
                Upload a single viewport screenshot and generate photorealistic renders, alternate
                angles, mood variations, presentation videos, and voiceovers — all from the same
                starting point.
              </CardDescription>
              <ul className="space-y-3 pt-4">
                {[
                  "Preserve geometry and camera angle",
                  "Switch between day, night, and seasons",
                  "Create 4–8 second cinematic videos",
                  "Add professional voiceover automatically",
                ].map((item) => (
                  <li key={item} className="flex items-center gap-2 text-sm text-foreground">
                    <Check className="h-4 w-4 text-primary" />
                    {item}
                  </li>
                ))}
              </ul>
              <Button size="lg" className="mt-8 w-fit p-4" onClick={openLogin}>
                Start creating free
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent className="relative aspect-video p-0 lg:aspect-auto lg:h-full">
              <img
                src={HERO_AFTER_IMAGE}
                alt="Example output"
                className="h-full w-full object-cover"
              />
              <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white/90 text-foreground shadow-lg">
                  <Play className="h-5 w-5 fill-current" />
                </div>
              </div>
            </CardContent>
          </Card>
        </section> */}




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
      boxShadow:
        "0 0 16px hsla(189.16,79.17%,47.06%,0.45)",
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
          AI rendering for architecture and real estate.
          From screenshot to stunning visual in seconds.
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
                backgroundColor:
                  "hsl(189.16deg 79.17% 47.06%)",
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
                backgroundColor:
                  "hsl(189.16deg 79.17% 47.06%)",
                boxShadow:
                  "0 0 10px hsla(189.16,79.17%,47.06%,0.65)",
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
          <FooterLink href="#tools">
            Tools
          </FooterLink>

          <FooterLink href="#models">
            Models
          </FooterLink>

          <FooterLink href="/pricing">
            Pricing
          </FooterLink>
        </FooterColumn>

        {/* Resources */}

        <FooterColumn title="Resources">
          <FooterLink href="/?login=true">
            Log in
          </FooterLink>

          <FooterLink href="/pricing">
            Sign up
          </FooterLink>
        </FooterColumn>

        {/* Legal */}

        <FooterColumn title="Legal">
          <FooterExternalLink href="https://policies.google.com/terms">
            Terms
          </FooterExternalLink>

          <FooterExternalLink href="https://policies.google.com/privacy">
            Privacy
          </FooterExternalLink>
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

      <motion.div
        aria-hidden="true"
        animate={{
          x: ["-20%", "120%"],
          opacity: [0, 1, 0],
        }}
        transition={{
          duration: 3.8,
          repeat: Infinity,
          ease: "linear",
        }}
        className="
          absolute
          left-0
          top-0
          h-px
          w-24
        "
        style={{
          background:
            "linear-gradient(90deg, transparent, hsl(189.16deg 79.17% 47.06%), transparent)",
          boxShadow:
            "0 0 14px hsla(189.16,79.17%,47.06%,0.6)",
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
          © {new Date().getFullYear()} Renderuim.
          All rights reserved.
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
              color:
                "hsl(189.16deg 79.17% 47.06%)",
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

      {showLogin && <LoginModal onClose={() => router.push("/", { scroll: false })} />}
    </>
  );
}

