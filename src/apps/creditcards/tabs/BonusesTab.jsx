import { useState, useEffect, useCallback } from 'react';
import { fetchTable, updateRecord, createRecord } from '../services/airtable.js';
import { SIGNUP_BONUSES_TABLE, SPEND_BONUSES_TABLE, PORTFOLIO_TABLE, CARD_PRODUCTS_TABLE } from '../config/tables.js';
import { PEOPLE, ALL_PEOPLE } from '../config/constants.js';
import { PersonFilter } from '../components/PersonFilter.jsx';
import { StatCard } from '../components/StatCard.jsx';
import { $$ } from '../utils/format.js';

const EMPTY_SIGNUP_FORM = { personId: '', cardId: '', description: '', spendTarget: '', approvalDate: '', bonusWindow: '' };
const EMPTY_SPEND_FORM = { productId: '', description: '', annualTarget: '', resetDate: '' };

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
const grid2 = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' };

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const SIGNUP_FIELDS = [
  'Bonus Description', 'Card', 'Person', 'Spend Target', 'Card Approval Date',
  'Bonus Window', 'Calculated Deadline', 'Deadline Override', 'Effective Deadline',
  'Days Remaining', 'Month 1', 'Month 2', 'Month 3', 'Month 4', 'Month 5', 'Month 6',
  'Current Spend', 'Remaining Spend', 'Achieved',
];

const SPEND_FIELDS = [
  'Bonus Description', 'Card', 'Person', 'Annual Spend Target',
  ...MONTH_NAMES, 'Current Spend', 'Remaining Spend', 'Reset Date',
  'Days Until Reset', 'Bonus Earned',
];

const cardStyle = {
  background: '#172033', borderRadius: 12, border: '1px solid rgba(255,255,255,0.08)',
  padding: '1.25rem 1.5rem',
};

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

function AddBonusButton({ onClick }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
      <button type="button" onClick={onClick} style={{
        padding: '0.5rem 1.1rem', borderRadius: 8, border: '1px solid rgba(0,212,255,0.3)',
        background: 'rgba(0,212,255,0.12)', color: '#00D4FF', fontWeight: 600, fontSize: '0.82rem', cursor: 'pointer',
      }}>
        + Add Bonus
      </button>
    </div>
  );
}

function PersonCardPicker({ personId, cardId, cards, onSelectPerson, onSelectCard }) {
  const filteredCards = personId ? cards.filter(c => c.owners.includes(personId)) : [];
  return (
    <>
      <div>
        <label style={lbl}>Person <span style={{ color: '#FF4D4D' }}>*</span></label>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {Object.entries(PEOPLE).map(([id, name]) => (
            <PillBtn key={id} active={personId === id} onClick={() => onSelectPerson(id)}>{name}</PillBtn>
          ))}
        </div>
      </div>

      {personId && (
        <div>
          <label style={lbl}>Card <span style={{ color: '#FF4D4D' }}>*</span></label>
          {filteredCards.length === 0 ? (
            <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.85rem' }}>No cards found for this person.</div>
          ) : (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {filteredCards.map(c => (
                <PillBtn key={c.id} active={cardId === c.id} onClick={() => onSelectCard(c.id)}>{c.name}</PillBtn>
              ))}
            </div>
          )}
        </div>
      )}
    </>
  );
}

function FormActions({ submitting, onCancel, error }) {
  return (
    <>
      {error && (
        <div style={{ background: '#FF4D4D22', border: '1px solid #FF4D4D', borderRadius: 8, padding: '0.6rem 0.85rem', color: '#FF4D4D', fontSize: '0.82rem' }}>
          {error}
        </div>
      )}
      <div style={{ display: 'flex', gap: 10 }}>
        <button type="submit" disabled={submitting} style={{
          padding: '0.6rem 1.5rem', borderRadius: 8, border: 'none',
          background: submitting ? 'rgba(0,212,255,0.4)' : '#00D4FF',
          color: '#0B1220', fontWeight: 700, fontSize: '0.85rem',
          cursor: submitting ? 'not-allowed' : 'pointer',
        }}>
          {submitting ? 'Saving…' : 'Add Bonus'}
        </button>
        <button type="button" onClick={onCancel} style={{
          padding: '0.6rem 1.5rem', borderRadius: 8, border: '1px solid rgba(255,255,255,0.15)',
          background: 'none', color: 'rgba(255,255,255,0.6)', fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer',
        }}>
          Cancel
        </button>
      </div>
    </>
  );
}

