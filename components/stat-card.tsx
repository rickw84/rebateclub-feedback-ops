type StatCardProps = {
  label: string;
  value: string;
  delta?: string;
};

export function StatCard({ label, value, delta }: StatCardProps) {
  return (
    <article className="metric-card">
      <div className="metric-label">{label}</div>
      <div className="metric-value">{value}</div>
      <div className="metric-delta">{delta ?? "Live operations snapshot"}</div>
    </article>
  );
}
