import type { ExpenseCategory, Transaction, TransactionSource } from "./types";

export const EXPENSE_CATEGORIES: { value: ExpenseCategory; label: string }[] = [
  { value: "account_renewal", label: "Renouvellement compte" },
  { value: "data", label: "Data / Internet" },
  { value: "ads", label: "Publicité" },
  { value: "momo_fees", label: "Frais MoMo / paiement" },
  { value: "rent", label: "Loyer" },
  { value: "other", label: "Autre" },
];

const SOURCE_LABELS: Record<TransactionSource, string> = {
  new_profile: "Nouveau profil",
  profile_renewal: "Renouvellement profil",
  account_renewal: "Renouvellement compte",
  manual_expense: "Dépense manuelle",
};

export function categoryLabel(c: ExpenseCategory | null | undefined): string {
  if (!c) return "—";
  return EXPENSE_CATEGORIES.find((x) => x.value === c)?.label ?? c;
}

export function sourceLabel(s: TransactionSource): string {
  return SOURCE_LABELS[s] ?? s;
}

export function formatFcfa(n: number): string {
  return Math.round(n).toLocaleString("en-US").replace(/,/g, " ");
}

export function monthBounds(year: number, monthIndex0: number): { from: string; to: string } {
  const from = new Date(year, monthIndex0, 1);
  const to = new Date(year, monthIndex0 + 1, 0);
  const iso = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return { from: iso(from), to: iso(to) };
}

export function computeBalance(
  txs: Pick<Transaction, "kind" | "amount" | "affects_balance">[]
): number {
  return txs.reduce((sum, t) => {
    if (!t.affects_balance) return sum;
    const amt = Number(t.amount ?? 0);
    return sum + (t.kind === "income" ? amt : -amt);
  }, 0);
}

export function computePeriodKpis(
  txs: Pick<Transaction, "kind" | "amount" | "affects_balance" | "occurred_on">[],
  from: string,
  to: string
): { income: number; expenses: number; margin: number } {
  let income = 0;
  let expenses = 0;
  for (const t of txs) {
    if (t.occurred_on < from || t.occurred_on > to) continue;
    const amt = Number(t.amount ?? 0);
    if (t.kind === "income") income += amt;
    else if (t.affects_balance) expenses += amt;
  }
  return { income, expenses, margin: income - expenses };
}

export function filterJournal(
  txs: Transaction[],
  opts: {
    from: string;
    to: string;
    kind?: "income" | "outflow" | "all";
    category?: ExpenseCategory | "all";
    q?: string;
  }
): Transaction[] {
  const kind = opts.kind ?? "all";
  const category = opts.category ?? "all";
  const q = (opts.q ?? "").trim().toLowerCase();
  return txs.filter((t) => {
    if (t.occurred_on < opts.from || t.occurred_on > opts.to) return false;
    if (kind !== "all" && t.kind !== kind) return false;
    if (category !== "all" && t.category !== category) return false;
    if (q && !t.label.toLowerCase().includes(q)) return false;
    return true;
  });
}

function csvEscape(value: string): string {
  if (/[;,"\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

export function buildComptaCsv(txs: Transaction[]): string {
  const header = "Date;Type;Catégorie;Libellé;Montant;Source";
  const lines = txs.map((t) =>
    [
      t.occurred_on,
      t.kind === "income" ? "Entrée" : "Sortie",
      categoryLabel(t.category),
      csvEscape(t.label),
      String(Math.round(Number(t.amount))),
      t.source,
    ].join(";")
  );
  return [header, ...lines].join("\n");
}
