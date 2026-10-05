"use client";

import { useEffect, useState, useTransition } from "react";
import { importProviderAccounts } from "@/app/actions/accounts";
import { Icon } from "@/components/Icon";
import { ImportAssistant, downloadCsv } from "@/components/ImportAssistant";
import { ACCOUNT_IMPORT_MAX_ROWS, parseAccountCsv, prefillAccountRow, toAccountCsv, type AccountImportRow } from "@/lib/account-import";
import { ADMIN_UNLIMITED } from "@/lib/plans";
import { blockIfPlanExpired } from "@/lib/plan-expired-client";
import { SERVICES } from "@/lib/services";

type Report = { imported: number; failed: number; results: Array<{ line: number; ok: boolean; message: string }> };

const TEMPLATE_ROWS: AccountImportRow[] = [
  { service_name: "Netflix", label: "Compte 1", account_email: "compte@mail.com", account_password: "motdepasse", max_slots: "5", end_date: "2026-11-04", duration_months: "1", cost: "6500" },
  { service_name: "Spotify", max_slots: "6" },
];

const cellInput: React.CSSProperties = { width: "100%", minWidth: 0, minHeight: 28, height: 28, padding: "0 6px", fontSize: 11, background: "var(--sr-bg)" };

export function AccountCsvImportModal({ open, onClose, initialRows, slotCap }: { open: boolean; onClose: () => void; initialRows?: AccountImportRow[]; slotCap: number }) {
  const [rows, setRows] = useState<AccountImportRow[]>([]);
  const [error, setError] = useState("");
  const [report, setReport] = useState<Report | null>(null);
  const [pending, startTransition] = useTransition();
  const load = (next: AccountImportRow[]) => setRows(next.map((row) => prefillAccountRow(row, slotCap)));

  useEffect(() => {
    if (!open) return;
    load(initialRows ?? []);
    setError("");
    setReport(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialRows]);

  if (!open) return null;

  const update = (index: number, key: keyof AccountImportRow, value: string) =>
    setRows((prev) => prev.map((row, i) => (i === index ? { ...row, [key]: value } : row)));
  const limited = slotCap < ADMIN_UNLIMITED;
  const missingSlots = rows.filter((row) => !row.max_slots).length;
  const overCap = limited ? rows.filter((row) => Number(row.max_slots) > slotCap).length : 0;

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 1250, display: "grid", placeItems: "center", padding: 20, background: "rgba(0,0,0,.72)", backdropFilter: "blur(5px)" }} onMouseDown={(event) => { if (event.target === event.currentTarget && !pending) onClose(); }}>
      <div style={{ width: "min(1180px, 100%)", maxHeight: "88vh", overflow: "auto", padding: 22, borderRadius: 14, border: "1px solid var(--sr-border)", background: "var(--sr-surface)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 16 }}>
          <div>
            <h2 style={{ margin: 0 }}>Importer des comptes</h2>
            <p style={{ color: "var(--sr-fg-subtle)", fontSize: 12, lineHeight: 1.5 }}>
              {`Maximum ${ACCOUNT_IMPORT_MAX_ROWS} comptes. Le service et le nombre de profils sont indispensables, le reste est facultatif. Indiquez l'échéance si vous la connaissez, sinon le compte démarre aujourd'hui pour la durée choisie. Le coût sert aux prochains renouvellements : aucune dépense n'est ajoutée à la comptabilité.`}
            </p>
          </div>
          <button type="button" className="secondary" onClick={onClose} aria-label="Fermer"><Icon name="x" size={14} /></button>
        </div>
        <div style={{ display: "flex", gap: 8, margin: "16px 0", flexWrap: "wrap" }}>
          <button type="button" className="secondary" onClick={() => downloadCsv(toAccountCsv(TEMPLATE_ROWS), "modele-import-comptes.csv")}>Télécharger le modèle</button>
          <label className="secondary" style={{ display: "inline-flex", alignItems: "center", cursor: "pointer", padding: "0 12px" }}>
            Choisir le CSV
            <input type="file" accept=".csv,text/csv,text/plain" hidden onChange={async (event) => {
              setError(""); setReport(null);
              try { const file = event.target.files?.[0]; if (file) load(parseAccountCsv(await file.text())); }
              catch (caught) { load([]); setError(caught instanceof Error ? caught.message : "Fichier invalide"); }
              event.target.value = "";
            }} />
          </label>
          {rows.length > 0 && (
            <button type="button" className="secondary" onClick={() => downloadCsv(toAccountCsv(rows), "comptes-import-corrige.csv")}>
              <Icon name="download" size={13} /> Télécharger le CSV corrigé
            </button>
          )}
        </div>
        {error && <p style={{ color: "var(--sr-danger)", fontSize: 12 }}>{error}</p>}
        {rows.length > 0 && (
          <>
            <datalist id="account-import-services">
              {SERVICES.map((service) => <option key={service.name} value={service.name} />)}
            </datalist>
            <div style={{ overflowX: "auto", border: "1px solid var(--sr-border-subtle)", borderRadius: 8 }}>
              <table style={{ width: "100%", fontSize: 11, borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Service</th>
                    <th>Libellé</th>
                    <th>E-mail</th>
                    <th>Mot de passe</th>
                    <th>Profils</th>
                    <th>Échéance</th>
                    <th>Mois</th>
                    <th>Coût</th>
                    <th aria-label="Retirer" />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, index) => {
                    const slotsWarning = !row.max_slots || (limited && Number(row.max_slots) > slotCap);
                    return (
                      <tr key={index} style={{ borderTop: "1px solid var(--sr-border-subtle)" }}>
                        <td style={{ color: "var(--sr-fg-subtle)", paddingInline: 6 }}>{index + 1}</td>
                        <td style={{ minWidth: 130 }}>
                          <input style={{ ...cellInput, borderColor: row.service_name ? undefined : "var(--sr-danger)" }} list="account-import-services" value={row.service_name ?? ""} onChange={(e) => update(index, "service_name", e.target.value)} onBlur={() => setRows((prev) => prev.map((r, i) => (i === index ? prefillAccountRow(r, slotCap) : r)))} />
                        </td>
                        <td><input style={cellInput} value={row.label ?? ""} onChange={(e) => update(index, "label", e.target.value)} /></td>
                        <td style={{ minWidth: 150 }}><input style={cellInput} type="email" value={row.account_email ?? ""} onChange={(e) => update(index, "account_email", e.target.value)} data-no-i18n /></td>
                        <td><input style={cellInput} value={row.account_password ?? ""} onChange={(e) => update(index, "account_password", e.target.value)} autoComplete="off" data-no-i18n /></td>
                        <td style={{ width: 64 }}>
                          <input style={{ ...cellInput, borderColor: slotsWarning ? "var(--sr-warning)" : undefined }} type="number" min={1} max={limited ? slotCap : undefined} value={row.max_slots ?? ""} onChange={(e) => update(index, "max_slots", e.target.value)} />
                        </td>
                        <td><input style={{ ...cellInput, colorScheme: "dark" }} type="date" value={row.end_date ?? ""} onChange={(e) => update(index, "end_date", e.target.value)} /></td>
                        <td style={{ width: 56 }}><input style={cellInput} type="number" min={1} max={24} value={row.duration_months ?? ""} placeholder="1" onChange={(e) => update(index, "duration_months", e.target.value)} /></td>
                        <td style={{ width: 90 }}><input style={cellInput} type="number" min={0} value={row.cost ?? ""} placeholder="FCFA" onChange={(e) => update(index, "cost", e.target.value)} /></td>
                        <td><button type="button" className="secondary" aria-label="Retirer la ligne" onClick={() => setRows((prev) => prev.filter((_, i) => i !== index))} style={{ minHeight: 26, height: 26, width: 26, padding: 0, justifyContent: "center" }}><Icon name="x" size={11} /></button></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p style={{ color: "var(--sr-fg-subtle)", fontSize: 11 }}>
              {`${rows.length} compte(s)`}
              {limited && ` · maximum ${slotCap} profils par compte sur votre pack`}
              {missingSlots > 0 && <span style={{ color: "var(--sr-warning)" }}>{` · ${missingSlots} sans nombre de profils`}</span>}
              {overCap > 0 && <span style={{ color: "var(--sr-warning)" }}>{` · ${overCap} au-delà de la limite du pack`}</span>}
            </p>
          </>
        )}
        {report && (
          <div style={{ padding: 12, borderRadius: 8, background: "var(--sr-bg)", fontSize: 12 }}>
            <strong style={{ color: "var(--sr-success)" }}>{`${report.imported} importé(s)`}</strong> · <strong style={{ color: report.failed ? "var(--sr-danger)" : "var(--sr-fg)" }}>{`${report.failed} refusé(s)`}</strong>
            {report.results.filter((item) => !item.ok || item.message.includes("expiré")).map((item) => (
              <div key={item.line} style={{ marginTop: 6, color: item.ok ? "var(--sr-fg-subtle)" : "var(--sr-danger)" }}>{`Ligne ${item.line} : ${item.message}`}</div>
            ))}
          </div>
        )}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 18 }}>
          <button type="button" className="secondary" onClick={onClose} disabled={pending}>Fermer</button>
          <button type="button" disabled={!rows.length || pending || Boolean(report)} onClick={() => !blockIfPlanExpired() && startTransition(async () => {
            setError("");
            try { setReport(await importProviderAccounts(rows)); }
            catch (caught) { setError(caught instanceof Error ? caught.message : "Import impossible"); }
          })}>
            {pending ? "Import en cours…" : `Importer ${rows.length} compte(s)`}
          </button>
        </div>
      </div>
    </div>
  );
}

export function AccountCsvImport({ slotCap }: { slotCap: number }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className="secondary" onClick={() => setOpen(true)}><Icon name="upload" size={14} /> Importer CSV</button>
      <AccountCsvImportModal open={open} onClose={() => setOpen(false)} slotCap={slotCap} />
    </>
  );
}

const WELCOME =
  "Envoyez-moi la liste de vos comptes fournisseurs, sous n'importe quelle forme : texte collé, capture d'écran, PDF, Excel ou Word. Je récupère le service, les identifiants, le nombre de profils, l'échéance et le coût, puis je prépare un CSV à vérifier avant l'import.";

export function AccountImportAssistant({ slotCap }: { slotCap: number }) {
  return (
    <ImportAssistant<AccountImportRow>
      endpoint="/api/accounts/import-assistant"
      dialogLabel="Assistant d'import de comptes"
      welcome={WELCOME}
      filenamePrefix="comptes-import"
      toCsv={toAccountCsv}
      foundLabel={(count) => `${count} compte(s) trouvé(s)`}
      renderImport={(rows, close) => (
        <AccountCsvImportModal open={rows !== null} onClose={close} initialRows={rows ?? undefined} slotCap={slotCap} />
      )}
    />
  );
}
