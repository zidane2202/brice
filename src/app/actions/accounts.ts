"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import { getUser } from "@/lib/supabase-server";
import { addMonths, toDateInputValue } from "@/lib/dates";
import {
  PLAN_LIMIT_ACCOUNT,
  PLAN_LIMIT_SLOTS,
  accountCap,
  clientsPerAccount,
  normalizePlan,
  planLimitError,
} from "@/lib/plans";

function req(fd: FormData, key: string) {
  const v = String(fd.get(key) ?? "").trim();
  if (!v) throw new Error(`${key} requis`);
  return v;
}

export async function addProviderAccount(formData: FormData) {
  const user = await getUser();
  if (!user) throw new Error("Non authentifié");

  const serviceName = req(formData, "service_name");
  const startDate = req(formData, "start_date");
  const durationMonths = parseInt(req(formData, "duration_months"));
  let maxSlots = parseInt(req(formData, "max_slots"));
  const cost = formData.get("cost") ? parseFloat(String(formData.get("cost"))) : null;
  const label = String(formData.get("label") ?? "").trim() || null;
  const accountEmail = String(formData.get("account_email") ?? "").trim() || null;
  const accountPassword = String(formData.get("account_password") ?? "").trim() || null;
  const endDate = addMonths(startDate, durationMonths);

  const supabase = createSupabaseAdmin();

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("plan, extra_provider_accounts")
    .eq("user_id", user.id)
    .maybeSingle();

  const plan = normalizePlan(profile?.plan);
  const extras = Number(profile?.extra_provider_accounts ?? 0);
  const cap = accountCap(plan, extras);
  const slotCap = clientsPerAccount(plan);

  if (!Number.isFinite(maxSlots) || maxSlots < 1) {
    throw new Error("Nombre de profils invalide");
  }
  if (maxSlots > slotCap) {
    throw planLimitError(
      PLAN_LIMIT_SLOTS,
      `Votre plan ${plan} autorise au maximum ${slotCap} clients par compte.`
    );
  }

  const { count: accountCount } = await supabase
    .from("provider_accounts")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("status", "active");

  if ((accountCount ?? 0) >= cap) {
    throw planLimitError(
      PLAN_LIMIT_ACCOUNT,
      `Limite atteinte : ${cap} compte${cap > 1 ? "s" : ""} provider sur le plan ${plan}.`
    );
  }

  const { data: existing } = await supabase
    .from("provider_accounts")
    .select("id, max_slots, end_date, account_slots(client_subscriptions(status))")
    .eq("user_id", user.id)
    .eq("service_name", serviceName)
    .eq("status", "active");

  const today = toDateInputValue();
  for (const acc of (existing ?? []) as Array<{
    id: string;
    max_slots: number;
    end_date: string;
    account_slots?: Array<{ client_subscriptions?: Array<{ status: string }> }>;
  }>) {
    if (acc.end_date < today) continue;
    const used = (acc.account_slots ?? []).filter((slot) =>
      (slot.client_subscriptions ?? []).some((s) => s.status === "active" || s.status === "grace")
    ).length;
    const free = acc.max_slots - used;
    if (free > 0) {
      throw new Error(
        `Tu as déjà un compte ${serviceName} avec ${free} profil${free > 1 ? "s" : ""} libre${free > 1 ? "s" : ""}. Remplis-le avant d'en créer un autre.`
      );
    }
  }

  const { data: account, error } = await supabase
    .from("provider_accounts")
    .insert({
      user_id: user.id,
      service_name: serviceName,
      label,
      account_email: accountEmail,
      account_password: accountPassword,
      start_date: startDate,
      end_date: endDate,
      duration_months: durationMonths,
      max_slots: maxSlots,
      cost,
      status: "active",
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);

  const slots = Array.from({ length: maxSlots }, (_, i) => ({
    account_id: account.id,
    slot_number: i + 1,
    label: `Profil ${i + 1}`,
  }));

  const { error: slotError } = await supabase.from("account_slots").insert(slots);
  if (slotError) throw new Error(slotError.message);

  revalidatePath("/abonnements");
}

export async function updateProviderAccountLabel(formData: FormData) {
  const user = await getUser();
  if (!user) throw new Error("Non authentifié");

  const id = req(formData, "id");
  const label = String(formData.get("label") ?? "").trim() || null;
  const supabase = createSupabaseAdmin();

  const { error } = await supabase
    .from("provider_accounts")
    .update({ label })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) throw new Error(error.message);
  revalidatePath("/abonnements");
}

export async function renewProviderAccount(formData: FormData) {
  const user = await getUser();
  if (!user) throw new Error("Non authentifié");

  const id = req(formData, "id");
  const currentEndDate = req(formData, "end_date");
  const durationMonths = parseInt(req(formData, "duration_months") || "1");
  const fundedByRaw = String(formData.get("funded_by") ?? "personal");
  const fundedBy: "balance" | "personal" = fundedByRaw === "balance" ? "balance" : "personal";
  const baseDate = new Date(`${currentEndDate}T00:00:00`) > new Date()
    ? currentEndDate
    : toDateInputValue();
  const newEndDate = addMonths(baseDate, durationMonths);

  const supabase = createSupabaseAdmin();

  const { data: account } = await supabase
    .from("provider_accounts")
    .select("cost, service_name, label")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (fundedBy === "balance" && account?.cost && account.cost > 0) {
    const { data: txs } = await supabase
      .from("transactions")
      .select("kind, amount")
      .eq("user_id", user.id)
      .eq("affects_balance", true);
    const balance = (txs ?? []).reduce((sum, t) => {
      const amt = Number(t.amount ?? 0);
      return sum + (t.kind === "income" ? amt : -amt);
    }, 0);
    if (balance < account.cost) {
      throw new Error(
        `Solde insuffisant : ${balance.toLocaleString("en-US").replace(/,/g, " ")} FCFA disponibles, ${account.cost
          .toLocaleString("en-US")
          .replace(/,/g, " ")} FCFA requis.`
      );
    }
  }

  const { error } = await supabase
    .from("provider_accounts")
    .update({ start_date: baseDate, end_date: newEndDate, status: "active" })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) throw new Error(error.message);

  if (account?.cost && account.cost > 0) {
    const tag = fundedBy === "personal" ? " (fond personnel)" : "";
    await supabase.from("transactions").insert({
      user_id: user.id,
      kind: "outflow",
      source: "account_renewal",
      funded_by: fundedBy,
      affects_balance: fundedBy === "balance",
      amount: account.cost,
      account_id: id,
      category: "account_renewal",
      occurred_on: toDateInputValue(),
      label: `Renouvellement ${account.service_name}${account.label ? ` (${account.label})` : ""}${tag}`,
    });
  }

  revalidatePath("/abonnements");
  revalidatePath("/dashboard");
}

export async function updateProviderAccountStatus(formData: FormData) {
  const user = await getUser();
  if (!user) throw new Error("Non authentifié");

  const id = req(formData, "id");
  const status = req(formData, "status");
  const supabase = createSupabaseAdmin();

  const { error } = await supabase
    .from("provider_accounts")
    .update({ status })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) throw new Error(error.message);
  revalidatePath("/abonnements");
}
