"use client";

import { useEffect } from "react";
import { Icon } from "@/components/Icon";

export type ConfirmDialogRow = { label: string; value: string; accent?: boolean };

type Props = {
  open: boolean;
  title: string;
  description?: string;
  rows?: ConfirmDialogRow[];
  detail?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "default" | "danger";
  pending?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export function ConfirmDialog({ open, title, description, rows = [], detail, confirmLabel = "Confirmer", cancelLabel = "Annuler", tone = "default", pending = false, onConfirm, onCancel }: Props) {
  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !pending) onCancel();
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [open, pending, onCancel]);

  if (!open) return null;
  const danger = tone === "danger";

  return (
    <div role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !pending) onCancel(); }} style={{ position: "fixed", inset: 0, zIndex: 1200, display: "grid", placeItems: "center", padding: 20, background: "rgba(0,0,0,.72)", backdropFilter: "blur(5px)" }}>
      <div role="dialog" aria-modal="true" aria-labelledby="confirm-dialog-title" style={{ width: "min(440px, 100%)", padding: 22, borderRadius: 14, border: `1px solid ${danger ? "var(--sr-danger-border)" : "var(--sr-border)"}`, background: "var(--sr-surface)", boxShadow: "0 24px 80px rgba(0,0,0,.55)" }}>
        <div style={{ width: 42, height: 42, display: "grid", placeItems: "center", borderRadius: 10, background: danger ? "var(--sr-danger-bg)" : "rgba(41,220,133,.12)", color: danger ? "var(--sr-danger)" : "var(--sr-mint-300)", marginBottom: 16 }}>
          <Icon name={danger ? "alert" : "check"} size={20} />
        </div>
        <h3 id="confirm-dialog-title" style={{ margin: 0, fontSize: 19 }}>{title}</h3>
        {description && <p style={{ margin: "7px 0 18px", color: "var(--sr-fg-subtle)", fontSize: 13, lineHeight: 1.45 }}>{description}</p>}
        {rows.length > 0 && (
          <div style={{ padding: 14, borderRadius: 9, background: "var(--sr-bg)", border: "1px solid var(--sr-border-subtle)", display: "grid", gap: 10 }}>
            {rows.map((row) => (
              <div key={row.label} style={{ display: "flex", justifyContent: "space-between", gap: 16, fontSize: 13 }}>
                <span style={{ color: "var(--sr-fg-subtle)" }}>{row.label}</span>
                <strong style={{ color: row.accent ? (danger ? "var(--sr-danger)" : "var(--sr-mint-300)") : "var(--sr-fg-strong)", textAlign: "right" }}>{row.value}</strong>
              </div>
            ))}
          </div>
        )}
        {detail && <p style={{ margin: "14px 0 0", color: danger ? "var(--sr-danger)" : "var(--sr-mint-300)", fontSize: 12 }}>{detail}</p>}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 20 }}>
          <button type="button" className="secondary" onClick={onCancel} disabled={pending}>{cancelLabel}</button>
          <button type="button" className={danger ? "danger" : undefined} onClick={onConfirm} disabled={pending}>{pending ? "Traitement…" : confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}
