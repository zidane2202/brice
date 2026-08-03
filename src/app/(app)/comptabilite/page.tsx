import { AddExpenseForm } from "@/components/comptabilite/AddExpenseForm";
import { ComptaView } from "@/components/comptabilite/ComptaView";
import { computeBalance, computePeriodKpis, monthBounds } from "@/lib/comptabilite";
import { canUseFullCompta, normalizePlan } from "@/lib/plans";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import { getUser } from "@/lib/supabase-server";
import type { Transaction } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function ComptabilitePage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; month?: string }>;
}) {
  const user = await getUser();
  if (!user) return null;

  const sp = await searchParams;
  const now = new Date();
  const year = Number(sp.year) || now.getFullYear();
  const month = Number(sp.month) || now.getMonth() + 1;
  const { from, to } = monthBounds(year, month - 1);

  const supabase = createSupabaseAdmin();
  const [profileRes, allBal, periodTx] = await Promise.all([
    supabase
      .from("user_profiles")
      .select("plan")
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase
      .from("transactions")
      .select("kind, amount, affects_balance")
      .eq("user_id", user.id)
      .eq("affects_balance", true),
    supabase
      .from("transactions")
      .select("*")
      .eq("user_id", user.id)
      .gte("occurred_on", from)
      .lte("occurred_on", to)
      .order("occurred_on", { ascending: false })
      .order("created_at", { ascending: false }),
  ]);

  const fullCompta = canUseFullCompta(normalizePlan(profileRes.data?.plan));
  const balance = computeBalance(allBal.data ?? []);
  const txs = (periodTx.data ?? []) as Transaction[];
  for (const t of txs) {
    if (!t.occurred_on) t.occurred_on = t.created_at.slice(0, 10);
  }
  const kpis = computePeriodKpis(txs, from, to);

  return (
    <ComptaView
      year={year}
      month={month}
      from={from}
      to={to}
      balance={balance}
      income={kpis.income}
      expenses={kpis.expenses}
      margin={kpis.margin}
      transactions={txs}
      fullCompta={fullCompta}
      expenseForm={
        fullCompta ? (
          <AddExpenseForm today={now.toISOString().slice(0, 10)} />
        ) : (
          <p style={{ color: "var(--sr-fg-subtle)", margin: 0, fontSize: 13 }}>
            Les dépenses manuelles et exports sont réservés au plan Pro. Passez Pro pour
            débloquer la comptabilité complète.
          </p>
        )
      }
    />
  );
}
