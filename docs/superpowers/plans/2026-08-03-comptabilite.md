# Comptabilité Module Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ajouter `/comptabilite` : KPIs (solde, recettes, dépenses, marge), journal filtrable, dépenses manuelles débitant le solde, exports CSV + rapport print/PDF.

**Architecture:** Étendre `transactions` (`manual_expense`, `category`, `occurred_on`). Page App Router + Server Action `addManualExpense`. Helpers purs dans `src/lib/comptabilite.ts`. CSV blob côté client ; PDF via page print-friendly `/comptabilite/rapport`.

**Tech Stack:** Next.js 16 App Router, TypeScript, Tailwind/CSS vars existants, Supabase admin client, Server Actions

## Global Constraints

- Devise : FCFA ; copy UI en français
- Dépenses manuelles : toujours `funded_by: "balance"`, `affects_balance: true`
- Catégories fixes uniquement : `account_renewal` | `data` | `ads` | `momo_fees` | `rent` | `other` (+ note obligatoire si `other`)
- Pas de lib PDF serveur ; pas d’apports manuels ; pas d’édition/suppression d’écritures auto
- Suivre patterns existants : `createSupabaseAdmin`, `getUser`, `revalidatePath`, formulaires `useTransition` + try/catch
- Ne pas refactorer le dashboard au-delà de `revalidatePath` / types

---

## File Map

**Create:**
```
src/lib/comptabilite.ts
src/lib/comptabilite.test.ts
src/app/actions/comptabilite.ts
src/app/(app)/comptabilite/page.tsx
src/app/(app)/comptabilite/rapport/page.tsx
src/components/comptabilite/ComptaKpis.tsx
src/components/comptabilite/AddExpenseForm.tsx
src/components/comptabilite/ComptaJournal.tsx
src/components/comptabilite/ComptaPeriodFilter.tsx
src/components/comptabilite/ComptaView.tsx
src/components/comptabilite/PrintButton.tsx
```

**Modify:**
```
supabase/schema.sql
src/lib/types.ts
src/components/Sidebar.tsx
src/components/TopBar.tsx
src/components/TransactionsHistoryPanel.tsx
src/app/actions/accounts.ts
src/app/globals.css
```

---

### Task 1: Schéma + types Transaction

**Files:**
- Modify: `supabase/schema.sql`
- Modify: `src/lib/types.ts`
- Modify: `src/components/TransactionsHistoryPanel.tsx`

**Interfaces:**
- Produces: `TransactionSource` inclut `"manual_expense"` ; `ExpenseCategory` ; `Transaction.category` ; `Transaction.occurred_on`

- [ ] **Step 1: Ajouter migrations en fin de section `transactions` dans `supabase/schema.sql`**

Après la définition / index de `transactions`, ajouter :

```sql
-- Comptabilité: sources, catégorie, date d'opération
alter table public.transactions drop constraint if exists transactions_source_check;
alter table public.transactions add constraint transactions_source_check
  check (source in (
    'new_profile',
    'profile_renewal',
    'account_renewal',
    'manual_expense'
  ));

alter table public.transactions add column if not exists category text;
alter table public.transactions drop constraint if exists transactions_category_check;
alter table public.transactions add constraint transactions_category_check
  check (
    category is null or category in (
      'account_renewal',
      'data',
      'ads',
      'momo_fees',
      'rent',
      'other'
    )
  );

alter table public.transactions
  add column if not exists occurred_on date;

update public.transactions
set occurred_on = (created_at at time zone 'utc')::date
where occurred_on is null;

alter table public.transactions
  alter column occurred_on set default (current_date);

alter table public.transactions
  alter column occurred_on set not null;

create index if not exists transactions_user_occurred_idx
  on public.transactions(user_id, occurred_on desc);
```

Appliquer aussi ces statements sur le projet Supabase distant (SQL editor) avant smoke test — le fichier `schema.sql` est la source de vérité repo.

- [ ] **Step 2: Mettre à jour `src/lib/types.ts`**

Remplacer / étendre les types transaction :

