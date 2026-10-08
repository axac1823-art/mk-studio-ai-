import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

import sql from "./db";
import type { DbUser } from "./db/queries";

const DEV_USER_EMAIL = "dev@renderstudio.local";

function hasSupabaseConfig() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

export async function getSupabaseClient() {
  if (!hasSupabaseConfig()) {
    throw new Error(
      "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY."
    );
  }
  const cookieStore = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          // En Server Component les cookies sont en lecture seule ; seuls
          // les Route Handlers / Server Actions peuvent écrire. On ignore
          // silencieusement les écritures interdites pour éviter le crash
          // lors du refresh implicite du token par Supabase SSR.
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // ignore
          }
        },
      },
    }
  );
}

async function getDevUserFallback(): Promise<DbUser> {
  const rows = await sql<DbUser[]>`
    SELECT id, email, display_name, full_name, avatar_url FROM users WHERE email = ${DEV_USER_EMAIL} LIMIT 1
  `;
  if (!rows[0]) {
    throw new Error("dev user missing — apply db/schema.sql");
  }
  return rows[0];
}

export async function getCurrentUser(): Promise<DbUser | null> {
  if (!hasSupabaseConfig()) {
    if (process.env.AUTH_DEBUG === "true") {
      return getDevUserFallback();
    }
    return null;
  }

  const supabase = await getSupabaseClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    if (process.env.AUTH_DEBUG === "true") {
      return getDevUserFallback();
    }
    return null;
  }

  return getDbUserForAuthUser(user);
}

/**
 * Auth can be moved to a new Supabase project while the app's PostgreSQL
 * database is retained. In that case Supabase issues a new auth UUID, while
 * the existing app profile and its projects/jobs keep the old UUID. Resolve
 * that legacy profile by verified email so its data remains attached to the
 * account without rewriting foreign keys throughout the database.
 */
async function getDbUserForAuthUser(user: {
  id: string;
  email?: string;
  email_confirmed_at?: string | null;
}): Promise<DbUser | null> {
  const byId = await sql<DbUser[]>`
    SELECT id, email, display_name, full_name, avatar_url
    FROM users WHERE id = ${user.id} LIMIT 1
  `;
  if (byId[0]) return byId[0];

  const email = user.email?.trim().toLowerCase();
  if (!email || !user.email_confirmed_at) return null;

  const byVerifiedEmail = await sql<DbUser[]>`
    SELECT id, email, display_name, full_name, avatar_url
    FROM users WHERE lower(email) = ${email} ORDER BY created_at ASC LIMIT 2
  `;
  return byVerifiedEmail.length === 1 ? byVerifiedEmail[0] : null;
}

export async function requireAuth(): Promise<{ supabaseUser: { id: string; email?: string }; dbUser: DbUser }> {
  if (!hasSupabaseConfig()) {
    if (process.env.AUTH_DEBUG === "true") {
      const dbUser = await getDevUserFallback();
      return { supabaseUser: { id: dbUser.id, email: dbUser.email }, dbUser };
    }
    redirect("/login");
  }

  const supabase = await getSupabaseClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    if (process.env.AUTH_DEBUG === "true") {
      const dbUser = await getDevUserFallback();
      return { supabaseUser: { id: dbUser.id, email: dbUser.email }, dbUser };
    }
    redirect("/login");
  }

  const dbUser = await getDbUserForAuthUser(user);
  if (!dbUser) {
    redirect("/login");
  }

  return {
    supabaseUser: { id: user.id, email: user.email ?? dbUser.email },
    dbUser,
  };
}

export async function requireServiceRoleClient() {
  const { createClient } = await import("@supabase/supabase-js");
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}
