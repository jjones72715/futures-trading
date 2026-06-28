import { useState, useEffect, useCallback } from 'react';
import { fetchTable, updateRecord, createRecord } from '../services/airtable.js';
import { PERK_INSTANCES_TABLE, PERK_DEFINITIONS_TABLE, PORTFOLIO_TABLE } from '../config/tables.js';
import { PEOPLE } from '../config/constants.js';
import { advanceUntilFuture, calculateNextResetDate, toAirtableDate } from '../utils/dates.js';

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

function isPastOrToday(dateStr) {
  if (!dateStr) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(dateStr + 'T00:00:00');
  return d <= today;
}

export function BenefitsTrackerTab() {
  const [instances, setInstances] = useState([]);
  const [defsById, setDefsById] = useState({});
  const [cardsById, setCardsById] = useState({});
  const [loading, setLoading] = useState(true);
  const [resetStatus, setResetStatus] = useState('');
  const [personFilter, setPersonFilter] = useState('All');
  const [cycleFilter, setCycleFilter] = useState('All');
  const [showAll, setShowAll] = useState(false);
  const [toggling, setToggling] = useState({});
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setResetStatus('Checking for expired perks…');

    // Step 1 — load defs and instances together
    const [allInst, defs, cards] = await Promise.all([
      fetchTable(PERK_INSTANCES_TABLE, ['Label', 'Perk Definition', 'Card', 'Person', 'Used', 'Next Reset Date', 'Priority Score']),
      fetchTable(PERK_DEFINITIONS_TABLE, ['Perk Name', 'Card Type', 'Credit Amount', 'Reset Cycle', 'Priority Score']),
      fetchTable(PORTFOLIO_TABLE, ['Card Name']),
    ]);

    const defMap = {};
    defs.forEach(r => { defMap[r.id] = r.fields; });

    const cardMap = {};
    cards.forEach(r => { cardMap[r.id] = r.fields['Card Name'] || r.id; });

    // Step 2 — find instances where Used=true and Next Reset Date is today or past
    const toReset = allInst.filter(r => {
      const f = r.fields;
      if (!f['Used']) return false;
      return isPastOrToday(f['Next Reset Date']);
    });

    // Step 3 — advance each and PATCH
    if (toReset.length > 0) {
      setResetStatus(`Resetting ${toReset.length} expired perk${toReset.length > 1 ? 's' : ''}…`);
      await Promise.all(toReset.map(async r => {
        const defId = (r.fields['Perk Definition'] || [])[0];
        const def = defId ? defMap[defId] : null;
        const cycle = def?.['Reset Cycle'];
        const currentDate = r.fields['Next Reset Date'];
        const newDate = cycle && currentDate ? advanceUntilFuture(cycle, currentDate) : null;

        const patch = { 'Used': false };
        if (newDate) patch['Next Reset Date'] = newDate;

        try {
          await updateRecord(PERK_INSTANCES_TABLE, r.id, patch);
          // Update local record so render reflects reset state without re-fetch
          r.fields['Used'] = false;
          if (newDate) r.fields['Next Reset Date'] = newDate;
        } catch (e) {
          console.error('Reset failed for', r.id, e);
        }
      }));
    }

    setResetStatus('');
    setDefsById(defMap);
    setCardsById(cardMap);
    setInstances(allInst);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function syncPerks() {
    setSyncing(true);
    setSyncResult(null);
    try {
      // Fetch all three sources in parallel
      const [portfolio, defs, existingInst] = await Promise.all([
        fetchTable(PORTFOLIO_TABLE, ['Card Name', 'Current Product', 'Owner']),
        fetchTable(PERK_DEFINITIONS_TABLE, ['Perk Name', 'Card Product', 'Reset Cycle', 'Credit Amount', 'Priority Score']),
        fetchTable(PERK_INSTANCES_TABLE, ['Card', 'Perk Definition', 'Label', 'Credit Amount', 'Priority Score']),
      ]);

      // Index defs by record ID and by Card Product record ID
      const defsById = {};
      const defsByProductId = {};
      defs.forEach(def => {
        defsById[def.id] = def;
        const productIds = def.fields['Card Product'] || [];
        productIds.forEach(pid => {
          if (!defsByProductId[pid]) defsByProductId[pid] = [];
          defsByProductId[pid].push(def);
        });
      });

      // Build map of existing instances: key -> instance record (for duplicate check + backfill)
      const existingByKey = {};
      existingInst.forEach(r => {
        const cardId = (r.fields['Card'] || [])[0] || '';
        const defId = (r.fields['Perk Definition'] || [])[0] || '';
        if (cardId && defId) existingByKey[`${cardId}::${defId}`] = r;
      });

      const today = new Date();
      const creates = [];
      const patches = []; // existing instances missing Label/Credit Amount/Priority Score
      let skipped = 0;
      const cardsSeen = new Set();

      for (const card of portfolio) {
        const cardId = card.id;
        const productId = (card.fields['Current Product'] || [])[0];
        if (!productId) continue;

        const matchingDefs = defsByProductId[productId] || [];
        if (matchingDefs.length === 0) continue;

        const ownerIds = card.fields['Owner'] || [];

        for (const def of matchingDefs) {
          for (const personId of ownerIds) {
            const key = `${cardId}::${def.id}`;
            const existing = existingByKey[key];
            if (existing) {
              // Check if backfill needed
              const patch = {};
              if (!existing.fields['Label']) patch['Label'] = def.fields['Perk Name'] || '';
              if (existing.fields['Credit Amount'] == null && def.fields['Credit Amount'] != null)
                patch['Credit Amount'] = def.fields['Credit Amount'];
              if (existing.fields['Priority Score'] == null && def.fields['Priority Score'] != null)
                patch['Priority Score'] = def.fields['Priority Score'];
              if (Object.keys(patch).length > 0) patches.push({ id: existing.id, fields: patch });
              else skipped++;
              continue;
            }
            const cycle = def.fields['Reset Cycle'];
            const nextDate = cycle ? calculateNextResetDate(cycle, today) : null;
            const instanceFields = {
              'Perk Definition': [def.id],
              'Card': [cardId],
              'Person': [personId],
              'Used': false,
              'Label': def.fields['Perk Name'] || '',
            };
            if (nextDate) instanceFields['Next Reset Date'] = toAirtableDate(nextDate);
            if (def.fields['Credit Amount'] != null) instanceFields['Credit Amount'] = def.fields['Credit Amount'];
            if (def.fields['Priority Score'] != null) instanceFields['Priority Score'] = def.fields['Priority Score'];
            creates.push({ fields: instanceFields, cardId });
            existingByKey[key] = { id: 'pending', fields: instanceFields };
          }
        }
        if (creates.some(c => c.cardId === cardId)) cardsSeen.add(cardId);
      }

      // Fire creates sequentially to avoid rate limits
      let added = 0;
      for (const c of creates) {
        try {
          await createRecord(PERK_INSTANCES_TABLE, c.fields);
          added++;
          cardsSeen.add(c.cardId);
        } catch (e) {
          console.error('Sync create failed:', e);
        }
      }

      // Backfill missing fields on existing instances
      let patched = 0;
      for (const p of patches) {
        try {
          await updateRecord(PERK_INSTANCES_TABLE, p.id, p.fields);
          patched++;
        } catch (e) {
          console.error('Sync patch failed:', e);
        }
      }

      setSyncResult({ added, patched, cards: cardsSeen.size, skipped });
      await load();
    } catch (e) {
      console.error('Sync failed:', e);
      setSyncResult({ error: e.message });
    } finally {
      setSyncing(false);
    }
  }

  async function savePriority(recordId, value) {
    setInstances(prev => prev.map(r =>
      r.id === recordId ? { ...r, fields: { ...r.fields, 'Priority Score': value } } : r
    ));
    try {
      await updateRecord(PERK_INSTANCES_TABLE, recordId, { 'Priority Score': value });
    } catch (e) {
      console.error('Priority save failed:', e);
    }
  }

  async function toggleUsed(record, currentValue) {
    setToggling(prev => ({ ...prev, [record.id]: true }));
    const newVal = !currentValue;
    setInstances(prev => prev.map(r =>
      r.id === record.id ? { ...r, fields: { ...r.fields, 'Used': newVal } } : r
    ));
    try {
      await updateRecord(PERK_INSTANCES_TABLE, record.id, { 'Used': newVal });
    } catch (e) {
      console.error('Toggle failed:', e);
      setInstances(prev => prev.map(r =>
        r.id === record.id ? { ...r, fields: { ...r.fields, 'Used': currentValue } } : r
      ));
    } finally {
      setToggling(prev => { const n = { ...prev }; delete n[record.id]; return n; });
    }
  }

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
      priorityScore: f['Priority Score'] != null ? f['Priority Score'] : (def['Priority Score'] ?? 0),
      nextResetDate: f['Next Reset Date'] || '',
      used: f['Used'] || false,
    };
  });

  const filtered = enriched.filter(row => {
    if (personFilter !== 'All' && row.personName !== personFilter) return false;
    if (cycleFilter !== 'All' && row.resetCycle !== cycleFilter) return false;
    if (!showAll && row.used) return false;
    return true;
  });

  const sorted = [...filtered].sort((a, b) => {
    if (b.priorityScore !== a.priorityScore) return b.priorityScore - a.priorityScore;
    if (!a.nextResetDate && !b.nextResetDate) return 0;
    if (!a.nextResetDate) return 1;
    if (!b.nextResetDate) return -1;
    return a.nextResetDate.localeCompare(b.nextResetDate);
  });

  const totalAvailable = enriched.filter(r => !r.used).length;
  const total = enriched.length;

  if (loading) {
    return (
      <div style={{ padding: '3rem', textAlign: 'center', color: 'rgba(255,255,255,0.4)' }}>
        {resetStatus || 'Loading…'}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', maxWidth: 1100 }}>

      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1.25rem', flexWrap: 'wrap' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem', width: 'fit-content' }}>
          <StatCard label="Available Perks" value={totalAvailable} accent="#00D4FF" />
          <StatCard label="Total Perks" value={total} />
        </div>
        <button
          type="button"
          onClick={syncPerks}
          disabled={syncing || loading}
          style={{
            padding: '0.6rem 1.25rem', borderRadius: 9, border: '1px solid rgba(0,212,255,0.3)',
            background: syncing ? 'rgba(0,212,255,0.08)' : 'rgba(0,212,255,0.12)',
            color: syncing ? 'rgba(0,212,255,0.5)' : '#00D4FF',
            fontWeight: 600, fontSize: '0.82rem', cursor: syncing ? 'not-allowed' : 'pointer',
            whiteSpace: 'nowrap', alignSelf: 'center', transition: 'all 0.15s',
          }}
        >
          {syncing ? 'Syncing…' : 'Sync Perks to All Cards'}
        </button>
      </div>

      {syncResult && !syncResult.error && (
        <div style={{ background: '#00E67622', border: '1px solid #00E676', borderRadius: 10, padding: '0.75rem 1rem', color: '#00E676', fontWeight: 600, fontSize: '0.88rem' }}>
          {syncResult.added > 0 && `${syncResult.added} perk${syncResult.added !== 1 ? 's' : ''} added`}
        {syncResult.added > 0 && syncResult.patched > 0 && ', '}
        {syncResult.patched > 0 && `${syncResult.patched} backfilled (Label/Amount/Priority)`}
        {(syncResult.added > 0 || syncResult.patched > 0) && syncResult.cards > 0 && ` across ${syncResult.cards} card${syncResult.cards !== 1 ? 's' : ''}`}
        {syncResult.added === 0 && syncResult.patched === 0 && 'All perks up to date'}
        {syncResult.skipped > 0 && `, ${syncResult.skipped} already complete`}
        </div>
      )}
      {syncResult?.error && (
        <div style={{ background: '#FF4D4D22', border: '1px solid #FF4D4D', borderRadius: 10, padding: '0.75rem 1rem', color: '#FF4D4D', fontSize: '0.88rem' }}>
          Sync failed: {syncResult.error}
        </div>
      )}

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
            <button type="button" onClick={() => setShowAll(false)} style={{
              padding: '5px 16px', borderRadius: 20, border: '1px solid rgba(255,255,255,0.12)',
              background: !showAll ? '#00D4FF' : 'rgba(255,255,255,0.06)',
              color: !showAll ? '#0B1220' : 'rgba(255,255,255,0.6)',
              fontWeight: !showAll ? 700 : 400, cursor: 'pointer', fontSize: '0.82rem',
            }}>Available Only</button>
            <button type="button" onClick={() => setShowAll(true)} style={{
              padding: '5px 16px', borderRadius: 20, border: '1px solid rgba(255,255,255,0.12)',
              background: showAll ? '#00D4FF' : 'rgba(255,255,255,0.06)',
              color: showAll ? '#0B1220' : 'rgba(255,255,255,0.6)',
              fontWeight: showAll ? 700 : 400, cursor: 'pointer', fontSize: '0.82rem',
            }}>Show All</button>
          </div>
        </div>
      </div>

      {sorted.length === 0 ? (
        <div style={{ ...cardStyle, color: 'rgba(255,255,255,0.35)', textAlign: 'center', padding: '3rem' }}>
          No perks match the current filters.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: '2fr 2fr 1fr 1fr 100px 1fr 1.2fr 60px',
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
            <span>Priority</span>
            <span>Cycle</span>
            <span>Next Reset</span>
            <span style={{ textAlign: 'center' }}>Used</span>
          </div>

          {sorted.map(row => {
            const soon = isResettingSoon(row.nextResetDate);
            const dimmed = showAll && row.used;
            return (
              <div key={row.id} style={{
                display: 'grid',
                gridTemplateColumns: '2fr 2fr 1fr 1fr 100px 1fr 1.2fr 60px',
                gap: '0.75rem',
                alignItems: 'center',
                padding: '0.75rem 1rem',
                borderRadius: 10,
                background: soon ? 'rgba(255,215,0,0.06)' : '#172033',
                border: soon ? '1px solid rgba(255,215,0,0.25)' : '1px solid rgba(255,255,255,0.06)',
                opacity: dimmed ? 0.4 : 1,
                transition: 'opacity 0.15s',
              }}>
                <span style={{ fontWeight: 600, color: '#fff', fontSize: '0.88rem' }}>
                  {soon && <span style={{ marginRight: 6, fontSize: '0.75rem', color: '#FFD700', fontWeight: 700 }}>⚡</span>}
                  {row.perkName}
                </span>
                <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.85rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {row.cardName}
                </span>
                <span style={{ color: 'rgba(255,255,255,0.55)', fontSize: '0.85rem' }}>{row.personName}</span>
                <span style={{ color: '#00D4FF', fontWeight: 700, fontSize: '0.88rem' }}>
                  {row.creditAmount != null ? `$${row.creditAmount}` : '—'}
                </span>
                <div style={{ display: 'flex', gap: 3 }}>
                  {[1,2,3,4,5].map(n => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => savePriority(row.id, n)}
                      style={{
                        width: 16, height: 16, borderRadius: '50%', border: 'none',
                        background: n <= row.priorityScore ? '#00D4FF' : 'rgba(255,255,255,0.12)',
                        cursor: 'pointer', padding: 0, flexShrink: 0,
                        transition: 'background 0.1s',
                      }}
                    />
                  ))}
                </div>
                <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.82rem' }}>{row.resetCycle || '—'}</span>
                <span style={{ fontSize: '0.82rem', color: soon ? '#FFD700' : 'rgba(255,255,255,0.5)', fontWeight: soon ? 700 : 400 }}>
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
