import { useState } from 'react';
import { useTables } from '../hooks/useTables.js';
import { T, CHOICES } from '../config/airtable.js';
import PillFilter, { ALL } from '../components/PillFilter.jsx';
import SummaryStrip from '../components/SummaryStrip.jsx';
import { PanelSection, PanelRow } from '../components/SidePanel.jsx';
import BalanceUpdatePanel, { PanelNotes } from '../components/BalanceUpdatePanel.jsx';
import { StatusDot } from '../components/Status.jsx';
import { useRecordStatus, staleFirst } from '../hooks/useCycle.jsx';
import { useSort, sortRows, SortTh, SearchInput, matchesQuery } from '../components/SortableTable.jsx';
import AlertBadge, { levelColor } from '../components/AlertBadge.jsx';
import { useRecordEditor } from '../components/Modal.jsx';
import {
  Chip, Delta, MiniDelta, EmptyState, ErrorBanner, SkeletonGrid, SkeletonTable, Subtabs,
} from '../components/ui.jsx';
import {
  formatCurrency, formatDate, formatShortDate, daysUntil, distinct, sumField, num, } from '../utils/formatters.js';

const SUBTABS = [{ id: 'balances', label: 'Balances' }, { id: 'transfers', label: 'Transfers' }];

export default function CreditCardsTab({ subtab, onSubtab }) {
  return (
    <div>
      <Subtabs tabs={SUBTABS} value={subtab} onChange={onSubtab} />
      {subtab === 'transfers' ? <TransfersView /> : <BalancesView />}
    </div>
  );
}

/* ================= Balances ================= */

// Due Date / Autopay aren't in the Credit Card Logins table today; the columns appear
// automatically if records ever carry them.
const DUE_FIELD = 'Due Date';
const AUTOPAY_FIELDS = ['Autopay', 'Auto Pay'];
const autopayOf = (f) => {
  const key = AUTOPAY_FIELDS.find(k => f[k] != null);
  return key ? f[key] : null;
};
const relLabel = (rel) => (rel === 'Authorized User' ? 'AU' : rel);

const LOGIN_SORT = {
  name: r => r.fields['Login Label'] || '',
  owner: r => r.fields.Owner || '',
  issuer: r => r.fields.Issuer || '',
  relationship: r => r.fields.Relationship || '',
  balance: r => num(r.fields['Current Balance']),
  due: r => r.fields[DUE_FIELD] ?? null,
  autopay: r => (autopayOf(r.fields) == null ? null : autopayOf(r.fields) ? 1 : 0),
};

