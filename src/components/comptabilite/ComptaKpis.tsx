"use client";

import { KpiCard } from "@/components/KpiCard";

type Props = {
  balance: number;
  income: number;
  expenses: number;
  margin: number;
  personalAdvance: number;
};

export function ComptaKpis({ balance, income, expenses, margin, personalAdvance }: Props) {
  return (
    <div className="stats-grid stats-grid-five" style={{ marginBottom: 20 }}>
      <KpiCard label="Solde caisse" value={balance} unit="FCFA" tone="info" accent />
      <KpiCard label="Recettes" value={income} unit="FCFA" tone="success" sub="période" />
      <KpiCard label="Dépenses (caisse)" value={expenses} unit="FCFA" tone="warning" sub="période" />
      <KpiCard
        label="Bénéfice"
        value={margin}
        unit="FCFA"
        tone={margin >= 0 ? "success" : "danger"}
        sub="recettes − dépenses caisse"
      />
      <KpiCard
        label="Avancé de ta poche"
        value={personalAdvance}
        unit="FCFA"
        sub="hors bénéfice"
      />
    </div>
  );
}
