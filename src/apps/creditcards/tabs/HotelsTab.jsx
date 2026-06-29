import { useState, useEffect } from 'react';
import { fetchTable, updateRecord } from '../services/airtable.js';
import { HOTELS_TABLE, PORTFOLIO_TABLE, PERK_INSTANCES_TABLE } from '../config/tables.js';
import { PEOPLE, ALL_PEOPLE } from '../config/constants.js';
import { $$ } from '../utils/format.js';
import { StatCard } from '../components/StatCard.jsx';
import { PersonFilter } from '../components/PersonFilter.jsx';

function num(v) {
  if (v == null || typeof v === 'object') return null;
  const n = Number(v);
  return isFinite(n) ? n : null;
}

function daysUntil(dateStr) {
  if (!dateStr) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(dateStr + 'T00:00:00');
  return Math.round((d - today) / (1000 * 60 * 60 * 24));
}

function sortByDate(records, dateField) {
  return [...records].sort((a, b) => {
    const da = a.fields[dateField];
    const db = b.fields[dateField];
    if (!da && !db) return 0;
    if (!da) return 1;
    if (!db) return -1;
    return da.localeCompare(db);
  });
}

function urgencyStyle(days) {
  if (days === null) return {};
  if (days <= 30) return { background: 'rgba(255,215,0,0.08)', borderLeft: '3px solid #FFD700' };
  if (days <= 90) return { background: 'rgba(255,140,0,0.06)', borderLeft: '3px solid #FF8C00' };
  return {};
}

function extractSelectName(v) {
  if (!v) return null;
  if (Array.isArray(v)) return v[0]?.name || v[0] || null;
  if (typeof v === 'object') return v.name || null;
  return v;
}

const HOTEL_FIELDS = [
  'Name', 'Card', 'Person', 'Record Type', 'Hotel Brand', 'Benefit Type',
  'Estimated Value', 'Expiration Date', 'Days Until Expiration', 'Expiring Soon',
  'Reset Cycle', 'Next Reset Date', 'How Earned', 'Used',
];

const PERK_FIELDS = ['Label', 'Card', 'Person', 'Used', 'Credit Amount', 'Credit Type', 'Next Reset Date'];

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

