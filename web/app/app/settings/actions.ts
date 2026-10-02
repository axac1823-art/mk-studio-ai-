"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/auth";
import sql from "@/lib/db";

export async function updateProfile(formData: FormData): Promise<{ error?: string; success?: boolean }> {
  const { dbUser: user } = await requireAuth();
  const displayName = String(formData.get("displayName") ?? "").trim();
  const fullName = String(formData.get("fullName") ?? "").trim() || null;

  try {
    await sql`
      UPDATE users
      SET display_name = ${displayName},
          full_name = ${fullName},
          updated_at = now()
      WHERE id = ${user.id}
    `;
    revalidatePath("/app/settings");
    revalidatePath("/app/account");
    return { success: true };
  } catch (err) {
    console.error("updateProfile error", err);
    return { error: "Could not update profile." };
  }
}

export async function updateEmail(formData: FormData): Promise<{ error?: string; success?: boolean }> {
  const email = String(formData.get("email") ?? "").trim();
  if (!email) {
    return { error: "Email is required." };
  }

  const supabase = createClient();
  const { error } = await supabase.auth.updateUser({ email });
  if (error) {
    return { error: error.message };
  }

  return { success: true };
}

export async function updatePassword(formData: FormData): Promise<{ error?: string; success?: boolean }> {
  const password = String(formData.get("password") ?? "");
  if (password.length < 6) {
    return { error: "Password must be at least 6 characters." };
  }

  const supabase = createClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    return { error: error.message };
  }

  return { success: true };
}
