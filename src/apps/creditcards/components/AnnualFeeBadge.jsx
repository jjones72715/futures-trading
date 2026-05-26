import { daysColor } from '../utils/format.js';

export function AnnualFeeBadge({ days }) {
  if (days == null) return <span style={{ color: 'rgba(255,255,255,0.3)' }}>—</span>;
  const color = daysColor(days);
  return (
    <span style={{
      display: 'inline-block',
      padding: '2px 10px',
      borderRadius: 20,
      fontSize: '0.72rem',
      fontWeight: 700,
      background: color + '22',
      color,
      border: `1px solid ${color}55`,
      whiteSpace: 'nowrap',
    }}>
      {days}d
    </span>
  );
}