```ts
export type TransactionKind = "income" | "outflow";
export type TransactionSource =
  | "new_profile"
  | "profile_renewal"
  | "account_renewal"
  | "manual_expense";
export type TransactionFunding = "balance" | "personal";
export type ExpenseCategory =
  | "account_renewal"
  | "data"
  | "ads"
  | "momo_fees"
  | "rent"
  | "other";

export type Transaction = {
  id: string;
  user_id: string;
  kind: TransactionKind;
  source: TransactionSource;
  funded_by: TransactionFunding | null;
  affects_balance: boolean;
  amount: number;
  client_id: string | null;
  subscription_id: string | null;
  account_id: string | null;
  label: string;
  category: ExpenseCategory | null;
  occurred_on: string; // YYYY-MM-DD
  created_at: string;
};
```

- [ ] **Step 3: Mettre à jour `SOURCE_META` dans `TransactionsHistoryPanel.tsx`**

Ajouter l’entrée manquante pour que le Record reste exhaustif :

```ts
manual_expense: {
  label: "Dépense",
  iconBg: "var(--sr-danger-bg)",
  iconColor: "var(--sr-danger)",
},
```

- [ ] **Step 4: Commit**

```bash
git add supabase/schema.sql src/lib/types.ts src/components/TransactionsHistoryPanel.tsx
git commit -m "feat(compta): extend transactions schema and types"
```

---

### Task 2: Helpers purs `comptabilite.ts` + tests

**Files:**
- Create: `src/lib/comptabilite.ts`
- Create: `src/lib/comptabilite.test.ts`

**Interfaces:**
- Produces:
  - `EXPENSE_CATEGORIES: { value: ExpenseCategory; label: string }[]`
  - `categoryLabel(c: ExpenseCategory | null | undefined): string`
  - `sourceLabel(s: TransactionSource): string`
  - `monthBounds(year: number, monthIndex0: number): { from: string; to: string }`
  - `computeBalance(txs: Pick<Transaction,'kind'|'amount'|'affects_balance'>[]): number`
  - `computePeriodKpis(txs: Pick<Transaction,'kind'|'amount'|'affects_balance'|'occurred_on'>[], from: string, to: string): { income: number; expenses: number; margin: number }`
  - `filterJournal(txs: Transaction[], opts: { from: string; to: string; kind?: 'income'|'outflow'|'all'; category?: ExpenseCategory|'all'; q?: string }): Transaction[]`
  - `buildComptaCsv(txs: Transaction[]): string`
  - `formatFcfa(n: number): string`

- [ ] **Step 1: Écrire `src/lib/comptabilite.test.ts` (Node test runner)**

```ts
import assert from "node:assert/strict";
import test from "node:test";
import {
  buildComptaCsv,
  computeBalance,
  computePeriodKpis,
  filterJournal,
  monthBounds,
  formatFcfa,
} from "./comptabilite";
import type { Transaction } from "./types";

function tx(partial: Partial<Transaction> & Pick<Transaction, "kind" | "amount" | "occurred_on">): Transaction {
  return {
    id: "1",
    user_id: "u",
    source: "manual_expense",
    funded_by: "balance",
    affects_balance: true,
    client_id: null,
    subscription_id: null,
    account_id: null,
    label: "x",
    category: "data",
    created_at: "2026-08-01T00:00:00Z",
    ...partial,
  };
}

test("monthBounds août 2026", () => {
  assert.deepEqual(monthBounds(2026, 7), { from: "2026-08-01", to: "2026-08-31" });
});

test("computeBalance ignore personal outflows", () => {
  const balance = computeBalance([
    { kind: "income", amount: 10000, affects_balance: true },
    { kind: "outflow", amount: 3000, affects_balance: true },
    { kind: "outflow", amount: 2000, affects_balance: false },
  ]);
  assert.equal(balance, 7000);
});

test("computePeriodKpis borne inclusive", () => {
  const k = computePeriodKpis(
    [
      tx({ kind: "income", amount: 5000, occurred_on: "2026-08-01", source: "new_profile", category: null }),
      tx({ kind: "outflow", amount: 1000, occurred_on: "2026-08-15" }),
      tx({ kind: "outflow", amount: 999, occurred_on: "2026-07-31" }),
    ],
    "2026-08-01",
    "2026-08-31"
  );
  assert.deepEqual(k, { income: 5000, expenses: 1000, margin: 4000 });
});

test("filterJournal catégorie + recherche", () => {
  const rows = filterJournal(
    [
      tx({ id: "a", label: "Fibre Orange", category: "data", kind: "outflow", amount: 1, occurred_on: "2026-08-02" }),
      tx({ id: "b", label: "Pub FB", category: "ads", kind: "outflow", amount: 1, occurred_on: "2026-08-02" }),
    ],
    { from: "2026-08-01", to: "2026-08-31", category: "data", q: "fibre" }
  );
  assert.equal(rows.length, 1);
  assert.equal(rows[0].id, "a");
});

test("buildComptaCsv header + ligne", () => {
  const csv = buildComptaCsv([
    tx({
      kind: "outflow",
      amount: 1500,
      occurred_on: "2026-08-03",
      label: "Data, promo",
      category: "data",
    }),
  ]);
  assert.match(csv, /^Date;Type;Catégorie;Libellé;Montant;Source/);
  assert.match(csv, /2026-08-03;Sortie;Data \/ Internet;"Data, promo";1500;manual_expense/);
});

test("formatFcfa", () => {
  assert.equal(formatFcfa(12000), "12 000");
});
```

