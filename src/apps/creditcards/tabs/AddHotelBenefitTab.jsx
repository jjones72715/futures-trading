import { useState, useEffect } from 'react';
import { createRecord, fetchTable, fetchFieldChoices } from '../services/airtable.js';
import { HOTELS_TABLE, PORTFOLIO_TABLE, HOTEL_TEMPLATES_TABLE } from '../config/tables.js';
import { PEOPLE } from '../config/constants.js';

const RECORD_TYPES = ['Free Night', 'Hotel Credit'];
const HOW_EARNED = ['Anniversary', 'Welcome Offer', 'Spend Threshold', 'Other'];
const RESET_CYCLES = ['Annual', 'Anniversary', 'Semi-Annual', 'Monthly', 'One-Time'];

const EMPTY = {
  name: '',
  cardId: '',
  personId: '',
  recordType: '',
  hotelBrand: '',
  howEarned: '',
  spendThreshold: '',
  benefitType: '',
  resetCycle: '',
  nextResetDate: '',
  estimatedValue: '',
  expirationDate: '',
  notes: '',
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

export function AddHotelBenefitTab({ onNavigateTemplates }) {
  const [form, setForm] = useState(EMPTY);
  const [allCards, setAllCards] = useState([]);
  const [hotelBrands, setHotelBrands] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    Promise.all([
      fetchTable(PORTFOLIO_TABLE, ['Card Name', 'Status', 'Owner'])
        .then(records => records
          .filter(r => r.fields['Status'] === 'Active')
          .map(r => ({ id: r.id, name: r.fields['Card Name'] || r.id, owners: r.fields['Owner'] || [] }))
          .sort((a, b) => a.name.localeCompare(b.name))
        ),
      fetchFieldChoices(HOTELS_TABLE, 'Hotel Brand'),
      fetchTable(HOTEL_TEMPLATES_TABLE, [
        'Template Name', 'Name / Label', 'Hotel Brand', 'Card', 'Person', 'Record Type', 'How Earned',
        'Spend Threshold Amount', 'Benefit Type', 'Reset Cycle', 'Estimated Value', 'Notes',
      ]).then(r => r.sort((a, b) =>
        (a.fields['Template Name'] || '').localeCompare(b.fields['Template Name'] || ''))),
    ])
      .then(([cards, brands, tmpl]) => {
        setAllCards(cards);
        setHotelBrands(brands);
        setTemplates(tmpl);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  function applyTemplate(templateId) {
    if (!templateId) return;
    const rec = templates.find(t => t.id === templateId);
    if (!rec) return;
    const f = rec.fields;
    setForm(prev => ({
      ...prev,
      name: f['Name / Label'] || prev.name,
      hotelBrand: f['Hotel Brand'] || prev.hotelBrand,
      recordType: f['Record Type'] || prev.recordType,
      howEarned: f['How Earned'] || prev.howEarned,
      spendThreshold: f['Spend Threshold Amount'] != null ? String(f['Spend Threshold Amount']) : prev.spendThreshold,
      benefitType: f['Benefit Type'] || prev.benefitType,
      resetCycle: f['Reset Cycle'] || prev.resetCycle,
      estimatedValue: f['Estimated Value'] != null ? String(f['Estimated Value']) : prev.estimatedValue,
      notes: f['Notes'] || prev.notes,
      cardId: prev.cardId || ((f['Card'] || [])[0] || ''),
      personId: prev.personId || ((f['Person'] || [])[0] || ''),
    }));
  }

  // When person changes, clear card selection
  function selectPerson(id) {
    setForm(prev => ({ ...prev, personId: prev.personId === id ? '' : id, cardId: '' }));
  }

  const filteredCards = form.personId
    ? allCards.filter(c => c.owners.includes(form.personId))
    : [];

  function set(field) {
    return e => setForm(prev => ({ ...prev, [field]: e.target.value }));
  }

  function pill(field, value) {
    return (
      <PillBtn
        key={value}
        active={form[field] === value}
        onClick={() => setForm(prev => ({ ...prev, [field]: prev[field] === value ? '' : value }))}
      >
        {value}
      </PillBtn>
    );
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);

    if (!form.personId)   { setError('Person is required.'); return; }
    if (!form.cardId)     { setError('Card is required.'); return; }
    if (!form.recordType) { setError('Record Type is required.'); return; }

    setSubmitting(true);
    const fields = {
      'Record Type': form.recordType,
      'Card': [form.cardId],
      'Person': [form.personId],
    };
    if (form.name.trim())        fields['Name'] = form.name.trim();
    if (form.hotelBrand)         fields['Hotel Brand'] = form.hotelBrand;
    if (form.howEarned)          fields['How Earned'] = form.howEarned;
    if (form.spendThreshold)     fields['Spend Threshold Amount'] = parseFloat(form.spendThreshold);
    if (form.benefitType.trim()) fields['Benefit Type'] = form.benefitType.trim();
    if (form.resetCycle)         fields['Reset Cycle'] = form.resetCycle;
    if (form.nextResetDate)      fields['Next Reset Date'] = form.nextResetDate;
    if (form.estimatedValue)     fields['Estimated Value'] = parseFloat(form.estimatedValue);
    if (form.expirationDate)     fields['Expiration Date'] = form.expirationDate;
    if (form.notes.trim())       fields['Notes'] = form.notes.trim();

    try {
      const result = await createRecord(HOTELS_TABLE, fields);
      console.log('Hotel benefit created:', result);
      setSuccess(true);
      setForm(EMPTY);
      setTimeout(() => setSuccess(false), 6000);
    } catch (err) {
      console.error('Hotel benefit save error:', err);
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

      {/* Template selector */}
      <div style={cardStyle}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.85rem' }}>
          <div style={{ fontWeight: 700, color: '#fff', fontSize: '0.9rem' }}>Load from Template</div>
          {onNavigateTemplates && (
            <button type="button" onClick={onNavigateTemplates} style={{
              background: 'none', border: 'none', color: '#00D4FF', fontSize: '0.8rem',
              cursor: 'pointer', fontWeight: 600, textDecoration: 'underline', padding: 0,
            }}>
              Manage Templates
            </button>
          )}
        </div>
        {templates.length === 0 ? (
          <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: '0.85rem' }}>
            No templates yet. Use Manage Templates to create one.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {templates.map(t => (
              <label key={t.id} style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', cursor: 'pointer' }}>
                <input
                  type="radio"
                  name="template"
                  value={t.id}
                  style={{ accentColor: '#00D4FF', width: 16, height: 16, flexShrink: 0 }}
                  onChange={() => applyTemplate(t.id)}
                />
                <span style={{ color: 'rgba(255,255,255,0.85)', fontSize: '0.88rem' }}>
                  {t.fields['Template Name']}
                </span>
              </label>
            ))}
          </div>
        )}
      </div>

      {/* Step 1 — Person */}
      <div style={cardStyle}>
        <div style={{ fontWeight: 700, color: '#fff', marginBottom: '0.85rem', fontSize: '0.9rem' }}>
          Person <span style={{ color: '#FF4D4D' }}>*</span>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {Object.entries(PEOPLE).map(([id, name]) => (
            <PillBtn key={id} active={form.personId === id} onClick={() => selectPerson(id)}>
              {name}
            </PillBtn>
          ))}
        </div>
      </div>

      {/* Step 2 — Card (only after person selected) */}
      {form.personId && (
        <div style={cardStyle}>
          <div style={{ fontWeight: 700, color: '#fff', marginBottom: '0.85rem', fontSize: '0.9rem' }}>
            Card <span style={{ color: '#FF4D4D' }}>*</span>
          </div>
          {filteredCards.length === 0 ? (
            <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.88rem' }}>
              No active cards found for {PEOPLE[form.personId]}.
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {filteredCards.map(c => (
                <PillBtn
                  key={c.id}
                  active={form.cardId === c.id}
                  onClick={() => setForm(prev => ({ ...prev, cardId: prev.cardId === c.id ? '' : c.id }))}
                >
                  {c.name}
                </PillBtn>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Record Type */}
      <div style={cardStyle}>
        <div style={{ fontWeight: 700, color: '#fff', marginBottom: '0.85rem', fontSize: '0.9rem' }}>
          Record Type <span style={{ color: '#FF4D4D' }}>*</span>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {RECORD_TYPES.map(t => pill('recordType', t))}
        </div>
      </div>

      {/* Hotel Brand — live from Airtable */}
      <div style={cardStyle}>
        <div style={{ fontWeight: 700, color: '#fff', marginBottom: '0.85rem', fontSize: '0.9rem' }}>Hotel Brand</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {hotelBrands.map(b => pill('hotelBrand', b))}
        </div>
      </div>

      {/* Benefit Details */}
      <div style={cardStyle}>
        <div style={{ fontWeight: 700, color: '#fff', marginBottom: '1rem', fontSize: '0.9rem' }}>Benefit Details</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label style={lbl}>Name / Label (optional)</label>
            <input style={inp} value={form.name} onChange={set('name')} placeholder="e.g. Hilton Free Night Cert" />
          </div>
          <div style={grid2}>
            <div>
              <label style={lbl}>Benefit Type</label>
              <input style={inp} value={form.benefitType} onChange={set('benefitType')} placeholder="e.g. Cat 1-4, $250 Statement Credit" />
            </div>
            <div>
              <label style={lbl}>Estimated Value ($)</label>
              <input style={inp} type="number" min="0" value={form.estimatedValue} onChange={set('estimatedValue')} placeholder="0" />
            </div>
          </div>
        </div>
      </div>

      {/* How Earned */}
      <div style={cardStyle}>
        <div style={{ fontWeight: 700, color: '#fff', marginBottom: '0.85rem', fontSize: '0.9rem' }}>How Earned</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {HOW_EARNED.map(h => pill('howEarned', h))}
        </div>
        {form.howEarned === 'Spend Threshold' && (
          <div style={{ marginTop: '0.75rem' }}>
            <label style={lbl}>Spend Threshold Amount ($)</label>
            <input style={{ ...inp, maxWidth: 200 }} type="number" min="0" value={form.spendThreshold} onChange={set('spendThreshold')} placeholder="0" />
          </div>
        )}
      </div>

      {/* Reset & Expiration */}
      <div style={cardStyle}>
        <div style={{ fontWeight: 700, color: '#fff', marginBottom: '1rem', fontSize: '0.9rem' }}>Reset & Expiration</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label style={lbl}>Reset Cycle</label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {RESET_CYCLES.map(r => pill('resetCycle', r))}
            </div>
          </div>
          <div style={grid2}>
            <div>
              <label style={lbl}>Next Reset Date</label>
              <input style={inp} type="date" value={form.nextResetDate} onChange={set('nextResetDate')} />
            </div>
            <div>
              <label style={lbl}>Expiration Date</label>
              <input style={inp} type="date" value={form.expirationDate} onChange={set('expirationDate')} />
            </div>
          </div>
        </div>
      </div>

      {/* Notes */}
      <div style={cardStyle}>
        <div style={{ fontWeight: 700, color: '#fff', marginBottom: '0.85rem', fontSize: '0.9rem' }}>Notes</div>
        <textarea
          style={{ ...inp, minHeight: 90, resize: 'vertical' }}
          value={form.notes}
          onChange={set('notes')}
          placeholder="Any additional notes…"
        />
      </div>

      {success && (
        <div style={{ background: '#00E67622', border: '1px solid #00E676', borderRadius: 10, padding: '0.85rem 1rem', color: '#00E676', fontWeight: 600 }}>
          Hotel benefit added successfully!
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
        {submitting ? 'Saving…' : 'Add Hotel Benefit'}
      </button>

    </form>
  );
}
