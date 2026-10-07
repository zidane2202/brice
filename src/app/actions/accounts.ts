"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import { requireActiveSeller } from "@/lib/authz";
import { addMonths, todayDateOnly, toDateInputValue } from "@/lib/dates";
import { decryptCredential, encryptCredential } from "@/lib/provider-credentials";
import { sumSellerBalance } from "@/lib/ledger-sql";
import { countOccupiedSlots } from "@/lib/slots";
import { ACCOUNT_IMPORT_MAX_ROWS, accountPeriod, normalizeAccountRow } from "@/lib/account-import";
import {
  PLAN_LIMIT_ACCOUNT,
  PLAN_LIMIT_SLOTS,
  accountCapFor,
  clientsPerAccountFor,
  effectivePlan,
  isAdminProfile,
  planLimitError,
} from "@/lib/plans";

function req(fd: FormData, key: string) {
  const v = String(fd.get(key) ?? "").trim();
  if (!v) throw new Error(`${key} requis`);
  return v;
}

type NewAccount = {
  service_name: string;
  label: string | null;
  account_email: string | null;
  account_password: string | null;
  start_date: string;
  end_date: string;
  duration_months: number;
  max_slots: number;
  cost: number | null;
};

async function insertProviderAccount(supabase: ReturnType<typeof createSupabaseAdmin>, userId: string, input: NewAccount) {
  const { data: account, error } = await supabase
    .from("provider_accounts")
    .insert({ ...input, user_id: userId, account_password: encryptCredential(input.account_password), status: "active" })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  const slots = Array.from({ length: input.max_slots }, (_, i) => ({
    account_id: account.id,
    slot_number: i + 1,
    label: `Profil ${i + 1}`,
  }));
  const { error: slotError } = await supabase.from("account_slots").insert(slots);
  if (slotError) {
    await supabase.from("provider_accounts").delete().eq("id", account.id).eq("user_id", userId);
    throw new Error(slotError.message);
  }
  return account;
}

/** Import de comptes existants : pas d'écriture comptable (l'achat a déjà eu lieu), le coût sert aux renouvellements. */
export async function importProviderAccounts(input: Array<Record<string, unknown>>) {
  const { user } = await requireActiveSeller();
  if (!Array.isArray(input)) throw new Error("Import invalide.");
  const rows = input.map(normalizeAccountRow);
  if (rows.length < 1 || rows.length > ACCOUNT_IMPORT_MAX_ROWS) {
    throw new Error(`L'import doit contenir entre 1 et ${ACCOUNT_IMPORT_MAX_ROWS} comptes.`);
  }

  const supabase = createSupabaseAdmin();
  const { data: profile } = await supabase
    .from("user_profiles")
    .select("plan, role, extra_provider_accounts, plan_renews_on, created_at")
    .eq("user_id", user.id)
    .maybeSingle();
  const plan = effectivePlan(profile);
  const cap = accountCapFor(profile);
  const slotCap = clientsPerAccountFor(profile);

  const { data: existing } = await supabase
    .from("provider_accounts")
    .select("service_name, account_email, status")
    .eq("user_id", user.id);
  let activeCount = (existing ?? []).filter((a) => a.status === "active").length;
  const known = new Set(
    (existing ?? []).filter((a) => a.account_email).map((a) => `${a.service_name.toLowerCase()}|${String(a.account_email).toLowerCase()}`)
  );

  const today = todayDateOnly();
  const results: Array<{ line: number; ok: boolean; message: string }> = [];
  for (let index = 0; index < rows.length; index++) {
    const row = rows[index];
    const line = index + 2;
    if (!row.service_name) { results.push({ line, ok: false, message: "Service manquant" }); continue; }
    const maxSlots = Number(row.max_slots);
    if (!Number.isInteger(maxSlots) || maxSlots < 1) { results.push({ line, ok: false, message: "Nombre de profils manquant" }); continue; }
    if (maxSlots > slotCap) { results.push({ line, ok: false, message: `Votre pack ${plan} autorise au maximum ${slotCap} profils par compte` }); continue; }
    if (activeCount >= cap) { results.push({ line, ok: false, message: `Limite de ${cap} compte(s) atteinte sur le pack ${plan}` }); continue; }
    const key = row.account_email ? `${row.service_name.toLowerCase()}|${row.account_email}` : "";
    if (key && known.has(key)) { results.push({ line, ok: false, message: `${row.service_name} (${row.account_email}) est déjà enregistré` }); continue; }

    const period = accountPeriod(row, today);
    try {
      await insertProviderAccount(supabase, user.id, {
        service_name: row.service_name,
        label: row.label ?? null,
        account_email: row.account_email ?? null,
        account_password: row.account_password ?? null,
        ...period,
        max_slots: maxSlots,
        cost: row.cost ? Number(row.cost) : null,
      });
      activeCount++;
      if (key) known.add(key);
      results.push({ line, ok: true, message: period.end_date < today ? "Compte importé (déjà expiré)" : "Compte importé" });
    } catch (caught) {
      results.push({ line, ok: false, message: caught instanceof Error ? caught.message : "Échec de l'import" });
    }
  }

  revalidatePath("/abonnements");
  revalidatePath("/clients");
  revalidatePath("/dashboard");
  return { imported: results.filter((item) => item.ok).length, failed: results.filter((item) => !item.ok).length, results };
}

