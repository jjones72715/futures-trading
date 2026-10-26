import { useEffect, useState } from 'react';
import SidePanel, { PanelSection, PanelRow } from './SidePanel.jsx';
import CurrencyInput from './CurrencyInput.jsx';
import { StatusPill } from './Status.jsx';
import { Switch } from './ui.jsx';
import { updateRecord } from '../services/financialService.js';
import { useCycle, cycleStatus, LAST_UPDATED } from '../hooks/useCycle.jsx';
import { formatCurrency, formatDate, localIsoDate, num, parseAmount } from '../utils/formatters.js';

const toInput = (v) => (v == null ? '' : String(v));

/**
 * Shared reconciliation side panel:
 *   header (title, subtitle, chips) → Balance History → Update Current Balance form → extra sections.
 *
 * Saving writes Previous = the "Previous" input, Current = the "Current" input, Last Updated = today,
 * plus any `extraInputs` ({ field, label }), then reloads so the row's status dot updates immediately.
 * `invert` colors the change for debts (a rising balance is bad).
 */
export default function BalanceUpdatePanel({
  table, record, reload, onClose, onEdit,
  title, subtitle, chips,
  currentField = 'Current Balance', previousField = 'Previous Balance',
  currentLabel = 'Current Balance', previousLabel = 'Previous Balance',
  invert = false, historyRows = null, extraInputs = [], children,
}) {
  const cycle = useCycle();
  const f = record.fields;
  const status = cycleStatus(f[LAST_UPDATED], cycle);
  const current = f[currentField];
  const previous = f[previousField];
  const change = num(current) - num(previous);
  const changeColor = change === 0 ? undefined : (change > 0) !== invert ? 'var(--positive)' : 'var(--negative)';

  const [prevInput, setPrevInput] = useState('');
  const [curInput, setCurInput] = useState('');
  const [extra, setExtra] = useState({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [savedAt, setSavedAt] = useState(null);

  // Re-prefill whenever the record (or its saved values) change: Previous ← current value, Current empty.
  const extraKey = extraInputs.map(x => f[x.field]).join('|');
  useEffect(() => {
    setPrevInput(toInput(current));
    setCurInput('');
    setExtra(Object.fromEntries(extraInputs.map(x => [x.field, toInput(f[x.field])])));
    setError(null);
  }, [record.id, current, f[LAST_UPDATED], extraKey]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { setSavedAt(null); }, [record.id]);

  async function save(e) {
    e.preventDefault();
    const prev = parseAmount(prevInput);
    const cur = parseAmount(curInput);
    if (cur == null) { setError(`Enter the new ${currentLabel.toLowerCase()}.`); return; }
    if (Number.isNaN(cur) || Number.isNaN(prev)) { setError('Amounts must be numbers, e.g. 1,234.56'); return; }
    const fields = { [previousField]: prev, [currentField]: cur, [LAST_UPDATED]: localIsoDate() };
    for (const x of extraInputs) {
      const v = parseAmount(extra[x.field]);
      if (Number.isNaN(v)) { setError(`${x.label} must be a number.`); return; }
      fields[x.field] = v;
    }
    setSaving(true);
    setError(null);
    try {
      await updateRecord(table, record.id, fields);
      await reload();
      setSavedAt(new Date());
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <SidePanel title={title} subtitle={subtitle} onClose={onClose}
      footer={onEdit && <button className="fin-btn" onClick={onEdit}>Edit all fields</button>}>
      {chips && <PanelSection><div className="fin-card-chips">{chips}</div></PanelSection>}

      <PanelSection label="Balance History">
        <PanelRow label={`Previous`}>{formatCurrency(previous)}</PanelRow>
        <PanelRow label={`Current`}><strong>{formatCurrency(current)}</strong></PanelRow>
        <PanelRow label="Change">
          <span style={{ color: changeColor }}>{change > 0 ? '+' : change < 0 ? '−' : ''}{formatCurrency(Math.abs(change))}</span>
        </PanelRow>
        {historyRows}
        <PanelRow label="Last Updated">{f[LAST_UPDATED] ? formatDate(f[LAST_UPDATED]) : 'Never'}</PanelRow>
        <div className="fin-panel-row" style={{ alignItems: 'center' }}>
          <span className="fin-muted">Status</span>
          <StatusPill status={status} />
        </div>
      </PanelSection>

      <PanelSection label={`Update ${currentLabel}`}>
        <form className="fin-panel-form" onSubmit={save}>
          <CurrencyInput label={previousLabel} value={prevInput} onChange={setPrevInput} />
          <CurrencyInput label={currentLabel} value={curInput} onChange={setCurInput} placeholder="New amount" />
          {extraInputs.map(x => (
            <CurrencyInput key={x.field} label={x.label} value={extra[x.field] ?? ''} placeholder=""
              onChange={v => setExtra(prev => ({ ...prev, [x.field]: v }))} />
          ))}
          {error && <div className="fin-error" style={{ margin: 0 }}>{error}</div>}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button type="submit" className="fin-btn primary" disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
            {savedAt && !saving && <span className="fin-hint" style={{ color: 'var(--positive)' }}>✓ Saved · Last Updated set to today</span>}
          </div>
        </form>
      </PanelSection>

      {children}
    </SidePanel>
  );
}

export function PanelNotes({ notes }) {
  if (!notes) return null;
  return <PanelSection label="Notes"><div className="fin-notes">{notes}</div></PanelSection>;
}

export function PanelActive({ active, onToggle, toggling, hint }) {
  return (
    <PanelSection>
      <div className="fin-panel-row" style={{ alignItems: 'center' }}>
        <span>{active ? 'Active' : 'Inactive'}</span>
        <Switch on={active} onChange={onToggle} disabled={toggling} />
      </div>
      {hint && <span className="fin-hint">{hint}</span>}
    </PanelSection>
  );
}