function BalancesView() {
  const { data, loading, error, reload } = useTables([T.CREDIT_CARD_LOGINS]);
  const [owner, setOwner] = useState(ALL);
  const [query, setQuery] = useState('');
  const [openOverride, setOpenOverride] = useState({});
  const [selectedId, setSelectedId] = useState(null);
  const { sort, onSort } = useSort('balance', 'desc');

  const logins = data[T.CREDIT_CARD_LOGINS];
  const owners = distinct(logins, 'Owner');
  const selected = logins.find(r => r.id === selectedId) || null;
  const editor = useRecordEditor({ table: T.CREDIT_CARD_LOGINS, noun: 'Credit Card Login', reload, suggestions: { Owner: owners } });

  const hasDue = logins.some(r => r.fields[DUE_FIELD] != null);
  const hasAutopay = logins.some(r => autopayOf(r.fields) != null);
  const colCount = 6 + (hasDue ? 1 : 0) + (hasAutopay ? 1 : 0);
  const statusOf = useRecordStatus();

  // Needs Update rows first; the chosen column sort applies within each status group.
  const rows = staleFirst(sortRows(
    logins
      .filter(r => owner === ALL || r.fields.Owner === owner)
      .filter(r => matchesQuery(query, [r.fields['Login Label'], r.fields.Owner, r.fields.Issuer, r.fields.Relationship, relLabel(r.fields.Relationship), r.fields.Notes])),
    LOGIN_SORT, sort,
  ), statusOf);

  // Issuer groups in Airtable choice order. Issuers with a single card (across all logins)
  // start collapsed; everything expands while an owner filter or search is narrowing the list.
  const issuerOf = (r) => r.fields.Issuer || 'Other';
  const issuers = [...CHOICES.ISSUER, ...distinct(rows, 'Issuer').filter(i => !CHOICES.ISSUER.includes(i))];
  const groups = issuers
    .map(issuer => ({ issuer, items: rows.filter(r => issuerOf(r) === issuer), total: logins.filter(r => issuerOf(r) === issuer).length }))
    .filter(g => g.items.length);
  const filtering = !!query.trim() || owner !== ALL;
  const isOpen = (g) => openOverride[g.issuer] ?? (filtering || g.total >= 2);

  // Summary strip: totals by owner across all logins.
  const total = sumField(logins, 'Current Balance');
  const prevTotal = sumField(logins, 'Previous Balance');
  const perOwner = owners.map(o => ({ owner: o, total: sumField(logins.filter(r => r.fields.Owner === o), 'Current Balance') }));

  function renderRow(r) {
    const f = r.fields;
    const bal = num(f['Current Balance']);
    const autopay = autopayOf(f);
    return (
      <tr key={r.id} className={`row${r.id === selectedId ? ' selected' : ''}`} onClick={() => setSelectedId(r.id)}>
        <td className="status-col"><StatusDot status={statusOf(r)} /></td>
        <td className="cell-name">{f['Login Label'] || 'Untitled'}</td>
        <td>{f.Owner || <span className="fin-faint">—</span>}</td>
        <td>{f.Issuer || <span className="fin-faint">—</span>}</td>
        <td>{f.Relationship ? <Chip color={f.Relationship === 'Authorized User' ? '#8B5CF6' : undefined}>{relLabel(f.Relationship)}</Chip> : <span className="fin-faint">—</span>}</td>
        <td className="num">
          <MiniDelta current={f['Current Balance']} previous={f['Previous Balance']} invert />
          {bal === 0
            ? <span className="fin-faint">—</span>
            : <span style={{ fontWeight: 700, color: bal > 0 ? 'var(--negative)' : undefined }}>{formatCurrency(bal)}</span>}
        </td>
        {hasDue && <td>{f[DUE_FIELD] ? formatShortDate(f[DUE_FIELD]) : <span className="fin-faint">—</span>}</td>}
        {hasAutopay && <td>{autopay == null ? <span className="fin-faint">—</span> : autopay ? '✓' : <span className="fin-faint">No</span>}</td>}
      </tr>
    );
  }

  return (
    <div className={selected ? 'fin-has-panel' : undefined}>
      <ErrorBanner error={error} />
      <SummaryStrip loading={loading} items={[
        { label: 'Total Balance', value: formatCurrency(total), color: total > 0 ? 'var(--negative)' : undefined,
          sub: <Delta current={total} previous={prevTotal} invert /> },
        ...perOwner.map(p => ({ label: p.owner, value: formatCurrency(p.total), color: p.total > 0 ? 'var(--text)' : 'var(--text-muted)' })),
      ]} />

      <div className="fin-controls">
        <PillFilter options={owners} value={owner} onChange={setOwner} />
        <div className="fin-controls-right">
          <SearchInput value={query} onChange={setQuery} placeholder="Search cards…" />
          <button className="fin-btn primary sm" onClick={() => editor.open(null, owner !== ALL ? { Owner: owner } : null)}>+ Add Login</button>
        </div>
      </div>

      {loading ? <SkeletonTable rows={10} /> : groups.length === 0 ? (
        <EmptyState icon="💳" message={logins.length ? 'No logins match these filters.' : 'No credit card logins yet.'}
          actionLabel="Add login" onAction={() => editor.open()} />
      ) : (
        <div className="fin-table-wrap scroll">
          <table className="fin-table compact">
            <thead>
              <tr>
                <th className="status-col">Up to Date</th>
                <SortTh label="Card Name" k="name" sort={sort} onSort={onSort} />
                <SortTh label="Owner" k="owner" sort={sort} onSort={onSort} />
                <SortTh label="Issuer" k="issuer" sort={sort} onSort={onSort} />
                <SortTh label="Relationship" k="relationship" sort={sort} onSort={onSort} />
                <SortTh label="Balance" k="balance" sort={sort} onSort={onSort} numeric />
                {hasDue && <SortTh label="Due Date" k="due" sort={sort} onSort={onSort} />}
                {hasAutopay && <SortTh label="Autopay" k="autopay" sort={sort} onSort={onSort} numeric />}
              </tr>
            </thead>
            <tbody>
              {groups.map(g => {
                const open = isOpen(g);
                const subtotal = sumField(g.items, 'Current Balance');
                return [
                  <tr key={`g-${g.issuer}`} className="group-row" onClick={() => setOpenOverride(o => ({ ...o, [g.issuer]: !open }))}>
                    <td colSpan={colCount}>
                      <span className={`fin-sh-caret${open ? '' : ' closed'}`} style={{ marginRight: 8 }}>▼</span>
                      {g.issuer}
                      <span style={{ marginLeft: 10, color: subtotal > 0 ? 'var(--negative)' : 'var(--text-muted)' }}>{formatCurrency(subtotal)}</span>
                      <span className="fin-faint" style={{ fontWeight: 400, marginLeft: 8 }}>({g.items.length}{g.items.length !== g.total ? ` of ${g.total}` : ''} card{g.total === 1 ? '' : 's'})</span>
                    </td>
                  </tr>,
                  ...(open ? g.items.map(renderRow) : []),
                ];
              })}
            </tbody>
          </table>
        </div>
      )}
      {!loading && rows.length > 0 && (
        <div className="fin-faint" style={{ fontSize: '0.72rem', marginTop: 6 }}>
          {rows.length} login{rows.length === 1 ? '' : 's'} · click an issuer to expand or collapse · click a row for details
        </div>
      )}

      {selected && <LoginPanel record={selected} reload={reload} onClose={() => setSelectedId(null)} onEdit={() => editor.open(selected)} />}
      {editor.modal}
    </div>
  );
}

