import { SuspendToggle } from "@/components/admin/SuspendToggle";
import { StatsCard } from "@/components/StatsCard";
import {
  estimateMrrFcfa,
  normalizePlan,
  PLAN_LIMITS,
  PLAN_PRICES_FCFA,
  type PlanId,
} from "@/lib/plans";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import Link from "next/link";

export const dynamic = "force-dynamic";

function formatFcfa(n: number) {
  return n.toLocaleString("fr-FR");
}

async function getFinanceData() {
  const supabase = createSupabaseAdmin();

  const { data: profiles, error } = await supabase
    .from("user_profiles")
    .select(
      "user_id, plan, extra_provider_accounts, suspended, first_name, last_name, created_at"
    )
    .eq("role", "reseller")
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);

  const { data: authUsers } = await supabase.auth.admin.listUsers();
  const emailMap = new Map((authUsers?.users ?? []).map((u) => [u.id, u.email ?? "—"]));

  const rows = (profiles ?? []).map((p) => {
    const plan = normalizePlan(p.plan);
    const extras = Number(p.extra_provider_accounts ?? 0);
    const suspended = Boolean(p.suspended);
    return {
      user_id: p.user_id,
      email: emailMap.get(p.user_id) ?? "—",
      name: `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim() || "—",
      plan,
      extras,
      suspended,
      mrr: estimateMrrFcfa(plan, extras, suspended),
    };
  });

  const counts = { free: 0, pro: 0, business: 0, suspended: 0 };
  let mrr = 0;
  for (const r of rows) {
    if (r.suspended) counts.suspended += 1;
    counts[r.plan] += 1;
    mrr += r.mrr;
  }

  return { rows, counts, mrr };
}

const CATALOGUE: {
  id: PlanId;
  label: string;
  price: number;
  blurb: string;
}[] = [
  {
    id: "free",
    label: "Free",
    price: PLAN_PRICES_FCFA.free,
    blurb: `${PLAN_LIMITS.free.maxAccounts} comptes · ${PLAN_LIMITS.free.clientsPerAccount} clients/compte`,
  },
  {
    id: "pro",
    label: "Pro",
    price: PLAN_PRICES_FCFA.pro,
    blurb: `${PLAN_LIMITS.pro.maxAccounts} comptes · ${PLAN_LIMITS.pro.clientsPerAccount} clients/compte · extras +${formatFcfa(PLAN_PRICES_FCFA.extraAccount)} / compte`,
  },
  {
    id: "business",
    label: "Business",
    price: PLAN_PRICES_FCFA.business,
    blurb: `Volume · ${PLAN_LIMITS.business.maxAccounts} comptes soft · support dédié`,
  },
];

export default async function AdminFinancesPage() {
  const { rows, counts, mrr } = await getFinanceData();

  return (
    <>
      <div className="page-header">
        <div>
          <p className="eyebrow">
            <Link href="/admin/dashboard">← Dashboard</Link>
          </p>
          <h1>Finances</h1>
        </div>
      </div>

      <div className="stats-grid">
        <StatsCard label="MRR estimé (FCFA)" value={formatFcfa(mrr)} accent />
        <StatsCard label="Pro" value={counts.pro} />
        <StatsCard label="Business" value={counts.business} />
        <StatsCard label="Free" value={counts.free} />
        <StatsCard label="Suspendus" value={counts.suspended} />
      </div>

      <div className="panel" style={{ marginBottom: 20 }}>
        <h2>Catalogue packs</h2>
        <p style={{ color: "var(--sr-fg-muted)", margin: "0 0 16px", fontSize: 13 }}>
          Prix et limites définis dans le code (lecture seule). Extras Pro : +
          {formatFcfa(PLAN_PRICES_FCFA.extraAccount)} / compte ou +
          {formatFcfa(PLAN_PRICES_FCFA.extraPack3)} / pack de 3.
        </p>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: 14,
          }}
          className="finances-catalog"
        >
          {CATALOGUE.map((pack) => (
            <div
              key={pack.id}
              style={{
                padding: 16,
                borderRadius: 12,
                border: "1px solid var(--sr-border)",
                background: "var(--sr-surface-2)",
              }}
            >
              <strong style={{ fontSize: 15 }}>{pack.label}</strong>
              <p style={{ margin: "8px 0 4px", fontSize: 22, fontWeight: 650 }}>
                {formatFcfa(pack.price)}
                <span style={{ fontSize: 12, color: "var(--sr-fg-muted)", fontWeight: 500 }}>
                  {" "}
                  FCFA / mois
                </span>
              </p>
              <p style={{ margin: 0, fontSize: 13, color: "var(--sr-fg-muted)" }}>{pack.blurb}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="panel">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h2>Vendeurs & abonnements</h2>
          <Link href="/admin/vendeurs" className="btn-link">
            Tous les vendeurs →
          </Link>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Vendeur</th>
                <th>Plan</th>
                <th>Extras</th>
                <th>MRR</th>
                <th>Statut</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="empty">
                    Aucun vendeur.
                  </td>
                </tr>
              )}
              {rows.map((r) => (
                <tr key={r.user_id}>
                  <td>
                    <strong>{r.name}</strong>
                    <div style={{ fontSize: 12, color: "var(--sr-fg-muted)" }}>{r.email}</div>
                  </td>
                  <td>
                    <span className="status active">{r.plan}</span>
                  </td>
                  <td>{r.plan === "pro" ? r.extras : "—"}</td>
                  <td>{formatFcfa(r.mrr)} FCFA</td>
                  <td>
                    {r.suspended ? (
                      <span style={{ color: "var(--sr-danger)", fontWeight: 600 }}>Suspendu</span>
                    ) : (
                      <span style={{ color: "var(--sr-mint-300)" }}>Actif</span>
                    )}
                  </td>
                  <td>
                    <div style={{ display: "flex", gap: 10, alignItems: "center", justifyContent: "flex-end" }}>
                      <Link href={`/admin/vendeurs/${r.user_id}`} className="btn-link">
                        Pack →
                      </Link>
                      <SuspendToggle userId={r.user_id} suspended={r.suspended} />
                    </div>
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
