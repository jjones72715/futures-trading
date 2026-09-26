import { useState } from 'react';
import { useTables, useFieldToggle } from '../hooks/useTables.js';
import PillFilter, { ALL } from './PillFilter.jsx';
import BalanceCard from './BalanceCard.jsx';
import StatCard from './StatCard.jsx';
import { useRecordEditor } from './Modal.jsx';
import { Chip, Delta, EmptyState, ErrorBanner, SkeletonGrid, SkeletonStats, ShowInactiveToggle } from './ui.jsx';
import { formatCurrency, distinct, isActive, sumField, num } from '../utils/formatters.js';

/**
 * Pill-filtered card grid for tables shaped like
 * { <titleField>, <ownerField>, Current Balance, Previous Balance, Notes, Active }.
 * Used by Investments and Sportsbooks.
 */
export default function BalanceTabView({
  table, noun, titleField, ownerField, chipField, totalLabel, emptyIcon, emptyMessage, addLabel, accent = 'var(--accent)',
}) {
  const { data, loading, error, reload } = useTables([table]);
  const [filter, setFilter] = useState(ALL);
  const [showInactive, setShowInactive] = useState(false);

  const records = data[table];
  const owners = distinct(records, ownerField);
  const editor = useRecordEditor({ table, noun, reload, suggestions: { [ownerField]: owners } });
  const { toggle, pending, error: toggleError } = useFieldToggle(table, reload);

  const byOwner = records.filter(r => filter === ALL || r.fields[ownerField] === filter);
  const active = byOwner.filter(isActive);
  const inactiveCount = byOwner.length - active.length;
  const visible = (showInactive ? byOwner : active)
    .sort((a, b) => (isActive(b) - isActive(a)) || num(b.fields['Current Balance']) - num(a.fields['Current Balance']));

  const total = sumField(active, 'Current Balance');
  const prev = sumField(active, 'Previous Balance');

  return (
    <div>
      <ErrorBanner error={error || toggleError} />
      <div className="fin-toolbar">
        <PillFilter options={owners} value={filter} onChange={setFilter} />
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <ShowInactiveToggle value={showInactive} onChange={setShowInactive} count={inactiveCount} />
          <button className="fin-btn primary" onClick={() => editor.open(null, filter !== ALL ? { [ownerField]: filter } : null)}>{addLabel}</button>
        </div>
      </div>

      {loading ? <SkeletonStats count={2} /> : (
        <div className="fin-stats">
          <StatCard label={`${totalLabel}${filter !== ALL ? ` — ${filter}` : ''}`} value={formatCurrency(total)} accent={accent}
            sub={<Delta current={total} previous={prev} />} />
          <StatCard label="Active Accounts" value={active.length} accent="var(--text)" />
        </div>
      )}

      {loading ? <SkeletonGrid count={4} /> : visible.length === 0 ? (
        <EmptyState icon={emptyIcon} message={records.length ? 'Nothing matches this filter.' : emptyMessage}
          actionLabel={addLabel.replace(/^\+\s*/, '')} onAction={() => editor.open()} />
      ) : (
        <div className="fin-grid">
          {visible.map(r => {
            const f = r.fields;
            return (
              <BalanceCard
                key={r.id}
                title={f[titleField] || 'Untitled'}
                chips={<>
                  {chipField && f[chipField] && <Chip color="#00D4FF">{f[chipField]}</Chip>}
                  {f[ownerField] && <Chip>{f[ownerField]}</Chip>}
                </>}
                current={f['Current Balance']}
                previous={f['Previous Balance']}
                notes={f.Notes}
                active={isActive(r)}
                toggling={pending === r.id}
                onToggleActive={v => toggle(r, 'Active', v)}
                onEdit={() => editor.open(r)}
              />
            );
          })}
        </div>
      )}
      {editor.modal}
    </div>
  );
}
