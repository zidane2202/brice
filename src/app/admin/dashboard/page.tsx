import { StatsCard } from "@/components/StatsCard";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import Link from "next/link";

export const dynamic = "force-dynamic";

async function getAdminStats() {
  const supabase = createSupabaseAdmin();

  const [profilesResult, subsResult, authResult] = await Promise.all([
    supabase.from("user_profiles").select("user_id, plan, created_at").eq("role", "reseller"),
    supabase.from("client_subscriptions").select("user_id, price, status, created_at"),
    supabase.auth.admin.listUsers(),
  ]);

  const profiles = profilesResult.data ?? [];
  const subs = subsResult.data ?? [];
  const users = authResult.data?.users ?? [];

  const activeSubs = subs.filter((s) => s.status === "active");
  const totalRevenue = activeSubs.reduce((sum, s) => sum + (s.price ?? 0), 0);

  const now = new Date();
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const newThisMonth = profiles.filter((p) => p.created_at >= firstOfMonth).length;

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

  return {
    totalResellers: profiles.length,
    totalActiveClients: activeSubs.length,
    totalRevenue,
    newThisMonth,
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
        <StatsCard label="Revenus générés (FCFA)" value={stats.totalRevenue.toLocaleString()} />
        <StatsCard label="Nouveaux ce mois" value={stats.newThisMonth} />
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
