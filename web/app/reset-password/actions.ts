"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function updatePassword(
  _prevState: unknown,
  formData: FormData
): Promise<{ error?: string } | void> {
  const password = String(formData.get("password") ?? "");
  if (password.length < 6) {
    return { error: "Password must be at least 6 characters." };
  }

  const supabase = createClient();
  const { error } = await supabase.auth.updateUser({ password });

  if (error) {
    return { error: error.message };
  }

  redirect("/");
}
