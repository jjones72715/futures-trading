import { useState, useEffect, useCallback } from 'react';
import { fetchTable, createRecord, updateRecord } from '../services/airtable.js';
import { SUGGESTIONS_TABLE } from '../config/tables.js';

const FIELDS = ['Suggestion', 'Importance', 'Completed', 'Date Added'];

const cardStyle = {
  background: '#172033', borderRadius: 12, border: '1px solid rgba(255,255,255,0.08)',
  padding: '1.25rem 1.5rem',
};

const inp = {
  width: '100%', background: '#0B1220', border: '1px solid rgba(255,255,255,0.12)',
  borderRadius: 8, padding: '0.6rem 0.75rem', color: '#fff', fontSize: '0.88rem',
  outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit', resize: 'vertical',
};

const lbl = {
  display: 'block', fontSize: '0.7rem', fontWeight: 600,
  color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase',
  letterSpacing: '0.05em', marginBottom: 5,
};

const IMPORTANCE_COLORS = {
  1: 'rgba(255,255,255,0.3)',
  2: 'rgba(255,255,255,0.45)',
  3: '#7FD8EA',
  4: '#33DCFF',
  5: '#00D4FF',
};

function importanceColor(n) {
  return IMPORTANCE_COLORS[n] || 'rgba(255,255,255,0.3)';
}

function todayStr() {
  return new Date().toISOString().split('T')[0];
}

function fmtDate(dateStr) {
  if (!dateStr) return '—';
  const [y, m, d] = dateStr.split('-');
  return `${parseInt(m)}/${parseInt(d)}/${y}`;
}

function ImportancePicker({ value, onChange }) {
  return (
    <div style={{ display: 'flex', gap: 8 }}>
      {[1, 2, 3, 4, 5].map(n => (
        <button
          type="button"
          key={n}
          onClick={() => onChange(n)}
          style={{
            width: 36, height: 36, borderRadius: 8,
            border: `1px solid ${value === n ? importanceColor(n) : 'rgba(255,255,255,0.12)'}`,
            background: value === n ? importanceColor(n) : 'rgba(255,255,255,0.06)',
            color: value === n ? '#0B1220' : 'rgba(255,255,255,0.6)',
            fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer', transition: 'all 0.15s',
          }}
        >
          {n}
        </button>
      ))}
    </div>
  );
}

function AddSuggestionForm({ onSubmit, submitting, error }) {
  const [text, setText] = useState('');
  const [importance, setImportance] = useState(3);

  async function handleSubmit(e) {
    e.preventDefault();
    const ok = await onSubmit({ text, importance });
    if (ok) {
      setText('');
      setImportance(3);
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ ...cardStyle, display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div style={{ fontWeight: 700, color: '#fff', fontSize: '0.95rem' }}>New Suggestion</div>

      <div>
        <label style={lbl}>Suggestion <span style={{ color: '#FF4D4D' }}>*</span></label>
        <textarea
          style={{ ...inp, minHeight: 80 }}
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="What's the suggestion?"
        />
      </div>

      <div>
        <label style={lbl}>Importance</label>
        <ImportancePicker value={importance} onChange={setImportance} />
      </div>

      {error && (
        <div style={{ background: '#FF4D4D22', border: '1px solid #FF4D4D', borderRadius: 8, padding: '0.6rem 0.85rem', color: '#FF4D4D', fontSize: '0.82rem' }}>
          {error}
        </div>
      )}

      <div>
        <button type="submit" disabled={submitting} style={{
          padding: '0.6rem 1.5rem', borderRadius: 8, border: 'none',
          background: submitting ? 'rgba(0,212,255,0.4)' : '#00D4FF',
          color: '#0B1220', fontWeight: 700, fontSize: '0.85rem',
          cursor: submitting ? 'not-allowed' : 'pointer',
        }}>
          {submitting ? 'Saving…' : 'Add Suggestion'}
        </button>
      </div>
    </form>
  );
}

const ROW_COLUMNS = '1fr 90px 110px 32px';

function SuggestionRow({ row, onToggleCompleted }) {
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: ROW_COLUMNS, gap: '0.75rem',
      alignItems: 'center', padding: '0.75rem 1rem', borderRadius: 10,
      background: '#172033', border: '1px solid rgba(255,255,255,0.06)',
    }}>
      <span style={{ color: '#fff', fontSize: '0.88rem', whiteSpace: 'pre-wrap' }}>{row.text}</span>
      <span style={{ color: importanceColor(row.importance), fontWeight: 700, fontSize: '0.88rem' }}>
        {row.importance ?? '—'}
      </span>
      <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.82rem' }}>{fmtDate(row.dateAdded)}</span>
      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <input
          type="checkbox"
          checked={row.completed}
          onChange={() => onToggleCompleted(row)}
          style={{ accentColor: '#00D4FF', width: 17, height: 17, cursor: 'pointer' }}
        />
      </div>
    </div>
  );
}

