"use client";

import { useEffect, useRef, useState } from "react";

export type KpiTone = "neutral" | "success" | "warning" | "danger" | "info";

type Props = {
  label: string;
  value: string | number;
  unit?: string;
  sub?: string;
  tone?: KpiTone;
  accent?: boolean;
};

const TONE: Record<KpiTone, { color: string; bg: string; border: string }> = {
  neutral: { color: "var(--sr-fg-strong)", bg: "transparent",          border: "transparent" },
  success: { color: "var(--sr-mint-500)",  bg: "var(--sr-success-bg)", border: "var(--sr-success-border)" },
  warning: { color: "var(--sr-warning)",   bg: "var(--sr-warning-bg)", border: "var(--sr-warning-border)" },
  danger:  { color: "var(--sr-danger)",    bg: "var(--sr-danger-bg)",  border: "var(--sr-danger-border)" },
  info:    { color: "var(--sr-info)",      bg: "var(--sr-info-bg)",    border: "var(--sr-info-border)" },
};

export function KpiCard({ label, value, unit, sub, tone = "neutral", accent }: Props) {
  const isNumber = typeof value === "number";
  const [display, setDisplay] = useState<string | number>(isNumber ? 0 : value);
  const frameRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isNumber) { setDisplay(value); return; }
    const target = value as number;
    const duration = 700;
    const start = performance.now();
    const tick = (now: number) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(eased * target));
      if (progress < 1) frameRef.current = requestAnimationFrame(tick);
    };
    frameRef.current = requestAnimationFrame(tick);
    return () => { if (frameRef.current) cancelAnimationFrame(frameRef.current); };
  }, [value, isNumber]);

  const valueColor = accent ? "var(--sr-mint-300)" : TONE[tone].color;
  const formatted = typeof display === "number" ? display.toLocaleString("en-US").replace(/,/g, " ") : display;

  return (
    <div
      style={{
        position: "relative",
        padding: "16px 16px",
        background: "var(--sr-surface)",
        border: "1px solid var(--sr-border-subtle)",
        borderRadius: 8,
        display: "flex",
        flexDirection: "column",
        gap: 10,
        minHeight: 116,
        boxShadow: "var(--sr-hairline-top)",
        transition: "background var(--sr-dur) var(--sr-ease), border-color var(--sr-dur) var(--sr-ease), transform var(--sr-dur) var(--sr-ease), box-shadow var(--sr-dur) var(--sr-ease)",
        overflow: "hidden",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = "var(--sr-surface-2)";
        e.currentTarget.style.borderColor = "var(--sr-border-strong)";
        e.currentTarget.style.transform = "translateY(-1px)";
        e.currentTarget.style.boxShadow = "var(--sr-shadow-pop)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "var(--sr-surface)";
        e.currentTarget.style.borderColor = "var(--sr-border-subtle)";
        e.currentTarget.style.transform = "translateY(0)";
        e.currentTarget.style.boxShadow = "var(--sr-hairline-top)";
      }}
    >
      {accent && (
        <span
          style={{
            position: "absolute",
            top: 0,
            left: 16,
            right: 16,
            height: 2,
            background: "var(--sr-mint-500)",
            borderRadius: "0 0 2px 2px",
            boxShadow: "0 0 12px rgba(41,220,133,0.45)",
          }}
        />
      )}

      <div
        style={{
          font: "500 10px/1 var(--font-geist-sans)",
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: "var(--sr-fg-muted)",
        }}
      >
        {label}
      </div>

      <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
        <div
          style={{
            font: "600 28px/1 var(--font-geist-mono)",
            letterSpacing: "-0.025em",
            fontVariantNumeric: "tabular-nums",
            color: valueColor,
          }}
        >
          {formatted}
        </div>
        {unit && (
          <div style={{ font: "400 12px/1 var(--font-geist-mono)", color: "var(--sr-fg-subtle)" }}>
            {unit}
          </div>
        )}
      </div>

      {sub && (
        <div
          style={{
            font: "400 11px/1.3 var(--font-geist-sans)",
            color: "var(--sr-fg-subtle)",
          }}
        >
          {sub}
        </div>
      )}
    </div>
  );
}
