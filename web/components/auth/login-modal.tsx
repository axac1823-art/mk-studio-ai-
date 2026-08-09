"use client";

import { useCallback, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { X } from "lucide-react";

import { AuthForm } from "./auth-form";
import { cn } from "@/lib/utils";

interface LoginModalProps {
  /** If true, the modal is rendered as a standalone page (no close button, full screen). */
  standalone?: boolean;
  /** Called when the user closes the modal. */
  onClose?: () => void;
}

export function LoginModal({ standalone = false, onClose }: LoginModalProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const handleClose = useCallback(() => {
    if (standalone) return;
    onClose?.();
    // Remove the login query param without reloading.
    const params = new URLSearchParams(searchParams.toString());
    params.delete("login");
    params.delete("redirectTo");
    const query = params.toString();
    router.replace(query ? `/?${query}` : "/", { scroll: false });
  }, [standalone, onClose, router, searchParams]);

  useEffect(() => {
    if (standalone) return;

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") handleClose();
    }

    document.addEventListener("keydown", handleEscape);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "";
    };
  }, [standalone, handleClose]);

  return (
    <div
      className={cn(
        "fixed inset-0 z-50 flex items-center justify-center",
        standalone ? "bg-background" : "bg-black/60 backdrop-blur-xl"
      )}
      role="dialog"
      aria-modal="true"
      aria-label="Sign in"
    >
      <div
        className={cn(
          "relative z-10 mx-4 w-full max-w-5xl overflow-hidden rounded-2xl border border-border bg-surface shadow-2xl",
          standalone ? "max-h-[min(640px,90vh)]" : "max-h-[90vh] overflow-y-auto"
        )}
      >
        {!standalone && (
          <button
            type="button"
            onClick={handleClose}
            className="absolute right-4 top-4 z-20 flex h-9 w-9 items-center justify-center rounded-full bg-surface-light text-muted-foreground transition-colors hover:text-foreground"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        )}

        <div className="flex min-h-[560px]">
          {/* Left: form */}
          <div className="flex w-full flex-col items-center justify-center p-8 sm:p-12 lg:w-[55%]">
            <div className="w-full max-w-sm">
              <AuthForm />
            </div>
          </div>

          {/* Right: showcase image */}
          <div className="relative hidden lg:block lg:w-[45%]">
            <img
              src="https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=1200&q=80"
              alt="AI architectural render"
              className="absolute inset-0 h-full w-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-background via-background/70 to-transparent" />
            <div className="absolute bottom-10 left-8 right-8 text-foreground">
              <p className="text-sm font-medium text-primary">New</p>
              <h2 className="mt-2 text-2xl font-semibold leading-tight tracking-tight">
                Photorealistic renders in seconds
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Turn screenshots from SketchUp, Revit, and 3ds Max into client-ready visuals.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Click outside to close */}
      {!standalone && (
        <button
          type="button"
          className="absolute inset-0 z-0 cursor-default"
          onClick={handleClose}
          aria-label="Close sign in"
        />
      )}
    </div>
  );
}
