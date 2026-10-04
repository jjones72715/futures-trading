import { useTables } from '../hooks/useTables.js';
import { T } from '../config/airtable.js';
import SectionHeader from '../components/SectionHeader.jsx';
import StatCard from '../components/StatCard.jsx';
import LineChart from '../components/LineChart.jsx';
import { useRecordEditor } from '../components/Modal.jsx';
import { Delta, EmptyState, ErrorBanner, Skel, SkeletonStats, SkeletonTable } from '../components/ui.jsx';
import {
  formatCurrency, formatPercent, isActive, countsTowardNetWorth, num, sortSnapshots, snapshotLabel, sumField,
} from '../utils/formatters.js';

const KEYS = [T.MONTHLY_NET_WORTH, T.BANKING_ACCOUNTS, T.CREDIT_CARD_LOGINS, T.OWED_TO_ME];

const computeNetWorth = (f) => Math.round((
  num(f['Total Banking']) - num(f['Total Credit Card Debt']) + num(f['Total Owed to Me'])
  + num(f['Home Value']) - num(f['Mortgage Balance'])
) * 100) / 100;

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

  const editor = useRecordEditor({
    table: T.MONTHLY_NET_WORTH,
    noun: 'Monthly Snapshot',
    reload,
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

  // Pre-fill a new snapshot from live balances + last snapshot's home figures.
  function openNew() {
    const now = new Date();
    editor.open(null, {
      Month: now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
      Date: localIsoDate(now),
      'Total Banking': Math.round(sumField(data[T.BANKING_ACCOUNTS].filter(r => isActive(r) && countsTowardNetWorth(r)), 'Current Balance') * 100) / 100,
      'Total Credit Card Debt': Math.round(sumField(data[T.CREDIT_CARD_LOGINS], 'Current Balance') * 100) / 100,
      'Total Owed to Me': Math.round(sumField(data[T.OWED_TO_ME], 'Current Amount') * 100) / 100,
      'Home Value': latest?.fields['Home Value'],
      'Mortgage Balance': latest?.fields['Mortgage Balance'],
    });
  }

  const lf = latest?.fields || {};
  const prevSnap = latest && previousOf(latest);
  const homeEquity = num(lf['Home Value']) - num(lf['Mortgage Balance']);
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
          <StatCard label="Total Banking" value={formatCurrency(lf['Total Banking'])} accent="var(--text)" />
          <StatCard label="Total CC Debt" value={formatCurrency(lf['Total Credit Card Debt'])} accent="var(--negative)" />
          <StatCard label="Home Equity" value={formatCurrency(homeEquity)} accent="var(--accent)"
            sub={`${formatCurrency(lf['Home Value'])} value − ${formatCurrency(lf['Mortgage Balance'])} mortgage`} />
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
                      <th>Month</th><th className="num">Total Banking</th><th className="num">Total CC Debt</th>
                      <th className="num">Owed to Me</th><th className="num">Home Value</th><th className="num">Mortgage Balance</th>
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
                          <td className="num">{formatCurrency(f['Total Banking'])}</td>
                          <td className="num" style={{ color: 'var(--negative)' }}>{formatCurrency(f['Total Credit Card Debt'])}</td>
                          <td className="num">{formatCurrency(f['Total Owed to Me'])}</td>
                          <td className="num">{formatCurrency(f['Home Value'])}</td>
                          <td className="num">{formatCurrency(f['Mortgage Balance'])}</td>
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
