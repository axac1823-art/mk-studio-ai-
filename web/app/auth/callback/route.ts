import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSiteUrl } from "@/lib/site-url";
import sql from "@/lib/db";
import { createProject } from "@/lib/db/queries";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const type = searchParams.get("type");
  const callbackError = searchParams.get("error");

  const siteUrl = getSiteUrl();

  if (callbackError) {
    const loginUrl = new URL("/login", siteUrl);
    loginUrl.searchParams.set("error", "oauth_callback_failed");
    return NextResponse.redirect(loginUrl);
  }

  if (code) {
    const supabase = createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (error || !data.user) {
      console.error("OAuth callback exchange failed:", error);
      const loginUrl = new URL("/login", siteUrl);
      loginUrl.searchParams.set("error", "oauth_callback_failed");
      return NextResponse.redirect(loginUrl);
    }

    await syncUserFromAuth(data.user);
  }

  if (type === "recovery") {
    return NextResponse.redirect(new URL("/reset-password", siteUrl));
  }

  return NextResponse.redirect(new URL("/", siteUrl));
}

async function syncUserFromAuth(authUser: { id: string; email?: string; user_metadata?: Record<string, unknown> }) {
  const email = authUser.email ?? "";
  const fullName = String(authUser.user_metadata?.full_name ?? "");

  const existing = await sql<[{ id: string }?]>`
    SELECT id FROM users WHERE id = ${authUser.id} LIMIT 1
  `;

  if (!existing[0]) {
    try {
      await sql`
        INSERT INTO users (id, email, display_name)
        VALUES (${authUser.id}, ${email}, ${fullName})
      `;
      const project = await createProject(authUser.id, "General");
      const configRows = await sql<Array<{ value_int: number | null }>>`
        SELECT value_int FROM app_config WHERE key = 'signup_bonus_credits'
      `;
      const bonus = configRows[0]?.value_int ?? 0;
      if (bonus > 0) {
        await sql`
          INSERT INTO credit_ledger (user_id, delta, reason)
          VALUES (${authUser.id}, ${bonus}, 'mint')
        `;
      }
      await sql`
        UPDATE users SET preferences = jsonb_set(
          COALESCE(preferences, '{}'::jsonb),
          '{default_project_id}',
          to_jsonb(${project.id}::text)
        ) WHERE id = ${authUser.id}
      `;
    } catch (err) {
      console.error("syncUserFromAuth failed", err);
    }
  }
}
