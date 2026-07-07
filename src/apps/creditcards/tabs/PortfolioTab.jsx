import { useState, useEffect, useCallback } from 'react';
import { fetchTable } from '../services/airtable.js';
import { PORTFOLIO_TABLE, PEOPLE_TABLE, PERK_INSTANCES_TABLE, SPEND_BONUSES_TABLE } from '../config/tables.js';
import { PEOPLE, ALL_PEOPLE } from '../config/constants.js';
import { $$, stripOwnerPrefix } from '../utils/format.js';
import { StatCard } from '../components/StatCard.jsx';
import { PersonFilter } from '../components/PersonFilter.jsx';
import { CardSummaryPanel, clearCardSummaryCache } from '../components/CardSummaryPanel.jsx';
import { TotalPerkValueCell, DifferenceCell } from '../components/NetValueGroup.jsx';
import { sumPerkValue } from '../utils/perks.js';
import { AddCardPanel } from '../components/AddCardPanel.jsx';
import { AddAuthorizedUserPanel } from '../components/AddAuthorizedUserPanel.jsx';

const BANK_NAMES = {
  'recmOSLhOAYVqi09z': 'American Express',
  'recirpPT41J9yWOso': 'Barclays',
  'recUwpGOntDp5O9Pn': 'Bank of America',
  'reci7K7HYue3nEx7e': 'Capital One',
  'recuAO5OVmsDNWW6D': 'Cardless',
  'recgw2ngVEO8gBpoq': 'Chase',
  'rec9ePERLvVM24fqx': 'Citi',
  'rec2BUeHI8gDyNcya': 'Discover',
  'rec8clRqXmQ4EjDEI': 'Mercury',
  'recRyPOXcDNKrWK53': 'U.S. Bank',
  'recRKg9TA1IQpRkmH': 'Wells Fargo',
};

const DECISION_COLORS = {
  Keep: '#00C853',
  Cancel: '#FF3D00',
  'Product Change': '#2979FF',
  Downgrade: '#FF6D00',
  Upgrade: '#00D4FF',
};

const DECISION_OPTIONS = ['All', 'Undecided', 'Keep', 'Cancel', 'Product Change', 'Downgrade', 'Upgrade'];
const TYPE_OPTIONS = ['All', 'Personal', 'Business'];

const PERSON_ID_BY_NAME = Object.fromEntries(Object.entries(PEOPLE).map(([id, name]) => [name, id]));

const FIELDS = [
  'Card Name',
  'Issuer',
  'Personal/Business',
  'Annual Fee Amount',
  'Days Until Annual Fee',
  'Decision',
  'Status',
  'Owner',
  'Authorized Users',
  'Last 4/Last 5 (AMEX)',
];

const PERK_INSTANCE_FIELDS = ['Card', 'Value'];
const SPEND_BONUS_FIELDS = ['Card', 'Value'];

const ROW_COLUMNS = '1.7fr 65px 80px 0.8fr 80px 100px 90px 65px 95px 120px 60px';

function resolveIssuer(raw) {
  if (!raw) return 'Unknown';
  const key = Array.isArray(raw) ? raw[0] : raw;
  return BANK_NAMES[key] || key || 'Unknown';
}

function daysUntilFeeColor(days) {
  if (days < 30) return '#FF4D4D';
  if (days < 60) return '#FFD60A';
  if (days < 90) return 'rgba(255,255,255,0.45)';
  return '#fff';
}

function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

function fmtDate(d) {
  if (!d) return '—';
  return `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`;
}

function PillBtn({ active, onClick, children }) {
  return (
    <button type="button" onClick={onClick} style={{
      padding: '6px 16px', borderRadius: 20, border: '1px solid rgba(255,255,255,0.12)',
      background: active ? '#00D4FF' : 'rgba(255,255,255,0.06)',
      color: active ? '#0B1220' : 'rgba(255,255,255,0.6)',
      fontWeight: active ? 700 : 400, cursor: 'pointer', fontSize: '0.85rem',
      transition: 'all 0.15s', whiteSpace: 'nowrap',
    }}>
      {children}
    </button>
  );
}

