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
  fullCompta?: boolean;
};

export function ComptaView(props: Props) {
  return (
    <>
      <div
        className="dash-header"
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 16,
          alignItems: "end",
          justifyContent: "space-between",
        }}
      >
        <div>
          <p className="dash-eyebrow">Finance</p>
          <h1>Comptabilité</h1>
          <p className="dash-header-sub">
            Période du {props.from} au {props.to}
          </p>
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
          allowExports={props.fullCompta !== false}
        />
      </div>
    </>
  );
}
