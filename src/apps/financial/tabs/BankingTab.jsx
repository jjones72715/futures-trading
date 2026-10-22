import { useState } from 'react';
import { useTables, useFieldToggle } from '../hooks/useTables.js';
import { T } from '../config/airtable.js';
import PillFilter, { ALL } from '../components/PillFilter.jsx';
import SectionHeader from '../components/SectionHeader.jsx';
import StatCard from '../components/StatCard.jsx';
import SummaryStrip from '../components/SummaryStrip.jsx';
import SidePanel, { PanelSection, PanelRow } from '../components/SidePanel.jsx';
import { useSort, sortRows, SortTh, SearchInput, matchesQuery } from '../components/SortableTable.jsx';
import AlertBadge, { daysText } from '../components/AlertBadge.jsx';
import { useRecordEditor } from '../components/Modal.jsx';
import {
  Chip, Delta, MiniDelta, EmptyState, ErrorBanner, SkeletonStats, SkeletonTable, ShowInactiveToggle, Subtabs, Switch,
} from '../components/ui.jsx';
import {
  formatCurrency, formatShortDate, daysUntil, distinct, isActive, countsTowardNetWorth, sumField, num, delta,
} from '../utils/formatters.js';

const SUBTABS = [{ id: 'accounts', label: 'Accounts' }, { id: 'bonuses', label: 'Bonuses' }];

export default function BankingTab({ subtab, onSubtab }) {
  return (
    <div>
      <Subtabs tabs={SUBTABS} value={subtab} onChange={onSubtab} />
      {subtab === 'bonuses' ? <BonusesView /> : <AccountsView />}
    </div>
  );
}

/* ================= Accounts ================= */

const NO_OWNER = 'No owner';

// Minimum column / below-minimum check use the account's target, ignoring Target Type "None".
function targetOf(f) {
  if (f['Target Amount'] == null || f['Target Type'] === 'None') return null;
  return { amount: f['Target Amount'], type: f['Target Type'] || 'Target' };
}
const isBelowMin = (f) => {
  const t = targetOf(f);
  return !!t && t.type === 'Minimum Balance' && num(f['Current Balance']) < t.amount;
};

const ACCOUNT_SORT = {
  name: r => r.fields['Account Name'] || '',
  owner: r => r.fields.Owner || '',
  type: r => r.fields.Type || '',
  balance: r => num(r.fields['Current Balance']),
  minimum: r => targetOf(r.fields)?.amount ?? null,
};

