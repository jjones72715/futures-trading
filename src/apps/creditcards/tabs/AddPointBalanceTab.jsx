import { useState, useEffect } from 'react';
import { createRecord, fetchTable } from '../services/airtable.js';
import { REWARDS_TABLE, POINT_BALANCES_TABLE } from '../config/tables.js';
import { PEOPLE } from '../config/constants.js';
import { toAirtableDate } from '../utils/dates.js';

const EMPTY = {
  ownerId: '',
  programId: '',
  currentBalance: '',
  expirationDate: '',
};

const inp = {
  width: '100%', background: '#0B1220', border: '1px solid rgba(255,255,255,0.12)',
  borderRadius: 8, padding: '0.6rem 0.75rem', color: '#fff', fontSize: '0.88rem',
  outline: 'none', boxSizing: 'border-box',
};
const lbl = {
  display: 'block', fontSize: '0.7rem', fontWeight: 600,
  color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase',
  letterSpacing: '0.05em', marginBottom: 5,
};
const cardStyle = {
  background: '#172033', borderRadius: 12, border: '1px solid rgba(255,255,255,0.08)',
  padding: '1.25rem 1.5rem',
};
const grid2 = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' };

function PillBtn({ active, onClick, children }) {
  return (
    <button type="button" onClick={onClick} style={{
      padding: '6px 18px', borderRadius: 20, border: '1px solid rgba(255,255,255,0.12)',
      background: active ? '#00D4FF' : 'rgba(255,255,255,0.06)',
      color: active ? '#0B1220' : 'rgba(255,255,255,0.6)',
      fontWeight: active ? 700 : 400, cursor: 'pointer', fontSize: '0.85rem',
      transition: 'all 0.15s',
    }}>
      {children}
    </button>
  );
}

export function AddPointBalanceTab() {
  const [form, setForm] = useState(EMPTY);
  const [programs, setPrograms] = useState([]);
  const [existingBalances, setExistingBalances] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    Promise.all([
      fetchTable(REWARDS_TABLE, ['Program Name']),
      fetchTable(POINT_BALANCES_TABLE, ['Person', 'Program']),
    ])
      .then(([programRows, balanceRows]) => {
        setPrograms(programRows.sort((a, b) => (a.fields['Program Name'] || '').localeCompare(b.fields['Program Name'] || '')));
        setExistingBalances(balanceRows);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  function selectOwner(id) {
    setForm(prev => ({ ...prev, ownerId: prev.ownerId === id ? '' : id, programId: '' }));
  }

  function selectProgram(id) {
    setForm(prev => ({ ...prev, programId: prev.programId === id ? '' : id }));
  }

  function set(field) {
    return e => setForm(prev => ({ ...prev, [field]: e.target.value }));
  }

  const trackedProgramIds = new Set(
    existingBalances
      .filter(b => (b.fields['Person'] || []).includes(form.ownerId))
      .map(b => (b.fields['Program'] || [])[0])
      .filter(Boolean)
  );
  const availablePrograms = programs.filter(p => !trackedProgramIds.has(p.id));

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);

    if (!form.ownerId) { setError('Person is required.'); return; }
    if (!form.programId) { setError('Program is required.'); return; }
    if (form.currentBalance === '' || isNaN(parseFloat(form.currentBalance))) {
      setError('Current Balance is required.');
      return;
    }

    setSubmitting(true);
    const program = programs.find(p => p.id === form.programId);
    const programName = program?.fields['Program Name'] || 'Program';
    const fields = {
      'Label': `${programName} — ${PEOPLE[form.ownerId] || ''}`,
      'Person': [form.ownerId],
      'Program': [form.programId],
      'Current Balance': parseFloat(form.currentBalance),
      'Last Updated': toAirtableDate(new Date()),
    };
    if (form.expirationDate) fields['Expiration Date'] = form.expirationDate;

    try {
      const result = await createRecord(POINT_BALANCES_TABLE, fields);
      setExistingBalances(prev => [...prev, result]);
      setSuccess(true);
      setForm(EMPTY);
      setTimeout(() => setSuccess(false), 6000);
    } catch (err) {
      console.error('Point balance save error:', err);
      setError(String(err.message || err));
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div style={{ padding: '3rem', textAlign: 'center', color: 'rgba(255,255,255,0.4)' }}>
        Loading…
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', maxWidth: 780 }}>

      {/* Person */}
      <div style={cardStyle}>
        <div style={{ fontWeight: 700, color: '#fff', marginBottom: '0.85rem', fontSize: '0.9rem' }}>
          Person <span style={{ color: '#FF4D4D' }}>*</span>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {Object.entries(PEOPLE).map(([id, name]) => (
            <PillBtn key={id} active={form.ownerId === id} onClick={() => selectOwner(id)}>
              {name}
            </PillBtn>
          ))}
        </div>
      </div>

      {/* Program — only after Person is picked */}
      {form.ownerId && (
        <div style={cardStyle}>
          <div style={{ fontWeight: 700, color: '#fff', marginBottom: '0.85rem', fontSize: '0.9rem' }}>
            Program <span style={{ color: '#FF4D4D' }}>*</span>
          </div>
          {availablePrograms.length === 0 ? (
            <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.88rem' }}>
              {PEOPLE[form.ownerId]} already tracks every program in the catalog.
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {availablePrograms.map(p => (
                <PillBtn key={p.id} active={form.programId === p.id} onClick={() => selectProgram(p.id)}>
                  {p.fields['Program Name'] || p.id}
                </PillBtn>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Balance & Expiration */}
      {form.ownerId && form.programId && (
        <div style={cardStyle}>
          <div style={{ fontWeight: 700, color: '#fff', marginBottom: '1rem', fontSize: '0.9rem' }}>Balance</div>
          <div style={grid2}>
            <div>
              <label style={lbl}>Current Balance <span style={{ color: '#FF4D4D' }}>*</span></label>
              <input style={inp} type="number" min="0" value={form.currentBalance} onChange={set('currentBalance')} placeholder="0" />
            </div>
            <div>
              <label style={lbl}>Expiration Date (optional)</label>
              <input style={inp} type="date" value={form.expirationDate} onChange={set('expirationDate')} />
            </div>
          </div>
        </div>
      )}

      {success && (
        <div style={{ background: '#00E67622', border: '1px solid #00E676', borderRadius: 10, padding: '0.85rem 1rem', color: '#00E676', fontWeight: 600 }}>
          Balance added successfully!
        </div>
      )}
      {error && (
        <div style={{ background: '#FF4D4D22', border: '1px solid #FF4D4D', borderRadius: 10, padding: '0.85rem 1rem', color: '#FF4D4D' }}>
          {error}
        </div>
      )}

      <button type="submit" disabled={submitting} style={{
        padding: '0.85rem 2rem', borderRadius: 10, border: 'none',
        background: submitting ? 'rgba(0,212,255,0.4)' : '#00D4FF',
        color: '#0B1220', fontWeight: 700, fontSize: '0.95rem',
        cursor: submitting ? 'not-allowed' : 'pointer', alignSelf: 'flex-start',
      }}>
        {submitting ? 'Saving…' : 'Add Balance'}
      </button>

    </form>
  );
}
