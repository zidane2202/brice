"use client";

import { bulkCancelSubscriptions, bulkRenewSubscriptions } from "@/app/actions/clients";
import { Icon } from "@/components/Icon";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/Toast";
import { useState, useTransition } from "react";

type Props = { ids: string[]; onClear: () => void };
type Mode = "renew" | "cancel" | null;

export function BulkActionBar({ ids, onClear }: Props) {
  const toast = useToast();
  const idsStr = ids.join(",");
  const [mode, setMode] = useState<Mode>(null);
  const [pending, startTransition] = useTransition();

  function confirm() {
    if (!mode) return;
    const fd = new FormData();
    fd.set("ids", idsStr);
    const loadingId = toast.loading(mode === "renew" ? "Renouvellement…" : "Annulation…");
    startTransition(async () => {
      try {
        if (mode === "renew") await bulkRenewSubscriptions(fd);
        else await bulkCancelSubscriptions(fd);
        toast.dismiss(loadingId);
        toast.success(mode === "renew" ? "Abonnements renouvelés" : "Abonnements annulés");
        setMode(null);
        onClear();
      } catch (error) {
        toast.dismiss(loadingId);
        toast.error(
          mode === "renew" ? "Renouvellement impossible" : "Annulation impossible",
          error instanceof Error ? error.message : undefined
        );
      }
    });
  }

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

      <button
        type="button"
        className="secondary"
        style={{ minHeight: 28, height: 28, fontSize: "0.75rem", paddingInline: 10 }}
        onClick={() => setMode("renew")}
      >
        <Icon name="refresh" size={12} /> Renouveler tout (+1 mois)
      </button>

      <button
        type="button"
        className="danger"
        style={{ minHeight: 28, height: 28, fontSize: "0.75rem", paddingInline: 10 }}
        onClick={() => setMode("cancel")}
      >
        <Icon name="x" size={12} /> Annuler
      </button>

      <div style={{ flex: 1 }} />

      <button
        type="button"
        onClick={onClear}
        className="secondary"
        style={{ minHeight: 28, height: 28, fontSize: "0.75rem", paddingInline: 10, background: "transparent", border: "1px solid transparent" }}
      >
        Tout désélectionner
      </button>

      <ConfirmDialog
        open={mode === "renew"}
        title="Renouveler les abonnements ?"
        description={`${ids.length} abonnement${ids.length > 1 ? "s" : ""} seront prolongés d’un mois. Les encaissements correspondants seront ajoutés au journal.`}
        confirmLabel="Renouveler"
        cancelLabel="Annuler"
        pending={pending}
        onConfirm={confirm}
        onCancel={() => !pending && setMode(null)}
      />
      <ConfirmDialog
        open={mode === "cancel"}
        title="Annuler les abonnements ?"
        description="Les profils seront libérés. L’historique comptable et les factures restent en place."
        confirmLabel="Annuler les abonnements"
        cancelLabel="Retour"
        tone="danger"
        pending={pending}
        onConfirm={confirm}
        onCancel={() => !pending && setMode(null)}
      />

      <style>{`
        @keyframes cli-slide-in {
          from { opacity: 0; transform: translateY(-4px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
