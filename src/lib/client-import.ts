export const IMPORT_COLUMNS = [
  "first_name",
  "last_name",
  "phone",
  "email",
  "service",
  "profile",
  "start_date",
  "duration_months",
  "price",
  "payment_rail",
  "pin_code",
] as const;

export type ImportColumn = (typeof IMPORT_COLUMNS)[number];
export type ImportRow = Partial<Record<ImportColumn, string>>;

export const IMPORT_MAX_ROWS = 100;

const HEADER_ALIASES: Record<string, ImportColumn> = {
  prenom: "first_name",
  prénom: "first_name",
  firstname: "first_name",
  nom: "last_name",
  lastname: "last_name",
  nom_de_famille: "last_name",
  telephone: "phone",
  téléphone: "phone",
  tel: "phone",
  tél: "phone",
  numero: "phone",
  numéro: "phone",
  whatsapp: "phone",
  mail: "email",
  e_mail: "email",
  "e-mail": "email",
  abonnement: "service",
  plateforme: "service",
  profil: "profile",
  date_debut: "start_date",
  date_début: "start_date",
  debut: "start_date",
  début: "start_date",
  durée: "duration_months",
  duree: "duration_months",
  mois: "duration_months",
  montant: "price",
  prix: "price",
  moyen_paiement: "payment_rail",
  paiement: "payment_rail",
  pin: "pin_code",
  code_pin: "pin_code",
};

function normalizeHeader(value: string): string {
  const key = value.trim().toLowerCase().replace(/\s+/g, "_");
  if ((IMPORT_COLUMNS as readonly string[]).includes(key)) return key;
  return HEADER_ALIASES[key] ?? key;
}

function parseLine(line: string, separator: string) {
  const values: string[] = [];
  let value = "";
  let quoted = false;
  for (let index = 0; index < line.length; index++) {
    const char = line[index];
    if (char === '"' && quoted && line[index + 1] === '"') {
      value += '"';
      index++;
    } else if (char === '"') quoted = !quoted;
    else if (char === separator && !quoted) {
      values.push(value.trim());
      value = "";
    } else value += char;
  }
  values.push(value.trim());
  return values;
}

/** Lit un CSV au format de la plateforme ; toutes les colonnes sont facultatives. */
export function parseImportCsv(text: string): ImportRow[] {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter((line) => line.trim());
  if (lines.length < 2) throw new Error("Le fichier ne contient aucune donnée.");
  const separator = lines[0].includes(";") ? ";" : lines[0].includes("\t") ? "\t" : ",";
  const headers = parseLine(lines[0], separator).map(normalizeHeader);
  if (!headers.some((header) => (IMPORT_COLUMNS as readonly string[]).includes(header))) {
    throw new Error(`Aucune colonne reconnue. Colonnes attendues : ${IMPORT_COLUMNS.join(", ")}`);
  }
  const rows = lines.slice(1).map((line) => {
    const values = parseLine(line, separator);
    const row: ImportRow = {};
    headers.forEach((header, index) => {
      if ((IMPORT_COLUMNS as readonly string[]).includes(header) && values[index]) {
        row[header as ImportColumn] = values[index];
      }
    });
    return normalizeImportRow(row);
  });
  const filled = rows.filter(hasIdentity);
  if (filled.length > IMPORT_MAX_ROWS) {
    throw new Error(`Maximum ${IMPORT_MAX_ROWS} clients par import (${filled.length} trouvés). Découpez le fichier.`);
  }
  return filled;
}

export function hasIdentity(row: ImportRow): boolean {
  return Boolean(row.first_name || row.last_name || row.phone || row.email);
}

function normalizeDate(value: string): string {
  const v = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  const fr = v.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})$/);
  if (fr) {
    const year = fr[3].length === 2 ? `20${fr[3]}` : fr[3];
    return `${year}-${fr[2].padStart(2, "0")}-${fr[1].padStart(2, "0")}`;
  }
  return v;
}

function normalizeAmount(value: string): string {
  const digits = value.replace(/[^\d.,]/g, "").replace(/[.,](?=\d{3}\b)/g, "").replace(",", ".");
  const amount = Number.parseFloat(digits);
  return Number.isFinite(amount) && amount > 0 ? String(Math.round(amount)) : "";
}

function normalizeDuration(value: string): string {
  const months = Number.parseInt(value.replace(/[^\d]/g, ""), 10);
  return Number.isInteger(months) && months >= 1 && months <= 24 ? String(months) : "";
}

function normalizePhone(value: string): string {
  const v = value.trim();
  const plus = v.startsWith("+") ? "+" : "";
  return plus + v.replace(/[^\d]/g, "");
}

export function normalizeImportRow(input: Record<string, unknown>): ImportRow {
  const row: ImportRow = {};
  for (const column of IMPORT_COLUMNS) {
    const raw = input[column];
    if (raw == null) continue;
    let value = String(raw).trim().slice(0, 200);
    if (!value) continue;
    if (column === "start_date") value = normalizeDate(value);
    else if (column === "price") value = normalizeAmount(value);
    else if (column === "duration_months") value = normalizeDuration(value);
    else if (column === "phone") value = normalizePhone(value);
    else if (column === "email") value = value.toLowerCase();
    if (value) row[column] = value;
  }
  return row;
}

function csvCell(value: string): string {
  return /[";\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

export function toImportCsv(rows: ImportRow[]): string {
  const lines = [IMPORT_COLUMNS.join(";")];
  for (const row of rows) lines.push(IMPORT_COLUMNS.map((column) => csvCell(row[column] ?? "")).join(";"));
  return lines.join("\n");
}