- [ ] **Step 2: Lancer les tests — doivent échouer**

Run: `npx --yes tsx --test src/lib/comptabilite.test.ts`

Expected: FAIL (module `./comptabilite` introuvable ou exports manquants)

- [ ] **Step 3: Implémenter `src/lib/comptabilite.ts`**

```ts
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
  if (/[;"\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
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
```

- [ ] **Step 4: Relancer les tests — doivent passer**

Run: `npx --yes tsx --test src/lib/comptabilite.test.ts`

Expected: PASS (tous les tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/comptabilite.ts src/lib/comptabilite.test.ts
git commit -m "feat(compta): add KPI/journal/CSV helpers"
```

---

### Task 3: Navigation Sidebar + TopBar

**Files:**
- Modify: `src/components/Sidebar.tsx`
- Modify: `src/components/TopBar.tsx`

**Interfaces:**
- Consumes: route `/comptabilite`, icône existante `bill`
- Produces: lien nav visible « Comptabilité »

- [ ] **Step 1: Étendre `IconName` et `navItems` dans `Sidebar.tsx`**

```ts
type IconName = "dashboard" | "seat" | "users" | "settings" | "zap" | "bill";
```

Dans `navItems`, inserer **après** clients, **avant** profil :

```ts
{ href: "/comptabilite", label: "Comptabilité", icon: "bill" },
```

- [ ] **Step 2: Mettre à jour `TopBar.tsx` LABELS + crumbs**

```ts
const LABELS: Record<string, string> = {
  dashboard: "Dashboard",
  abonnements: "Mes abonnements",
  clients: "Mes clients",
  comptabilite: "Comptabilité",
  rapport: "Rapport",
  profil: "Mon profil",
  admin: "Admin",
};
```

Remplacer le bloc crumbs du second segment par :

```ts
if (segments.length > 1 && segments[1]) {
  crumbs.push(LABELS[segments[1]] ?? "Détail");
}
```

- [ ] **Step 3: Vérifier** — `npm run dev`, sidebar montre Comptabilité entre Clients et Profil

- [ ] **Step 4: Commit**

```bash
git add src/components/Sidebar.tsx src/components/TopBar.tsx
git commit -m "feat(compta): add Comptabilité nav link"
```

---

### Task 4: Page lecture — KPIs + journal + filtre période

**Files:**
- Create: `src/app/(app)/comptabilite/page.tsx`
- Create: `src/components/comptabilite/ComptaKpis.tsx`
- Create: `src/components/comptabilite/ComptaPeriodFilter.tsx`
- Create: `src/components/comptabilite/ComptaJournal.tsx`
- Create: `src/components/comptabilite/ComptaView.tsx`

**Interfaces:**
- Consumes: helpers Task 2 ; `Transaction` Task 1
- Produces: page `/comptabilite?year=&month=`

- [ ] **Step 1: Créer `ComptaKpis.tsx`**

```tsx
"use client";

import { KpiCard } from "@/components/KpiCard";

type Props = {
  balance: number;
  income: number;
  expenses: number;
  margin: number;
};

export function ComptaKpis({ balance, income, expenses, margin }: Props) {
  return (
    <div className="stats-grid" style={{ marginBottom: 20 }}>
      <KpiCard label="Solde caisse" value={balance} unit="FCFA" tone="info" accent />
      <KpiCard label="Recettes" value={income} unit="FCFA" tone="success" sub="période" />
      <KpiCard label="Dépenses" value={expenses} unit="FCFA" tone="warning" sub="période" />
      <KpiCard
        label="Marge"
        value={margin}
        unit="FCFA"
        tone={margin >= 0 ? "success" : "danger"}
        sub="période"
      />
    </div>
  );
}
```

- [ ] **Step 2: Créer `ComptaPeriodFilter.tsx`**

Client ou server form GET vers `/comptabilite` avec champs `year` (number) et `month` (1–12). Préremplir depuis props `year` / `month`. Utiliser classes `fields two-cols` existantes. Bouton « Afficher ».

- [ ] **Step 3: Créer `ComptaJournal.tsx`**

Client component props :
```ts
type Props = {
  transactions: Transaction[];
  from: string;
  to: string;
  year: number;
  month: number;
};
```

Filtres locaux `kind` (`all`|`income`|`outflow`), `category` (`all`|ExpenseCategory), `q` (texte). Appliquer `filterJournal`. Tableau : Date, Libellé, Catégorie (`categoryLabel`), Type, Montant (`formatFcfa` + FCFA), Source (`sourceLabel`). État vide : « Aucune écriture sur cette période ».

Boutons :
- Export CSV : `const csv = buildComptaCsv(filtered);` puis blob download `comptabilite-${year}-${String(month).padStart(2,"0")}.csv`
- Export PDF : `window.open(`/comptabilite/rapport?year=${year}&month=${month}&kind=${kind}&category=${category}&q=${encodeURIComponent(q)}`)`

- [ ] **Step 4: Créer `ComptaView.tsx`**

```tsx
"use client";

import type { ReactNode } from "react";
import type { Transaction } from "@/lib/types";
import { ComptaKpis } from "./ComptaKpis";
import { ComptaPeriodFilter } from "./ComptaPeriodFilter";
import { ComptaJournal } from "./ComptaJournal";

type Props = {
  year: number;
  month: number;
  from: string;
  to: string;
  balance: number;
  income: number;
  expenses: number;
  margin: number;
  transactions: Transaction[];
  expenseForm: ReactNode;
};

export function ComptaView(props: Props) {
  return (
    <>
      <div className="dash-header">
        <div>
          <p className="eyebrow">Finance</p>
          <h1>Comptabilité</h1>
        </div>
        <ComptaPeriodFilter year={props.year} month={props.month} />
      </div>
      <ComptaKpis
        balance={props.balance}
        income={props.income}
        expenses={props.expenses}
        margin={props.margin}
      />
      <div className="panel" style={{ marginBottom: 20 }}>
        <h2 style={{ marginTop: 0 }}>Nouvelle dépense</h2>
        {props.expenseForm}
      </div>
      <div className="panel">
        <h2 style={{ marginTop: 0 }}>Journal</h2>
        <ComptaJournal
          transactions={props.transactions}
          from={props.from}
          to={props.to}
          year={props.year}
          month={props.month}
        />
      </div>
    </>
  );
}
```

(Adapter styles header pour coller au dashboard existant.)

- [ ] **Step 5: Créer `page.tsx`**

```tsx
import { ComptaView } from "@/components/comptabilite/ComptaView";
import { computeBalance, computePeriodKpis, monthBounds } from "@/lib/comptabilite";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import { getUser } from "@/lib/supabase-server";
import type { Transaction } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function ComptabilitePage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; month?: string }>;
}) {
  const user = await getUser();
  if (!user) return null;

  const sp = await searchParams;
  const now = new Date();
  const year = Number(sp.year) || now.getFullYear();
  const month = Number(sp.month) || now.getMonth() + 1;
  const { from, to } = monthBounds(year, month - 1);

  const supabase = createSupabaseAdmin();
  const [allBal, periodTx] = await Promise.all([
    supabase
      .from("transactions")
      .select("kind, amount, affects_balance")
      .eq("user_id", user.id)
      .eq("affects_balance", true),
    supabase
      .from("transactions")
      .select("*")
      .eq("user_id", user.id)
      .gte("occurred_on", from)
      .lte("occurred_on", to)
      .order("occurred_on", { ascending: false })
      .order("created_at", { ascending: false }),
  ]);

  const balance = computeBalance(allBal.data ?? []);
  const txs = (periodTx.data ?? []) as Transaction[];
  for (const t of txs) {
    if (!t.occurred_on) t.occurred_on = t.created_at.slice(0, 10);
  }
  const kpis = computePeriodKpis(txs, from, to);

  return (
    <ComptaView
      year={year}
      month={month}
      from={from}
      to={to}
      balance={balance}
      income={kpis.income}
      expenses={kpis.expenses}
      margin={kpis.margin}
      transactions={txs}
      expenseForm={<p style={{ color: "var(--sr-fg-subtle)" }}>Formulaire à venir</p>}
    />
  );
}
```

(Le stub formulaire est remplacé en Task 5.)

- [ ] **Step 6: `npm run build`** — Compiled successfully avec route `/comptabilite`

- [ ] **Step 7: Commit**

```bash
git add "src/app/(app)/comptabilite/page.tsx" src/components/comptabilite
git commit -m "feat(compta): add read-only comptabilite page"
```

---

### Task 5: Server Action + formulaire dépense

**Files:**
- Create: `src/app/actions/comptabilite.ts`
- Create: `src/components/comptabilite/AddExpenseForm.tsx`
- Modify: `src/app/(app)/comptabilite/page.tsx`
- Modify: `src/app/actions/accounts.ts`

**Interfaces:**
- Produces: `addManualExpense(formData: FormData): Promise<void>`
- Consumes: `EXPENSE_CATEGORIES`, `computeBalance` pattern (inline reduce OK)

- [ ] **Step 1: Implémenter `src/app/actions/comptabilite.ts`**

```ts
"use server";