function AddSignupBonusForm({ cards, form, setForm, onSubmit, onCancel, submitting, error }) {
  function set(field) {
    return e => setForm(prev => ({ ...prev, [field]: e.target.value }));
  }
  return (
    <form onSubmit={onSubmit} style={{ ...cardStyle, display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div style={{ fontWeight: 700, color: '#fff', fontSize: '0.95rem' }}>New Sign-Up Bonus</div>

      <PersonCardPicker
        personId={form.personId}
        cardId={form.cardId}
        cards={cards}
        onSelectPerson={id => setForm(prev => ({ ...prev, personId: prev.personId === id ? '' : id, cardId: '' }))}
        onSelectCard={id => setForm(prev => ({ ...prev, cardId: prev.cardId === id ? '' : id }))}
      />

      <div>
        <label style={lbl}>Bonus Description</label>
        <input style={inp} value={form.description} onChange={set('description')} placeholder="e.g. $900 spend for 100k points" />
      </div>

      <div style={grid2}>
        <div>
          <label style={lbl}>Spend Target ($) <span style={{ color: '#FF4D4D' }}>*</span></label>
          <input style={inp} type="number" min="0" value={form.spendTarget} onChange={set('spendTarget')} placeholder="0" />
        </div>
        <div>
          <label style={lbl}>Bonus Window (months) <span style={{ color: '#FF4D4D' }}>*</span></label>
          <input style={inp} type="number" min="1" value={form.bonusWindow} onChange={set('bonusWindow')} placeholder="3" />
        </div>
      </div>

      <div>
        <label style={lbl}>Card Approval Date <span style={{ color: '#FF4D4D' }}>*</span></label>
        <input style={{ ...inp, maxWidth: 200 }} type="date" value={form.approvalDate} onChange={set('approvalDate')} />
      </div>

      <FormActions submitting={submitting} onCancel={onCancel} error={error} />
    </form>
  );
}

function AddSpendBonusForm({ productOptions, productHolders, form, setForm, onSubmit, onCancel, submitting, error }) {
  function set(field) {
    return e => setForm(prev => ({ ...prev, [field]: e.target.value }));
  }
  const holders = form.productId ? (productHolders[form.productId] || []) : [];
  return (
    <form onSubmit={onSubmit} style={{ ...cardStyle, display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div style={{ fontWeight: 700, color: '#fff', fontSize: '0.95rem' }}>New Spend Bonus</div>
      <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.45)', marginTop: -8 }}>
        Pick the card product — a bonus is created for every active card of that product, one per person.
      </div>

      <div>
        <label style={lbl}>Card Product <span style={{ color: '#FF4D4D' }}>*</span></label>
        <select style={inp} value={form.productId} onChange={set('productId')}>
          <option value="">— Select card product —</option>
          {productOptions.map(p => (
            <option key={p.id} value={p.id}>{p.name} ({p.count} card{p.count > 1 ? 's' : ''})</option>
          ))}
        </select>
      </div>

      {form.productId && (
        <div style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.55)' }}>
          Will create a bonus for: {holders.length > 0
            ? holders.map(h => PEOPLE[h.personId] || h.personId).join(', ')
            : 'no active cards found for this product'}
        </div>
      )}

      <div>
        <label style={lbl}>Bonus Description</label>
        <input style={inp} value={form.description} onChange={set('description')} placeholder="e.g. $25k annual spend bonus" />
      </div>

      <div style={grid2}>
        <div>
          <label style={lbl}>Annual Spend Target ($) <span style={{ color: '#FF4D4D' }}>*</span></label>
          <input style={inp} type="number" min="0" value={form.annualTarget} onChange={set('annualTarget')} placeholder="0" />
        </div>
        <div>
          <label style={lbl}>Reset Date <span style={{ color: '#FF4D4D' }}>*</span></label>
          <input style={inp} type="date" value={form.resetDate} onChange={set('resetDate')} />
        </div>
      </div>

      <FormActions submitting={submitting} onCancel={onCancel} error={error} />
    </form>
  );
}

function Stat({ label, value, color }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <span style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
        {label}
      </span>
      <span style={{ fontSize: '1rem', fontWeight: 700, color: color || '#fff' }}>{value}</span>
    </div>
  );
}

function MonthInputRow({ label, value, onChange, onSave, saving }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ width: 90, fontSize: '0.82rem', color: 'rgba(255,255,255,0.6)' }}>{label}</span>
      <input
        type="number"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder="$0.00"
        style={{
          background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)',
          borderRadius: 6, padding: '6px 10px', color: '#fff', fontSize: '0.85rem', width: 110,
        }}
      />
      <button
        type="button"
        onClick={onSave}
        disabled={saving || value === ''}
        style={{
          padding: '5px 14px', borderRadius: 8, border: '1px solid rgba(0,212,255,0.3)',
          background: saving ? 'rgba(0,212,255,0.08)' : 'rgba(0,212,255,0.15)',
          color: '#00D4FF', fontWeight: 600, fontSize: '0.78rem',
          cursor: saving || value === '' ? 'not-allowed' : 'pointer',
        }}
      >
        {saving ? 'Saving…' : 'Save'}
      </button>
    </div>
  );
}

