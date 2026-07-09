import { useState, useEffect } from 'react';
import { fetchTable } from '../services/airtable.js';
import {
  PORTFOLIO_TABLE, PERK_INSTANCES_TABLE, SPEND_BONUSES_TABLE,
  POINT_BALANCES_TABLE, REWARDS_TABLE, HOTELS_TABLE, SIGNUP_BONUSES_TABLE,
} from '../config/tables.js';
import { PEOPLE, ALL_PEOPLE } from '../config/constants.js';
import { $$, stripOwnerPrefix } from '../utils/format.js';
import { sumPerkValue } from '../utils/perks.js';

const FILTER_PEOPLE = ['Jonathan', 'Sherry', 'Judy', 'Wade', 'Amanda'];
const PERSON_ID_BY_NAME = Object.fromEntries(Object.entries(PEOPLE).map(([id, name]) => [name, id]));

const PORTFOLIO_FIELDS = ['Card Name', 'Owner', 'Personal/Business', 'Annual Fee Amount', 'Days Until Annual Fee', 'Decision', 'Open Date', 'Status'];
const PERK_FIELDS = ['Card', 'Value'];
const SPEND_FIELDS = ['Card', 'Value'];
const POINT_FIELDS = ['Person', 'Program', 'Current Balance', 'Program Value', 'Value Per Point', 'Days Until Expiration', 'Expiration Date'];
const REWARDS_FIELDS = ['Program Name'];
const HOTEL_FIELDS = ['Name', 'Card', 'Person', 'Record Type', 'Expiration Date', 'Days Until Expiration'];
const SIGNUP_FIELDS = ['Card', 'Person', 'Bonus Description', 'Achieved', 'Days Remaining', 'Effective Deadline'];

function resolveSingle(raw) {
  if (raw == null) return null;
  return Array.isArray(raw) ? (raw[0] ?? null) : raw;
}

function fmtDate(d) {
  if (!d) return '—';
  return `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`;
}

function fmtNum(n) {
  return n == null ? '—' : Math.round(n).toLocaleString();
}

/* ---------------- Skeleton primitives ---------------- */

function Skel({ w = '100%', h = 14, style }) {
  return <div className="dash-skeleton" style={{ width: w, height: h, borderRadius: 6, ...style }} />;
}

function SkeletonStatBlock() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, height: '100%', justifyContent: 'center' }}>
      <Skel w="55%" h={11} />
      <Skel w="45%" h={30} />
      <Skel w="75%" h={10} />
    </div>
  );
}

function SkeletonListBlock({ rows = 5 }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, height: '100%' }}>
      <Skel w="45%" h={13} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, flex: 1, justifyContent: 'center' }}>
        {Array.from({ length: rows }).map((_, i) => (
          <Skel key={i} w={`${88 - i * 6}%`} h={13} />
        ))}
      </div>
    </div>
  );
}

/* ---------------- Block shell ---------------- */

function Block({ bg, border, accent, ready, skeleton, children, area }) {
  return (
    <div style={{
      position: 'relative', background: bg, border: `1px solid ${border}`,
      borderRadius: 14, padding: '1.1rem 1.3rem', overflow: 'hidden',
      minHeight: 0, gridArea: area,
    }}>
      <div style={{
        position: ready ? 'absolute' : 'relative', inset: 0, padding: '1.1rem 1.3rem',
        opacity: ready ? 0 : 1, transition: 'opacity 300ms ease', pointerEvents: ready ? 'none' : 'auto',
      }}>
        {skeleton}
      </div>
      <div style={{
        position: ready ? 'relative' : 'absolute', inset: 0, padding: ready ? 0 : '1.1rem 1.3rem',
        opacity: ready ? 1 : 0, transition: 'opacity 300ms ease',
        height: '100%', display: 'flex', flexDirection: 'column',
      }}>
        {children}
      </div>
    </div>
  );
}

function BlockTitle({ children, accent, badge }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: '0.7rem', flexShrink: 0 }}>
      <span style={{ fontSize: '0.78rem', fontWeight: 700, color: accent, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        {children}
      </span>
      {badge != null && (
        <span style={{
          background: `${accent}22`, color: accent, borderRadius: 20, padding: '1px 9px',
          fontSize: '0.72rem', fontWeight: 700, border: `1px solid ${accent}55`,
        }}>
          {badge}
        </span>
      )}
    </div>
  );
}

