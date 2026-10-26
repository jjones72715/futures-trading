import { useState } from 'react';
import { useTables, useFieldToggle } from '../hooks/useTables.js';
import { T, CHOICES } from '../config/airtable.js';
import PillFilter, { ALL } from '../components/PillFilter.jsx';
import StatCard from '../components/StatCard.jsx';
import { useRecordEditor } from '../components/Modal.jsx';
import RecordTable from '../components/RecordTable.jsx';
import { RecordDetailsPanel } from '../components/EditDetailsSection.jsx';
import { FORMS } from '../config/forms.js';
import { Chip, EmptyState, ErrorBanner, SkeletonStats, SkeletonTable, ShowInactiveToggle, Switch } from '../components/ui.jsx';
import { formatCurrency, distinct, isActive, num } from '../utils/formatters.js';

const PER_YEAR = { Monthly: 12, Quarterly: 4, Annual: 1 };
const UNCATEGORIZED = 'Uncategorized';

export const annualCost = (f) => num(f.Amount) * (PER_YEAR[f.Frequency] ?? 12);
export const monthlyCost = (f) => annualCost(f) / 12;

// Subscriptions aren't balance-based, so there's no reconciliation status here — the side panel
// is a plain details editor.
export default function SubscriptionsTab() {
  const { data, loading, error, reload } = useTables([T.SUBSCRIPTIONS]);
  const [owner, setOwner] = useState(ALL);
  const [showInactive, setShowInactive] = useState(false);
  const [selectedId, setSelectedId] = useState(null);

  const subs = data[T.SUBSCRIPTIONS];
  const owners = distinct(subs, 'Owner');
  const selected = subs.find(r => r.id === selectedId) || null;
  const editor = useRecordEditor({ table: T.SUBSCRIPTIONS, noun: 'Subscription', reload, suggestions: { Owner: owners } });
  const { toggle, pending, error: toggleError } = useFieldToggle(T.SUBSCRIPTIONS, reload);

  const byOwner = subs.filter(r => owner === ALL || r.fields.Owner === owner);
  const active = byOwner.filter(isActive);
  const inactiveCount = byOwner.length - active.length;
  const visible = (showInactive ? byOwner : active)
    .sort((a, b) => (isActive(b) - isActive(a)) || monthlyCost(b.fields) - monthlyCost(a.fields));

  const totalAnnual = active.reduce((s, r) => s + annualCost(r.fields), 0);
  const totalMonthly = totalAnnual / 12;

  const dash = <span className="fin-faint">—</span>;
  const columns = [
    { key: 'name', label: 'Name', sort: r => r.fields.Name || '', className: 'cell-name',
      render: r => <>{r.fields.Name || 'Untitled'}{r.fields['Auto Pay'] && <span className="fin-tag-muted">· auto pay</span>}</> },
    { key: 'owner', label: 'Owner', sort: r => r.fields.Owner || '', render: r => (r.fields.Owner ? <Chip>{r.fields.Owner}</Chip> : dash) },
    { key: 'amount', label: 'Amount', numeric: true, sort: r => monthlyCost(r.fields),
      render: r => (
        <>
          <strong>{formatCurrency(r.fields.Amount)}</strong>
          {r.fields.Frequency && r.fields.Frequency !== 'Monthly' && (
            <span className="fin-tag-muted">{formatCurrency(monthlyCost(r.fields))}/mo</span>
          )}
        </>
      ) },
    { key: 'frequency', label: 'Frequency', sort: r => r.fields.Frequency || '', render: r => r.fields.Frequency || dash },
    { key: 'due', label: 'Next Due', sort: r => r.fields['Due Date'] || '', render: r => r.fields['Due Date'] || dash },
    { key: 'active', label: 'Active', interactive: true,
      render: r => <Switch on={isActive(r)} onChange={v => toggle(r, 'Active', v)} disabled={pending === r.id} /> },
  ];

  return (
    <div className={selected ? 'fin-has-panel' : undefined}>
      <ErrorBanner error={error || toggleError} />
      <div className="fin-toolbar">
        <PillFilter options={owners} value={owner} onChange={setOwner} />
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <ShowInactiveToggle value={showInactive} onChange={setShowInactive} count={inactiveCount} />
          <button className="fin-btn primary" onClick={() => editor.open(null, owner !== ALL ? { Owner: owner } : null)}>+ Add Subscription</button>
        </div>
      </div>

      {loading ? <SkeletonStats count={3} /> : (
        <div className="fin-stats">
          <StatCard label="Total Monthly Cost" value={formatCurrency(totalMonthly)} accent="var(--accent)" sub="quarterly & annual items spread over 12 months" />
          <StatCard label="Total Annual Cost" value={formatCurrency(totalAnnual)} accent="var(--warning)" />
          <StatCard label="Active Subscriptions" value={active.length} accent="var(--text)" />
        </div>
      )}

      {loading ? <SkeletonTable rows={8} /> : visible.length === 0 ? (
        <EmptyState icon="🔁" message={subs.length ? 'Nothing matches this filter.' : 'No subscriptions or recurring bills yet.'}
          actionLabel="Add subscription" onAction={() => editor.open()} />
      ) : (
        <RecordTable
          columns={columns}
          rows={visible}
          selectedId={selectedId}
          onRowClick={r => setSelectedId(r.id)}
          rowClassName={r => (isActive(r) ? '' : 'inactive')}
          group={{
            by: r => r.fields.Category || UNCATEGORIZED,
            order: [...CHOICES.SUB_CATEGORY, UNCATEGORIZED],
            totalKey: 'amount',
            total: items => <>{formatCurrency(items.filter(isActive).reduce((s, r) => s + monthlyCost(r.fields), 0))}<span className="fin-muted" style={{ fontWeight: 400 }}>/mo</span></>,
          }}
        />
      )}

      {selected && (
        <RecordDetailsPanel
          table={T.SUBSCRIPTIONS}
          record={selected}
          reload={reload}
          onClose={() => setSelectedId(null)}
          title={selected.fields.Name || 'Untitled'}
          subtitle={[selected.fields.Category, selected.fields.Owner].filter(Boolean).join(' · ') || null}
          fields={FORMS[T.SUBSCRIPTIONS].map(s => s.name)}
          suggestions={{ Owner: owners }}
        />
      )}
      {editor.modal}
    </div>
  );
}
