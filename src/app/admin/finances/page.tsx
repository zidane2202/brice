import { RecordPlatformPaymentForm } from "@/components/admin/RecordPlatformPaymentForm";
import { SuspendToggle } from "@/components/admin/SuspendToggle";
import { StatsCard } from "@/components/StatsCard";
import { PLATFORM_PAYMENT_KIND_LABELS, type PlatformPaymentKind } from "@/lib/platform-payments";
import {
  estimateMrrFcfa,
  normalizePlan,
  PLAN_LIMITS,
  PLAN_PRICES_FCFA,
  type PlanId,
} from "@/lib/plans";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import Link from "next/link";
import { ReversePlatformPaymentButton } from "@/components/admin/ReversePlatformPaymentButton";

export const dynamic = "force-dynamic";

function formatFcfa(n: number) {
  return n.toLocaleString("fr-FR");
}

async function getFinanceData() {
  const supabase = createSupabaseAdmin();
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    .toISOString()
    .slice(0, 10);

  const [profilesRes, paymentsRes, authResult, auditRes, reversalsRes] = await Promise.all([
    supabase
      .from("user_profiles")
      .select(
        "user_id, plan, extra_provider_accounts, suspended, first_name, last_name, created_at, plan_renews_on"
      )
      .eq("role", "reseller")
      .order("created_at", { ascending: false }),
    supabase
      .from("platform_payments")
      .select(
        "id, reseller_user_id, amount, kind, note, occurred_on, recorded_by, applied_plan, created_at"
      )
      .order("occurred_on", { ascending: false })
      .limit(100),
    supabase.auth.admin.listUsers(),
    supabase
      .from("admin_audit_logs")
      .select("id, actor_user_id, target_user_id, action, details, created_at")
      .order("created_at", { ascending: false })
      .limit(30),
    supabase.from("platform_payment_reversals").select("payment_id,amount,reason,created_at").order("created_at", { ascending: false }),
  ]);

  if (profilesRes.error) throw new Error(profilesRes.error.message);
  // Table may not exist yet before SQL migration
  const paymentsError = paymentsRes.error;
  const payments = paymentsError ? [] : paymentsRes.data ?? [];

  const emailMap = new Map(
    (authResult.data?.users ?? []).map((u) => [u.id, u.email ?? "—"])
  );

  const rows = (profilesRes.data ?? []).map((p) => {
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
      plan_renews_on: p.plan_renews_on as string | null,
    };
  });

  const counts = { free: 0, pro: 0, business: 0, suspended: 0 };
  let mrr = 0;
  for (const r of rows) {
    if (r.suspended) counts.suspended += 1;
    counts[r.plan] += 1;
    mrr += r.mrr;
  }

  const reversedThisMonth = (reversalsRes.data ?? []).filter((row) => row.created_at.slice(0, 10) >= monthStart).reduce((sum, row) => sum + Number(row.amount ?? 0), 0);
  const cashThisMonth = payments
    .filter((p) => p.occurred_on >= monthStart)
    .reduce((sum, p) => sum + Number(p.amount ?? 0), 0) - reversedThisMonth;
  const reversalMap = new Map((reversalsRes.data ?? []).map((row) => [row.payment_id, row]));

  const resellerOptions = rows.map((r) => ({
    userId: r.user_id,
    label: `${r.name} (${r.email})`,
    plan: r.plan,
    activePro: r.plan === "pro" && !r.suspended && Boolean(r.plan_renews_on) && r.plan_renews_on! >= new Date().toISOString().slice(0, 10),
  }));

  const journal = payments.map((p) => ({
    ...p,
    resellerLabel:
      rows.find((r) => r.user_id === p.reseller_user_id)?.name ??
      emailMap.get(p.reseller_user_id) ??
      p.reseller_user_id.slice(0, 8),
    recorderEmail: emailMap.get(p.recorded_by) ?? "—",
    reversal: reversalMap.get(p.id) ?? null,
  }));

  return {
    rows,
    counts,
    mrr,
    cashThisMonth,
    resellerOptions,
    journal,
    paymentsError: paymentsError?.message ?? null,
    audit: auditRes.error ? [] : auditRes.data ?? [],
    emailMap,
  };
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