function FilterRow({ label, options, selected, onChange }) {
  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
      <span style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600, marginRight: 4 }}>
        {label}
      </span>
      {options.map(opt => (
        <PillBtn key={opt} active={selected === opt} onClick={() => onChange(opt)}>{opt}</PillBtn>
      ))}
    </div>
  );
}

function DecisionBadge({ decision }) {
  if (!decision) return <span style={{ color: 'rgba(255,255,255,0.3)' }}>—</span>;
  const color = DECISION_COLORS[decision] || 'rgba(255,255,255,0.4)';
  return (
    <span style={{
      display: 'inline-block', padding: '2px 10px', borderRadius: 20,
      fontSize: '0.72rem', fontWeight: 700, background: color + '22', color,
      border: `1px solid ${color}55`, whiteSpace: 'nowrap',
    }}>
      {decision}
    </span>
  );
}

function PortfolioRow({ card, personNameById, instances, onOpen }) {
  const [hovered, setHovered] = useState(false);
  const f = card.fields;
  const issuer = resolveIssuer(f['Issuer']);
  const cardType = f['Personal/Business'];
  const annualFee = f['Annual Fee Amount'] || 0;
  const days = f['Days Until Annual Fee'];
  const feeDate = annualFee > 0 && days != null ? addDays(new Date(), days) : null;
  const ownerIds = f['Owner'] || [];
  const ownerNames = ownerIds.map(id => personNameById[id] || id);
  const auIds = f['Authorized Users'] || [];
  const auNames = auIds.map(id => personNameById[id] || id);
  const { netValue, hasAnyValue } = sumPerkValue(instances);
  const cardName = stripOwnerPrefix(f['Card Name'], ownerIds.length ? PEOPLE[ownerIds[0]] : null) || '—';
  const last4 = f['Last 4/Last 5 (AMEX)'] || null;

  return (
    <div
      onClick={() => onOpen(card.id)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'grid',
        gridTemplateColumns: ROW_COLUMNS,
        alignItems: 'center',
        gap: '0.75rem',
        padding: '0.75rem 1rem',
        borderBottom: '1px solid rgba(255,255,255,0.05)',
        cursor: 'pointer',
        background: hovered ? 'rgba(0,212,255,0.06)' : 'transparent',
        transition: 'background 0.12s',
      }}
    >
      <div>
        <div style={{ fontWeight: 600, color: '#fff', fontSize: '0.9rem' }}>
          {cardName}
        </div>
        <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.45)', marginTop: 2 }}>
          {issuer}
        </div>
      </div>

      <div style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.5)' }}>
        {last4 ? `···${last4}` : '—'}
      </div>

      <div>
        {cardType && (
          <span style={{
            padding: '2px 10px', borderRadius: 20, fontSize: '0.72rem', fontWeight: 600,
            background: cardType === 'Business' ? 'rgba(0,212,255,0.12)' : 'rgba(255,255,255,0.08)',
            color: cardType === 'Business' ? '#00D4FF' : 'rgba(255,255,255,0.6)',
            border: `1px solid ${cardType === 'Business' ? '#00D4FF44' : 'rgba(255,255,255,0.12)'}`,
          }}>
            {cardType}
          </span>
        )}
      </div>

      <div style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.6)' }}>
        {ownerNames.join(', ') || '—'}
      </div>

      <div style={{ fontSize: '0.85rem' }}>
        {annualFee > 0
          ? <span style={{ color: '#fff' }}>{$$(annualFee)}</span>
          : <span style={{ color: 'rgba(255,255,255,0.4)' }}>No Fee</span>}
      </div>

      <div>
        {annualFee > 0
          ? <TotalPerkValueCell netValue={netValue} hasAnyValue={hasAnyValue} mode="portfolio" />
          : <span style={{ color: 'rgba(255,255,255,0.3)' }}>—</span>}
      </div>

      <div>
        {annualFee > 0
          ? <DifferenceCell netValue={netValue} annualFee={annualFee} hasAnyValue={hasAnyValue} mode="portfolio" />
          : <span style={{ color: 'rgba(255,255,255,0.3)' }}>—</span>}
      </div>

      <div style={{ fontSize: '0.82rem', fontWeight: days != null && days < 90 ? 700 : 400, color: annualFee > 0 && days != null ? daysUntilFeeColor(days) : 'transparent' }}>
        {annualFee > 0 && days != null ? `${days}d` : ''}
      </div>

      <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.6)' }}>
        {feeDate ? fmtDate(feeDate) : ''}
      </div>

      <div>
        <DecisionBadge decision={f['Decision']} />
      </div>

      <div
        style={{ fontSize: '0.9rem', color: 'rgba(255,255,255,0.6)', textAlign: 'center' }}
        title={auNames.length ? auNames.join(', ') : undefined}
      >
        {auNames.length ? '👤' : <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.82rem' }}>—</span>}
      </div>
    </div>
  );
}

