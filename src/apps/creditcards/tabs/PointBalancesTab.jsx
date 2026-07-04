import { useState, useEffect } from 'react';
import { fetchTable, updateRecord } from '../services/airtable.js';
import { REWARDS_TABLE } from '../config/tables.js';
import { PEOPLE } from '../config/constants.js';
import { toAirtableDate, isStale } from '../utils/dates.js';

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

const inp = {
  width: '100%', background: '#0B1220', border: '1px solid rgba(255,255,255,0.12)',
  borderRadius: 6, padding: '0.35rem 0.5rem', color: '#fff', fontSize: '0.82rem',
  outline: 'none', boxSizing: 'border-box',
};

export function PointBalancesTab() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [personFilter, setPersonFilter] = useState('All');
  const [editingId, setEditingId] = useState(null);
  const [editBalance, setEditBalance] = useState('');
  const [editVPP, setEditVPP] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    const rows = await fetchTable(REWARDS_TABLE, [
      'Program Name', 'Owner', 'Current Balance', 'Value Per Point',
      'Program Value', 'Expiration Date', 'Expiration Policy', 'Last Update',
    ]);
    setRecords(rows);
    setLoading(false);
  }

  function startEdit(row) {
    setSaveError(null);
    setEditingId(row.id);
    setEditBalance(row.currentBalance != null ? String(row.currentBalance) : '');
    setEditVPP(row.valuePerPoint != null ? String(row.valuePerPoint) : '');
  }

  function cancelEdit() {
    setEditingId(null);
    setSaveError(null);
  }

  async function saveEdit(row) {
    setSaveError(null);
    if (editBalance === '' || isNaN(parseFloat(editBalance))) {
      setSaveError('Enter a valid balance.');
      return;
    }
    setSaving(true);
    try {
      const fields = {
        'Current Balance': parseFloat(editBalance),
        'Last Update': toAirtableDate(new Date()),
      };
      if (editVPP !== '' && !isNaN(parseFloat(editVPP))) {
        fields['Value Per Point'] = parseFloat(editVPP);
      }
      const updated = await updateRecord(REWARDS_TABLE, row.id, fields);
      setRecords(prev => prev.map(r => (r.id === row.id ? updated : r)));
      setEditingId(null);
    } catch (err) {
      setSaveError(String(err.message || err));
    } finally {
      setSaving(false);
    }
  }

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
      lastUpdate: r.fields['Last Update'] || '',
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

  const cols = '1.7fr 1fr 1fr 0.85fr 1fr 1fr 1.2fr 1.4fr 130px';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', maxWidth: 1250 }}>

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
            gridTemplateColumns: cols,
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
            <span>Last Update</span>
            <span>Expires</span>
            <span>Expiry Policy</span>
            <span></span>
          </div>

          {sorted.map((row, i) => {
            const days = daysUntil(row.expirationDate);
            const expiringSoon = days != null && days < 60;
            const ownerNames = row.ownerIds.map(id => PEOPLE[id] || id).join(', ') || '—';
            const color = programBadgeColor(row.programName, i);
            const stale = isStale(row.lastUpdate);
            const isEditing = editingId === row.id;
            return (
              <div key={row.id}>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: cols,
                  gap: '0.75rem',
                  alignItems: 'center',
                  padding: '0.75rem 1rem',
                  borderRadius: isEditing ? '10px 10px 0 0' : 10,
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
                  <span
                    title={stale ? 'No update in over 4 months' : ''}
                    style={{
                      fontSize: '0.82rem',
                      color: stale ? '#0B1220' : 'rgba(255,255,255,0.5)',
                      background: stale ? '#FFD700' : 'transparent',
                      padding: stale ? '2px 8px' : 0,
                      borderRadius: 8,
                      fontWeight: stale ? 700 : 400,
                      width: 'fit-content',
                    }}
                  >
                    {fmtDate(row.lastUpdate)}
                  </span>
                  <span style={{ fontSize: '0.82rem', color: expiringSoon ? '#FFD700' : 'rgba(255,255,255,0.5)', fontWeight: expiringSoon ? 700 : 400 }}>
                    {fmtDate(row.expirationDate)}{days != null ? ` (${days}d)` : ''}
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
                  <span>
                    {!isEditing && (
                      <button type="button" onClick={() => startEdit(row)} style={{
                        padding: '4px 12px', borderRadius: 8, border: '1px solid rgba(0,212,255,0.4)',
                        background: 'rgba(0,212,255,0.1)', color: '#00D4FF', fontWeight: 600,
                        fontSize: '0.78rem', cursor: 'pointer', whiteSpace: 'nowrap',
                      }}>
                        Update
                      </button>
                    )}
                  </span>
                </div>

                {isEditing && (
                  <div style={{
                    display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'flex-end',
                    padding: '0.85rem 1rem', borderRadius: '0 0 10px 10px',
                    background: '#111a2b', border: '1px solid rgba(0,212,255,0.25)', borderTop: 'none',
                  }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.68rem', color: 'rgba(255,255,255,0.4)', marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        New Balance
                      </label>
                      <input
                        style={{ ...inp, width: 130 }}
                        type="number"
                        min="0"
                        autoFocus
                        value={editBalance}
                        onChange={e => setEditBalance(e.target.value)}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.68rem', color: 'rgba(255,255,255,0.4)', marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        Value Per Point
                      </label>
                      <input
                        style={{ ...inp, width: 110 }}
                        type="number"
                        step="0.001"
                        min="0"
                        value={editVPP}
                        onChange={e => setEditVPP(e.target.value)}
                      />
                    </div>
                    <button type="button" onClick={() => saveEdit(row)} disabled={saving} style={{
                      padding: '0.5rem 1.1rem', borderRadius: 8, border: 'none',
                      background: saving ? 'rgba(0,212,255,0.4)' : '#00D4FF',
                      color: '#0B1220', fontWeight: 700, fontSize: '0.82rem',
                      cursor: saving ? 'not-allowed' : 'pointer',
                    }}>
                      {saving ? 'Saving…' : 'Save'}
                    </button>
                    <button type="button" onClick={cancelEdit} disabled={saving} style={{
                      padding: '0.5rem 1.1rem', borderRadius: 8, border: '1px solid rgba(255,255,255,0.15)',
                      background: 'transparent', color: 'rgba(255,255,255,0.6)', fontWeight: 600,
                      fontSize: '0.82rem', cursor: 'pointer',
                    }}>
                      Cancel
                    </button>
                    {saveError && (
                      <span style={{ color: '#FF4D4D', fontSize: '0.8rem' }}>{saveError}</span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
