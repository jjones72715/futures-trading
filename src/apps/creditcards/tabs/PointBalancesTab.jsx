import { useState, useEffect } from 'react';
import { fetchTable } from '../services/airtable.js';
import { REWARDS_TABLE } from '../config/tables.js';
import { PEOPLE } from '../config/constants.js';

const PERSON_ID_BY_NAME = Object.fromEntries(Object.entries(PEOPLE).map(([id, name]) => [name, id]));

function fmt(n) {
  if (n == null) return '—';
  return n.toLocaleString();
}

function fmtDollar(n) {
  if (n == null) return '—';
  return `$${n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function fmtVPP(n) {
  if (n == null) return '—';
  return `$${Number(n).toFixed(3)}`;
}

function daysUntil(dateStr) {
  if (!dateStr) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(dateStr + 'T00:00:00');
  return Math.round((d - today) / (1000 * 60 * 60 * 24));
}

function fmtDate(dateStr) {
  if (!dateStr) return '—';
  const [y, m, d] = dateStr.split('-');
  return `${parseInt(m)}/${parseInt(d)}/${y}`;
}

const PROGRAM_COLORS = [
  '#00D4FF', '#FFD700', '#FF6B6B', '#4ECDC4', '#A78BFA',
  '#F97316', '#34D399', '#FB7185', '#60A5FA', '#FBBF24',
];

function programBadgeColor(name, index) {
  return PROGRAM_COLORS[index % PROGRAM_COLORS.length];
}

export function PointBalancesTab() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [personFilter, setPersonFilter] = useState('All');

  useEffect(() => {
    async function load() {
      setLoading(true);
      const rows = await fetchTable(REWARDS_TABLE, [
        'Program Name', 'Owner', 'Current Balance', 'Value Per Point',
        'Program Value', 'Expiration Date', 'Expiration Policy',
      ]);
      setRecords(rows);
      setLoading(false);
    }
    load();
  }, []);

  const enriched = records
    .map((r, i) => ({
      id: r.id,
      programName: r.fields['Program Name'] || '—',
      ownerIds: r.fields['Owner'] || [],
      currentBalance: r.fields['Current Balance'] ?? null,
      valuePerPoint: r.fields['Value Per Point'] ?? null,
      programValue: r.fields['Program Value'] ?? null,
      expirationDate: r.fields['Expiration Date'] || '',
      expirationPolicy: r.fields['Expiration Policy'] || '',
      colorIndex: i,
    }))
    .filter(r => r.currentBalance != null && r.currentBalance > 0);

  const filtered = enriched.filter(r => {
    if (personFilter === 'All') return true;
    const personId = PERSON_ID_BY_NAME[personFilter];
    return r.ownerIds.includes(personId);
  });

  const sorted = [...filtered].sort((a, b) => (b.programValue ?? 0) - (a.programValue ?? 0));

  const totalValue = sorted.reduce((s, r) => s + (r.programValue ?? 0), 0);
  const programsTracked = sorted.length;

  function PillBtn({ active, onClick, children }) {
    return (
      <button type="button" onClick={onClick} style={{
        padding: '5px 16px', borderRadius: 20, border: '1px solid rgba(255,255,255,0.12)',
        background: active ? '#00D4FF' : 'rgba(255,255,255,0.06)',
        color: active ? '#0B1220' : 'rgba(255,255,255,0.6)',
        fontWeight: active ? 700 : 400, cursor: 'pointer', fontSize: '0.82rem',
        transition: 'all 0.15s', whiteSpace: 'nowrap',
      }}>
        {children}
      </button>
    );
  }

  if (loading) {
    return (
      <div style={{ padding: '3rem', textAlign: 'center', color: 'rgba(255,255,255,0.4)' }}>
        Loading…
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', maxWidth: 1100 }}>

      {/* Stat row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, auto)', gap: '1rem', width: 'fit-content' }}>
        <div style={{ background: '#172033', borderRadius: 12, border: '1px solid rgba(255,255,255,0.08)', padding: '1rem 1.5rem' }}>
          <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600, marginBottom: 4 }}>
            Total Portfolio Value
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#00E676', lineHeight: 1 }}>
            {fmtDollar(totalValue)}
          </div>
        </div>
        <div style={{ background: '#172033', borderRadius: 12, border: '1px solid rgba(255,255,255,0.08)', padding: '1rem 1.5rem' }}>
          <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600, marginBottom: 4 }}>
            Programs Tracked
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#fff', lineHeight: 1 }}>
            {programsTracked}
          </div>
        </div>
      </div>

      {/* Person filter */}
      <div style={{ background: '#172033', borderRadius: 12, border: '1px solid rgba(255,255,255,0.08)', padding: '1rem 1.5rem' }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600, marginRight: 4 }}>Person</span>
          <PillBtn active={personFilter === 'All'} onClick={() => setPersonFilter('All')}>All</PillBtn>
          {Object.values(PEOPLE).map(name => (
            <PillBtn key={name} active={personFilter === name} onClick={() => setPersonFilter(name)}>{name}</PillBtn>
          ))}
        </div>
      </div>

      {/* Table */}
      {sorted.length === 0 ? (
        <div style={{ background: '#172033', borderRadius: 12, border: '1px solid rgba(255,255,255,0.08)', padding: '3rem', color: 'rgba(255,255,255,0.35)', textAlign: 'center' }}>
          No point balances found.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: '2fr 1fr 1.2fr 1fr 1.2fr 1fr 70px 2fr',
            gap: '0.75rem',
            padding: '0.5rem 1rem',
            fontSize: '0.68rem',
            color: 'rgba(255,255,255,0.3)',
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            fontWeight: 600,
          }}>
            <span>Program</span>
            <span>Owner</span>
            <span>Balance</span>
            <span>$/Point</span>
            <span>Value</span>
            <span>Expires</span>
            <span>Days</span>
            <span>Expiry Policy</span>
          </div>

          {sorted.map((row, i) => {
            const days = daysUntil(row.expirationDate);
            const expiringSoon = days != null && days < 60;
            const ownerNames = row.ownerIds.map(id => PEOPLE[id] || id).join(', ') || '—';
            const color = programBadgeColor(row.programName, i);
            return (
              <div key={row.id} style={{
                display: 'grid',
                gridTemplateColumns: '2fr 1fr 1.2fr 1fr 1.2fr 1fr 70px 2fr',
                gap: '0.75rem',
                alignItems: 'center',
                padding: '0.75rem 1rem',
                borderRadius: 10,
                background: '#172033',
                border: '1px solid rgba(255,255,255,0.06)',
              }}>
                <span>
                  <span style={{
                    display: 'inline-block',
                    padding: '2px 10px',
                    borderRadius: 12,
                    background: color + '22',
                    color: color,
                    fontWeight: 700,
                    fontSize: '0.82rem',
                    border: `1px solid ${color}44`,
                  }}>
                    {row.programName}
                  </span>
                </span>
                <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.85rem' }}>{ownerNames}</span>
                <span style={{ color: '#fff', fontWeight: 600, fontSize: '0.88rem' }}>{fmt(row.currentBalance)}</span>
                <span style={{ color: 'rgba(255,255,255,0.55)', fontSize: '0.85rem' }}>{fmtVPP(row.valuePerPoint)}</span>
                <span style={{ color: '#00E676', fontWeight: 700, fontSize: '0.88rem' }}>{fmtDollar(row.programValue)}</span>
                <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.82rem' }}>{fmtDate(row.expirationDate)}</span>
                <span style={{ fontSize: '0.82rem', color: expiringSoon ? '#FFD700' : 'rgba(255,255,255,0.5)', fontWeight: expiringSoon ? 700 : 400 }}>
                  {days != null ? days : '—'}
                </span>
                <span
                  title={row.expirationPolicy}
                  style={{
                    color: 'rgba(255,255,255,0.45)',
                    fontSize: '0.8rem',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    cursor: row.expirationPolicy ? 'help' : 'default',
                  }}
                >
                  {row.expirationPolicy || '—'}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
