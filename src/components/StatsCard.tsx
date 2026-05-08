type Props = { label: string; value: string | number; accent?: boolean };

export function StatsCard({ label, value, accent }: Props) {
  return (
    <div className={`stats-card${accent ? " stats-card--accent" : ""}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
