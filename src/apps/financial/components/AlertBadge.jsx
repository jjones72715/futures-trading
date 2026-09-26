const LEVELS = {
  danger: '#FF4D4D',
  orange: '#FF9F43',
  warning: '#FFD60A',
  ok: '#00E676',
  info: '#00D4FF',
  muted: 'rgba(255,255,255,0.5)',
};

export function levelColor(level) {
  return LEVELS[level] || LEVELS.muted;
}

// Days-remaining level for deadlines: past → danger, then configurable thresholds.
export function deadlineLevel(days, { danger = 0, warning = 30 } = {}) {
  if (days == null) return 'muted';
  if (days < danger) return 'danger';
  if (days <= warning) return 'warning';
  return 'ok';
}

export function daysText(days) {
  if (days == null) return '';
  if (days < 0) return `${Math.abs(days)}d overdue`;
  if (days === 0) return 'today';
  return `${days}d left`;
}

export default function AlertBadge({ level = 'muted', children }) {
  const c = levelColor(level);
  return (
    <span className="fin-badge" style={{ color: c, background: `${c}1f`, border: `1px solid ${c}55` }}>
      {children}
    </span>
  );
}
