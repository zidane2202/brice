import { PrintButton } from "@/components/comptabilite/PrintButton";
import {
  categoryLabel,
  computePeriodKpis,
  filterJournal,
  formatFcfa,
  monthBounds,
  sourceLabel,
} from "@/lib/comptabilite";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import { getUser } from "@/lib/supabase-server";
import type { ExpenseCategory, Transaction } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function ComptabiliteRapportPage({
  searchParams,
}: {
  searchParams: Promise<{
    year?: string;
    month?: string;
    kind?: string;
    category?: string;
    q?: string;
  }>;
}) {
  const user = await getUser();
  if (!user) return null;

  const sp = await searchParams;
  const now = new Date();
  const year = Number(sp.year) || now.getFullYear();
  const month = Number(sp.month) || now.getMonth() + 1;
  const { from, to } = monthBounds(year, month - 1);

  const kindRaw = sp.kind ?? "all";
  const kind =
    kindRaw === "income" || kindRaw === "outflow" || kindRaw === "all" ? kindRaw : "all";
  const categoryRaw = sp.category ?? "all";
  const category = (categoryRaw === "all" ? "all" : categoryRaw) as ExpenseCategory | "all";
  const q = sp.q ?? "";

  const supabase = createSupabaseAdmin();
  const { data } = await supabase
    .from("transactions")
    .select("*")
    .eq("user_id", user.id)
    .gte("occurred_on", from)
    .lte("occurred_on", to)
    .order("occurred_on", { ascending: false });

  const txs = (data ?? []) as Transaction[];
  for (const t of txs) {
    if (!t.occurred_on) t.occurred_on = t.created_at.slice(0, 10);
  }

  const filtered = filterJournal(txs, { from, to, kind, category, q });
  const kpis = computePeriodKpis(filtered, from, to);

  return (
    <article className="compta-rapport" style={{ padding: 8 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 16,
          marginBottom: 24,
        }}
      >
        <div>
          <p className="eyebrow">subresell</p>
          <h1 style={{ margin: "4px 0 8px" }}>Rapport comptabilité</h1>
          <p style={{ margin: 0, color: "var(--sr-fg-subtle)" }}>
            Période du {from} au {to}
          </p>
        </div>
        <PrintButton />
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
          gap: 12,
          marginBottom: 24,
        }}
      >
        <div className="panel">
          <div style={{ fontSize: 12, color: "var(--sr-fg-subtle)" }}>Recettes</div>
          <div style={{ fontSize: 18, fontWeight: 600 }}>{formatFcfa(kpis.income)} FCFA</div>
        </div>
        <div className="panel">
          <div style={{ fontSize: 12, color: "var(--sr-fg-subtle)" }}>Dépenses</div>
          <div style={{ fontSize: 18, fontWeight: 600 }}>{formatFcfa(kpis.expenses)} FCFA</div>
        </div>
        <div className="panel">
          <div style={{ fontSize: 12, color: "var(--sr-fg-subtle)" }}>Marge</div>
          <div style={{ fontSize: 18, fontWeight: 600 }}>{formatFcfa(kpis.margin)} FCFA</div>
        </div>
      </div>

      {filtered.length === 0 ? (
        <p style={{ color: "var(--sr-fg-subtle)" }}>Aucune écriture sur cette période.</p>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ textAlign: "left" }}>
              <th style={{ padding: "8px 6px", borderBottom: "1px solid var(--sr-border-subtle)" }}>Date</th>
              <th style={{ padding: "8px 6px", borderBottom: "1px solid var(--sr-border-subtle)" }}>Libellé</th>
              <th style={{ padding: "8px 6px", borderBottom: "1px solid var(--sr-border-subtle)" }}>Catégorie</th>
              <th style={{ padding: "8px 6px", borderBottom: "1px solid var(--sr-border-subtle)" }}>Type</th>
              <th style={{ padding: "8px 6px", borderBottom: "1px solid var(--sr-border-subtle)", textAlign: "right" }}>Montant</th>
              <th style={{ padding: "8px 6px", borderBottom: "1px solid var(--sr-border-subtle)" }}>Source</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((t) => (
              <tr key={t.id}>
                <td style={{ padding: "8px 6px", borderBottom: "1px solid var(--sr-border-subtle)" }}>
                  {t.occurred_on}
                </td>
                <td style={{ padding: "8px 6px", borderBottom: "1px solid var(--sr-border-subtle)" }}>
                  {t.label}
                </td>
                <td style={{ padding: "8px 6px", borderBottom: "1px solid var(--sr-border-subtle)" }}>
                  {categoryLabel(t.category)}
                </td>
                <td style={{ padding: "8px 6px", borderBottom: "1px solid var(--sr-border-subtle)" }}>
                  {t.kind === "income" ? "Entrée" : "Sortie"}
                </td>
                <td
                  style={{
                    padding: "8px 6px",
                    borderBottom: "1px solid var(--sr-border-subtle)",
                    textAlign: "right",
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {formatFcfa(Number(t.amount))} FCFA
                </td>
                <td style={{ padding: "8px 6px", borderBottom: "1px solid var(--sr-border-subtle)" }}>
                  {sourceLabel(t.source)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </article>
  );
}