export function HotelsTab() {
  const [hotelRecords, setHotelRecords] = useState([]);
  const [perkCredits, setPerkCredits] = useState([]);
  const [cardNames, setCardNames] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedPerson, setSelectedPerson] = useState(ALL_PEOPLE);
  const [showUsed, setShowUsed] = useState(false);
  const [toggling, setToggling] = useState({});

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetchTable(HOTELS_TABLE, HOTEL_FIELDS),
      fetchTable(PERK_INSTANCES_TABLE, PERK_FIELDS),
      fetchTable(PORTFOLIO_TABLE, ['Card Name']),
    ])
      .then(([hotelData, perkData, cardData]) => {
        const nameMap = {};
        cardData.forEach(r => { nameMap[r.id] = r.fields['Card Name'] || r.id; });
        setCardNames(nameMap);
        setHotelRecords(hotelData);
        const credits = perkData.filter(r => {
          const ct = extractSelectName(r.fields['Credit Type']);
          return ct === 'Hotel Credit';
        });
        setPerkCredits(credits);
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  async function toggleHotelUsed(record) {
    const current = record.fields['Used'] || false;
    const newVal = !current;
    setToggling(prev => ({ ...prev, [record.id]: true }));
    setHotelRecords(prev => prev.map(r =>
      r.id === record.id ? { ...r, fields: { ...r.fields, 'Used': newVal } } : r
    ));
    try {
      await updateRecord(HOTELS_TABLE, record.id, { 'Used': newVal });
    } catch (e) {
      console.error('Toggle failed:', e);
      setHotelRecords(prev => prev.map(r =>
        r.id === record.id ? { ...r, fields: { ...r.fields, 'Used': current } } : r
      ));
    } finally {
      setToggling(prev => { const n = { ...prev }; delete n[record.id]; return n; });
    }
  }

  async function togglePerkUsed(record) {
    const current = record.fields['Used'] || false;
    const newVal = !current;
    setToggling(prev => ({ ...prev, [record.id]: true }));
    setPerkCredits(prev => prev.map(r =>
      r.id === record.id ? { ...r, fields: { ...r.fields, 'Used': newVal } } : r
    ));
    try {
      await updateRecord(PERK_INSTANCES_TABLE, record.id, { 'Used': newVal });
    } catch (e) {
      console.error('Toggle failed:', e);
      setPerkCredits(prev => prev.map(r =>
        r.id === record.id ? { ...r, fields: { ...r.fields, 'Used': current } } : r
      ));
    } finally {
      setToggling(prev => { const n = { ...prev }; delete n[record.id]; return n; });
    }
  }

  function filterByPerson(records, personField) {
    if (selectedPerson === ALL_PEOPLE) return records;
    return records.filter(r => {
      const persons = r.fields[personField] || [];
      const personId = Object.entries(PEOPLE).find(([, name]) => name === selectedPerson)?.[0];
      return personId ? persons.includes(personId) : true;
    });
  }

  const visibleHotels = filterByPerson(hotelRecords, 'Person').filter(r => showUsed || !r.fields['Used']);
  const visibleCredits = filterByPerson(perkCredits, 'Person').filter(r => showUsed || !r.fields['Used']);

  const freeNights = sortByDate(visibleHotels.filter(r => extractSelectName(r.fields['Record Type']) === 'Free Night'), 'Expiration Date');
  const hotelCredits = sortByDate(visibleCredits, 'Next Reset Date');

  const expiringSoon = visibleHotels.filter(r => num(r.fields['Expiring Soon']) === 1);

  if (loading) return <div style={{ padding: '3rem', textAlign: 'center', color: 'rgba(255,255,255,0.4)' }}>Loading hotel benefits…</div>;
  if (error) return <div style={{ padding: '2rem', color: '#FF4D4D' }}>Error: {error}</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
        <StatCard label="Free Nights" value={freeNights.length} />
        <StatCard label="Hotel Credits" value={hotelCredits.length} />
        <StatCard label="Total Est. Value" value={$$(
          freeNights.reduce((s, r) => s + (num(r.fields['Estimated Value']) || 0), 0) +
          hotelCredits.reduce((s, r) => s + (r.fields['Credit Amount'] || 0), 0)
        )} accent="#00E676" />
      </div>

      {/* Expiring soon banner */}
      {expiringSoon.length > 0 && (
        <div style={{ background: 'rgba(255,215,0,0.1)', border: '1px solid rgba(255,215,0,0.4)', borderRadius: 10, padding: '0.85rem 1.1rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
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
          <button type="button" onClick={() => setShowUsed(false)} style={{ padding: '5px 16px', borderRadius: 20, border: '1px solid rgba(255,255,255,0.12)', background: !showUsed ? '#00D4FF' : 'rgba(255,255,255,0.06)', color: !showUsed ? '#0B1220' : 'rgba(255,255,255,0.6)', fontWeight: !showUsed ? 700 : 400, cursor: 'pointer', fontSize: '0.82rem' }}>Available Only</button>
          <button type="button" onClick={() => setShowUsed(true)} style={{ padding: '5px 16px', borderRadius: 20, border: '1px solid rgba(255,255,255,0.12)', background: showUsed ? '#00D4FF' : 'rgba(255,255,255,0.06)', color: showUsed ? '#0B1220' : 'rgba(255,255,255,0.6)', fontWeight: showUsed ? 700 : 400, cursor: 'pointer', fontSize: '0.82rem' }}>Show All</button>
        </div>
      </div>

      {/* Free Nights */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        <SectionHeader title="Free Nights" count={freeNights.length} />
        <div style={{ background: '#172033', borderRadius: 12, border: '1px solid rgba(255,255,255,0.08)', overflow: 'hidden' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 100px 1fr 1.2fr 90px 90px 80px 60px', gap: '0.75rem', padding: '0.5rem 1rem', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
            {['Card', 'Brand', 'Person', 'Benefit Type', 'Est. Value', 'Expires', 'Days Left', 'Used'].map((h, i) => (
              <span key={i} style={{ fontSize: '0.7rem', fontWeight: 600, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</span>
            ))}
          </div>
          {freeNights.length === 0 ? (
            <div style={{ padding: '1.5rem', textAlign: 'center', color: 'rgba(255,255,255,0.3)', fontSize: '0.85rem' }}>No free nights found.</div>
          ) : freeNights.map(r => {
            const days = num(r.fields['Days Until Expiration']) ?? daysUntil(r.fields['Expiration Date']);
            const urgent = days !== null && days <= 30;
            const warning = !urgent && days !== null && days <= 90;
            const cardIds = r.fields['Card'] || [];
            const personIds = r.fields['Person'] || [];
            const used = r.fields['Used'] || false;
            const highlight = urgencyStyle(days);
            const dateColor = urgent ? '#FFD700' : warning ? '#FF8C00' : 'rgba(255,255,255,0.6)';
            return (
              <div key={r.id} style={{ display: 'grid', gridTemplateColumns: '2fr 100px 1fr 1.2fr 90px 90px 80px 60px', gap: '0.75rem', padding: '0.65rem 1rem', borderBottom: '1px solid rgba(255,255,255,0.05)', alignItems: 'center', opacity: used ? 0.4 : 1, ...highlight }}>
                <span style={{ fontSize: '0.85rem', color: urgent ? '#FFD700' : warning ? '#FF8C00' : '#fff', fontWeight: 500 }}>{cardIds.map(id => cardNames[id] || id).join(', ') || '—'}</span>
                <span style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.6)' }}>{r.fields['Hotel Brand'] || '—'}</span>
                <span style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.7)' }}>{getPersonName(personIds)}</span>
                <span style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.7)' }}>{r.fields['Benefit Type'] || '—'}</span>
                <span style={{ fontSize: '0.82rem', color: '#00E676' }}>{num(r.fields['Estimated Value']) != null ? $$(num(r.fields['Estimated Value'])) : '—'}</span>
                <span style={{ fontSize: '0.82rem', color: dateColor, fontWeight: (urgent || warning) ? 600 : 400 }}>{r.fields['Expiration Date'] || '—'}</span>
                <span style={{ fontSize: '0.82rem', color: dateColor, fontWeight: (urgent || warning) ? 600 : 400 }}>{days !== null ? days : '—'}</span>
                <div style={{ display: 'flex', justifyContent: 'center' }}>
                  <input type="checkbox" checked={used} disabled={!!toggling[r.id]} onChange={() => toggleHotelUsed(r)} style={{ width: 18, height: 18, accentColor: '#00D4FF', cursor: 'pointer' }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Hotel Credits */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        <SectionHeader title="Hotel Credits" count={hotelCredits.length} />
        <div style={{ background: '#172033', borderRadius: 12, border: '1px solid rgba(255,255,255,0.08)', overflow: 'hidden' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 2fr 1fr 100px 1.2fr 60px', gap: '0.75rem', padding: '0.5rem 1rem', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
            {['Card', 'Perk', 'Person', 'Amount', 'Next Reset', 'Used'].map((h, i) => (
              <span key={i} style={{ fontSize: '0.7rem', fontWeight: 600, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</span>
            ))}
          </div>
          {hotelCredits.length === 0 ? (
            <div style={{ padding: '1.5rem', textAlign: 'center', color: 'rgba(255,255,255,0.3)', fontSize: '0.85rem' }}>No hotel credits found.</div>
          ) : hotelCredits.map(r => {
            const cardIds = r.fields['Card'] || [];
            const personIds = r.fields['Person'] || [];
            const used = r.fields['Used'] || false;
            const nextReset = r.fields['Next Reset Date'];
            const days = daysUntil(nextReset);
            const urgent = days !== null && days <= 30;
            const warning = !urgent && days !== null && days <= 90;
            const highlight = urgencyStyle(days);
            const dateColor = urgent ? '#FFD700' : warning ? '#FF8C00' : 'rgba(255,255,255,0.6)';
            return (
              <div key={r.id} style={{ display: 'grid', gridTemplateColumns: '2fr 2fr 1fr 100px 1.2fr 60px', gap: '0.75rem', padding: '0.65rem 1rem', borderBottom: '1px solid rgba(255,255,255,0.05)', alignItems: 'center', opacity: used ? 0.4 : 1, ...highlight }}>
                <span style={{ fontSize: '0.85rem', color: urgent ? '#FFD700' : warning ? '#FF8C00' : '#fff', fontWeight: 500 }}>{cardIds.map(id => cardNames[id] || id).join(', ') || '—'}</span>
                <span style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.7)' }}>{r.fields['Label'] || '—'}</span>
                <span style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.7)' }}>{getPersonName(personIds)}</span>
                <span style={{ fontSize: '0.82rem', color: '#00D4FF', fontWeight: 700 }}>{r.fields['Credit Amount'] != null ? `$${r.fields['Credit Amount']}` : '—'}</span>
                <span style={{ fontSize: '0.82rem', color: dateColor, fontWeight: (urgent || warning) ? 600 : 400 }}>{nextReset || '—'}</span>
                <div style={{ display: 'flex', justifyContent: 'center' }}>
                  <input type="checkbox" checked={used} disabled={!!toggling[r.id]} onChange={() => togglePerkUsed(r)} style={{ width: 18, height: 18, accentColor: '#00D4FF', cursor: 'pointer' }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
