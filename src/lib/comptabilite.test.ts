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

function tx(
  partial: Partial<Transaction> & Pick<Transaction, "kind" | "amount" | "occurred_on">
): Transaction {
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
      tx({
        kind: "income",
        amount: 5000,
        occurred_on: "2026-08-01",
        source: "new_profile",
        category: null,
      }),
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
      tx({
        id: "a",
        label: "Fibre Orange",
        category: "data",
        kind: "outflow",
        amount: 1,
        occurred_on: "2026-08-02",
      }),
      tx({
        id: "b",
        label: "Pub FB",
        category: "ads",
        kind: "outflow",
        amount: 1,
        occurred_on: "2026-08-02",
      }),
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
