import { Delta, Switch } from './ui.jsx';
import { formatCurrency } from '../utils/formatters.js';

// Shared card for any record with Current / Previous balances.
export default function BalanceCard({
  title, subtitle, chips, current, previous, invert, notes, extra,
  active, onToggleActive, toggling, onEdit, balanceColor,
}) {
  const hasActive = typeof onToggleActive === 'function';
  return (
    <div className={`fin-card${hasActive && !active ? ' inactive' : ''}`}>
      <div className="fin-card-top">
        <div style={{ minWidth: 0 }}>
          <div className="fin-card-title">{title}</div>
          {subtitle && <div className="fin-card-sub">{subtitle}</div>}
        </div>
        {hasActive && <Switch on={active} onChange={onToggleActive} disabled={toggling} title={active ? 'Active — click to deactivate' : 'Inactive — click to activate'} />}
      </div>
      {chips && <div className="fin-card-chips">{chips}</div>}
      <div>
        <div className="fin-balance" style={balanceColor ? { color: balanceColor } : undefined}>{formatCurrency(current)}</div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'baseline', flexWrap: 'wrap', marginTop: 4 }}>
          <span className="fin-prev">Prev {formatCurrency(previous)}</span>
          <Delta current={current} previous={previous} invert={invert} />
        </div>
      </div>
      {extra}
      {notes && <div className="fin-notes">{notes}</div>}
      {onEdit && (
        <div className="fin-card-actions">
          <button className="fin-btn sm" onClick={onEdit}>Edit</button>
        </div>
      )}
    </div>
  );
}
