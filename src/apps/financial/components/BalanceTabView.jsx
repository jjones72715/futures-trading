import { useState } from 'react';
import { useTables, useFieldToggle } from '../hooks/useTables.js';
import PillFilter, { ALL } from './PillFilter.jsx';
import StatCard from './StatCard.jsx';
import { useRecordEditor } from './Modal.jsx';
import RecordTable, { ChangeCell } from './RecordTable.jsx';
import BalanceUpdatePanel, { PanelNotes } from './BalanceUpdatePanel.jsx';
import { useRecordStatus } from '../hooks/useCycle.jsx';
import { Chip, Delta, EmptyState, ErrorBanner, SkeletonStats, SkeletonTable, ShowInactiveToggle, Switch } from './ui.jsx';
import { formatCurrency, distinct, isActive, sumField, num } from '../utils/formatters.js';

/**
 * Pill-filtered compact table for tables shaped like
 * { <titleField>, <ownerField>, Current Balance, Previous Balance, Notes, Active, Last Updated }.
 * Used by Investments and Sportsbooks. Clicking a row opens the reconciliation side panel,
 * which is also where all editing happens; the center modal is only for adding.
 */
export default function BalanceTabView({
  table, noun, titleField, ownerField, ownerLabel = 'Owner', chipField, totalLabel, emptyIcon, emptyMessage, addLabel,
  accent = 'var(--accent)', showActiveColumn = false,
}) {
  const { data, loading, error, reload } = useTables([table]);
  const [filter, setFilter] = useState(ALL);
  const [showInactive, setShowInactive] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const statusOf = useRecordStatus();

  const records = data[table];
  const owners = distinct(records, ownerField);
  const editor = useRecordEditor({ table, noun, reload, suggestions: { [ownerField]: owners } });
  const { toggle, pending, error: toggleError } = useFieldToggle(table, reload);

  const byOwner = records.filter(r => filter === ALL || r.fields[ownerField] === filter);
  const active = byOwner.filter(isActive);
  const inactiveCount = byOwner.length - active.length;
  const visible = (showInactive ? byOwner : active)
    .sort((a, b) => (isActive(b) - isActive(a)) || num(b.fields['Current Balance']) - num(a.fields['Current Balance']));
  const selected = records.find(r => r.id === selectedId) || null;

  const total = sumField(active, 'Current Balance');
  const prev = sumField(active, 'Previous Balance');

  const columns = [
    { key: 'name', label: titleField, sort: r => r.fields[titleField] || '', className: 'cell-name',
      render: r => r.fields[titleField] || 'Untitled' },
    { key: 'owner', label: ownerLabel, sort: r => r.fields[ownerField] || '',
      render: r => r.fields[ownerField] || <span className="fin-faint">—</span> },
    { key: 'current', label: 'Current Balance', numeric: true, sort: r => num(r.fields['Current Balance']),
      render: r => <strong>{formatCurrency(r.fields['Current Balance'])}</strong> },
    { key: 'previous', label: 'Previous Balance', numeric: true, sort: r => num(r.fields['Previous Balance']),
      render: r => <span className="fin-muted">{formatCurrency(r.fields['Previous Balance'])}</span> },
    { key: 'change', label: 'Change', numeric: true, sort: r => num(r.fields['Current Balance']) - num(r.fields['Previous Balance']),
      render: r => <ChangeCell current={r.fields['Current Balance']} previous={r.fields['Previous Balance']} /> },
    ...(showActiveColumn ? [{
      key: 'active', label: 'Active', interactive: true,
      render: r => <Switch on={isActive(r)} onChange={v => toggle(r, 'Active', v)} disabled={pending === r.id} />,
    }] : []),
  ];

  return (
    <div className={selected ? 'fin-has-panel' : undefined}>
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

      {loading ? <SkeletonTable rows={6} /> : visible.length === 0 ? (
        <EmptyState icon={emptyIcon} message={records.length ? 'Nothing matches this filter.' : emptyMessage}
          actionLabel={addLabel.replace(/^\+\s*/, '')} onAction={() => editor.open()} />
      ) : (
        <RecordTable
          columns={columns}
          rows={visible}
          statusOf={statusOf}
          selectedId={selectedId}
          onRowClick={r => setSelectedId(r.id)}
          rowClassName={r => (isActive(r) ? '' : 'inactive')}
        />
      )}

      {selected && (
        <BalanceUpdatePanel
          table={table}
          record={selected}
          reload={reload}
          onClose={() => setSelectedId(null)}
          title={selected.fields[titleField] || 'Untitled'}
          subtitle={selected.fields[ownerField] || null}
          chips={<>
            {chipField && selected.fields[chipField] && <Chip color="#00D4FF">{selected.fields[chipField]}</Chip>}
            {selected.fields[ownerField] && <Chip>{selected.fields[ownerField]}</Chip>}
          </>}
          detailFields={[titleField, ownerField, 'Notes', 'Active']}
          suggestions={{ [ownerField]: owners }}
        >
          <PanelNotes notes={selected.fields.Notes} />
        </BalanceUpdatePanel>
      )}
      {editor.modal}
    </div>
  );
}
