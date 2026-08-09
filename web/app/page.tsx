"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowRight,
  Check,
  Image,
  Layers,
  Mic,
  Play,
  Sparkles,
  Video,
  Wand2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { LoginModal } from "@/components/auth/login-modal";
import { RenderuimLogo } from "@/components/icons/renderuim";
import { ThemeToggle } from "@/components/theme-toggle";
import { TOOLS } from "@/config/tools";
import { cn } from "@/lib/utils";

const HERO_IMAGE =
  "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=1600&q=80";
const HERO_AFTER_IMAGE =
  "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1600&q=80";

const CATEGORIES = [
  { id: "image", label: "Image", description: "Renders, mood, floor plans, upscaling", icon: Image },
  { id: "video", label: "Video", description: "Generations, upscaling, editing", icon: Video },
  { id: "audio", label: "Audio", description: "Voiceovers and narration", icon: Mic },
];

const STEPS = [
  {
    step: "01",
    title: "Upload your viewport",
    description: "Drop a screenshot from SketchUp, Revit, 3ds Max, or any 3D software.",
  },
  {
    step: "02",
    title: "Pick a style",
    description: "Choose scene type, materials, lighting, and output resolution.",
  },
  {
    step: "03",
    title: "Get your visual",
    description: "Download a photorealistic render, video, or voiceover in seconds.",
  },
];

const USE_CASES = [
  {
    title: "Architects",
    description: "Turn early massing studies into polished visuals for client reviews.",
    stat: "10x faster",
  },
  {
    title: "Real estate agents",
    description: "Create listing-ready renders and walkthrough videos without a photographer.",
    stat: "No shoot day",
  },
  {
    title: "Interior designers",
    description: "Generate mood variations, furnished plans, and material options instantly.",
    stat: "Unlimited options",
  },
  {
    title: "Archviz studios",
    description: "Produce multi-angle shots and short films from a single camera view.",
    stat: "3+ angles",
  },
];

const MODELS = [
  { name: "Flux Kontext", tag: "Image", color: "bg-blue-500/10 text-blue-600" },
  { name: "Gemini Nano", tag: "Image", color: "bg-blue-500/10 text-blue-600" },
  { name: "Kling v3", tag: "Video", color: "bg-purple-500/10 text-purple-600" },
  { name: "Runway Gen-4", tag: "Video", color: "bg-purple-500/10 text-purple-600" },
  { name: "Sora 2", tag: "Video", color: "bg-purple-500/10 text-purple-600" },
  { name: "ElevenLabs", tag: "Voice", color: "bg-emerald-500/10 text-emerald-600" },
];

