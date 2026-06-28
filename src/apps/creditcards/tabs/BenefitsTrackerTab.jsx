import { useState, useEffect, useCallback } from 'react';
import { fetchTable, updateRecord } from '../services/airtable.js';
import { PERK_INSTANCES_TABLE, PERK_DEFINITIONS_TABLE, PORTFOLIO_TABLE } from '../config/tables.js';
import { PEOPLE } from '../config/constants.js';

const RESET_CYCLES = ['Monthly', 'Quarterly', 'Semi-Annual', 'Annual'];

const cardStyle = {
  background: '#172033', borderRadius: 12, border: '1px solid rgba(255,255,255,0.08)',
  padding: '1rem 1.5rem',
};

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

function StatCard({ label, value, accent }) {
  return (
    <div style={{
      background: '#172033', borderRadius: 12, border: '1px solid rgba(255,255,255,0.08)',
      padding: '1rem 1.5rem', display: 'flex', flexDirection: 'column', gap: 4,
    }}>
      <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>
        {label}
      </div>
      <div style={{ fontSize: '1.8rem', fontWeight: 800, color: accent || '#fff', lineHeight: 1 }}>
        {value}
      </div>
    </div>
  );
}

function fmt(dateStr) {
  if (!dateStr) return '—';
  const [y, m, d] = dateStr.split('-');
  return `${parseInt(m)}/${parseInt(d)}/${y}`;
}

function isResettingSoon(dateStr) {
  if (!dateStr) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const reset = new Date(dateStr + 'T00:00:00');
  const diff = (reset - today) / (1000 * 60 * 60 * 24);
  return diff >= 0 && diff <= 7;
}

