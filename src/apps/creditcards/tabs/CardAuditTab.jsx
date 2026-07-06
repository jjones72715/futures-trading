import { useState, useEffect, useCallback } from 'react';
import { fetchTable, createRecord, updateRecord } from '../services/airtable.js';
import { PORTFOLIO_TABLE, CARD_PRODUCTS_TABLE, PRODUCT_CHANGES_TABLE, PERK_INSTANCES_TABLE, SPEND_BONUSES_TABLE } from '../config/tables.js';
import { PEOPLE, ALL_PEOPLE } from '../config/constants.js';
import { PersonFilter } from '../components/PersonFilter.jsx';
import { StatCard } from '../components/StatCard.jsx';
import { AnnualFeeBadge } from '../components/AnnualFeeBadge.jsx';
import { TotalPerkValueCell, DifferenceCell } from '../components/NetValueGroup.jsx';
import { annualizedCreditAmount, sumPerkValue } from '../utils/perks.js';
import { $$ } from '../utils/format.js';

const PORTFOLIO_FIELDS = [
  'Card Name', 'Owner', 'Authorized Users', 'Current Product',
  'Annual Fee Amount', 'Annual Fee Post Month', 'Days Until Annual Fee',
  'Status', 'Open Date', 'Decision', 'Willing to Upgrade', 'Decision Notes', 'Last Reviewed',
];

const PRODUCT_FIELDS = ['Product Name', 'Annual Fee', 'Can Upgrade To', 'Can Downgrade To', 'Signup Bonus Eligible After (Months)'];

const PERK_INSTANCE_FIELDS = [
  'Label', 'Card', 'Person', 'Perk Definition', 'Credit Amount', 'Reset Cycle',
  'Perk Type', 'Value', 'Previous Value', 'Used',
];

const SPEND_BONUS_FIELDS = ['Bonus Description', 'Card', 'Person', 'Value', 'Previous Value'];

const DECISION_OPTIONS = ['Keep', 'Cancel', 'Product Change', 'Downgrade', 'Upgrade'];

const DECISION_COLORS = {
  Keep: '#00C853',
  Cancel: '#FF3D00',
  'Product Change': '#2979FF',
  Downgrade: '#FF6D00',
  Upgrade: '#00D4FF',
};

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const ROW_COLUMNS = '1.6fr 0.7fr 80px 100px 90px 65px 95px 120px 90px 95px 110px';

const cardStyle = {
  background: '#172033', borderRadius: 12, border: '1px solid rgba(255,255,255,0.08)',
  padding: '1.25rem 1.5rem',
};

const inp = {
  width: '100%', background: '#0B1220', border: '1px solid rgba(255,255,255,0.12)',
  borderRadius: 8, padding: '0.6rem 0.75rem', color: '#fff', fontSize: '0.88rem',
  outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit',
};

const lbl = {
  display: 'block', fontSize: '0.7rem', fontWeight: 600,
  color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase',
  letterSpacing: '0.05em', marginBottom: 5,
};

function todayDate() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

function addMonths(date, n) {
  const d = new Date(date);
  d.setMonth(d.getMonth() + n);
  return d;
}

function addYears(date, n) {
  const d = new Date(date);
  d.setFullYear(d.getFullYear() + n);
  return d;
}

function toAirtableDateStr(d) {
  return d.toISOString().split('T')[0];
}

function fmtDate(d) {
  if (!d) return '—';
  return `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`;
}

function fmtDateStr(s) {
  if (!s) return '—';
  const [y, m, d] = s.split('-');
  return `${parseInt(m)}/${parseInt(d)}/${y}`;
}