export default function LandingPage() {
  return (
    <Suspense fallback={<LandingSkeleton />}>
      <LandingContent />
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

function LandingContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);

  const showLogin = searchParams.get("login") === "true";

  useEffect(() => {
    const hasSessionCookie = document.cookie.includes("sb-");
    setIsLoggedIn(hasSessionCookie);
  }, []);

  function openLogin() {
    router.push("/?login=true", { scroll: false });
  }

  function closeLogin() {
    router.push("/", { scroll: false });
  }

  return (
    <>
      <div className="relative min-h-screen w-full overflow-hidden bg-background">
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
              {isLoggedIn ? (
                <Button asChild>
                  <Link href="/app/dashboard">Dashboard</Link>
                </Button>
              ) : (
                <>
                  <Button variant="ghost" onClick={openLogin}>
                    Log in
                  </Button>
                  <Button onClick={openLogin}>Sign up</Button>
                </>
              )}
            </div>
          </div>
        </header>

        <section className="relative mx-auto max-w-7xl px-4 pb-16 pt-12 sm:px-6 sm:pt-16 lg:pt-24">
          <div className="grid items-center gap-12 lg:grid-cols-2">
            <div className="space-y-8">
              <div className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 text-xs font-medium text-foreground">
                <Sparkles className="h-3.5 w-3.5 text-primary" />
                AI for architecture & real estate
              </div>
              <h1 className="text-4xl font-bold leading-tight tracking-tight text-foreground sm:text-5xl lg:text-6xl">
                From screenshot to stunning visual in seconds
              </h1>
              <p className="max-w-lg text-lg text-muted-foreground">
                Renderuim turns rough 3D viewport captures into photorealistic renders, cinematic
                videos, and voiceovers — built for architects, archviz artists, and real estate pros.
              </p>
              <div className="flex flex-wrap items-center gap-4">
                {isLoggedIn ? (
                  <Button asChild size="lg">
                    <Link href="/app/dashboard">
                      Go to dashboard
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                ) : (
                  <>
                    <Button size="lg" onClick={openLogin}>
                      Get started free
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                    <Button size="lg" variant="outline" onClick={openLogin}>
                      Log in
                    </Button>
                  </>
                )}
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
              <div className="relative aspect-[4/3] overflow-hidden rounded-2xl border border-border bg-surface shadow-2xl">
                <img
                  src={HERO_IMAGE}
                  alt="AI architectural render"
                  className="h-full w-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-transparent to-transparent" />
                <div className="absolute bottom-6 left-6 right-6 rounded-xl border border-border bg-surface/90 p-4 backdrop-blur-md">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/15 text-primary">
                      <Wand2 className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">Screenshot-to-Render</p>
                      <p className="text-xs text-muted-foreground">
                        Generated in seconds from a SketchUp capture
                      </p>
                    </div>
                  </div>
                </div>
              </div>
              <div className="absolute -bottom-6 -right-6 hidden aspect-square w-48 overflow-hidden rounded-2xl border border-border bg-surface shadow-xl lg:block">
                <img
                  src={HERO_AFTER_IMAGE}
                  alt="Photorealistic render result"
                  className="h-full w-full object-cover"
                />
              </div>
            </div>
          </div>
        </section>

        <section className="border-y border-border bg-surface/50">
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
        </section>

        <section id="how-it-works" className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
          <div className="text-center">
            <h2 className="text-3xl font-bold tracking-tight text-foreground">How it works</h2>
            <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
              Three simple steps from your 3D model to a client-ready visual.
            </p>
          </div>
          <div className="mt-12 grid gap-8 md:grid-cols-3">
            {STEPS.map((item) => (
              <div
                key={item.step}
                className="relative rounded-2xl border border-border bg-surface p-6"
              >
                <span className="text-5xl font-bold text-primary/20">{item.step}</span>
                <h3 className="mt-4 text-lg font-semibold text-foreground">{item.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{item.description}</p>
              </div>
            ))}
          </div>
        </section>

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
                <div
                  key={cat.id}
                  className="rounded-2xl border border-border bg-surface p-6 transition-colors hover:border-primary/30"
                >
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Icon className="h-6 w-6" />
                  </div>
                  <h3 className="mt-4 text-lg font-semibold text-foreground">{cat.label}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{cat.description}</p>
                </div>
              );
            })}
          </div>
        </section>

        <section id="use-cases" className="border-y border-border bg-surface/50">
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
                <div
                  key={useCase.title}
                  className="rounded-2xl border border-border bg-background p-6"
                >
                  <span className="inline-flex rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
                    {useCase.stat}
                  </span>
                  <h3 className="mt-4 text-lg font-semibold text-foreground">{useCase.title}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">{useCase.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
          <div className="grid items-center gap-12 rounded-3xl border border-border bg-surface p-8 lg:grid-cols-2 lg:p-12">
            <div className="space-y-6">
              <div className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-3 py-1 text-xs font-medium text-foreground">
                <Play className="h-3.5 w-3.5 text-primary" />
                See it in action
              </div>
              <h2 className="text-3xl font-bold tracking-tight text-foreground">
                One capture, endless outputs
              </h2>
              <p className="text-muted-foreground">
                Upload a single viewport screenshot and generate photorealistic renders, alternate
                angles, mood variations, presentation videos, and voiceovers — all from the same
                starting point.
              </p>
              <ul className="space-y-3">
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
              <Button size="lg" onClick={openLogin}>
                Start creating free
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
            <div className="relative aspect-video overflow-hidden rounded-2xl border border-border bg-background">
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
            </div>
          </div>
        </section>

        <section id="models" className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
          <div className="mb-10">
            <h2 className="text-3xl font-bold tracking-tight text-foreground">Available Models</h2>
            <p className="mt-2 text-muted-foreground">
              Renderuim routes each generation to the best configured provider automatically.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {MODELS.map((model) => (
              <div
                key={model.name}
                className="flex items-center justify-between rounded-xl border border-border bg-surface px-5 py-4"
              >
                <div className="flex items-center gap-3">
                  <Layers className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium text-foreground">{model.name}</span>
                </div>
                <span className={cn("rounded-full px-2.5 py-1 text-xs font-semibold", model.color)}>
                  {model.tag}
                </span>
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary to-purple-600 px-6 py-16 text-center sm:px-12 lg:py-20">
            <div className="pointer-events-none absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10" />
            <div className="relative">
              <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
                Start creating with Renderuim
              </h2>
              <p className="mx-auto mt-4 max-w-xl text-white/80">
                Join architects and real estate pros who turn screenshots into visuals in seconds.
              </p>
              <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
                {isLoggedIn ? (
                  <Button asChild size="lg" variant="secondary">
                    <Link href="/app/dashboard">Go to dashboard</Link>
                  </Button>
                ) : (
                  <>
                    <Button size="lg" variant="secondary" onClick={openLogin}>
                      Sign up free
                    </Button>
                    <Button
                      size="lg"
                      variant="outline"
                      className="border-white/30 bg-transparent text-white hover:bg-white/10 hover:text-white"
                      onClick={openLogin}
                    >
                      Log in
                    </Button>
                  </>
                )}
              </div>
            </div>
          </div>
        </section>

        <footer className="border-t border-border bg-surface py-12">
          <div className="mx-auto flex max-w-7xl flex-col gap-10 px-4 sm:px-6 lg:flex-row lg:justify-between">
            <div className="space-y-4">
              <RenderuimLogo showWordmark />
              <p className="max-w-xs text-sm text-muted-foreground">
                AI rendering for architecture and real estate. From screenshot to stunning visual in
                seconds.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-8 sm:grid-cols-3">
              <div>
                <p className="font-medium text-foreground">Product</p>
                <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
                  <li>
                    <Link href="#tools" className="hover:text-foreground transition-colors">
                      Tools
                    </Link>
                  </li>
                  <li>
                    <Link href="#models" className="hover:text-foreground transition-colors">
                      Models
                    </Link>
                  </li>
                  <li>
                    <Link href="/pricing" className="hover:text-foreground transition-colors">
                      Pricing
                    </Link>
                  </li>
                </ul>
              </div>
              <div>
                <p className="font-medium text-foreground">Resources</p>
                <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
                  <li>
                    <Link href="/?login=true" className="hover:text-foreground transition-colors">
                      Log in
                    </Link>
                  </li>
                  <li>
                    <Link href="/pricing" className="hover:text-foreground transition-colors">
                      Sign up
                    </Link>
                  </li>
                </ul>
              </div>
              <div>
                <p className="font-medium text-foreground">Legal</p>
                <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
                  <li>
                    <a
                      href="https://policies.google.com/terms"
                      className="hover:text-foreground transition-colors"
                    >
                      Terms
                    </a>
                  </li>
                  <li>
                    <a
                      href="https://policies.google.com/privacy"
                      className="hover:text-foreground transition-colors"
                    >
                      Privacy
                    </a>
                  </li>
                </ul>
              </div>
            </div>
          </div>
          <div className="mx-auto mt-10 max-w-7xl px-4 text-center text-xs text-muted-foreground sm:px-6 sm:text-left">
            © {new Date().getFullYear()} Renderuim. All rights reserved.
          </div>
        </footer>
      </div>

      {showLogin && <LoginModal onClose={closeLogin} />}
    </>
  );
}

function ToolCard({
  icon,
  title,
  description,
  tag,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  tag: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex items-start gap-4 rounded-xl border border-border bg-surface p-4 text-left transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:bg-surface-light hover:shadow-lg"
    >
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-white">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="font-medium text-foreground">{title}</p>
          <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            {tag}
          </span>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>
      <ArrowRight className="mt-2 h-4 w-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
    </button>
  );
}