import { EXPENSE_CATEGORIES } from "@/lib/comptabilite";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import { getUser } from "@/lib/supabase-server";
import type { ExpenseCategory } from "@/lib/types";
import { revalidatePath } from "next/cache";

const CATEGORY_SET = new Set(EXPENSE_CATEGORIES.map((c) => c.value));

function req(formData: FormData, key: string): string {
  const v = String(formData.get(key) ?? "").trim();
  if (!v) throw new Error(`Champ requis : ${key}`);
  return v;
}

export async function addManualExpense(formData: FormData) {
  const user = await getUser();
  if (!user) throw new Error("Non authentifié");

  const amount = parseFloat(req(formData, "amount"));
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("Montant invalide");
  }

  const category = req(formData, "category") as ExpenseCategory;
  if (!CATEGORY_SET.has(category)) throw new Error("Catégorie invalide");

  const note = String(formData.get("label") ?? "").trim();
  if (category === "other" && !note) {
    throw new Error("Une note est obligatoire pour la catégorie Autre");
  }

  const occurredOn =
    String(formData.get("occurred_on") ?? "").trim() ||
    new Date().toISOString().slice(0, 10);
  const label =
    note ||
    EXPENSE_CATEGORIES.find((c) => c.value === category)?.label ||
    "Dépense";

  const supabase = createSupabaseAdmin();

  const { data: txs } = await supabase
    .from("transactions")
    .select("kind, amount")
    .eq("user_id", user.id)
    .eq("affects_balance", true);

  const balance = (txs ?? []).reduce((sum, t) => {
    const amt = Number(t.amount ?? 0);
    return sum + (t.kind === "income" ? amt : -amt);
  }, 0);

  if (balance < amount) {
    throw new Error(
      `Solde insuffisant : ${balance.toLocaleString("en-US").replace(/,/g, " ")} FCFA disponibles, ${amount
        .toLocaleString("en-US")
        .replace(/,/g, " ")} FCFA requis.`
    );
  }

  const { error } = await supabase.from("transactions").insert({
    user_id: user.id,
    kind: "outflow",
    source: "manual_expense",
    funded_by: "balance",
    affects_balance: true,
    amount,
    category,
    label,
    occurred_on: occurredOn,
  });

  if (error) throw new Error(error.message);

  revalidatePath("/comptabilite");
  revalidatePath("/dashboard");
}
```

- [ ] **Step 2: Créer `AddExpenseForm.tsx`**

Pattern identique à `AddAccountForm` : `useTransition`, `errorMsg`, `form action={handleSubmit}`. Champs `amount` (number min 1), `category` select (`EXPENSE_CATEGORIES`), `label` input, `occurred_on` date (default today passé en prop `today: string`). Si category === `other`, afficher hint « Note obligatoire ».

- [ ] **Step 3: Remplacer le stub dans `page.tsx`**

```tsx
expenseForm={<AddExpenseForm today={new Date().toISOString().slice(0, 10)} />}
```

Importer `AddExpenseForm`.

- [ ] **Step 4: Enrichir insert dans `renewProviderAccount` (`accounts.ts`)**

Sur l’objet `insert` transactions existant, ajouter :

```ts
category: "account_renewal",
occurred_on: toDateInputValue(),
```

(`toDateInputValue` est déjà importé / utilisé dans ce fichier.)

- [ ] **Step 5: Smoke manuel** — dépense OK ; `other` sans note → erreur ; montant > solde → erreur

- [ ] **Step 6: Commit**

```bash
git add src/app/actions/comptabilite.ts src/components/comptabilite/AddExpenseForm.tsx "src/app/(app)/comptabilite/page.tsx" src/app/actions/accounts.ts
git commit -m "feat(compta): add manual expense action and form"
```

---

### Task 6: Rapport print / PDF

**Files:**
- Create: `src/app/(app)/comptabilite/rapport/page.tsx`
- Create: `src/components/comptabilite/PrintButton.tsx`
- Modify: `src/app/globals.css`

**Interfaces:**
- Consumes: query `year`, `month`, `kind`, `category`, `q`
- Produces: page imprimable KPIs + tableau

- [ ] **Step 1: Créer `PrintButton.tsx`**

```tsx
"use client";

