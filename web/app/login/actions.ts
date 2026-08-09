"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";

import { createClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/rate-limit";

function getIpFromHeaders() {
  const h = headers();
  const forwarded = h.get("x-forwarded-for");
  return forwarded ? forwarded.split(",")[0]?.trim() : "unknown";
}

export async function signInWithPassword(
  prevState: unknown,
  formData: FormData
): Promise<{ error?: string; field?: string } | void> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const redirectTo = String(formData.get("redirectTo") ?? "/app/dashboard");

  if (!email || !password) {
    return { error: "Email and password are required." };
  }

  const limit = checkRateLimit("/login", getIpFromHeaders(), {
    max: 5,
    windowMs: 15 * 60 * 1000,
  });
  if (!limit.allowed) {
    return { error: `Too many attempts. Please try again in ${limit.retryAfter}s.` };
  }

  const supabase = createClient();

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    if (error.message.toLowerCase().includes("email not confirmed")) {
      return {
        error: "Please confirm your email before signing in.",
      };
    }
    return { error: "Invalid email or password." };
  }

  if (!data.user) {
    return { error: "Could not sign in." };
  }

  revalidatePath("/", "layout");
  redirect(redirectTo);
}

export async function signInWithGoogle(
  _prevState: unknown,
  formData: FormData
): Promise<{ error?: string; url?: string }> {
  const supabase = createClient();
  const origin = String(formData.get("origin") ?? "http://localhost:3000");

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${origin}/auth/callback`,
    },
  });

  if (error || !data.url) {
    return { error: "Could not start Google sign-in." };
  }

  return { url: data.url };
}
