import { useState } from 'react';
import { useTables, useFieldToggle } from '../hooks/useTables.js';
import { T, CHOICES } from '../config/airtable.js';
import PillFilter, { ALL } from '../components/PillFilter.jsx';
import StatCard from '../components/StatCard.jsx';
import { useRecordEditor } from '../components/Modal.jsx';
import { Chip, EmptyState, ErrorBanner, SkeletonStats, SkeletonTable, ShowInactiveToggle, Switch } from '../components/ui.jsx';
import { formatCurrency, distinct, isActive, num } from '../utils/formatters.js';

const PER_YEAR = { Monthly: 12, Quarterly: 4, Annual: 1 };
const UNCATEGORIZED = 'Uncategorized';

export const annualCost = (f) => num(f.Amount) * (PER_YEAR[f.Frequency] ?? 12);
export const monthlyCost = (f) => annualCost(f) / 12;

export default function SubscriptionsTab() {
  const { data, loading, error, reload } = useTables([T.SUBSCRIPTIONS]);
  const [owner, setOwner] = useState(ALL);
  const [showInactive, setShowInactive] = useState(false);
  const [collapsed, setCollapsed] = useState({});

  const subs = data[T.SUBSCRIPTIONS];
  const owners = distinct(subs, 'Owner');
  const editor = useRecordEditor({ table: T.SUBSCRIPTIONS, noun: 'Subscription', reload, suggestions: { Owner: owners } });
  const { toggle, pending, error: toggleError } = useFieldToggle(T.SUBSCRIPTIONS, reload);

  const byOwner = subs.filter(r => owner === ALL || r.fields.Owner === owner);
  const active = byOwner.filter(isActive);
  const inactiveCount = byOwner.length - active.length;
  const visible = showInactive ? byOwner : active;

  const totalAnnual = active.reduce((s, r) => s + annualCost(r.fields), 0);
  const totalMonthly = totalAnnual / 12;

  const categories = [...CHOICES.SUB_CATEGORY, ...distinct(visible, 'Category').filter(c => !CHOICES.SUB_CATEGORY.includes(c)), UNCATEGORIZED];
  const groups = categories
    .map(cat => ({
      cat,
      items: visible
        .filter(r => (r.fields.Category || UNCATEGORIZED) === cat)
        .sort((a, b) => (isActive(b) - isActive(a)) || monthlyCost(b.fields) - monthlyCost(a.fields)),
    }))
    .filter(g => g.items.length);

  return (
    <div>
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

      {loading ? <SkeletonTable rows={8} /> : groups.length === 0 ? (
        <EmptyState icon="🔁" message={subs.length ? 'Nothing matches this filter.' : 'No subscriptions or recurring bills yet.'}
          actionLabel="Add subscription" onAction={() => editor.open()} />
      ) : (
        <div className="fin-table-wrap">
          <table className="fin-table">
            <thead>
              <tr>
                <th>Name</th><th className="num">Amount</th><th>Frequency</th><th>Due Date</th><th>Category</th>
                <th>Owner</th><th>Auto Pay</th><th>Active</th><th />
              </tr>
            </thead>
            <tbody>
              {groups.map(g => {
                const isCollapsed = !!collapsed[g.cat];
                const catMonthly = g.items.filter(isActive).reduce((s, r) => s + monthlyCost(r.fields), 0);
                return [
                  <tr key={`h-${g.cat}`} className="group-row" onClick={() => setCollapsed(c => ({ ...c, [g.cat]: !c[g.cat] }))}>
                    <td colSpan={9}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                        <span>
                          <span className={`fin-sh-caret${isCollapsed ? ' closed' : ''}`} style={{ marginRight: 8 }}>▼</span>
                          {g.cat} <span className="fin-faint" style={{ fontWeight: 400 }}>({g.items.length})</span>
                        </span>
                        <span>
                          {formatCurrency(catMonthly)}<span className="fin-muted" style={{ fontWeight: 400 }}>/mo</span>
                          <span className="fin-faint" style={{ fontWeight: 400, marginLeft: 10 }}>{formatCurrency(catMonthly * 12)}/yr</span>
                        </span>
                      </div>
                    </td>
                  </tr>,
                  ...(isCollapsed ? [] : g.items.map(r => {
                    const f = r.fields;
                    const on = isActive(r);
                    return (
                      <tr key={r.id} className={on ? '' : 'row-muted'}>
                        <td style={{ fontWeight: 600 }}>{f.Name}</td>
                        <td className="num" style={{ fontWeight: 700 }}>
                          {formatCurrency(f.Amount)}
                          {f.Frequency && f.Frequency !== 'Monthly' && (
                            <div className="fin-faint" style={{ fontSize: '0.7rem', fontWeight: 400 }}>{formatCurrency(monthlyCost(f))}/mo</div>
                          )}
                        </td>
                        <td>{f.Frequency || '—'}</td>
                        <td>{f['Due Date'] || '—'}</td>
                        <td>{f.Category ? <Chip color="#00D4FF">{f.Category}</Chip> : '—'}</td>
                        <td>{f.Owner ? <Chip>{f.Owner}</Chip> : '—'}</td>
                        <td>
                          <input type="checkbox" className="fin-inline-check" checked={f['Auto Pay'] === true}
                            disabled={pending === r.id} onChange={e => toggle(r, 'Auto Pay', e.target.checked)} />
                        </td>
                        <td><Switch on={on} disabled={pending === r.id} onChange={v => toggle(r, 'Active', v)} /></td>
                        <td><button className="fin-btn sm" onClick={() => editor.open(r)}>Edit</button></td>
                      </tr>
                    );
                  })),
                ];
              })}
            </tbody>
          </table>
        </div>
      )}
      {editor.modal}
    </div>
  );
}
