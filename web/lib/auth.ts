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
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
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

  const rows = await sql<DbUser[]>`
    SELECT id, email, display_name, full_name, avatar_url FROM users WHERE id = ${user.id} LIMIT 1
  `;
  return rows[0] ?? null;
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

  const rows = await sql<DbUser[]>`
    SELECT id, email, display_name, full_name, avatar_url FROM users WHERE id = ${user.id} LIMIT 1
  `;
  const dbUser = rows[0];
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
