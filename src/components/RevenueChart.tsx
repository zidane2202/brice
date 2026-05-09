"use client";

import { useEffect, useRef } from "react";

type MonthData = { month: string; revenue: number };
type Props = { data: MonthData[] };

export function RevenueChart({ data }: Props) {
  const max = Math.max(...data.map((d) => d.revenue), 1);
  const barsRef = useRef<HTMLDivElement[]>([]);

  useEffect(() => {
    barsRef.current.forEach((bar, i) => {
      if (!bar) return;
      const target = (data[i].revenue / max) * 100;
      bar.style.height = "0%";
      bar.style.opacity = "0";
      setTimeout(() => {
        bar.style.transition = `height 0.6s cubic-bezier(0.22, 1, 0.36, 1) ${i * 80}ms, opacity 0.3s ease ${i * 80}ms`;
        bar.style.height = `${target}%`;
        bar.style.opacity = "1";
      }, 100);
    });
  }, [data, max]);

  return (
    <div className="revenue-chart">
      {data.map((d, i) => (
        <div key={d.month} className="revenue-bar-wrap">
          <span className="revenue-value">{d.revenue > 0 ? d.revenue.toLocaleString() : ""}</span>
          <div
            className="revenue-bar"
            ref={(el) => { if (el) barsRef.current[i] = el; }}
            style={{ height: "0%", opacity: 0 }}
          />
          <span className="revenue-month">{d.month}</span>
        </div>
      ))}
    </div>
  );
}
