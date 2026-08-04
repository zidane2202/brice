import { KpiCard } from "@/components/KpiCard";
import { NextEcheancesPanel } from "@/components/NextEcheancesPanel";
import { RevenueChart } from "@/components/RevenueChart";
import { TopProvidersPanel } from "@/components/TopProvidersPanel";
import { TransactionsHistoryPanel } from "@/components/TransactionsHistoryPanel";
import { daysUntil } from "@/lib/dates";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import { getUser } from "@/lib/supabase-server";
import type { ClientSubscription, ProviderAccount, Transaction } from "@/lib/types";
import Link from "next/link";
import { OnboardingChecklist } from "@/components/OnboardingChecklist";

export const dynamic = "force-dynamic";

async function getDashboardData(userId: string) {
  const supabase = createSupabaseAdmin();

  const [subsResult, accountsResult, txResult, balanceResult, invoicesResult] = await Promise.all([
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
      .select("id, service_name, label, end_date, cost, max_slots, account_slots(id)")
      .eq("user_id", userId)
      .eq("status", "active"),
    supabase
      .from("transactions")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("transactions")
      .select("kind, amount")
      .eq("user_id", userId)
      .eq("affects_balance", true),
    supabase.from("invoices").select("kind,status,amount,service_name").eq("user_id",userId),
  ]);

  const subscriptions = (subsResult.data ?? []) as unknown as ClientSubscription[];
  const accounts = (accountsResult.data ?? []) as unknown as (ProviderAccount & { account_slots: { id: string }[] })[];
  const transactions = (txResult.data ?? []) as unknown as Transaction[];
  const balance = (balanceResult.data ?? []).reduce((sum, t) => {
    const amt = Number(t.amount ?? 0);
    return sum + (t.kind === "income" ? amt : -amt);
  }, 0);

  const today = new Date().toISOString().slice(0, 10);
  const liveAccounts = accounts.filter((a) => a.end_date >= today);
  const activeClients = subscriptions.filter(
    (s) => s.status === "active" && s.end_date >= today
  );
  const expiredClients = subscriptions.filter((s) => s.status === "cancelled" || (s.status !== "grace" && s.end_date < today));
  const graceClients = subscriptions.filter((s) => s.status === "grace");
  const urgent = activeClients.filter((s) => {
    const d = daysUntil(s.end_date);
    return d >= 0 && d <= 3;
  });
  const urgentAccounts = liveAccounts.filter((a) => {
    const d = daysUntil(a.end_date);
    return d >= 0 && d <= 3;
  });

  const totalSlots = liveAccounts.reduce((sum, a) => sum + a.max_slots, 0);
  const usedSlots = activeClients.length;

  const now = new Date();
  const monthData = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
    const month = d.toLocaleDateString("fr-FR", { month: "short" });
    const revenue = subscriptions
      .filter((s) => {
        const sd = new Date(s.start_date);
        return sd.getFullYear() === d.getFullYear() && sd.getMonth() === d.getMonth();
      })
      .reduce((sum, s) => sum + (s.price ?? 0), 0);
    return { month, revenue };
  });

  const monthlyRevenue = subscriptions
    .filter((s) => {
      const sd = new Date(s.start_date);
      return sd.getFullYear() === now.getFullYear() && sd.getMonth() === now.getMonth();
    })
    .reduce((sum, s) => sum + (s.price ?? 0), 0);

  const activeAccounts = liveAccounts.length;
  const freeSlots = totalSlots - usedSlots;
  const invoices = invoicesResult.data ?? [];
  const paidInvoices = invoices.filter((invoice) => invoice.status === "paid");
  const renewalInvoices = paidInvoices.filter((invoice) => invoice.kind === "renewal");
  const renewalRate = paidInvoices.length ? Math.round((renewalInvoices.length / paidInvoices.length) * 100) : 0;
  const forecast = (days: number) => subscriptions.filter((subscription) => {
    if (subscription.status === "cancelled") return false;
    const remaining = daysUntil(subscription.end_date);
    return remaining >= 0 && remaining <= days;
  }).reduce((sum, subscription) => sum + Number(subscription.price ?? 0), 0);
  const totalAccountCost = liveAccounts.reduce((sum, account) => sum + Number(account.cost ?? 0), 0);
  const netProfit = paidInvoices.reduce((sum, invoice) => sum + Number(invoice.amount ?? 0), 0) - totalAccountCost;
  const serviceProfit = Array.from(paidInvoices.reduce((map, invoice) => map.set(invoice.service_name, (map.get(invoice.service_name) ?? 0) + Number(invoice.amount ?? 0)), new Map<string,number>())).sort((a,b)=>b[1]-a[1]).slice(0,5);

  return {
    subscriptions,
    activeClients,
    urgent,
    urgentAccounts,
    totalSlots,
    usedSlots,
    freeSlots,
    activeAccounts,
    monthData,
    monthlyRevenue,
    transactions,
    balance,
    expiredClients,
    graceClients,
    renewalRate,
    forecast7: forecast(7),
    forecast30: forecast(30),
    netProfit,
    serviceProfit,
  };
}

