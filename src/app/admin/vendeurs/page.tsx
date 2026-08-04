import { createSupabaseAdmin } from "@/lib/supabase-admin";
import Link from "next/link";

export const dynamic = "force-dynamic";

async function getResellers() {
  const supabase = createSupabaseAdmin();

  const { data: profiles, error } = await supabase
    .from("user_profiles")
    .select("user_id, role, plan, created_at, first_name, last_name, phone, city")
    .eq("role", "reseller")
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);

  const userIds = (profiles ?? []).map((p) => p.user_id);
  if (userIds.length === 0) return [];

  const { data: authUsers } = await supabase.auth.admin.listUsers();
  const authMap = new Map((authUsers?.users ?? []).map((u) => [u.id, { email: u.email, lastSignInAt: u.last_sign_in_at }]));

  const { data: subCounts } = await supabase
    .from("client_subscriptions")
    .select("user_id, status, end_date")
    .in("status", ["active", "grace"])
    .in("user_id", userIds);

  const today = new Date().toISOString().slice(0, 10);
  const countMap = new Map<string, number>();
  (subCounts ?? []).filter((s) => s.status === "grace" || s.end_date >= today).forEach((s) => {
    countMap.set(s.user_id, (countMap.get(s.user_id) ?? 0) + 1);
  });

  return (profiles ?? []).map((p) => ({
    ...p,
    email: authMap.get(p.user_id)?.email ?? "—",
    last_sign_in_at: authMap.get(p.user_id)?.lastSignInAt ?? null,
    active_clients: countMap.get(p.user_id) ?? 0,
  }));
}

export default async function ResellerListPage({ searchParams }: { searchParams: Promise<{ q?: string; plan?: string; city?: string }> }) {
  const allResellers = await getResellers();
  const { q = "", plan = "all", city = "" } = await searchParams;
  const needle = q.trim().toLowerCase();
  const resellers = allResellers.filter((row) => {
    const haystack = `${row.first_name ?? ""} ${row.last_name ?? ""} ${row.email} ${row.phone ?? ""} ${row.city ?? ""}`.toLowerCase();
    return (!needle || haystack.includes(needle)) && (plan === "all" || row.plan === plan) && (!city.trim() || (row.city ?? "").toLowerCase().includes(city.trim().toLowerCase()));
  });

  return (
    <>
      <div className="page-header">
        <div>
          <p className="eyebrow"><Link href="/admin/dashboard">← Dashboard</Link></p>
          <h1>Vendeurs ({resellers.length})</h1>
        </div>
      </div>

      <div className="panel">
        <form method="get" className="fields" style={{ gridTemplateColumns: "2fr 1fr 1fr auto", marginBottom: 16 }}><label>Recherche<input type="search" name="q" defaultValue={q} placeholder="Nom, email, téléphone…" /></label><label>Plan<select name="plan" defaultValue={plan}><option value="all">Tous</option><option value="free">Free</option><option value="pro">Pro</option><option value="business">Business</option></select></label><label>Ville<input name="city" defaultValue={city} placeholder="Ville" /></label><button type="submit" style={{ alignSelf: "end" }}>Filtrer</button></form>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Nom</th>
                <th>Email</th>
                <th>Téléphone</th>
                <th>Ville</th>
                <th>Plan</th>
                <th>Clients en cours</th>
                <th>Inscrit le</th>
                <th>Dernière connexion</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {resellers.length === 0 && (
                <tr><td colSpan={9} className="empty">Aucun vendeur inscrit.</td></tr>
              )}
              {resellers.map((r) => (
                <tr key={r.user_id}>
                  <td>
                    <strong>
                      {r.first_name || r.last_name
                        ? `${r.first_name ?? ""} ${r.last_name ?? ""}`.trim()
                        : "—"}
                    </strong>
                  </td>
                  <td>{r.email}</td>
                  <td>{r.phone ?? "—"}</td>
                  <td>{r.city ?? "—"}</td>
                  <td><span className="status active">{r.plan}</span></td>
                  <td>{r.active_clients}</td>
                  <td>{new Date(r.created_at).toLocaleDateString("fr-FR")}</td>
                  <td>{r.last_sign_in_at ? new Date(r.last_sign_in_at).toLocaleString("fr-FR") : "Jamais"}</td>
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
