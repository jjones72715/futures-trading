import { useEffect, useState } from 'react';
import SidePanel, { PanelSection } from './SidePanel.jsx';
import { Field, toFormValue, toAirtableValue } from './Modal.jsx';
import { FORMS } from '../config/forms.js';
import { updateRecord, deleteRecord } from '../services/financialService.js';

/**
 * In-panel editor for a record's non-balance fields, driven by the specs in config/forms.js.
 * `fields` lists which form fields to show, in order. Save PATCHes them; Delete removes the record.
 * This replaces the center Edit modal — the modal is only used for adding records.
 * `transform(fields, { record })` may adjust the payload before it is saved (may be async).
 */
export default function EditDetailsSection({
  table, record, fields, reload, onDeleted, suggestions = {},
  collapsible = true, defaultOpen = false, title = 'Edit Details', allowDelete = true, transform,
}) {
  const specs = fields.map(name => FORMS[table].find(s => s.name === name)).filter(Boolean);
  const init = () => Object.fromEntries(specs.map(s => [s.name, toFormValue(s, record.fields[s.name])]));
  // Re-sync the inputs whenever the saved values change (e.g. after this or another form saves).
  const savedKey = JSON.stringify(specs.map(s => record.fields[s.name] ?? null));

  const [open, setOpen] = useState(defaultOpen || !collapsible);
  const [values, setValues] = useState(init);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => { setValues(init()); setError(null); }, [record.id, savedKey]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { setSaved(false); setOpen(defaultOpen || !collapsible); }, [record.id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function save(e) {
    e.preventDefault();
    let out = {};
    for (const s of specs) {
      const v = toAirtableValue(s, values[s.name]);
      if (Number.isNaN(v)) { setError(`${s.label || s.name} must be a number.`); return; }
      if (s.required && (v == null || v === '')) { setError(`${s.label || s.name} is required.`); return; }
      out[s.name] = v;
    }
    setSaving(true);
    setError(null);
    try {
      if (transform) out = await transform(out, { record });
      await updateRecord(table, record.id, out);
      await reload();
      setSaved(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!window.confirm('Delete this record? This cannot be undone.')) return;
    setSaving(true);
    try {
      await deleteRecord(table, record.id);
      await reload();
      onDeleted?.();
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  }

  return (
    <PanelSection>
      {collapsible ? (
        <button type="button" className="fin-panel-toggle" onClick={() => setOpen(o => !o)} aria-expanded={open}>
          <span className={`fin-sh-caret${open ? '' : ' closed'}`}>▼</span>
          <span className="fin-panel-label">{title}</span>
        </button>
      ) : <div className="fin-panel-label">{title}</div>}
      {open && (
        <form className="fin-panel-form" onSubmit={save}>
          {specs.map(s => {
            const listId = s.suggest && suggestions[s.name]?.length ? `fin-dd-${table}-${s.name}` : undefined;
            return (
              <div key={s.name} className="fin-field">
                <Field spec={s} value={values[s.name]} listId={listId}
                  onChange={v => { setSaved(false); setValues(prev => ({ ...prev, [s.name]: v })); }} />
                {listId && <datalist id={listId}>{suggestions[s.name].map(o => <option key={o} value={o} />)}</datalist>}
              </div>
            );
          })}
          {error && <div className="fin-error" style={{ margin: 0 }}>{error}</div>}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <button type="submit" className="fin-btn primary" disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
              {saved && !saving && <span className="fin-hint" style={{ color: 'var(--positive)' }}>✓ Saved</span>}
            </div>
            {allowDelete && <button type="button" className="fin-btn danger sm" onClick={remove} disabled={saving}>Delete</button>}
          </div>
        </form>
      )}
    </PanelSection>
  );
}

// Side panel that is only a details editor (records with no balance to reconcile).
export function RecordDetailsPanel({ table, record, title, subtitle, chips, fields, reload, onClose, suggestions, transform, children }) {
  return (
    <SidePanel title={title} subtitle={subtitle} onClose={onClose}>
      {chips && <PanelSection><div className="fin-card-chips">{chips}</div></PanelSection>}
      {children}
      <EditDetailsSection table={table} record={record} fields={fields} reload={reload}
        onDeleted={onClose} suggestions={suggestions} transform={transform} collapsible={false} title="Details" />
    </SidePanel>
  );
}
