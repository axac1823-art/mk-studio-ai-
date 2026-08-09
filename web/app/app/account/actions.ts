"use server";

import { redirect } from "next/navigation";

import { requireAuth, requireServiceRoleClient } from "@/lib/auth";

export async function deleteAccount(): Promise<{ error?: string } | void> {
  const { supabaseUser } = await requireAuth();

  const admin = await requireServiceRoleClient();
  const { error } = await admin.auth.admin.deleteUser(supabaseUser.id);
  if (error) {
    console.error("deleteAccount error", error);
    return { error: "Could not delete account. Please contact support." };
  }

  redirect("/login");
}
