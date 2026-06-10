import { useState, useEffect } from 'react';
import { fetchTable } from '../services/airtable.js';
import { HOTELS_TABLE } from '../config/tables.js';
import { PEOPLE, ALL_PEOPLE } from '../config/constants.js';
import { $$ } from '../utils/format.js';
import { StatCard } from '../components/StatCard.jsx';
import { PersonFilter } from '../components/PersonFilter.jsx';

function num(v) {
  if (v == null || typeof v === 'object') return null;
  const n = Number(v);
  return isFinite(n) ? n : null;
}

const FIELDS = [
  'Name',
  'Card',
  'Person',
  'Record Type',
  'Benefit Type',
  'Estimated Value',
  'Expiration Date',
  'Days Until Expiration',
  'Expiring Soon',
  'Reset Cycle',
  'Next Reset Date',
  'How Earned',
];

const TYPE_FILTERS = ['All', 'Free Nights', 'Hotel Credits'];

function getPersonName(personIds) {
  if (!personIds || personIds.length === 0) return '—';
  return personIds
    .map(id => PEOPLE[id] || id)
    .join(', ');
}

export function HotelsTab() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedPerson, setSelectedPerson] = useState(ALL_PEOPLE);
  const [typeFilter, setTypeFilter] = useState('All');

  useEffect(() => {
    setLoading(true);
    fetchTable(HOTELS_TABLE, FIELDS)
      .then(data => setRecords(data))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const personFiltered = selectedPerson === ALL_PEOPLE
    ? records
    : records.filter(r => {
        const persons = r.fields['Person'] || [];
        const personId = Object.entries(PEOPLE).find(([, name]) => name === selectedPerson)?.[0];
        return personId ? persons.includes(personId) : true;
      });

  const typeFiltered = typeFilter === 'All'
    ? personFiltered
    : personFiltered.filter(r => {
        const rt = r.fields['Record Type'];
        if (typeFilter === 'Free Nights') return rt === 'Free Night';
        if (typeFilter === 'Hotel Credits') return rt === 'Hotel Credit';
        return true;
      });

  const expiringSoon = typeFiltered.filter(r => num(r.fields['Expiring Soon']) === 1);
  const freeNightCount = typeFiltered.filter(r => r.fields['Record Type'] === 'Free Night').length;
  const totalEstValue = typeFiltered.reduce((sum, r) => sum + (num(r.fields['Estimated Value']) || 0), 0);

  if (loading) {
    return (
      <div style={{ padding: '3rem', textAlign: 'center', color: 'rgba(255,255,255,0.4)' }}>
        Loading hotel benefits…
      </div>
    );
  }

  if (error) {
    return <div style={{ padding: '2rem', color: '#FF4D4D' }}>Error: {error}</div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem' }}>
        <StatCard label="Active Free Nights" value={freeNightCount} />
        <StatCard label="Total Estimated Value" value={$$(totalEstValue)} accent="#00E676" />
      </div>

      {/* Expiring soon banner */}
      {expiringSoon.length > 0 && (
        <div style={{
          background: 'rgba(255, 215, 0, 0.1)',
          border: '1px solid rgba(255, 215, 0, 0.4)',
          borderRadius: 10,
          padding: '0.85rem 1.1rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.4rem',
        }}>
          <span style={{ color: '#FFD700', fontWeight: 700, fontSize: '0.88rem' }}>
            Expiring Soon
          </span>
          {expiringSoon.map(r => {
            const days = num(r.fields['Days Until Expiration']);
            const name = r.fields['Name'] || r.fields['Benefit Type'] || 'Benefit';
            return (
              <span key={r.id} style={{ color: '#FFD700', fontSize: '0.82rem' }}>
                {name} — {days === 0 ? 'expires today' : `${days} day${days !== 1 ? 's' : ''} remaining`}
              </span>
            );
          })}
        </div>
      )}

      {/* Filters */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {TYPE_FILTERS.map(f => (
            <button
              key={f}
              onClick={() => setTypeFilter(f)}
              style={{
                padding: '0.35rem 0.85rem',
                borderRadius: 20,
                border: typeFilter === f ? '1px solid #00D4FF' : '1px solid rgba(255,255,255,0.15)',
                background: typeFilter === f ? 'rgba(0,212,255,0.15)' : 'transparent',
                color: typeFilter === f ? '#00D4FF' : 'rgba(255,255,255,0.5)',
                fontSize: '0.8rem',
                cursor: 'pointer',
                fontWeight: typeFilter === f ? 600 : 400,
              }}
            >
              {f}
            </button>
          ))}
        </div>
        <PersonFilter selected={selectedPerson} onChange={setSelectedPerson} />
      </div>

      {/* Table */}
      <div style={{
        background: '#172033',
        borderRadius: 12,
        border: '1px solid rgba(255,255,255,0.08)',
        overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '2fr 1fr 1.2fr 90px 90px 80px',
          gap: '0.75rem',
          padding: '0.5rem 1rem',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
        }}>
          {['Card', 'Person', 'Benefit Type', 'Est. Value', 'Expires', 'Days Left'].map((h, i) => (
            <span key={i} style={{
              fontSize: '0.7rem',
              fontWeight: 600,
              color: 'rgba(255,255,255,0.35)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}>
              {h}
            </span>
          ))}
        </div>

        {/* Rows */}
        {typeFiltered.map(r => {
          const expiring = num(r.fields['Expiring Soon']) === 1;
          const days = num(r.fields['Days Until Expiration']);
          const cardNames = r.fields['Card'];
          const personIds = r.fields['Person'] || [];
          return (
            <div
              key={r.id}
              style={{
                display: 'grid',
                gridTemplateColumns: '2fr 1fr 1.2fr 90px 90px 80px',
                gap: '0.75rem',
                padding: '0.65rem 1rem',
                borderBottom: '1px solid rgba(255,255,255,0.05)',
                background: expiring ? 'rgba(255, 215, 0, 0.05)' : 'transparent',
                alignItems: 'center',
              }}
            >
              <span style={{ fontSize: '0.85rem', color: expiring ? '#FFD700' : '#fff', fontWeight: 500 }}>
                {Array.isArray(cardNames) ? cardNames.join(', ') : (cardNames || '—')}
              </span>
              <span style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.7)' }}>
                {getPersonName(personIds)}
              </span>
              <span style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.7)' }}>
                {r.fields['Benefit Type'] || '—'}
              </span>
              <span style={{ fontSize: '0.82rem', color: '#00E676' }}>
                {num(r.fields['Estimated Value']) != null ? $$(num(r.fields['Estimated Value'])) : '—'}
              </span>
              <span style={{ fontSize: '0.82rem', color: expiring ? '#FFD700' : 'rgba(255,255,255,0.6)' }}>
                {r.fields['Expiration Date'] || '—'}
              </span>
              <span style={{
                fontSize: '0.82rem',
                color: expiring ? '#FFD700' : (days !== null && days <= 90 ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,0.4)'),
                fontWeight: expiring ? 600 : 400,
              }}>
                {days !== null ? days : '—'}
              </span>
            </div>
          );
        })}

        {typeFiltered.length === 0 && (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'rgba(255,255,255,0.3)' }}>
            No hotel benefits found.
          </div>
        )}
      </div>
    </div>
  );
}
