"use server";

import {
  PLAN_LIMIT_COMPTA,
  canUseFullCompta,
  normalizePlan,
  planLimitError,
} from "@/lib/plans";
import { EXPENSE_CATEGORIES } from "@/lib/comptabilite";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import { getUser } from "@/lib/supabase-server";
import type { ExpenseCategory } from "@/lib/types";
import { revalidatePath } from "next/cache";

const CATEGORY_SET = new Set(EXPENSE_CATEGORIES.map((c) => c.value));

function req(formData: FormData, key: string): string {
  const v = String(formData.get(key) ?? "").trim();
  if (!v) throw new Error(`Champ requis : ${key}`);
  return v;
}

export async function addManualExpense(formData: FormData) {
  const user = await getUser();
  if (!user) throw new Error("Non authentifié");

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
    new Date().toISOString().slice(0, 10);
  const label =
    note ||
    EXPENSE_CATEGORIES.find((c) => c.value === category)?.label ||
    "Dépense";

  const { data: txs } = await supabase
    .from("transactions")
    .select("kind, amount")
    .eq("user_id", user.id)
    .eq("affects_balance", true);

  const balance = (txs ?? []).reduce((sum, t) => {
    const amt = Number(t.amount ?? 0);
    return sum + (t.kind === "income" ? amt : -amt);
  }, 0);

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
