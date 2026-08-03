"use client";

import {
  EXPENSE_CATEGORIES,
  buildComptaCsv,
  categoryLabel,
  filterJournal,
  formatFcfa,
  sourceLabel,
} from "@/lib/comptabilite";
import type { ExpenseCategory, Transaction } from "@/lib/types";
import { useMemo, useState } from "react";

type Props = {
  transactions: Transaction[];
  from: string;
  to: string;
  year: number;
  month: number;
  allowExports?: boolean;
};

export function ComptaJournal({
  transactions,
  from,
  to,
  year,
  month,
  allowExports = true,
}: Props) {
  const [kind, setKind] = useState<"all" | "income" | "outflow">("all");
  const [category, setCategory] = useState<ExpenseCategory | "all">("all");
  const [q, setQ] = useState("");

  const filtered = useMemo(
    () => filterJournal(transactions, { from, to, kind, category, q }),
    [transactions, from, to, kind, category, q]
  );

  function downloadCsv() {
    const csv = buildComptaCsv(filtered);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `comptabilite-${year}-${String(month).padStart(2, "0")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function openPdf() {
    const params = new URLSearchParams({
      year: String(year),
      month: String(month),
      kind,
      category,
      q,
    });
    window.open(`/comptabilite/rapport?${params.toString()}`, "_blank");
  }

  return (
    <div>
      <div className="fields" style={{ marginBottom: 16, gap: 12 }}>
        <div className="fields two-cols" style={{ margin: 0 }}>
          <label>
            Type
            <select value={kind} onChange={(e) => setKind(e.target.value as typeof kind)}>
              <option value="all">Tous</option>
              <option value="income">Entrées</option>
              <option value="outflow">Sorties</option>
            </select>
          </label>
          <label>
            Catégorie
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as ExpenseCategory | "all")}
            >
              <option value="all">Toutes</option>
              {EXPENSE_CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label>
          Recherche
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Libellé…"
          />
        </label>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {allowExports ? (
            <>
              <button type="button" onClick={downloadCsv}>
                Export CSV
              </button>
              <button type="button" onClick={openPdf}>
                Export PDF
              </button>
            </>
          ) : (
            <p style={{ margin: 0, fontSize: 12, color: "var(--sr-fg-subtle)" }}>
              Exports réservés au plan Pro.
            </p>
          )}
        </div>
      </div>

      {filtered.length === 0 ? (
        <p style={{ color: "var(--sr-fg-subtle)", margin: 0 }}>
          Aucune écriture sur cette période.
        </p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ textAlign: "left", color: "var(--sr-fg-subtle)" }}>
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
                      color: t.kind === "income" ? "var(--sr-mint-400)" : "var(--sr-warning)",
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {t.kind === "income" ? "+" : "−"}
                    {formatFcfa(Number(t.amount))} FCFA
                  </td>
                  <td style={{ padding: "8px 6px", borderBottom: "1px solid var(--sr-border-subtle)" }}>
                    {sourceLabel(t.source)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
