import { StatsCard } from "@/components/StatsCard";
import { UrgencyTable } from "@/components/UrgencyTable";
import { RevenueChart } from "@/components/RevenueChart";
import { daysUntil } from "@/lib/dates";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import { getUser } from "@/lib/supabase-server";
import type { ClientSubscription, ProviderAccount } from "@/lib/types";

export const dynamic = "force-dynamic";

async function getDashboardData(userId: string) {
  const supabase = createSupabaseAdmin();

  const [subsResult, accountsResult] = await Promise.all([
    supabase
      .from("client_subscriptions")
      .select(`
        id, start_date, end_date, price, status,
        client:clients(id, first_name, last_name, phone),
        slot:account_slots(
          id, slot_number, label,
          account:provider_accounts(id, service_name)
        )
      `)
      .eq("user_id", userId)
      .order("end_date", { ascending: true }),
    supabase
      .from("provider_accounts")
      .select("id, max_slots, account_slots(id)")
      .eq("user_id", userId)
      .eq("status", "active"),
  ]);

  const subscriptions = (subsResult.data ?? []) as unknown as ClientSubscription[];
  const accounts = (accountsResult.data ?? []) as unknown as (ProviderAccount & { account_slots: { id: string }[] })[];

  const activeClients = subscriptions.filter((s) => s.status === "active");
  const urgent = activeClients.filter((s) => {
    const d = daysUntil(s.end_date);
    return d >= 0 && d <= 3;
  });

  const totalSlots = accounts.reduce((sum, a) => sum + a.max_slots, 0);
  const usedSlots = activeClients.length;

  const now = new Date();
  const monthData = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
    const month = d.toLocaleDateString("fr-FR", { month: "short" });
    const revenue = activeClients
      .filter((s) => {
        const sd = new Date(s.start_date);
        return sd.getFullYear() === d.getFullYear() && sd.getMonth() === d.getMonth();
      })
      .reduce((sum, s) => sum + (s.price ?? 0), 0);
    return { month, revenue };
  });

  const monthlyRevenue = activeClients
    .filter((s) => {
      const sd = new Date(s.start_date);
      return sd.getFullYear() === now.getFullYear() && sd.getMonth() === now.getMonth();
    })
    .reduce((sum, s) => sum + (s.price ?? 0), 0);

  return { activeClients, urgent, totalSlots, usedSlots, monthData, monthlyRevenue };
}

export default async function DashboardPage() {
  const user = await getUser();
  if (!user) return null;

  const { activeClients, urgent, totalSlots, usedSlots, monthData, monthlyRevenue } =
    await getDashboardData(user.id);

  return (
    <>
      <div>
        <p className="eyebrow">Aperçu</p>
        <h1>Dashboard</h1>
      </div>

      <div className="stats-grid">
        <StatsCard label="Clients actifs" value={activeClients.length} />
        <StatsCard label="Revenus du mois (FCFA)" value={monthlyRevenue.toLocaleString()} accent />
        <StatsCard label="À relancer (≤ 3j)" value={urgent.length} accent={urgent.length > 0} />
        <StatsCard label="Slots occupés" value={`${usedSlots}/${totalSlots}`} />
      </div>

      <div className="panel">
        <div className="section-head">
          <div>
            <p className="eyebrow">Priorité</p>
            <h2>Clients à relancer</h2>
          </div>
          <span>{urgent.length} rappel(s)</span>
        </div>
        <UrgencyTable subscriptions={urgent} />
      </div>

      <div className="panel">
        <div>
          <p className="eyebrow">Finances</p>
          <h2>Revenus sur 6 mois</h2>
        </div>
        <RevenueChart data={monthData} />
      </div>
    </>
  );
}
