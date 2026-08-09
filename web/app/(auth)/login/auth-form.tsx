"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Box } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { GoogleIcon } from "@/components/icons/google";
import { signInWithPassword, signInWithGoogle, signUp } from "./actions";

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
      // Successful login redirects server-side.
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
      <div className="w-full max-w-md space-y-6 text-center">
        <div className="flex justify-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <Box className="h-6 w-6 text-primary" />
          </div>
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Check your email</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            We sent you a confirmation link. Click it to finish creating your account.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          className="w-full h-11"
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
    <div className="w-full max-w-md space-y-6">
      {/* Logo / heading */}
      <div className="text-center">
        <div className="flex justify-center">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Box className="h-6 w-6" />
          </div>
        </div>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight">
          {mode === "login" ? "Welcome to RenderStudio" : "Create your account"}
        </h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          {mode === "login" ? "Sign in to continue" : "Start generating with RenderStudio"}
        </p>
      </div>

      {/* OAuth providers */}
      <div className="space-y-3">
        <p className="text-center text-sm text-muted-foreground">Log in with</p>
        <Button
          type="button"
          variant="outline"
          className="w-full h-11"
          onClick={handleGoogle}
          disabled={busy}
        >
          <GoogleIcon className="mr-2" />
          Continue with Google
        </Button>
      </div>

      {/* Divider */}
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t" />
        </div>
        <div className="relative flex justify-center text-sm uppercase">
          <span className="bg-background px-2 text-muted-foreground">Or continue with email</span>
        </div>
      </div>

      {/* Email form */}
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
              className="h-11"
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
            autoComplete={mode === "login" ? "email" : "email"}
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={busy}
            className="h-11"
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Password</Label>
            {mode === "login" && (
              <Link
                href="/forgot-password"
                className="text-xs text-muted-foreground hover:text-foreground"
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
            className="h-11"
          />
          {mode === "signup" && (
            <p className="text-xs text-muted-foreground">At least 6 characters.</p>
          )}
        </div>

        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}

        <Button type="submit" className="w-full h-11" disabled={busy}>
          {mode === "login" ? "Continue" : "Create account"}
        </Button>
      </form>

      {/* Mode toggle */}
      <p className="text-center text-sm text-muted-foreground">
        {mode === "login" ? "Don't have an account? " : "Already have an account? "}
        <button
          type="button"
          onClick={toggleMode}
          className="text-foreground hover:underline focus-visible:outline-none focus-visible:underline"
        >
          {mode === "login" ? "Sign up" : "Sign in"}
        </button>
      </p>

      {/* Footer */}
      <p className="text-center text-xs text-muted-foreground">
        This site is protected by reCAPTCHA and the Google{" "}
        <a className="hover:text-foreground hover:underline" href="https://policies.google.com/privacy">
          Privacy Policy
        </a>{" "}
        and{" "}
        <a className="hover:text-foreground hover:underline" href="https://policies.google.com/terms">
          Terms of Service
        </a>{" "}
        apply.
      </p>
    </div>
  );
}
