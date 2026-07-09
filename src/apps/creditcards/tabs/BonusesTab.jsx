import { useState, useEffect, useCallback } from 'react';
import { fetchTable, updateRecord, createRecord } from '../services/airtable.js';
import {
  SIGNUP_BONUSES_TABLE, SPEND_BONUSES_TABLE, PORTFOLIO_TABLE, CARD_PRODUCTS_TABLE,
  SPEND_BONUS_DEFINITIONS_TABLE,
} from '../config/tables.js';
import { PEOPLE, ALL_PEOPLE } from '../config/constants.js';
import { PersonFilter } from '../components/PersonFilter.jsx';
import { StatCard } from '../components/StatCard.jsx';
import { $$, stripOwnerPrefix } from '../utils/format.js';

const EMPTY_SIGNUP_FORM = { personId: '', cardId: '', description: '', spendTarget: '', approvalDate: '', bonusWindow: '' };
const EMPTY_SPEND_FORM = { productId: '', description: '', annualTarget: '', resetType: '', notes: '', priorityScore: 3 };
const RESET_TYPES = ['Jan 1', 'Card Open Date'];

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
  'Days Until Reset', 'Bonus Earned', 'Spend Bonus Definition',
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

function PriorityDots({ value, onSet, size = 14 }) {
  return (
    <div style={{ display: 'flex', gap: 3 }} onClick={e => e.stopPropagation()}>
      {[1, 2, 3, 4, 5].map(n => (
        <button
          key={n}
          type="button"
          onClick={() => onSet(n)}
          title={`Priority ${n}`}
          style={{
            width: size, height: size, borderRadius: '50%', border: 'none',
            background: n <= (value || 0) ? '#00D4FF' : 'rgba(255,255,255,0.12)',
            cursor: 'pointer', padding: 0, flexShrink: 0,
            transition: 'background 0.1s',
          }}
        />
      ))}
    </div>
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
  const filteredCards = (() => {
    if (!personId) return [];
    const raw = cards
      .filter(c => c.owners.includes(personId))
      .map(c => ({ id: c.id, name: stripOwnerPrefix(c.name, PEOPLE[personId]), last4: c.last4 }));
    const nameCounts = {};
    raw.forEach(c => { nameCounts[c.name] = (nameCounts[c.name] || 0) + 1; });
    return raw.map(c => ({
      ...c,
      label: nameCounts[c.name] > 1 && c.last4 ? `${c.name} ···${c.last4}` : c.name,
    }));
  })();
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
                <PillBtn key={c.id} active={cardId === c.id} onClick={() => onSelectCard(c.id)}>{c.label}</PillBtn>
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

function AddSpendBonusForm({ productOptions, form, setForm, onSubmit, onCancel, submitting, error }) {
  function set(field) {
    return e => setForm(prev => ({ ...prev, [field]: e.target.value }));
  }
  return (
    <form onSubmit={onSubmit} style={{ ...cardStyle, display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div style={{ fontWeight: 700, color: '#fff', fontSize: '0.95rem' }}>New Spend Bonus</div>
      <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.45)', marginTop: -8 }}>
        Creates a bonus definition, then a tracked instance for every active card of that product.
      </div>

      <div>
        <label style={lbl}>Card Product <span style={{ color: '#FF4D4D' }}>*</span></label>
        <select style={inp} value={form.productId} onChange={set('productId')}>
          <option value="">— Select card product —</option>
          {productOptions.map(p => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      </div>

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
          <label style={lbl}>Reset Type <span style={{ color: '#FF4D4D' }}>*</span></label>
          <div style={{ display: 'flex', gap: 8 }}>
            {RESET_TYPES.map(t => (
              <PillBtn key={t} active={form.resetType === t} onClick={() => setForm(prev => ({ ...prev, resetType: t }))}>
                {t}
              </PillBtn>
            ))}
          </div>
        </div>
      </div>

      <div>
        <label style={lbl}>Priority Score</label>
        <PriorityDots
          value={form.priorityScore}
          onSet={n => setForm(prev => ({ ...prev, priorityScore: n }))}
          size={20}
        />
      </div>

      <div>
        <label style={lbl}>Notes</label>
        <textarea
          style={{ ...inp, minHeight: 70, resize: 'vertical' }}
          value={form.notes}
          onChange={set('notes')}
          placeholder="Any additional notes…"
        />
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

function nextJan1() {
  return `${new Date().getFullYear() + 1}-01-01`;
}

function nextCardAnniversary(openDateStr) {
  if (!openDateStr) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  let years = 1;
  let candidate = addYears(openDateStr, years);
  while (new Date(candidate + 'T00:00:00') <= today) {
    years += 1;
    candidate = addYears(openDateStr, years);
  }
  return candidate;
}

function calculateSpendBonusResetDate(resetType, openDateStr) {
  return resetType === 'Card Open Date' ? nextCardAnniversary(openDateStr) : nextJan1();
}

function signupMonthLabel(approvalDateStr, n) {
  if (!approvalDateStr) return `Month ${n}`;
  const [, m] = approvalDateStr.split('-').map(Number);
  const idx = (m - 1 + (n - 1)) % 12;
  return MONTH_NAMES[idx];
}

function SignupBonusCard({ row, onOpen, onToggleAchieved }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onClick={() => onOpen(row.id)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        ...cardStyle, cursor: 'pointer',
        background: hovered ? '#1b2740' : '#172033',
        transition: 'background 0.12s',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8 }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: '1rem', color: '#fff' }}>
            {row.cardName}
            {row.last4 && (
              <span style={{ marginLeft: 8, fontSize: '0.78rem', color: 'rgba(255,255,255,0.4)', fontWeight: 400 }}>
                ···{row.last4}
              </span>
            )}
          </div>
          <div style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.5)' }}>{row.personName}</div>
        </div>
        <label
          onClick={e => e.stopPropagation()}
          style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8rem', color: 'rgba(255,255,255,0.6)', cursor: 'pointer' }}
        >
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
    </div>
  );
}

function SignupBonusMonthPanel({ row, monthInputs, setMonthInputs, savingKey, onSaveMonth, onClose }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  function handleClose() {
    setMounted(false);
    setTimeout(onClose, 200);
  }

  const missingMonths = [1, 2, 3, 4, 5, 6].filter(n => row.fields[`Month ${n}`] == null);

  return (
    <>
      <div
        onClick={handleClose}
        style={{
          position: 'fixed', inset: 0, background: '#0B1220',
          opacity: mounted ? 0.6 : 0, transition: 'opacity 0.2s ease', zIndex: 40,
        }}
      />
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0, width: '40%', minWidth: 380, maxWidth: '90vw',
        background: '#172033', borderLeft: '1px solid #1E2D45', zIndex: 41,
        transform: mounted ? 'translateX(0)' : 'translateX(100%)',
        transition: 'transform 0.22s ease', boxShadow: '-12px 0 32px rgba(0,0,0,0.4)',
        display: 'flex', flexDirection: 'column',
      }}>
        <div style={{
          padding: '1.25rem 1.5rem', borderBottom: '1px solid #1E2D45',
          display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem',
        }}>
          <div>
            <div style={{ fontSize: '1.15rem', fontWeight: 700, color: '#fff' }}>{row.cardName}</div>
            <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)', marginTop: 2 }}>{row.personName}</div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            style={{
              background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)',
              fontSize: '1.4rem', cursor: 'pointer', lineHeight: 1, padding: '0 0.25rem', flexShrink: 0,
            }}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {row.description && (
            <div style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.6)' }}>{row.description}</div>
          )}

          <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
            <Stat label="Spend Target" value={$$(row.spendTarget)} />
            <Stat label="Current Spend" value={$$(row.currentSpend)} color="#00D4FF" />
            <Stat label="Remaining Spend" value={$$(row.remainingSpend)} color="#00E676" />
          </div>

          {row.daysRemaining != null && (
            <div style={{
              fontSize: '0.85rem', color: deadlineColor(row.daysRemaining),
              fontWeight: row.daysRemaining < 14 ? 700 : 400,
            }}>
              Deadline {fmtDate(row.effectiveDeadline)} ({row.daysRemaining} days remaining)
            </div>
          )}

          <div style={{ borderTop: '1px solid #1E2D45' }} />

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ fontSize: '0.92rem', fontWeight: 700, color: '#fff' }}>Enter Monthly Spend</div>
            {missingMonths.length === 0 ? (
              <div style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.35)' }}>All months entered.</div>
            ) : (
              missingMonths.map(n => {
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
              })
            )}
          </div>
        </div>
      </div>
    </>
  );
}

