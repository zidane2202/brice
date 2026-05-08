import { createSupabaseAdmin } from "@/lib/supabase-admin";
import Link from "next/link";

export const dynamic = "force-dynamic";

async function getResellers() {
  const supabase = createSupabaseAdmin();

  const { data: profiles, error } = await supabase
    .from("user_profiles")
    .select("user_id, role, plan, created_at")
    .eq("role", "reseller")
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);

  const userIds = (profiles ?? []).map((p) => p.user_id);
  if (userIds.length === 0) return [];

  const { data: authUsers } = await supabase.auth.admin.listUsers();
  const emailMap = new Map(
    (authUsers?.users ?? []).map((u) => [u.id, u.email])
  );

  const { data: subCounts } = await supabase
    .from("client_subscriptions")
    .select("user_id")
    .eq("status", "active")
    .in("user_id", userIds);

  const countMap = new Map<string, number>();
  (subCounts ?? []).forEach((s) => {
    countMap.set(s.user_id, (countMap.get(s.user_id) ?? 0) + 1);
  });

  return (profiles ?? []).map((p) => ({
    ...p,
    email: emailMap.get(p.user_id) ?? "—",
    active_clients: countMap.get(p.user_id) ?? 0,
  }));
}

export default async function AdminPage() {
  const resellers = await getResellers();

  return (
    <>
      <div>
        <p className="eyebrow">Administration</p>
        <h1>Revendeurs ({resellers.length})</h1>
      </div>

      <div className="panel">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Email</th>
                <th>Plan</th>
                <th>Clients actifs</th>
                <th>Inscrit le</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {resellers.length === 0 && (
                <tr><td colSpan={5} className="empty">Aucun revendeur inscrit.</td></tr>
              )}
              {resellers.map((r) => (
                <tr key={r.user_id}>
                  <td><strong>{r.email}</strong></td>
                  <td><span className="status active">{r.plan}</span></td>
                  <td>{r.active_clients}</td>
                  <td>{new Date(r.created_at).toLocaleDateString("fr-FR")}</td>
                  <td>
                    <Link href={`/admin/revendeurs/${r.user_id}`} className="btn-link">
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
