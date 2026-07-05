import { useState, useEffect } from 'react';
import { fetchTable } from '../services/airtable.js';
import { PORTFOLIO_TABLE, REWARDS_TABLE, PEOPLE_TABLE } from '../config/tables.js';
import { PEOPLE, ALL_PEOPLE } from '../config/constants.js';
import { $$ } from '../utils/format.js';
import { StatCard } from '../components/StatCard.jsx';
import { PersonFilter } from '../components/PersonFilter.jsx';
import { CardRow } from '../components/CardRow.jsx';

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

function resolveIssuer(raw) {
  if (!raw) return 'Unknown';
  if (Array.isArray(raw)) return BANK_NAMES[raw[0]] || raw[0] || 'Unknown';
  return BANK_NAMES[raw] || raw;
}

const FIELDS = [
  'Card Name',
  'Issuer',
  'Personal/Business',
  'Rewards Program',
  'Annual Fee Amount',
  'Days Until Annual Fee',
  'Annual Fee Status',
  'Cancel Risk Level',
  'Status',
  'Owner',
  'Authorized Users',
];

function buildIssuerGroups(cards) {
  const map = {};
  cards.forEach(card => {
    const issuer = resolveIssuer(card.fields['Issuer']);
    if (!map[issuer]) map[issuer] = [];
    map[issuer].push(card);
  });
  return Object.keys(map)
    .sort((a, b) => a.localeCompare(b))
    .map(issuer => ({
      issuer,
      cards: map[issuer].sort((a, b) => {
        const da = a.fields['Days Until Annual Fee'] ?? Infinity;
        const db = b.fields['Days Until Annual Fee'] ?? Infinity;
        return da - db;
      }),
    }));
}

export function PortfolioTab() {
  const [cards, setCards] = useState([]);
  const [programNameById, setProgramNameById] = useState({});
  const [personNameById, setPersonNameById] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedPerson, setSelectedPerson] = useState(ALL_PEOPLE);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetchTable(PORTFOLIO_TABLE, FIELDS),
      fetchTable(REWARDS_TABLE, ['Program Name']),
      fetchTable(PEOPLE_TABLE, ['Name']),
    ])
      .then(([records, programRows, peopleRows]) => {
        const active = records.filter(r => r.fields['Status'] === 'Active');
        setCards(active);
        setProgramNameById(Object.fromEntries(programRows.map(p => [p.id, p.fields['Program Name'] || p.id])));
        setPersonNameById(Object.fromEntries(peopleRows.map(p => [p.id, p.fields['Name'] || p.id])));
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const visibleCards = selectedPerson === ALL_PEOPLE
    ? cards
    : cards.filter(c => {
        const owner = c.fields['Owner'];
        const owners = Array.isArray(owner) ? owner : (owner ? [owner] : []);
        const personId = Object.entries(PEOPLE).find(([, name]) => name === selectedPerson)?.[0];
        return personId ? owners.includes(personId) : true;
      });

  const totalFees = visibleCards.reduce((sum, c) => sum + (c.fields['Annual Fee Amount'] || 0), 0);
  const dueSoon = visibleCards.filter(c => (c.fields['Days Until Annual Fee'] ?? Infinity) <= 60).length;
  const issuerGroups = buildIssuerGroups(visibleCards);

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
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
        <StatCard label="Total Active Cards" value={visibleCards.length} />
        <StatCard label="Total Annual Fees" value={$$(totalFees)} accent="#00E676" />
        <StatCard label="Cards Due Soon (≤60d)" value={dueSoon} accent="#FFD60A" />
      </div>

      <PersonFilter selected={selectedPerson} onChange={setSelectedPerson} />

      {issuerGroups.map(group => {
        const groupFees = group.cards.reduce((sum, c) => sum + (c.fields['Annual Fee Amount'] || 0), 0);
        return (
          <div key={group.issuer} style={{
            background: '#172033',
            borderRadius: 12,
            border: '1px solid rgba(255,255,255,0.08)',
            overflow: 'hidden',
          }}>
            <div style={{
              padding: '0.85rem 1rem',
              borderBottom: '1px solid rgba(255,255,255,0.08)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}>
              <span style={{ fontWeight: 700, color: '#00D4FF', fontSize: '0.95rem' }}>
                {group.issuer}
                <span style={{ marginLeft: 8, fontSize: '0.8rem', color: 'rgba(255,255,255,0.4)', fontWeight: 400 }}>
                  {group.cards.length} card{group.cards.length !== 1 ? 's' : ''}
                </span>
              </span>
              <span style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.6)' }}>
                {$$(groupFees)} / yr
              </span>
            </div>

            <div style={{
              display: 'grid',
              gridTemplateColumns: '2fr 1fr 90px 1fr 80px 70px 110px 70px 80px',
              gap: '0.75rem',
              padding: '0.5rem 1rem',
              borderBottom: '1px solid rgba(255,255,255,0.05)',
            }}>
              {['Card', 'Type', 'Rewards', 'Annual Fee', 'Days', 'AF Status', 'Risk', 'AUs', ''].map((h, i) => (
                <span key={i} style={{ fontSize: '0.7rem', fontWeight: 600, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  {h}
                </span>
              ))}
            </div>

            {group.cards.map(card => (
              <CardRow key={card.id} card={card} programNameById={programNameById} personNameById={personNameById} />
            ))}
          </div>
        );
      })}

      {issuerGroups.length === 0 && (
        <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.3)', padding: '3rem' }}>
          No active cards found.
        </div>
      )}
    </div>
  );
}
