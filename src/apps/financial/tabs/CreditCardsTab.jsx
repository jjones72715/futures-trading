import { useState } from 'react';
import { useTables } from '../hooks/useTables.js';
import { T, CHOICES } from '../config/airtable.js';
import PillFilter, { ALL } from '../components/PillFilter.jsx';
import SectionHeader from '../components/SectionHeader.jsx';
import BalanceCard from '../components/BalanceCard.jsx';
import StatCard from '../components/StatCard.jsx';
import AlertBadge, { levelColor } from '../components/AlertBadge.jsx';
import { useRecordEditor } from '../components/Modal.jsx';
import {
  Chip, Delta, EmptyState, ErrorBanner, SkeletonGrid, SkeletonStats, Subtabs,
} from '../components/ui.jsx';
import { formatCurrency, formatDate, daysUntil, distinct, sumField, num } from '../utils/formatters.js';

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

function BalancesView() {
  const { data, loading, error, reload } = useTables([T.CREDIT_CARD_LOGINS]);
  const [owner, setOwner] = useState(ALL);
  const logins = data[T.CREDIT_CARD_LOGINS];
  const owners = distinct(logins, 'Owner');
  const editor = useRecordEditor({ table: T.CREDIT_CARD_LOGINS, noun: 'Credit Card Login', reload, suggestions: { Owner: owners } });

  const filtered = logins.filter(r => owner === ALL || r.fields.Owner === owner);

  // Group by issuer, following the Airtable choice order, then any unexpected values.
  const issuers = [...CHOICES.ISSUER, ...distinct(filtered, 'Issuer').filter(i => !CHOICES.ISSUER.includes(i))];
  const groups = issuers
    .map(issuer => ({ issuer, items: filtered.filter(r => (r.fields.Issuer || 'Other') === issuer) }))
    .filter(g => g.items.length);

  const total = sumField(filtered, 'Current Balance');
  const prevTotal = sumField(filtered, 'Previous Balance');
  const perOwner = owners.map(o => ({ owner: o, total: sumField(logins.filter(r => r.fields.Owner === o), 'Current Balance') }));

  return (
    <div>
      <ErrorBanner error={error} />
      <div className="fin-toolbar">
        <PillFilter options={owners} value={owner} onChange={setOwner} />
        <button className="fin-btn primary" onClick={() => editor.open(null, owner !== ALL ? { Owner: owner } : null)}>+ Add Login</button>
      </div>

      {loading ? <SkeletonStats count={3} /> : (
        <div className="fin-stats">
          <StatCard label={`Total Balance${owner !== ALL ? ` — ${owner}` : ''}`} value={formatCurrency(total)}
            accent={total > 0 ? 'var(--negative)' : 'var(--text)'} sub={<Delta current={total} previous={prevTotal} invert />} />
          {perOwner.map(p => (
            <StatCard key={p.owner} label={p.owner} value={formatCurrency(p.total)} accent="var(--text)" />
          ))}
        </div>
      )}

      {loading ? <SkeletonGrid count={6} /> : groups.length === 0 ? (
        <EmptyState icon="💳" message={logins.length ? 'No logins match this filter.' : 'No credit card logins yet.'}
          actionLabel="Add login" onAction={() => editor.open()} />
      ) : groups.map(g => (
        <div key={g.issuer} className="fin-section">
          <SectionHeader title={g.issuer} count={g.items.length}
            right={<span className="fin-muted" style={{ fontSize: '0.85rem', fontWeight: 600 }}>{formatCurrency(sumField(g.items, 'Current Balance'))}</span>} />
          <div className="fin-grid">
            {[...g.items].sort((a, b) => num(b.fields['Current Balance']) - num(a.fields['Current Balance'])).map(r => {
              const f = r.fields;
              return (
                <BalanceCard
                  key={r.id}
                  title={f['Login Label'] || 'Untitled'}
                  chips={<>
                    {f.Issuer && <Chip color="#00D4FF">{f.Issuer}</Chip>}
                    {f.Owner && <Chip>{f.Owner}</Chip>}
                    {f.Relationship && <Chip color={f.Relationship === 'Authorized User' ? '#8B5CF6' : undefined}>{f.Relationship}</Chip>}
                  </>}
                  current={f['Current Balance']}
                  previous={f['Previous Balance']}
                  invert
                  balanceColor={num(f['Current Balance']) > 0 ? 'var(--negative)' : undefined}
                  notes={f.Notes}
                  onEdit={() => editor.open(r)}
                />
              );
            })}
          </div>
        </div>
      ))}
      {editor.modal}
    </div>
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
  const transfers = data[T.BALANCE_TRANSFERS];
  const editor = useRecordEditor({ table: T.BALANCE_TRANSFERS, noun: 'Balance Transfer', reload });

  const withDays = transfers.map(r => ({ r, days: daysUntil(r.fields['End Date']) }));
  const paidCount = withDays.filter(x => x.r.fields.Status === 'Paid Off').length;
  const visible = withDays
    .filter(x => showPaid || x.r.fields.Status !== 'Paid Off')
    .sort((a, b) => (a.days ?? 99999) - (b.days ?? 99999));

  const alerts = withDays.filter(x => x.r.fields.Status !== 'Paid Off' && x.days != null && x.days <= 60)
    .sort((a, b) => a.days - b.days);
  const anyExpired = alerts.some(x => x.days < 0);
  const bannerColor = anyExpired ? levelColor('danger') : levelColor('warning');

  const open = withDays.filter(x => x.r.fields.Status !== 'Paid Off');
  const totalOpen = sumField(open.map(x => x.r), 'Current Balance');

  return (
    <div>
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
              <div key={r.id} className={`fin-card${paid ? ' inactive' : ''}`} style={expired ? { borderColor: `${color}66` } : undefined}>
                <div className="fin-card-top">
                  <div className="fin-card-title">{f['Card Name'] || 'Untitled'}</div>
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
                <div className="fin-card-actions">
                  <button className="fin-btn sm" onClick={() => editor.open(r)}>Edit</button>
                </div>
              </div>
            );
          })}
        </div>
      )}
      {editor.modal}
    </div>
  );
}
