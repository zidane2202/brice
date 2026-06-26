"use client";

import { bulkDeleteSubscriptions, bulkRenewSubscriptions } from "@/app/actions/clients";
import { Icon } from "@/components/Icon";

type Props = { ids: string[]; onClear: () => void };

export function BulkActionBar({ ids, onClear }: Props) {
  const idsStr = ids.join(",");
  return (
    <div
      style={{
        marginBottom: 12,
        padding: "10px 14px",
        background: "linear-gradient(180deg, rgba(41,220,133,0.07), rgba(41,220,133,0.03))",
        border: "1px solid var(--sr-success-border)",
        borderRadius: 8,
        display: "flex",
        alignItems: "center",
        gap: 10,
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.05), 0 0 0 1px rgba(41,220,133,0.10), 0 8px 24px -8px rgba(41,220,133,0.25)",
        animation: "cli-slide-in 200ms var(--sr-ease)",
        flexWrap: "wrap",
      }}
    >
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          minWidth: 24,
          height: 22,
          padding: "0 7px",
          background: "var(--sr-mint-500)",
          color: "var(--sr-mint-ink)",
          borderRadius: 4,
          font: "600 12px/1 var(--font-geist-mono)",
          fontVariantNumeric: "tabular-nums",
          boxShadow: "inset 0 1px 0 rgba(255,255,255,0.25)",
        }}
      >
        {ids.length}
      </span>
      <span
        style={{
          font: "500 13px/1.2 var(--font-geist-sans)",
          color: "var(--sr-fg-strong)",
        }}
      >
        abonnement{ids.length > 1 ? "s" : ""} sélectionné{ids.length > 1 ? "s" : ""}
      </span>

      <div style={{ width: 1, height: 20, background: "var(--sr-border)", marginInline: 4 }} />

      <form action={bulkRenewSubscriptions} style={{ margin: 0 }}>
        <input type="hidden" name="ids" value={idsStr} />
        <button
          type="submit"
          className="secondary"
          style={{ minHeight: 28, height: 28, fontSize: "0.75rem", paddingInline: 10 }}
        >
          <Icon name="refresh" size={12} /> Renouveler tout (+1 mois)
        </button>
      </form>

      <form action={bulkDeleteSubscriptions} style={{ margin: 0 }}>
        <input type="hidden" name="ids" value={idsStr} />
        <button
          type="submit"
          className="danger"
          style={{ minHeight: 28, height: 28, fontSize: "0.75rem", paddingInline: 10 }}
        >
          <Icon name="x" size={12} /> Supprimer
        </button>
      </form>

      <div style={{ flex: 1 }} />

      <button
        type="button"
        onClick={onClear}
        className="secondary"
        style={{ minHeight: 28, height: 28, fontSize: "0.75rem", paddingInline: 10, background: "transparent", border: "1px solid transparent" }}
      >
        Tout désélectionner
      </button>

      <style>{`
        @keyframes cli-slide-in {
          from { opacity: 0; transform: translateY(-4px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