export function PrintButton() {
  return (
    <button type="button" className="print-hide" onClick={() => window.print()}>
      Imprimer / PDF
    </button>
  );
}
```

(Utiliser classes bouton existantes du projet si présentes.)

- [ ] **Step 2: Créer `rapport/page.tsx`**

- `getUser()` ; charger txs période comme Task 4
- `filterJournal` avec `kind` / `category` / `q` depuis searchParams (`all` par défaut)
- Afficher titre « Rapport comptabilité », période `from`–`to`, KPIs, table
- Inclure `<PrintButton />`

- [ ] **Step 3: Ajouter règles print dans `globals.css`**

```css
@media print {
  .sidebar,
  .topbar,
  .print-hide {
    display: none !important;
  }
  .app-main {
    margin: 0 !important;
    padding: 0 !important;
  }
}
```

- [ ] **Step 4: Vérifier** Export PDF depuis journal ouvre le rapport ; Imprimer fonctionne

- [ ] **Step 5: Commit**

```bash
git add "src/app/(app)/comptabilite/rapport/page.tsx" src/components/comptabilite/PrintButton.tsx src/app/globals.css
git commit -m "feat(compta): add printable comptabilite report"
```

---

### Task 7: Build final + smoke checklist

**Files:** none (verification)

- [ ] **Step 1: Tests unitaires**

Run: `npx --yes tsx --test src/lib/comptabilite.test.ts`

Expected: all PASS

- [ ] **Step 2: Production build**

Run: `npm run build`

Expected: Compiled successfully ; routes `/comptabilite` et `/comptabilite/rapport` listées

- [ ] **Step 3: Checklist manuelle**

1. Nav « Comptabilité » visible
2. KPIs solde cohérents avec dashboard
3. Ajout dépense → journal + solde diminue
4. Catégorie `other` sans note → erreur
5. Solde insuffisant → erreur
6. Filtres mois / type / catégorie OK
7. CSV colonnes correctes
8. Rapport print affiche la période
9. Nouveaux renouvellements comptes ont `category=account_renewal`

- [ ] **Step 4: Commit fix éventuels uniquement s’il y a des corrections**

---

## Spec coverage (self-review)

| Spec requirement | Task |
|------------------|------|
| Route `/comptabilite` + nav | 3, 4 |
| KPIs solde / recettes / dépenses / marge | 2, 4 |
| Journal filtrable | 2, 4 |
| Dépenses manuelles → solde | 5 |
| Catégories fixes + other note | 2, 5 |
| `category` + `manual_expense` + `occurred_on` | 1, 5 |
| Export CSV | 2, 4 |
| Export PDF (print page) | 6 |
| Hors V1 respecté | Global Constraints |
| `accounts.ts` category on renew | 5 |
| Build / smoke | 7 |
