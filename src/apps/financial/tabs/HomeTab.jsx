import { useTables } from '../hooks/useTables.js';
import { T } from '../config/airtable.js';
import StatCard from '../components/StatCard.jsx';
import SectionHeader from '../components/SectionHeader.jsx';
import AlertBadge, { daysText } from '../components/AlertBadge.jsx';
import LineChart from '../components/LineChart.jsx';
import { ErrorBanner, Skel, SkeletonStats } from '../components/ui.jsx';
import {
  formatCurrency, formatDate, daysUntil, sumField, isActive, countsTowardNetWorth, num,
  sortSnapshots, snapshotLabel, formatPercent,
} from '../utils/formatters.js';

const KEYS = [
  T.BANKING_ACCOUNTS, T.CREDIT_CARD_LOGINS, T.MONTHLY_NET_WORTH, T.INVESTMENTS,
  T.BALANCE_TRANSFERS, T.BANK_BONUSES, T.PENDING_PAYOUTS, T.TRADING_PLATFORMS, T.TRADING_LIQUIDATION,
];

function AlertPanel({ title, items, level, emptyText, onItemClick }) {
  return (
    <div className="fin-alert-card">
      <div className="fin-alert-head">
        <span>{title}</span>
        <AlertBadge level={items.length ? level : 'ok'}>{items.length}</AlertBadge>
      </div>
      {items.length === 0 ? (
        <div className="fin-faint" style={{ fontSize: '0.8rem' }}>✓ {emptyText}</div>
      ) : (
        items.map(item => (
          <button key={item.id} className="fin-alert-item" onClick={onItemClick}>
            <span style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.label}</span>
            <span style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
              <span className="fin-muted">{item.detail}</span>
              {item.badge}
            </span>
          </button>
        ))
      )}
    </div>
  );
}