export default async function DashboardPage() {
  const user = await getUser();
  if (!user) return null;

  const {
    subscriptions,
    urgent,
    urgentAccounts,
    usedSlots,
    freeSlots,
    activeAccounts,
    monthData,
    monthlyRevenue,
    transactions,
    balance,
    expiredClients,
    graceClients,
    renewalRate,
    forecast7,
    forecast30,
    netProfit,
    serviceProfit,
  } = await getDashboardData(user.id);
  const urgentTotal = urgent.length + urgentAccounts.length;
  const supabase = createSupabaseAdmin();
  const { data: profile } = await supabase.from("user_profiles").select("first_name,company_name").eq("user_id", user.id).maybeSingle();

  return (
    <>
      <div className="dash-header">
        <p className="dash-eyebrow">Vue d&apos;ensemble</p>
        <h1>Dashboard</h1>
        <p className="dash-header-sub">
          {activeAccounts > 0 ? (
            <>
              <strong style={{ color: "var(--sr-fg)" }}>{activeAccounts}</strong> compte{activeAccounts > 1 ? "s" : ""} actif{activeAccounts > 1 ? "s" : ""},
              {" "}
              <strong style={{ color: "var(--sr-fg)" }}>{usedSlots}</strong> profil{usedSlots > 1 ? "s" : ""} vendu{usedSlots > 1 ? "s" : ""}
              {urgentTotal > 0 ? (
                <>
                  {". "}
                  <strong style={{ color: "var(--sr-warning)" }}>
                    {urgentTotal} relance{urgentTotal > 1 ? "s" : ""}
                  </strong>{" "}
                  dans les 3 jours.
                </>
              ) : (
                ". Tout est à jour."
              )}
            </>
          ) : (
            <>Ajoutez un premier compte fournisseur pour commencer.</>
          )}
        </p>
      </div>

      <div className="stats-grid">
        <KpiCard
          label="Solde"
          value={balance}
          unit="FCFA"
          accent
          tone={balance < 0 ? "danger" : "neutral"}
          sub={balance < 0 ? "en négatif" : "disponible"}
        />
        <KpiCard
          label="Revenus du mois"
          value={monthlyRevenue}
          unit="FCFA"
        />
        <KpiCard
          label="Profils occupés"
          value={usedSlots}
          sub={`${freeSlots} libre${freeSlots > 1 ? "s" : ""} · détails dans Mes abonnements`}
        />
        <KpiCard
          label="À relancer (≤ 3j)"
          value={urgentTotal}
          tone={urgentTotal > 0 ? "warning" : "neutral"}
          sub={
            urgentTotal > 0
              ? `${urgent.length} client${urgent.length > 1 ? "s" : ""}, ${urgentAccounts.length} compte${urgentAccounts.length > 1 ? "s" : ""}`
              : "rien d'urgent"
          }
        />
      </div>

      <OnboardingChecklist hasProfile={Boolean(profile?.first_name || profile?.company_name)} accounts={activeAccounts} clients={usedSlots} />

      <section className="panel commercial-panel">
        <div className="section-head"><div><p className="eyebrow">Pilotage</p><h2>Performance commerciale</h2></div></div>
        <div className="commercial-kpis"><KpiCard label="Bénéfice net estimé" value={netProfit} unit="FCFA" tone={netProfit<0?"danger":"neutral"}/><KpiCard label="Taux de renouvellement" value={renewalRate} unit="%"/><KpiCard label="Prévision à 7 jours" value={forecast7} unit="FCFA"/><KpiCard label="Prévision à 30 jours" value={forecast30} unit="FCFA"/></div>
        <div className="service-profit-list">{serviceProfit.map(([service,revenue])=><div key={service}><span>{service}</span><strong>{revenue.toLocaleString("fr-FR")} FCFA</strong></div>)}{!serviceProfit.length&&<p className="empty-state">Les services les plus rentables apparaîtront après les premières ventes.</p>}</div>
      </section>

      <div className="panel" style={{ marginBottom: 20, padding: 12, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 8 }}>
        <DashboardAction href={urgent.length ? "/clients?filter=warning" : "/clients"} label="Clients à relancer" value={urgent.length} tone={urgent.length ? "warning" : "neutral"} />
        <DashboardAction href="/clients?filter=grace" label="Clients en grâce" value={graceClients.length} tone={graceClients.length ? "warning" : "neutral"} />
        <DashboardAction href="/clients?filter=danger" label="Clients expirés" value={expiredClients.length} tone={expiredClients.length ? "danger" : "neutral"} />
        <DashboardAction href="/abonnements" label="Profils disponibles" value={freeSlots} tone={freeSlots ? "success" : "neutral"} />
      </div>

      <div className="dash-grid-2">
        <div className="panel">
          <div className="section-head">
            <div>
              <p className="eyebrow">Historique</p>
              <h2>Mouvements récents</h2>
            </div>
            <span style={{ color: "var(--sr-fg-muted)", fontSize: "0.78rem" }}>
              {transactions.length} transaction{transactions.length > 1 ? "s" : ""}
            </span>
          </div>
          <TransactionsHistoryPanel transactions={transactions} />
        </div>

        <div className="panel">
          <div className="section-head">
            <div>
              <p className="eyebrow">Priorité</p>
              <h2>À relancer</h2>
              <p style={{ marginTop: 4, color: "var(--sr-fg-muted)", font: "400 12px/1.4 var(--font-geist-sans)" }}>
                Relances clients & renouvellement comptes (3 prochains jours)
              </p>
            </div>
            <span style={{ color: "var(--sr-fg-muted)", fontSize: "0.78rem" }}>
              {urgentTotal} rappel{urgentTotal > 1 ? "s" : ""}
            </span>
          </div>
          <NextEcheancesPanel subscriptions={urgent} accounts={urgentAccounts} />
        </div>
      </div>

      <div className="dash-grid-2">
        <div className="panel">
          <div className="section-head">
            <div>
              <p className="eyebrow">Finances</p>
              <h2>Chiffre d&apos;affaires sur 6 mois</h2>
            </div>
          </div>
          <RevenueChart data={monthData} />
        </div>

        <div className="panel">
          <div className="section-head">
            <div>
              <p className="eyebrow">Performances</p>
              <h2>Meilleurs fournisseurs par revenu</h2>
            </div>
          </div>
          <TopProvidersPanel subscriptions={subscriptions} />
        </div>
      </div>
    </>
  );
}

function DashboardAction({ href, label, value, tone }: { href: string; label: string; value: number; tone: "warning" | "danger" | "success" | "neutral" }) {
  const color = tone === "danger" ? "var(--sr-danger)" : tone === "warning" ? "var(--sr-warning)" : tone === "success" ? "var(--sr-success)" : "var(--sr-fg)";
  return <Link href={href} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "12px 14px", borderRadius: 8, border: "1px solid var(--sr-border-subtle)", background: "var(--sr-bg)", textDecoration: "none", color: "var(--sr-fg)" }}><span style={{ fontSize: 12 }}>{label}</span><strong style={{ color, fontSize: 18 }}>{value} →</strong></Link>;
}