function fmtDate(dateStr) {
  if (!dateStr) return '—';
  const [y, m, d] = dateStr.split('-');
  return `${parseInt(m)}/${parseInt(d)}/${y}`;
}

function deadlineColor(days) {
  return days != null && days < 14 ? '#FFD700' : 'rgba(255,255,255,0.5)';
}

function isPastOrToday(dateStr) {
  if (!dateStr) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(dateStr + 'T00:00:00');
  return d <= today;
}

function addYears(dateStr, years) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCFullYear(dt.getUTCFullYear() + years);
  return dt.toISOString().split('T')[0];
}

function signupMonthLabel(approvalDateStr, n) {
  if (!approvalDateStr) return `Month ${n}`;
  const [, m] = approvalDateStr.split('-').map(Number);
  const idx = (m - 1 + (n - 1)) % 12;
  return MONTH_NAMES[idx];
}

function SignupBonusCard({ row, monthInputs, setMonthInputs, savingKey, onSaveMonth, onToggleAchieved }) {
  const missingMonths = [1, 2, 3, 4, 5, 6].filter(n => row.fields[`Month ${n}`] == null);
  return (
    <div style={cardStyle}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8 }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: '1rem', color: '#fff' }}>{row.cardName}</div>
          <div style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.5)' }}>{row.personName}</div>
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8rem', color: 'rgba(255,255,255,0.6)', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={row.achieved}
            onChange={() => onToggleAchieved(row)}
            style={{ accentColor: '#00D4FF', width: 16, height: 16 }}
          />
          Achieved
        </label>
      </div>

      {row.description && (
        <div style={{ marginTop: 8, fontSize: '0.85rem', color: 'rgba(255,255,255,0.6)' }}>{row.description}</div>
      )}

      <div style={{ display: 'flex', gap: '1.5rem', marginTop: 12, flexWrap: 'wrap' }}>
        <Stat label="Spend Target" value={$$(row.spendTarget)} />
        <Stat label="Current Spend" value={$$(row.currentSpend)} color="#00D4FF" />
        <Stat label="Remaining Spend" value={$$(row.remainingSpend)} color="#00E676" />
      </div>

      <div style={{
        marginTop: 10, fontSize: '0.85rem', color: deadlineColor(row.daysRemaining),
        fontWeight: row.daysRemaining != null && row.daysRemaining < 14 ? 700 : 400,
      }}>
        Deadline: {fmtDate(row.effectiveDeadline)}{row.daysRemaining != null && ` (${row.daysRemaining} days remaining)`}
      </div>

      {!row.achieved && missingMonths.length > 0 && (
        <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {missingMonths.map(n => {
            const field = `Month ${n}`;
            const label = signupMonthLabel(row.approvalDate, n);
            const key = `${row.id}:${field}`;
            return (
              <MonthInputRow
                key={key}
                label={label}
                value={monthInputs[key] || ''}
                onChange={v => setMonthInputs(prev => ({ ...prev, [key]: v }))}
                onSave={() => onSaveMonth(SIGNUP_BONUSES_TABLE, row.id, field, true)}
                saving={savingKey === key}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

function SpendBonusCard({ row, monthInputs, setMonthInputs, savingKey, onSaveMonth, onToggleEarned }) {
  const missingMonths = MONTH_NAMES.filter(m => row.fields[m] == null);
  return (
    <div style={cardStyle}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8 }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: '1rem', color: '#fff' }}>{row.cardName}</div>
          <div style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.5)' }}>{row.personName}</div>
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8rem', color: 'rgba(255,255,255,0.6)', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={row.earned}
            onChange={() => onToggleEarned(row)}
            style={{ accentColor: '#00D4FF', width: 16, height: 16 }}
          />
          Bonus Earned
        </label>
      </div>

      {row.description && (
        <div style={{ marginTop: 8, fontSize: '0.85rem', color: 'rgba(255,255,255,0.6)' }}>{row.description}</div>
      )}

      <div style={{ display: 'flex', gap: '1.5rem', marginTop: 12, flexWrap: 'wrap' }}>
        <Stat label="Annual Spend Target" value={$$(row.annualTarget)} />
        <Stat label="Current Spend" value={$$(row.currentSpend)} color="#00D4FF" />
        <Stat label="Remaining Spend" value={$$(row.remainingSpend)} color="#00E676" />
      </div>

      <div style={{
        marginTop: 10, fontSize: '0.85rem', color: deadlineColor(row.daysUntilReset),
        fontWeight: row.daysUntilReset != null && row.daysUntilReset < 14 ? 700 : 400,
      }}>
        Reset: {fmtDate(row.resetDate)}{row.daysUntilReset != null && ` (${row.daysUntilReset} days)`}
      </div>

      {!row.earned && missingMonths.length > 0 && (
        <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {missingMonths.map(m => {
            const key = `${row.id}:${m}`;
            return (
              <MonthInputRow
                key={key}
                label={m}
                value={monthInputs[key] || ''}
                onChange={v => setMonthInputs(prev => ({ ...prev, [key]: v }))}
                onSave={() => onSaveMonth(SPEND_BONUSES_TABLE, row.id, m, false)}
                saving={savingKey === key}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

export function BonusesTab() {
  const [view, setView] = useState('signup');
  const [personFilter, setPersonFilter] = useState(ALL_PEOPLE);
  const [showActiveOnly, setShowActiveOnly] = useState(true);
  const [loading, setLoading] = useState(true);
  const [resetStatus, setResetStatus] = useState('');
  const [signupBonuses, setSignupBonuses] = useState([]);
  const [spendBonuses, setSpendBonuses] = useState([]);
  const [cardNameById, setCardNameById] = useState({});
  const [portfolioCards, setPortfolioCards] = useState([]);
  const [productOptions, setProductOptions] = useState([]);
  const [productHolders, setProductHolders] = useState({});
  const [monthInputs, setMonthInputs] = useState({});
  const [savingKey, setSavingKey] = useState(null);

  const [showAddSignup, setShowAddSignup] = useState(false);
  const [signupForm, setSignupForm] = useState(EMPTY_SIGNUP_FORM);
  const [addSignupSubmitting, setAddSignupSubmitting] = useState(false);
  const [addSignupError, setAddSignupError] = useState(null);

  const [showAddSpend, setShowAddSpend] = useState(false);
  const [spendForm, setSpendForm] = useState(EMPTY_SPEND_FORM);
  const [addSpendSubmitting, setAddSpendSubmitting] = useState(false);
  const [addSpendError, setAddSpendError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setResetStatus('');

    const [signup, spend, cards, products] = await Promise.all([
      fetchTable(SIGNUP_BONUSES_TABLE, SIGNUP_FIELDS),
      fetchTable(SPEND_BONUSES_TABLE, SPEND_FIELDS),
      fetchTable(PORTFOLIO_TABLE, ['Card Name', 'Owner', 'Current Product', 'Status']),
      fetchTable(CARD_PRODUCTS_TABLE, ['Product Name']),
    ]);

    setCardNameById(Object.fromEntries(cards.map(r => [r.id, r.fields['Card Name'] || r.id])));
    setPortfolioCards(
      cards
        .map(r => ({ id: r.id, name: r.fields['Card Name'] || r.id, owners: r.fields['Owner'] || [] }))
        .sort((a, b) => a.name.localeCompare(b.name))
    );

    const productNameById = Object.fromEntries(products.map(p => [p.id, p.fields['Product Name'] || p.id]));
    const holdersByProduct = {};
    cards.forEach(r => {
      if (r.fields['Status'] !== 'Active') return;
      const productId = (r.fields['Current Product'] || [])[0];
      const personId = (r.fields['Owner'] || [])[0];
      if (!productId || !personId) return;
      if (!holdersByProduct[productId]) holdersByProduct[productId] = [];
      holdersByProduct[productId].push({ cardId: r.id, personId });
    });
    setProductHolders(holdersByProduct);
    setProductOptions(
      Object.keys(holdersByProduct)
        .map(id => ({ id, name: productNameById[id] || id, count: holdersByProduct[id].length }))
        .sort((a, b) => a.name.localeCompare(b.name))
    );

    const toReset = spend.filter(r => isPastOrToday(r.fields['Reset Date']));
    if (toReset.length > 0) {
      setResetStatus(`Resetting ${toReset.length} bonus${toReset.length > 1 ? 'es' : ''}...`);
      await Promise.all(toReset.map(async r => {
        const patch = {};
        MONTH_NAMES.forEach(m => { patch[m] = 0; });
        patch['Bonus Earned'] = false;
        patch['Reset Date'] = addYears(r.fields['Reset Date'], 1);
        try {
          const updated = await updateRecord(SPEND_BONUSES_TABLE, r.id, patch);
          r.fields = updated.fields;
        } catch (e) {
          console.error('Spend bonus reset failed for', r.id, e);
        }
      }));
      setResetStatus('');
    }

    setSignupBonuses(signup);
    setSpendBonuses(spend);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function saveMonth(tableId, recordId, field, isSignup) {
    const key = `${recordId}:${field}`;
    const value = parseFloat(monthInputs[key]);
    if (Number.isNaN(value)) return;
    setSavingKey(key);
    const setter = isSignup ? setSignupBonuses : setSpendBonuses;
    try {
      const updated = await updateRecord(tableId, recordId, { [field]: value });
      setter(prev => prev.map(r => r.id === recordId ? { ...r, fields: updated.fields } : r));
      setMonthInputs(prev => { const n = { ...prev }; delete n[key]; return n; });
    } catch (e) {
      console.error('Save month failed', e);
    } finally {
      setSavingKey(null);
    }
  }

  async function toggleFlag(tableId, recordId, field, currentValue, isSignup) {
    const setter = isSignup ? setSignupBonuses : setSpendBonuses;
    const newVal = !currentValue;
    setter(prev => prev.map(r => r.id === recordId ? { ...r, fields: { ...r.fields, [field]: newVal } } : r));
    try {
      await updateRecord(tableId, recordId, { [field]: newVal });
    } catch (e) {
      console.error('Toggle failed', e);
      setter(prev => prev.map(r => r.id === recordId ? { ...r, fields: { ...r.fields, [field]: currentValue } } : r));
    }
  }

  async function handleAddSignup(e) {
    e.preventDefault();
    setAddSignupError(null);
    if (!signupForm.personId) { setAddSignupError('Person is required.'); return; }
    if (!signupForm.cardId) { setAddSignupError('Card is required.'); return; }
    if (!signupForm.spendTarget) { setAddSignupError('Spend Target is required.'); return; }
    if (!signupForm.approvalDate) { setAddSignupError('Card Approval Date is required.'); return; }
    if (!signupForm.bonusWindow) { setAddSignupError('Bonus Window is required.'); return; }

    setAddSignupSubmitting(true);
    const fields = {
      'Card': [signupForm.cardId],
      'Person': [signupForm.personId],
      'Spend Target': parseFloat(signupForm.spendTarget),
      'Card Approval Date': signupForm.approvalDate,
      'Bonus Window': parseInt(signupForm.bonusWindow, 10),
    };
    if (signupForm.description.trim()) fields['Bonus Description'] = signupForm.description.trim();

    try {
      const result = await createRecord(SIGNUP_BONUSES_TABLE, fields);
      setSignupBonuses(prev => [...prev, result]);
      setSignupForm(EMPTY_SIGNUP_FORM);
      setShowAddSignup(false);
    } catch (err) {
      console.error('Add sign-up bonus failed', err);
      setAddSignupError(String(err.message || err));
    } finally {
      setAddSignupSubmitting(false);
    }
  }

  async function handleAddSpend(e) {
    e.preventDefault();
    setAddSpendError(null);
    if (!spendForm.productId) { setAddSpendError('Card Product is required.'); return; }
    if (!spendForm.annualTarget) { setAddSpendError('Annual Spend Target is required.'); return; }
    if (!spendForm.resetDate) { setAddSpendError('Reset Date is required.'); return; }

    const holders = productHolders[spendForm.productId] || [];
    if (holders.length === 0) { setAddSpendError('No active cards found for this product.'); return; }

    setAddSpendSubmitting(true);
    const baseFields = {
      'Annual Spend Target': parseFloat(spendForm.annualTarget),
      'Reset Date': spendForm.resetDate,
    };
    if (spendForm.description.trim()) baseFields['Bonus Description'] = spendForm.description.trim();

    try {
      const created = await Promise.all(holders.map(h => createRecord(SPEND_BONUSES_TABLE, {
        ...baseFields,
        'Card': [h.cardId],
        'Person': [h.personId],
      })));
      setSpendBonuses(prev => [...prev, ...created]);
      setSpendForm(EMPTY_SPEND_FORM);
      setShowAddSpend(false);
    } catch (err) {
      console.error('Add spend bonus failed', err);
      setAddSpendError(String(err.message || err));
    } finally {
      setAddSpendSubmitting(false);
    }
  }

  const signupEnriched = signupBonuses.map(r => {
    const f = r.fields;
    const cardId = (f['Card'] || [])[0];
    const personId = (f['Person'] || [])[0];
    return {
      id: r.id,
      cardName: cardId ? (cardNameById[cardId] || '—') : '—',
      personName: personId ? (PEOPLE[personId] || '—') : '—',
      description: f['Bonus Description'] || '',
      spendTarget: f['Spend Target'] ?? null,
      currentSpend: f['Current Spend'] ?? 0,
      remainingSpend: f['Remaining Spend'] ?? null,
      approvalDate: f['Card Approval Date'] || '',
      effectiveDeadline: f['Effective Deadline'] || '',
      daysRemaining: f['Days Remaining'] ?? null,
      achieved: !!f['Achieved'],
      fields: f,
    };
  });

  const signupVisible = signupEnriched.filter(row => personFilter === ALL_PEOPLE || row.personName === personFilter);
  const signupActive = signupVisible.filter(row => !row.achieved);
  const signupActiveCount = signupActive.length;
  const signupActiveRemaining = signupActive.reduce((s, row) => s + (row.remainingSpend ?? 0), 0);

  const signupSorted = [...signupVisible.filter(row => !showActiveOnly || !row.achieved)].sort((a, b) => {
    if (a.daysRemaining == null && b.daysRemaining == null) return 0;
    if (a.daysRemaining == null) return 1;
    if (b.daysRemaining == null) return -1;
    return a.daysRemaining - b.daysRemaining;
  });

  const spendEnriched = spendBonuses.map(r => {
    const f = r.fields;
    const cardId = (f['Card'] || [])[0];
    const personId = (f['Person'] || [])[0];
    return {
      id: r.id,
      cardName: cardId ? (cardNameById[cardId] || '—') : '—',
      personName: personId ? (PEOPLE[personId] || '—') : '—',
      description: f['Bonus Description'] || '',
      annualTarget: f['Annual Spend Target'] ?? null,
      currentSpend: f['Current Spend'] ?? 0,
      remainingSpend: f['Remaining Spend'] ?? null,
      resetDate: f['Reset Date'] || '',
      daysUntilReset: f['Days Until Reset'] ?? null,
      earned: !!f['Bonus Earned'],
      fields: f,
    };
  });

  const spendVisible = spendEnriched.filter(row => personFilter === ALL_PEOPLE || row.personName === personFilter);
  const spendActive = spendVisible.filter(row => !row.earned);
  const spendActiveCount = spendActive.length;
  const spendActiveRemaining = spendActive.reduce((s, row) => s + (row.remainingSpend ?? 0), 0);

  const spendSorted = [...spendVisible.filter(row => !showActiveOnly || !row.earned)].sort((a, b) => {
    if (a.daysUntilReset == null && b.daysUntilReset == null) return 0;
    if (a.daysUntilReset == null) return 1;
    if (b.daysUntilReset == null) return -1;
    return a.daysUntilReset - b.daysUntilReset;
  });

  if (loading) {
    return (
      <div style={{ padding: '3rem', textAlign: 'center', color: 'rgba(255,255,255,0.4)' }}>
        {resetStatus || 'Loading…'}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', maxWidth: 1100 }}>

      <div style={{ display: 'flex', gap: 8 }}>
        <PillBtn active={view === 'signup'} onClick={() => setView('signup')}>Sign-Up Bonuses</PillBtn>
        <PillBtn active={view === 'spend'} onClick={() => setView('spend')}>Spend Bonuses</PillBtn>
      </div>

      <div style={cardStyle}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600, marginRight: 4 }}>
              Person
            </span>
            <PersonFilter selected={personFilter} onChange={setPersonFilter} />
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8rem', color: 'rgba(255,255,255,0.6)', cursor: 'pointer', width: 'fit-content' }}>
            <input
              type="checkbox"
              checked={showActiveOnly}
              onChange={e => setShowActiveOnly(e.target.checked)}
              style={{ accentColor: '#00D4FF', width: 15, height: 15 }}
            />
            Show Active Only
          </label>
        </div>
      </div>

      {resetStatus && (
        <div style={{
          background: 'rgba(0,212,255,0.08)', border: '1px solid rgba(0,212,255,0.25)',
          borderRadius: 10, padding: '0.75rem 1rem', color: '#00D4FF', fontSize: '0.85rem', fontWeight: 600,
        }}>
          {resetStatus}
        </div>
      )}

      {view === 'signup' ? (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, auto)', gap: '1rem', width: 'fit-content' }}>
            <StatCard label="Active Bonuses" value={signupActiveCount} accent="#00D4FF" />
            <StatCard label="Total Remaining Spend" value={$$(signupActiveRemaining)} accent="#00E676" />
          </div>

          {!showAddSignup && <AddBonusButton onClick={() => setShowAddSignup(true)} />}

          {showAddSignup && (
            <AddSignupBonusForm
              cards={portfolioCards}
              form={signupForm}
              setForm={setSignupForm}
              onSubmit={handleAddSignup}
              onCancel={() => { setShowAddSignup(false); setSignupForm(EMPTY_SIGNUP_FORM); setAddSignupError(null); }}
              submitting={addSignupSubmitting}
              error={addSignupError}
            />
          )}

          {signupSorted.length === 0 ? (
            <div style={{ ...cardStyle, textAlign: 'center', color: 'rgba(255,255,255,0.35)' }}>
              No sign-up bonuses match the current filters.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {signupSorted.map(row => (
                <SignupBonusCard
                  key={row.id}
                  row={row}
                  monthInputs={monthInputs}
                  setMonthInputs={setMonthInputs}
                  savingKey={savingKey}
                  onSaveMonth={saveMonth}
                  onToggleAchieved={r => toggleFlag(SIGNUP_BONUSES_TABLE, r.id, 'Achieved', r.achieved, true)}
                />
              ))}
            </div>
          )}
        </>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, auto)', gap: '1rem', width: 'fit-content' }}>
            <StatCard label="Active Bonuses" value={spendActiveCount} accent="#00D4FF" />
            <StatCard label="Total Remaining Spend" value={$$(spendActiveRemaining)} accent="#00E676" />
          </div>

          {!showAddSpend && <AddBonusButton onClick={() => setShowAddSpend(true)} />}

          {showAddSpend && (
            <AddSpendBonusForm
              productOptions={productOptions}
              productHolders={productHolders}
              form={spendForm}
              setForm={setSpendForm}
              onSubmit={handleAddSpend}
              onCancel={() => { setShowAddSpend(false); setSpendForm(EMPTY_SPEND_FORM); setAddSpendError(null); }}
              submitting={addSpendSubmitting}
              error={addSpendError}
            />
          )}

          {spendSorted.length === 0 ? (
            <div style={{ ...cardStyle, textAlign: 'center', color: 'rgba(255,255,255,0.35)' }}>
              No spend bonuses match the current filters.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {spendSorted.map(row => (
                <SpendBonusCard
                  key={row.id}
                  row={row}
                  monthInputs={monthInputs}
                  setMonthInputs={setMonthInputs}
                  savingKey={savingKey}
                  onSaveMonth={saveMonth}
                  onToggleEarned={r => toggleFlag(SPEND_BONUSES_TABLE, r.id, 'Bonus Earned', r.earned, false)}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