function LoginPanel({ record, reload, onClose, onEdit }) {
  const f = record.fields;
  const autopay = autopayOf(f);
  return (
    <BalanceUpdatePanel
      table={T.CREDIT_CARD_LOGINS}
      record={record}
      reload={reload}
      onClose={onClose}
      onEdit={onEdit}
      invert
      title={f['Login Label'] || 'Untitled'}
      subtitle={[f.Issuer, f.Owner].filter(Boolean).join(' · ') || null}
      chips={<>
        {f.Issuer && <Chip color="#00D4FF">{f.Issuer}</Chip>}
        {f.Owner && <Chip>{f.Owner}</Chip>}
        {f.Relationship && <Chip color={f.Relationship === 'Authorized User' ? '#8B5CF6' : undefined}>{f.Relationship}</Chip>}
      </>}
    >
      {(f[DUE_FIELD] != null || autopay != null) && (
        <PanelSection label="Payment">
          {f[DUE_FIELD] != null && <PanelRow label="Due date">{formatDate(f[DUE_FIELD])}</PanelRow>}
          {autopay != null && <PanelRow label="Autopay">{autopay ? 'On' : 'Off'}</PanelRow>}
        </PanelSection>
      )}
      <PanelNotes notes={f.Notes} />
    </BalanceUpdatePanel>
  );
}

/* ================= Transfers ================= */

function transferLevel(days) {
  if (days == null) return 'muted';
  if (days < 0) return 'danger';
  if (days < 60) return 'orange';
  if (days <= 90) return 'warning';
  return 'ok';
}

function statusColor(s) {
  return s === 'Paid Off' ? '#00E676' : s === 'Expired' ? '#FF4D4D' : '#00D4FF';
}

