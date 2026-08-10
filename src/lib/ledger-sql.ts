import type { SupabaseClient } from "@supabase/supabase-js";

function readSum(data: unknown): number {
  const row = Array.isArray(data) ? data[0] : data;
  if (!row || typeof row !== "object") return 0;
  return Number((row as { sum?: number }).sum ?? 0);
}

export async function sumSellerBalance(supabase: SupabaseClient, userId: string) {
  const rpc = await supabase.rpc("seller_ledger_balance", { p_user: userId });
  if (!rpc.error && rpc.data != null) return Number(rpc.data);
  const [{ data: income }, { data: outflow }] = await Promise.all([
    supabase.from("transactions").select("amount.sum()").eq("user_id", userId).eq("affects_balance", true).eq("kind", "income"),
    supabase.from("transactions").select("amount.sum()").eq("user_id", userId).eq("affects_balance", true).eq("kind", "outflow"),
  ]);
  return readSum(income) - readSum(outflow);
}

export async function sumSellerPeriod(supabase: SupabaseClient, userId: string, from: string, to: string) {
  const rpc = await supabase.rpc("seller_period_kpis", { p_user: userId, p_from: from, p_to: to });
  if (!rpc.error && rpc.data) {
    const row = Array.isArray(rpc.data) ? rpc.data[0] : rpc.data;
    const income = Number((row as { income?: number })?.income ?? 0);
    const expenses = Number((row as { expenses?: number })?.expenses ?? 0);
    return { income, expenses, margin: income - expenses };
  }
  const [{ data: income }, { data: expenses }] = await Promise.all([
    supabase.from("transactions").select("amount.sum()").eq("user_id", userId).eq("kind", "income").gte("occurred_on", from).lte("occurred_on", to),
    supabase.from("transactions").select("amount.sum()").eq("user_id", userId).eq("kind", "outflow").eq("affects_balance", true).gte("occurred_on", from).lte("occurred_on", to),
  ]);
  const inc = readSum(income);
  const exp = readSum(expenses);
  return { income: inc, expenses: exp, margin: inc - exp };
}

export async function sumPlatformCash(supabase: SupabaseClient, from: string, to: string) {
  const rpc = await supabase.rpc("platform_cash_between", { p_from: from, p_to: to });
  if (rpc.error || rpc.data == null) {
    throw new Error("KPI caisse indisponible. Exécutez supabase/audit2-hardening.sql.");
  }
  return Number(rpc.data);
}
