import { useState, useEffect } from 'react';
import { fetchTable, createRecord, updateRecord, deleteRecord } from '../services/airtable.js';
import { HOTEL_TEMPLATES_TABLE, PORTFOLIO_TABLE, PEOPLE_TABLE } from '../config/tables.js';

const RECORD_TYPES = ['Free Night', 'Hotel Credit'];
const HOW_EARNED = ['Anniversary', 'Welcome Offer', 'Spend Threshold', 'Other'];
const RESET_CYCLES = ['Annual', 'Anniversary', 'Semi-Annual', 'Monthly', 'One-Time'];

const EMPTY_FORM = {
  templateName: '',
  cardId: '',
  personId: '',
  recordType: '',
  howEarned: '',
  spendThreshold: '',
  benefitType: '',
  benefitValue: '',
  resetCycle: '',
  estimatedValue: '',
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

function TemplateForm({ form, setForm, allCards, allPeople, onSubmit, onCancel, submitting, error }) {
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

  return (
    <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <div style={cardStyle}>
        <div style={{ fontWeight: 700, color: '#fff', marginBottom: '1rem', fontSize: '0.9rem' }}>
          Template Name <span style={{ color: '#FF4D4D' }}>*</span>
        </div>
        <input
          style={inp}
          value={form.templateName}
          onChange={set('templateName')}
          placeholder="e.g. Hyatt Free Night Anniversary"
          required
        />
      </div>

      <div style={cardStyle}>
        <div style={{ fontWeight: 700, color: '#fff', marginBottom: '0.85rem', fontSize: '0.9rem' }}>Card (optional)</div>
        <select style={{ ...inp, appearance: 'none' }} value={form.cardId} onChange={set('cardId')}>
          <option value="">— None —</option>
          {allCards.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      <div style={cardStyle}>
        <div style={{ fontWeight: 700, color: '#fff', marginBottom: '0.85rem', fontSize: '0.9rem' }}>Person (optional)</div>
        <select style={{ ...inp, appearance: 'none' }} value={form.personId} onChange={set('personId')}>
          <option value="">— None —</option>
          {allPeople.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>

      <div style={cardStyle}>
        <div style={{ fontWeight: 700, color: '#fff', marginBottom: '0.85rem', fontSize: '0.9rem' }}>Record Type</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {RECORD_TYPES.map(t => pill('recordType', t))}
        </div>
      </div>

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

      <div style={cardStyle}>
        <div style={{ fontWeight: 700, color: '#fff', marginBottom: '1rem', fontSize: '0.9rem' }}>Benefit Details</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={grid2}>
            <div>
              <label style={lbl}>Benefit Type</label>
              <input style={inp} value={form.benefitType} onChange={set('benefitType')} placeholder="e.g. Cat 1-4, $250 Statement Credit" />
            </div>
            <div>
              <label style={lbl}>Benefit Value ($)</label>
              <input style={inp} type="number" min="0" value={form.benefitValue} onChange={set('benefitValue')} placeholder="0" />
            </div>
          </div>
          <div style={grid2}>
            <div>
              <label style={lbl}>Estimated Value ($)</label>
              <input style={inp} type="number" min="0" value={form.estimatedValue} onChange={set('estimatedValue')} placeholder="0" />
            </div>
          </div>
        </div>
      </div>

      <div style={cardStyle}>
        <div style={{ fontWeight: 700, color: '#fff', marginBottom: '0.85rem', fontSize: '0.9rem' }}>Reset Cycle</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {RESET_CYCLES.map(r => pill('resetCycle', r))}
        </div>
      </div>

      <div style={cardStyle}>
        <div style={{ fontWeight: 700, color: '#fff', marginBottom: '0.85rem', fontSize: '0.9rem' }}>Notes</div>
        <textarea
          style={{ ...inp, minHeight: 90, resize: 'vertical' }}
          value={form.notes}
          onChange={set('notes')}
          placeholder="Any additional notes…"
        />
      </div>

      {error && (
        <div style={{ background: '#FF4D4D22', border: '1px solid #FF4D4D', borderRadius: 10, padding: '0.85rem 1rem', color: '#FF4D4D' }}>
          {error}
        </div>
      )}

      <div style={{ display: 'flex', gap: '0.75rem' }}>
        <button type="submit" disabled={submitting} style={{
          padding: '0.85rem 2rem', borderRadius: 10, border: 'none',
          background: submitting ? 'rgba(0,212,255,0.4)' : '#00D4FF',
          color: '#0B1220', fontWeight: 700, fontSize: '0.95rem',
          cursor: submitting ? 'not-allowed' : 'pointer',
        }}>
          {submitting ? 'Saving…' : 'Save Template'}
        </button>
        <button type="button" onClick={onCancel} style={{
          padding: '0.85rem 1.5rem', borderRadius: 10, border: '1px solid rgba(255,255,255,0.15)',
          background: 'transparent', color: 'rgba(255,255,255,0.6)', fontWeight: 600,
          fontSize: '0.95rem', cursor: 'pointer',
        }}>
          Cancel
        </button>
      </div>
    </form>
  );
}

function recordToForm(r) {
  const f = r.fields;
  return {
    templateName: f['Template Name'] || '',
    cardId: (f['Card'] || [])[0] || '',
    personId: (f['Person'] || [])[0] || '',
    recordType: f['Record Type'] || '',
    howEarned: f['How Earned'] || '',
    spendThreshold: f['Spend Threshold Amount'] != null ? String(f['Spend Threshold Amount']) : '',
    benefitType: f['Benefit Type'] || '',
    benefitValue: f['Benefit Value'] != null ? String(f['Benefit Value']) : '',
    resetCycle: f['Reset Cycle'] || '',
    estimatedValue: f['Estimated Value'] != null ? String(f['Estimated Value']) : '',
    notes: f['Notes'] || '',
  };
}

function formToFields(form) {
  const fields = {};
  if (form.templateName.trim()) fields['Template Name'] = form.templateName.trim();
  if (form.cardId) fields['Card'] = [form.cardId];
  if (form.personId) fields['Person'] = [form.personId];
  if (form.recordType) fields['Record Type'] = form.recordType;
  if (form.howEarned) fields['How Earned'] = form.howEarned;
  if (form.spendThreshold) fields['Spend Threshold Amount'] = parseFloat(form.spendThreshold);
  if (form.benefitType.trim()) fields['Benefit Type'] = form.benefitType.trim();
  if (form.benefitValue) fields['Benefit Value'] = parseFloat(form.benefitValue);
  if (form.resetCycle) fields['Reset Cycle'] = form.resetCycle;
  if (form.estimatedValue) fields['Estimated Value'] = parseFloat(form.estimatedValue);
  if (form.notes.trim()) fields['Notes'] = form.notes.trim();
  return fields;
}

export function HotelBenefitTemplatesTab() {
  const [templates, setTemplates] = useState([]);
  const [allCards, setAllCards] = useState([]);
  const [allPeople, setAllPeople] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('list'); // 'list' | 'add' | 'edit'
  const [editRecord, setEditRecord] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState('');

  async function load() {
    setLoading(true);
    try {
      const [tmpl, cards, people] = await Promise.all([
        fetchTable(HOTEL_TEMPLATES_TABLE, [
          'Template Name', 'Card', 'Person', 'Record Type', 'How Earned',
          'Spend Threshold Amount', 'Benefit Type', 'Benefit Value',
          'Reset Cycle', 'Estimated Value', 'Notes',
        ]),
        fetchTable(PORTFOLIO_TABLE, ['Card Name', 'Status'])
          .then(r => r.filter(x => x.fields['Status'] === 'Active')
            .map(x => ({ id: x.id, name: x.fields['Card Name'] || x.id }))
            .sort((a, b) => a.name.localeCompare(b.name))),
        fetchTable(PEOPLE_TABLE, ['Name'])
          .then(r => r.map(x => ({ id: x.id, name: x.fields['Name'] || x.id }))
            .sort((a, b) => a.name.localeCompare(b.name))),
      ]);
      setTemplates(tmpl.sort((a, b) => (a.fields['Template Name'] || '').localeCompare(b.fields['Template Name'] || '')));
      setAllCards(cards);
      setAllPeople(people);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  function openAdd() {
    setForm(EMPTY_FORM);
    setEditRecord(null);
    setError(null);
    setView('add');
  }

  function openEdit(rec) {
    setForm(recordToForm(rec));
    setEditRecord(rec);
    setError(null);
    setView('edit');
  }

  function cancel() {
    setView('list');
    setEditRecord(null);
    setError(null);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.templateName.trim()) { setError('Template Name is required.'); return; }
    setSubmitting(true);
    setError(null);
    try {
      const fields = formToFields(form);
      if (view === 'edit' && editRecord) {
        await updateRecord(HOTEL_TEMPLATES_TABLE, editRecord.id, fields);
        setSuccess('Template updated.');
      } else {
        await createRecord(HOTEL_TEMPLATES_TABLE, fields);
        setSuccess('Template created.');
      }
      await load();
      setView('list');
      setTimeout(() => setSuccess(''), 4000);
    } catch (err) {
      setError(String(err.message || err));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(rec) {
    if (!window.confirm(`Delete template "${rec.fields['Template Name']}"?`)) return;
    try {
      await deleteRecord(HOTEL_TEMPLATES_TABLE, rec.id);
      await load();
      setSuccess('Template deleted.');
      setTimeout(() => setSuccess(''), 4000);
    } catch (err) {
      alert('Delete failed: ' + err.message);
    }
  }

  if (loading) {
    return <div style={{ padding: '3rem', textAlign: 'center', color: 'rgba(255,255,255,0.4)' }}>Loading…</div>;
  }

  if (view === 'add' || view === 'edit') {
    return (
      <div style={{ maxWidth: 780 }}>
        <div style={{ marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <h2 style={{ margin: 0, fontSize: '1.1rem', color: '#fff' }}>
            {view === 'edit' ? 'Edit Template' : 'Add Template'}
          </h2>
        </div>
        <TemplateForm
          form={form}
          setForm={setForm}
          allCards={allCards}
          allPeople={allPeople}
          onSubmit={handleSubmit}
          onCancel={cancel}
          submitting={submitting}
          error={error}
        />
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 900 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
        <h2 style={{ margin: 0, fontSize: '1.1rem', color: '#fff' }}>Hotel Benefit Templates</h2>
        <button onClick={openAdd} style={{
          padding: '0.55rem 1.25rem', borderRadius: 8, border: 'none',
          background: '#00D4FF', color: '#0B1220', fontWeight: 700,
          fontSize: '0.85rem', cursor: 'pointer',
        }}>
          + Add Template
        </button>
      </div>

      {success && (
        <div style={{ background: '#00E67622', border: '1px solid #00E676', borderRadius: 10, padding: '0.75rem 1rem', color: '#00E676', fontWeight: 600, marginBottom: '1rem' }}>
          {success}
        </div>
      )}

      {templates.length === 0 ? (
        <div style={{ ...cardStyle, color: 'rgba(255,255,255,0.4)', textAlign: 'center', padding: '3rem' }}>
          No templates yet. Click <strong style={{ color: '#00D4FF' }}>+ Add Template</strong> to create one.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {templates.map(rec => {
            const f = rec.fields;
            return (
              <div key={rec.id} style={{ ...cardStyle, display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, color: '#fff', fontSize: '0.95rem', marginBottom: 4 }}>
                    {f['Template Name'] || '—'}
                  </div>
                  <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                    {f['Record Type'] && <Chip>{f['Record Type']}</Chip>}
                    {f['How Earned'] && <Chip>{f['How Earned']}</Chip>}
                    {f['Reset Cycle'] && <Chip>{f['Reset Cycle']}</Chip>}
                    {f['Benefit Type'] && <Chip dim>{f['Benefit Type']}</Chip>}
                    {f['Estimated Value'] != null && <Chip accent>${f['Estimated Value'].toFixed(0)}</Chip>}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
                  <button onClick={() => openEdit(rec)} style={{
                    padding: '0.4rem 0.9rem', borderRadius: 7, border: '1px solid rgba(255,255,255,0.15)',
                    background: 'transparent', color: 'rgba(255,255,255,0.7)', fontSize: '0.82rem',
                    cursor: 'pointer', fontWeight: 600,
                  }}>Edit</button>
                  <button onClick={() => handleDelete(rec)} style={{
                    padding: '0.4rem 0.9rem', borderRadius: 7, border: '1px solid rgba(255,77,77,0.3)',
                    background: 'rgba(255,77,77,0.08)', color: '#FF4D4D', fontSize: '0.82rem',
                    cursor: 'pointer', fontWeight: 600,
                  }}>Delete</button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Chip({ children, accent, dim }) {
  return (
    <span style={{
      fontSize: '0.75rem', padding: '2px 10px', borderRadius: 12,
      background: accent ? 'rgba(0,212,255,0.12)' : dim ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.08)',
      color: accent ? '#00D4FF' : dim ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.55)',
      border: accent ? '1px solid rgba(0,212,255,0.25)' : '1px solid rgba(255,255,255,0.08)',
    }}>
      {children}
    </span>
  );
}
