import { csvCell, normalizeAmount, normalizeDate, normalizeDuration, parseCsvTable } from "./client-import.ts";
import { SERVICES } from "./services.ts";

export const ACCOUNT_IMPORT_COLUMNS = [
  "service_name",
  "label",
  "account_email",
  "account_password",
  "max_slots",
  "start_date",
  "end_date",
  "duration_months",
  "cost",
] as const;

export type AccountImportColumn = (typeof ACCOUNT_IMPORT_COLUMNS)[number];
export type AccountImportRow = Partial<Record<AccountImportColumn, string>>;

export const ACCOUNT_IMPORT_MAX_ROWS = 50;

const HEADER_ALIASES: Record<string, AccountImportColumn> = {
  service: "service_name",
  plateforme: "service_name",
  abonnement: "service_name",
  fournisseur: "service_name",
  libelle: "label",
  libellé: "label",
  nom: "label",
  email: "account_email",
  "e-mail": "account_email",
  e_mail: "account_email",
  mail: "account_email",
  identifiant: "account_email",
  login: "account_email",
  mot_de_passe: "account_password",
  password: "account_password",
  mdp: "account_password",
  profils: "max_slots",
  places: "max_slots",
  ecrans: "max_slots",
  écrans: "max_slots",
  debut: "start_date",
  début: "start_date",
  date_debut: "start_date",
  date_début: "start_date",
  fin: "end_date",
  echeance: "end_date",
  échéance: "end_date",
  expiration: "end_date",
  date_fin: "end_date",
  duree: "duration_months",
  durée: "duration_months",
  mois: "duration_months",
  cout: "cost",
  coût: "cost",
  prix: "cost",
  montant: "cost",
};

function normalizeSlots(value: string): string {
  const slots = Number.parseInt(value.replace(/[^\d]/g, ""), 10);
  return Number.isInteger(slots) && slots >= 1 && slots <= 50 ? String(slots) : "";
}

export function normalizeAccountRow(input: Record<string, unknown>): AccountImportRow {
  const row: AccountImportRow = {};
  for (const column of ACCOUNT_IMPORT_COLUMNS) {
    const raw = input[column];
    if (raw == null) continue;
    let value = String(raw).trim().slice(0, 200);
    if (!value) continue;
    if (column === "start_date" || column === "end_date") value = normalizeDate(value);
    else if (column === "cost") value = normalizeAmount(value);
    else if (column === "duration_months") value = normalizeDuration(value);
    else if (column === "max_slots") value = normalizeSlots(value);
    else if (column === "account_email") value = value.toLowerCase();
    if (value) row[column] = value;
  }
  return row;
}

export function parseAccountCsv(text: string): AccountImportRow[] {
  const rows = parseCsvTable(text, ACCOUNT_IMPORT_COLUMNS, HEADER_ALIASES).map(normalizeAccountRow).filter((row) => row.service_name);
  if (rows.length > ACCOUNT_IMPORT_MAX_ROWS) {
    throw new Error(`Maximum ${ACCOUNT_IMPORT_MAX_ROWS} comptes par import (${rows.length} trouvés). Découpez le fichier.`);
  }
  return rows;
}

export function toAccountCsv(rows: AccountImportRow[]): string {
  const lines = [ACCOUNT_IMPORT_COLUMNS.join(";")];
  for (const row of rows) lines.push(ACCOUNT_IMPORT_COLUMNS.map((column) => csvCell(row[column] ?? "")).join(";"));
  return lines.join("\n");
}

/** Service connu : nom officiel et nombre de profils par défaut, plafonné par le pack. */
export function prefillAccountRow(row: AccountImportRow, slotCap: number): AccountImportRow {
  const known = SERVICES.find((service) => service.name.toLowerCase() === row.service_name?.trim().toLowerCase());
  if (!known) return row;
  return { ...row, service_name: known.name, max_slots: row.max_slots || String(Math.min(known.maxProfiles, slotCap)) };
}

function shiftMonths(date: string, months: number) {
  const [y, m, d] = date.split("-").map(Number);
  const first = new Date(Date.UTC(y, m - 1 + months, 1));
  const lastDay = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
  first.setUTCDate(Math.min(d, lastDay));
  return first.toISOString().slice(0, 10);
}

/** L'échéance prime : sans elle, on part du début (ou d'aujourd'hui) plus la durée. */
export function accountPeriod(row: AccountImportRow, today: string) {
  const months = Number(row.duration_months) || 1;
  const valid = (value?: string) => (value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : undefined);
  const end = valid(row.end_date);
  const start = valid(row.start_date);
  if (end) return { start_date: start ?? shiftMonths(end, -months), end_date: end, duration_months: months };
  const from = start ?? today;
  return { start_date: from, end_date: shiftMonths(from, months), duration_months: months };
}