function monthYearLabel(d) {
  return `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;
}

function urgencyTint(days) {
  if (days == null) return 'transparent';
  if (days <= 30) return 'rgba(255,61,0,0.16)';
  if (days <= 60) return 'rgba(255,214,10,0.14)';
  if (days <= 90) return 'rgba(255,255,255,0.05)';
  return 'transparent';
}

function byDaysAsc(a, b) {
  const da = a.daysUntilFee ?? Infinity;
  const db = b.daysUntilFee ?? Infinity;
  return da - db;
}

function optionsForDecision(decision, product) {
  if (!product) return [];
  if (decision === 'Downgrade') return product.canDowngradeTo;
  if (decision === 'Upgrade' || decision === 'Product Change') return product.canUpgradeTo;
  return [];
}

function SlideOver({ onClose, width = 520, children }) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000 }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)' }} />
      <div style={{
        position: 'absolute', top: 0, right: 0, height: '100%', width, maxWidth: '92vw',
        background: '#0B1220', borderLeft: '1px solid rgba(255,255,255,0.1)',
        boxShadow: '-8px 0 24px rgba(0,0,0,0.4)', overflowY: 'auto', padding: '1.5rem',
        animation: 'ccPanelSlideIn 0.2s ease-out',
      }}>
        <style>{'@keyframes ccPanelSlideIn { from { transform: translateX(100%); } to { transform: translateX(0); } }'}</style>
        {children}
      </div>
    </div>
  );
}

function SlideOverHeader({ title, onClose }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem' }}>
      <div style={{ fontWeight: 700, fontSize: '1.05rem', color: '#fff', paddingRight: '1rem' }}>{title}</div>
      <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', fontSize: '1.4rem', cursor: 'pointer', lineHeight: 1, flexShrink: 0 }}>
        ×
      </button>
    </div>
  );
}

function PillBtn({ active, onClick, children }) {
  return (
    <button type="button" onClick={onClick} style={{
      padding: '6px 16px', borderRadius: 20, border: '1px solid rgba(255,255,255,0.12)',
      background: active ? '#00D4FF' : 'rgba(255,255,255,0.06)',
      color: active ? '#0B1220' : 'rgba(255,255,255,0.6)',
      fontWeight: active ? 700 : 400, cursor: 'pointer', fontSize: '0.85rem',
      transition: 'all 0.15s', whiteSpace: 'nowrap',
    }}>
      {children}
    </button>
  );
}

function DecisionBadge({ decision }) {
  if (!decision) return <span style={{ color: 'rgba(255,255,255,0.3)' }}>—</span>;
  const color = DECISION_COLORS[decision] || 'rgba(255,255,255,0.4)';
  return (
    <span style={{
      display: 'inline-block', padding: '2px 10px', borderRadius: 20,
      fontSize: '0.72rem', fontWeight: 700, background: color + '22', color,
      border: `1px solid ${color}55`, whiteSpace: 'nowrap',
    }}>
      {decision}
    </span>
  );
}

function ProductChips({ productIds, productsById }) {
  if (!productIds || productIds.length === 0) {
    return <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: '0.8rem' }}>No options available</span>;
  }
  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
      {productIds.map(id => (
        <span key={id} style={{
          padding: '3px 10px', borderRadius: 20, fontSize: '0.78rem',
          background: 'rgba(0,212,255,0.1)', color: '#00D4FF', border: '1px solid rgba(0,212,255,0.25)',
        }}>
          {productsById[id]?.name || id}
        </span>
      ))}
    </div>
  );
}

function RowActionBtn({ onClick, disabled, title, active, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      style={{
        padding: '4px 10px', borderRadius: 7, border: '1px solid rgba(0,212,255,0.3)',
        background: disabled ? 'rgba(255,255,255,0.04)' : active ? '#00D4FF' : 'rgba(0,212,255,0.12)',
        color: disabled ? 'rgba(255,255,255,0.25)' : active ? '#0B1220' : '#00D4FF',
        fontWeight: 700, fontSize: '0.68rem', cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.6 : 1, width: '100%',
      }}
    >
      {children}
    </button>
  );
}

function CardAuditRow({ card, onToggleWTU, savingWTU, tinted, onOpenAnnualReview, onOpenAnnualDecision }) {
  const bg = tinted ? urgencyTint(card.daysUntilFee) : 'transparent';
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: ROW_COLUMNS, gap: '0.75rem',
      alignItems: 'center', padding: '0.75rem 1rem', borderRadius: 10,
      background: bg === 'transparent' ? '#172033' : bg,
      border: '1px solid rgba(255,255,255,0.06)',
    }}>
      <div>
        <div style={{ fontWeight: 600, color: '#fff', fontSize: '0.9rem' }}>{card.cardName}</div>
        <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.45)', marginTop: 2 }}>{card.productName}</div>
      </div>
      <div style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.6)' }}>{card.ownerName}</div>
      <div style={{ fontSize: '0.85rem', color: '#fff' }}>{$$(card.annualFee)}</div>
      <div><TotalPerkValueCell netValue={card.netValue} hasAnyValue={card.hasAnyValue} mode="audit" /></div>
      <div><DifferenceCell netValue={card.netValue} annualFee={card.annualFee} hasAnyValue={card.hasAnyValue} mode="audit" /></div>
      <div><AnnualFeeBadge days={card.daysUntilFee} /></div>
      <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.6)' }}>{fmtDate(card.feeDate)}</div>
      <div><DecisionBadge decision={card.decision} /></div>
      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <input
          type="checkbox"
          checked={card.willingToUpgrade}
          disabled={savingWTU}
          onChange={() => onToggleWTU(card)}
          style={{ accentColor: '#00D4FF', width: 17, height: 17, cursor: 'pointer' }}
        />
      </div>
      <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)' }}>{fmtDateStr(card.lastReviewed)}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <RowActionBtn onClick={() => onOpenAnnualReview(card)}>Annual Review</RowActionBtn>
        <RowActionBtn onClick={() => onOpenAnnualDecision(card)}>Annual Decision</RowActionBtn>
      </div>
    </div>
  );
}

function Section({ title, cards, tinted, onToggleWTU, savingWTU, onOpenAnnualReview, onOpenAnnualDecision }) {
  if (cards.length === 0) return null;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      <div style={{ fontWeight: 700, color: '#00D4FF', fontSize: '0.95rem' }}>
        {title} <span style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.4)', fontWeight: 400 }}>({cards.length})</span>
      </div>
      <div style={{
        display: 'grid', gridTemplateColumns: ROW_COLUMNS, gap: '0.75rem',
        padding: '0.25rem 1rem', fontSize: '0.68rem', color: 'rgba(255,255,255,0.3)',
        textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600,
      }}>
        <span>Card</span>
        <span>Person</span>
        <span>Annual Fee</span>
        <span>Total Perk Value</span>
        <span>Difference</span>
        <span>Days</span>
        <span>Fee Date</span>
        <span>Decision</span>
        <span style={{ textAlign: 'center' }}>Willing Upgrade</span>
        <span>Last Reviewed</span>
        <span />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {cards.map(card => (
          <CardAuditRow
            key={card.id}
            card={card}
            tinted={tinted}
            onToggleWTU={onToggleWTU}
            savingWTU={savingWTU === card.id}
            onOpenAnnualReview={onOpenAnnualReview}
            onOpenAnnualDecision={onOpenAnnualDecision}
          />
        ))}
      </div>
    </div>
  );
}

function PastDueCard({ card, product, productsById, form, onFormChange, onConfirmCancel, onConfirmChange, onRetryKeep }) {
  const decision = card.decision;
  return (
    <div style={{
      ...cardStyle, border: '1px solid rgba(255,61,0,0.35)', background: 'rgba(255,61,0,0.06)',
      display: 'flex', flexDirection: 'column', gap: '0.85rem',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        <div>
          <div style={{ fontWeight: 700, color: '#fff', fontSize: '0.95rem' }}>{card.cardName}</div>
          <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)' }}>{card.ownerName} · Fee was due {fmtDate(card.feeDate)}</div>
        </div>
        <DecisionBadge decision={decision} />
      </div>

      {decision === 'Keep' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.85rem' }}>Auto-reset failed — please retry.</span>
          <button type="button" onClick={() => onRetryKeep(card)} style={{
            padding: '0.4rem 1rem', borderRadius: 8, border: '1px solid rgba(0,212,255,0.3)',
            background: 'rgba(0,212,255,0.12)', color: '#00D4FF', fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer',
          }}>
            Retry
          </button>
        </div>
      )}

      {decision === 'Cancel' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.7)' }}>Confirm cancellation — enter cancel date</span>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <input
              type="date"
              style={{ ...inp, width: 'auto' }}
              value={form.cancelDate}
              onChange={e => onFormChange(card.id, { cancelDate: e.target.value })}
            />
            <button type="button" disabled={form.submitting} onClick={() => onConfirmCancel(card)} style={{
              padding: '0.5rem 1.2rem', borderRadius: 8, border: 'none',
              background: form.submitting ? 'rgba(255,61,0,0.4)' : '#FF3D00',
              color: '#fff', fontWeight: 700, fontSize: '0.82rem', cursor: form.submitting ? 'not-allowed' : 'pointer',
            }}>
              {form.submitting ? 'Confirming…' : 'Confirm Cancellation'}
            </button>
          </div>
        </div>
      )}

      {(decision === 'Product Change' || decision === 'Downgrade' || decision === 'Upgrade') && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.7)' }}>Confirm change — select new card product</span>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <select
              style={{ ...inp, width: 'auto', minWidth: 220 }}
              value={form.newProductId}
              onChange={e => onFormChange(card.id, { newProductId: e.target.value })}
            >
              <option value="">— Select new product —</option>
              {optionsForDecision(decision, product).map(id => (
                <option key={id} value={id}>{productsById[id]?.name || id}</option>
              ))}
            </select>
            <button type="button" disabled={form.submitting} onClick={() => onConfirmChange(card)} style={{
              padding: '0.5rem 1.2rem', borderRadius: 8, border: 'none',
              background: form.submitting ? 'rgba(0,212,255,0.4)' : '#00D4FF',
              color: '#0B1220', fontWeight: 700, fontSize: '0.82rem', cursor: form.submitting ? 'not-allowed' : 'pointer',
            }}>
              {form.submitting ? 'Confirming…' : `Confirm ${decision}`}
            </button>
          </div>
        </div>
      )}

      {form?.error && (
        <div style={{ background: '#FF4D4D22', border: '1px solid #FF4D4D', borderRadius: 8, padding: '0.5rem 0.75rem', color: '#FF4D4D', fontSize: '0.8rem' }}>
          {form.error}
        </div>
      )}
    </div>
  );
}

function PerkReviewRow({ inst, draftValue, onDraftChange }) {
  const rawCycle = inst.fields['Reset Cycle'];
  const resetCycle = Array.isArray(rawCycle) ? rawCycle[0] : rawCycle;
  const annualized = annualizedCreditAmount(inst.fields['Credit Amount'], resetCycle);
  const previousValue = inst.fields['Previous Value'];
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '1.6fr 1fr 1fr 110px', gap: 8, alignItems: 'center',
      padding: '0.6rem 0.75rem', borderRadius: 8, background: '#172033', border: '1px solid rgba(255,255,255,0.06)',
    }}>
      <span style={{ color: '#fff', fontSize: '0.85rem', fontWeight: 600 }}>{inst.fields['Label'] || '—'}</span>
      <div>
        <div style={{ fontSize: '0.62rem', color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', fontWeight: 600 }}>Annualized</div>
        <div style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.7)' }}>{annualized != null ? $$(annualized) : '—'}</div>
      </div>
      <div style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.4)' }}>
        {previousValue != null ? `Last year: ${$$(previousValue)}` : '—'}
      </div>
      <input
        type="number"
        value={draftValue}
        onChange={e => onDraftChange(e.target.value)}
        placeholder="$0"
        style={{ ...inp, padding: '5px 8px', fontSize: '0.82rem' }}
      />
    </div>
  );
}

function SpendBonusReviewRow({ sb, draftValue, onDraftChange }) {
  const previousValue = sb.fields['Previous Value'];
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '1.6fr 1fr 1fr 110px', gap: 8, alignItems: 'center',
      padding: '0.6rem 0.75rem', borderRadius: 8, background: '#172033', border: '1px solid rgba(255,255,255,0.06)',
    }}>
      <span style={{ color: '#fff', fontSize: '0.85rem', fontWeight: 600 }}>{sb.fields['Bonus Description'] || 'Spend Bonus'}</span>
      <div style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.3)' }}>—</div>
      <div style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.4)' }}>
        {previousValue != null ? `Last year: ${$$(previousValue)}` : '—'}
      </div>
      <input
        type="number"
        value={draftValue}
        onChange={e => onDraftChange(e.target.value)}
        placeholder="$0"
        style={{ ...inp, padding: '5px 8px', fontSize: '0.82rem' }}
      />
    </div>
  );
}

function AnnualReviewPanel({ card, instances, spendBonuses, onClose, onInstancesChange, onSpendBonusesChange }) {
  const [localInstances, setLocalInstances] = useState(instances);
  const [localSpendBonuses, setLocalSpendBonuses] = useState(spendBonuses);
  const [drafts, setDrafts] = useState(() => Object.fromEntries(
    [...instances, ...spendBonuses].map(i => [i.id, i.fields['Value'] != null ? String(i.fields['Value']) : ''])
  ));
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [saveMsg, setSaveMsg] = useState('');
  const [showAddPerk, setShowAddPerk] = useState(false);
  const [newPerkName, setNewPerkName] = useState('');
  const [newPerkValue, setNewPerkValue] = useState('');
  const [addingPerk, setAddingPerk] = useState(false);
  const [addPerkError, setAddPerkError] = useState(null);
  const [cycling, setCycling] = useState(false);
  const [cycleMessage, setCycleMessage] = useState('');

  const year = todayDate().getFullYear();
  const trackable = localInstances.filter(i => i.fields['Perk Type'] !== 'Value Only');
  const valueOnly = localInstances.filter(i => i.fields['Perk Type'] === 'Value Only');

  const totalPerkValue = [...localInstances, ...localSpendBonuses].reduce((sum, i) => {
    const raw = drafts[i.id];
    const v = raw === '' || raw == null ? NaN : parseFloat(raw);
    return sum + (Number.isFinite(v) ? v : 0);
  }, 0);
  const difference = totalPerkValue - (card.annualFee || 0);
  const diffColor = difference > 0 ? '#00E676' : difference < 0 ? '#FF4D4D' : 'rgba(255,255,255,0.5)';

  function setDraft(id, value) {
    setDrafts(prev => ({ ...prev, [id]: value }));
  }

  async function handleSaveAll() {
    setSaving(true); setSaveError(null); setSaveMsg('');
    try {
      await Promise.all([
        ...localInstances.map(i => {
          const raw = drafts[i.id];
          const value = raw === '' || raw == null ? null : parseFloat(raw);
          return updateRecord(PERK_INSTANCES_TABLE, i.id, { 'Value': value });
        }),
        ...localSpendBonuses.map(sb => {
          const raw = drafts[sb.id];
          const value = raw === '' || raw == null ? null : parseFloat(raw);
          return updateRecord(SPEND_BONUSES_TABLE, sb.id, { 'Value': value });
        }),
      ]);
      const updatedInstances = localInstances.map(i => {
        const raw = drafts[i.id];
        const value = raw === '' || raw == null ? null : parseFloat(raw);
        return { ...i, fields: { ...i.fields, Value: value } };
      });
      const updatedSpendBonuses = localSpendBonuses.map(sb => {
        const raw = drafts[sb.id];
        const value = raw === '' || raw == null ? null : parseFloat(raw);
        return { ...sb, fields: { ...sb.fields, Value: value } };
      });
      setLocalInstances(updatedInstances);
      setLocalSpendBonuses(updatedSpendBonuses);
      setSaveMsg('Saved.');
      onInstancesChange(card.id, updatedInstances);
      onSpendBonusesChange(card.id, updatedSpendBonuses);
    } catch (e) {
      setSaveError(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleAddPerk() {
    setAddPerkError(null);
    if (!newPerkName.trim()) { setAddPerkError('Perk name is required.'); return; }
    setAddingPerk(true);
    try {
      const fields = {
        'Label': newPerkName.trim(),
        'Perk Type': 'Value Only',
        'Card': [card.id],
      };
      if (card.ownerId) fields['Person'] = [card.ownerId];
      if (newPerkValue !== '') fields['Credit Amount'] = parseFloat(newPerkValue);
      const created = await createRecord(PERK_INSTANCES_TABLE, fields);
      const nextInstances = [...localInstances, created];
      setLocalInstances(nextInstances);
      setDrafts(prev => ({ ...prev, [created.id]: '' }));
      setNewPerkName('');
      setNewPerkValue('');
      setShowAddPerk(false);
      onInstancesChange(card.id, nextInstances);
    } catch (e) {
      setAddPerkError(e.message);
    } finally {
      setAddingPerk(false);
    }
  }

  async function handleCycleThisCard() {
    const allRecords = [...localInstances, ...localSpendBonuses];
    const confirmed = window.confirm(
      `This will clear ${card.cardName}'s current year values and move them to Previous Value. This cannot be undone. Continue?`
    );
    if (!confirmed || allRecords.length === 0) return;

    setCycling(true);
    setCycleMessage(`Cycling ${allRecords.length} instance${allRecords.length !== 1 ? 's' : ''}...`);
    try {
      await Promise.all([
        ...localInstances.map(i =>
          updateRecord(PERK_INSTANCES_TABLE, i.id, {
            'Previous Value': i.fields['Value'] ?? null,
            'Value': null,
          })
        ),
        ...localSpendBonuses.map(sb =>
          updateRecord(SPEND_BONUSES_TABLE, sb.id, {
            'Previous Value': sb.fields['Value'] ?? null,
            'Value': null,
          })
        ),
      ]);
      const updatedInstances = localInstances.map(i => ({
        ...i,
        fields: { ...i.fields, 'Previous Value': i.fields['Value'] ?? null, Value: null },
      }));
      const updatedSpendBonuses = localSpendBonuses.map(sb => ({
        ...sb,
        fields: { ...sb.fields, 'Previous Value': sb.fields['Value'] ?? null, Value: null },
      }));
      setLocalInstances(updatedInstances);
      setLocalSpendBonuses(updatedSpendBonuses);
      setDrafts(Object.fromEntries([...updatedInstances, ...updatedSpendBonuses].map(i => [i.id, ''])));
      onInstancesChange(card.id, updatedInstances);
      onSpendBonusesChange(card.id, updatedSpendBonuses);
      setCycleMessage(`Done — ${card.cardName} ready for ${year + 1} review`);
    } catch (e) {
      setCycleMessage(`Cycle failed: ${e.message}`);
    } finally {
      setCycling(false);
    }
  }

  return (
    <SlideOver onClose={onClose} width={600}>
      <SlideOverHeader title={`${card.cardName} — Annual Review ${year}`} onClose={onClose} />

      {trackable.length > 0 && (
        <>
          <div style={{ fontWeight: 700, color: '#00D4FF', fontSize: '0.85rem', marginBottom: 8 }}>Trackable Perks</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: '1.25rem' }}>
            {trackable.map(inst => (
              <PerkReviewRow key={inst.id} inst={inst} draftValue={drafts[inst.id] ?? ''} onDraftChange={v => setDraft(inst.id, v)} />
            ))}
          </div>
        </>
      )}

      <div style={{ fontWeight: 700, color: '#B388FF', fontSize: '0.85rem', marginBottom: 8 }}>Value Only Perks</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: '0.75rem' }}>
        {valueOnly.length === 0 && (
          <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: '0.82rem' }}>No value-only perks yet.</div>
        )}
        {valueOnly.map(inst => (
          <PerkReviewRow key={inst.id} inst={inst} draftValue={drafts[inst.id] ?? ''} onDraftChange={v => setDraft(inst.id, v)} />
        ))}
      </div>

      {localSpendBonuses.length > 0 && (
        <>
          <div style={{ fontWeight: 700, color: '#FFD60A', fontSize: '0.85rem', marginBottom: 8 }}>Spend Bonuses</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: '1.25rem' }}>
            {localSpendBonuses.map(sb => (
              <SpendBonusReviewRow key={sb.id} sb={sb} draftValue={drafts[sb.id] ?? ''} onDraftChange={v => setDraft(sb.id, v)} />
            ))}
          </div>
        </>
      )}

      {!showAddPerk ? (
        <button type="button" onClick={() => setShowAddPerk(true)} style={{
          padding: '0.45rem 1rem', borderRadius: 8, border: '1px solid rgba(179,136,255,0.35)',
          background: 'rgba(179,136,255,0.1)', color: '#B388FF', fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer', marginBottom: '1.25rem',
        }}>
          + Add Value Perk
        </button>
      ) : (
        <div style={{ ...cardStyle, display: 'flex', flexDirection: 'column', gap: 10, marginBottom: '1.25rem' }}>
          <div style={{ fontWeight: 700, color: '#fff', fontSize: '0.85rem' }}>New Value-Only Perk</div>
          <div>
            <label style={lbl}>Perk Name</label>
            <input style={inp} value={newPerkName} onChange={e => setNewPerkName(e.target.value)} placeholder="e.g. Lounge Access" />
          </div>
          <div>
            <label style={lbl}>Annualized Value</label>
            <input style={inp} type="number" value={newPerkValue} onChange={e => setNewPerkValue(e.target.value)} placeholder="0" />
          </div>
          {addPerkError && (
            <div style={{ background: '#FF4D4D22', border: '1px solid #FF4D4D', borderRadius: 8, padding: '0.5rem 0.75rem', color: '#FF4D4D', fontSize: '0.8rem' }}>
              {addPerkError}
            </div>
          )}
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" disabled={addingPerk} onClick={handleAddPerk} style={{
              padding: '0.5rem 1.1rem', borderRadius: 8, border: 'none',
              background: addingPerk ? 'rgba(179,136,255,0.4)' : '#B388FF',
              color: '#0B1220', fontWeight: 700, fontSize: '0.8rem', cursor: addingPerk ? 'not-allowed' : 'pointer',
            }}>
              {addingPerk ? 'Adding…' : 'Add Perk'}
            </button>
            <button type="button" onClick={() => { setShowAddPerk(false); setAddPerkError(null); }} style={{
              padding: '0.5rem 1.1rem', borderRadius: 8, border: '1px solid rgba(255,255,255,0.15)',
              background: 'none', color: 'rgba(255,255,255,0.6)', fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer',
            }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      <div style={{ ...cardStyle, display: 'flex', flexDirection: 'column', gap: 8, marginBottom: '1.25rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
          <span style={{ color: 'rgba(255,255,255,0.6)' }}>Total Perk Value</span>
          <span style={{ color: '#fff', fontWeight: 700 }}>{$$(totalPerkValue)}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
          <span style={{ color: 'rgba(255,255,255,0.6)' }}>Annual Fee</span>
          <span style={{ color: '#fff', fontWeight: 700 }}>{$$(card.annualFee)}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 8 }}>
          <span style={{ color: 'rgba(255,255,255,0.7)', fontWeight: 600 }}>Difference</span>
          <span style={{ color: diffColor, fontWeight: 800 }}>{difference > 0 ? '+' : ''}{$$(difference)}</span>
        </div>
      </div>

      {saveError && (
        <div style={{ background: '#FF4D4D22', border: '1px solid #FF4D4D', borderRadius: 8, padding: '0.6rem 0.85rem', color: '#FF4D4D', fontSize: '0.82rem', marginBottom: '1rem' }}>
          {saveError}
        </div>
      )}
      {saveMsg && (
        <div style={{ background: '#00E67622', border: '1px solid #00E676', borderRadius: 8, padding: '0.6rem 0.85rem', color: '#00E676', fontSize: '0.82rem', marginBottom: '1rem' }}>
          {saveMsg}
        </div>
      )}

      <div style={{ display: 'flex', gap: 10, marginBottom: '1.25rem' }}>
        <button type="button" disabled={saving} onClick={handleSaveAll} style={{
          padding: '0.6rem 1.5rem', borderRadius: 8, border: 'none',
          background: saving ? 'rgba(0,212,255,0.4)' : '#00D4FF',
          color: '#0B1220', fontWeight: 700, fontSize: '0.85rem', cursor: saving ? 'not-allowed' : 'pointer',
        }}>
          {saving ? 'Saving…' : 'Save All'}
        </button>
      </div>

      <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '1rem' }}>
        <button type="button" disabled={cycling || (localInstances.length === 0 && localSpendBonuses.length === 0)} onClick={handleCycleThisCard} style={{
          width: '100%', padding: '0.7rem 1rem', borderRadius: 8, border: '1px solid rgba(255,109,0,0.4)',
          background: 'rgba(255,109,0,0.15)', color: '#FF6D00', fontWeight: 700, fontSize: '0.85rem',
          cursor: cycling || (localInstances.length === 0 && localSpendBonuses.length === 0) ? 'not-allowed' : 'pointer',
        }}>
          {cycling ? (cycleMessage || 'Cycling…') : 'Cycle This Card to New Year'}
        </button>
        {!cycling && cycleMessage && (
          <div style={{ fontSize: '0.78rem', color: '#00E676', marginTop: 6, fontWeight: 600 }}>
            {cycleMessage}
          </div>
        )}
        <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.35)', marginTop: 6 }}>
          Only affects this card's perk instances and spend bonuses.
        </div>
      </div>
    </SlideOver>
  );
}

