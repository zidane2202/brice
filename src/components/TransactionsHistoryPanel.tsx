"use client";

import { useState } from "react";
import { Icon } from "@/components/Icon";
import { formatDate } from "@/lib/dates";
import type { Transaction } from "@/lib/types";

type Props = { transactions: Transaction[] };

const COLLAPSED_COUNT = 6;

const SOURCE_META: Record<
  Transaction["source"],
  { label: string; iconBg: string; iconColor: string }
> = {
  new_profile: {
    label: "Nouveau profil",
    iconBg: "var(--sr-success-bg)",
    iconColor: "var(--sr-mint-400)",
  },
  profile_renewal: {
    label: "Renouvellement profil",
    iconBg: "var(--sr-success-bg)",
    iconColor: "var(--sr-mint-400)",
  },
  account_renewal: {
    label: "Renouvellement compte",
    iconBg: "var(--sr-warning-bg)",
    iconColor: "var(--sr-warning)",
  },
};

function relTime(iso: string): string {
  const now = Date.now();
  const t = new Date(iso).getTime();
  const diff = Math.max(0, now - t);
  const m = Math.floor(diff / 60000);
  if (m < 1) return "à l'instant";
  if (m < 60) return `il y a ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `il y a ${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `il y a ${d}j`;
  return formatDate(iso);
}

export function TransactionsHistoryPanel({ transactions }: Props) {
  const [expanded, setExpanded] = useState(false);

  if (transactions.length === 0) {
    return (
      <div
        style={{
          padding: "32px 16px",
          textAlign: "center",
          color: "var(--sr-fg-subtle)",
          font: "400 13px/1.4 var(--font-geist-sans)",
        }}
      >
        Aucune transaction pour l&apos;instant. Vendez un profil ou renouvelez un abonnement pour commencer
        l&apos;historique.
      </div>
    );
  }

  const visible =
    expanded || transactions.length <= COLLAPSED_COUNT
      ? transactions
      : transactions.slice(0, COLLAPSED_COUNT);
  const hiddenCount = transactions.length - COLLAPSED_COUNT;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      {visible.map((tx) => {
        const meta = SOURCE_META[tx.source];
        const isIncome = tx.kind === "income";
        const isPersonal = tx.kind === "outflow" && tx.funded_by === "personal";
        const sign = isIncome ? "+" : isPersonal ? "" : "−";
        const amountColor = isIncome
          ? "var(--sr-mint-400)"
          : isPersonal
            ? "var(--sr-fg-muted)"
            : "var(--sr-warning)";

        return (
          <div
            key={tx.id}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "10px 4px",
              borderBottom: "1px solid var(--sr-border-subtle)",
            }}
          >
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 6,
                background: meta.iconBg,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                color: meta.iconColor,
                flex: "0 0 32px",
              }}
            >
              <Icon
                name={isIncome ? "arrowDown" : isPersonal ? "zap" : "arrowUp"}
                size={14}
              />
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  font: "500 13px/1.3 var(--font-geist-sans)",
                  color: "var(--sr-fg-strong)",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {tx.label}
              </div>
              <div
                style={{
                  marginTop: 2,
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  font: "400 11px/1.2 var(--font-geist-mono)",
                  color: "var(--sr-fg-subtle)",
                }}
              >
                <span>{meta.label}</span>
                <span style={{ opacity: 0.5 }}>•</span>
                <span>{relTime(tx.created_at)}</span>
                {isPersonal && (
                  <>
                    <span style={{ opacity: 0.5 }}>•</span>
                    <span style={{ color: "var(--sr-fg-muted)" }}>fond personnel</span>
                  </>
                )}
              </div>
            </div>

            <div
              style={{
                font: "600 13px/1 var(--font-geist-mono)",
                color: amountColor,
                fontVariantNumeric: "tabular-nums",
                letterSpacing: "-0.01em",
                whiteSpace: "nowrap",
              }}
            >
              {sign}
              {tx.amount.toLocaleString("en-US").replace(/,/g, " ")}
              <span style={{ color: "var(--sr-fg-subtle)", marginLeft: 3, fontWeight: 400, fontSize: 10 }}>
                FCFA
              </span>
            </div>
          </div>
        );
      })}

      {hiddenCount > 0 && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          style={{
            marginTop: 6,
            width: "100%",
            height: 32,
            background: "transparent",
            border: "1px dashed var(--sr-border)",
            borderRadius: 6,
            color: "var(--sr-fg-muted)",
            font: "500 12px/1 var(--font-geist-sans)",
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
            transition: "background var(--sr-dur) var(--sr-ease), color var(--sr-dur) var(--sr-ease), border-color var(--sr-dur) var(--sr-ease)",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "var(--sr-surface-2)";
            e.currentTarget.style.color = "var(--sr-fg-strong)";
            e.currentTarget.style.borderColor = "var(--sr-border-strong)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "transparent";
            e.currentTarget.style.color = "var(--sr-fg-muted)";
            e.currentTarget.style.borderColor = "var(--sr-border)";
          }}
        >
          <Icon name={expanded ? "chevronD" : "chevronD"} size={11} style={{ transform: expanded ? "rotate(180deg)" : "none", transition: "transform var(--sr-dur) var(--sr-ease)" }} />
          {expanded ? "Voir moins" : `Voir ${hiddenCount} de plus`}
        </button>
      )}
    </div>
  );
}
