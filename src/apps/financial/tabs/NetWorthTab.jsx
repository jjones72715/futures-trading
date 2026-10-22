import { useState } from 'react';
import { useTables } from '../hooks/useTables.js';
import { T } from '../config/airtable.js';
import SectionHeader from '../components/SectionHeader.jsx';
import StatCard from '../components/StatCard.jsx';
import LineChart from '../components/LineChart.jsx';
import { useRecordEditor } from '../components/Modal.jsx';
import { Delta, EmptyState, ErrorBanner, Skel, SkeletonStats, SkeletonTable } from '../components/ui.jsx';
import {
  formatCurrency, formatPercent, num, sortSnapshots, snapshotLabel, snapshotTime,
} from '../utils/formatters.js';
import { fetchRecords } from '../services/financialService.js';
import { totals } from '../utils/totals.js';

const KEYS = [
  T.MONTHLY_NET_WORTH, T.BANKING_ACCOUNTS, T.SPORTSBOOKS, T.INVESTMENTS, T.TRADING_PLATFORMS, T.TRADING_LIQUIDATION,
  T.CREDIT_CARD_LOGINS, T.OWED_TO_ME, T.ASSETS, T.LIABILITIES,
];

// Monthly Net Worth field names in Airtable.
const F = {
  cash: 'Cash Available',
  liquidation: 'Trading Liquidation Invested',
  investments: 'Total Investments',
  assets: 'Total Assets',
  owed: 'Total Owed to Me',
  ccDebt: 'Short Term Debt',
  liabilities: 'Total Liabilities',
  change: 'Change Percent',
};

// Net Worth = Cash Available + Trading Liquidation Invested + Total Investments + Total Assets + Total Owed to Me
//             − Short Term Debt − Total Liabilities
const computeNetWorth = (f) => Math.round((
  num(f[F.cash]) + num(f[F.liquidation]) + num(f[F.investments]) + num(f[F.assets]) + num(f[F.owed])
  - num(f[F.ccDebt]) - num(f[F.liabilities])
) * 100) / 100;

const orDash = (v) => (v == null ? '—' : formatCurrency(v));
const formatChange = (v) => formatPercent(v, { signed: true, digits: 2 });

// Change Percent is an Airtable percent field, so it stores a fraction (0.0648 displays as 6.48%).
// Rounded to 2 decimal places of a percent.
const changeFraction = (netWorth, prevNetWorth) =>
  Math.round(((netWorth - prevNetWorth) / Math.abs(prevNetWorth)) * 10000) / 10000;

// The snapshot dated immediately before `fields`, read fresh from Airtable.
async function fetchPreviousSnapshot(fields, excludeId) {
  const all = await fetchRecords(T.MONTHLY_NET_WORTH);
  const time = snapshotTime({ fields, createdTime: new Date().toISOString() });
  return sortSnapshots(all.filter(r => r.id !== excludeId && snapshotTime(r) < time)).pop() || null;
}

function localIsoDate(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function NetWorthTab() {
  const { data, loading, error, reload } = useTables(KEYS);
  const [pulling, setPulling] = useState(false);

  const snapshots = sortSnapshots(data[T.MONTHLY_NET_WORTH]);
  const latest = snapshots[snapshots.length - 1];
  const previousOf = (r) => snapshots[snapshots.indexOf(r) - 1];

  // Change % falls back to a computed value when the field is blank.
  const changeFor = (r) => {
    if (r.fields[F.change] != null) return r.fields[F.change];
    const prev = previousOf(r);
    const p = num(prev?.fields['Net Worth']);
    return prev && p !== 0 ? (num(r.fields['Net Worth']) - p) / Math.abs(p) : null;
  };

  const editor = useRecordEditor({
    table: T.MONTHLY_NET_WORTH,
    noun: 'Monthly Snapshot',
    reload,
    // Net Worth auto-calculates when blank; Change % is always recalculated against the
    // previous snapshot by date (cleared when there isn't one to compare with).
    transform: async (fields, { record }) => {
      const out = { ...fields };
      if (out['Net Worth'] == null) out['Net Worth'] = computeNetWorth(out);
      const prev = await fetchPreviousSnapshot(out, record?.id);
      const p = num(prev?.fields['Net Worth']);
      out[F.change] = prev && p !== 0 ? changeFraction(out['Net Worth'], p) : null;
      return out;
    },
  });

  // New snapshots are pre-filled from freshly re-fetched live balances (all still editable).
  async function openNew() {
    setPulling(true);
    const live = (await reload()) || data;
    setPulling(false);
    const now = new Date();
    editor.open(null, {
      Month: now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
      Date: localIsoDate(now),
      [F.cash]: totals.cash(live),
      [F.liquidation]: totals.liquidation(live),
      [F.investments]: totals.investments(live),
      [F.assets]: totals.assets(live),
      [F.owed]: totals.owedToMe(live),
      [F.ccDebt]: totals.ccDebt(live),
      [F.liabilities]: totals.liabilities(live),
    }, {
      note: `Pulled from live data · ${now.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}`,
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
        <button className="fin-btn primary" onClick={openNew} disabled={loading || pulling}>{pulling ? 'Pulling live data…' : '+ Record Snapshot'}</button>
      </div>

      {loading ? <SkeletonStats count={4} /> : latest && (
        <div className="fin-stats">
          <StatCard label="Net Worth" value={formatCurrency(lf['Net Worth'])} accent="var(--positive)" size="2rem"
            sub={prevSnap && <Delta current={lf['Net Worth']} previous={prevSnap.fields['Net Worth']} pctDigits={2} />} />
          <StatCard label="Cash Available" value={formatCurrency(lf[F.cash])} accent="var(--text)" />
          <StatCard label="Short Term Debt" value={formatCurrency(lf[F.ccDebt])} accent="var(--negative)" />
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
                      <th>Month</th><th className="num">Cash Available</th><th className="num">Trading Liquidation Invested</th>
                      <th className="num">Total Investments</th><th className="num">Total Assets</th><th className="num">Owed to Me</th>
                      <th className="num">Short Term Debt</th><th className="num">Total Liabilities</th>
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
                          <td className="num">{orDash(f[F.cash])}</td>
                          <td className="num">{orDash(f[F.liquidation])}</td>
                          <td className="num">{orDash(f[F.investments])}</td>
                          <td className="num">{orDash(f[F.assets])}</td>
                          <td className="num">{orDash(f[F.owed])}</td>
                          <td className="num" style={{ color: 'var(--negative)' }}>{orDash(f[F.ccDebt])}</td>
                          <td className="num" style={{ color: 'var(--negative)' }}>{orDash(f[F.liabilities])}</td>
                          <td className="num" style={{ fontWeight: 800 }}>{formatCurrency(f['Net Worth'])}</td>
                          <td className="num" style={{ fontWeight: 600, color: change == null || change === 0 ? 'var(--text-muted)' : change > 0 ? 'var(--positive)' : 'var(--negative)' }}>
                            {change == null ? '—' : `${change > 0 ? '↑' : change < 0 ? '↓' : ''} ${formatChange(change)}`}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            <div className="fin-faint" style={{ fontSize: '0.72rem', marginTop: 8 }}>Click a row to edit. Net Worth auto-calculates when left blank; Change % is calculated on save from the previous snapshot.</div>
          </div>
        </>
      )}
      {editor.modal}
    </div>
  );
}
