"use client";

import { useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { GoogleIcon } from "@/components/icons/google";
import { RenderuimLogo } from "@/components/icons/renderuim";

import {
  signInWithPassword,
  signInWithGoogle,
  signUp,
} from "@/app/(auth)/login/actions";

type AuthMode = "login" | "signup";

interface AuthFormProps {
  initialMode?: AuthMode;
}

export function AuthForm({ initialMode }: AuthFormProps) {
  const searchParams = useSearchParams();

  const redirectTo = searchParams.get("redirectTo") ?? "/";

  const [mode, setMode] = useState<AuthMode>(
    initialMode ??
      (searchParams.get("mode") === "signup" ? "signup" : "login"),
  );

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");

  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [signupSuccess, setSignupSuccess] = useState(false);

  const googleSignInStarted = useRef(false);

  function resetForm() {
    setError(null);
    setSignupSuccess(false);
    setPassword("");
  }

  function toggleMode() {
    setMode((currentMode) =>
      currentMode === "login" ? "signup" : "login",
    );

    resetForm();
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (busy) return;

    setBusy(true);
    setError(null);

    try {
      const formData = new FormData(event.currentTarget);

      if (mode === "login") {
        formData.set("redirectTo", redirectTo);

        const result = await signInWithPassword(undefined, formData);

        if (result?.error) {
          setError(result.error);
        }

        return;
      }

      const result = await signUp(undefined, formData);

      if (result?.error) {
        setError(result.error);
        return;
      }

      setSignupSuccess(true);
    } catch (err) {
      console.error("Authentication error:", err);

      setError(
        mode === "login"
          ? "Unable to sign in. Please try again."
          : "Unable to create your account. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleGoogle() {
    if (googleSignInStarted.current || busy) return;

    googleSignInStarted.current = true;
    setBusy(true);
    setError(null);

    try {
      const result = await signInWithGoogle();

      if (result?.url) {
        window.location.href = result.url;
        return;
      }

      setError(result?.error ?? "Could not start Google sign-in.");
    } catch (err) {
      console.error("Google sign-in error:", err);
      setError("Could not start Google sign-in.");
    } finally {
      googleSignInStarted.current = false;
      setBusy(false);
    }
  }

  if (signupSuccess) {
    return (
      <div className="mx-auto w-full max-w-sm space-y-6 text-center">
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
            We sent you a confirmation link. Click it to finish creating your
            account.
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
    <div className="mx-auto w-full max-w-sm space-y-6">
      {/* Header */}
      <div className="text-center">
        <div className="flex justify-center">
          <RenderuimLogo showWordmark className="h-10 w-auto" />
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

      {/* Google */}
      <Button
        type="button"
        variant="outline"
        className="w-full"
        onClick={handleGoogle}
        disabled={busy}
      >
        <GoogleIcon className="mr-2 h-4 w-4" />

        {busy && googleSignInStarted.current
          ? "Connecting..."
          : "Continue with Google"}
      </Button>

      {/* Separator */}
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t border-border" />
        </div>

        <div className="relative flex justify-center text-xs">
          <span className="bg-background px-3 tracking-wide text-muted-foreground">
            Or continue with email
          </span>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        {mode === "signup" && (
          <div className="space-y-2">
            <Label htmlFor="fullName">Full name</Label>

            <Input
              id="fullName"
              name="fullName"
              type="text"
              required
              autoComplete="name"
              placeholder="Jane Doe"
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
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
            onChange={(event) => setEmail(event.target.value)}
            disabled={busy}
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Password</Label>

            {mode === "login" && (
              <Link
                href="/forgot-password"
                className="text-xs text-primary transition-colors hover:text-foreground hover:underline"
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
            autoComplete={
              mode === "login" ? "current-password" : "new-password"
            }
            placeholder={
              mode === "signup"
                ? "At least 6 characters"
                : "Enter your password"
            }
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            disabled={busy}
          />

          {mode === "signup" && (
            <p className="text-xs text-muted-foreground">
              At least 6 characters.
            </p>
          )}
        </div>

        {error && (
          <div
            role="alert"
            className="rounded-md border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          >
            {error}
          </div>
        )}

        <Button type="submit" className="w-full" disabled={busy}>
          {busy
            ? mode === "login"
              ? "Signing in..."
              : "Creating account..."
            : mode === "login"
              ? "Continue"
              : "Create account"}
        </Button>
      </form>

      {/* Switch login/signup */}
      <p className="text-center text-sm text-muted-foreground">
        {mode === "login"
          ? "Don't have an account? "
          : "Already have an account? "}

        <button
          type="button"
          disabled={busy}
          onClick={toggleMode}
          className="font-medium text-primary transition-colors hover:text-foreground hover:underline focus-visible:outline-none focus-visible:underline disabled:pointer-events-none disabled:opacity-50"
        >
          {mode === "login" ? "Sign up" : "Sign in"}
        </button>
      </p>

      {/* Terms */}
      <p className="text-center text-xs text-muted-foreground">
        By registering, you agree to our{" "}
        <Link
          className="transition-colors hover:text-foreground hover:underline"
          href="/terms"
        >
          Terms of Service
        </Link>{" "}
        and{" "}
        <Link
          className="transition-colors hover:text-foreground hover:underline"
          href="/privacy"
        >
          Privacy Policy
        </Link>
        .
      </p>
    </div>
  );
}