function AnnualDecisionPanel({ card, productsById, netValue, onClose, onSave, saving, error }) {
  const [draft, setDraft] = useState({
    decision: card.decision,
    willingToUpgrade: card.willingToUpgrade,
    notes: card.decisionNotes,
  });
  const difference = netValue - (card.annualFee || 0);
  const diffColor = difference > 0 ? '#00E676' : difference < 0 ? '#FF4D4D' : 'rgba(255,255,255,0.5)';
  const product = productsById[card.productId];

  return (
    <SlideOver onClose={onClose} width={480}>
      <SlideOverHeader title={`${card.cardName} — Annual Decision`} onClose={onClose} />

      <div style={{ ...cardStyle, display: 'flex', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
        <div>
          <div style={lbl}>Net Value</div>
          <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#fff' }}>{$$(netValue)}</div>
        </div>
        <div>
          <div style={lbl}>Annual Fee</div>
          <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#fff' }}>{$$(card.annualFee)}</div>
        </div>
        <div>
          <div style={lbl}>Difference</div>
          <div style={{ fontSize: '1.3rem', fontWeight: 800, color: diffColor }}>
            {difference > 0 ? '+' : ''}{$$(difference)}
          </div>
        </div>
      </div>

      <div style={{ marginBottom: '1rem' }}>
        <label style={lbl}>Decision</label>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {DECISION_OPTIONS.map(opt => (
            <PillBtn key={opt} active={draft.decision === opt} onClick={() => setDraft(d => ({ ...d, decision: d.decision === opt ? '' : opt }))}>
              {opt}
            </PillBtn>
          ))}
        </div>
      </div>

      {(draft.decision === 'Upgrade' || draft.decision === 'Product Change') && (
        <div style={{ marginBottom: '1rem' }}>
          <label style={lbl}>Can Upgrade To</label>
          <ProductChips productIds={product?.canUpgradeTo} productsById={productsById} />
        </div>
      )}

      {draft.decision === 'Downgrade' && (
        <div style={{ marginBottom: '1rem' }}>
          <label style={lbl}>Can Downgrade To</label>
          <ProductChips productIds={product?.canDowngradeTo} productsById={productsById} />
        </div>
      )}

      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.85rem', color: 'rgba(255,255,255,0.7)', cursor: 'pointer', width: 'fit-content', marginBottom: '1rem' }}>
        <input
          type="checkbox"
          checked={draft.willingToUpgrade}
          onChange={e => setDraft(d => ({ ...d, willingToUpgrade: e.target.checked }))}
          style={{ accentColor: '#00D4FF', width: 16, height: 16 }}
        />
        Willing to Upgrade
      </label>

      <div style={{ marginBottom: '1rem' }}>
        <label style={lbl}>Decision Notes</label>
        <textarea
          style={{ ...inp, minHeight: 80, resize: 'vertical' }}
          value={draft.notes}
          onChange={e => setDraft(d => ({ ...d, notes: e.target.value }))}
          placeholder="Any context for this decision…"
        />
      </div>

      <div style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.4)', marginBottom: '1rem' }}>
        Last Reviewed: {fmtDateStr(card.lastReviewed)} — will update to today on save.
      </div>

      {error && (
        <div style={{ background: '#FF4D4D22', border: '1px solid #FF4D4D', borderRadius: 8, padding: '0.6rem 0.85rem', color: '#FF4D4D', fontSize: '0.82rem', marginBottom: '1rem' }}>
          {error}
        </div>
      )}

      <button type="button" disabled={saving} onClick={() => onSave(draft)} style={{
        padding: '0.6rem 1.5rem', borderRadius: 8, border: 'none',
        background: saving ? 'rgba(0,212,255,0.4)' : '#00D4FF',
        color: '#0B1220', fontWeight: 700, fontSize: '0.85rem', cursor: saving ? 'not-allowed' : 'pointer',
      }}>
        {saving ? 'Saving…' : 'Save Decision'}
      </button>
    </SlideOver>
  );
}

export function CardAuditTab() {
  const [cards, setCards] = useState([]);
  const [productsById, setProductsById] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [personFilter, setPersonFilter] = useState(ALL_PEOPLE);
  const [viewFilter, setViewFilter] = useState('all');
  const [savingWTU, setSavingWTU] = useState(null);
  const [pastDueForms, setPastDueForms] = useState({});
  const [justResolved, setJustResolved] = useState([]);
  const [instancesByCard, setInstancesByCard] = useState({});
  const [spendBonusesByCard, setSpendBonusesByCard] = useState({});
  const [annualReviewCard, setAnnualReviewCard] = useState(null);
  const [annualDecisionCard, setAnnualDecisionCard] = useState(null);
  const [annualDecisionSaving, setAnnualDecisionSaving] = useState(null);
  const [annualDecisionError, setAnnualDecisionError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [portfolioRows, productRows, perkInstances, spendBonuses] = await Promise.all([
        fetchTable(PORTFOLIO_TABLE, PORTFOLIO_FIELDS, { filterByFormula: "{Status}='Active'" }),
        fetchTable(CARD_PRODUCTS_TABLE, PRODUCT_FIELDS),
        fetchTable(PERK_INSTANCES_TABLE, PERK_INSTANCE_FIELDS),
        fetchTable(SPEND_BONUSES_TABLE, SPEND_BONUS_FIELDS),
      ]);

      const byCard = {};
      perkInstances.forEach(inst => {
        const cardId = (inst.fields['Card'] || [])[0];
        if (!cardId) return;
        if (!byCard[cardId]) byCard[cardId] = [];
        byCard[cardId].push(inst);
      });
      setInstancesByCard(byCard);

      const spendByCard = {};
      spendBonuses.forEach(sb => {
        const cardId = (sb.fields['Card'] || [])[0];
        if (!cardId) return;
        if (!spendByCard[cardId]) spendByCard[cardId] = [];
        spendByCard[cardId].push(sb);
      });
      setSpendBonusesByCard(spendByCard);

      const productsMap = Object.fromEntries(productRows.map(p => [p.id, {
        id: p.id,
        name: p.fields['Product Name'] || p.id,
        annualFee: p.fields['Annual Fee'] ?? null,
        canUpgradeTo: p.fields['Can Upgrade To'] || [],
        canDowngradeTo: p.fields['Can Downgrade To'] || [],
        signupEligibleMonths: p.fields['Signup Bonus Eligible After (Months)'] ?? null,
      }]));
      setProductsById(productsMap);

      const autoKeep = portfolioRows.filter(r => {
        const days = r.fields['Days Until Annual Fee'];
        return r.fields['Decision'] === 'Keep' && days != null && days <= 0;
      });
      if (autoKeep.length > 0) {
        await Promise.all(autoKeep.map(async r => {
          try {
            const updated = await updateRecord(PORTFOLIO_TABLE, r.id, { 'Decision': null, 'Last Reviewed': null });
            r.fields = updated.fields;
          } catch (e) {
            console.error('Auto-reset Keep failed for', r.id, e);
          }
        }));
        const resolvedEntries = autoKeep
          .filter(r => r.fields['Decision'] !== 'Keep')
          .map(r => ({ id: r.id, message: `Kept — next fee due ${fmtDate(addYears(todayDate(), 1))}` }));
        if (resolvedEntries.length > 0) {
          setJustResolved(prev => [...prev.filter(x => !resolvedEntries.some(r => r.id === x.id)), ...resolvedEntries]);
          setTimeout(() => {
            setJustResolved(prev => prev.filter(x => !resolvedEntries.some(r => r.id === x.id)));
          }, 8000);
        }
      }

      setCards(portfolioRows);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  function enrich(row) {
    const f = row.fields;
    const ownerId = (f['Owner'] || [])[0];
    const productId = (f['Current Product'] || [])[0];
    const days = f['Days Until Annual Fee'] ?? null;
    const cardInstances = instancesByCard[row.id] || [];
    const cardSpendBonuses = spendBonusesByCard[row.id] || [];
    const { netValue, hasAnyValue } = sumPerkValue([...cardInstances, ...cardSpendBonuses]);
    return {
      id: row.id,
      cardName: f['Card Name'] || '—',
      ownerId,
      ownerName: ownerId ? (PEOPLE[ownerId] || '—') : '—',
      authorizedUserIds: f['Authorized Users'] || [],
      openDate: f['Open Date'] || '',
      productId,
      productName: productId ? (productsById[productId]?.name || productId) : '—',
      annualFee: f['Annual Fee Amount'] ?? null,
      daysUntilFee: days,
      feeDate: days != null ? addDays(todayDate(), days) : null,
      decision: f['Decision'] || '',
      willingToUpgrade: !!f['Willing to Upgrade'],
      decisionNotes: f['Decision Notes'] || '',
      lastReviewed: f['Last Reviewed'] || '',
      netValue,
      hasAnyValue,
    };
  }

  const enriched = cards.map(enrich).filter(c => c.annualFee != null && c.annualFee > 0);
  const personFiltered = personFilter === ALL_PEOPLE ? enriched : enriched.filter(c => c.ownerName === personFilter);

  const pastDue = enriched.filter(c => c.decision && c.daysUntilFee != null && c.daysUntilFee <= 0);
  const pastDueIds = new Set(pastDue.map(c => c.id));

  const listCards = personFiltered.filter(c => !pastDueIds.has(c.id));
  const needsDecision = listCards.filter(c => !c.decision).sort(byDaysAsc);
  const decisionMade = listCards.filter(c => c.decision).sort(byDaysAsc);

  const statNeedsDecision = personFiltered.filter(c => !c.decision).length;
  const stat30 = personFiltered.filter(c => c.daysUntilFee != null && c.daysUntilFee <= 30).length;
  const stat60 = personFiltered.filter(c => c.daysUntilFee != null && c.daysUntilFee <= 60).length;
  const stat90 = personFiltered.filter(c => c.daysUntilFee != null && c.daysUntilFee <= 90).length;

  async function toggleWTU(card) {
    const newVal = !card.willingToUpgrade;
    setCards(prev => prev.map(r => r.id === card.id ? { ...r, fields: { ...r.fields, 'Willing to Upgrade': newVal } } : r));
    setSavingWTU(card.id);
    try {
      await updateRecord(PORTFOLIO_TABLE, card.id, { 'Willing to Upgrade': newVal });
    } catch (e) {
      console.error('Toggle Willing to Upgrade failed', e);
      setCards(prev => prev.map(r => r.id === card.id ? { ...r, fields: { ...r.fields, 'Willing to Upgrade': card.willingToUpgrade } } : r));
    } finally {
      setSavingWTU(null);
    }
  }

  async function patchDecisionFields(cardId, draft) {
    const patch = {
      'Decision': draft.decision || null,
      'Willing to Upgrade': draft.willingToUpgrade,
      'Decision Notes': draft.notes,
      'Last Reviewed': toAirtableDateStr(todayDate()),
    };
    const updated = await updateRecord(PORTFOLIO_TABLE, cardId, patch);
    setCards(prev => prev.map(r => r.id === cardId ? { ...r, fields: updated.fields } : r));
    return updated;
  }

  async function saveAnnualDecision(card, draft) {
    setAnnualDecisionSaving(card.id);
    setAnnualDecisionError(null);
    try {
      await patchDecisionFields(card.id, draft);
      setAnnualDecisionCard(null);
    } catch (e) {
      setAnnualDecisionError(e.message);
    } finally {
      setAnnualDecisionSaving(null);
    }
  }

  function handleInstancesChange(cardId, updatedInstances) {
    setInstancesByCard(prev => ({ ...prev, [cardId]: updatedInstances }));
  }

  function handleSpendBonusesChange(cardId, updatedSpendBonuses) {
    setSpendBonusesByCard(prev => ({ ...prev, [cardId]: updatedSpendBonuses }));
  }

  function updatePastDueForm(id, patch) {
    setPastDueForms(prev => ({
      ...prev,
      [id]: { cancelDate: toAirtableDateStr(todayDate()), newProductId: '', submitting: false, error: null, ...(prev[id] || {}), ...patch },
    }));
  }

  function getForm(id) {
    return pastDueForms[id] || { cancelDate: toAirtableDateStr(todayDate()), newProductId: '', submitting: false, error: null };
  }

  async function retryKeep(card) {
    try {
      await updateRecord(PORTFOLIO_TABLE, card.id, { 'Decision': null, 'Last Reviewed': null });
      setJustResolved(prev => [...prev, { id: card.id, message: `Kept — next fee due ${fmtDate(addYears(todayDate(), 1))}` }]);
      setTimeout(() => setJustResolved(prev => prev.filter(x => x.id !== card.id)), 8000);
      await load();
    } catch (e) {
      updatePastDueForm(card.id, { error: e.message });
    }
  }

  async function confirmCancel(card) {
    const form = getForm(card.id);
    updatePastDueForm(card.id, { submitting: true, error: null });
    try {
      const cancelDate = form.cancelDate || toAirtableDateStr(todayDate());
      const noteAppend = `Cancelled ${cancelDate}`;
      const newNotes = card.decisionNotes ? `${card.decisionNotes}\n${noteAppend}` : noteAppend;
      await updateRecord(PORTFOLIO_TABLE, card.id, { 'Status': 'Closed', 'Decision': null, 'Decision Notes': newNotes });
      await createRecord(PRODUCT_CHANGES_TABLE, {
        'Card': [card.id],
        'Change Date': cancelDate,
        'Change Type': 'Cancel',
        'From Product': card.productName,
      });
      setJustResolved(prev => [...prev, { id: card.id, message: `Cancelled — effective ${fmtDateStr(cancelDate)}` }]);
      setTimeout(() => setJustResolved(prev => prev.filter(x => x.id !== card.id)), 8000);
      await load();
    } catch (e) {
      updatePastDueForm(card.id, { submitting: false, error: e.message });
    }
  }

  async function confirmChange(card) {
    const form = getForm(card.id);
    if (!form.newProductId) {
      updatePastDueForm(card.id, { error: 'Select a new product.' });
      return;
    }
    updatePastDueForm(card.id, { submitting: true, error: null });
    const newProduct = productsById[form.newProductId];
    try {
      const today = toAirtableDateStr(todayDate());
      await createRecord(PRODUCT_CHANGES_TABLE, {
        'Card': [card.id],
        'Change Date': today,
        'Change Type': card.decision,
        'From Product': card.productName,
        'To Product': newProduct?.name || '',
      });
      await updateRecord(PORTFOLIO_TABLE, card.id, { 'Status': 'Closed', 'Decision': null });

      const newFields = {
        'Card Name': `${card.ownerName} - ${newProduct?.name || 'New Card'}`,
        'Current Product': [form.newProductId],
        'Owner': card.ownerId ? [card.ownerId] : [],
        'Authorized Users': card.authorizedUserIds,
        'Status': 'Active',
      };
      if (card.openDate) newFields['Open Date'] = card.openDate;
      await createRecord(PORTFOLIO_TABLE, newFields);

      let message = `${card.decision} confirmed — moved to ${newProduct?.name || 'new product'}.`;
      if (newProduct?.signupEligibleMonths != null) {
        const eligibleDate = addMonths(todayDate(), newProduct.signupEligibleMonths);
        message += ` Signup bonus eligible again in ${newProduct.signupEligibleMonths} months (${monthYearLabel(eligibleDate)}).`;
      }
      setJustResolved(prev => [...prev, { id: card.id, message }]);
      setTimeout(() => setJustResolved(prev => prev.filter(x => x.id !== card.id)), 10000);
      await load();
    } catch (e) {
      updatePastDueForm(card.id, { submitting: false, error: e.message });
    }
  }

  if (loading) {
    return (
      <div style={{ padding: '3rem', textAlign: 'center', color: 'rgba(255,255,255,0.4)' }}>
        Loading cards…
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '2rem', color: '#FF4D4D' }}>
        Error: {error}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem' }}>
        <StatCard label="Cards Needing Decision" value={statNeedsDecision} accent="#00D4FF" />
        <StatCard label="Due Within 30 Days" value={stat30} accent="#FF4D4D" />
        <StatCard label="Due Within 60 Days" value={stat60} accent="#FFD60A" />
        <StatCard label="Due Within 90 Days" value={stat90} accent="#00E676" />
      </div>

      {pastDue.length > 0 && (
        <div style={{
          background: 'rgba(255,61,0,0.12)', border: '1px solid rgba(255,61,0,0.35)',
          borderRadius: 10, padding: '0.75rem 1rem', color: '#FF6D45', fontSize: '0.9rem', fontWeight: 700,
        }}>
          {pastDue.length} card{pastDue.length !== 1 ? 's' : ''} need action confirmation
        </div>
      )}

      {(pastDue.length > 0 || justResolved.length > 0) && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {pastDue.map(card => (
            <PastDueCard
              key={card.id}
              card={card}
              product={productsById[card.productId]}
              productsById={productsById}
              form={getForm(card.id)}
              onFormChange={updatePastDueForm}
              onConfirmCancel={confirmCancel}
              onConfirmChange={confirmChange}
              onRetryKeep={retryKeep}
            />
          ))}
          {justResolved.filter(r => !pastDue.some(c => c.id === r.id)).map(r => (
            <div key={r.id} style={{
              background: 'rgba(0,230,118,0.1)', border: '1px solid rgba(0,230,118,0.3)',
              borderRadius: 10, padding: '0.75rem 1rem', color: '#00E676', fontSize: '0.85rem', fontWeight: 600,
            }}>
              {r.message}
            </div>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {[['all', 'All'], ['needs', 'Needs Decision'], ['made', 'Decision Made']].map(([id, label]) => (
          <PillBtn key={id} active={viewFilter === id} onClick={() => setViewFilter(id)}>{label}</PillBtn>
        ))}
      </div>

      <PersonFilter selected={personFilter} onChange={setPersonFilter} />

      {(viewFilter === 'all' || viewFilter === 'needs') && (
        <Section
          title="Needs Decision"
          cards={needsDecision}
          tinted
          onToggleWTU={toggleWTU}
          savingWTU={savingWTU}
          onOpenAnnualReview={setAnnualReviewCard}
          onOpenAnnualDecision={setAnnualDecisionCard}
        />
      )}

      {(viewFilter === 'all' || viewFilter === 'made') && (
        <Section
          title="Decision Made"
          cards={decisionMade}
          tinted={false}
          onToggleWTU={toggleWTU}
          savingWTU={savingWTU}
          onOpenAnnualReview={setAnnualReviewCard}
          onOpenAnnualDecision={setAnnualDecisionCard}
        />
      )}

      {needsDecision.length === 0 && decisionMade.length === 0 && (
        <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.3)', padding: '3rem' }}>
          No cards match the current filters.
        </div>
      )}

      {annualReviewCard && (
        <AnnualReviewPanel
          card={annualReviewCard}
          instances={instancesByCard[annualReviewCard.id] || []}
          spendBonuses={spendBonusesByCard[annualReviewCard.id] || []}
          onClose={() => setAnnualReviewCard(null)}
          onInstancesChange={handleInstancesChange}
          onSpendBonusesChange={handleSpendBonusesChange}
        />
      )}

      {annualDecisionCard && (
        <AnnualDecisionPanel
          card={annualDecisionCard}
          productsById={productsById}
          netValue={sumPerkValue([
            ...(instancesByCard[annualDecisionCard.id] || []),
            ...(spendBonusesByCard[annualDecisionCard.id] || []),
          ]).netValue}
          onClose={() => setAnnualDecisionCard(null)}
          onSave={draft => saveAnnualDecision(annualDecisionCard, draft)}
          saving={annualDecisionSaving === annualDecisionCard.id}
          error={annualDecisionError}
        />
      )}
    </div>
  );
}