export async function addProviderAccount(formData: FormData) {
  const { user } = await requireActiveSeller();

  const serviceName = req(formData, "service_name");
  const startDate = req(formData, "start_date");
  const durationMonths = parseInt(req(formData, "duration_months"));
  let maxSlots = parseInt(req(formData, "max_slots"));
  const cost = formData.get("cost") ? parseFloat(String(formData.get("cost"))) : null;
  const label = String(formData.get("label") ?? "").trim() || null;
  const accountEmail = String(formData.get("account_email") ?? "").trim() || null;
  const accountPassword = String(formData.get("account_password") ?? "").trim() || null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !Number.isInteger(durationMonths) || durationMonths < 1 || durationMonths > 24) {
    throw new Error("Date ou durée invalide (1 à 24 mois).");
  }
  if (cost !== null && (!Number.isFinite(cost) || cost < 0)) throw new Error("Coût invalide.");
  const endDate = addMonths(startDate, durationMonths);

  const supabase = createSupabaseAdmin();

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("plan, role, extra_provider_accounts, plan_renews_on, created_at")
    .eq("user_id", user.id)
    .maybeSingle();

  const plan = effectivePlan(profile);
  const admin = isAdminProfile(profile);
  const cap = accountCapFor(profile);
  const slotCap = clientsPerAccountFor(profile);

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
    .select("id, max_slots, end_date, account_slots(client_subscriptions(status, end_date, grace_until))")
    .eq("user_id", user.id)
    .eq("service_name", serviceName)
    .eq("status", "active");

  const today = toDateInputValue();
  for (const acc of (admin ? [] : existing ?? []) as Array<{
    id: string;
    max_slots: number;
    end_date: string;
    account_slots?: Array<{ client_subscriptions?: Array<{ status: string; end_date: string; grace_until: string | null }> }>;
  }>) {
    if (acc.end_date < today) continue;
    const used = countOccupiedSlots(acc.account_slots ?? [], today);
    const free = acc.max_slots - used;
    if (free > 0) {
      throw new Error(
        `Tu as déjà un compte ${serviceName} avec ${free} profil${free > 1 ? "s" : ""} libre${free > 1 ? "s" : ""}. Remplis-le avant d'en créer un autre.`
      );
    }
  }

  const fundedBy: "balance" | "personal" = formData.get("funded_by") === "balance" ? "balance" : "personal";
  if (fundedBy === "balance" && cost != null && cost > 0) {
    const balance = await sumSellerBalance(supabase, user.id);
    if (balance < cost) {
      throw new Error(
        `Solde insuffisant : ${balance.toLocaleString("en-US").replace(/,/g, " ")} FCFA disponibles, ${cost
          .toLocaleString("en-US")
          .replace(/,/g, " ")} FCFA requis.`
      );
    }
  }

  const account = await insertProviderAccount(supabase, user.id, {
    service_name: serviceName,
    label,
    account_email: accountEmail,
    account_password: accountPassword,
    start_date: startDate,
    end_date: endDate,
    duration_months: durationMonths,
    max_slots: maxSlots,
    cost,
  });

  if (cost != null && cost > 0) {
    const tag = fundedBy === "personal" ? " (fond personnel)" : "";
    await supabase.from("transactions").insert({
      user_id: user.id,
      kind: "outflow",
      source: "account_renewal",
      funded_by: fundedBy,
      affects_balance: fundedBy === "balance",
      amount: cost,
      account_id: account.id,
      category: "account_renewal",
      occurred_on: todayDateOnly(),
      label: `Achat compte ${serviceName}${label ? ` (${label})` : ""}${tag}`,
    });
  }

  revalidatePath("/abonnements");
  revalidatePath("/dashboard");
  revalidatePath("/comptabilite");
}

export async function updateProviderAccountLabel(formData: FormData) {
  const { user } = await requireActiveSeller();

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
  const { user } = await requireActiveSeller();

  const id = req(formData, "id");
  const durationMonths = parseInt(req(formData, "duration_months") || "1");
  const fundedByRaw = String(formData.get("funded_by") ?? "personal");
  const fundedBy: "balance" | "personal" = fundedByRaw === "balance" ? "balance" : "personal";
  if (!Number.isInteger(durationMonths) || durationMonths < 1 || durationMonths > 24) {
    throw new Error("Durée invalide (1 à 24 mois).");
  }

  const supabase = createSupabaseAdmin();

  const { data: account } = await supabase
    .from("provider_accounts")
    .select("cost, service_name, label, end_date")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (!account) throw new Error("Compte introuvable.");
  const baseDate = new Date(`${account.end_date}T23:59:59`) > new Date()
    ? account.end_date
    : toDateInputValue();
  const newEndDate = addMonths(baseDate, durationMonths);

  if (fundedBy === "balance" && account?.cost && account.cost > 0) {
    const balance = await sumSellerBalance(supabase, user.id);
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
  revalidatePath("/comptabilite");
}

export async function updateProviderAccountStatus(formData: FormData) {
  const { user } = await requireActiveSeller();

  const id = req(formData, "id");
  const status = req(formData, "status");
  if (!new Set(["active", "inactive"]).has(status)) throw new Error("Statut invalide.");
  const supabase = createSupabaseAdmin();

  const { error } = await supabase
    .from("provider_accounts")
    .update({ status })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) throw new Error(error.message);
  revalidatePath("/abonnements");
}

export async function revealAccountCredentials(accountId: string) {
  const { user } = await requireActiveSeller();
  const id = String(accountId ?? "").trim();
  if (!id) throw new Error("Compte manquant");
  const supabase = createSupabaseAdmin();
  const { data, error } = await supabase
    .from("provider_accounts")
    .select("account_email, account_password")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Compte introuvable");
  return {
    email: data.account_email ?? null,
    password: decryptCredential(data.account_password),
  };
}
