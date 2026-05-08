import { createSupabaseAdmin } from "@/lib/supabase-admin";
import { StatsCard } from "@/components/StatsCard";
import Link from "next/link";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

async function getResellerStats(userId: string) {
  const supabase = createSupabaseAdmin();

  const [profileResult, accountsResult, subsResult, authResult] = await Promise.all([
    supabase.from("user_profiles").select("*").eq("user_id", userId).single(),
    supabase.from("provider_accounts").select("id, service_name, status").eq("user_id", userId),
    supabase.from("client_subscriptions").select("id, status, price").eq("user_id", userId),
    supabase.auth.admin.getUserById(userId),
  ]);

  if (!profileResult.data) return null;

  const activeClients = (subsResult.data ?? []).filter((s) => s.status === "active").length;
  const totalRevenue = (subsResult.data ?? [])
    .filter((s) => s.status === "active")
    .reduce((sum, s) => sum + (s.price ?? 0), 0);

  return {
    profile: profileResult.data,
    email: authResult.data?.user?.email ?? "—",
    accounts: accountsResult.data ?? [],
    activeClients,
    totalRevenue,
    totalSubscriptions: subsResult.data?.length ?? 0,
  };
}

export default async function ResellerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await getResellerStats(id);
  if (!data) notFound();

  return (
    <>
      <div className="page-header">
        <div>
          <p className="eyebrow"><Link href="/admin">← Admin</Link></p>
          <h1>{data.email}</h1>
          <p style={{ color: "var(--muted)", marginTop: 6 }}>Plan : {data.profile.plan}</p>
        </div>
      </div>

      <div className="stats-grid">
        <StatsCard label="Clients actifs" value={data.activeClients} />
        <StatsCard label="Revenus total (FCFA)" value={data.totalRevenue.toLocaleString()} accent />
        <StatsCard label="Total abonnements" value={data.totalSubscriptions} />
        <StatsCard label="Comptes provider" value={data.accounts.length} />
      </div>

      <div className="panel">
        <h2>Comptes provider</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Service</th><th>Statut</th></tr>
            </thead>
            <tbody>
              {data.accounts.map((a) => (
                <tr key={a.id}>
                  <td>{a.service_name}</td>
                  <td><span className={`status ${a.status}`}>{a.status === "active" ? "Actif" : "Inactif"}</span></td>
                </tr>
              ))}
              {data.accounts.length === 0 && (
                <tr><td colSpan={2} className="empty">Aucun compte.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
