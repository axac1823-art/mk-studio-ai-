"use client";

import { useEffect, useRef, useCallback } from "react";

import { createClient } from "@/lib/supabase/client";

const DEFAULT_TIMEOUT_MINUTES = 30;
const ACTIVITY_EVENTS = [
  "mousedown",
  "keydown",
  "touchstart",
  "scroll",
  "mousemove",
] as const;

function getTimeoutMs(): number {
  const raw = process.env.NEXT_PUBLIC_SESSION_TIMEOUT_MINUTES;
  const parsed = raw ? Number(raw) : NaN;
  const minutes = Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_TIMEOUT_MINUTES;
  return minutes * 60 * 1000;
}

/**
 * Déconnecte l'utilisateur après une période d'inactivité configurable.
 * Réinitialisée à chaque interaction (clavier, souris, tactile, scroll).
 * N'est actif que lorsqu'une session Supabase est présente.
 */
export function SessionTimeout() {
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const lastActivityRef = useRef<number>(Date.now());
  const isActiveRef = useRef(false);
  const mountedRef = useRef(true);

  const logout = useCallback(() => {
    window.location.href = "/logout";
  }, []);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const startTimer = useCallback(() => {
    clearTimer();
    lastActivityRef.current = Date.now();
    timerRef.current = setTimeout(logout, getTimeoutMs());
  }, [clearTimer, logout]);

  useEffect(() => {
    const supabase = createClient();
    let authSubscription: { subscription: { unsubscribe: () => void } } | null = null;

    const handleActivity = () => {
      if (!isActiveRef.current) return;
      if (Date.now() - lastActivityRef.current < 1000) return;
      startTimer();
    };

    const visibilityHandler = () => {
      if (!isActiveRef.current) return;
      if (document.visibilityState === "visible") {
        const inactiveFor = Date.now() - lastActivityRef.current;
        if (inactiveFor >= getTimeoutMs()) {
          logout();
        } else {
          startTimer();
        }
      }
    };

    const setupActivityListeners = () => {
      ACTIVITY_EVENTS.forEach((event) => {
        window.addEventListener(event, handleActivity, { passive: true });
      });
      document.addEventListener("visibilitychange", visibilityHandler);
    };

    const removeActivityListeners = () => {
      ACTIVITY_EVENTS.forEach((event) => {
        window.removeEventListener(event, handleActivity);
      });
      document.removeEventListener("visibilitychange", visibilityHandler);
    };

    const checkSession = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!mountedRef.current) return;
      if (session) {
        isActiveRef.current = true;
        startTimer();
        setupActivityListeners();
      }
    };

    void checkSession();

    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mountedRef.current) return;
      if (session) {
        if (!isActiveRef.current) {
          isActiveRef.current = true;
          setupActivityListeners();
        }
        startTimer();
      } else {
        isActiveRef.current = false;
        removeActivityListeners();
        clearTimer();
      }
    });
    authSubscription = data;

    return () => {
      mountedRef.current = false;
      removeActivityListeners();
      clearTimer();
      authSubscription?.subscription.unsubscribe();
    };
  }, [clearTimer, logout, startTimer]);

  return null;
}
