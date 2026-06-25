"use client";

import { useState } from "react";

type MonthData = { month: string; revenue: number };
type Props = { data: MonthData[] };

export function RevenueChart({ data }: Props) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const max = Math.max(...data.map((d) => d.revenue), 1);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14, minHeight: 240 }}>
      <div
        onMouseLeave={() => setHoverIdx(null)}
        style={{
          position: "relative",
          flex: 1,
          display: "flex",
          alignItems: "flex-end",
          gap: 6,
          paddingTop: 24,
          paddingBottom: 6,
          minHeight: 200,
        }}
      >
        {[0, 0.25, 0.5, 0.75, 1].map((p, i) => (
          <div
            key={i}
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              bottom: `${6 + p * (100 - 12)}%`,
              borderTop: "1px dashed var(--sr-border-subtle)",
              opacity: i === 0 ? 0.6 : 0.4,
              pointerEvents: "none",
            }}
          />
        ))}

        {data.map((d, i) => {
          const pct = (d.revenue / max) * 100;
          const isHover = hoverIdx === i;
          return (
            <div
              key={`${d.month}-${i}`}
              onMouseEnter={() => setHoverIdx(i)}
              style={{
                flex: 1,
                height: "100%",
                display: "flex",
                alignItems: "flex-end",
                position: "relative",
                cursor: "pointer",
                minWidth: 0,
              }}
            >
              <div
                style={{
                  width: "100%",
                  height: `${pct}%`,
                  minHeight: d.revenue > 0 ? 4 : 0,
                  background: isHover
                    ? "linear-gradient(180deg, var(--sr-mint-300), var(--sr-mint-500))"
                    : "linear-gradient(180deg, rgba(41,220,133,0.85), rgba(41,220,133,0.45))",
                  borderRadius: "3px 3px 0 0",
                  boxShadow: isHover ? "0 0 12px rgba(41,220,133,0.5)" : "none",
                  transition: "all var(--sr-dur-fast) var(--sr-ease)",
                }}
              />
              {isHover && d.revenue > 0 && (
                <div
                  style={{
                    position: "absolute",
                    bottom: `${pct}%`,
                    left: "50%",
                    transform: "translate(-50%, -10px)",
                    padding: "5px 8px",
                    background: "var(--sr-surface-3)",
                    border: "1px solid var(--sr-border-strong)",
                    borderRadius: 4,
                    font: "500 11px/1.2 var(--font-geist-mono)",
                    color: "var(--sr-fg-strong)",
                    fontVariantNumeric: "tabular-nums",
                    whiteSpace: "nowrap",
                    zIndex: 5,
                    boxShadow: "var(--sr-shadow-pop)",
                    pointerEvents: "none",
                  }}
                >
                  {d.revenue.toLocaleString("en-US").replace(/,/g, " ")} FCFA
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          font: "400 10px/1 var(--font-geist-mono)",
          color: "var(--sr-fg-subtle)",
          paddingTop: 6,
          borderTop: "1px solid var(--sr-border-subtle)",
          textTransform: "capitalize",
        }}
      >
        {data.map((d, i) => (
          <span key={`${d.month}-label-${i}`} style={{ flex: 1, textAlign: "center" }}>
            {d.month}
          </span>
        ))}
      </div>
    </div>
  );
}
