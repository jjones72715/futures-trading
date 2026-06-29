import { useState, useEffect } from 'react';
import { fetchTable, updateRecord } from '../services/airtable.js';
import { HOTELS_TABLE, PORTFOLIO_TABLE } from '../config/tables.js';
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
  'Hotel Brand',
  'Benefit Type',
  'Estimated Value',
  'Expiration Date',
  'Days Until Expiration',
  'Expiring Soon',
  'Reset Cycle',
  'Next Reset Date',
  'How Earned',
  'Used',
];

function getPersonName(personIds) {
  if (!personIds || personIds.length === 0) return '—';
  return personIds.map(id => PEOPLE[id] || id).join(', ');
}

function SectionHeader({ title, count }) {
  return (
    <div style={{
      fontSize: '0.78rem', fontWeight: 700, color: 'rgba(255,255,255,0.45)',
      textTransform: 'uppercase', letterSpacing: '0.07em',
      paddingBottom: '0.5rem', borderBottom: '1px solid rgba(255,255,255,0.08)',
      display: 'flex', alignItems: 'center', gap: 8,
    }}>
      {title}
      <span style={{
        background: 'rgba(255,255,255,0.08)', borderRadius: 20,
        padding: '1px 8px', fontSize: '0.7rem', fontWeight: 600,
        color: 'rgba(255,255,255,0.35)',
      }}>{count}</span>
    </div>
  );
}

