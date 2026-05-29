const STATUS_COLORS = {
  '✅ Safe': '#00E676',
  '⚠️ Review Soon': '#FFD60A',
  '🚨 Call Retention': '#FF4D4D',
};

export function StatusBadge({ status }) {
  if (!status) return null;
  const color = STATUS_COLORS[status] ?? 'rgba(255,255,255,0.4)';
  return (
    <span style={{
      display: 'inline-block',
      padding: '2px 10px',
      borderRadius: 20,
      fontSize: '0.72rem',
      fontWeight: 600,
      background: color + '22',
      color,
      border: `1px solid ${color}55`,
      whiteSpace: 'nowrap',
    }}>
      {status}
    </span>
  );
}
