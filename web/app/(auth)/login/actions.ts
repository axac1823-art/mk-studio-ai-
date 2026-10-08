"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";

import { createClient } from "@/lib/supabase/server";
import { getSiteUrl } from "@/lib/site-url";
import { createProject } from "@/lib/db/queries";
import sql from "@/lib/db";
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
  const requestedRedirect = String(formData.get("redirectTo") ?? "/");
  const redirectPath =
    requestedRedirect.startsWith("/") && !requestedRedirect.startsWith("//")
      ? requestedRedirect
      : "/";

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
  redirect(new URL(redirectPath, getSiteUrl()).toString());
}

export async function signInWithGoogle(): Promise<{
  error?: string;
  url?: string;
}> {
  const supabase = createClient();
  const redirectTo = new URL("/auth/callback", getSiteUrl()).toString();

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo,
    },
  });

  if (error || !data.url) {
    console.error("Google OAuth error:", error);

    return {
      error: "Could not start Google sign-in.",
    };
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
  const origin = getSiteUrl().origin;
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName },
      emailRedirectTo: `${origin}/auth/callback`,
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
    // Synchronise la ligne utilisateur dans notre schÃ©ma public.
    await sql`
      INSERT INTO users (id, email, display_name)
      VALUES (${user.id}, ${email}, ${fullName})
      ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email,
                                     display_name = EXCLUDED.display_name
    `;

    // Projet par dÃ©faut.
    const project = await createProject(user.id, "General");

    // CrÃ©dits de bienvenue (configurable dans app_config).
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

    // Marque le projet par dÃ©faut comme cover initial (optionnel).
    await sql`
      UPDATE users SET preferences = jsonb_set(
        COALESCE(preferences, '{}'::jsonb),
        '{default_project_id}',
        to_jsonb(${project.id}::text)
      ) WHERE id = ${user.id}
    `;
  } catch (err) {
    // On ne bloque pas l'inscription si la synchro DB Ã©choue ; elle sera
    // rattrapÃ©e au callback / prochain login.
    console.error("signup sync failed", err);
  }

  return { success: true };
}
