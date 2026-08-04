"use server";

import { createSupabaseAdmin } from "@/lib/supabase-admin";
import { getUser, getUserProfile } from "@/lib/supabase-server";
import {
  defaultAmountForKind,
  isPlatformPaymentKind,
  suggestedPlanForKind,
} from "@/lib/platform-payments";
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

export async function recordPlatformPayment(formData: FormData) {
  const actor = await getUser();
  const actorProfile = await getUserProfile();
  if (!actor || actorProfile?.role !== "admin") {
    throw new Error("Accès refusé");
  }

  const resellerId = String(formData.get("reseller_user_id") ?? "").trim();
  const kindRaw = String(formData.get("kind") ?? "").trim();
  const note = String(formData.get("note") ?? "").trim();
  const occurredOn =
    String(formData.get("occurred_on") ?? "").trim() ||
    new Date().toISOString().slice(0, 10);
  const applyPlan =
    String(formData.get("apply_plan") ?? "") === "on" ||
    String(formData.get("apply_plan") ?? "") === "true";

  if (!resellerId) throw new Error("Vendeur manquant");
  if (!isPlatformPaymentKind(kindRaw)) throw new Error("Motif invalide");
  if (kindRaw === "other" && !note) {
    throw new Error("Note obligatoire pour le motif Autre");
  }

  const amountRaw = String(formData.get("amount") ?? "").trim();
  let amount = Number(amountRaw.replace(",", "."));
  if (!Number.isFinite(amount) || amount <= 0) {
    amount = defaultAmountForKind(kindRaw);
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("Montant invalide");
  }

  let plan = String(formData.get("plan") ?? "").trim();
  const extrasRaw = String(formData.get("extra_provider_accounts") ?? "").trim();
  let extras = Math.max(0, parseInt(extrasRaw || "0", 10) || 0);

  if (applyPlan) {
    const suggested = suggestedPlanForKind(kindRaw);
    if (!plan && suggested) plan = suggested.plan;
    if (!PLANS.has(plan)) throw new Error("Plan invalide pour application");
    if (plan !== "pro") extras = 0;
    if (kindRaw === "extra_accounts" && extras <= 0) {
      extras = 1;
    }
  }

  const supabase = createSupabaseAdmin();
  const { data: target, error: findErr } = await supabase
    .from("user_profiles")
    .select("user_id, plan, extra_provider_accounts")
    .eq("user_id", resellerId)
    .maybeSingle();

  if (findErr) throw new Error(findErr.message);
  if (!target) throw new Error("Vendeur introuvable");

  let appliedPlan: string | null = null;
  let appliedExtras: number | null = null;

  if (applyPlan) {
    if (kindRaw === "extra_accounts") {
      const currentExtras = Number(target.extra_provider_accounts ?? 0);
      const add = extras > 0 ? extras : 1;
      plan = "pro";
      extras = currentExtras + add;
    }

    const { error: upErr } = await supabase
      .from("user_profiles")
      .update({
        plan,
        extra_provider_accounts: plan === "pro" ? extras : 0,
        suspended: false,
      })
      .eq("user_id", resellerId);

    if (upErr) throw new Error(upErr.message);
    appliedPlan = plan;
    appliedExtras = plan === "pro" ? extras : 0;
  }

  const { error } = await supabase.from("platform_payments").insert({
    reseller_user_id: resellerId,
    amount,
    kind: kindRaw,
    note: note || null,
    occurred_on: occurredOn,
    recorded_by: actor.id,
    applied_plan: appliedPlan,
    applied_extras: appliedExtras,
  });

  if (error) throw new Error(error.message);

  revalidatePath(`/admin/vendeurs/${resellerId}`);
  revalidatePath("/admin/vendeurs");
  revalidatePath("/admin/finances");
  revalidatePath("/admin/dashboard");
}