const SPEND_ROW_COLUMNS = '1.6fr 65px 1fr 1fr 1fr 1fr 90px 70px';

function SpendBonusRow({ row, onOpen, onToggleEarned, onSetPriority }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onClick={() => onOpen(row.id)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'grid', gridTemplateColumns: SPEND_ROW_COLUMNS, gap: '0.75rem',
        alignItems: 'center', padding: '0.75rem 1rem', borderRadius: 10, cursor: 'pointer',
        background: hovered ? '#1b2740' : '#172033', border: '1px solid rgba(255,255,255,0.06)',
        transition: 'background 0.12s, opacity 0.12s',
        opacity: row.earned ? 0.45 : 1,
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
        <span style={{ fontWeight: 700, color: '#fff', fontSize: '0.88rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {row.cardName}
        </span>
        {row.daysUntilReset != null && (
          <span style={{
            fontSize: '0.72rem', color: deadlineColor(row.daysUntilReset),
            fontWeight: row.daysUntilReset < 14 ? 700 : 400,
          }}>
            Resets {fmtDate(row.resetDate)} ({row.daysUntilReset}d)
          </span>
        )}
      </div>
      <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.82rem' }}>{row.last4 ? `···${row.last4}` : '—'}</span>
      <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.85rem' }}>{row.personName}</span>
      <span style={{ color: '#fff', fontWeight: 600, fontSize: '0.88rem' }}>{$$(row.annualTarget)}</span>
      <span style={{ color: '#00D4FF', fontWeight: 700, fontSize: '0.88rem' }}>{$$(row.currentSpend)}</span>
      <span style={{ color: '#00E676', fontWeight: 700, fontSize: '0.88rem' }}>{$$(row.remainingSpend)}</span>
      <PriorityDots value={row.priorityScore} onSet={n => onSetPriority(row.defId, n)} />
      <div style={{ display: 'flex', justifyContent: 'center' }} onClick={e => e.stopPropagation()}>
        <input
          type="checkbox"
          checked={row.earned}
          onChange={() => onToggleEarned(row)}
          style={{ accentColor: '#00D4FF', width: 17, height: 17, cursor: 'pointer' }}
        />
      </div>
    </div>
  );
}

function SpendBonusMonthPanel({ row, monthInputs, setMonthInputs, savingKey, onSaveMonth, onClose }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  function handleClose() {
    setMounted(false);
    setTimeout(onClose, 200);
  }

  const missingMonths = MONTH_NAMES.filter(m => row.fields[m] == null);

  return (
    <>
      <div
        onClick={handleClose}
        style={{
          position: 'fixed', inset: 0, background: '#0B1220',
          opacity: mounted ? 0.6 : 0, transition: 'opacity 0.2s ease', zIndex: 40,
        }}
      />
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0, width: '40%', minWidth: 380, maxWidth: '90vw',
        background: '#172033', borderLeft: '1px solid #1E2D45', zIndex: 41,
        transform: mounted ? 'translateX(0)' : 'translateX(100%)',
        transition: 'transform 0.22s ease', boxShadow: '-12px 0 32px rgba(0,0,0,0.4)',
        display: 'flex', flexDirection: 'column',
      }}>
        <div style={{
          padding: '1.25rem 1.5rem', borderBottom: '1px solid #1E2D45',
          display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem',
        }}>
          <div>
            <div style={{ fontSize: '1.15rem', fontWeight: 700, color: '#fff' }}>{row.cardName}</div>
            <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)', marginTop: 2 }}>{row.personName}</div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            style={{
              background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)',
              fontSize: '1.4rem', cursor: 'pointer', lineHeight: 1, padding: '0 0.25rem', flexShrink: 0,
            }}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {row.description && (
            <div style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.6)' }}>{row.description}</div>
          )}

          <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
            <Stat label="Annual Spend Target" value={$$(row.annualTarget)} />
            <Stat label="Current Spend" value={$$(row.currentSpend)} color="#00D4FF" />
            <Stat label="Remaining Spend" value={$$(row.remainingSpend)} color="#00E676" />
          </div>

          {row.daysUntilReset != null && (
            <div style={{
              fontSize: '0.85rem', color: deadlineColor(row.daysUntilReset),
              fontWeight: row.daysUntilReset < 14 ? 700 : 400,
            }}>
              Resets {fmtDate(row.resetDate)} ({row.daysUntilReset} days)
            </div>
          )}

          <div style={{ borderTop: '1px solid #1E2D45' }} />

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ fontSize: '0.92rem', fontWeight: 700, color: '#fff' }}>Enter Monthly Spend</div>
            {missingMonths.length === 0 ? (
              <div style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.35)' }}>All months entered.</div>
            ) : (
              missingMonths.map(m => {
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
              })
            )}
          </div>
        </div>
      </div>
    </>
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
  const [cardLast4ById, setCardLast4ById] = useState({});
  const [portfolioCards, setPortfolioCards] = useState([]);
  const [productOptions, setProductOptions] = useState([]);
  const [spendDefsById, setSpendDefsById] = useState({});
  const [monthInputs, setMonthInputs] = useState({});
  const [savingKey, setSavingKey] = useState(null);
  const [openSignupBonusId, setOpenSignupBonusId] = useState(null);
  const [openSpendBonusId, setOpenSpendBonusId] = useState(null);

  const [showAddSignup, setShowAddSignup] = useState(false);
  const [signupForm, setSignupForm] = useState(EMPTY_SIGNUP_FORM);
  const [addSignupSubmitting, setAddSignupSubmitting] = useState(false);
  const [addSignupError, setAddSignupError] = useState(null);

  const [showAddSpend, setShowAddSpend] = useState(false);
  const [spendForm, setSpendForm] = useState(EMPTY_SPEND_FORM);
  const [addSpendSubmitting, setAddSpendSubmitting] = useState(false);
  const [addSpendError, setAddSpendError] = useState(null);
  const [addSpendResult, setAddSpendResult] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setResetStatus('');

    const [signup, spend, cards, products, spendDefs] = await Promise.all([
      fetchTable(SIGNUP_BONUSES_TABLE, SIGNUP_FIELDS),
      fetchTable(SPEND_BONUSES_TABLE, SPEND_FIELDS),
      fetchTable(PORTFOLIO_TABLE, ['Card Name', 'Owner', 'Last 4/Last 5 (AMEX)']),
      fetchTable(CARD_PRODUCTS_TABLE, ['Product Name']),
      fetchTable(SPEND_BONUS_DEFINITIONS_TABLE, ['Priority Score']),
    ]);

    setCardNameById(Object.fromEntries(cards.map(r => {
      const ownerId = (r.fields['Owner'] || [])[0];
      return [r.id, stripOwnerPrefix(r.fields['Card Name'] || r.id, ownerId ? PEOPLE[ownerId] : null)];
    })));
    setCardLast4ById(Object.fromEntries(cards.map(r => [r.id, r.fields['Last 4/Last 5 (AMEX)'] || null])));
    setPortfolioCards(
      cards
        .map(r => ({
          id: r.id,
          name: r.fields['Card Name'] || r.id,
          owners: r.fields['Owner'] || [],
          last4: r.fields['Last 4/Last 5 (AMEX)'] || null,
        }))
        .sort((a, b) => a.name.localeCompare(b.name))
    );
    setProductOptions(
      products
        .map(p => ({ id: p.id, name: p.fields['Product Name'] || p.id }))
        .sort((a, b) => a.name.localeCompare(b.name))
    );
    setSpendDefsById(Object.fromEntries(spendDefs.map(d => [d.id, d.fields])));

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

  async function setSpendPriority(defId, score) {
    if (!defId) return;
    setSpendDefsById(prev => ({ ...prev, [defId]: { ...(prev[defId] || {}), 'Priority Score': score } }));
    try {
      await updateRecord(SPEND_BONUS_DEFINITIONS_TABLE, defId, { 'Priority Score': score });
    } catch (e) {
      console.error('Spend bonus priority update failed', e);
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
    if (!spendForm.resetType) { setAddSpendError('Reset Type is required.'); return; }

    setAddSpendSubmitting(true);
    try {
      const description = spendForm.description.trim();
      const target = parseFloat(spendForm.annualTarget);

      // 1. Create the Spend Bonus Definition
      const defFields = {
        'Bonus Description': description,
        'Card Product': [spendForm.productId],
        'Annual Spend Target': target,
        'Reset Type': spendForm.resetType,
        'Priority Score': spendForm.priorityScore,
      };
      if (spendForm.notes.trim()) defFields['Notes'] = spendForm.notes.trim();
      const definition = await createRecord(SPEND_BONUS_DEFINITIONS_TABLE, defFields);

      // 2. Fetch all active Portfolio cards matching this Card Product
      const filter = `AND(FIND("${spendForm.productId}",ARRAYJOIN({Current Product})),{Status}='Active')`;
      const matchingCards = await fetchTable(PORTFOLIO_TABLE, ['Owner', 'Open Date', 'Status'], { filterByFormula: filter });

      // 3. Existing instances, for the Card + Definition duplicate check
      const existingInstances = await fetchTable(SPEND_BONUSES_TABLE, ['Card', 'Spend Bonus Definition']);
      const existingKeys = new Set(
        existingInstances.map(r => `${(r.fields['Card'] || [])[0]}::${(r.fields['Spend Bonus Definition'] || [])[0]}`)
      );

      // 4. Create an instance per matching card
      let created = 0;
      const cardsSeen = new Set();
      for (const card of matchingCards) {
        const ownerId = (card.fields['Owner'] || [])[0];
        if (!ownerId) continue;
        const key = `${card.id}::${definition.id}`;
        if (existingKeys.has(key)) continue;

        const resetDate = calculateSpendBonusResetDate(spendForm.resetType, card.fields['Open Date']);
        if (!resetDate) continue;

        try {
          await createRecord(SPEND_BONUSES_TABLE, {
            'Card': [card.id],
            'Person': [ownerId],
            'Annual Spend Target': target,
            'Reset Date': resetDate,
            'Bonus Earned': false,
            'Spend Bonus Definition': [definition.id],
            'Bonus Description': description,
          });
          created++;
          cardsSeen.add(card.id);
        } catch (err) {
          console.error('Spend bonus instance create failed', err);
        }
      }

      setAddSpendResult(`Spend bonus added — ${created} instance${created !== 1 ? 's' : ''} created across ${cardsSeen.size} card${cardsSeen.size !== 1 ? 's' : ''}`);
      setTimeout(() => setAddSpendResult(null), 6000);
      setSpendForm(EMPTY_SPEND_FORM);
      setShowAddSpend(false);
      await load();
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
      last4: cardId ? (cardLast4ById[cardId] || null) : null,
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
    const defId = (f['Spend Bonus Definition'] || [])[0] || '';
    return {
      id: r.id,
      cardName: cardId ? (cardNameById[cardId] || '—') : '—',
      last4: cardId ? (cardLast4ById[cardId] || null) : null,
      personName: personId ? (PEOPLE[personId] || '—') : '—',
      description: f['Bonus Description'] || '',
      annualTarget: f['Annual Spend Target'] ?? null,
      currentSpend: f['Current Spend'] ?? 0,
      remainingSpend: f['Remaining Spend'] ?? null,
      resetDate: f['Reset Date'] || '',
      daysUntilReset: f['Days Until Reset'] ?? null,
      earned: !!f['Bonus Earned'],
      defId,
      priorityScore: defId ? (spendDefsById[defId]?.['Priority Score'] ?? 0) : 0,
      fields: f,
    };
  });

  const spendVisible = spendEnriched.filter(row => personFilter === ALL_PEOPLE || row.personName === personFilter);
  const spendActive = spendVisible.filter(row => !row.earned);
  const spendActiveCount = spendActive.length;
  const spendActiveRemaining = spendActive.reduce((s, row) => s + (row.remainingSpend ?? 0), 0);

  // Completed bonuses sink to the bottom (grayed out); active ones sort by
  // priority score (5 → 1), then by least remaining spend first.
  const spendSorted = [...spendVisible].sort((a, b) => {
    if (a.earned !== b.earned) return a.earned ? 1 : -1;
    if (b.priorityScore !== a.priorityScore) return b.priorityScore - a.priorityScore;
    const aRem = a.remainingSpend ?? Infinity;
    const bRem = b.remainingSpend ?? Infinity;
    return aRem - bRem;
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
          {view === 'signup' && (
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8rem', color: 'rgba(255,255,255,0.6)', cursor: 'pointer', width: 'fit-content' }}>
              <input
                type="checkbox"
                checked={showActiveOnly}
                onChange={e => setShowActiveOnly(e.target.checked)}
                style={{ accentColor: '#00D4FF', width: 15, height: 15 }}
              />
              Show Active Only
            </label>
          )}
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
                  onOpen={setOpenSignupBonusId}
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

          {addSpendResult && (
            <div style={{
              background: 'rgba(0,230,118,0.1)', border: '1px solid rgba(0,230,118,0.35)',
              borderRadius: 10, padding: '0.75rem 1rem', color: '#00E676', fontSize: '0.85rem', fontWeight: 600,
            }}>
              {addSpendResult}
            </div>
          )}

          {!showAddSpend && <AddBonusButton onClick={() => setShowAddSpend(true)} />}

          {showAddSpend && (
            <AddSpendBonusForm
              productOptions={productOptions}
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
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <div style={{
                display: 'grid', gridTemplateColumns: SPEND_ROW_COLUMNS, gap: '0.75rem',
                padding: '0.25rem 1rem', fontSize: '0.68rem', color: 'rgba(255,255,255,0.3)',
                textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600,
              }}>
                <span>Card</span>
                <span>Last 4/5</span>
                <span>Person</span>
                <span>Target</span>
                <span>Current</span>
                <span>Remaining</span>
                <span>Priority</span>
                <span style={{ textAlign: 'center' }}>Earned</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {spendSorted.map(row => (
                  <SpendBonusRow
                    key={row.id}
                    row={row}
                    onOpen={setOpenSpendBonusId}
                    onToggleEarned={r => toggleFlag(SPEND_BONUSES_TABLE, r.id, 'Bonus Earned', r.earned, false)}
                    onSetPriority={setSpendPriority}
                  />
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {openSignupBonusId && (() => {
        const activeRow = signupEnriched.find(r => r.id === openSignupBonusId);
        if (!activeRow) return null;
        return (
          <SignupBonusMonthPanel
            row={activeRow}
            monthInputs={monthInputs}
            setMonthInputs={setMonthInputs}
            savingKey={savingKey}
            onSaveMonth={saveMonth}
            onClose={() => setOpenSignupBonusId(null)}
          />
        );
      })()}

      {openSpendBonusId && (() => {
        const activeRow = spendEnriched.find(r => r.id === openSpendBonusId);
        if (!activeRow) return null;
        return (
          <SpendBonusMonthPanel
            row={activeRow}
            monthInputs={monthInputs}
            setMonthInputs={setMonthInputs}
            savingKey={savingKey}
            onSaveMonth={saveMonth}
            onClose={() => setOpenSpendBonusId(null)}
          />
        );
      })()}
    </div>
  );
}
