"use client";

import { useEffect, useRef } from "react";

type Props = {
  checked: boolean;
  indeterminate?: boolean;
  onChange: (checked: boolean) => void;
  onClick?: (e: React.MouseEvent) => void;
};

export function CheckBox({ checked, indeterminate, onChange, onClick }: Props) {
  const ref = useRef<HTMLInputElement | null>(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = !!indeterminate;
  }, [indeterminate]);

  return (
    <label
      onClick={onClick}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: 16,
        height: 16,
        position: "relative",
        cursor: "pointer",
      }}
    >
      <input
        ref={ref}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        style={{
          position: "absolute",
          inset: 0,
          margin: 0,
          opacity: 0,
          cursor: "pointer",
        }}
      />
      <span
        style={{
          width: 14,
          height: 14,
          borderRadius: 3,
          background: checked || indeterminate ? "var(--sr-mint-500)" : "var(--sr-bg)",
          border: "1px solid " + (checked || indeterminate ? "var(--sr-mint-600)" : "var(--sr-border-strong)"),
          boxShadow: checked || indeterminate
            ? "inset 0 1px 0 rgba(255,255,255,0.20), 0 0 0 1px rgba(41,220,133,0.20)"
            : "inset 0 1px 0 rgba(255,255,255,0.04)",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          transition: "all var(--sr-dur-fast) var(--sr-ease)",
          color: "var(--sr-mint-ink)",
        }}
      >
        {checked && !indeterminate && (
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 6L9 17l-5-5" />
          </svg>
        )}
        {indeterminate && (
          <span style={{ width: 7, height: 2, background: "var(--sr-mint-ink)", borderRadius: 1 }} />
        )}
      </span>
    </label>
  );
}
