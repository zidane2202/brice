"use server";

import { createSupabaseServer } from "@/lib/supabase-server";
import { redirect } from "next/navigation";

export async function login(formData: FormData) {
  const supabase = await createSupabaseServer();
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: error.message };

  redirect("/dashboard");
}

export async function signup(formData: FormData) {
  const supabase = await createSupabaseServer();
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  const { error } = await supabase.auth.signUp({ email, password });
  if (error) return { error: error.message };

  redirect("/dashboard");
}

export async function logout() {
  const supabase = await createSupabaseServer();
  await supabase.auth.signOut();
  redirect("/login");
}
