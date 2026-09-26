import { useState } from 'react';
import { useTables } from '../hooks/useTables.js';
import { T } from '../config/airtable.js';
import SectionHeader from '../components/SectionHeader.jsx';
import StatCard from '../components/StatCard.jsx';
import AlertBadge, { daysText } from '../components/AlertBadge.jsx';
import { useRecordEditor } from '../components/Modal.jsx';
import { deleteRecord } from '../services/financialService.js';
import {
  Chip, Delta, EmptyState, ErrorBanner, Skel, SkeletonGrid, SkeletonStats, SkeletonTable,
} from '../components/ui.jsx';
import { formatCurrency, formatDate, daysUntil, distinct, sumField, num } from '../utils/formatters.js';

const KEYS = [T.TRADING_PLATFORMS, T.TRADING_LIQUIDATION, T.SPECIAL_PROJECTS, T.PENDING_PAYOUTS];

const PROJECT_FIELDS = [
  ['This Month Earned', 'var(--positive)'],
  ['Last Month Earned', null],
  ['This Month Spent', 'var(--negative)'],
  ['Last Month Spent', null],
];

export default function TradingTab() {
  const { data, loading, error, reload } = useTables(KEYS);
  const [showClosed, setShowClosed] = useState(false);
  const [deleteError, setDeleteError] = useState(null);

  const platforms = data[T.TRADING_PLATFORMS];
  const liquidation = data[T.TRADING_LIQUIDATION][0];
  const projects = data[T.SPECIAL_PROJECTS];
  const payouts = data[T.PENDING_PAYOUTS];

  const platformEditor = useRecordEditor({ table: T.TRADING_PLATFORMS, noun: 'Platform', reload, suggestions: { Owner: distinct(platforms, 'Owner') } });
  const liquidationEditor = useRecordEditor({ table: T.TRADING_LIQUIDATION, noun: 'Liquidation Invested', reload, allowDelete: false });
  const projectEditor = useRecordEditor({ table: T.SPECIAL_PROJECTS, noun: 'Special Project', reload });
  const payoutEditor = useRecordEditor({ table: T.PENDING_PAYOUTS, noun: 'Pending Payout', reload });

  const platformTotal = sumField(platforms, 'Current Balance');
  const platformPrev = sumField(platforms, 'Previous Balance');
  const liqCurrent = num(liquidation?.fields['Current Balance']);
  const payoutTotal = sumField(payouts, 'Amount');

  const closedCount = projects.filter(p => p.fields.Status === 'Closed').length;
  const visibleProjects = projects
    .filter(p => showClosed || p.fields.Status !== 'Closed')
    .sort((a, b) => (a.fields.Status === 'Closed') - (b.fields.Status === 'Closed'));

  async function removePayout(r) {
    if (!window.confirm(`Delete pending payout from ${r.fields.Source || 'this source'}?`)) return;
    setDeleteError(null);
    try {
      await deleteRecord(T.PENDING_PAYOUTS, r.id);
      await reload();
    } catch (e) {
      setDeleteError(e.message);
    }
  }

  return (
    <div>
      <ErrorBanner error={error || deleteError} />

      {loading ? <SkeletonStats count={4} /> : (
        <div className="fin-stats">
          <StatCard label="Platform Balances" value={formatCurrency(platformTotal)} accent="var(--text)" />
          <StatCard label="Liquidation Invested" value={formatCurrency(liqCurrent)} accent="var(--text)" />
          <StatCard label="Pending Payouts" value={formatCurrency(payoutTotal)} accent="var(--warning)" />
          <StatCard label="Trading Total" value={formatCurrency(platformTotal + liqCurrent + payoutTotal)} accent="var(--accent)" />
        </div>
      )}

      {/* ---- Platform Balances ---- */}
      <div className="fin-section">
        <SectionHeader title="Platform Balances" count={loading ? null : platforms.length} onAdd={() => platformEditor.open()} />
        {loading ? <SkeletonTable rows={3} /> : platforms.length === 0 ? (
          <EmptyState icon="📊" message="No trading platforms yet." actionLabel="Add platform" onAction={() => platformEditor.open()} />
        ) : (
          <div className="fin-table-wrap">
            <table className="fin-table">
              <thead>
                <tr><th>Platform</th><th>Owner</th><th className="num">Current Balance</th><th className="num">Previous Balance</th><th>Delta</th><th /></tr>
              </thead>
              <tbody>
                {[...platforms].sort((a, b) => num(b.fields['Current Balance']) - num(a.fields['Current Balance'])).map(r => (
                  <tr key={r.id}>
                    <td style={{ fontWeight: 600 }}>
                      {r.fields['Platform Name']}
                      {r.fields.Notes && <div className="fin-faint" style={{ fontSize: '0.72rem', fontWeight: 400, whiteSpace: 'normal' }}>{r.fields.Notes}</div>}
                    </td>
                    <td>{r.fields.Owner ? <Chip>{r.fields.Owner}</Chip> : '—'}</td>
                    <td className="num" style={{ fontWeight: 700, fontSize: '0.95rem' }}>{formatCurrency(r.fields['Current Balance'])}</td>
                    <td className="num fin-muted">{formatCurrency(r.fields['Previous Balance'])}</td>
                    <td><Delta current={r.fields['Current Balance']} previous={r.fields['Previous Balance']} /></td>
                    <td><button className="fin-btn sm" onClick={() => platformEditor.open(r)}>Edit</button></td>
                  </tr>
                ))}
                <tr>
                  <td style={{ fontWeight: 700 }}>Total</td><td />
                  <td className="num" style={{ fontWeight: 800, color: 'var(--accent)' }}>{formatCurrency(platformTotal)}</td>
                  <td className="num fin-muted">{formatCurrency(platformPrev)}</td>
                  <td><Delta current={platformTotal} previous={platformPrev} /></td><td />
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ---- Liquidation Invested ---- */}
      <div className="fin-section">
        <SectionHeader title="Liquidation Invested" />
        {loading ? <div className="fin-card"><Skel w="30%" /><Skel w="45%" h={40} /><Skel w="35%" /></div> : !liquidation ? (
          <EmptyState icon="💧" message="Liquidation balance hasn’t been set up yet."
            actionLabel="Set balance" onAction={() => liquidationEditor.open()} />
        ) : (
          <div className="fin-card" style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
            <div>
              <div className="fin-mini-label">{liquidation.fields.Label || 'Liquidation Invested'}</div>
              <div style={{ fontSize: '2.6rem', fontWeight: 800, lineHeight: 1.1, marginTop: 4 }}>{formatCurrency(liquidation.fields['Current Balance'])}</div>
              <div style={{ display: 'flex', gap: 10, marginTop: 6, flexWrap: 'wrap' }}>
                <span className="fin-prev">Prev {formatCurrency(liquidation.fields['Previous Balance'])}</span>
                <Delta current={liquidation.fields['Current Balance']} previous={liquidation.fields['Previous Balance']} />
              </div>
              {liquidation.fields.Notes && <div className="fin-notes" style={{ marginTop: 8 }}>{liquidation.fields.Notes}</div>}
            </div>
            <button className="fin-btn" onClick={() => liquidationEditor.open(liquidation)}>Edit</button>
          </div>
        )}
      </div>

      {/* ---- Special Projects ---- */}
      <div className="fin-section">
        <SectionHeader
          title="Special Projects"
          count={loading ? null : visibleProjects.length}
          onAdd={() => projectEditor.open()}
          right={closedCount > 0 && (
            <label className="fin-link" style={{ cursor: 'pointer' }}>
              <input type="checkbox" className="fin-inline-check" checked={showClosed} onChange={e => setShowClosed(e.target.checked)} />
              Show closed ({closedCount})
            </label>
          )}
        />
        {loading ? <SkeletonGrid count={2} /> : visibleProjects.length === 0 ? (
          <EmptyState icon="🧪" message={projects.length ? 'All projects are closed.' : 'No special projects yet.'}
            actionLabel="Add project" onAction={() => projectEditor.open()} />
        ) : (
          <div className="fin-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))' }}>
            {visibleProjects.map(r => {
              const f = r.fields;
              const net = num(f['This Month Earned']) - num(f['This Month Spent']);
              return (
                <div key={r.id} className={`fin-card${f.Status === 'Closed' ? ' inactive' : ''}`}>
                  <div className="fin-card-top">
                    <div className="fin-card-title">{f['Project Name'] || 'Untitled'}</div>
                    {f.Status && <Chip color={f.Status === 'Active' ? '#00E676' : undefined}>{f.Status}</Chip>}
                  </div>
                  <div className="fin-mini-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
                    {PROJECT_FIELDS.map(([name, color]) => (
                      <div key={name} className="fin-mini">
                        <div className="fin-mini-label">{name}</div>
                        <div className="fin-mini-value" style={color ? { color } : { color: 'var(--text-muted)' }}>{formatCurrency(f[name])}</div>
                      </div>
                    ))}
                    <div className="fin-mini" style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div className="fin-mini-label">Available Balance</div>
                        <div className="fin-mini-value" style={{ fontSize: '1.3rem', color: 'var(--accent)' }}>{formatCurrency(f['Available Balance'])}</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div className="fin-mini-label">Net this month</div>
                        <div style={{ fontWeight: 700, color: net >= 0 ? 'var(--positive)' : 'var(--negative)' }}>{formatCurrency(net)}</div>
                      </div>
                    </div>
                  </div>
                  {f.Notes && <div className="fin-notes">{f.Notes}</div>}
                  <div className="fin-card-actions"><button className="fin-btn sm" onClick={() => projectEditor.open(r)}>Edit</button></div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ---- Pending Payouts ---- */}
      <div className="fin-section">
        <SectionHeader title="Pending Payouts" count={loading ? null : payouts.length} onAdd={() => payoutEditor.open()}
          right={!loading && payouts.length > 0 && <span style={{ fontWeight: 700 }}>{formatCurrency(payoutTotal)}</span>} />
        {loading ? <SkeletonTable rows={2} /> : payouts.length === 0 ? (
          <EmptyState icon="✓" message="All clear — no pending payouts." actionLabel="Add payout" onAction={() => payoutEditor.open()} />
        ) : (
          <div className="fin-table-wrap">
            <table className="fin-table">
              <thead><tr><th>Source</th><th className="num">Amount</th><th>Expected Date</th><th>Notes</th><th /></tr></thead>
              <tbody>
                {[...payouts].sort((a, b) => String(a.fields['Expected Date'] || '9999').localeCompare(String(b.fields['Expected Date'] || '9999'))).map(r => {
                  const days = daysUntil(r.fields['Expected Date']);
                  const late = days != null && days < 0;
                  return (
                    <tr key={r.id} className={late ? 'row-yellow' : ''}>
                      <td style={{ fontWeight: 600 }}>{r.fields.Source}</td>
                      <td className="num" style={{ fontWeight: 700 }}>{formatCurrency(r.fields.Amount)}</td>
                      <td>
                        {formatDate(r.fields['Expected Date'])}
                        {late && <span style={{ marginLeft: 6 }}><AlertBadge level="warning">{daysText(days)}</AlertBadge></span>}
                      </td>
                      <td className="wrap">{r.fields.Notes}</td>
                      <td style={{ display: 'flex', gap: 6 }}>
                        <button className="fin-btn sm" onClick={() => payoutEditor.open(r)}>Edit</button>
                        <button className="fin-btn sm danger" onClick={() => removePayout(r)}>Delete</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {platformEditor.modal}
      {liquidationEditor.modal}
      {projectEditor.modal}
      {payoutEditor.modal}
    </div>
  );
}
