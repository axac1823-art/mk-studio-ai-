"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { GoogleIcon } from "@/components/icons/google";
import { RenderuimLogo } from "@/components/icons/renderuim";
import { signInWithPassword, signInWithGoogle, signUp } from "@/app/(auth)/login/actions";

export function AuthForm() {
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirectTo") ?? "/app/dashboard";

  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [signupSuccess, setSignupSuccess] = useState(false);

  function resetForm() {
    setError(null);
    setSignupSuccess(false);
  }

  function toggleMode() {
    setMode((prev) => (prev === "login" ? "signup" : "login"));
    resetForm();
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);

    const formData = new FormData(event.currentTarget);

    if (mode === "login") {
      formData.append("redirectTo", redirectTo);
      const result = await signInWithPassword(undefined, formData);
      if (result && "error" in result) {
        setError(result.error ?? null);
        setBusy(false);
      }
      return;
    }

    const result = await signUp(undefined, formData);
    if (result.error) {
      setError(result.error);
      setBusy(false);
    } else {
      setSignupSuccess(true);
      setBusy(false);
    }
  }

  async function handleGoogle() {
    setBusy(true);
    setError(null);
    const formData = new FormData();
    formData.append("origin", window.location.origin);
    const result = await signInWithGoogle(undefined, formData);
    if (result?.url) {
      window.location.href = result.url;
    } else {
      setError(result?.error ?? "Could not start Google sign-in.");
      setBusy(false);
    }
  }

  if (signupSuccess) {
    return (
      <div className="space-y-6 text-center">
        <div className="flex justify-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <RenderuimLogo className="h-8 w-8" />
          </div>
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Check your email
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            We sent you a confirmation link. Click it to finish creating your account.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          className="w-full"
          onClick={() => {
            setMode("login");
            resetForm();
          }}
        >
          Back to sign in
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <div className="flex justify-center">
          <RenderuimLogo showWordmark className="h-10 w-10" />
        </div>
        <h1 className="mt-5 text-3xl font-semibold tracking-tight text-foreground">
          {mode === "login" ? "Welcome back" : "Create your account"}
        </h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          {mode === "login"
            ? "Sign in to continue to Renderuim"
            : "Start generating visuals with Renderuim"}
        </p>
      </div>

      <Button
        type="button"
        variant="outline"
        className="w-full"
        onClick={handleGoogle}
        disabled={busy}
      >
        <GoogleIcon className="mr-2" />
        Continue with Google
      </Button>

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t border-border" />
        </div>
        <div className="relative flex justify-center text-xs">
          <span className="bg-surface px-3 text-muted-foreground tracking-wide">
            Or continue with email
          </span>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {mode === "signup" && (
          <div className="space-y-2">
            <Label htmlFor="fullName">Full name</Label>
            <Input
              id="fullName"
              name="fullName"
              type="text"
              autoComplete="name"
              placeholder="Jane Doe"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              disabled={busy}
            />
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={busy}
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Password</Label>
            {mode === "login" && (
              <Link
                href="/forgot-password"
                className="text-xs text-primary hover:text-foreground hover:underline transition-colors"
              >
                Forgot password?
              </Link>
            )}
          </div>
          <Input
            id="password"
            name="password"
            type="password"
            required
            minLength={mode === "signup" ? 6 : undefined}
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            placeholder={mode === "signup" ? "At least 6 characters" : "Enter your password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={busy}
          />
          {mode === "signup" && (
            <p className="text-xs text-muted-foreground">At least 6 characters.</p>
          )}
        </div>

        {error && (
          <p role="alert" className="text-sm text-error">
            {error}
          </p>
        )}

        <Button type="submit" className="w-full" disabled={busy}>
          {mode === "login" ? "Continue" : "Create account"}
        </Button>
      </form>

      <p className="text-center text-sm text-muted-foreground">
        {mode === "login" ? "Don't have an account? " : "Already have an account? "}
        <button
          type="button"
          onClick={toggleMode}
          className="font-medium text-primary hover:text-foreground hover:underline focus-visible:outline-none focus-visible:underline transition-colors"
        >
          {mode === "login" ? "Sign up" : "Sign in"}
        </button>
      </p>

      <p className="text-center text-xs text-muted-foreground">
        By registering, you agree to our{" "}
        <a
          className="text-muted-foreground hover:text-foreground hover:underline transition-colors"
          href="https://policies.google.com/terms"
        >
          Terms of Service
        </a>{" "}
        and{" "}
        <a
          className="text-muted-foreground hover:text-foreground hover:underline transition-colors"
          href="https://policies.google.com/privacy"
        >
          Privacy Policy
        </a>
        .
      </p>
    </div>
  );
}
