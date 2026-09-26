import { useState } from 'react';
import { useTables, useFieldToggle } from '../hooks/useTables.js';
import { T } from '../config/airtable.js';
import PillFilter, { ALL } from '../components/PillFilter.jsx';
import SectionHeader from '../components/SectionHeader.jsx';
import BalanceCard from '../components/BalanceCard.jsx';
import StatCard from '../components/StatCard.jsx';
import AlertBadge, { daysText } from '../components/AlertBadge.jsx';
import { useRecordEditor } from '../components/Modal.jsx';
import {
  Chip, Delta, EmptyState, ErrorBanner, SkeletonGrid, SkeletonStats, SkeletonTable, ShowInactiveToggle, Subtabs,
} from '../components/ui.jsx';
import {
  formatCurrency, formatShortDate, daysUntil, distinct, isActive, sumField, num,
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

function targetText(f) {
  if (f['Target Amount'] == null || f['Target Type'] === 'None') return null;
  const prefix = f['Target Type'] === 'Savings Goal' ? 'Goal' : f['Target Type'] === 'Minimum Balance' ? 'Min' : 'Target';
  return `${prefix}: ${formatCurrency(f['Target Amount'])}`;
}

function AccountsView() {
  const { data, loading, error, reload } = useTables([T.BANKING_ACCOUNTS, T.OWED_TO_ME]);
  const [owner, setOwner] = useState(ALL);
  const [showInactive, setShowInactive] = useState(false);
  const [openAccounts, setOpenAccounts] = useState(true);
  const [openOwed, setOpenOwed] = useState(true);

  const accounts = data[T.BANKING_ACCOUNTS];
  const owed = data[T.OWED_TO_ME];
  const owners = distinct(accounts, 'Owner');

  const accountEditor = useRecordEditor({ table: T.BANKING_ACCOUNTS, noun: 'Bank Account', reload, suggestions: { Owner: owners } });
  const owedEditor = useRecordEditor({ table: T.OWED_TO_ME, noun: 'Owed to Me', reload });
  const { toggle, pending, error: toggleError } = useFieldToggle(T.BANKING_ACCOUNTS, reload);

  const byOwner = accounts.filter(r => owner === ALL || r.fields.Owner === owner);
  const inactiveCount = byOwner.filter(r => !isActive(r)).length;
  const visible = byOwner
    .filter(r => showInactive || isActive(r))
    .sort((a, b) => (isActive(b) - isActive(a)) || num(b.fields['Current Balance']) - num(a.fields['Current Balance']));

  const activeFiltered = byOwner.filter(isActive);
  const totalCash = sumField(activeFiltered, 'Current Balance');
  const prevCash = sumField(activeFiltered, 'Previous Balance');
  const owedTotal = sumField(owed, 'Current Amount');

  return (
    <div>
      <ErrorBanner error={error || toggleError} />
      <div className="fin-toolbar">
        <PillFilter options={owners} value={owner} onChange={setOwner} />
      </div>

      {loading ? <SkeletonStats count={3} /> : (
        <div className="fin-stats">
          <StatCard label={`Cash${owner !== ALL ? ` — ${owner}` : ''}`} value={formatCurrency(totalCash)} accent="var(--positive)"
            sub={<Delta current={totalCash} previous={prevCash} />} />
          <StatCard label="Active Accounts" value={activeFiltered.length} accent="var(--text)" />
          <StatCard label="Owed to Me" value={formatCurrency(owedTotal)} accent="var(--warning)" />
        </div>
      )}

      <div className="fin-section">
        <SectionHeader
          title="Bank Accounts"
          count={loading ? null : visible.length}
          collapsed={!openAccounts}
          onToggle={() => setOpenAccounts(o => !o)}
          onAdd={() => accountEditor.open(null, owner !== ALL ? { Owner: owner } : null)}
          right={<ShowInactiveToggle value={showInactive} onChange={setShowInactive} count={inactiveCount} />}
        />
        {openAccounts && (loading ? <SkeletonGrid count={6} /> : visible.length === 0 ? (
          <EmptyState icon="🏦" message={accounts.length ? 'No accounts match this filter.' : 'No bank accounts yet.'}
            actionLabel="Add account" onAction={() => accountEditor.open()} />
        ) : (
          <div className="fin-grid">
            {visible.map(r => {
              const f = r.fields;
              const target = targetText(f);
              const belowMin = f['Target Type'] === 'Minimum Balance' && f['Target Amount'] != null && num(f['Current Balance']) < f['Target Amount'];
              return (
                <BalanceCard
                  key={r.id}
                  title={f['Account Name'] || 'Untitled'}
                  subtitle={f.Institution}
                  chips={<>
                    {f.Type && <Chip color="#00D4FF">{f.Type}</Chip>}
                    {f.Owner && <Chip>{f.Owner}</Chip>}
                  </>}
                  current={f['Current Balance']}
                  previous={f['Previous Balance']}
                  extra={target && (
                    <div style={{ fontSize: '0.78rem', display: 'flex', gap: 8, alignItems: 'center' }}>
                      <span className="fin-muted">{target}</span>
                      {belowMin && <AlertBadge level="danger">Below min</AlertBadge>}
                    </div>
                  )}
                  notes={f.Notes}
                  active={isActive(r)}
                  toggling={pending === r.id}
                  onToggleActive={v => toggle(r, 'Active', v)}
                  onEdit={() => accountEditor.open(r)}
                />
              );
            })}
          </div>
        ))}
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
            <table className="fin-table">
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

      {accountEditor.modal}
      {owedEditor.modal}
    </div>
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
