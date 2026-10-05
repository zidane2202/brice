"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { importClientsCsv } from "@/app/actions/clients";
import { Icon } from "@/components/Icon";
import { autoAssignSlots, IMPORT_MAX_ROWS, importSlotName, parseImportCsv, toImportCsv, type ImportRow, type ImportSlot } from "@/lib/client-import";
import { blockIfPlanExpired } from "@/lib/plan-expired-client";

type Report = { imported: number; failed: number; blocked?: string | null; results: Array<{ line: number; ok: boolean; message: string }> };

const ASSIGN_FIRST = "Veuillez au préalable assigner un compte et un profil à tous les clients pour continuer.";
const ASSIGN_FIRST_NO_SLOTS = "Veuillez au préalable assigner des comptes pour continuer : aucun profil libre, ajoutez ou renouvelez un compte dans Mes abonnements.";

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

const cellInput: React.CSSProperties = { width: "100%", minWidth: 0, minHeight: 28, height: 28, padding: "0 6px", fontSize: 11, background: "var(--sr-bg)" };

export function ClientCsvImportModal({ open, onClose, initialRows, freeSlots = [] }: { open: boolean; onClose: () => void; initialRows?: ImportRow[]; freeSlots?: ImportSlot[] }) {
  const [rows, setRows] = useState<ImportRow[]>(initialRows ?? []);
  const [slotIds, setSlotIds] = useState<Array<string | null>>([]);
  const [accountIds, setAccountIds] = useState<Array<string | null>>([]);
  const [error, setError] = useState("");
  const [report, setReport] = useState<Report | null>(null);
  const [pending, startTransition] = useTransition();

  const slotById = useMemo(() => new Map(freeSlots.map((slot) => [slot.id, slot])), [freeSlots]);
  const accounts = useMemo(() => {
    const unique = Array.from(new Map(freeSlots.map((slot) => [slot.account.id, slot.account])).values());
    const perService = new Map<string, number>();
    return unique
      .sort((a, b) => a.service_name.localeCompare(b.service_name))
      .map((account) => {
        const count = unique.filter((other) => other.service_name === account.service_name).length;
        const index = (perService.get(account.service_name) ?? 0) + 1;
        perService.set(account.service_name, index);
        const name = account.label ? `${account.service_name} · ${account.label}` : count > 1 ? `${account.service_name} (${index})` : account.service_name;
        return { id: account.id, name, free: freeSlots.filter((slot) => slot.account.id === account.id).length };
      });
  }, [freeSlots]);

  const load = (next: ImportRow[]) => {
    const assigned = autoAssignSlots(next, freeSlots);
    setRows(next);
    setSlotIds(assigned);
    setAccountIds(assigned.map((id) => (id ? slotById.get(id)?.account.id ?? null : null)));
  };

  useEffect(() => {
    if (!open) return;
    load(initialRows ?? []);
    setError("");
    setReport(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialRows]);

  if (!open) return null;

  const updateRow = (index: number, key: keyof ImportRow, value: string) =>
    setRows((prev) => prev.map((row, i) => (i === index ? { ...row, [key]: value } : row)));
  const takenElsewhere = (index: number) => new Set(slotIds.filter((id, i) => id && i !== index) as string[]);
  const chooseAccount = (index: number, accountId: string) => {
    const taken = takenElsewhere(index);
    const firstFree = accountId ? freeSlots.find((slot) => slot.account.id === accountId && !taken.has(slot.id)) : undefined;
    setAccountIds((prev) => prev.map((id, i) => (i === index ? accountId || null : id)));
    setSlotIds((prev) => prev.map((id, i) => (i === index ? firstFree?.id ?? null : id)));
  };
  const chooseSlot = (index: number, slotId: string) =>
    setSlotIds((prev) => prev.map((id, i) => (i === index ? slotId || null : id)));
  const assignAllMissing = (accountId: string) => {
    if (!accountId) return;
    const taken = new Set(slotIds.filter(Boolean) as string[]);
    const free = freeSlots.filter((slot) => slot.account.id === accountId && !taken.has(slot.id));
    const nextSlots = [...slotIds];
    const nextAccounts = [...accountIds];
    rows.forEach((_, index) => {
      if (nextSlots[index] || free.length === 0) return;
      nextSlots[index] = free.shift()!.id;
      nextAccounts[index] = accountId;
    });
    setSlotIds(nextSlots);
    setAccountIds(nextAccounts);
  };
  const removeRow = (index: number) => {
    setRows((prev) => prev.filter((_, i) => i !== index));
    setSlotIds((prev) => prev.filter((_, i) => i !== index));
    setAccountIds((prev) => prev.filter((_, i) => i !== index));
  };

  const payload = rows.map((row, index) => {
    const slot = slotIds[index] ? slotById.get(slotIds[index]!) : undefined;
    return slot
      ? { ...row, service: slot.account.service_name, profile: importSlotName(slot), slot_id: slot.id }
      : { ...row, service: "", profile: "", slot_id: "" };
  });
  const withSubscription = payload.filter((row) => row.slot_id && row.price).length;
  const missingPrice = payload.filter((row) => row.slot_id && !row.price).length;
  const missingSlot = payload.filter((row) => !row.slot_id).length;
  const freeLeft = freeSlots.length - slotIds.filter(Boolean).length;

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 1250, display: "grid", placeItems: "center", padding: 20, background: "rgba(0,0,0,.72)", backdropFilter: "blur(5px)" }} onMouseDown={(event) => { if (event.target === event.currentTarget && !pending) onClose(); }}>
      <div style={{ width: "min(1180px, 100%)", maxHeight: "88vh", overflow: "auto", padding: 22, borderRadius: 14, border: "1px solid var(--sr-border)", background: "var(--sr-surface)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 16 }}>
          <div>
            <h2 style={{ margin: 0 }}>Importer des clients</h2>
            <p style={{ color: "var(--sr-fg-subtle)", fontSize: 12, lineHeight: 1.5 }}>
              {`Maximum ${IMPORT_MAX_ROWS} clients. Un nom, un téléphone ou un e-mail suffit pour identifier le client, mais chaque client doit obligatoirement recevoir un compte, un profil et un montant. Seuls les comptes actifs avec des profils libres sont proposés.`}
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
              try { const file = event.target.files?.[0]; if (file) load(parseImportCsv(await file.text())); }
              catch (caught) { load([]); setError(caught instanceof Error ? caught.message : "Fichier invalide"); }
              event.target.value = "";
            }} />
          </label>
          {rows.length > 0 && (
            <button type="button" className="secondary" onClick={() => downloadImportCsv(payload, "clients-import-corrige.csv")}>
              <Icon name="download" size={13} /> Télécharger le CSV corrigé
            </button>
          )}
        </div>
        {rows.length > 0 && freeSlots.length === 0 && (
          <p style={{ color: "var(--sr-danger)", fontSize: 12 }}>
            Aucun profil libre sur vos comptes actifs. Ajoutez ou renouvelez un compte dans Mes abonnements avant d&apos;importer vos clients.
          </p>
        )}
        {rows.length > 0 && freeSlots.length > 0 && rows.length > freeSlots.length && (
          <p style={{ color: "var(--sr-warning)", fontSize: 12 }}>
            {`${rows.length} clients pour ${freeSlots.length} profil(s) libre(s) : ajoutez des comptes ou retirez des lignes pour que chaque client ait un profil.`}
          </p>
        )}
        {rows.length > 0 && missingSlot > 0 && freeLeft > 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10, fontSize: 12, flexWrap: "wrap" }}>
            <span style={{ color: "var(--sr-fg-muted)" }}>{`${missingSlot} client(s) sans compte : assigner`}</span>
            <select style={{ ...cellInput, width: "auto", minWidth: 200, height: 30, fontSize: 12 }} value="" onChange={(e) => assignAllMissing(e.target.value)}>
              <option value="">Choisir un compte…</option>
              {accounts.filter((account) => freeSlots.some((slot) => slot.account.id === account.id && !slotIds.includes(slot.id))).map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}
            </select>
          </div>
        )}
        {error && rows.length === 0 && <p style={{ color: "var(--sr-danger)", fontSize: 12 }}>{error}</p>}
        {rows.length > 0 && (
          <>
            <div style={{ overflowX: "auto", border: "1px solid var(--sr-border-subtle)", borderRadius: 8 }}>
              <table style={{ width: "100%", fontSize: 11, borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Prénom</th>
                    <th>Nom</th>
                    <th>Téléphone</th>
                    <th>Compte</th>
                    <th>Profil</th>
                    <th>Début</th>
                    <th>Mois</th>
                    <th>Montant</th>
                    <th aria-label="Retirer" />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, index) => {
                    const accountId = accountIds[index] ?? "";
                    const taken = takenElsewhere(index);
                    const profileOptions = freeSlots.filter((slot) => slot.account.id === accountId && !taken.has(slot.id));
                    const accountOptions = accounts
                      .map((account) => ({ ...account, left: freeSlots.filter((slot) => slot.account.id === account.id && !taken.has(slot.id)).length }))
                      .filter((account) => account.left > 0 || account.id === accountId);
                    const fileHint = row.service && !accountId ? `${row.service}${row.profile ? ` · ${row.profile}` : ""}` : "";
                    return (
                      <tr key={index} style={{ borderTop: "1px solid var(--sr-border-subtle)" }}>
                        <td style={{ color: "var(--sr-fg-subtle)", paddingInline: 6 }}>{index + 1}</td>
                        <td><input style={cellInput} value={row.first_name ?? ""} onChange={(e) => updateRow(index, "first_name", e.target.value)} /></td>
                        <td><input style={cellInput} value={row.last_name ?? ""} onChange={(e) => updateRow(index, "last_name", e.target.value)} /></td>
                        <td><input style={cellInput} type="tel" value={row.phone ?? ""} onChange={(e) => updateRow(index, "phone", e.target.value)} /></td>
                        <td style={{ minWidth: 150 }}>
                          <select style={{ ...cellInput, borderColor: accountId ? undefined : "var(--sr-danger)" }} value={accountId} onChange={(e) => chooseAccount(index, e.target.value)}>
                            <option value="">Choisir un compte</option>
                            {accountOptions.map((account) => <option key={account.id} value={account.id}>{account.left > 1 ? `${account.name} (${account.left} libres)` : `${account.name} (${account.left} libre)`}</option>)}
                          </select>
                          {fileHint && <div title="Valeur du fichier, introuvable parmi les comptes disponibles" style={{ marginTop: 2, color: "var(--sr-warning)", fontSize: 10 }} data-no-i18n>{fileHint}</div>}
                        </td>
                        <td style={{ minWidth: 120 }}>
                          <select style={{ ...cellInput, borderColor: accountId && !slotIds[index] ? "var(--sr-danger)" : undefined }} value={slotIds[index] ?? ""} disabled={!accountId} onChange={(e) => chooseSlot(index, e.target.value)}>
                            <option value="">{accountId ? "Choisir un profil" : "—"}</option>
                            {profileOptions.map((slot) => <option key={slot.id} value={slot.id}>{importSlotName(slot)}</option>)}
                          </select>
                        </td>
                        <td><input style={{ ...cellInput, colorScheme: "dark" }} type="date" value={row.start_date ?? ""} onChange={(e) => updateRow(index, "start_date", e.target.value)} /></td>
                        <td style={{ width: 56 }}><input style={cellInput} type="number" min={1} max={24} value={row.duration_months ?? ""} placeholder="1" onChange={(e) => updateRow(index, "duration_months", e.target.value)} /></td>
                        <td style={{ width: 90 }}>
                          <input style={{ ...cellInput, borderColor: !row.price ? "var(--sr-danger)" : undefined }} type="number" min={1} value={row.price ?? ""} placeholder="FCFA" onChange={(e) => updateRow(index, "price", e.target.value)} />
                        </td>
                        <td><button type="button" className="secondary" aria-label="Retirer la ligne" onClick={() => removeRow(index)} style={{ minHeight: 26, height: 26, width: 26, padding: 0, justifyContent: "center" }}><Icon name="x" size={11} /></button></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p style={{ color: "var(--sr-fg-subtle)", fontSize: 11 }}>
              {`${rows.length} client(s) · ${withSubscription} prêt(s) à importer`}
              {missingSlot > 0 && <span style={{ color: "var(--sr-danger)" }}>{` · ${missingSlot} sans compte ni profil`}</span>}
              {missingPrice > 0 && <span style={{ color: "var(--sr-danger)" }}>{` · ${missingPrice} profil(s) choisi(s) sans montant`}</span>}
            </p>
          </>
        )}
        {report && (
          <div style={{ padding: 12, borderRadius: 8, background: "var(--sr-bg)", fontSize: 12 }}>
            {report.blocked ? (
              <strong style={{ color: "var(--sr-danger)" }}>{report.blocked}</strong>
            ) : (
              <><strong style={{ color: "var(--sr-success)" }}>{`${report.imported} importé(s)`}</strong> · <strong style={{ color: report.failed ? "var(--sr-danger)" : "var(--sr-fg)" }}>{`${report.failed} refusé(s)`}</strong></>
            )}
            {report.results.filter((item) => !item.ok).map((item) => (
              <div key={item.line} style={{ marginTop: 6, color: item.ok ? "var(--sr-fg-subtle)" : "var(--sr-danger)" }}>{`Ligne ${item.line} : ${item.message}`}</div>
            ))}
          </div>
        )}
        {error && rows.length > 0 && (
          <p role="alert" style={{ marginTop: 14, padding: "10px 12px", borderRadius: 8, border: "1px solid var(--sr-danger)", color: "var(--sr-danger)", fontSize: 12 }}>{error}</p>
        )}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 18 }}>
          <button type="button" className="secondary" onClick={onClose} disabled={pending}>Fermer</button>
          <button type="button" disabled={!rows.length || pending || Boolean(report && !report.blocked)} onClick={() => {
            if (blockIfPlanExpired()) return;
            if (missingSlot > 0 || missingPrice > 0) {
              setReport(null);
              setError(freeSlots.length === 0 ? ASSIGN_FIRST_NO_SLOTS : ASSIGN_FIRST);
              return;
            }
            startTransition(async () => {
            setError("");
            try { setReport(await importClientsCsv(payload)); }
            catch (caught) { setError(caught instanceof Error ? caught.message : "Import impossible"); }
            });
          }}>
            {pending ? "Import en cours…" : `Importer ${rows.length} client(s)`}
          </button>
        </div>
      </div>
    </div>
  );
}

export function ClientCsvImport({ freeSlots }: { freeSlots: ImportSlot[] }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className="secondary" onClick={() => setOpen(true)}><Icon name="upload" size={14} /> Importer CSV</button>
      <ClientCsvImportModal open={open} onClose={() => setOpen(false)} freeSlots={freeSlots} />
    </>
  );
}
