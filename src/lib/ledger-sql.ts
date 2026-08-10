import type { SupabaseClient } from "@supabase/supabase-js";

function readSum(data: unknown): number {
  const row = Array.isArray(data) ? data[0] : data;
  if (!row || typeof row !== "object") return 0;
  return Number((row as { sum?: number }).sum ?? 0);
}

export async function sumSellerBalance(supabase: SupabaseClient, userId: string) {
  const rpc = await supabase.rpc("seller_ledger_balance", { p_user: userId });
  if (rpc.error || rpc.data == null) {
    throw new Error("Solde indisponible. Exécutez supabase/audit2-hardening.sql.");
  }
  return Number(rpc.data);
}

export async function sumSellerPeriod(supabase: SupabaseClient, userId: string, from: string, to: string) {
  const rpc = await supabase.rpc("seller_period_kpis", { p_user: userId, p_from: from, p_to: to });
  if (rpc.error || !rpc.data) {
    throw new Error("KPI période indisponibles. Exécutez supabase/audit2-hardening.sql.");
  }
  const row = Array.isArray(rpc.data) ? rpc.data[0] : rpc.data;
  const income = Number((row as { income?: number })?.income ?? 0);
  const expenses = Number((row as { expenses?: number })?.expenses ?? 0);
  return { income, expenses, margin: income - expenses };
}

export async function sumPlatformCash(supabase: SupabaseClient, from: string, to: string) {
  const rpc = await supabase.rpc("platform_cash_between", { p_from: from, p_to: to });
  if (rpc.error || rpc.data == null) {
    throw new Error("KPI caisse indisponible. Exécutez supabase/audit2-hardening.sql.");
  }
  return Number(rpc.data);
}

/** @internal test helper — keep sum parser for unit tests */
export function __readSumForTests(data: unknown) {
  return readSum(data);
}
