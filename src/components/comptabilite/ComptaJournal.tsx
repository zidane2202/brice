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
import { useTransition } from "react";
import { reverseTransaction } from "@/app/actions/comptabilite";

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
  const [toReverse, setToReverse] = useState<Transaction | null>(null);
  const [reason, setReason] = useState("");
  const [actionError, setActionError] = useState("");
  const [pending, startTransition] = useTransition();
  const reversedIds = useMemo(() => new Set(transactions.map((item) => item.reversed_transaction_id).filter(Boolean)), [transactions]);

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
                <th style={{ padding: "8px 6px", borderBottom: "1px solid var(--sr-border-subtle)" }}></th>
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
                  <td style={{ padding: "8px 6px", borderBottom: "1px solid var(--sr-border-subtle)", textAlign: "right" }}>{t.source !== "reversal" && !reversedIds.has(t.id) && <button type="button" className="secondary" onClick={() => { setToReverse(t); setReason(""); setActionError(""); }} style={{ minHeight: 26, height: 26, fontSize: 10 }}>Annuler</button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {toReverse && <div style={{ position: "fixed", inset: 0, zIndex: 1200, display: "grid", placeItems: "center", padding: 20, background: "rgba(0,0,0,.72)" }}><div style={{ width: "min(440px,100%)", padding: 22, borderRadius: 14, background: "var(--sr-surface)", border: "1px solid var(--sr-danger-border)" }}><h3 style={{ marginTop: 0 }}>Annuler cette écriture ?</h3><p style={{ color: "var(--sr-fg-subtle)", fontSize: 12 }}>{toReverse.label} · {formatFcfa(Number(toReverse.amount))} FCFA. Une écriture inverse sera créée et l’historique sera conservé.</p><label>Raison<textarea value={reason} onChange={(event) => setReason(event.target.value)} maxLength={300} placeholder="Ex. vente enregistrée par erreur" /></label>{actionError && <p style={{ color: "var(--sr-danger)", fontSize: 12 }}>{actionError}</p>}<div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 18 }}><button type="button" className="secondary" disabled={pending} onClick={() => setToReverse(null)}>Fermer</button><button type="button" className="danger" disabled={pending || reason.trim().length < 3} onClick={() => startTransition(async () => { try { await reverseTransaction(toReverse.id, reason); setToReverse(null); } catch (error) { setActionError(error instanceof Error ? error.message : "Annulation impossible"); } })}>{pending ? "Traitement…" : "Créer l’écriture inverse"}</button></div></div></div>}
    </div>
  );
}
