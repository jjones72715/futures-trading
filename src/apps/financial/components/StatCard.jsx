export default function StatCard({ label, value, accent = 'var(--accent)', sub, size }) {
  return (
    <div className="fin-stat">
      <span className="fin-stat-value" style={{ color: accent, fontSize: size }}>{value}</span>
      <span className="fin-stat-label">{label}</span>
      {sub && <span className="fin-stat-sub">{sub}</span>}
    </div>
  );
}
