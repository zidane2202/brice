"use server";

import { createSupabaseServer } from "@/lib/supabase-server";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { consumeRateLimit } from "@/lib/rate-limit";

async function authAllowed(action: string, identity: string, limit: number, seconds: number) {
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
  return consumeRateLimit(`${ip}:${identity.toLowerCase()}`, action, limit, seconds);
}

export async function login(_prevState: { error: string } | undefined, formData: FormData) {
  const supabase = await createSupabaseServer();
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!await authAllowed("login", email, 10, 900)) return { error: "Trop de tentatives. Réessayez dans 15 minutes." };

  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: error.message };

  redirect("/dashboard");
}

export async function signup(
  _prevState: { error?: string; success?: boolean; needsConfirmation?: boolean } | undefined,
  formData: FormData
) {
  const supabase = await createSupabaseServer();
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const firstName = String(formData.get("first_name") ?? "").trim();
  const lastName = String(formData.get("last_name") ?? "").trim();
  const companyName = String(formData.get("company_name") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const city = String(formData.get("city") ?? "").trim();
  if (!await authAllowed("signup", email, 5, 3600)) return { error: "Trop de tentatives. Réessayez plus tard." };
  if (password.length < 8) return { error: "Le mot de passe doit contenir au moins 8 caractères." };

  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) return { error: error.message };

  if (data.user) {
    const { createSupabaseAdmin } = await import("@/lib/supabase-admin");
    const admin = createSupabaseAdmin();
    await admin
      .from("user_profiles")
      .update({
        first_name: firstName || null,
        last_name: lastName || null,
        company_name: companyName || null,
        phone: phone || null,
        city: city || null,
      })
      .eq("user_id", data.user.id);
  }

  if (!data.session) {
    return { success: true, needsConfirmation: true };
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
  if (!await authAllowed("forgot-password", email, 5, 3600)) return { error: "Trop de demandes. Réessayez plus tard." };

  const appUrl = String(process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/$/, "");
  if (!/^https?:\/\/[^\s/]+$/i.test(appUrl)) {
    return { error: "Configuration serveur incomplète (NEXT_PUBLIC_APP_URL)." };
  }

  // redirectTo must be listed in Supabase Redirect URLs:
  // https://subresel.vercel.app/auth/callback and http://localhost:3000/auth/callback
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${appUrl}/auth/callback?next=/reset-password`,
  });

  if (error) return { error: error.message };
  return { success: true };
}

export async function resetPassword(_prevState: { error?: string; success?: boolean } | undefined, formData: FormData) {
  const supabase = await createSupabaseServer();
  const password = String(formData.get("password") ?? "");
  if (password.length < 8) return { error: "Le mot de passe doit contenir au moins 8 caractères." };
  if (!await authAllowed("reset-password", "session", 5, 3600)) return { error: "Trop de tentatives. Réessayez plus tard." };

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Lien invalide ou expiré. Demandez un nouveau lien." };

  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: error.message };

  redirect("/dashboard");
}