function BenefitTable({ rows, cardNames, toggling, onToggleUsed, columns, gridTemplate }) {
  if (rows.length === 0) {
    return (
      <div style={{ padding: '1.5rem', textAlign: 'center', color: 'rgba(255,255,255,0.3)', fontSize: '0.85rem' }}>
        No benefits found.
      </div>
    );
  }
  return (
    <div style={{ background: '#172033', borderRadius: 12, border: '1px solid rgba(255,255,255,0.08)', overflow: 'hidden' }}>
      <div style={{ display: 'grid', gridTemplateColumns: gridTemplate, gap: '0.75rem', padding: '0.5rem 1rem', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        {columns.map((h, i) => (
          <span key={i} style={{ fontSize: '0.7rem', fontWeight: 600, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            {h}
          </span>
        ))}
      </div>
      {rows.map(r => {
        const expiring = num(r.fields['Expiring Soon']) === 1;
        const days = num(r.fields['Days Until Expiration']);
        const cardIds = r.fields['Card'] || [];
        const personIds = r.fields['Person'] || [];
        const used = r.fields['Used'] || false;
        return (
          <div key={r.id} style={{
            display: 'grid', gridTemplateColumns: gridTemplate, gap: '0.75rem',
            padding: '0.65rem 1rem', borderBottom: '1px solid rgba(255,255,255,0.05)',
            background: expiring ? 'rgba(255,215,0,0.05)' : 'transparent',
            alignItems: 'center', opacity: used ? 0.4 : 1, transition: 'opacity 0.15s',
          }}>
            <span style={{ fontSize: '0.85rem', color: expiring ? '#FFD700' : '#fff', fontWeight: 500 }}>
              {cardIds.length ? cardIds.map(id => cardNames[id] || id).join(', ') : '—'}
            </span>
            <span style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.6)' }}>
              {r.fields['Hotel Brand'] || '—'}
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
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <input
                type="checkbox"
                checked={used}
                disabled={!!toggling[r.id]}
                onChange={() => onToggleUsed(r)}
                style={{ width: 18, height: 18, accentColor: '#00D4FF', cursor: 'pointer' }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function HotelsTab() {
  const [records, setRecords] = useState([]);
  const [cardNames, setCardNames] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedPerson, setSelectedPerson] = useState(ALL_PEOPLE);
  const [showUsed, setShowUsed] = useState(false);
  const [toggling, setToggling] = useState({});

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetchTable(HOTELS_TABLE, FIELDS),
      fetchTable(PORTFOLIO_TABLE, ['Card Name']),
    ])
      .then(([hotelData, cardData]) => {
        const nameMap = {};
        cardData.forEach(r => { nameMap[r.id] = r.fields['Card Name'] || r.id; });
        setCardNames(nameMap);
        setRecords(hotelData);
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  async function toggleUsed(record) {
    const current = record.fields['Used'] || false;
    const newVal = !current;
    setToggling(prev => ({ ...prev, [record.id]: true }));
    setRecords(prev => prev.map(r =>
      r.id === record.id ? { ...r, fields: { ...r.fields, 'Used': newVal } } : r
    ));
    try {
      await updateRecord(HOTELS_TABLE, record.id, { 'Used': newVal });
    } catch (e) {
      console.error('Hotel used toggle failed:', e);
      setRecords(prev => prev.map(r =>
        r.id === record.id ? { ...r, fields: { ...r.fields, 'Used': current } } : r
      ));
    } finally {
      setToggling(prev => { const n = { ...prev }; delete n[record.id]; return n; });
    }
  }

  const personFiltered = selectedPerson === ALL_PEOPLE
    ? records
    : records.filter(r => {
        const persons = r.fields['Person'] || [];
        const personId = Object.entries(PEOPLE).find(([, name]) => name === selectedPerson)?.[0];
        return personId ? persons.includes(personId) : true;
      });

  const visible = showUsed ? personFiltered : personFiltered.filter(r => !r.fields['Used']);

  function recordType(r) {
    const rt = r.fields['Record Type'];
    return rt ? (typeof rt === 'object' ? rt.name : rt) : '';
  }
  const freeNights = visible.filter(r => recordType(r) === 'Free Night');
  const hotelCredits = visible.filter(r => recordType(r) === 'Hotel Credit');

  const expiringSoon = visible.filter(r => num(r.fields['Expiring Soon']) === 1);
  const totalEstValue = visible.reduce((sum, r) => sum + (num(r.fields['Estimated Value']) || 0), 0);

  const COLS = ['Card', 'Brand', 'Person', 'Benefit Type', 'Est. Value', 'Expires', 'Days Left', 'Used'];
  const GRID = '2fr 100px 1fr 1.2fr 90px 90px 80px 60px';

  if (loading) {
    return <div style={{ padding: '3rem', textAlign: 'center', color: 'rgba(255,255,255,0.4)' }}>Loading hotel benefits…</div>;
  }

  if (error) {
    return <div style={{ padding: '2rem', color: '#FF4D4D' }}>Error: {error}</div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem' }}>
        <StatCard label="Active Free Nights" value={freeNights.length} />
        <StatCard label="Total Estimated Value" value={$$(totalEstValue)} accent="#00E676" />
      </div>

      {/* Expiring soon banner */}
      {expiringSoon.length > 0 && (
        <div style={{
          background: 'rgba(255,215,0,0.1)', border: '1px solid rgba(255,215,0,0.4)',
          borderRadius: 10, padding: '0.85rem 1.1rem',
          display: 'flex', flexDirection: 'column', gap: '0.4rem',
        }}>
          <span style={{ color: '#FFD700', fontWeight: 700, fontSize: '0.88rem' }}>Expiring Soon</span>
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
        <PersonFilter selected={selectedPerson} onChange={setSelectedPerson} />
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>Show</span>
          <button type="button" onClick={() => setShowUsed(false)} style={{
            padding: '5px 16px', borderRadius: 20, border: '1px solid rgba(255,255,255,0.12)',
            background: !showUsed ? '#00D4FF' : 'rgba(255,255,255,0.06)',
            color: !showUsed ? '#0B1220' : 'rgba(255,255,255,0.6)',
            fontWeight: !showUsed ? 700 : 400, cursor: 'pointer', fontSize: '0.82rem',
          }}>Available Only</button>
          <button type="button" onClick={() => setShowUsed(true)} style={{
            padding: '5px 16px', borderRadius: 20, border: '1px solid rgba(255,255,255,0.12)',
            background: showUsed ? '#00D4FF' : 'rgba(255,255,255,0.06)',
            color: showUsed ? '#0B1220' : 'rgba(255,255,255,0.6)',
            fontWeight: showUsed ? 700 : 400, cursor: 'pointer', fontSize: '0.82rem',
          }}>Show All</button>
        </div>
      </div>

      {/* Free Nights section */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        <SectionHeader title="Free Nights" count={freeNights.length} />
        <BenefitTable rows={freeNights} cardNames={cardNames} toggling={toggling} onToggleUsed={toggleUsed} columns={COLS} gridTemplate={GRID} />
      </div>

      {/* Hotel Credits section */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        <SectionHeader title="Hotel Credits" count={hotelCredits.length} />
        <BenefitTable rows={hotelCredits} cardNames={cardNames} toggling={toggling} onToggleUsed={toggleUsed} columns={COLS} gridTemplate={GRID} />
      </div>
    </div>
  );
}
