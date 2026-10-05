"use client";

import { useEffect, useState, useTransition } from "react";
import { importClientsCsv } from "@/app/actions/clients";
import { Icon } from "@/components/Icon";
import { IMPORT_MAX_ROWS, parseImportCsv, toImportCsv, type ImportRow } from "@/lib/client-import";
import { blockIfPlanExpired } from "@/lib/plan-expired-client";

type Report = { imported: number; failed: number; results: Array<{ line: number; ok: boolean; message: string }> };

export function downloadImportCsv(rows: ImportRow[], filename: string) {
  const url = URL.createObjectURL(new Blob(["\uFEFF", toImportCsv(rows)], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

const TEMPLATE_ROWS: ImportRow[] = [
  { first_name: "Jean", last_name: "Kamga", phone: "699000000", email: "jean@example.com", service: "Netflix", profile: "Profil 1", start_date: "2026-08-04", duration_months: "1", price: "3000", payment_rail: "MTN MoMo", pin_code: "1234" },
  { first_name: "Aïcha", phone: "677000000" },
];

const PREVIEW_COLUMNS: Array<{ key: keyof ImportRow; label: string }> = [
  { key: "first_name", label: "Prénom" },
  { key: "last_name", label: "Nom" },
  { key: "phone", label: "Téléphone" },
  { key: "service", label: "Service" },
  { key: "profile", label: "Profil" },
  { key: "start_date", label: "Début" },
  { key: "price", label: "Montant" },
];

export function ClientCsvImportModal({ open, onClose, initialRows }: { open: boolean; onClose: () => void; initialRows?: ImportRow[] }) {
  const [rows, setRows] = useState<ImportRow[]>(initialRows ?? []);
  const [error, setError] = useState("");
  const [report, setReport] = useState<Report | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!open) return;
    setRows(initialRows ?? []);
    setError("");
    setReport(null);
  }, [open, initialRows]);

  if (!open) return null;
  const withSubscription = rows.filter((row) => row.service && row.profile && row.price).length;

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 1250, display: "grid", placeItems: "center", padding: 20, background: "rgba(0,0,0,.72)", backdropFilter: "blur(5px)" }} onMouseDown={(event) => { if (event.target === event.currentTarget && !pending) onClose(); }}>
      <div style={{ width: "min(820px, 100%)", maxHeight: "85vh", overflow: "auto", padding: 22, borderRadius: 14, border: "1px solid var(--sr-border)", background: "var(--sr-surface)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 16 }}>
          <div>
            <h2 style={{ margin: 0 }}>Importer des clients</h2>
            <p style={{ color: "var(--sr-fg-subtle)", fontSize: 12, lineHeight: 1.5 }}>
              {`Maximum ${IMPORT_MAX_ROWS} clients. Aucune colonne n'est obligatoire : un nom, un téléphone ou un e-mail suffit. L'abonnement n'est créé que si le service, le profil et le montant sont renseignés et que le profil est libre.`}
            </p>
          </div>
          <button type="button" className="secondary" onClick={onClose} aria-label="Fermer"><Icon name="x" size={14} /></button>
        </div>
        <div style={{ display: "flex", gap: 8, margin: "16px 0", flexWrap: "wrap" }}>
          <button type="button" className="secondary" onClick={() => downloadImportCsv(TEMPLATE_ROWS, "modele-import-clients.csv")}>Télécharger le modèle</button>
          <label className="secondary" style={{ display: "inline-flex", alignItems: "center", cursor: "pointer", padding: "0 12px" }}>
            Choisir le CSV
            <input type="file" accept=".csv,text/csv,text/plain" hidden onChange={async (event) => {
              setError(""); setReport(null);
              try { const file = event.target.files?.[0]; if (file) setRows(parseImportCsv(await file.text())); }
              catch (caught) { setRows([]); setError(caught instanceof Error ? caught.message : "Fichier invalide"); }
              event.target.value = "";
            }} />
          </label>
        </div>
        {error && <p style={{ color: "var(--sr-danger)", fontSize: 12 }}>{error}</p>}
        {rows.length > 0 && (
          <>
            <div style={{ overflowX: "auto", border: "1px solid var(--sr-border-subtle)", borderRadius: 8 }}>
              <table style={{ width: "100%", fontSize: 11 }}>
                <thead><tr><th>#</th>{PREVIEW_COLUMNS.map((column) => <th key={column.key}>{column.label}</th>)}</tr></thead>
                <tbody>
                  {rows.slice(0, 50).map((row, index) => (
                    <tr key={index}>
                      <td>{index + 1}</td>
                      {PREVIEW_COLUMNS.map((column) => <td key={column.key} style={{ color: row[column.key] ? undefined : "var(--sr-fg-subtle)" }}>{row[column.key] || "—"}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p style={{ color: "var(--sr-fg-subtle)", fontSize: 11 }}>
              {rows.length > 50
                ? `${rows.length} client(s) · ${withSubscription} avec abonnement · ${rows.length - withSubscription} sans abonnement · aperçu limité aux 50 premiers`
                : `${rows.length} client(s) · ${withSubscription} avec abonnement · ${rows.length - withSubscription} sans abonnement`}
            </p>
          </>
        )}
        {report && (
          <div style={{ padding: 12, borderRadius: 8, background: "var(--sr-bg)", fontSize: 12 }}>
            <strong style={{ color: "var(--sr-success)" }}>{`${report.imported} importé(s)`}</strong> · <strong style={{ color: report.failed ? "var(--sr-danger)" : "var(--sr-fg)" }}>{`${report.failed} refusé(s)`}</strong>
            {report.results.filter((item) => !item.ok || item.message.includes("sans abonnement")).map((item) => (
              <div key={item.line} style={{ marginTop: 6, color: item.ok ? "var(--sr-fg-subtle)" : "var(--sr-danger)" }}>{`Ligne ${item.line} : ${item.message}`}</div>
            ))}
          </div>
        )}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 18 }}>
          <button type="button" className="secondary" onClick={onClose} disabled={pending}>Fermer</button>
          <button type="button" disabled={!rows.length || pending || Boolean(report)} onClick={() => !blockIfPlanExpired() && startTransition(async () => {
            setError("");
            try { setReport(await importClientsCsv(rows)); }
            catch (caught) { setError(caught instanceof Error ? caught.message : "Import impossible"); }
          })}>
            {pending ? "Import en cours…" : `Importer ${rows.length} client(s)`}
          </button>
        </div>
      </div>
    </div>
  );
}

export function ClientCsvImport() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className="secondary" onClick={() => setOpen(true)}><Icon name="upload" size={14} /> Importer CSV</button>
      <ClientCsvImportModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}
