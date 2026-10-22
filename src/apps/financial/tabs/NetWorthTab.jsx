import { useTables } from '../hooks/useTables.js';
import { T } from '../config/airtable.js';
import SectionHeader from '../components/SectionHeader.jsx';
import StatCard from '../components/StatCard.jsx';
import LineChart from '../components/LineChart.jsx';
import { useRecordEditor } from '../components/Modal.jsx';
import { Delta, EmptyState, ErrorBanner, Skel, SkeletonStats, SkeletonTable } from '../components/ui.jsx';
import {
  formatCurrency, formatPercent, isActive, num, sortSnapshots, snapshotLabel,
} from '../utils/formatters.js';
import { totals } from '../utils/totals.js';

const KEYS = [
  T.MONTHLY_NET_WORTH, T.BANKING_ACCOUNTS, T.SPORTSBOOKS, T.INVESTMENTS, T.TRADING_PLATFORMS, T.TRADING_LIQUIDATION,
  T.CREDIT_CARD_LOGINS, T.OWED_TO_ME, T.ASSETS, T.LIABILITIES,
];

// Airtable field names. Display labels differ for a few legacy fields:
// "Total Banking" shows as Total Cash, "Home Value" as Total Assets, "Mortgage Balance" as Total Liabilities.
const F = {
  cash: 'Total Banking',
  investments: 'Total Investments',
  trading: 'Total Trading',
  ccDebt: 'Total Credit Card Debt',
  owed: 'Total Owed to Me',
  assets: 'Home Value',
  liabilities: 'Mortgage Balance',
};

// Net Worth = Total Cash + Total Investments + Total Trading + Total Assets − Total CC Debt − Total Liabilities
const computeNetWorth = (f) => Math.round((
  num(f[F.cash]) + num(f[F.investments]) + num(f[F.trading]) + num(f[F.assets])
  - num(f[F.ccDebt]) - num(f[F.liabilities])
) * 100) / 100;

const orDash = (v) => (v == null ? '—' : formatCurrency(v));
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

