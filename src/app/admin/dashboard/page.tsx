import { StatsCard } from "@/components/StatsCard";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import Link from "next/link";

export const dynamic = "force-dynamic";

async function getAdminStats() {
  const supabase = createSupabaseAdmin();

  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const in15Days = new Date(now.getTime() + 15 * 86400000).toISOString().slice(0, 10);
  const [profilesResult, subsResult, authResult, paymentsResult] = await Promise.all([
    supabase.from("user_profiles").select("user_id, plan, suspended, plan_renews_on, created_at").eq("role", "reseller"),
    supabase.from("client_subscriptions").select("user_id, price, status, created_at"),
    supabase.auth.admin.listUsers(),
    supabase.from("platform_payments").select("amount, occurred_on").gte("occurred_on", firstOfMonth.slice(0, 10)),
  ]);

  const profiles = profilesResult.data ?? [];
  const subs = subsResult.data ?? [];
  const users = authResult.data?.users ?? [];

  const activeSubs = subs.filter((s) => s.status === "active");
  const totalRevenue = activeSubs.reduce((sum, s) => sum + (s.price ?? 0), 0);

  const newThisMonth = profiles.filter((p) => p.created_at >= firstOfMonth).length;
  const platformRevenueThisMonth = (paymentsResult.data ?? []).reduce((sum, p) => sum + Number(p.amount ?? 0), 0);
  const suspendedCount = profiles.filter((p) => p.suspended).length;
  const planCounts = profiles.reduce((counts, p) => {
    const plan: "free" | "pro" | "business" = p.plan === "pro" || p.plan === "business" ? p.plan : "free";
    counts[plan]++;
    return counts;
  }, { free: 0, pro: 0, business: 0 });

  const resellerIds = new Set(profiles.map((p) => p.user_id));
  const emailMap = new Map(users.map((u) => [u.id, u.email ?? "—"]));

  const activeByReseller = new Map<string, number>();
  activeSubs.forEach((s) => {
    activeByReseller.set(s.user_id, (activeByReseller.get(s.user_id) ?? 0) + 1);
  });

  const topResellers = profiles
    .filter((p) => resellerIds.has(p.user_id))
    .map((p) => ({
      user_id: p.user_id,
      email: emailMap.get(p.user_id) ?? "—",
      plan: p.plan,
      active_clients: activeByReseller.get(p.user_id) ?? 0,
      created_at: p.created_at,
    }))
    .sort((a, b) => b.active_clients - a.active_clients)
    .slice(0, 5);

  const upcomingRenewals = profiles
    .filter((p) => p.plan_renews_on && p.plan_renews_on >= today && p.plan_renews_on <= in15Days)
    .map((p) => ({
      ...p,
      email: emailMap.get(p.user_id) ?? "—",
      days: Math.ceil((new Date(`${p.plan_renews_on}T00:00:00`).getTime() - new Date(`${today}T00:00:00`).getTime()) / 86400000),
    }))
    .sort((a, b) => (a.plan_renews_on ?? "").localeCompare(b.plan_renews_on ?? ""));

  return {
    totalResellers: profiles.length,
    totalActiveClients: activeSubs.length,
    totalRevenue,
    newThisMonth,
    platformRevenueThisMonth,
    suspendedCount,
    planCounts,
    upcomingRenewals,
    topResellers,
  };
}

export default async function AdminDashboardPage() {
  const stats = await getAdminStats();

  return (
    <>
      <div className="page-header">
        <div>
          <p className="eyebrow">Vue globale</p>
          <h1>Dashboard Admin</h1>
        </div>
      </div>

      <div className="stats-grid">
        <StatsCard label="Vendeurs inscrits" value={stats.totalResellers} />
        <StatsCard label="Clients actifs (total)" value={stats.totalActiveClients} accent />
        <StatsCard label="Encaissements plateforme ce mois" value={stats.platformRevenueThisMonth.toLocaleString()} />
        <StatsCard label="Nouveaux ce mois" value={stats.newThisMonth} />
        <StatsCard label="Packs à renouveler (15 j)" value={stats.upcomingRenewals.length} />
        <StatsCard label="Comptes suspendus" value={stats.suspendedCount} />
      </div>

      <div className="panel" style={{ marginBottom: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <div>
            <h2 style={{ margin: 0 }}>Packs à renouveler</h2>
            <p style={{ margin: "5px 0 0", color: "var(--sr-fg-subtle)", fontSize: 12 }}>
              Prochains 15 jours · Free {stats.planCounts.free} · Pro {stats.planCounts.pro} · Business {stats.planCounts.business}
            </p>
          </div>
          <Link href="/admin/finances" className="btn-link">Nouvel encaissement →</Link>
        </div>
        <div className="table-wrap" style={{ marginTop: 14 }}>
          <table>
            <thead><tr><th>Vendeur</th><th>Plan</th><th>Échéance</th><th>Urgence</th><th></th></tr></thead>
            <tbody>
              {stats.upcomingRenewals.length === 0 && <tr><td colSpan={5} className="empty">Aucun renouvellement dans les 15 prochains jours.</td></tr>}
              {stats.upcomingRenewals.map((row) => (
                <tr key={row.user_id}>
                  <td><strong>{row.email}</strong></td>
                  <td><span className="status active">{row.plan}</span></td>
                  <td>{new Date(`${row.plan_renews_on}T00:00:00`).toLocaleDateString("fr-FR")}</td>
                  <td><span className={`status ${row.days <= 3 ? "cancelled" : "grace"}`}>{row.days === 0 ? "Aujourd’hui" : `J−${row.days}`}</span></td>
                  <td><Link href={`/admin/vendeurs/${row.user_id}`} className="btn-link">Renouveler →</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="panel">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h2>Top vendeurs</h2>
          <Link href="/admin/vendeurs" className="btn-link">Voir tous →</Link>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Email</th>
                <th>Plan</th>
                <th>Clients actifs</th>
                <th>Inscrit le</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {stats.topResellers.length === 0 && (
                <tr><td colSpan={5} className="empty">Aucun vendeur inscrit.</td></tr>
              )}
              {stats.topResellers.map((r) => (
                <tr key={r.user_id}>
                  <td><strong>{r.email}</strong></td>
                  <td><span className="status active">{r.plan}</span></td>
                  <td>{r.active_clients}</td>
                  <td>{new Date(r.created_at).toLocaleDateString("fr-FR")}</td>
                  <td>
                    <Link href={`/admin/vendeurs/${r.user_id}`} className="btn-link">
                      Voir →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
