import { Delta, Switch } from './ui.jsx';
import { StatusDot } from './Status.jsx';
import { formatCurrency } from '../utils/formatters.js';

// Shared card for any record with Current / Previous balances.
export default function BalanceCard({
  title, subtitle, chips, current, previous, invert, notes, extra,
  active, onToggleActive, toggling, onEdit, balanceColor,
  status, onClick, selected,
}) {
  const hasActive = typeof onToggleActive === 'function';
  // Inner controls must not also trigger the card's click (which opens the side panel).
  const stop = (e) => e.stopPropagation();
  return (
    <div className={`fin-card${hasActive && !active ? ' inactive' : ''}${onClick ? ' clickable' : ''}${selected ? ' selected' : ''}`}
      onClick={onClick}>
      <div className="fin-card-top">
        <div style={{ minWidth: 0 }}>
          <div className="fin-card-title-row">
            {status !== undefined && <StatusDot status={status} />}
            <div className="fin-card-title">{title}</div>
          </div>
          {subtitle && <div className="fin-card-sub">{subtitle}</div>}
        </div>
        {hasActive && (
          <span onClick={stop}>
            <Switch on={active} onChange={onToggleActive} disabled={toggling} title={active ? 'Active — click to deactivate' : 'Inactive — click to activate'} />
          </span>
        )}
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
        <div className="fin-card-actions" onClick={stop}>
          <button className="fin-btn sm" onClick={onEdit}>Edit</button>
        </div>
      )}
    </div>
  );
}