function SubBox({ label, value, valueColor, accent, valueSize = '1.9rem' }) {
  return (
    <div style={{
      flex: 1, minWidth: 0, background: 'rgba(255,255,255,0.04)', borderRadius: 10,
      border: '1px solid rgba(255,255,255,0.08)', padding: '0.85rem 1rem',
      display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 8,
    }}>
      <div style={{ fontSize: '0.66rem', fontWeight: 700, color: accent, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        {label}
      </div>
      <div style={{
        fontSize: valueSize, fontWeight: 800, color: valueColor, lineHeight: 1.05,
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>
        {value}
      </div>
    </div>
  );
}

/* ---------------- Dashboard ---------------- */

export function DashboardTab({ onNavigate }) {
  const [personFilter, setPersonFilter] = useState(ALL_PEOPLE);

  const [portfolio, setPortfolio] = useState([]);
  const [portfolioReady, setPortfolioReady] = useState(false);

  const [perkInstances, setPerkInstances] = useState([]);
  const [spendBonuses, setSpendBonuses] = useState([]);
  const [perkReady, setPerkReady] = useState(false);

  const [balances, setBalances] = useState([]);
  const [programNameById, setProgramNameById] = useState({});
  const [pointsReady, setPointsReady] = useState(false);

  const [hotels, setHotels] = useState([]);
  const [hotelsReady, setHotelsReady] = useState(false);

  const [signupBonuses, setSignupBonuses] = useState([]);
  const [signupReady, setSignupReady] = useState(false);

  useEffect(() => {
    fetchTable(PORTFOLIO_TABLE, PORTFOLIO_FIELDS)
      .then(setPortfolio)
      .catch(e => console.error('Dashboard portfolio fetch failed', e))
      .finally(() => setPortfolioReady(true));

    Promise.all([
      fetchTable(PERK_INSTANCES_TABLE, PERK_FIELDS),
      fetchTable(SPEND_BONUSES_TABLE, SPEND_FIELDS),
    ])
      .then(([perks, spends]) => { setPerkInstances(perks); setSpendBonuses(spends); })
      .catch(e => console.error('Dashboard perk fetch failed', e))
      .finally(() => setPerkReady(true));

    Promise.all([
      fetchTable(POINT_BALANCES_TABLE, POINT_FIELDS),
      fetchTable(REWARDS_TABLE, REWARDS_FIELDS),
    ])
      .then(([balanceRows, programRows]) => {
        setBalances(balanceRows);
        setProgramNameById(Object.fromEntries(programRows.map(p => [p.id, p.fields['Program Name'] || p.id])));
      })
      .catch(e => console.error('Dashboard points fetch failed', e))
      .finally(() => setPointsReady(true));

    fetchTable(HOTELS_TABLE, HOTEL_FIELDS)
      .then(setHotels)
      .catch(e => console.error('Dashboard hotels fetch failed', e))
      .finally(() => setHotelsReady(true));

    fetchTable(SIGNUP_BONUSES_TABLE, SIGNUP_FIELDS)
      .then(setSignupBonuses)
      .catch(e => console.error('Dashboard signup fetch failed', e))
      .finally(() => setSignupReady(true));
  }, []);

  const selectedPersonId = personFilter === ALL_PEOPLE ? null : PERSON_ID_BY_NAME[personFilter];
  const byPerson = (ownerIds) => selectedPersonId == null || (ownerIds || []).includes(selectedPersonId);

  const activeCards = portfolio.filter(c => c.fields['Status'] === 'Active');
  const activeFiltered = activeCards.filter(c => byPerson(c.fields['Owner']));

  const balancesFiltered = balances.filter(b => byPerson(b.fields['Person']));
  const hotelsFiltered = hotels.filter(h => byPerson(h.fields['Person']));
  const signupFiltered = signupBonuses.filter(s => byPerson(s.fields['Person']));

  /* ---- Block 1: Active Cards ---- */
  const totalActive = activeFiltered.length;
  const activeBreakdown = FILTER_PEOPLE.map(name => ({
    name,
    count: activeCards.filter(c => (c.fields['Owner'] || []).includes(PERSON_ID_BY_NAME[name])).length,
  }));

  /* ---- Block 2: Annual Fees ---- */
  const totalFees = activeFiltered.reduce((s, c) => s + (c.fields['Annual Fee Amount'] || 0), 0);
  const feesDueSoonCount = activeFiltered.filter(c => (c.fields['Days Until Annual Fee'] ?? Infinity) <= 60).length;

  /* ---- Block 3: Points / Miles ---- */
  const totalPoints = balancesFiltered.reduce((s, b) => s + (b.fields['Current Balance'] || 0), 0);
  const totalPointsValue = balancesFiltered.reduce((s, b) => s + (b.fields['Program Value'] || 0), 0);

  /* ---- Block 4: Action Items ---- */
  const auditsNeededCount = activeFiltered.filter(c => (c.fields['Days Until Annual Fee'] ?? Infinity) <= 60 && !c.fields['Decision']).length;
  const freeNightsExpiringCount = hotelsFiltered.filter(h => {
    const days = h.fields['Days Until Expiration'];
    return resolveSingle(h.fields['Record Type']) === 'Free Night' && days != null && days >= 0 && days <= 60;
  }).length;
  const signupExpiringCount = signupFiltered.filter(s => {
    const days = s.fields['Days Remaining'];
    return !s.fields['Achieved'] && days != null && days >= 0 && days <= 15;
  }).length;
  const pointsExpiringCount = balancesFiltered.filter(b => {
    const days = b.fields['Days Until Expiration'];
    return days != null && days >= 0 && days <= 60;
  }).length;

  const actionItems = [
    { label: 'Annual fees due ≤60 days', count: feesDueSoonCount, tab: 'actions' },
    { label: 'Card audits needed', count: auditsNeededCount, tab: 'actions' },
    { label: 'Free nights expiring ≤60 days', count: freeNightsExpiringCount, tab: 'hotels' },
    { label: 'Sign-up bonuses expiring ≤15 days', count: signupExpiringCount, tab: 'bonuses' },
    { label: 'Point balances expiring ≤60 days', count: pointsExpiringCount, tab: 'point-balances' },
  ];
  const actionItemsTotal = actionItems.reduce((s, a) => s + a.count, 0);

  /* ---- Block 5/6: Most / Least Valuable Cards ---- */
  const instancesByCard = {};
  [...perkInstances, ...spendBonuses].forEach(inst => {
    const cardId = resolveSingle(inst.fields['Card']);
    if (!cardId) return;
    if (!instancesByCard[cardId]) instancesByCard[cardId] = [];
    instancesByCard[cardId].push(inst);
  });

  const valuedCards = activeFiltered.map(c => {
    const ownerId = resolveSingle(c.fields['Owner']);
    const ownerName = ownerId ? (PEOPLE[ownerId] || '—') : '—';
    const annualFee = c.fields['Annual Fee Amount'] || 0;
    const { netValue, hasAnyValue } = sumPerkValue(instancesByCard[c.id] || []);
    return {
      id: c.id,
      name: stripOwnerPrefix(c.fields['Card Name'], ownerName) || '—',
      ownerName,
      annualFee,
      perkValue: netValue,
      netScore: netValue - annualFee,
      hasAnyValue,
    };
  }).filter(c => c.hasAnyValue);

  const anyValuesEntered = valuedCards.length > 0;
  const mostValuable = [...valuedCards].sort((a, b) => b.netScore - a.netScore).slice(0, 5);
  const leastValuable = [...valuedCards].sort((a, b) => a.netScore - b.netScore).slice(0, 5);

  /* ---- Block 7: Top Programs ---- */
  const programRows = balancesFiltered
    .map(b => ({
      id: b.id,
      programName: programNameById[resolveSingle(b.fields['Program'])] || '—',
      points: b.fields['Current Balance'] || 0,
      valuePerPoint: resolveSingle(b.fields['Value Per Point']),
      programValue: b.fields['Program Value'] || 0,
    }))
    .sort((a, b) => b.programValue - a.programValue)
    .slice(0, 5);

  /* ---- Block 8: Hotel Benefits ---- */
  const freeNights = hotelsFiltered.filter(h => resolveSingle(h.fields['Record Type']) === 'Free Night');
  const freeNightsAvailable = freeNights.filter(h => {
    const days = h.fields['Days Until Expiration'];
    return days == null || days >= 0;
  }).length;
  const expiringCerts = freeNights
    .filter(h => {
      const days = h.fields['Days Until Expiration'];
      return days != null && days >= 0 && days <= 60;
    })
    .sort((a, b) => (a.fields['Days Until Expiration'] ?? Infinity) - (b.fields['Days Until Expiration'] ?? Infinity))
    .slice(0, 5);

  /* ---- Block 9: Chase 5/24 ---- */
  function personal524(personId) {
    const cutoff = new Date();
    cutoff.setHours(0, 0, 0, 0);
    cutoff.setMonth(cutoff.getMonth() - 24);
    const cards = portfolio.filter(c => {
      if (!(c.fields['Owner'] || []).includes(personId)) return false;
      if (resolveSingle(c.fields['Personal/Business']) !== 'Personal') return false;
      const openDate = c.fields['Open Date'];
      if (!openDate) return false;
      return new Date(openDate + 'T00:00:00') > cutoff;
    }).sort((a, b) => a.fields['Open Date'].localeCompare(b.fields['Open Date']));

    const count = cards.length;
    const neededToFall = count - 4;
    let fourDate = null;
    if (neededToFall > 0) {
      fourDate = new Date(cards[neededToFall - 1].fields['Open Date'] + 'T00:00:00');
      fourDate.setMonth(fourDate.getMonth() + 24);
    }
    return { count, fourDate };
  }

  const per524 = FILTER_PEOPLE.map(name => ({ name, ...personal524(PERSON_ID_BY_NAME[name]) }));
  const overCount = per524.filter(p => p.count >= 5).length;
  const selected524 = selectedPersonId ? personal524(selectedPersonId) : null;

  const accents = {
    activeCards: { bg: '#001233', border: '#0A2555', accent: '#00D4FF' },
    fees: { bg: '#001A0D', border: '#0A3320', accent: '#00C853' },
    points: { bg: '#1A1400', border: '#332800', accent: '#FFD700' },
    action: { bg: '#1A0800', border: '#332000', accent: '#FF6D00' },
    most: { bg: '#001A08', border: '#0A3318', accent: '#00E676' },
    least: { bg: '#1A0008', border: '#330018', accent: '#FF1744' },
    programs: { bg: '#0D0A00', border: '#241E00', accent: '#FFD700' },
    hotel: { bg: '#001A1A', border: '#0A3333', accent: '#00BCD4' },
    chase: { bg: '#0A0015', border: '#1F0033', accent: '#7C4DFF' },
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', height: 'calc(100vh - 150px)', minHeight: 600 }}>
      <style>{`
        @keyframes dashShimmer { 0% { background-position: -1000px 0; } 100% { background-position: 1000px 0; } }
        .dash-skeleton {
          background: linear-gradient(90deg, #172033 25%, #1E2D45 50%, #172033 75%);
          background-size: 1000px 100%;
          animation: dashShimmer 1.5s infinite;
        }
      `}</style>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', flexShrink: 0 }}>
        {['All', ...FILTER_PEOPLE].map(name => {
          const active = name === 'All' ? personFilter === ALL_PEOPLE : personFilter === name;
          return (
            <button
              key={name}
              onClick={() => setPersonFilter(name === 'All' ? ALL_PEOPLE : name)}
              style={{
                padding: '6px 16px', borderRadius: 20, border: '1px solid rgba(255,255,255,0.12)',
                background: active ? '#00D4FF' : 'rgba(255,255,255,0.06)',
                color: active ? '#0B1220' : 'rgba(255,255,255,0.6)',
                fontWeight: active ? 700 : 400, fontSize: '0.85rem', cursor: 'pointer', transition: 'all 0.15s',
              }}
            >
              {name}
            </button>
          );
        })}
      </div>

      <div style={{ flex: 1, display: 'grid', gridTemplateRows: '1fr 2fr 2fr', gap: '1rem', minHeight: 0 }}>

        {/* Top row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', minHeight: 0 }}>
          <Block {...accents.activeCards} ready={portfolioReady} skeleton={<SkeletonStatBlock />}>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: accents.activeCards.accent, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Total Active Cards
            </div>
            <div style={{ fontSize: '2.4rem', fontWeight: 800, color: accents.activeCards.accent, lineHeight: 1.1, marginTop: 6 }}>
              {personFilter === ALL_PEOPLE ? totalActive : activeFiltered.length}
            </div>
            <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.7)', marginTop: 6 }}>
              {personFilter === ALL_PEOPLE
                ? activeBreakdown.map(p => `${p.name}: ${p.count}`).join(', ')
                : `${personFilter}'s active cards`}
            </div>
          </Block>

          <Block {...accents.fees} ready={portfolioReady} skeleton={<SkeletonStatBlock />}>
            <BlockTitle accent={accents.fees.accent}>Annual Fees</BlockTitle>
            <div style={{ display: 'flex', gap: '0.75rem', flex: 1 }}>
              <SubBox label="Total Annual Fees" value={$$(totalFees)} valueColor="#00C853" accent={accents.fees.accent} valueSize="1.6rem" />
              <SubBox label="Due in 60 Days" value={feesDueSoonCount} valueColor="#FF1744" accent={accents.fees.accent} valueSize="1.6rem" />
            </div>
          </Block>

          <Block {...accents.points} ready={pointsReady} skeleton={<SkeletonStatBlock />}>
            <BlockTitle accent={accents.points.accent}>Points / Miles</BlockTitle>
            <div style={{ display: 'flex', gap: '0.75rem', flex: 1 }}>
              <SubBox label="Total Points" value={`${fmtNum(totalPoints)} pts`} valueColor="#FFD700" accent={accents.points.accent} valueSize="1.25rem" />
              <SubBox label="Total Value" value={$$(totalPointsValue)} valueColor="#FFD700" accent={accents.points.accent} valueSize="1.6rem" />
            </div>
          </Block>
        </div>

        {/* Middle row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', minHeight: 0 }}>
          <Block {...accents.action} ready={portfolioReady && pointsReady && hotelsReady && signupReady} skeleton={<SkeletonListBlock rows={5} />}>
            <BlockTitle accent={accents.action.accent} badge={actionItemsTotal}>Action Items</BlockTitle>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, overflowY: 'auto', flex: 1 }}>
              {actionItems.map(item => (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => onNavigate && onNavigate(item.tab)}
                  style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    background: item.count > 0 ? `${accents.action.accent}14` : 'transparent',
                    border: `1px solid ${item.count > 0 ? accents.action.accent + '40' : 'rgba(255,255,255,0.06)'}`,
                    borderRadius: 8, padding: '0.5rem 0.7rem', cursor: 'pointer', textAlign: 'left',
                    boxShadow: item.count > 0 ? `0 0 10px ${accents.action.accent}22` : 'none',
                  }}
                >
                  <span style={{ fontSize: '0.82rem', color: item.count > 0 ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.3)' }}>
                    {item.label}
                  </span>
                  <span style={{ fontSize: '0.9rem', fontWeight: 800, color: item.count > 0 ? accents.action.accent : 'rgba(255,255,255,0.3)' }}>
                    {item.count}
                  </span>
                </button>
              ))}
            </div>
          </Block>

          <Block {...accents.most} ready={portfolioReady && perkReady} skeleton={<SkeletonListBlock rows={5} />}>
            <BlockTitle accent={accents.most.accent}>Most Valuable Cards</BlockTitle>
            {!anyValuesEntered ? (
              <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: '0.82rem', margin: 'auto' }}>
                Run Annual Review in Card Audit to see card values
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, overflowY: 'auto', flex: 1 }}>
                {mostValuable.map(c => (
                  <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.35rem 0' }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: '0.82rem', color: '#fff', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</div>
                      <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.5)' }}>{c.ownerName} · Fee {$$(c.annualFee)} · Value {$$(c.perkValue)}</div>
                    </div>
                    <span style={{ fontSize: '0.88rem', fontWeight: 800, color: accents.most.accent, flexShrink: 0, marginLeft: 8 }}>
                      {c.netScore >= 0 ? '+' : ''}{$$(c.netScore)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Block>

          <Block {...accents.least} ready={portfolioReady && perkReady} skeleton={<SkeletonListBlock rows={5} />}>
            <BlockTitle accent={accents.least.accent}>Least Valuable Cards</BlockTitle>
            {!anyValuesEntered ? (
              <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: '0.82rem', margin: 'auto' }}>
                Run Annual Review in Card Audit to see card values
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, overflowY: 'auto', flex: 1 }}>
                {leastValuable.map(c => (
                  <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.35rem 0' }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: '0.82rem', color: '#fff', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</div>
                      <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.5)' }}>{c.ownerName} · Fee {$$(c.annualFee)} · Value {$$(c.perkValue)}</div>
                    </div>
                    <span style={{ fontSize: '0.88rem', fontWeight: 800, color: accents.least.accent, flexShrink: 0, marginLeft: 8 }}>
                      {c.netScore >= 0 ? '+' : ''}{$$(c.netScore)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Block>
        </div>

        {/* Bottom row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', minHeight: 0 }}>
          <Block {...accents.programs} ready={pointsReady} skeleton={<SkeletonListBlock rows={5} />}>
            <BlockTitle accent={accents.programs.accent}>Top Programs</BlockTitle>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, overflowY: 'auto', flex: 1, justifyContent: 'space-evenly' }}>
              {programRows.length === 0 ? (
                <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.82rem' }}>No point balances yet.</div>
              ) : programRows.map(p => (
                <div key={p.id} style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr 1fr', gap: 10, alignItems: 'center' }}>
                  <span style={{ fontSize: '1.02rem', fontWeight: 700, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {p.programName}
                  </span>
                  <span style={{ fontSize: '0.92rem', color: 'rgba(255,255,255,0.55)', textAlign: 'center' }}>{fmtNum(p.points)} pts</span>
                  <span style={{ fontSize: '1rem', fontWeight: 700, color: '#FFD700', textAlign: 'right' }}>{$$(p.programValue)}</span>
                </div>
              ))}
            </div>
          </Block>

          <Block {...accents.hotel} ready={hotelsReady} skeleton={<SkeletonListBlock rows={5} />}>
            <BlockTitle accent={accents.hotel.accent}>Hotel Benefits</BlockTitle>
            <div style={{ display: 'flex', gap: '0.75rem', marginBottom: 10, flexShrink: 0 }}>
              <SubBox label="Free Nights Available" value={freeNightsAvailable} valueColor="#00BCD4" accent={accents.hotel.accent} valueSize="1.6rem" />
              <SubBox
                label="Expiring in 60 Days"
                value={expiringCerts.length}
                valueColor={expiringCerts.length > 0 ? '#FFD700' : 'rgba(255,255,255,0.3)'}
                accent={accents.hotel.accent}
                valueSize="1.6rem"
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, overflowY: 'auto', flex: 1, justifyContent: expiringCerts.length ? 'flex-start' : 'center' }}>
              {expiringCerts.length === 0 ? (
                <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.85rem', textAlign: 'center' }}>No certs expiring soon.</div>
              ) : expiringCerts.map(h => {
                const days = h.fields['Days Until Expiration'];
                return (
                  <div key={h.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.95rem' }}>
                    <span style={{ color: '#FFD700', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{h.fields['Name'] || 'Free Night'}</span>
                    <span style={{ color: '#FFD700', flexShrink: 0, marginLeft: 8 }}>{h.fields['Expiration Date'] || '—'} ({days}d)</span>
                  </div>
                );
              })}
            </div>
          </Block>

          <Block {...accents.chase} ready={portfolioReady} skeleton={<SkeletonListBlock rows={5} />}>
            <BlockTitle accent={accents.chase.accent}>Chase 5/24</BlockTitle>
            {personFilter === ALL_PEOPLE ? (
              <>
                <div style={{ fontSize: '1.6rem', fontWeight: 800, color: accents.chase.accent, marginBottom: 8 }}>
                  Users Over 5/24: {overCount}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5, overflowY: 'auto', flex: 1 }}>
                  {per524.map(p => (
                    <div key={p.name} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem' }}>
                      <span style={{ color: p.count >= 5 ? '#FF5C5C' : 'rgba(255,255,255,0.35)', fontWeight: p.count >= 5 ? 700 : 400 }}>{p.name}</span>
                      <span style={{ color: p.count >= 5 ? '#FF5C5C' : 'rgba(255,255,255,0.35)', fontWeight: p.count >= 5 ? 700 : 400 }}>{p.count}/24</span>
                    </div>
                  ))}
                </div>
              </>
            ) : selected524 && (
              <div style={{ display: 'flex', gap: '0.75rem', flex: 1 }}>
                <SubBox
                  label="Current Status"
                  value={`${selected524.count}/24`}
                  valueColor={selected524.count >= 5 ? '#FF5C5C' : '#00E676'}
                  accent={accents.chase.accent}
                  valueSize="1.7rem"
                />
                <SubBox
                  label="4/24 Date"
                  value={selected524.count <= 4 ? '✓ Eligible' : fmtDate(selected524.fourDate)}
                  valueColor={selected524.count <= 4 ? '#00E676' : '#fff'}
                  accent={accents.chase.accent}
                  valueSize={selected524.count <= 4 ? '1.4rem' : '1.5rem'}
                />
              </div>
            )}
          </Block>
        </div>
      </div>
    </div>
  );
}
