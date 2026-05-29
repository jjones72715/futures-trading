import { useState, useEffect } from 'react';
import { fetchTable } from '../services/airtable.js';
import { PORTFOLIO_TABLE } from '../config/tables.js';
import { PEOPLE, ALL_PEOPLE } from '../config/constants.js';
import { $$ } from '../utils/format.js';
import { StatCard } from '../components/StatCard.jsx';
import { PersonFilter } from '../components/PersonFilter.jsx';
import { CardRow } from '../components/CardRow.jsx';

const FIELDS = [
  'Card Name',
  'Issuer',
  'Personal/Business',
  'Program Name (from Rewards Program)',
  'Annual Fee Amount',
  'Days Until Annual Fee',
  'Annual Fee Status',
  'Cancel Risk Level',
  'Status',
  'Owner',
];

export function PortfolioTab() {
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedPerson, setSelectedPerson] = useState(ALL_PEOPLE);

  useEffect(() => {
    setLoading(true);
    fetchTable(PORTFOLIO_TABLE, FIELDS)
      .then(records => {
        const active = records.filter(r => r.fields['Status']?.name === 'Active');
        setCards(active);
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const totalFees = cards.reduce((sum, c) => sum + (c.fields['Annual Fee Amount'] || 0), 0);
  const dueSoon = cards.filter(c => (c.fields['Days Until Annual Fee'] ?? Infinity) <= 60).length;

  const personGroups = Object.entries(PEOPLE).map(([id, name]) => ({
    id,
    name,
    cards: cards
      .filter(c => {
        const owner = c.fields['Owner'];
        const owners = Array.isArray(owner) ? owner : (owner ? [owner] : []);
        return owners.some(o => (typeof o === 'object' ? o.id : o) === id);
      })
      .sort((a, b) => {
        const da = a.fields['Days Until Annual Fee'] ?? Infinity;
        const db = b.fields['Days Until Annual Fee'] ?? Infinity;
        return da - db;
      }),
  })).filter(g => g.cards.length > 0);

  const filteredGroups = selectedPerson === ALL_PEOPLE
    ? personGroups
    : personGroups.filter(g => g.name === selectedPerson);

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
        <StatCard label="Total Active Cards" value={cards.length} />
        <StatCard label="Total Annual Fees" value={$$(totalFees)} accent="#00E676" />
        <StatCard label="Cards Due Soon (≤60d)" value={dueSoon} accent="#FFD60A" />
      </div>

      <PersonFilter selected={selectedPerson} onChange={setSelectedPerson} />

      {filteredGroups.map(group => {
        const groupFees = group.cards.reduce((sum, c) => sum + (c.fields['Annual Fee Amount'] || 0), 0);
        return (
          <div key={group.id} style={{
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
              <span style={{ fontWeight: 700, color: '#fff', fontSize: '0.95rem' }}>
                {group.name}
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
              gridTemplateColumns: '2fr 1fr 90px 1fr 80px 70px 110px 80px',
              gap: '0.75rem',
              padding: '0.5rem 1rem',
              borderBottom: '1px solid rgba(255,255,255,0.05)',
            }}>
              {['Card', 'Type', 'Rewards', 'Annual Fee', 'Days', 'Status', 'Risk', ''].map((h, i) => (
                <span key={i} style={{ fontSize: '0.7rem', fontWeight: 600, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  {h}
                </span>
              ))}
            </div>

            {group.cards.map(card => (
              <CardRow key={card.id} card={card} />
            ))}
          </div>
        );
      })}

      {filteredGroups.length === 0 && (
        <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.3)', padding: '3rem' }}>
          No active cards found.
        </div>
      )}
    </div>
  );
}
