import { ResellerSettingsForm } from "@/components/admin/ResellerSettingsForm";
import { SuspendToggle } from "@/components/admin/SuspendToggle";
import { KpiCard } from "@/components/KpiCard";
import { computeBalance, formatFcfa } from "@/lib/comptabilite";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import { getUser } from "@/lib/supabase-server";
import type {
  ClientSubscription,
  Invoice,
  ProviderAccount,
  Transaction,
} from "@/lib/types";
import Link from "next/link";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

type ProfileRow = {
  user_id: string;
  role: string;
  plan: string;
  first_name: string | null;
  last_name: string | null;
  company_name: string | null;
  phone: string | null;
  city: string | null;
  logo_url: string | null;
  extra_provider_accounts: number;
  suspended: boolean | null;
  created_at: string;
};

async function getResellerDetail(userId: string) {
  const supabase = createSupabaseAdmin();

  const { data: profile } = await supabase
    .from("user_profiles")
    .select(
      "user_id, role, plan, first_name, last_name, company_name, phone, city, logo_url, extra_provider_accounts, suspended, created_at"
    )
    .eq("user_id", userId)
    .maybeSingle();

  if (!profile) return null;

  const [
    authUserRes,
    accountsRes,
    subsRes,
    balanceRes,
    incomeRes,
    txRes,
    invoicesRes,
  ] = await Promise.all([
    supabase.auth.admin.getUserById(userId),
    supabase
      .from("provider_accounts")
      .select("id, service_name, label, max_slots, end_date, cost, status, account_slots(id)")
      .eq("user_id", userId)
      .order("created_at", { ascending: false }),
    supabase
      .from("client_subscriptions")
      .select(
        `
        id, price, status, end_date, start_date,
        client:clients(id, first_name, last_name),
        slot:account_slots(
          slot_number, label,
          account:provider_accounts(service_name)
        )
      `
      )
      .eq("user_id", userId)
      .order("end_date", { ascending: true }),
    supabase
      .from("transactions")
      .select("kind, amount, affects_balance")
      .eq("user_id", userId)
      .eq("affects_balance", true),
    supabase
      .from("transactions")
      .select("amount")
      .eq("user_id", userId)
      .eq("kind", "income"),
    supabase
      .from("transactions")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("invoices")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  const today = new Date().toISOString().slice(0, 10);
  const accounts = (accountsRes.data ?? []) as unknown as (ProviderAccount & {
    account_slots: { id: string }[];
  })[];
  const subscriptions = (subsRes.data ?? []) as unknown as ClientSubscription[];
  const activeClients = subscriptions.filter(
    (s) => s.status === "active" && s.end_date >= today
  ).length;
  const activeAccounts = accounts.filter(
    (a) => a.status === "active" && a.end_date >= today
  ).length;
  const balance = computeBalance(balanceRes.data ?? []);
  const totalIncome = (incomeRes.data ?? []).reduce(
    (sum, t) => sum + Number(t.amount ?? 0),
    0
  );
  const transactions = (txRes.data ?? []) as Transaction[];
  const invoices = (invoicesRes.data ?? []) as Invoice[];

  return {
    profile: profile as ProfileRow,
    email: authUserRes.data.user?.email ?? "—",
    accounts,
    subscriptions,
    activeClients,
    activeAccounts,
    balance,
    totalIncome,
    invoiceCount: invoices.length,
    transactions,
    invoices,
  };
}

export default async function ResellerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const actor = await getUser();
  const data = await getResellerDetail(id);
  if (!data) notFound();

  const {
    profile,
    email,
    accounts,
    subscriptions,
    activeClients,
    activeAccounts,
    balance,
    totalIncome,
    transactions,
    invoices,
  } = data;

  const displayName =
    `${profile.first_name ?? ""} ${profile.last_name ?? ""}`.trim() ||
    profile.company_name ||
    email;

  return (
    <>
      <div className="page-header">
        <div>
          <p className="eyebrow">
            <Link href="/admin/vendeurs">← Vendeurs</Link>
          </p>
          <h1>{displayName}</h1>
          <p style={{ margin: "6px 0 0", color: "var(--sr-fg-subtle)", fontSize: 13 }}>
            {[profile.company_name, email, profile.city].filter(Boolean).join(" · ")}
            {" · inscrit le "}
            {new Date(profile.created_at).toLocaleDateString("fr-FR")}
          </p>
        </div>
      </div>

      <div className="stats-grid" style={{ marginBottom: 20 }}>
        <KpiCard label="Clients actifs" value={activeClients} tone="success" />
        <KpiCard label="Comptes actifs" value={activeAccounts} tone="info" />
        <KpiCard label="Solde caisse" value={balance} unit="FCFA" accent />
        <KpiCard label="Recettes (income)" value={totalIncome} unit="FCFA" tone="success" />
        <KpiCard label="Factures (aperçu)" value={invoices.length} tone="neutral" />
      </div>

      <div className="panel" style={{ marginBottom: 20 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
            marginBottom: 12,
          }}
        >
          <h2 style={{ marginTop: 0, marginBottom: 0 }}>Réglages</h2>
          {actor?.id !== profile.user_id && (
            <SuspendToggle
              userId={profile.user_id}
              suspended={Boolean(profile.suspended)}
            />
          )}
        </div>
        {profile.suspended && (
          <p style={{ color: "var(--sr-danger)", fontSize: 13, margin: "0 0 12px" }}>
            Ce compte est actuellement suspendu.
          </p>
        )}
        <ResellerSettingsForm
          userId={profile.user_id}
          plan={profile.plan}
          role={profile.role}
          extraProviderAccounts={Number(profile.extra_provider_accounts ?? 0)}
          isSelf={actor?.id === profile.user_id}
        />
      </div>

      <div className="panel" style={{ marginBottom: 20 }}>
        <h2 style={{ marginTop: 0 }}>Comptes provider ({accounts.length})</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Service</th>
                <th>Label</th>
                <th>Slots</th>
                <th>Fin</th>
                <th>Coût</th>
                <th>Statut</th>
              </tr>
            </thead>
            <tbody>
              {accounts.length === 0 && (
                <tr>
                  <td colSpan={6} className="empty">
                    Aucun compte.
                  </td>
                </tr>
              )}
              {accounts.map((a) => (
                <tr key={a.id}>
                  <td>
                    <strong>{a.service_name}</strong>
                  </td>
                  <td>{a.label ?? "—"}</td>
                  <td>
                    {a.account_slots?.length ?? 0}/{a.max_slots}
                  </td>
                  <td>{a.end_date}</td>
                  <td>{a.cost != null ? `${formatFcfa(Number(a.cost))} FCFA` : "—"}</td>
                  <td>
                    <span className={`status ${a.status}`}>{a.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="panel" style={{ marginBottom: 20 }}>
        <h2 style={{ marginTop: 0 }}>Abonnements clients ({subscriptions.length})</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Client</th>
                <th>Service</th>
                <th>Prix</th>
                <th>Fin</th>
                <th>Statut</th>
              </tr>
            </thead>
            <tbody>
              {subscriptions.length === 0 && (
                <tr>
                  <td colSpan={5} className="empty">
                    Aucun abonnement.
                  </td>
                </tr>
              )}
              {subscriptions.map((s) => {
                const clientName = s.client
                  ? `${s.client.first_name} ${s.client.last_name ?? ""}`.trim()
                  : "—";
                const service =
                  s.slot && "account" in s.slot && s.slot.account
                    ? (s.slot.account as { service_name?: string }).service_name
                    : "—";
                return (
                  <tr key={s.id}>
                    <td>
                      <strong>{clientName}</strong>
                    </td>
                    <td>{service ?? "—"}</td>
                    <td>
                      {s.price != null ? `${formatFcfa(Number(s.price))} FCFA` : "—"}
                    </td>
                    <td>{s.end_date}</td>
                    <td>
                      <span className={`status ${s.status}`}>{s.status}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="panel" style={{ marginBottom: 20 }}>
        <h2 style={{ marginTop: 0 }}>Transactions récentes</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Type</th>
                <th>Libellé</th>
                <th>Montant</th>
              </tr>
            </thead>
            <tbody>
              {transactions.length === 0 && (
                <tr>
                  <td colSpan={4} className="empty">
                    Aucune transaction.
                  </td>
                </tr>
              )}
              {transactions.map((t) => (
                <tr key={t.id}>
                  <td>{t.occurred_on ?? t.created_at.slice(0, 10)}</td>
                  <td>{t.kind === "income" ? "Entrée" : "Sortie"}</td>
                  <td>{t.label || "—"}</td>
                  <td>
                    {t.kind === "income" ? "+" : "−"}
                    {formatFcfa(Number(t.amount))} FCFA
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="panel">
        <h2 style={{ marginTop: 0 }}>Factures récentes</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>N°</th>
                <th>Client</th>
                <th>Service</th>
                <th>Montant</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {invoices.length === 0 && (
                <tr>
                  <td colSpan={5} className="empty">
                    Aucune facture.
                  </td>
                </tr>
              )}
              {invoices.map((inv) => (
                <tr key={inv.id}>
                  <td>{String(inv.number).padStart(4, "0")}</td>
                  <td>{inv.client_name}</td>
                  <td>{inv.service_name}</td>
                  <td>{formatFcfa(Number(inv.amount))} FCFA</td>
                  <td>
                    <Link href={`/facture/${inv.code}`} className="btn-link">
                      Ouvrir →
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
