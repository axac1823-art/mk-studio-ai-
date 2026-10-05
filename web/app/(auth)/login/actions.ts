"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";

import { createClient } from "@/lib/supabase/server";
import { createProject } from "@/lib/db/queries";
import sql from "@/lib/db";
import { checkRateLimit } from "@/lib/rate-limit";

function getIpFromHeaders() {
  const h = headers();
  const forwarded = h.get("x-forwarded-for");
  return forwarded ? forwarded.split(",")[0]?.trim() : "unknown";
}

/**
 * Resolve the public origin used by OAuth.
 *
 * Production must use the configured Vercel/site URL so OAuth never falls
 * back to an internal/local address such as 0.0.0.0:3000.
 * Local development still follows the actual browser origin.
 */
function getOAuthOrigin(): string | null {
  const h = headers();

  const configured =
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    (process.env.VERCEL_ENV === "production" && process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : null);

  if (configured) {
    try {
      const url = new URL(configured);
      const invalidProductionHost =
        process.env.VERCEL_ENV === "production" &&
        ["0.0.0.0", "localhost", "127.0.0.1", "::1"].includes(url.hostname);

      if (
        !invalidProductionHost &&
        (url.protocol === "http:" || url.protocol === "https:")
      ) {
        return url.origin;
      }
    } catch {
      // Ignore an invalid/stale configured URL and fall back to the request origin.
    }
  }

  const forwardedHost = h.get("x-forwarded-host")?.split(",")[0]?.trim();
  const host = forwardedHost || h.get("host");
  const forwardedProto = h.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const proto = forwardedProto || (host?.includes(":3000") ? "http" : "https");

  if (!host || !["http", "https"].includes(proto)) {
    return null;
  }

  try {
    const url = new URL(`${proto}://${host}`);
    if (url.username || url.password) return null;
    return url.origin;
  } catch {
    return null;
  }
}

export async function signInWithPassword(
  prevState: unknown,
  formData: FormData
): Promise<{ error?: string; field?: string } | void> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const redirectTo = String(formData.get("redirectTo") ?? "/");

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

export async function signInWithGoogle(): Promise<{ error?: string; url?: string }> {
  const supabase = createClient();
  const origin = getOAuthOrigin();

  if (!origin) {
    return { error: "Could not determine the sign-in address." };
  }

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${origin}/auth/callback`,
    },
  });

  if (error || !data.url) {
    console.error("Google OAuth start failed:", error);
    return { error: "Could not start Google sign-in." };
  }

  return { url: data.url };
}

export async function signUp(
  _prevState: unknown,
  formData: FormData
): Promise<{ error?: string; success?: boolean }> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const fullName = String(formData.get("fullName") ?? "").trim();

  if (!email || !password || password.length < 6) {
    return { error: "A valid email and a password of at least 6 characters are required." };
  }

  const limit = checkRateLimit("/signup", getIpFromHeaders(), {
    max: 5,
    windowMs: 15 * 60 * 1000,
  });
  if (!limit.allowed) {
    return { error: `Too many attempts. Please try again in ${limit.retryAfter}s.` };
  }

  const supabase = createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName },
    },
  });

  if (error) {
    return { error: error.message };
  }

  const user = data.user;
  if (!user) {
    return { error: "Could not create your account." };
  }

  try {
    await sql`
      INSERT INTO users (id, email, display_name)
      VALUES (${user.id}, ${email}, ${fullName})
      ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email,
                                     display_name = EXCLUDED.display_name
    `;

    const project = await createProject(user.id, "General");

    const configRows = await sql<Array<{ value_int: number | null }>>`
      SELECT value_int FROM app_config WHERE key = 'signup_bonus_credits'
    `;
    const bonus = configRows[0]?.value_int ?? 0;
    if (bonus > 0) {
      await sql`
        INSERT INTO credit_ledger (user_id, delta, reason)
        VALUES (${user.id}, ${bonus}, 'mint')
      `;
    }

    await sql`
      UPDATE users SET preferences = jsonb_set(
        COALESCE(preferences, '{}'::jsonb),
        '{default_project_id}',
        to_jsonb(${project.id}::text)
      ) WHERE id = ${user.id}
    `;
  } catch (err) {
    console.error("signup sync failed", err);
  }

  return { success: true };
}