export function PortfolioTab() {
  const [cards, setCards] = useState([]);
  const [personNameById, setPersonNameById] = useState({});
  const [instancesByCard, setInstancesByCard] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [personFilter, setPersonFilter] = useState(ALL_PEOPLE);
  const [typeFilter, setTypeFilter] = useState('All');
  const [issuerFilter, setIssuerFilter] = useState('All');
  const [decisionFilter, setDecisionFilter] = useState('All');

  const [panel, setPanel] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    return Promise.all([
      fetchTable(PORTFOLIO_TABLE, FIELDS, { filterByFormula: "{Status}='Active'" }),
      fetchTable(PEOPLE_TABLE, ['Name']),
      fetchTable(PERK_INSTANCES_TABLE, PERK_INSTANCE_FIELDS),
      fetchTable(SPEND_BONUSES_TABLE, SPEND_BONUS_FIELDS),
    ])
      .then(([records, peopleRows, perkInstances, spendBonuses]) => {
        setCards(records);
        setPersonNameById(Object.fromEntries(peopleRows.map(p => [p.id, p.fields['Name'] || p.id])));
        const byCard = {};
        [...perkInstances, ...spendBonuses].forEach(inst => {
          const cardId = (inst.fields['Card'] || [])[0];
          if (!cardId) return;
          if (!byCard[cardId]) byCard[cardId] = [];
          byCard[cardId].push(inst);
        });
        setInstancesByCard(byCard);
        setError(null);
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  function handleCardCreated() {
    clearCardSummaryCache();
    setPanel(null);
    load();
  }

  function handleAUSaved() {
    clearCardSummaryCache();
    setPanel(null);
    load();
  }

  const issuerOptions = ['All', ...new Set(cards.map(c => resolveIssuer(c.fields['Issuer'])))].sort((a, b) => {
    if (a === 'All') return -1;
    if (b === 'All') return 1;
    return a.localeCompare(b);
  });

  const visibleCards = cards.filter(c => {
    const f = c.fields;
    if (personFilter !== ALL_PEOPLE) {
      const owners = f['Owner'] || [];
      if (!owners.includes(PERSON_ID_BY_NAME[personFilter])) return false;
    }
    if (typeFilter !== 'All' && f['Personal/Business'] !== typeFilter) return false;
    if (issuerFilter !== 'All' && resolveIssuer(f['Issuer']) !== issuerFilter) return false;
    if (decisionFilter !== 'All') {
      const decision = f['Decision'] || '';
      if (decisionFilter === 'Undecided') {
        if (decision) return false;
      } else if (decision !== decisionFilter) {
        return false;
      }
    }
    return true;
  });

  const totalFees = visibleCards.reduce((sum, c) => sum + (c.fields['Annual Fee Amount'] || 0), 0);
  const dueSoon = visibleCards.filter(c => (c.fields['Days Until Annual Fee'] ?? Infinity) <= 60).length;

  const withFee = visibleCards
    .filter(c => (c.fields['Annual Fee Amount'] || 0) > 0)
    .sort((a, b) => (a.fields['Days Until Annual Fee'] ?? Infinity) - (b.fields['Days Until Annual Fee'] ?? Infinity));

  const noFee = visibleCards
    .filter(c => !((c.fields['Annual Fee Amount'] || 0) > 0))
    .sort((a, b) => (a.fields['Card Name'] || '').localeCompare(b.fields['Card Name'] || ''));

  if (loading) {
    return (
      <div style={{ padding: '3rem', textAlign: 'center', color: 'rgba(255,255,255,0.4)' }}>
        Loading cards…
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '2rem', color: '#FF4D4D' }}>
        Error: {error}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
        <button type="button" onClick={() => setPanel({ type: 'add-au' })} style={{
          padding: '0.5rem 1.1rem', borderRadius: 8, border: '1px solid rgba(0,212,255,0.3)',
          background: 'rgba(0,212,255,0.12)', color: '#00D4FF', fontWeight: 600, fontSize: '0.82rem', cursor: 'pointer',
        }}>
          + Add Authorized User
        </button>
        <button type="button" onClick={() => setPanel({ type: 'add-card' })} style={{
          padding: '0.5rem 1.1rem', borderRadius: 8, border: 'none',
          background: '#00D4FF', color: '#0B1220', fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer',
        }}>
          + Add a Card
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
        <StatCard label="Total Active Cards" value={visibleCards.length} />
        <StatCard label="Total Annual Fees" value={$$(totalFees)} accent="#00E676" />
        <StatCard label="Cards Due Soon (≤60d)" value={dueSoon} accent="#FFD60A" />
      </div>

      <div style={{
        background: '#172033', borderRadius: 12, border: '1px solid rgba(255,255,255,0.08)',
        padding: '1rem 1.25rem', display: 'flex', flexDirection: 'column', gap: '0.75rem',
      }}>
        <FilterRow label="Person" options={['All', ...Object.values(PEOPLE)]} selected={personFilter === ALL_PEOPLE ? 'All' : personFilter} onChange={v => setPersonFilter(v === 'All' ? ALL_PEOPLE : v)} />
        <FilterRow label="Type" options={TYPE_OPTIONS} selected={typeFilter} onChange={setTypeFilter} />
        <FilterRow label="Issuer" options={issuerOptions} selected={issuerFilter} onChange={setIssuerFilter} />
        <FilterRow label="Decision" options={DECISION_OPTIONS} selected={decisionFilter} onChange={setDecisionFilter} />
      </div>

      <div style={{
        background: '#172033', borderRadius: 12, border: '1px solid rgba(255,255,255,0.08)', overflow: 'hidden',
      }}>
        <div style={{
          display: 'grid', gridTemplateColumns: ROW_COLUMNS, gap: '0.75rem',
          padding: '0.5rem 1rem', borderBottom: '1px solid rgba(255,255,255,0.08)',
        }}>
          {['Card', 'Last 4/5', 'Type', 'Person', 'Annual Fee', 'Total Perk Value', 'Difference', 'Days', 'Fee Date', 'Decision', 'AUs'].map((h, i) => (
            <span key={i} style={{ fontSize: '0.7rem', fontWeight: 600, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {h}
            </span>
          ))}
        </div>

        {withFee.map(card => (
          <PortfolioRow key={card.id} card={card} personNameById={personNameById} instances={instancesByCard[card.id] || []} onOpen={id => setPanel({ type: 'card', id })} />
        ))}

        {noFee.length > 0 && (
          <div style={{
            padding: '0.5rem 1rem', fontSize: '0.7rem', fontWeight: 600, color: 'rgba(255,255,255,0.3)',
            textTransform: 'uppercase', letterSpacing: '0.06em', borderBottom: '1px solid rgba(255,255,255,0.08)',
            borderTop: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.02)',
          }}>
            No Annual Fee
          </div>
        )}

        {noFee.map(card => (
          <PortfolioRow key={card.id} card={card} personNameById={personNameById} instances={instancesByCard[card.id] || []} onOpen={id => setPanel({ type: 'card', id })} />
        ))}

        {visibleCards.length === 0 && (
          <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.3)', padding: '3rem' }}>
            No cards match the current filters.
          </div>
        )}
      </div>

      {panel?.type === 'card' && (
        <CardSummaryPanel cardId={panel.id} onClose={() => setPanel(null)} />
      )}
      {panel?.type === 'add-card' && (
        <AddCardPanel onClose={() => setPanel(null)} onCreated={handleCardCreated} />
      )}
      {panel?.type === 'add-au' && (
        <AddAuthorizedUserPanel cards={cards} personNameById={personNameById} onClose={() => setPanel(null)} onSaved={handleAUSaved} />
      )}
    </div>
  );
}