export function SuggestionsTab() {
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showActiveOnly, setShowActiveOnly] = useState(true);
  const [addSubmitting, setAddSubmitting] = useState(false);
  const [addError, setAddError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    const records = await fetchTable(SUGGESTIONS_TABLE, FIELDS);
    setSuggestions(records);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleAdd({ text, importance }) {
    setAddError(null);
    if (!text.trim()) { setAddError('Suggestion is required.'); return false; }

    setAddSubmitting(true);
    try {
      const result = await createRecord(SUGGESTIONS_TABLE, {
        'Suggestion': text.trim(),
        'Importance': importance,
        'Date Added': todayStr(),
      });
      setSuggestions(prev => [...prev, result]);
      return true;
    } catch (err) {
      console.error('Add suggestion failed', err);
      setAddError(String(err.message || err));
      return false;
    } finally {
      setAddSubmitting(false);
    }
  }

  async function toggleCompleted(row) {
    const newVal = !row.completed;
    setSuggestions(prev => prev.map(r => r.id === row.id ? { ...r, fields: { ...r.fields, Completed: newVal } } : r));
    try {
      await updateRecord(SUGGESTIONS_TABLE, row.id, { 'Completed': newVal });
    } catch (e) {
      console.error('Toggle completed failed', e);
      setSuggestions(prev => prev.map(r => r.id === row.id ? { ...r, fields: { ...r.fields, Completed: row.completed } } : r));
    }
  }

  const enriched = suggestions.map(r => ({
    id: r.id,
    text: r.fields['Suggestion'] || '',
    importance: r.fields['Importance'] ?? null,
    dateAdded: r.fields['Date Added'] || '',
    completed: !!r.fields['Completed'],
  }));

  const sorted = [...enriched]
    .filter(row => !showActiveOnly || !row.completed)
    .sort((a, b) => {
      const impDiff = (b.importance ?? 0) - (a.importance ?? 0);
      if (impDiff !== 0) return impDiff;
      if (!a.dateAdded && !b.dateAdded) return 0;
      if (!a.dateAdded) return 1;
      if (!b.dateAdded) return -1;
      return a.dateAdded.localeCompare(b.dateAdded);
    });

  if (loading) {
    return (
      <div style={{ padding: '3rem', textAlign: 'center', color: 'rgba(255,255,255,0.4)' }}>
        Loading…
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', maxWidth: 900 }}>
      <AddSuggestionForm onSubmit={handleAdd} submitting={addSubmitting} error={addError} />

      <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8rem', color: 'rgba(255,255,255,0.6)', cursor: 'pointer', width: 'fit-content' }}>
        <input
          type="checkbox"
          checked={showActiveOnly}
          onChange={e => setShowActiveOnly(e.target.checked)}
          style={{ accentColor: '#00D4FF', width: 15, height: 15 }}
        />
        Show Active Only
      </label>

      {sorted.length === 0 ? (
        <div style={{ ...cardStyle, textAlign: 'center', color: 'rgba(255,255,255,0.35)' }}>
          No suggestions match the current filters.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <div style={{
            display: 'grid', gridTemplateColumns: ROW_COLUMNS, gap: '0.75rem',
            padding: '0.25rem 1rem', fontSize: '0.68rem', color: 'rgba(255,255,255,0.3)',
            textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600,
          }}>
            <span>Suggestion</span>
            <span>Importance</span>
            <span>Date Added</span>
            <span />
          </div>
          {sorted.map(row => (
            <SuggestionRow key={row.id} row={row} onToggleCompleted={toggleCompleted} />
          ))}
        </div>
      )}
    </div>
  );
}
