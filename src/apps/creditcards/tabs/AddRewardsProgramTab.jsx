import { useState, useEffect } from 'react';
import { createRecord, fetchTable, fetchFieldChoices } from '../services/airtable.js';
import { REWARDS_TABLE } from '../config/tables.js';
import { PEOPLE } from '../config/constants.js';
import { toAirtableDate } from '../utils/dates.js';

const EMPTY = {
  ownerId: '',
  programName: '',
  currentBalance: '',
  valuePerPoint: '',
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

export function AddRewardsProgramTab() {
  const [form, setForm] = useState(EMPTY);
  const [programChoices, setProgramChoices] = useState([]);
  const [allRecords, setAllRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    Promise.all([
      fetchFieldChoices(REWARDS_TABLE, 'Program Name'),
      fetchTable(REWARDS_TABLE, ['Program Name', 'Owner', 'Expiration Date', 'Expiration Policy']),
    ])
      .then(([choices, records]) => {
        setProgramChoices(choices.sort((a, b) => a.localeCompare(b)));
        setAllRecords(records);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  function selectOwner(id) {
    setForm(prev => ({ ...prev, ownerId: prev.ownerId === id ? '' : id, programName: '' }));
  }

  function selectProgram(name) {
    setForm(prev => ({ ...prev, programName: prev.programName === name ? '' : name }));
  }

  function set(field) {
    return e => setForm(prev => ({ ...prev, [field]: e.target.value }));
  }

  const trackedProgramNames = new Set(
    allRecords
      .filter(r => (r.fields['Owner'] || []).includes(form.ownerId))
      .map(r => r.fields['Program Name'])
      .filter(Boolean)
  );
  const availablePrograms = programChoices.filter(name => !trackedProgramNames.has(name));

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);

    if (!form.ownerId) { setError('Owner is required.'); return; }
    if (!form.programName) { setError('Program Name is required.'); return; }
    if (form.currentBalance === '' || isNaN(parseFloat(form.currentBalance))) {
      setError('Current Balance is required.');
      return;
    }

    setSubmitting(true);
    const fields = {
      'Name': form.programName,
      'Program Name': form.programName,
      'Owner': [form.ownerId],
      'Current Balance': parseFloat(form.currentBalance),
      'Last Update': toAirtableDate(new Date()),
    };
    if (form.valuePerPoint !== '' && !isNaN(parseFloat(form.valuePerPoint))) {
      fields['Value Per Point'] = parseFloat(form.valuePerPoint);
    }

    const reference = allRecords.find(r =>
      r.fields['Program Name'] === form.programName &&
      (r.fields['Expiration Date'] || r.fields['Expiration Policy'])
    );
    if (reference) {
      if (reference.fields['Expiration Date']) fields['Expiration Date'] = reference.fields['Expiration Date'];
      if (reference.fields['Expiration Policy']) fields['Expiration Policy'] = reference.fields['Expiration Policy'];
    }

    try {
      const result = await createRecord(REWARDS_TABLE, fields);
      setAllRecords(prev => [...prev, result]);
      setSuccess(true);
      setForm(EMPTY);
      setTimeout(() => setSuccess(false), 6000);
    } catch (err) {
      console.error('Rewards program save error:', err);
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

      {/* Owner */}
      <div style={cardStyle}>
        <div style={{ fontWeight: 700, color: '#fff', marginBottom: '0.85rem', fontSize: '0.9rem' }}>
          Owner <span style={{ color: '#FF4D4D' }}>*</span>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {Object.entries(PEOPLE).map(([id, name]) => (
            <PillBtn key={id} active={form.ownerId === id} onClick={() => selectOwner(id)}>
              {name}
            </PillBtn>
          ))}
        </div>
      </div>

      {/* Program Name — only after Owner is picked */}
      {form.ownerId && (
        <div style={cardStyle}>
          <div style={{ fontWeight: 700, color: '#fff', marginBottom: '0.85rem', fontSize: '0.9rem' }}>
            Program Name <span style={{ color: '#FF4D4D' }}>*</span>
          </div>
          {availablePrograms.length === 0 ? (
            <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.88rem' }}>
              {PEOPLE[form.ownerId]} already tracks every available program.
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {availablePrograms.map(name => (
                <PillBtn key={name} active={form.programName === name} onClick={() => selectProgram(name)}>
                  {name}
                </PillBtn>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Balance & Value */}
      {form.ownerId && form.programName && (
        <div style={cardStyle}>
          <div style={{ fontWeight: 700, color: '#fff', marginBottom: '1rem', fontSize: '0.9rem' }}>Balance & Value</div>
          <div style={grid2}>
            <div>
              <label style={lbl}>Current Balance <span style={{ color: '#FF4D4D' }}>*</span></label>
              <input style={inp} type="number" min="0" value={form.currentBalance} onChange={set('currentBalance')} placeholder="0" />
            </div>
            <div>
              <label style={lbl}>Value Per Point ($)</label>
              <input style={inp} type="number" step="0.001" min="0" value={form.valuePerPoint} onChange={set('valuePerPoint')} placeholder="0.010" />
            </div>
          </div>
        </div>
      )}

      {success && (
        <div style={{ background: '#00E67622', border: '1px solid #00E676', borderRadius: 10, padding: '0.85rem 1rem', color: '#00E676', fontWeight: 600 }}>
          Rewards program added successfully!
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
        {submitting ? 'Saving…' : 'Add Rewards Program'}
      </button>

    </form>
  );
}
