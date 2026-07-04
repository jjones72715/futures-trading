import { useState, useEffect } from 'react';
import { createRecord, fetchFieldChoices } from '../services/airtable.js';
import { REWARDS_TABLE } from '../config/tables.js';
import { PEOPLE } from '../config/constants.js';
import { toAirtableDate } from '../utils/dates.js';

const EMPTY = {
  programName: '',
  customProgramName: '',
  ownerIds: [],
  currentBalance: '',
  valuePerPoint: '',
  expirationDate: '',
  expirationPolicy: '',
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
  const [useCustomName, setUseCustomName] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchFieldChoices(REWARDS_TABLE, 'Program Name')
      .then(choices => setProgramChoices(choices.sort((a, b) => a.localeCompare(b))))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  function set(field) {
    return e => setForm(prev => ({ ...prev, [field]: e.target.value }));
  }

  function selectProgram(name) {
    setUseCustomName(false);
    setForm(prev => ({ ...prev, programName: prev.programName === name ? '' : name, customProgramName: '' }));
  }

  function toggleOwner(id) {
    setForm(prev => ({
      ...prev,
      ownerIds: prev.ownerIds.includes(id)
        ? prev.ownerIds.filter(o => o !== id)
        : [...prev.ownerIds, id],
    }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);

    const programName = useCustomName ? form.customProgramName.trim() : form.programName;
    if (!programName) { setError('Program Name is required.'); return; }
    if (form.ownerIds.length === 0) { setError('At least one Owner is required.'); return; }
    if (form.currentBalance === '' || isNaN(parseFloat(form.currentBalance))) {
      setError('Current Balance is required.');
      return;
    }

    setSubmitting(true);
    const fields = {
      'Name': programName,
      'Program Name': programName,
      'Owner': form.ownerIds,
      'Current Balance': parseFloat(form.currentBalance),
      'Last Update': toAirtableDate(new Date()),
    };
    if (form.valuePerPoint !== '' && !isNaN(parseFloat(form.valuePerPoint))) {
      fields['Value Per Point'] = parseFloat(form.valuePerPoint);
    }
    if (form.expirationDate) fields['Expiration Date'] = form.expirationDate;
    if (form.expirationPolicy.trim()) fields['Expiration Policy'] = form.expirationPolicy.trim();

    try {
      const result = await createRecord(REWARDS_TABLE, fields);
      console.log('Rewards program created:', result);
      setSuccess(true);
      setForm(EMPTY);
      setUseCustomName(false);
      if (!programChoices.includes(programName)) {
        setProgramChoices(prev => [...prev, programName].sort((a, b) => a.localeCompare(b)));
      }
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

      {/* Program Name */}
      <div style={cardStyle}>
        <div style={{ fontWeight: 700, color: '#fff', marginBottom: '0.85rem', fontSize: '0.9rem' }}>
          Program Name <span style={{ color: '#FF4D4D' }}>*</span>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: useCustomName ? '0.85rem' : 0 }}>
          {programChoices.map(name => (
            <PillBtn key={name} active={!useCustomName && form.programName === name} onClick={() => selectProgram(name)}>
              {name}
            </PillBtn>
          ))}
          <PillBtn active={useCustomName} onClick={() => { setUseCustomName(v => !v); setForm(prev => ({ ...prev, programName: '' })); }}>
            + New Program
          </PillBtn>
        </div>
        {useCustomName && (
          <input
            style={inp}
            value={form.customProgramName}
            onChange={set('customProgramName')}
            placeholder="e.g. Delta SkyMiles"
          />
        )}
      </div>

      {/* Owner */}
      <div style={cardStyle}>
        <div style={{ fontWeight: 700, color: '#fff', marginBottom: '0.85rem', fontSize: '0.9rem' }}>
          Owner <span style={{ color: '#FF4D4D' }}>*</span>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {Object.entries(PEOPLE).map(([id, name]) => (
            <PillBtn key={id} active={form.ownerIds.includes(id)} onClick={() => toggleOwner(id)}>
              {name}
            </PillBtn>
          ))}
        </div>
      </div>

      {/* Balance & Value */}
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

      {/* Expiration */}
      <div style={cardStyle}>
        <div style={{ fontWeight: 700, color: '#fff', marginBottom: '1rem', fontSize: '0.9rem' }}>Expiration</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label style={lbl}>Expiration Date</label>
            <input style={{ ...inp, maxWidth: 200 }} type="date" value={form.expirationDate} onChange={set('expirationDate')} />
          </div>
          <div>
            <label style={lbl}>Expiration Policy</label>
            <textarea
              style={{ ...inp, minHeight: 70, resize: 'vertical' }}
              value={form.expirationPolicy}
              onChange={set('expirationPolicy')}
              placeholder="e.g. Points expire after 24 months of inactivity"
            />
          </div>
        </div>
      </div>

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
