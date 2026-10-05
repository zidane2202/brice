"use server";

import {
  PLAN_LIMIT_COMPTA,
  canUseFullCompta,
  effectivePlan,
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
    .select("plan, role, plan_renews_on, created_at")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!canUseFullCompta(effectivePlan(profile))) {
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

export async function recordInvoicePayment(formData: FormData) {
  const { user } = await requireActiveSeller();
  const db = createSupabaseAdmin();

  const { data: profile } = await db.from("user_profiles").select("plan, role, plan_renews_on, created_at").eq("user_id", user.id).maybeSingle();
  if (!canUseFullCompta(effectivePlan(profile))) {
    throw planLimitError(PLAN_LIMIT_COMPTA, "Les encaissements sont réservés aux plans Pro et Business.");
  }

  const invoiceId = req(formData, "invoice_id");
  const amount = parseFloat(req(formData, "amount"));
  if (!Number.isFinite(amount) || amount <= 0) throw new Error("Montant invalide");

  const { data: invoice, error: invErr } = await db
    .from("invoices")
    .select("id, amount, amount_paid, status, client_id, subscription_id, number")
    .eq("id", invoiceId)
    .eq("user_id", user.id)
    .single();
  if (invErr || !invoice) throw new Error("Facture introuvable");
  if (invoice.status === "cancelled" || invoice.status === "refunded") {
    throw new Error("Impossible d'encaisser une facture annulée.");
  }

  const remaining = Number(invoice.amount) - Number(invoice.amount_paid);
  if (amount > remaining + 0.01) {
    throw new Error(`Le montant dépasse le reste dû (${Math.round(remaining)} FCFA).`);
  }

  const { error: txErr } = await db.from("transactions").insert({
    user_id: user.id,
    kind: "income",
    source: "invoice_payment",
    affects_balance: true,
    amount,
    client_id: invoice.client_id,
    subscription_id: invoice.subscription_id,
    invoice_id: invoice.id,
    label: `Encaissement facture N° ${String(invoice.number).padStart(4, "0")}`,
    occurred_on: todayDateOnly(),
  });
  if (txErr) throw new Error(txErr.message);

  const newPaid = Number(invoice.amount_paid) + amount;
  const newStatus = newPaid >= Number(invoice.amount) ? "paid" : newPaid > 0 ? "partially_paid" : "unpaid";
  const { error: updErr } = await db
    .from("invoices")
    .update({ amount_paid: newPaid, status: newStatus })
    .eq("id", invoice.id)
    .eq("user_id", user.id);
  if (updErr) throw new Error(updErr.message);

  revalidatePath("/clients");
  revalidatePath("/comptabilite");
  revalidatePath("/dashboard");
}

export async function reverseTransaction(transactionId: string, reason: string) {
  const { user } = await requireActiveSeller();
  const cleanReason = reason.trim();
  if (cleanReason.length < 3 || cleanReason.length > 300) throw new Error("Indiquez une raison entre 3 et 300 caractères.");
  const db = createSupabaseAdmin();
  const { data: profile } = await db.from("user_profiles").select("plan, role, plan_renews_on, created_at").eq("user_id", user.id).maybeSingle();
  if (!canUseFullCompta(effectivePlan(profile))) {
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
  if (original.source === "invoice_payment" && original.invoice_id) {
    const { data: inv } = await db.from("invoices").select("amount, amount_paid").eq("id", original.invoice_id).eq("user_id", user.id).single();
    if (inv) {
      const newPaid = Math.max(0, Number(inv.amount_paid) - Number(original.amount));
      const newStatus = newPaid >= Number(inv.amount) ? "paid" : newPaid > 0 ? "partially_paid" : "unpaid";
      await db.from("invoices").update({ amount_paid: newPaid, status: newStatus }).eq("id", original.invoice_id).eq("user_id", user.id);
    }
  } else if (original.invoice_id) {
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
