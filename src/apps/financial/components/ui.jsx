import { delta, formatCurrency, formatPercent } from '../utils/formatters.js';

export function Chip({ children, color }) {
  const style = color ? { color, borderColor: `${color}55`, background: `${color}18` } : undefined;
  return <span className="fin-chip" style={style}>{children}</span>;
}

// Current-vs-previous delta. `invert` flips the colors for debts (a rising balance is bad).
export function Delta({ current, previous, invert = false }) {
  const { diff, pct } = delta(current, previous);
  const rounded = Math.round(diff * 100) / 100;
  if (rounded === 0) return <span className="fin-delta flat">— {formatCurrency(0)}</span>;
  const up = rounded > 0;
  const good = invert ? !up : up;
  return (
    <span className={`fin-delta ${good ? 'up' : 'down'}`}>
      {up ? '↑' : '↓'} {formatCurrency(Math.abs(rounded))}
      {pct != null && ` (${formatPercent(pct, { signed: true })})`}
    </span>
  );
}

export function EmptyState({ icon = '∅', message, actionLabel, onAction }) {
  return (
    <div className="fin-empty">
      <div className="fin-empty-icon">{icon}</div>
      <div>{message}</div>
      {actionLabel && <button className="fin-btn primary sm" onClick={onAction}>{actionLabel}</button>}
    </div>
  );
}

export function Skel({ w = '100%', h = 14, style }) {
  return <div className="fin-skel" style={{ width: w, height: h, ...style }} />;
}

export function SkeletonCard() {
  return (
    <div className="fin-card">
      <Skel w="55%" h={16} />
      <Skel w="35%" h={11} />
      <Skel w="50%" h={28} style={{ marginTop: 6 }} />
      <Skel w="70%" h={11} />
    </div>
  );
}

export function SkeletonGrid({ count = 6 }) {
  return (
    <div className="fin-grid">
      {Array.from({ length: count }).map((_, i) => <SkeletonCard key={i} />)}
    </div>
  );
}

export function SkeletonStats({ count = 4 }) {
  return (
    <div className="fin-stats">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="fin-stat"><Skel w="60%" h={26} /><Skel w="40%" h={11} style={{ marginTop: 8 }} /></div>
      ))}
    </div>
  );
}

export function SkeletonTable({ rows = 6 }) {
  return (
    <div className="fin-table-wrap" style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: 12 }}>
      {Array.from({ length: rows }).map((_, i) => <Skel key={i} h={14} w={`${95 - i * 5}%`} />)}
    </div>
  );
}

export function Switch({ on, onChange, disabled, title }) {
  return (
    <button
      type="button"
      className={`fin-switch${on ? ' on' : ''}`}
      onClick={() => onChange(!on)}
      disabled={disabled}
      title={title}
      aria-pressed={on}
    />
  );
}

export function ShowInactiveToggle({ value, onChange, count }) {
  if (!count) return null;
  return (
    <label className="fin-link" style={{ cursor: 'pointer' }}>
      <input type="checkbox" className="fin-inline-check" checked={value} onChange={e => onChange(e.target.checked)} />
      Show inactive ({count})
    </label>
  );
}

export function Subtabs({ tabs, value, onChange }) {
  return (
    <div className="fin-subtabs">
      {tabs.map(t => (
        <button key={t.id} className={`fin-subtab${value === t.id ? ' active' : ''}`} onClick={() => onChange(t.id)}>
          {t.label}
        </button>
      ))}
    </div>
  );
}

export function ErrorBanner({ error }) {
  if (!error) return null;
  return <div className="fin-error">Couldn’t load some data — {error}</div>;
}
