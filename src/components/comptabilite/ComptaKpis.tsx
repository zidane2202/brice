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
