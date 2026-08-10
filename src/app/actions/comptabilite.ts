"use server";

import {
  PLAN_LIMIT_COMPTA,
  canUseFullCompta,
  normalizePlan,
  planLimitError,
} from "@/lib/plans";
import { EXPENSE_CATEGORIES } from "@/lib/comptabilite";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import { requireActiveSeller } from "@/lib/authz";
import { todayDateOnly } from "@/lib/dates";
import { pickInvoiceToCancel } from "@/lib/invoice-reversal";
import { sumSellerBalance } from "@/lib/ledger-sql";
import type { ExpenseCategory } from "@/lib/types";
import { revalidatePath } from "next/cache";

const CATEGORY_SET = new Set(EXPENSE_CATEGORIES.map((c) => c.value));

function req(formData: FormData, key: string): string {
  const v = String(formData.get(key) ?? "").trim();
  if (!v) throw new Error(`Champ requis : ${key}`);
  return v;
}

export async function addManualExpense(formData: FormData) {
  const { user } = await requireActiveSeller();

  const supabase = createSupabaseAdmin();
  const { data: profile } = await supabase
    .from("user_profiles")
    .select("plan")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!canUseFullCompta(normalizePlan(profile?.plan))) {
    throw planLimitError(
      PLAN_LIMIT_COMPTA,
      "Les dépenses manuelles et exports avancés sont réservés aux plans Pro et Business."
    );
  }

  const amount = parseFloat(req(formData, "amount"));
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("Montant invalide");
  }

  const category = req(formData, "category") as ExpenseCategory;
  if (!CATEGORY_SET.has(category)) throw new Error("Catégorie invalide");

  const note = String(formData.get("label") ?? "").trim();
  if (category === "other" && !note) {
    throw new Error("Une note est obligatoire pour la catégorie Autre");
  }

  const occurredOn =
    String(formData.get("occurred_on") ?? "").trim() ||
    todayDateOnly();
  const label =
    note ||
    EXPENSE_CATEGORIES.find((c) => c.value === category)?.label ||
    "Dépense";

  const balance = await sumSellerBalance(supabase, user.id);

  if (balance < amount) {
    throw new Error(
      `Solde insuffisant : ${balance.toLocaleString("en-US").replace(/,/g, " ")} FCFA disponibles, ${amount
        .toLocaleString("en-US")
        .replace(/,/g, " ")} FCFA requis.`
    );
  }

  const { error } = await supabase.from("transactions").insert({
    user_id: user.id,
    kind: "outflow",
    source: "manual_expense",
    funded_by: "balance",
    affects_balance: true,
    amount,
    category,
    label,
    occurred_on: occurredOn,
  });

  if (error) throw new Error(error.message);

  revalidatePath("/comptabilite");
  revalidatePath("/dashboard");
}

export async function reverseTransaction(transactionId: string, reason: string) {
  const { user } = await requireActiveSeller();
  const cleanReason = reason.trim();
  if (cleanReason.length < 3 || cleanReason.length > 300) throw new Error("Indiquez une raison entre 3 et 300 caractères.");
  const db = createSupabaseAdmin();
  const { data: profile } = await db.from("user_profiles").select("plan").eq("user_id", user.id).maybeSingle();
  if (!canUseFullCompta(normalizePlan(profile?.plan))) {
    throw planLimitError(PLAN_LIMIT_COMPTA, "Les annulations d’écritures sont réservées aux plans Pro et Business.");
  }
  const { data: original, error: findError } = await db.from("transactions").select("*").eq("id", transactionId).eq("user_id", user.id).single();
  if (findError || !original) throw new Error("Écriture introuvable.");
  if (original.source === "reversal") throw new Error("Une annulation ne peut pas être annulée.");
  const { data: existing } = await db.from("transactions").select("id").eq("reversed_transaction_id", transactionId).maybeSingle();
  if (existing) throw new Error("Cette écriture est déjà annulée.");
  const { error } = await db.from("transactions").insert({
    user_id: user.id, kind: original.kind === "income" ? "outflow" : "income", source: "reversal",
    funded_by: original.funded_by, affects_balance: original.affects_balance, amount: original.amount,
    client_id: original.client_id, subscription_id: original.subscription_id, account_id: original.account_id,
    label: `Annulation · ${original.label}`, category: original.category, occurred_on: todayDateOnly(),
    reversed_transaction_id: original.id, reversal_reason: cleanReason,
  });
  if (error) throw new Error(error.message);
  if (original.invoice_id) {
    await db.from("invoices").update({ status: "cancelled" }).eq("id", original.invoice_id).eq("user_id", user.id);
  } else if (original.subscription_id) {
    const { data: invoices } = await db
      .from("invoices")
      .select("id, amount, kind, status, subscription_id")
      .eq("user_id", user.id)
      .eq("subscription_id", original.subscription_id);
    const target = pickInvoiceToCancel(invoices ?? [], {
      amount: Number(original.amount),
      source: original.source,
      subscription_id: original.subscription_id,
      invoice_id: original.invoice_id ?? null,
    });
    if (target) {
      await db.from("invoices").update({ status: "cancelled" }).eq("id", target.id).eq("user_id", user.id);
    }
  }
  revalidatePath("/comptabilite"); revalidatePath("/dashboard");
}