export function BenefitsTrackerTab() {
  const [instances, setInstances] = useState([]);
  const [defsById, setDefsById] = useState({});
  const [cardsById, setCardsById] = useState({});
  const [loading, setLoading] = useState(true);
  const [personFilter, setPersonFilter] = useState('All');
  const [cycleFilter, setCycleFilter] = useState('All');
  const [showAll, setShowAll] = useState(false);
  const [toggling, setToggling] = useState({}); // recordId → true while patching

  const load = useCallback(async () => {
    const [inst, defs, cards] = await Promise.all([
      fetchTable(PERK_INSTANCES_TABLE, ['Label', 'Perk Definition', 'Card', 'Person', 'Used', 'Next Reset Date']),
      fetchTable(PERK_DEFINITIONS_TABLE, ['Perk Name', 'Credit Amount', 'Reset Cycle', 'Priority Score']),
      fetchTable(PORTFOLIO_TABLE, ['Card Name']),
    ]);

    const defMap = {};
    defs.forEach(r => { defMap[r.id] = r.fields; });

    const cardMap = {};
    cards.forEach(r => { cardMap[r.id] = r.fields['Card Name'] || r.id; });

    setDefsById(defMap);
    setCardsById(cardMap);
    setInstances(inst);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function toggleUsed(record, currentValue) {
    setToggling(prev => ({ ...prev, [record.id]: true }));
    const newVal = !currentValue;
    // Optimistic update
    setInstances(prev => prev.map(r =>
      r.id === record.id ? { ...r, fields: { ...r.fields, 'Used': newVal } } : r
    ));
    try {
      await updateRecord(PERK_INSTANCES_TABLE, record.id, { 'Used': newVal });
    } catch (e) {
      console.error('Toggle failed:', e);
      // Revert
      setInstances(prev => prev.map(r =>
        r.id === record.id ? { ...r, fields: { ...r.fields, 'Used': currentValue } } : r
      ));
    } finally {
      setToggling(prev => { const n = { ...prev }; delete n[record.id]; return n; });
    }
  }

  // Enrich instances with def data
  const enriched = instances.map(r => {
    const f = r.fields;
    const defId = (f['Perk Definition'] || [])[0];
    const def = defId ? (defsById[defId] || {}) : {};
    const cardId = (f['Card'] || [])[0];
    const personId = (f['Person'] || [])[0];
    return {
      id: r.id,
      perkName: def['Perk Name'] || f['Label'] || '—',
      cardName: cardId ? (cardsById[cardId] || '—') : '—',
      personId: personId || '',
      personName: personId ? (PEOPLE[personId] || '—') : '—',
      creditAmount: def['Credit Amount'] ?? null,
      resetCycle: def['Reset Cycle'] || '',
      priorityScore: def['Priority Score'] ?? 0,
      nextResetDate: f['Next Reset Date'] || '',
      used: f['Used'] || false,
    };
  });

  // Filter
  const filtered = enriched.filter(row => {
    if (personFilter !== 'All' && row.personName !== personFilter) return false;
    if (cycleFilter !== 'All' && row.resetCycle !== cycleFilter) return false;
    if (!showAll && row.used) return false;
    return true;
  });

  // Sort: priority desc, then next reset date asc
  const sorted = [...filtered].sort((a, b) => {
    if (b.priorityScore !== a.priorityScore) return b.priorityScore - a.priorityScore;
    if (!a.nextResetDate && !b.nextResetDate) return 0;
    if (!a.nextResetDate) return 1;
    if (!b.nextResetDate) return -1;
    return a.nextResetDate.localeCompare(b.nextResetDate);
  });

  const totalUnused = enriched.filter(r => !r.used).length;
  const total = enriched.length;

  if (loading) {
    return <div style={{ padding: '3rem', textAlign: 'center', color: 'rgba(255,255,255,0.4)' }}>Loading…</div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', maxWidth: 1100 }}>

      {/* Stat row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem', maxWidth: 400 }}>
        <StatCard label="Unused Perks" value={totalUnused} accent="#00D4FF" />
        <StatCard label="Total Perks" value={total} />
      </div>

      {/* Filters */}
      <div style={cardStyle}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600, marginRight: 4 }}>Person</span>
            <PillBtn active={personFilter === 'All'} onClick={() => setPersonFilter('All')}>All</PillBtn>
            {Object.values(PEOPLE).map(name => (
              <PillBtn key={name} active={personFilter === name} onClick={() => setPersonFilter(name)}>{name}</PillBtn>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600, marginRight: 4 }}>Cycle</span>
            <PillBtn active={cycleFilter === 'All'} onClick={() => setCycleFilter('All')}>All</PillBtn>
            {RESET_CYCLES.map(c => (
              <PillBtn key={c} active={cycleFilter === c} onClick={() => setCycleFilter(c)}>{c}</PillBtn>
            ))}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>Show</span>
            <button
              type="button"
              onClick={() => setShowAll(false)}
              style={{
                padding: '5px 16px', borderRadius: 20, border: '1px solid rgba(255,255,255,0.12)',
                background: !showAll ? '#00D4FF' : 'rgba(255,255,255,0.06)',
                color: !showAll ? '#0B1220' : 'rgba(255,255,255,0.6)',
                fontWeight: !showAll ? 700 : 400, cursor: 'pointer', fontSize: '0.82rem',
              }}
            >Available Only</button>
            <button
              type="button"
              onClick={() => setShowAll(true)}
              style={{
                padding: '5px 16px', borderRadius: 20, border: '1px solid rgba(255,255,255,0.12)',
                background: showAll ? '#00D4FF' : 'rgba(255,255,255,0.06)',
                color: showAll ? '#0B1220' : 'rgba(255,255,255,0.6)',
                fontWeight: showAll ? 700 : 400, cursor: 'pointer', fontSize: '0.82rem',
              }}
            >Show All</button>
          </div>
        </div>
      </div>

      {/* Perk list */}
      {sorted.length === 0 ? (
        <div style={{ ...cardStyle, color: 'rgba(255,255,255,0.35)', textAlign: 'center', padding: '3rem' }}>
          No perks match the current filters.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {/* Header row */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '2fr 2fr 1fr 1fr 1fr 1.2fr 60px',
            gap: '0.75rem',
            padding: '0.5rem 1rem',
            fontSize: '0.68rem',
            color: 'rgba(255,255,255,0.3)',
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            fontWeight: 600,
          }}>
            <span>Perk</span>
            <span>Card</span>
            <span>Person</span>
            <span>Amount</span>
            <span>Cycle</span>
            <span>Next Reset</span>
            <span style={{ textAlign: 'center' }}>Used</span>
          </div>

          {sorted.map(row => {
            const soon = isResettingSoon(row.nextResetDate);
            const dimmed = showAll && row.used;
            return (
              <div
                key={row.id}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '2fr 2fr 1fr 1fr 1fr 1.2fr 60px',
                  gap: '0.75rem',
                  alignItems: 'center',
                  padding: '0.75rem 1rem',
                  borderRadius: 10,
                  background: soon ? 'rgba(255,215,0,0.06)' : '#172033',
                  border: soon ? '1px solid rgba(255,215,0,0.25)' : '1px solid rgba(255,255,255,0.06)',
                  opacity: dimmed ? 0.4 : 1,
                  transition: 'opacity 0.15s',
                }}
              >
                <span style={{ fontWeight: 600, color: '#fff', fontSize: '0.88rem' }}>
                  {soon && (
                    <span style={{ marginRight: 6, fontSize: '0.75rem', color: '#FFD700', fontWeight: 700 }}>⚡</span>
                  )}
                  {row.perkName}
                </span>
                <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.85rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {row.cardName}
                </span>
                <span style={{ color: 'rgba(255,255,255,0.55)', fontSize: '0.85rem' }}>{row.personName}</span>
                <span style={{ color: '#00D4FF', fontWeight: 700, fontSize: '0.88rem' }}>
                  {row.creditAmount != null ? `$${row.creditAmount}` : '—'}
                </span>
                <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.82rem' }}>{row.resetCycle || '—'}</span>
                <span style={{
                  fontSize: '0.82rem',
                  color: soon ? '#FFD700' : 'rgba(255,255,255,0.5)',
                  fontWeight: soon ? 700 : 400,
                }}>
                  {fmt(row.nextResetDate)}
                </span>
                <div style={{ display: 'flex', justifyContent: 'center' }}>
                  <input
                    type="checkbox"
                    checked={row.used}
                    disabled={!!toggling[row.id]}
                    onChange={() => {
                      const orig = instances.find(r => r.id === row.id);
                      if (orig) toggleUsed(orig, row.used);
                    }}
                    style={{ width: 18, height: 18, accentColor: '#00D4FF', cursor: 'pointer' }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
