import { requireAuth } from "@/lib/auth";
import SettingsPageClient from "./settings-page-client";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const { supabaseUser, dbUser } = await requireAuth();

  return (
    <SettingsPageClient
      displayName={dbUser.display_name}
      fullName={dbUser.full_name}
      email={supabaseUser.email ?? dbUser.email}
    />
  );
}
