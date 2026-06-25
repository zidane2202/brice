import { AbonnementsView } from "@/components/abonnements/AbonnementsView";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import { getUser } from "@/lib/supabase-server";
import type { ProviderAccount } from "@/lib/types";

export const dynamic = "force-dynamic";

async function getAccounts(userId: string) {
  const supabase = createSupabaseAdmin();
  const { data, error } = await supabase
    .from("provider_accounts")
    .select(`id, service_name, label, max_slots, start_date, end_date, duration_months, cost, status, created_at,
      account_slots(id, client_subscriptions(id, status, end_date))`)
    .eq("user_id", userId)
    .order("end_date", { ascending: true });

  if (error) throw new Error(error.message);
  const today = new Date().toISOString().slice(0, 10);
  return (data ?? []).map((a) => {
    const slots =
      (a as {
        account_slots?: { id: string; client_subscriptions?: { id: string; status: string; end_date: string }[] }[];
      }).account_slots ?? [];
    const used = slots.filter((slot) =>
      (slot.client_subscriptions ?? []).some(
        (s) => (s.status === "active" || s.status === "grace") && s.end_date >= today
      )
    ).length;
    return {
      ...a,
      used_slots: used,
    } as unknown as ProviderAccount & { used_slots: number };
  });
}

async function getBalance(userId: string) {
  const supabase = createSupabaseAdmin();
  const { data } = await supabase
    .from("transactions")
    .select("kind, amount")
    .eq("user_id", userId)
    .eq("affects_balance", true);
  return (data ?? []).reduce((sum, t) => {
    const amt = Number(t.amount ?? 0);
    return sum + (t.kind === "income" ? amt : -amt);
  }, 0);
}

export default async function AbonnementsPage() {
  const user = await getUser();
  if (!user) return null;

  const [accounts, balance] = await Promise.all([getAccounts(user.id), getBalance(user.id)]);

  // Stable numbering by created_at
  const serviceCount: Record<string, number> = {};
  for (const a of accounts) {
    serviceCount[a.service_name] = (serviceCount[a.service_name] ?? 0) + 1;
  }
  const serviceIndex: Record<string, number> = {};
  const displayNames: Record<string, string> = {};
  for (const a of [...accounts].sort(
    (x, y) => new Date(x.created_at).getTime() - new Date(y.created_at).getTime()
  )) {
    if (serviceCount[a.service_name] > 1) {
      serviceIndex[a.service_name] = (serviceIndex[a.service_name] ?? 0) + 1;
      displayNames[a.id] = `${a.service_name} (${serviceIndex[a.service_name]})`;
    } else {
      displayNames[a.id] = a.service_name;
    }
  }

  return <AbonnementsView accounts={accounts} displayNames={displayNames} balance={balance} />;
}