function localIsoDate(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function NetWorthTab() {
  const { data, loading, error, reload } = useTables(KEYS);

  const snapshots = sortSnapshots(data[T.MONTHLY_NET_WORTH]);
  const latest = snapshots[snapshots.length - 1];
  const previousOf = (r) => snapshots[snapshots.indexOf(r) - 1];

  // Change % falls back to a computed value when the field is blank.
  const changeFor = (r) => {
    if (r.fields['Change Percent'] != null) return r.fields['Change Percent'];
    const prev = previousOf(r);
    const p = num(prev?.fields['Net Worth']);
    return prev && p !== 0 ? (num(r.fields['Net Worth']) - p) / Math.abs(p) : null;
  };

  // Total Assets / Total Liabilities from the Assets & Liabilities tab (all active records).
  const activeAssets = data[T.ASSETS].filter(isActive);
  const activeLiabilities = data[T.LIABILITIES].filter(isActive);
  const pullFromAssets = {
    label: '↓ Pull from Assets & Liabilities',
    hint: 'Fills Total Assets from all active assets and Total Liabilities from all active liabilities.',
    getValues: () => ({ [F.assets]: totals.assets(data), [F.liabilities]: totals.liabilities(data) }),
    note: (v) => `Pulled ${formatCurrency(v[F.assets])} from ${plural(activeAssets.length, 'asset', 'assets')} and ${formatCurrency(v[F.liabilities])} from ${plural(activeLiabilities.length, 'liability', 'liabilities')}.`,
  };

  const editor = useRecordEditor({
    table: T.MONTHLY_NET_WORTH,
    noun: 'Monthly Snapshot',
    reload,
    fieldActions: { [F.assets]: pullFromAssets },
    transform: (fields, { isNew }) => {
      const out = { ...fields };
      if (out['Net Worth'] == null) out['Net Worth'] = computeNetWorth(out);
      if (out['Change Percent'] == null && isNew && latest) {
        const p = num(latest.fields['Net Worth']);
        if (p !== 0) out['Change Percent'] = (out['Net Worth'] - p) / Math.abs(p);
      }
      return out;
    },
  });

  // Pre-fill a new snapshot from live balances. Assets / liabilities fall back to the
  // last snapshot's figures until the Assets & Liabilities tab has records.
  function openNew() {
    const now = new Date();
    editor.open(null, {
      Month: now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
      Date: localIsoDate(now),
      [F.cash]: totals.cash(data),
      [F.investments]: totals.investments(data),
      [F.trading]: totals.trading(data),
      [F.ccDebt]: totals.ccDebt(data),
      [F.owed]: totals.owedToMe(data),
      [F.assets]: activeAssets.length ? totals.assets(data) : latest?.fields[F.assets],
      [F.liabilities]: activeLiabilities.length ? totals.liabilities(data) : latest?.fields[F.liabilities],
    });
  }

  const lf = latest?.fields || {};
  const prevSnap = latest && previousOf(latest);
  const netAssets = num(lf[F.assets]) - num(lf[F.liabilities]);
  const points = snapshots.map(r => ({ label: snapshotLabel(r, true), value: num(r.fields['Net Worth']) }));

  return (
    <div>
      <ErrorBanner error={error} />
      <div className="fin-toolbar">
        <div className="fin-muted" style={{ fontSize: '0.85rem' }}>
          {latest ? <>Latest snapshot: <strong style={{ color: 'var(--text)' }}>{snapshotLabel(latest)}</strong></> : 'Monthly snapshots of your overall position'}
        </div>
        <button className="fin-btn primary" onClick={openNew} disabled={loading}>+ Record Snapshot</button>
      </div>

      {loading ? <SkeletonStats count={4} /> : latest && (
        <div className="fin-stats">
          <StatCard label="Net Worth" value={formatCurrency(lf['Net Worth'])} accent="var(--positive)" size="2rem"
            sub={prevSnap && <Delta current={lf['Net Worth']} previous={prevSnap.fields['Net Worth']} />} />
          <StatCard label="Total Cash" value={formatCurrency(lf[F.cash])} accent="var(--text)" />
          <StatCard label="Total CC Debt" value={formatCurrency(lf[F.ccDebt])} accent="var(--negative)" />
          <StatCard label="Assets − Liabilities" value={formatCurrency(netAssets)} accent="var(--accent)"
            sub={`${formatCurrency(lf[F.assets])} assets − ${formatCurrency(lf[F.liabilities])} liabilities`} />
        </div>
      )}

      {loading ? <div className="fin-card fin-section"><Skel h={260} /></div> : snapshots.length === 0 ? (
        <EmptyState icon="📉" message="No net worth snapshots yet. Record your first one to start the trend."
          actionLabel="Record snapshot" onAction={openNew} />
      ) : (
        <>
          <div className="fin-card fin-section">
            <SectionHeader title="Net Worth Over Time" />
            <LineChart points={points} height={280} color="#00E676" />
          </div>

          <div className="fin-section">
            <SectionHeader title="History" count={snapshots.length} />
            {loading ? <SkeletonTable /> : (
              <div className="fin-table-wrap">
                <table className="fin-table">
                  <thead>
                    <tr>
                      <th>Month</th><th className="num">Total Cash</th><th className="num">Total Investments</th>
                      <th className="num">Total Trading</th><th className="num">Total Assets</th><th className="num">Total CC Debt</th>
                      <th className="num">Total Liabilities</th><th className="num">Owed to Me</th>
                      <th className="num">Net Worth</th><th className="num">Change %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...snapshots].reverse().map(r => {
                      const f = r.fields;
                      const change = changeFor(r);
                      return (
                        <tr key={r.id} className="clickable" onClick={() => editor.open(r)} title={f.Notes || 'Click to edit'}>
                          <td style={{ fontWeight: 600 }}>{snapshotLabel(r)}</td>
                          <td className="num">{formatCurrency(f[F.cash])}</td>
                          <td className="num">{orDash(f[F.investments])}</td>
                          <td className="num">{orDash(f[F.trading])}</td>
                          <td className="num">{formatCurrency(f[F.assets])}</td>
                          <td className="num" style={{ color: 'var(--negative)' }}>{formatCurrency(f[F.ccDebt])}</td>
                          <td className="num" style={{ color: 'var(--negative)' }}>{formatCurrency(f[F.liabilities])}</td>
                          <td className="num">{formatCurrency(f[F.owed])}</td>
                          <td className="num" style={{ fontWeight: 800 }}>{formatCurrency(f['Net Worth'])}</td>
                          <td className="num" style={{ fontWeight: 600, color: change == null || change === 0 ? 'var(--text-muted)' : change > 0 ? 'var(--positive)' : 'var(--negative)' }}>
                            {change == null ? '—' : `${change > 0 ? '↑' : change < 0 ? '↓' : ''} ${formatPercent(change, { signed: true })}`}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            <div className="fin-faint" style={{ fontSize: '0.72rem', marginTop: 8 }}>Click a row to edit. Net Worth and Change % auto-calculate when left blank.</div>
          </div>
        </>
      )}
      {editor.modal}
    </div>
  );
}
