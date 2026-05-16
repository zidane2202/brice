"use client";

import { useEffect, useRef, useState } from "react";

type Props = { label: string; value: string | number; accent?: boolean; sub?: string };

export function StatsCard({ label, value, accent, sub }: Props) {
  const isNumber = typeof value === "number";
  const [display, setDisplay] = useState(isNumber ? 0 : value);
  const frameRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isNumber) { setDisplay(value); return; }
    const target = value as number;
    const duration = 800;
    const start = performance.now();

    const tick = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(eased * target));
      if (progress < 1) frameRef.current = requestAnimationFrame(tick);
    };

    frameRef.current = requestAnimationFrame(tick);
    return () => { if (frameRef.current) cancelAnimationFrame(frameRef.current); };
  }, [value, isNumber]);

  return (
    <div className={`stats-card${accent ? " stats-card--accent" : ""}`}>
      <span>{label}</span>
      <strong>{display}</strong>
      {sub && <span className="stats-card-sub">{sub}</span>}
    </div>
  );
}
