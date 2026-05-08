"use client";

type MonthData = { month: string; revenue: number };
type Props = { data: MonthData[] };

export function RevenueChart({ data }: Props) {
  const max = Math.max(...data.map((d) => d.revenue), 1);

  return (
    <div className="revenue-chart">
      {data.map((d) => (
        <div key={d.month} className="revenue-bar-wrap">
          <span className="revenue-value">{d.revenue > 0 ? d.revenue.toLocaleString() : ""}</span>
          <div
            className="revenue-bar"
            style={{ height: `${(d.revenue / max) * 100}%` }}
          />
          <span className="revenue-month">{d.month}</span>
        </div>
      ))}
    </div>
  );
}
