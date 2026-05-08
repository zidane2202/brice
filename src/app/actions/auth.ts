"use server";

import { createSupabaseServer } from "@/lib/supabase-server";
import { redirect } from "next/navigation";

export async function login(_prevState: { error: string } | undefined, formData: FormData) {
  const supabase = await createSupabaseServer();
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: error.message };

  redirect("/dashboard");
}

export async function signup(_prevState: { error: string } | undefined, formData: FormData) {
  const supabase = await createSupabaseServer();
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const firstName = String(formData.get("first_name") ?? "").trim();
  const lastName = String(formData.get("last_name") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const city = String(formData.get("city") ?? "").trim();

  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) return { error: error.message };

  if (data.user) {
    const { createSupabaseAdmin } = await import("@/lib/supabase-admin");
    const admin = createSupabaseAdmin();
    await admin
      .from("user_profiles")
      .update({ first_name: firstName || null, last_name: lastName || null, phone: phone || null, city: city || null })
      .eq("user_id", data.user.id);
  }

  redirect("/dashboard");
}

export async function logout() {
  const supabase = await createSupabaseServer();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function forgotPassword(_prevState: { error?: string; success?: boolean } | undefined, formData: FormData) {
  const supabase = await createSupabaseServer();
  const email = String(formData.get("email") ?? "").trim();

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/reset-password`,
  });

  if (error) return { error: error.message };
  return { success: true };
}

export async function resetPassword(_prevState: { error?: string; success?: boolean } | undefined, formData: FormData) {
  const supabase = await createSupabaseServer();
  const password = String(formData.get("password") ?? "");

  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: error.message };

  redirect("/dashboard");
}