export default async function AdminFinancesPage({ searchParams }: { searchParams: Promise<{ q?: string; kind?: string; from?: string; to?: string }> }) {
  const { rows, counts, mrr, cashThisMonth, resellerOptions, journal, paymentsError, audit, emailMap } =
    await getFinanceData();
  const { q = "", kind = "all", from = "", to = "" } = await searchParams;
  const needle = q.trim().toLowerCase();
  const filteredJournal = journal.filter((payment) => (!needle || `${payment.resellerLabel} ${payment.note ?? ""} ${payment.id}`.toLowerCase().includes(needle)) && (kind === "all" || payment.kind === kind) && (!from || payment.occurred_on >= from) && (!to || payment.occurred_on <= to));

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
        <StatsCard label="Encaissé ce mois" value={formatFcfa(cashThisMonth)} />
        <StatsCard label="Pro" value={counts.pro} />
        <StatsCard label="Business" value={counts.business} />
        <StatsCard label="Free" value={counts.free} />
        <StatsCard label="Suspendus" value={counts.suspended} />
      </div>

      {paymentsError && (
        <div className="panel" style={{ marginBottom: 20, borderColor: "var(--sr-danger-border)" }}>
          <p style={{ margin: 0, color: "var(--sr-danger)", fontSize: 13 }}>
            Table <code>platform_payments</code> absente ou inaccessible. Exécute le SQL du schéma
            sur Supabase. ({paymentsError})
          </p>
        </div>
      )}

      <div className="panel" style={{ marginBottom: 20 }}>
        <h2>Enregistrer un encaissement</h2>
        <RecordPlatformPaymentForm resellers={resellerOptions} />
      </div>

      <div className="panel" style={{ marginBottom: 20 }}>
        <h2>Journal d’encaissements</h2>
        <form method="get" className="fields" style={{ gridTemplateColumns: "2fr 1fr 1fr 1fr auto", marginBottom: 14 }}><label>Recherche<input type="search" name="q" defaultValue={q} placeholder="Vendeur, note, référence…" /></label><label>Motif<select name="kind" defaultValue={kind}><option value="all">Tous</option>{Object.entries(PLATFORM_PAYMENT_KIND_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label>Du<input type="date" name="from" defaultValue={from} /></label><label>Au<input type="date" name="to" defaultValue={to} /></label><button type="submit" style={{ alignSelf: "end" }}>Filtrer</button></form>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Référence</th>
                <th>Vendeur</th>
                <th>Motif</th>
                <th>Montant</th>
                <th>Note</th>
                <th>Plan appliqué</th>
                <th>Par</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filteredJournal.length === 0 && (
                <tr>
                  <td colSpan={9} className="empty">
                    Aucun encaissement enregistré.
                  </td>
                </tr>
              )}
              {filteredJournal.map((p) => (
                <tr key={p.id}>
                  <td>{p.occurred_on}</td>
                  <td style={{ fontFamily: "var(--font-geist-mono)", fontSize: 11 }}>SR-{p.id.slice(0, 8).toUpperCase()}</td>
                  <td>
                    <Link href={`/admin/vendeurs/${p.reseller_user_id}`} className="btn-link">
                      {p.resellerLabel}
                    </Link>
                  </td>
                  <td>
                    {PLATFORM_PAYMENT_KIND_LABELS[p.kind as PlatformPaymentKind] ?? p.kind}
                  </td>
                  <td style={{ textDecoration: p.reversal ? "line-through" : "none", color: p.reversal ? "var(--sr-fg-subtle)" : undefined }}>{formatFcfa(Number(p.amount))} FCFA</td>
                  <td>{p.note || "—"}</td>
                  <td>{p.applied_plan ?? "—"}</td>
                  <td style={{ fontSize: 12 }}>{p.recorderEmail}</td>
                  <td>{p.reversal ? <span className="status cancelled" title={p.reversal.reason}>Annulé</span> : <ReversePlatformPaymentButton paymentId={p.id} label={`${p.resellerLabel} · ${formatFcfa(Number(p.amount))} FCFA`} />}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="panel" style={{ marginBottom: 20 }}>
        <h2>Journal d’audit administrateur</h2>
        <p style={{ color: "var(--sr-fg-subtle)", fontSize: 12, margin: "0 0 14px" }}>
          Historique des encaissements, suspensions et modifications sensibles.
        </p>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Date</th><th>Action</th><th>Cible</th><th>Administrateur</th><th>Détails</th></tr></thead>
            <tbody>
              {audit.length === 0 && <tr><td colSpan={5} className="empty">Aucune entrée d’audit. Exécutez le schéma Supabase mis à jour si nécessaire.</td></tr>}
              {audit.map((entry) => (
                <tr key={entry.id}>
                  <td>{new Date(entry.created_at).toLocaleString("fr-FR")}</td>
                  <td><strong>{entry.action}</strong></td>
                  <td>{entry.target_user_id ? emailMap.get(entry.target_user_id) ?? entry.target_user_id.slice(0, 8) : "—"}</td>
                  <td>{emailMap.get(entry.actor_user_id) ?? entry.actor_user_id.slice(0, 8)}</td>
                  <td style={{ maxWidth: 320, fontSize: 11 }}>{JSON.stringify(entry.details)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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
                <th>Échéance</th>
                <th>MRR</th>
                <th>Statut</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={7} className="empty">
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
                  <td>{r.plan_renews_on ?? "—"}</td>
                  <td>{formatFcfa(r.mrr)} FCFA</td>
                  <td>
                    {r.suspended ? (
                      <span style={{ color: "var(--sr-danger)", fontWeight: 600 }}>Suspendu</span>
                    ) : (
                      <span style={{ color: "var(--sr-mint-300)" }}>Actif</span>
                    )}
                  </td>
                  <td>
                    <div
                      style={{
                        display: "flex",
                        gap: 10,
                        alignItems: "center",
                        justifyContent: "flex-end",
                      }}
                    >
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
