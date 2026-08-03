"use server";

import { createSupabaseAdmin } from "@/lib/supabase-admin";
import { getUser, getUserProfile } from "@/lib/supabase-server";
import { revalidatePath } from "next/cache";

const PLANS = new Set(["free", "pro", "business"]);
const ROLES = new Set(["reseller", "admin"]);

export async function updateResellerPlanRole(formData: FormData) {
  const actor = await getUser();
  const actorProfile = await getUserProfile();
  if (!actor || actorProfile?.role !== "admin") {
    throw new Error("Accès refusé");
  }

  const userId = String(formData.get("user_id") ?? "").trim();
  const plan = String(formData.get("plan") ?? "").trim();
  const role = String(formData.get("role") ?? "").trim();
  const extrasRaw = String(formData.get("extra_provider_accounts") ?? "0").trim();
  const extras = Math.max(0, parseInt(extrasRaw || "0", 10) || 0);

  if (!userId) throw new Error("Vendeur manquant");
  if (!PLANS.has(plan)) throw new Error("Plan invalide");
  if (!ROLES.has(role)) throw new Error("Rôle invalide");

  if (userId === actor.id && role !== "admin") {
    throw new Error("Vous ne pouvez pas retirer votre propre rôle admin");
  }

  const supabase = createSupabaseAdmin();
  const { data: target, error: findErr } = await supabase
    .from("user_profiles")
    .select("user_id, role")
    .eq("user_id", userId)
    .maybeSingle();

  if (findErr) throw new Error(findErr.message);
  if (!target) throw new Error("Vendeur introuvable");

  const { error } = await supabase
    .from("user_profiles")
    .update({
      plan,
      role,
      extra_provider_accounts: plan === "pro" ? extras : 0,
    })
    .eq("user_id", userId);

  if (error) throw new Error(error.message);

  revalidatePath(`/admin/vendeurs/${userId}`);
  revalidatePath("/admin/vendeurs");
  revalidatePath("/admin/dashboard");
  revalidatePath("/admin/finances");
}

export async function setResellerSuspended(formData: FormData) {
  const actor = await getUser();
  const actorProfile = await getUserProfile();
  if (!actor || actorProfile?.role !== "admin") {
    throw new Error("Accès refusé");
  }

  const userId = String(formData.get("user_id") ?? "").trim();
  const suspended = String(formData.get("suspended") ?? "") === "true";

  if (!userId) throw new Error("Vendeur manquant");
  if (userId === actor.id) {
    throw new Error("Vous ne pouvez pas suspendre votre propre compte");
  }

  const supabase = createSupabaseAdmin();
  const { data: target, error: findErr } = await supabase
    .from("user_profiles")
    .select("user_id, role")
    .eq("user_id", userId)
    .maybeSingle();

  if (findErr) throw new Error(findErr.message);
  if (!target) throw new Error("Vendeur introuvable");

  const { error } = await supabase
    .from("user_profiles")
    .update({ suspended })
    .eq("user_id", userId);

  if (error) throw new Error(error.message);

  revalidatePath(`/admin/vendeurs/${userId}`);
  revalidatePath("/admin/vendeurs");
  revalidatePath("/admin/dashboard");
  revalidatePath("/admin/finances");
}
