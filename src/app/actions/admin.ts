"use server";

import { createSupabaseAdmin } from "@/lib/supabase-admin";
import { getUser, getUserProfile } from "@/lib/supabase-server";
import {
  defaultAmountForKind,
  isPlatformPaymentKind,
  suggestedPlanForKind,
} from "@/lib/platform-payments";
import { activatePlanFor30Days, extendPlanRenewal } from "@/lib/plans";
import { revalidatePath } from "next/cache";

const PLANS = new Set(["free", "pro", "business"]);
const ROLES = new Set(["reseller", "admin"]);

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

async function logAdminAction(input: {
  actorId: string;
  targetUserId?: string | null;
  action: string;
  details?: Record<string, unknown>;
}) {
  const supabase = createSupabaseAdmin();
  await supabase.from("admin_audit_logs").insert({
    actor_user_id: input.actorId,
    target_user_id: input.targetUserId ?? null,
    action: input.action,
    details: input.details ?? {},
  });
}

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
  if (plan !== "__keep__" && !PLANS.has(plan)) throw new Error("Plan invalide");
  if (!ROLES.has(role)) throw new Error("Rôle invalide");

  if (userId === actor.id && role !== "admin") {
    throw new Error("Vous ne pouvez pas retirer votre propre rôle admin");
  }

  const supabase = createSupabaseAdmin();
  const { data: target, error: findErr } = await supabase
    .from("user_profiles")
    .select("user_id, role, plan, extra_provider_accounts, plan_renews_on, suspended")
    .eq("user_id", userId)
    .maybeSingle();

  if (findErr) throw new Error(findErr.message);
  if (!target) throw new Error("Vendeur introuvable");

  const nextPlan = plan === "__keep__" ? target.plan : plan;
  const paid = nextPlan === "pro" || nextPlan === "business";
  const isActivation = paid && (
    target.plan !== nextPlan ||
    !target.plan_renews_on ||
    target.plan_renews_on < todayStr() ||
    target.suspended
  );
  const planRenewsOn = !paid
    ? null
    : isActivation
      ? activatePlanFor30Days(todayStr())
      : target.plan_renews_on;

  const { error } = await supabase
    .from("user_profiles")
    .update({
      plan: nextPlan,
      role,
      extra_provider_accounts: nextPlan === "pro"
        ? (plan === "__keep__" ? Number(target.extra_provider_accounts ?? 0) : extras)
        : 0,
      plan_renews_on: planRenewsOn,
      plan_renewal_notified_on: null,
      suspended: paid && isActivation ? false : target.suspended,
    })
    .eq("user_id", userId);

  if (error) throw new Error(error.message);

  await logAdminAction({
    actorId: actor.id,
    targetUserId: userId,
    action: "account_settings_updated",
    details: { previousRole: target.role, role, plan: nextPlan },
  });

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

  await logAdminAction({
    actorId: actor.id,
    targetUserId: userId,
    action: suspended ? "account_suspended" : "account_unsuspended",
  });

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
    String(formData.get("occurred_on") ?? "").trim() || todayStr();
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
    .select("user_id, plan, extra_provider_accounts, plan_renews_on, suspended")
    .eq("user_id", resellerId)
    .maybeSingle();

  if (findErr) throw new Error(findErr.message);
  if (!target) throw new Error("Vendeur introuvable");

  const recentCutoff = new Date(Date.now() - 2 * 60 * 1000).toISOString();
  const { data: recentDuplicate } = await supabase
    .from("platform_payments")
    .select("id")
    .eq("reseller_user_id", resellerId)
    .eq("kind", kindRaw)
    .eq("amount", amount)
    .gte("created_at", recentCutoff)
    .limit(1);
  if ((recentDuplicate ?? []).length > 0) {
    throw new Error("Un encaissement identique vient déjà d’être enregistré. Attendez deux minutes avant de réessayer.");
  }

  let appliedPlan: string | null = null;
  let appliedExtras: number | null = null;

  if (applyPlan) {
    if (kindRaw === "extra_accounts") {
      const hasActivePro =
        target.plan === "pro" &&
        !target.suspended &&
        Boolean(target.plan_renews_on) &&
        target.plan_renews_on >= todayStr();
      if (!hasActivePro) {
        throw new Error("Les comptes extras nécessitent un pack Pro actif. Activez ou renouvelez d’abord le pack Pro.");
      }
      const currentExtras = Number(target.extra_provider_accounts ?? 0);
      const add = extras > 0 ? extras : 1;
      plan = "pro";
      extras = currentExtras + add;
    }

    const paid = plan === "pro" || plan === "business";
    const planRenewsOn = kindRaw === "extra_accounts"
      ? target.plan_renews_on
      : paid
        ? extendPlanRenewal(target.plan_renews_on, occurredOn)
        : null;

    appliedPlan = plan;
    appliedExtras = plan === "pro" ? extras : 0;
    target.plan_renews_on = planRenewsOn;
  }

  const { error } = await supabase.rpc("record_platform_payment_atomic", {
    p_actor: actor.id,
    p_reseller: resellerId,
    p_amount: amount,
    p_kind: kindRaw,
    p_note: note,
    p_occurred_on: occurredOn,
    p_apply_plan: applyPlan,
    p_plan: appliedPlan ?? target.plan,
    p_extras: appliedExtras ?? Number(target.extra_provider_accounts ?? 0),
    p_renews_on: target.plan_renews_on,
  });

  if (error) throw new Error(error.message);

  revalidatePath(`/admin/vendeurs/${resellerId}`);
  revalidatePath("/admin/vendeurs");
  revalidatePath("/admin/finances");
  revalidatePath("/admin/dashboard");
}
