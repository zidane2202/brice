"use client";

import { useState, useTransition } from "react";
import { importClientsCsv } from "@/app/actions/clients";
import { Icon } from "@/components/Icon";

const columns = ["first_name", "last_name", "phone", "email", "service", "profile", "start_date", "duration_months", "price", "payment_rail", "pin_code"];
type Row = Record<string, string>;

function parseCsv(text: string) {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter((line) => line.trim());
  if (lines.length < 2) throw new Error("Le fichier ne contient aucune donnée.");
  const separator = lines[0].includes(";") ? ";" : ",";
  const headers = lines[0].split(separator).map((value) => value.trim().replace(/^"|"$/g, ""));
  const missing = columns.filter((column) => !headers.includes(column));
  if (missing.length) throw new Error(`Colonnes manquantes : ${missing.join(", ")}`);
  return lines.slice(1, 101).map((line) => Object.fromEntries(headers.map((header, index) => [header, (line.split(separator)[index] ?? "").trim().replace(/^"|"$/g, "")])));
}

export function ClientCsvImport() {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);
  const [error, setError] = useState("");
  const [report, setReport] = useState<{ imported: number; failed: number; results: Array<{ line: number; ok: boolean; message: string }> } | null>(null);
  const [pending, startTransition] = useTransition();
  const template = `${columns.join(";")}\nJean;Kamga;699000000;jean@example.com;Netflix;Profil 1;2026-08-04;1;3000;MTN MoMo;1234`;
  const downloadTemplate = () => {
    const url = URL.createObjectURL(new Blob(["\uFEFF", template], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a"); link.href = url; link.download = "modele-import-clients.csv"; link.click(); URL.revokeObjectURL(url);
  };
  return <>
    <button type="button" className="secondary" onClick={() => setOpen(true)}><Icon name="upload" size={14} /> Importer CSV</button>
    {open && <div style={{ position: "fixed", inset: 0, zIndex: 1200, display: "grid", placeItems: "center", padding: 20, background: "rgba(0,0,0,.72)", backdropFilter: "blur(5px)" }} onMouseDown={(event) => { if (event.target === event.currentTarget && !pending) setOpen(false); }}>
      <div style={{ width: "min(760px, 100%)", maxHeight: "85vh", overflow: "auto", padding: 22, borderRadius: 14, border: "1px solid var(--sr-border)", background: "var(--sr-surface)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 16 }}><div><h2 style={{ margin: 0 }}>Importer des clients</h2><p style={{ color: "var(--sr-fg-subtle)", fontSize: 12 }}>Maximum 100 lignes. Le service et le profil doivent correspondre exactement aux noms affichés.</p></div><button type="button" className="secondary" onClick={() => setOpen(false)}><Icon name="x" size={14} /></button></div>
        <div style={{ display: "flex", gap: 8, margin: "16px 0" }}><button type="button" className="secondary" onClick={downloadTemplate}>Télécharger le modèle</button><label className="secondary" style={{ display: "inline-flex", alignItems: "center", cursor: "pointer", padding: "0 12px" }}>Choisir le CSV<input type="file" accept=".csv,text/csv" hidden onChange={async (event) => { setError(""); setReport(null); try { const file = event.target.files?.[0]; if (file) setRows(parseCsv(await file.text())); } catch (caught) { setRows([]); setError(caught instanceof Error ? caught.message : "Fichier invalide"); } }} /></label></div>
        {error && <p style={{ color: "var(--sr-danger)", fontSize: 12 }}>{error}</p>}
        {rows.length > 0 && <><div style={{ overflowX: "auto", border: "1px solid var(--sr-border-subtle)", borderRadius: 8 }}><table style={{ width: "100%", fontSize: 11 }}><thead><tr>{["Prénom", "Téléphone", "Service", "Profil", "Montant"].map((item) => <th key={item}>{item}</th>)}</tr></thead><tbody>{rows.slice(0, 8).map((row, index) => <tr key={index}><td>{row.first_name}</td><td>{row.phone}</td><td>{row.service}</td><td>{row.profile}</td><td>{row.price}</td></tr>)}</tbody></table></div><p style={{ color: "var(--sr-fg-subtle)", fontSize: 11 }}>{rows.length} ligne(s) détectée(s){rows.length > 8 ? ", aperçu limité aux 8 premières" : ""}.</p></>}
        {report && <div style={{ padding: 12, borderRadius: 8, background: "var(--sr-bg)", fontSize: 12 }}><strong style={{ color: "var(--sr-success)" }}>{report.imported} importée(s)</strong> · <strong style={{ color: report.failed ? "var(--sr-danger)" : "var(--sr-fg)" }}>{report.failed} refusée(s)</strong>{report.results.filter((item) => !item.ok).map((item) => <div key={item.line} style={{ marginTop: 6, color: "var(--sr-danger)" }}>Ligne {item.line} : {item.message}</div>)}</div>}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 18 }}><button type="button" className="secondary" onClick={() => setOpen(false)} disabled={pending}>Fermer</button><button type="button" disabled={!rows.length || pending} onClick={() => startTransition(async () => { setError(""); try { setReport(await importClientsCsv(rows)); } catch (caught) { setError(caught instanceof Error ? caught.message : "Import impossible"); } })}>{pending ? "Import en cours…" : `Importer ${rows.length} client(s)`}</button></div>
      </div>
    </div>}
  </>;
}