export default function HomeTab({ onNavigate }) {
  const { data, loading, error } = useTables(KEYS);

  const totalCash = sumField(data[T.BANKING_ACCOUNTS].filter(r => isActive(r) && countsTowardNetWorth(r)), 'Current Balance');
  const totalOwed = sumField(data[T.CREDIT_CARD_LOGINS], 'Current Balance');
  const totalInvest = sumField(data[T.INVESTMENTS].filter(isActive), 'Current Balance');
  const snapshots = sortSnapshots(data[T.MONTHLY_NET_WORTH]);
  const latest = snapshots[snapshots.length - 1];

  // ---- Alerts ----
  const transferAlerts = data[T.BALANCE_TRANSFERS]
    .filter(r => r.fields.Status !== 'Paid Off')
    .map(r => ({ r, days: daysUntil(r.fields['End Date']) }))
    .filter(({ days }) => days != null && days <= 60)
    .sort((a, b) => a.days - b.days)
    .map(({ r, days }) => ({
      id: r.id,
      label: r.fields['Card Name'] || 'Untitled',
      detail: formatDate(r.fields['End Date']),
      badge: <AlertBadge level={days < 0 ? 'danger' : 'orange'}>{days < 0 ? 'EXPIRED' : `${days}d`}</AlertBadge>,
    }));

  const openBonuses = data[T.BANK_BONUSES].filter(r => !r.fields['Closed Date']);
  const completeAlerts = openBonuses
    .filter(r => !r.fields['Date Completed'])
    .map(r => ({ r, days: daysUntil(r.fields['Date to Complete']) }))
    .filter(({ days }) => days != null && days <= 30)
    .sort((a, b) => a.days - b.days)
    .map(({ r, days }) => ({
      id: r.id,
      label: r.fields['Bank Name'] || 'Untitled',
      detail: formatDate(r.fields['Date to Complete']),
      badge: <AlertBadge level={days < 0 ? 'danger' : 'warning'}>{daysText(days)}</AlertBadge>,
    }));
  const closeAlerts = openBonuses
    .map(r => ({ r, days: daysUntil(r.fields['Can Close Date']) }))
    .filter(({ days }) => days != null && days <= 30)
    .sort((a, b) => a.days - b.days)
    .map(({ r, days }) => ({
      id: r.id,
      label: r.fields['Bank Name'] || 'Untitled',
      detail: formatDate(r.fields['Can Close Date']),
      badge: <AlertBadge level={days <= 0 ? 'ok' : 'info'}>{days <= 0 ? 'can close now' : `${days}d`}</AlertBadge>,
    }));
  const payoutAlerts = data[T.PENDING_PAYOUTS]
    .map(r => ({ r, days: daysUntil(r.fields['Expected Date']) }))
    .filter(({ days }) => days != null && days < 0)
    .sort((a, b) => a.days - b.days)
    .map(({ r, days }) => ({
      id: r.id,
      label: r.fields.Source || 'Untitled',
      detail: formatCurrency(r.fields.Amount),
      badge: <AlertBadge level="warning">{daysText(days)}</AlertBadge>,
    }));

  // ---- Trading quick view ----
  const platformTotal = sumField(data[T.TRADING_PLATFORMS], 'Current Balance');
  const liquidation = sumField(data[T.TRADING_LIQUIDATION], 'Current Balance');
  const pendingTotal = sumField(data[T.PENDING_PAYOUTS], 'Amount');

  const sparkPoints = snapshots.slice(-6).map(r => ({ label: snapshotLabel(r, true), value: num(r.fields['Net Worth']) }));

  return (
    <div>
      <ErrorBanner error={error} />
      {loading ? <SkeletonStats count={4} /> : (
        <div className="fin-stats">
          <StatCard label="Total Cash" value={formatCurrency(totalCash)} accent="var(--positive)" />
          <StatCard label="Total Owed (Credit Cards)" value={formatCurrency(totalOwed)} accent={totalOwed > 0 ? 'var(--negative)' : 'var(--text)'} />
          <StatCard
            label="Net Worth"
            value={latest ? formatCurrency(latest.fields['Net Worth']) : '—'}
            accent="var(--accent)"
            sub={latest ? `as of ${snapshotLabel(latest)}` : 'No snapshots yet'}
          />
          <StatCard label="Total Investments" value={formatCurrency(totalInvest)} accent="var(--warning)" />
        </div>
      )}

      <div className="fin-section">
        <SectionHeader title="Action Items" count={loading ? null : transferAlerts.length + completeAlerts.length + closeAlerts.length + payoutAlerts.length} />
        {loading ? (
          <div className="fin-alert-grid">
            {[0, 1, 2, 3].map(i => <div key={i} className="fin-alert-card"><Skel w="60%" /><Skel h={30} /><Skel h={30} w="85%" /></div>)}
          </div>
        ) : (
          <div className="fin-alert-grid">
            <AlertPanel title="Balance transfers ending ≤ 60 days" items={transferAlerts} level="danger"
              emptyText="No transfers ending soon" onItemClick={() => onNavigate('creditcards', 'transfers')} />
            <AlertPanel title="Bonuses due ≤ 30 days" items={completeAlerts} level="warning"
              emptyText="No bonus deadlines coming up" onItemClick={() => onNavigate('banking', 'bonuses')} />
            <AlertPanel title="Bonus accounts closable ≤ 30 days" items={closeAlerts} level="info"
              emptyText="Nothing to close soon" onItemClick={() => onNavigate('banking', 'bonuses')} />
            <AlertPanel title="Overdue pending payouts" items={payoutAlerts} level="warning"
              emptyText="No overdue payouts" onItemClick={() => onNavigate('trading')} />
          </div>
        )}
      </div>

      <div className="fin-home-row">
        <div className="fin-card">
          <SectionHeader title="Net Worth — last 6 months" right={
            <button className="fin-link" onClick={() => onNavigate('networth')}>View history →</button>
          } />
          {loading ? <Skel h={140} /> : sparkPoints.length === 0 ? (
            <div className="fin-empty">
              <div>No net worth snapshots recorded yet.</div>
              <button className="fin-btn primary sm" onClick={() => onNavigate('networth')}>Record a snapshot</button>
            </div>
          ) : (
            <>
              <LineChart points={sparkPoints} height={140} sparkline />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem' }} className="fin-muted">
                <span>{sparkPoints[0].label}</span>
                {latest?.fields['Change Percent'] != null && (
                  <span style={{ color: latest.fields['Change Percent'] >= 0 ? 'var(--positive)' : 'var(--negative)', fontWeight: 600 }}>
                    {formatPercent(latest.fields['Change Percent'], { signed: true })} last month
                  </span>
                )}
                <span>{sparkPoints[sparkPoints.length - 1].label}</span>
              </div>
            </>
          )}
        </div>

        <div className="fin-card">
          <SectionHeader title="Trading" right={
            <button className="fin-link" onClick={() => onNavigate('trading')}>Open →</button>
          } />
          {loading ? <Skel h={140} /> : (
            <>
              <div className="fin-mini-grid">
                <div className="fin-mini"><div className="fin-mini-label">Platforms</div><div className="fin-mini-value">{formatCurrency(platformTotal)}</div></div>
                <div className="fin-mini"><div className="fin-mini-label">Liquidation</div><div className="fin-mini-value">{formatCurrency(liquidation)}</div></div>
                <div className="fin-mini"><div className="fin-mini-label">Pending Payouts</div><div className="fin-mini-value">{formatCurrency(pendingTotal)}</div></div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 4 }}>
                <span className="fin-muted" style={{ fontSize: '0.8rem' }}>Total</span>
                <span style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--accent)' }}>{formatCurrency(platformTotal + liquidation + pendingTotal)}</span>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
