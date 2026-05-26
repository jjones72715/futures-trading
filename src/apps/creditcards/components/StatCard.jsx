export function StatCard({ label, value, accent = '#00D4FF' }) {
  return (
    <div style={{
      background: '#172033',
      borderRadius: 12,
      padding: '1.25rem 1.5rem',
      display: 'flex',
      flexDirection: 'column',
      gap: 4,
      border: '1px solid rgba(255,255,255,0.08)',
    }}>
      <span style={{ fontSize: '1.6rem', fontWeight: 700, color: accent, lineHeight: 1 }}>{value}</span>
      <span style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)', marginTop: 4 }}>{label}</span>
    </div>
  );
}
