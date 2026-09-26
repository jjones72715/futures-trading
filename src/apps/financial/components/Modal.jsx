import { useEffect, useState, useCallback } from 'react';
import { createRecord, updateRecord, deleteRecord } from '../services/financialService.js';
import { FORMS } from '../config/forms.js';

export default function Modal({ title, onClose, children, footer }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="fin-overlay" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="fin-modal" role="dialog" aria-modal="true" aria-label={title}>
        <div className="fin-modal-head">
          <div className="fin-modal-title">{title}</div>
          <button className="fin-modal-close" onClick={onClose} aria-label="Close">×</button>
        </div>
        <div className="fin-modal-body">{children}</div>
        {footer && <div className="fin-modal-foot">{footer}</div>}
      </div>
    </div>
  );
}

function toFormValue(spec, raw) {
  if (spec.type === 'checkbox') return raw === true;
  if (raw == null) return '';
  if (spec.type === 'percent') return String(Math.round(raw * 10000) / 100);
  return String(raw);
}

function parseNumber(str) {
  const cleaned = String(str).replace(/[$,%\s]/g, '');
  if (cleaned === '') return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : NaN;
}

function toAirtableValue(spec, value) {
  switch (spec.type) {
    case 'checkbox': return !!value;
    case 'currency':
    case 'number': return parseNumber(value);
    case 'percent': {
      const n = parseNumber(value);
      return n == null || Number.isNaN(n) ? n : n / 100;
    }
    default: {
      const s = String(value ?? '').trim();
      return s === '' ? null : s;
    }
  }
}

function Field({ spec, value, onChange, listId }) {
  const set = (e) => onChange(spec.type === 'checkbox' ? e.target.checked : e.target.value);
  if (spec.type === 'checkbox') {
    return (
      <label className="fin-check">
        <input type="checkbox" checked={!!value} onChange={set} />
        {spec.name}
      </label>
    );
  }
  let input;
  if (spec.type === 'textarea') {
    input = <textarea className="fin-input" rows={3} value={value} onChange={set} placeholder={spec.placeholder} />;
  } else if (spec.type === 'select') {
    const opts = value && !spec.options.includes(value) ? [value, ...spec.options] : spec.options;
    input = (
      <select className="fin-input" value={value} onChange={set}>
        <option value="">—</option>
        {opts.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    );
  } else if (spec.type === 'currency') {
    input = (
      <div className="fin-input-prefix">
        <span>$</span>
        <input className="fin-input" inputMode="decimal" value={value} onChange={set} placeholder="0.00" />
      </div>
    );
  } else if (spec.type === 'percent') {
    input = (
      <div className="fin-input-prefix fin-input-suffix">
        <input className="fin-input" inputMode="decimal" value={value} onChange={set} placeholder="0.0" />
        <span>%</span>
      </div>
    );
  } else if (spec.type === 'date') {
    input = <input className="fin-input" type="date" value={value} onChange={set} />;
  } else if (spec.type === 'number') {
    input = <input className="fin-input" inputMode="decimal" value={value} onChange={set} />;
  } else {
    input = <input className="fin-input" value={value} onChange={set} placeholder={spec.placeholder} list={listId} />;
  }
  return (
    <>
      <span className="fin-label">{spec.name}{spec.required && <span style={{ color: 'var(--negative)' }}> *</span>}</span>
      {input}
      {spec.hint && <span className="fin-hint">{spec.hint}</span>}
    </>
  );
}

/**
 * Add/Edit form for one Airtable table, driven by the specs in config/forms.js.
 * `transform(fields, { isNew })` may adjust the payload before it is saved.
 */
export function RecordModal({ table, record, defaults, title, suggestions = {}, transform, onClose, onSaved, allowDelete = true }) {
  const specs = FORMS[table];
  const isNew = !record;
  const [values, setValues] = useState(() => Object.fromEntries(specs.map(s => {
    const raw = record ? record.fields[s.name] : (defaults?.[s.name] ?? s.default);
    return [s.name, toFormValue(s, raw)];
  })));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  async function handleSubmit(e) {
    e?.preventDefault();
    setError(null);
    let fields = {};
    for (const s of specs) {
      const v = toAirtableValue(s, values[s.name]);
      if (Number.isNaN(v)) { setError(`${s.name} must be a number.`); return; }
      if (s.required && (v == null || v === '')) { setError(`${s.name} is required.`); return; }
      if (isNew && v == null) continue; // don't send empties on create
      fields[s.name] = v;
    }
    if (transform) fields = transform(fields, { isNew });
    setSaving(true);
    try {
      if (isNew) await createRecord(table, fields);
      else await updateRecord(table, record.id, fields);
      await onSaved?.();
      onClose();
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!window.confirm('Delete this record? This cannot be undone.')) return;
    setSaving(true);
    try {
      await deleteRecord(table, record.id);
      await onSaved?.();
      onClose();
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  }

  const footer = (
    <>
      <div>
        {!isNew && allowDelete && (
          <button type="button" className="fin-btn danger" onClick={handleDelete} disabled={saving}>Delete</button>
        )}
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button type="button" className="fin-btn" onClick={onClose} disabled={saving}>Cancel</button>
        <button type="button" className="fin-btn primary" onClick={handleSubmit} disabled={saving}>
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
    </>
  );

  return (
    <Modal title={title || (isNew ? 'Add' : 'Edit')} onClose={saving ? () => {} : onClose} footer={footer}>
      {error && <div className="fin-error">{error}</div>}
      <form className="fin-form" onSubmit={handleSubmit}>
        {specs.map(s => {
          const listId = s.suggest && suggestions[s.name]?.length ? `fin-dl-${table}-${s.name}` : undefined;
          return (
            <div key={s.name} className={`fin-field${s.full || s.type === 'textarea' ? ' full' : ''}`}>
              <Field spec={s} value={values[s.name]} listId={listId}
                onChange={v => setValues(prev => ({ ...prev, [s.name]: v }))} />
              {listId && (
                <datalist id={listId}>
                  {suggestions[s.name].map(o => <option key={o} value={o} />)}
                </datalist>
              )}
            </div>
          );
        })}
        <button type="submit" style={{ display: 'none' }} />
      </form>
    </Modal>
  );
}

// Convenience hook: const editor = useRecordEditor({...}); editor.open(record?, defaults?); render {editor.modal}
export function useRecordEditor({ table, noun, reload, suggestions, transform, allowDelete }) {
  const [state, setState] = useState(null);
  const open = useCallback((record = null, defaults = null) => setState({ record, defaults }), []);
  const close = useCallback(() => setState(null), []);
  const modal = state && (
    <RecordModal
      table={table}
      record={state.record}
      defaults={state.defaults}
      title={`${state.record ? 'Edit' : 'Add'} ${noun}`}
      suggestions={suggestions}
      transform={transform}
      allowDelete={allowDelete}
      onClose={close}
      onSaved={reload}
    />
  );
  return { open, modal };
}