function AccountsView() {
  const { data, loading, error, reload } = useTables([T.BANKING_ACCOUNTS, T.OWED_TO_ME]);
  const [owner, setOwner] = useState(ALL);
  const [query, setQuery] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const [groupByOwner, setGroupByOwner] = useState(false);
  const [collapsed, setCollapsed] = useState({});
  const [openOwed, setOpenOwed] = useState(true);
  const [selectedId, setSelectedId] = useState(null);
  const { sort, onSort } = useSort('name');

  const accounts = data[T.BANKING_ACCOUNTS];
  const owed = data[T.OWED_TO_ME];
  const owners = distinct(accounts, 'Owner');
  const selected = accounts.find(r => r.id === selectedId) || null;

  const accountEditor = useRecordEditor({ table: T.BANKING_ACCOUNTS, noun: 'Bank Account', reload, suggestions: { Owner: owners } });
  const owedEditor = useRecordEditor({ table: T.OWED_TO_ME, noun: 'Owed to Me', reload });
  const { toggle, pending, error: toggleError } = useFieldToggle(T.BANKING_ACCOUNTS, reload);

  const byOwner = accounts.filter(r => owner === ALL || r.fields.Owner === owner);
  const inactiveCount = byOwner.filter(r => !isActive(r)).length;
  const rows = sortRows(
    byOwner
      .filter(r => showInactive || isActive(r))
      .filter(r => matchesQuery(query, [r.fields['Account Name'], r.fields.Institution, r.fields.Owner, r.fields.Type, r.fields.Notes,
        countsTowardNetWorth(r) ? null : 'tax holdback'])),
    ACCOUNT_SORT, sort,
  );

  // Summary strip: Cash excludes tax-holdback accounts; those get their own figure. Both follow the owner filter.
  const activeFiltered = byOwner.filter(isActive);
  const cashAccounts = activeFiltered.filter(countsTowardNetWorth);
  const holdbackAccounts = activeFiltered.filter(r => !countsTowardNetWorth(r));
  const totalCash = sumField(cashAccounts, 'Current Balance');
  const prevCash = sumField(cashAccounts, 'Previous Balance');
  const holdbackCash = sumField(holdbackAccounts, 'Current Balance');
  const owedTotal = sumField(owed, 'Current Amount');
  const suffix = owner !== ALL ? ` — ${owner}` : '';

  const groups = groupByOwner
    ? [...owners, NO_OWNER]
      .map(name => ({ name, items: rows.filter(r => (r.fields.Owner || NO_OWNER) === name) }))
      .filter(g => g.items.length)
    : null;

  function renderRow(r) {
    const f = r.fields;
    const target = targetOf(f);
    const low = isBelowMin(f);
    return (
      <tr key={r.id} className={`row${r.id === selectedId ? ' selected' : ''}${isActive(r) ? '' : ' inactive'}`}
        onClick={() => setSelectedId(r.id)}>
        <td className="cell-name" title={f.Institution ? `${f['Account Name']} — ${f.Institution}` : f['Account Name']}>
          {f['Account Name'] || 'Untitled'}
        </td>
        <td>{f.Owner || <span className="fin-faint">—</span>}</td>
        <td>
          {f.Type ? <Chip color="#00D4FF">{f.Type}</Chip> : <span className="fin-faint">—</span>}
          {!countsTowardNetWorth(r) && <span className="fin-tag-holdback">· Tax holdback</span>}
          {!isActive(r) && <span className="fin-tag-muted">· inactive</span>}
        </td>
        <td className="num">
          <MiniDelta current={f['Current Balance']} previous={f['Previous Balance']} />
          <span className={low ? 'fin-bal-low' : undefined} style={{ fontWeight: 700 }} title={low ? 'Below minimum balance' : undefined}>
            {formatCurrency(f['Current Balance'])}
          </span>
        </td>
        <td className="num">
          {target ? (
            <>
              {formatCurrency(target.amount)}
              {target.type === 'Savings Goal' && <span className="fin-tag-muted">goal</span>}
            </>
          ) : <span className="fin-faint">—</span>}
        </td>
      </tr>
    );
  }

  return (
    <div className={selected ? 'fin-has-panel' : undefined}>
      <ErrorBanner error={error || toggleError} />
      <SummaryStrip loading={loading} items={[
        { label: `Cash${suffix}`, value: formatCurrency(totalCash), color: 'var(--positive)', sub: <Delta current={totalCash} previous={prevCash} /> },
        { label: `Tax Holdback Cash${suffix}`, value: formatCurrency(holdbackCash), color: 'var(--warning)' },
        { label: 'Active Accounts', value: activeFiltered.length },
        { label: 'Owed to Me', value: formatCurrency(owedTotal), color: 'var(--warning)' },
      ]} />

      <div className="fin-controls">
        <PillFilter options={owners} value={owner} onChange={setOwner} />
        <div className="fin-controls-right">
          <SearchInput value={query} onChange={setQuery} placeholder="Search accounts…" />
          <label className="fin-link" style={{ cursor: 'pointer' }}>
            <input type="checkbox" className="fin-inline-check" checked={groupByOwner} onChange={e => setGroupByOwner(e.target.checked)} />
            Group by owner
          </label>
          <ShowInactiveToggle value={showInactive} onChange={setShowInactive} count={inactiveCount} />
          <button className="fin-btn primary sm" onClick={() => accountEditor.open(null, owner !== ALL ? { Owner: owner } : null)}>+ Add Account</button>
        </div>
      </div>

      <div className="fin-section">
        {loading ? <SkeletonTable rows={10} /> : rows.length === 0 ? (
          <EmptyState icon="🏦" message={accounts.length ? 'No accounts match these filters.' : 'No bank accounts yet.'}
            actionLabel="Add account" onAction={() => accountEditor.open()} />
        ) : (
          <div className="fin-table-wrap scroll">
            <table className="fin-table compact">
              <thead>
                <tr>
                  <SortTh label="Account Name" k="name" sort={sort} onSort={onSort} />
                  <SortTh label="Owner" k="owner" sort={sort} onSort={onSort} />
                  <SortTh label="Type / Purpose" k="type" sort={sort} onSort={onSort} />
                  <SortTh label="Balance" k="balance" sort={sort} onSort={onSort} numeric />
                  <SortTh label="Minimum" k="minimum" sort={sort} onSort={onSort} numeric />
                </tr>
              </thead>
              <tbody>
                {groups ? groups.map(g => {
                  const isCollapsed = !query && !!collapsed[g.name];
                  return [
                    <tr key={`g-${g.name}`} className="group-row" onClick={() => setCollapsed(c => ({ ...c, [g.name]: !c[g.name] }))}>
                      <td colSpan={3}>
                        <span className={`fin-sh-caret${isCollapsed ? ' closed' : ''}`} style={{ marginRight: 8 }}>▼</span>
                        {g.name} <span className="fin-faint" style={{ fontWeight: 400 }}>({g.items.length})</span>
                      </td>
                      <td className="num">{formatCurrency(sumField(g.items, 'Current Balance'))}</td>
                      <td />
                    </tr>,
                    ...(isCollapsed ? [] : g.items.map(renderRow)),
                  ];
                }) : rows.map(renderRow)}
              </tbody>
            </table>
          </div>
        )}
        {!loading && rows.length > 0 && (
          <div className="fin-faint" style={{ fontSize: '0.72rem', marginTop: 6 }}>
            {rows.length} account{rows.length === 1 ? '' : 's'} · click a row for details
          </div>
        )}
      </div>

      <div className="fin-section">
        <SectionHeader
          title="Owed to Me"
          count={loading ? null : owed.length}
          collapsed={!openOwed}
          onToggle={() => setOpenOwed(o => !o)}
          onAdd={() => owedEditor.open()}
        />
        {openOwed && (loading ? <SkeletonTable rows={3} /> : owed.length === 0 ? (
          <EmptyState icon="🤝" message="Nobody owes you anything right now." actionLabel="Add entry" onAction={() => owedEditor.open()} />
        ) : (
          <div className="fin-table-wrap">
            <table className="fin-table compact">
              <thead>
                <tr><th>Person / Entity</th><th>Type</th><th className="num">Current</th><th className="num">Previous</th><th>Change</th><th>Notes</th><th /></tr>
              </thead>
              <tbody>
                {[...owed].sort((a, b) => num(b.fields['Current Amount']) - num(a.fields['Current Amount'])).map(r => (
                  <tr key={r.id}>
                    <td style={{ fontWeight: 600 }}>{r.fields['Person or Entity']}</td>
                    <td>{r.fields.Type && <Chip>{r.fields.Type}</Chip>}</td>
                    <td className="num" style={{ fontWeight: 700 }}>{formatCurrency(r.fields['Current Amount'])}</td>
                    <td className="num fin-muted">{formatCurrency(r.fields['Previous Amount'])}</td>
                    <td><Delta current={r.fields['Current Amount']} previous={r.fields['Previous Amount']} /></td>
                    <td className="wrap">{r.fields.Notes}</td>
                    <td><button className="fin-btn sm" onClick={() => owedEditor.open(r)}>Edit</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </div>

      {selected && (
        <AccountPanel
          record={selected}
          onClose={() => setSelectedId(null)}
          onEdit={() => accountEditor.open(selected)}
          onToggleActive={v => toggle(selected, 'Active', v)}
          toggling={pending === selected.id}
        />
      )}
      {accountEditor.modal}
      {owedEditor.modal}
    </div>
  );
}

function AccountPanel({ record, onClose, onEdit, onToggleActive, toggling }) {
  const f = record.fields;
  const target = targetOf(f);
  const low = isBelowMin(f);
  const holdback = !countsTowardNetWorth(record);
  const { diff } = delta(f['Current Balance'], f['Previous Balance']);
  return (
    <SidePanel
      title={f['Account Name'] || 'Untitled'}
      subtitle={[f.Institution, f.Owner].filter(Boolean).join(' · ') || null}
      onClose={onClose}
      footer={<button className="fin-btn primary" onClick={onEdit}>Edit</button>}
    >
      <PanelSection>
        <div className="fin-card-chips">
          {f.Type && <Chip color="#00D4FF">{f.Type}</Chip>}
          {f.Owner && <Chip>{f.Owner}</Chip>}
          {holdback && <Chip color="#FFD60A">Tax Holdback</Chip>}
        </div>
      </PanelSection>
      <PanelSection label="Current Balance">
        <div className="fin-balance" style={low ? { color: 'var(--orange)' } : undefined}>{formatCurrency(f['Current Balance'])}</div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'baseline' }}>
          <span className="fin-prev">Prev {formatCurrency(f['Previous Balance'])}</span>
          <Delta current={f['Current Balance']} previous={f['Previous Balance']} />
        </div>
        {low && <AlertBadge level="orange">Below minimum by {formatCurrency(target.amount - num(f['Current Balance']))}</AlertBadge>}
      </PanelSection>
      <PanelSection label="Balance History">
        <PanelRow label="Previous">{formatCurrency(f['Previous Balance'])}</PanelRow>
        <PanelRow label="Current">{formatCurrency(f['Current Balance'])}</PanelRow>
        <PanelRow label="Change"><span style={{ color: diff > 0 ? 'var(--positive)' : diff < 0 ? 'var(--negative)' : undefined }}>{diff > 0 ? '+' : diff < 0 ? '−' : ''}{formatCurrency(Math.abs(diff))}</span></PanelRow>
        <span className="fin-hint">Only the previous balance is stored for each account.</span>
      </PanelSection>
      <PanelSection label="Target">
        <PanelRow label="Amount">{target ? formatCurrency(target.amount) : '—'}</PanelRow>
        <PanelRow label="Type">{f['Target Type'] || '—'}</PanelRow>
      </PanelSection>
      {f.Notes && (
        <PanelSection label="Notes">
          <div className="fin-notes">{f.Notes}</div>
        </PanelSection>
      )}
      <PanelSection>
        <div className="fin-panel-row" style={{ alignItems: 'center' }}>
          <span>{isActive(record) ? 'Active' : 'Inactive'}</span>
          <Switch on={isActive(record)} onChange={onToggleActive} disabled={toggling} />
        </div>
        {holdback && <span className="fin-hint">Excluded from Cash and Net Worth (tax holdback).</span>}
      </PanelSection>
    </SidePanel>
  );
}

/* ================= Bonuses ================= */

const BUSINESS = 'Business';

function bonusRowState(f) {
  if (f['Closed Date']) return 'closed';
  if (f['Date Completed']) return 'completed';
  const days = daysUntil(f['Date to Complete']);
  if (days != null && days < 0) return 'overdue';
  if (days != null && days <= 30) return 'due-soon';
  return 'active';
}

const ROW_CLASS = { closed: 'row-muted', completed: 'row-green', overdue: 'row-red', 'due-soon': 'row-yellow', active: '' };
const STATE_ORDER = { overdue: 0, 'due-soon': 1, active: 2, completed: 3, closed: 4 };

function BonusesView() {
  const { data, loading, error, reload } = useTables([T.BANK_BONUSES]);
  const [filter, setFilter] = useState(ALL);
  const bonuses = data[T.BANK_BONUSES];

  const owners = distinct(bonuses, 'Owner');
  const hasBusiness = bonuses.some(r => r.fields['Business or Personal'] === BUSINESS);
  const pillOptions = [...owners.filter(o => o !== BUSINESS), ...(hasBusiness || owners.includes(BUSINESS) ? [BUSINESS] : [])];

  const editor = useRecordEditor({ table: T.BANK_BONUSES, noun: 'Bank Bonus', reload, suggestions: { Owner: owners } });

  const rows = bonuses
    .filter(r => {
      if (filter === ALL) return true;
      if (filter === BUSINESS) return r.fields['Business or Personal'] === BUSINESS || r.fields.Owner === BUSINESS;
      return r.fields.Owner === filter;
    })
    .map(r => ({ r, state: bonusRowState(r.fields) }))
    .sort((a, b) => (STATE_ORDER[a.state] - STATE_ORDER[b.state])
      || String(a.r.fields['Date to Complete'] || '9999').localeCompare(String(b.r.fields['Date to Complete'] || '9999')));

  const open = rows.filter(x => x.state !== 'closed' && x.state !== 'completed');
  const pendingBonus = open.reduce((s, x) => s + num(x.r.fields['Bonus Amount']), 0);
  const earned = rows.filter(x => x.r.fields['Date Completed']).reduce((s, x) => s + num(x.r.fields['Bonus Amount']), 0);
  const closable = rows.filter(x => x.state !== 'closed' && daysUntil(x.r.fields['Can Close Date']) != null && daysUntil(x.r.fields['Can Close Date']) <= 0).length;

  return (
    <div>
      <ErrorBanner error={error} />
      <div className="fin-toolbar">
        <PillFilter options={pillOptions} value={filter} onChange={setFilter} />
        <button className="fin-btn primary" onClick={() => editor.open(null, filter !== ALL && filter !== BUSINESS ? { Owner: filter } : filter === BUSINESS ? { 'Business or Personal': BUSINESS } : null)}>+ Add Bonus</button>
      </div>

      {loading ? <SkeletonStats count={3} /> : (
        <div className="fin-stats">
          <StatCard label="In Progress" value={open.length} accent="var(--warning)" sub={`${formatCurrency(pendingBonus)} pending`} />
          <StatCard label="Bonuses Earned" value={formatCurrency(earned)} accent="var(--positive)" />
          <StatCard label="Ready to Close" value={closable} accent="var(--accent)" />
        </div>
      )}

      {loading ? <SkeletonTable rows={8} /> : rows.length === 0 ? (
        <EmptyState icon="🎁" message={bonuses.length ? 'No bonuses match this filter.' : 'No bank bonuses tracked yet.'}
          actionLabel="Add bonus" onAction={() => editor.open()} />
      ) : (
        <div className="fin-table-wrap">
          <table className="fin-table">
            <thead>
              <tr>
                <th>Bank Name</th><th>Owner</th><th>B/P</th><th>Opened</th><th className="num">Bonus</th>
                <th className="num">New Money</th><th className="num">Direct Deposit</th><th>Complete By</th>
                <th>Completed</th><th>Min Balance</th><th>Can Close</th><th>Closed</th><th>Notes</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ r, state }) => {
                const f = r.fields;
                const dueDays = daysUntil(f['Date to Complete']);
                const closeDays = daysUntil(f['Can Close Date']);
                return (
                  <tr key={r.id} className={`clickable ${ROW_CLASS[state]}`} onClick={() => editor.open(r)} title="Click to edit">
                    <td style={{ fontWeight: 600 }}>{f['Bank Name']}{f['Account Type'] && <span className="fin-faint"> · {f['Account Type']}</span>}</td>
                    <td>{f.Owner || '—'}</td>
                    <td>{f['Business or Personal'] ? <Chip color={f['Business or Personal'] === BUSINESS ? '#8B5CF6' : undefined}>{f['Business or Personal'][0]}</Chip> : '—'}</td>
                    <td>{formatShortDate(f['Opened Date'])}</td>
                    <td className="num" style={{ fontWeight: 700, color: state === 'closed' ? undefined : 'var(--positive)' }}>{formatCurrency(f['Bonus Amount'])}</td>
                    <td className="num">{f['New Money Needed'] != null ? formatCurrency(f['New Money Needed']) : '—'}</td>
                    <td className="num">{f['Direct Deposit Needed'] != null ? formatCurrency(f['Direct Deposit Needed']) : '—'}</td>
                    <td>
                      {formatShortDate(f['Date to Complete'])}
                      {(state === 'overdue' || state === 'due-soon') && (
                        <span style={{ marginLeft: 6 }}><AlertBadge level={state === 'overdue' ? 'danger' : 'warning'}>{daysText(dueDays)}</AlertBadge></span>
                      )}
                    </td>
                    <td>{f['Date Completed'] ? <span style={{ color: state === 'closed' ? undefined : 'var(--positive)' }}>✓ {formatShortDate(f['Date Completed'])}</span> : '—'}</td>
                    <td>{f['Minimum Balance'] || '—'}</td>
                    <td>
                      {formatShortDate(f['Can Close Date'])}
                      {state !== 'closed' && closeDays != null && closeDays <= 30 && (
                        <span style={{ marginLeft: 6 }}><AlertBadge level={closeDays <= 0 ? 'ok' : 'info'}>{closeDays <= 0 ? 'now' : `${closeDays}d`}</AlertBadge></span>
                      )}
                    </td>
                    <td>{formatShortDate(f['Closed Date'])}</td>
                    <td className="wrap">{f.Notes}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <div className="fin-faint" style={{ fontSize: '0.72rem', marginTop: 8 }}>
        Rows: <span style={{ color: 'var(--negative)' }}>red</span> overdue · <span style={{ color: 'var(--warning)' }}>yellow</span> due within 30 days · <span style={{ color: 'var(--positive)' }}>green</span> completed · gray closed. Click a row to edit.
      </div>
      {editor.modal}
    </div>
  );
}