function TransfersView() {
  const { data, loading, error, reload } = useTables([T.BALANCE_TRANSFERS]);
  const [showPaid, setShowPaid] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const statusOf = useRecordStatus();
  const transfers = data[T.BALANCE_TRANSFERS];
  const selected = transfers.find(r => r.id === selectedId) || null;
  const editor = useRecordEditor({ table: T.BALANCE_TRANSFERS, noun: 'Balance Transfer', reload });

  const withDays = transfers.map(r => ({ r, days: daysUntil(r.fields['End Date']) }));
  const paidCount = withDays.filter(x => x.r.fields.Status === 'Paid Off').length;
  // Needs Update cards first; soonest end date first within each status group.
  const visible = staleFirst(withDays
    .filter(x => showPaid || x.r.fields.Status !== 'Paid Off')
    .sort((a, b) => (a.days ?? 99999) - (b.days ?? 99999)), x => statusOf(x.r));

  const alerts = withDays.filter(x => x.r.fields.Status !== 'Paid Off' && x.days != null && x.days <= 60)
    .sort((a, b) => a.days - b.days);
  const anyExpired = alerts.some(x => x.days < 0);
  const bannerColor = anyExpired ? levelColor('danger') : levelColor('warning');

  const open = withDays.filter(x => x.r.fields.Status !== 'Paid Off');
  const totalOpen = sumField(open.map(x => x.r), 'Current Balance');

  return (
    <div className={selected ? 'fin-has-panel' : undefined}>
      <ErrorBanner error={error} />
      {!loading && alerts.length > 0 && (
        <div className="fin-banner" style={{ background: `${bannerColor}14`, border: `1px solid ${bannerColor}66` }}>
          <div style={{ fontWeight: 700, color: bannerColor }}>
            ⚠ {alerts.length} balance transfer{alerts.length > 1 ? 's' : ''} {anyExpired ? 'expired or ' : ''}ending within 60 days
          </div>
          {alerts.map(({ r, days }) => (
            <div key={r.id} style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <strong>{r.fields['Card Name']}</strong>
              <span className="fin-muted">{formatCurrency(r.fields['Current Balance'])} · ends {formatDate(r.fields['End Date'])}</span>
              <span style={{ color: days < 0 ? levelColor('danger') : levelColor('orange'), fontWeight: 600 }}>
                {days < 0 ? `expired ${Math.abs(days)} days ago` : days === 0 ? 'ends today' : `${days} days left`}
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="fin-toolbar">
        <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
          {!loading && <span className="fin-muted" style={{ fontSize: '0.85rem' }}>{open.length} open · <strong style={{ color: 'var(--text)' }}>{formatCurrency(totalOpen)}</strong> remaining</span>}
          {paidCount > 0 && (
            <label className="fin-link" style={{ cursor: 'pointer' }}>
              <input type="checkbox" className="fin-inline-check" checked={showPaid} onChange={e => setShowPaid(e.target.checked)} />
              Show paid off ({paidCount})
            </label>
          )}
        </div>
        <button className="fin-btn primary" onClick={() => editor.open()}>+ Add Transfer</button>
      </div>

      {loading ? <SkeletonGrid count={4} /> : visible.length === 0 ? (
        <EmptyState icon="🔁" message={transfers.length ? 'All balance transfers are paid off.' : 'No balance transfers tracked yet.'}
          actionLabel="Add transfer" onAction={() => editor.open()} />
      ) : (
        <div className="fin-grid">
          {visible.map(({ r, days }) => {
            const f = r.fields;
            const paid = f.Status === 'Paid Off';
            const level = paid ? 'muted' : transferLevel(days);
            const color = levelColor(level);
            const expired = !paid && days != null && days < 0;
            return (
              <div key={r.id} className={`fin-card clickable${paid ? ' inactive' : ''}${r.id === selectedId ? ' selected' : ''}`}
                style={expired && r.id !== selectedId ? { borderColor: `${color}66` } : undefined}
                onClick={() => setSelectedId(r.id)}>
                <div className="fin-card-top">
                  <div className="fin-card-title-row">
                    <StatusDot status={statusOf(r)} />
                    <div className="fin-card-title">{f['Card Name'] || 'Untitled'}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {expired && <AlertBadge level="danger">EXPIRED</AlertBadge>}
                    {f.Status && !(expired && f.Status === 'Active') && <Chip color={statusColor(f.Status)}>{f.Status}</Chip>}
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div>
                    <div className="fin-mini-label">Current Balance</div>
                    <div className="fin-balance" style={{ fontSize: '1.4rem' }}>{formatCurrency(f['Current Balance'])}</div>
                    <Delta current={f['Current Balance']} previous={f['Amount Transferred']} invert />
                  </div>
                  <div>
                    <div className="fin-mini-label">Transferred</div>
                    <div style={{ fontSize: '1rem', fontWeight: 600, marginTop: 4 }} className="fin-muted">{formatCurrency(f['Amount Transferred'])}</div>
                  </div>
                </div>
                <div style={{ background: `${color}14`, border: `1px solid ${color}44`, borderRadius: 10, padding: '0.6rem 0.8rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                  <div>
                    <div className="fin-mini-label">End Date</div>
                    <div style={{ fontWeight: 700, fontSize: '1rem' }}>{formatDate(f['End Date'])}</div>
                  </div>
                  <div style={{ color, fontWeight: 800, fontSize: days != null && days >= 0 ? '1.3rem' : '0.9rem', textAlign: 'right' }}>
                    {days == null ? '—' : paid ? 'Paid' : days < 0 ? `${Math.abs(days)}d ago` : `${days}d`}
                    {days != null && days >= 0 && !paid && <div style={{ fontSize: '0.65rem', fontWeight: 600, opacity: 0.8 }}>remaining</div>}
                  </div>
                </div>
                {f.Notes && <div className="fin-notes">{f.Notes}</div>}
                <div className="fin-card-actions" onClick={e => e.stopPropagation()}>
                  <button className="fin-btn sm" onClick={() => editor.open(r)}>Edit</button>
                </div>
              </div>
            );
          })}
        </div>
      )}
      {selected && (
        <BalanceUpdatePanel
          table={T.BALANCE_TRANSFERS}
          record={selected}
          reload={reload}
          onClose={() => setSelectedId(null)}
          onEdit={() => editor.open(selected)}
          invert
          title={selected.fields['Card Name'] || 'Untitled'}
          subtitle={selected.fields['End Date'] ? `Ends ${formatDate(selected.fields['End Date'])}` : null}
          chips={selected.fields.Status && <Chip color={statusColor(selected.fields.Status)}>{selected.fields.Status}</Chip>}
          historyRows={<PanelRow label="Amount Transferred">{formatCurrency(selected.fields['Amount Transferred'])}</PanelRow>}
        >
          <PanelNotes notes={selected.fields.Notes} />
        </BalanceUpdatePanel>
      )}
      {editor.modal}
    </div>
  );
}
