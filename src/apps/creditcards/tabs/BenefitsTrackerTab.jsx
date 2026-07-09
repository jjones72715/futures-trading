import { useState, useEffect, useCallback } from 'react';
import { fetchTable, updateRecord, createRecord, deleteRecord } from '../services/airtable.js';
import {
  PERK_INSTANCES_TABLE, PERK_DEFINITIONS_TABLE, PORTFOLIO_TABLE,
  SPEND_BONUS_DEFINITIONS_TABLE, SPEND_BONUSES_TABLE, CARD_PRODUCTS_TABLE,
} from '../config/tables.js';
import { PEOPLE } from '../config/constants.js';
import { advanceUntilFuture, calculateNextResetDate, toAirtableDate } from '../utils/dates.js';
import { stripOwnerPrefix } from '../utils/format.js';

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

const REAL_RESET_CYCLES = ['Monthly', 'Quarterly', 'Semi-Annual', 'Annual'];
const REAL_BENEFIT_TYPES = ['Food Credit', 'Shopping Credit', 'Membership Credit', 'Entertainment Credit', 'Hotel Credit', 'Flight Credit', 'Other Credit'];

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

function ModalPill({ active, onClick, children }) {
  return (
    <button type="button" onClick={onClick} style={{
      padding: '5px 14px', borderRadius: 20, border: '1px solid rgba(255,255,255,0.12)',
      background: active ? '#00D4FF' : 'rgba(255,255,255,0.06)',
      color: active ? '#0B1220' : 'rgba(255,255,255,0.6)',
      fontWeight: active ? 700 : 400, cursor: 'pointer', fontSize: '0.8rem',
    }}>{children}</button>
  );
}

function ProductPicker({ products, loadingProducts, selectedIds, onToggle }) {
  const [search, setSearch] = useState('');
  const filtered = search ? products.filter(p => p.name.toLowerCase().includes(search.toLowerCase())) : products;
  return (
    <div>
      <input
        style={{ ...inp, marginBottom: 8 }}
        placeholder="Search products…"
        value={search}
        onChange={e => setSearch(e.target.value)}
      />
      {loadingProducts ? (
        <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.3)' }}>Loading products…</div>
      ) : (
        <div style={{ maxHeight: 180, overflowY: 'auto', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, background: '#0B1220' }}>
          {filtered.map(p => {
            const selected = selectedIds.includes(p.id);
            return (
              <button key={p.id} type="button" onClick={() => onToggle(p.id)} style={{
                display: 'block', width: '100%', textAlign: 'left',
                padding: '0.5rem 0.75rem', background: selected ? 'rgba(0,212,255,0.12)' : 'transparent',
                border: 'none', borderBottom: '1px solid rgba(255,255,255,0.05)',
                color: selected ? '#00D4FF' : 'rgba(255,255,255,0.7)',
                fontSize: '0.85rem', cursor: 'pointer', fontWeight: selected ? 600 : 400,
              }}>
                {selected ? '✓ ' : ''}{p.name}
              </button>
            );
          })}
          {filtered.length === 0 && (
            <div style={{ padding: '0.6rem 0.75rem', fontSize: '0.8rem', color: 'rgba(255,255,255,0.3)' }}>No results</div>
          )}
        </div>
      )}
      {selectedIds.length > 0 && (
        <div style={{ marginTop: 6, fontSize: '0.75rem', color: 'rgba(0,212,255,0.8)' }}>
          {selectedIds.length} product{selectedIds.length > 1 ? 's' : ''} selected
        </div>
      )}
    </div>
  );
}

function AddBenefitModal({ onClose, onSaved }) {
  const [perkType, setPerkType] = useState(''); // '' | 'real' | 'value-only'
  const [form, setForm] = useState({
    perkName: '', cardProductIds: [], creditAmount: '', resetCycle: '',
    priorityScore: 0, benefitType: '', notes: '',
  });
  const [products, setProducts] = useState([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchTable(CARD_PRODUCTS_TABLE, ['Product Name'])
      .then(rows => {
        setProducts(rows.map(r => ({ id: r.id, name: r.fields['Product Name'] || '' })).sort((a, b) => a.name.localeCompare(b.name)));
      })
      .catch(() => {})
      .finally(() => setLoadingProducts(false));
  }, []);

  function toggleProduct(id) {
    setForm(prev => ({
      ...prev,
      cardProductIds: prev.cardProductIds.includes(id)
        ? prev.cardProductIds.filter(i => i !== id)
        : [...prev.cardProductIds, id],
    }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    if (!form.perkName.trim()) { setError('Perk Name is required.'); return; }
    setSubmitting(true);

    let fields;
    if (perkType === 'value-only') {
      fields = {
        'Perk Name': form.perkName.trim(),
        'Reset Cycle': 'Value Only',
        'Priority Score': 5,
        'Benefit Type': 'Value Only',
      };
      if (form.creditAmount !== '') fields['Credit Amount'] = parseFloat(form.creditAmount);
      if (form.notes.trim()) fields['Notes'] = form.notes.trim();
      if (form.cardProductIds.length) fields['Card Product'] = form.cardProductIds;
    } else {
      fields = { 'Perk Name': form.perkName.trim() };
      if (form.cardProductIds.length) fields['Card Product'] = form.cardProductIds;
      if (form.creditAmount !== '') fields['Credit Amount'] = parseFloat(form.creditAmount);
      if (form.resetCycle) fields['Reset Cycle'] = form.resetCycle;
      if (form.priorityScore) fields['Priority Score'] = form.priorityScore;
      if (form.benefitType) fields['Benefit Type'] = form.benefitType;
      if (form.notes.trim()) fields['Notes'] = form.notes.trim();
    }

    try {
      await createRecord(PERK_DEFINITIONS_TABLE, fields);
      onSaved();
      onClose();
    } catch (e) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 1000,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem',
    }} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{
        background: '#111827', borderRadius: 16, border: '1px solid rgba(255,255,255,0.1)',
        padding: '1.75rem 2rem', width: '100%', maxWidth: 600, maxHeight: '90vh',
        overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1.25rem',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700, color: '#fff' }}>Add Perk Definition</h2>
          <button type="button" onClick={onClose} style={{
            background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)',
            fontSize: '1.4rem', cursor: 'pointer', lineHeight: 1, padding: 0,
          }}>×</button>
        </div>

        {/* Step 1 — Perk type */}
        <div>
          <label style={lbl}>Perk Type</label>
          <div style={{ display: 'flex', gap: 8 }}>
            <ModalPill active={perkType === 'real'} onClick={() => setPerkType('real')}>Real Perk</ModalPill>
            <ModalPill active={perkType === 'value-only'} onClick={() => setPerkType('value-only')}>Value Only Perk</ModalPill>
          </div>
        </div>

        {error && (
          <div style={{ background: '#FF4D4D22', border: '1px solid #FF4D4D', borderRadius: 8, padding: '0.7rem 1rem', color: '#FF4D4D', fontSize: '0.85rem' }}>
            {error}
          </div>
        )}

        {perkType === 'real' && (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
            <div>
              <label style={lbl}>Perk Name <span style={{ color: '#FF4D4D' }}>*</span></label>
              <input style={inp} value={form.perkName} onChange={e => setForm(p => ({ ...p, perkName: e.target.value }))} placeholder="e.g. $10 Monthly Dining Credit" autoFocus />
            </div>

            <div>
              <label style={lbl}>Benefit Type</label>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {REAL_BENEFIT_TYPES.map(t => (
                  <ModalPill key={t} active={form.benefitType === t} onClick={() => setForm(p => ({ ...p, benefitType: p.benefitType === t ? '' : t }))}>{t}</ModalPill>
                ))}
              </div>
            </div>

            <div>
              <label style={lbl}>Reset Cycle</label>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {REAL_RESET_CYCLES.map(c => (
                  <ModalPill key={c} active={form.resetCycle === c} onClick={() => setForm(p => ({ ...p, resetCycle: p.resetCycle === c ? '' : c }))}>{c}</ModalPill>
                ))}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div>
                <label style={lbl}>Credit Amount ($)</label>
                <input style={inp} type="number" value={form.creditAmount} onChange={e => setForm(p => ({ ...p, creditAmount: e.target.value }))} placeholder="0" min={0} />
              </div>
              <div>
                <label style={lbl}>Priority Score</label>
                <div style={{ display: 'flex', gap: 6, paddingTop: 4 }}>
                  {[1,2,3,4,5].map(n => (
                    <button key={n} type="button" onClick={() => setForm(p => ({ ...p, priorityScore: p.priorityScore === n ? 0 : n }))} style={{
                      width: 28, height: 28, borderRadius: '50%', border: 'none',
                      background: n <= form.priorityScore ? '#00D4FF' : 'rgba(255,255,255,0.12)',
                      cursor: 'pointer', padding: 0, color: n <= form.priorityScore ? '#0B1220' : 'rgba(255,255,255,0.4)',
                      fontWeight: 700, fontSize: '0.75rem',
                    }}>{n}</button>
                  ))}
                </div>
              </div>
            </div>

            <div>
              <label style={lbl}>Card Products (optional)</label>
              <ProductPicker products={products} loadingProducts={loadingProducts} selectedIds={form.cardProductIds} onToggle={toggleProduct} />
            </div>

            <div>
              <label style={lbl}>Notes</label>
              <textarea style={{ ...inp, minHeight: 80, resize: 'vertical' }} value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} placeholder="Optional notes…" />
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', paddingTop: 4 }}>
              <button type="button" onClick={onClose} style={{
                padding: '0.65rem 1.5rem', borderRadius: 9, border: '1px solid rgba(255,255,255,0.15)',
                background: 'transparent', color: 'rgba(255,255,255,0.6)', cursor: 'pointer', fontWeight: 600, fontSize: '0.88rem',
              }}>Cancel</button>
              <button type="submit" disabled={submitting} style={{
                padding: '0.65rem 1.75rem', borderRadius: 9, border: 'none',
                background: submitting ? 'rgba(0,212,255,0.4)' : '#00D4FF',
                color: '#0B1220', fontWeight: 700, fontSize: '0.88rem',
                cursor: submitting ? 'not-allowed' : 'pointer',
              }}>{submitting ? 'Saving…' : 'Add Perk'}</button>
            </div>
          </form>
        )}

        {perkType === 'value-only' && (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
            <div style={{
              background: 'rgba(179,136,255,0.08)', border: '1px solid rgba(179,136,255,0.2)',
              borderRadius: 10, padding: '0.85rem 1rem',
              display: 'flex', flexDirection: 'column', gap: 10,
            }}>
              <div style={{ fontWeight: 700, color: '#B388FF', fontSize: '0.85rem' }}>New Value Perk Definition</div>
              <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)' }}>
                Saved with Reset Cycle: Value Only · Priority Score: 5 · Benefit Type: Value Only
              </div>

              <div>
                <label style={lbl}>Perk Name <span style={{ color: '#FF4D4D' }}>*</span></label>
                <input style={inp} value={form.perkName} onChange={e => setForm(p => ({ ...p, perkName: e.target.value }))} placeholder="e.g. Lounge Access" autoFocus />
              </div>

              <div>
                <label style={lbl}>Credit Amount</label>
                <input style={inp} type="number" value={form.creditAmount} onChange={e => setForm(p => ({ ...p, creditAmount: e.target.value }))} placeholder="0" min={0} />
                <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.35)', marginTop: 4 }}>Annualized face value of the perk.</div>
              </div>

              <div>
                <label style={lbl}>Notes</label>
                <textarea style={{ ...inp, minHeight: 60, resize: 'vertical' }} value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} placeholder="Optional context…" />
              </div>
            </div>

            <div>
              <label style={lbl}>Card Product</label>
              <ProductPicker products={products} loadingProducts={loadingProducts} selectedIds={form.cardProductIds} onToggle={toggleProduct} />
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', paddingTop: 4 }}>
              <button type="button" onClick={onClose} style={{
                padding: '0.65rem 1.5rem', borderRadius: 9, border: '1px solid rgba(255,255,255,0.15)',
                background: 'transparent', color: 'rgba(255,255,255,0.6)', cursor: 'pointer', fontWeight: 600, fontSize: '0.88rem',
              }}>Cancel</button>
              <button type="submit" disabled={submitting} style={{
                padding: '0.65rem 1.75rem', borderRadius: 9, border: 'none',
                background: submitting ? 'rgba(179,136,255,0.4)' : '#B388FF',
                color: '#0B1220', fontWeight: 700, fontSize: '0.88rem',
                cursor: submitting ? 'not-allowed' : 'pointer',
              }}>{submitting ? 'Saving…' : 'Add Perk'}</button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

const cardStyle = {
  background: '#172033', borderRadius: 12, border: '1px solid rgba(255,255,255,0.08)',
  padding: '1rem 1.5rem',
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

function StatCard({ label, value, accent }) {
  return (
    <div style={{
      background: '#172033', borderRadius: 12, border: '1px solid rgba(255,255,255,0.08)',
      padding: '1rem 1.5rem', display: 'flex', flexDirection: 'column', gap: 4,
    }}>
      <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>
        {label}
      </div>
      <div style={{ fontSize: '1.8rem', fontWeight: 800, color: accent || '#fff', lineHeight: 1 }}>
        {value}
      </div>
    </div>
  );
}

function fmt(dateStr) {
  if (!dateStr) return '—';
  const [y, m, d] = dateStr.split('-');
  return `${parseInt(m)}/${parseInt(d)}/${y}`;
}

function isResettingSoon(dateStr) {
  if (!dateStr) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const reset = new Date(dateStr + 'T00:00:00');
  const diff = (reset - today) / (1000 * 60 * 60 * 24);
  return diff >= 0 && diff <= 7;
}

function buildSyncSummary(r) {
  const parts = [];
  if (r.deleted > 0) parts.push(`${r.deleted} orphan${r.deleted !== 1 ? 's' : ''} deleted`);
  if (r.addedTrackable > 0 || r.addedValue > 0) {
    parts.push(`${r.addedTrackable} trackable perk${r.addedTrackable !== 1 ? 's' : ''} and ${r.addedValue} value perk${r.addedValue !== 1 ? 's' : ''} added`);
  }
  if (r.patched > 0) parts.push(`${r.patched} backfilled`);
  if (r.spendAdded > 0) parts.push(`${r.spendAdded} spend bonus${r.spendAdded !== 1 ? 'es' : ''} added`);

  if (parts.length === 0) return 'All perks up to date';

  let msg = parts.join(', ');
  const cardsTouched = Math.max(r.cards || 0, r.spendCards || 0);
  if (cardsTouched > 0) msg += ` across ${cardsTouched} card${cardsTouched !== 1 ? 's' : ''}`;

  const totalSkipped = (r.skipped || 0) + (r.spendSkipped || 0);
  if (totalSkipped > 0) msg += `, ${totalSkipped} skipped`;

  return msg;
}

function isPastOrToday(dateStr) {
  if (!dateStr) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(dateStr + 'T00:00:00');
  return d <= today;
}

export function BenefitsTrackerTab() {
  const [instances, setInstances] = useState([]);
  const [defsById, setDefsById] = useState({});
  const [cardsById, setCardsById] = useState({});
  const [loading, setLoading] = useState(true);
  const [resetStatus, setResetStatus] = useState('');
  const [personFilter, setPersonFilter] = useState('All');
  const [cycleFilter, setCycleFilter] = useState('All');
  const [creditTypeFilter, setCreditTypeFilter] = useState('All');
  const [showAll, setShowAll] = useState(false);
  const [toggling, setToggling] = useState({});
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState(null);
  const [showAddBenefit, setShowAddBenefit] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setResetStatus('Checking for expired perks…');

    // Step 1 — load defs and instances together
    const [allInstRaw, defs, cards] = await Promise.all([
      fetchTable(PERK_INSTANCES_TABLE, ['Label', 'Perk Definition', 'Card', 'Person', 'Used', 'Next Reset Date', 'Priority Score', 'Reset Cycle', 'Credit Amount', 'Last Digits', 'Credit Type', 'Perk Type']),
      fetchTable(PERK_DEFINITIONS_TABLE, ['Perk Name', 'Card Product', 'Credit Amount', 'Reset Cycle', 'Priority Score']),
      fetchTable(PORTFOLIO_TABLE, ['Card Name']),
    ]);

    // Value Only perks are tracked in Card Summary / Annual Review instead — hide them here entirely
    const allInst = allInstRaw.filter(r => r.fields['Perk Type'] !== 'Value Only');

    const defMap = {};
    defs.forEach(r => { defMap[r.id] = r.fields; });

    const cardMap = {};
    cards.forEach(r => { cardMap[r.id] = r.fields['Card Name'] || r.id; });

    // Step 2 — find instances where Next Reset Date is past (regardless of Used state)
    const toReset = allInst.filter(r => isPastOrToday(r.fields['Next Reset Date']));

    // Step 3 — advance date forward; clear Used only if it was true
    if (toReset.length > 0) {
      setResetStatus(`Advancing ${toReset.length} expired perk${toReset.length > 1 ? 's' : ''}…`);
      await Promise.all(toReset.map(async r => {
        const defId = (r.fields['Perk Definition'] || [])[0];
        const def = defId ? defMap[defId] : null;
        const rawCycle = r.fields['Reset Cycle'];
        const cycle = (Array.isArray(rawCycle) ? rawCycle[0] : rawCycle) || def?.['Reset Cycle'];
        const currentDate = r.fields['Next Reset Date'];
        const newDate = cycle && currentDate ? advanceUntilFuture(cycle, currentDate) : null;

        const patch = {};
        if (r.fields['Used']) patch['Used'] = false;
        if (newDate) patch['Next Reset Date'] = newDate;
        if (!Object.keys(patch).length) return;

        try {
          await updateRecord(PERK_INSTANCES_TABLE, r.id, patch);
          if (r.fields['Used']) r.fields['Used'] = false;
          if (newDate) r.fields['Next Reset Date'] = newDate;
        } catch (e) {
          console.error('Reset failed for', r.id, e);
        }
      }));
    }

    setResetStatus('');
    setDefsById(defMap);
    setCardsById(cardMap);
    setInstances(allInst);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function syncPerks() {
    setSyncing(true);
    setSyncResult(null);
    try {
      // Fetch all sources in parallel
      const [portfolio, defs, existingInst, spendDefs, existingSpendInst] = await Promise.all([
        fetchTable(PORTFOLIO_TABLE, ['Card Name', 'Current Product', 'Owner', 'Open Date', 'Status']),
        fetchTable(PERK_DEFINITIONS_TABLE, ['Perk Name', 'Card Product', 'Reset Cycle', 'Credit Amount', 'Priority Score', 'Benefit Type']),
        fetchTable(PERK_INSTANCES_TABLE, ['Card', 'Perk Definition', 'Label', 'Credit Amount', 'Priority Score', 'Reset Cycle']),
        fetchTable(SPEND_BONUS_DEFINITIONS_TABLE, ['Bonus Description', 'Card Product', 'Annual Spend Target', 'Reset Type']),
        fetchTable(SPEND_BONUSES_TABLE, ['Card', 'Spend Bonus Definition']),
      ]);

      // Index defs by record ID and by Card Product record ID
      const defsById = {};
      const defsByProductId = {};
      defs.forEach(def => {
        defsById[def.id] = def;
        const productIds = def.fields['Card Product'] || [];
        productIds.forEach(pid => {
          if (!defsByProductId[pid]) defsByProductId[pid] = [];
          defsByProductId[pid].push(def);
        });
      });

      // Delete instances with no linked Perk Definition
      const orphans = existingInst.filter(r => !(r.fields['Perk Definition'] || []).length);
      let deleted = 0;
      for (const o of orphans) {
        try {
          await deleteRecord(PERK_INSTANCES_TABLE, o.id);
          deleted++;
        } catch (e) {
          console.error('Sync delete failed:', e);
        }
      }

      // Build map of existing instances: key -> instance record (for duplicate check + backfill)
      const existingByKey = {};
      existingInst.forEach(r => {
        const cardId = (r.fields['Card'] || [])[0] || '';
        const defId = (r.fields['Perk Definition'] || [])[0] || '';
        if (cardId && defId) existingByKey[`${cardId}::${defId}`] = r;
      });

      const today = new Date();
      const creates = [];
      const patches = []; // existing instances missing Label/Credit Amount/Priority Score
      let skipped = 0;
      const cardsSeen = new Set();

      for (const card of portfolio) {
        const cardId = card.id;
        const productId = (card.fields['Current Product'] || [])[0];
        if (!productId) continue;

        const matchingDefs = defsByProductId[productId] || [];
        if (matchingDefs.length === 0) continue;

        const ownerIds = card.fields['Owner'] || [];

        for (const def of matchingDefs) {
          for (const personId of ownerIds) {
            const key = `${cardId}::${def.id}`;
            const existing = existingByKey[key];
            if (existing) {
              // Check if backfill needed
              const patch = {};
              if (!existing.fields['Label']) patch['Label'] = def.fields['Perk Name'] || '';
              if (existing.fields['Credit Amount'] == null && def.fields['Credit Amount'] != null)
                patch['Credit Amount'] = def.fields['Credit Amount'];
              if (existing.fields['Priority Score'] == null && def.fields['Priority Score'] != null)
                patch['Priority Score'] = def.fields['Priority Score'];
              if (Object.keys(patch).length > 0) patches.push({ id: existing.id, fields: patch });
              else skipped++;
              continue;
            }
            const cycle = def.fields['Reset Cycle'];
            const nextDate = cycle ? calculateNextResetDate(cycle, today) : null;
            const perkType = def.fields['Benefit Type'] === 'Value Only' ? 'Value Only' : 'Trackable';
            const instanceFields = {
              'Perk Definition': [def.id],
              'Card': [cardId],
              'Person': [personId],
              'Used': false,
              'Label': def.fields['Perk Name'] || '',
              'Perk Type': perkType,
            };
            if (nextDate) instanceFields['Next Reset Date'] = toAirtableDate(nextDate);
            if (def.fields['Credit Amount'] != null) instanceFields['Credit Amount'] = def.fields['Credit Amount'];
            if (def.fields['Priority Score'] != null) instanceFields['Priority Score'] = def.fields['Priority Score'];
            creates.push({ fields: instanceFields, cardId });
            existingByKey[key] = { id: 'pending', fields: instanceFields };
          }
        }
        if (creates.some(c => c.cardId === cardId)) cardsSeen.add(cardId);
      }

      // Fire creates sequentially to avoid rate limits
      let addedTrackable = 0;
      let addedValue = 0;
      for (const c of creates) {
        try {
          await createRecord(PERK_INSTANCES_TABLE, c.fields);
          if (c.fields['Perk Type'] === 'Value Only') addedValue++;
          else addedTrackable++;
          cardsSeen.add(c.cardId);
        } catch (e) {
          console.error('Sync create failed:', e);
        }
      }

      // Backfill missing fields on existing instances
      let patched = 0;
      for (const p of patches) {
        try {
          await updateRecord(PERK_INSTANCES_TABLE, p.id, p.fields);
          patched++;
        } catch (e) {
          console.error('Sync patch failed:', e);
        }
      }

      // Spend Bonus Definitions: create missing instances per active card
      const spendDefsByProductId = {};
      spendDefs.forEach(def => {
        const productIds = def.fields['Card Product'] || [];
        productIds.forEach(pid => {
          if (!spendDefsByProductId[pid]) spendDefsByProductId[pid] = [];
          spendDefsByProductId[pid].push(def);
        });
      });

      const existingSpendKeys = new Set(
        existingSpendInst.map(r => `${(r.fields['Card'] || [])[0]}::${(r.fields['Spend Bonus Definition'] || [])[0]}`)
      );

      const spendCreates = [];
      let spendSkipped = 0;
      const spendCardsSeen = new Set();

      for (const card of portfolio) {
        if (card.fields['Status'] !== 'Active') continue;
        const productId = (card.fields['Current Product'] || [])[0];
        if (!productId) continue;

        const matchingDefs = spendDefsByProductId[productId] || [];
        if (matchingDefs.length === 0) continue;

        const ownerId = (card.fields['Owner'] || [])[0];
        if (!ownerId) continue;

        for (const def of matchingDefs) {
          const key = `${card.id}::${def.id}`;
          if (existingSpendKeys.has(key)) { spendSkipped++; continue; }

          const resetDate = calculateSpendBonusResetDate(def.fields['Reset Type'], card.fields['Open Date']);
          if (!resetDate) continue;

          spendCreates.push({
            cardId: card.id,
            fields: {
              'Card': [card.id],
              'Person': [ownerId],
              'Annual Spend Target': def.fields['Annual Spend Target'] ?? 0,
              'Reset Date': resetDate,
              'Bonus Earned': false,
              'Spend Bonus Definition': [def.id],
              'Bonus Description': def.fields['Bonus Description'] || '',
            },
          });
          existingSpendKeys.add(key);
        }
      }

      let spendAdded = 0;
      for (const c of spendCreates) {
        try {
          await createRecord(SPEND_BONUSES_TABLE, c.fields);
          spendAdded++;
          spendCardsSeen.add(c.cardId);
        } catch (e) {
          console.error('Spend bonus sync create failed:', e);
        }
      }

      setSyncResult({
        addedTrackable, addedValue, patched, deleted, cards: cardsSeen.size, skipped,
        spendAdded, spendCards: spendCardsSeen.size, spendSkipped,
      });
      await load();
    } catch (e) {
      console.error('Sync failed:', e);
      setSyncResult({ error: e.message });
    } finally {
      setSyncing(false);
    }
  }

  async function savePriority(recordId, value) {
    setInstances(prev => prev.map(r =>
      r.id === recordId ? { ...r, fields: { ...r.fields, 'Priority Score': value } } : r
    ));
    try {
      await updateRecord(PERK_INSTANCES_TABLE, recordId, { 'Priority Score': value });
    } catch (e) {
      console.error('Priority save failed:', e);
    }
  }

  async function toggleUsed(record, currentValue) {
    setToggling(prev => ({ ...prev, [record.id]: true }));
    const newVal = !currentValue;
    setInstances(prev => prev.map(r =>
      r.id === record.id ? { ...r, fields: { ...r.fields, 'Used': newVal } } : r
    ));
    try {
      await updateRecord(PERK_INSTANCES_TABLE, record.id, { 'Used': newVal });
    } catch (e) {
      console.error('Toggle failed:', e);
      setInstances(prev => prev.map(r =>
        r.id === record.id ? { ...r, fields: { ...r.fields, 'Used': currentValue } } : r
      ));
    } finally {
      setToggling(prev => { const n = { ...prev }; delete n[record.id]; return n; });
    }
  }

  const enriched = instances.map(r => {
    const f = r.fields;
    const defId = (f['Perk Definition'] || [])[0];
    const def = defId ? (defsById[defId] || {}) : {};
    const cardId = (f['Card'] || [])[0];
    const personId = (f['Person'] || [])[0];
    const personName = personId ? (PEOPLE[personId] || '—') : '—';
    const rawLastDigits = f['Last Digits'];
    return {
      id: r.id,
      perkName: def['Perk Name'] || f['Label'] || '—',
      cardName: stripOwnerPrefix(cardId ? (cardsById[cardId] || '—') : '—', personName),
      personId: personId || '',
      personName,
      creditAmount: f['Credit Amount'] ?? def['Credit Amount'] ?? null,
      creditType: (() => { const ct = f['Credit Type']; if (!ct) return null; if (Array.isArray(ct)) return ct[0]?.name || ct[0] || null; if (typeof ct === 'object') return ct.name || null; return ct; })(),
      lastDigits: Array.isArray(rawLastDigits) ? (rawLastDigits[0] ?? null) : (rawLastDigits ?? null),
      resetCycle: (Array.isArray(f['Reset Cycle']) ? f['Reset Cycle'][0] : f['Reset Cycle']) || def['Reset Cycle'] || '',
      priorityScore: f['Priority Score'] != null ? f['Priority Score'] : (def['Priority Score'] ?? 0),
      nextResetDate: f['Next Reset Date'] || '',
      used: f['Used'] || false,
    };
  });

  const creditTypes = ['All', ...[...new Set(enriched.map(r => r.creditType).filter(Boolean))].sort()];

  const filtered = enriched.filter(row => {
    if (personFilter !== 'All' && row.personName !== personFilter) return false;
    if (cycleFilter !== 'All' && row.resetCycle !== cycleFilter) return false;
    if (creditTypeFilter !== 'All' && row.creditType !== creditTypeFilter) return false;
    if (!showAll && row.used) return false;
    return true;
  });

  const sorted = [...filtered].sort((a, b) => {
    if (b.priorityScore !== a.priorityScore) return b.priorityScore - a.priorityScore;
    if (!a.nextResetDate && !b.nextResetDate) return 0;
    if (!a.nextResetDate) return 1;
    if (!b.nextResetDate) return -1;
    return a.nextResetDate.localeCompare(b.nextResetDate);
  });

  const totalAvailable = enriched.filter(r => !r.used).length;
  const total = enriched.length;

  if (loading) {
    return (
      <div style={{ padding: '3rem', textAlign: 'center', color: 'rgba(255,255,255,0.4)' }}>
        {resetStatus || 'Loading…'}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', maxWidth: 1100 }}>

      {showAddBenefit && (
        <AddBenefitModal
          onClose={() => setShowAddBenefit(false)}
          onSaved={() => { /* no reload needed — def doesn't appear in this view */ }}
        />
      )}

      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1.25rem', flexWrap: 'wrap' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem', width: 'fit-content' }}>
          <StatCard label="Available Perks" value={totalAvailable} accent="#00D4FF" />
          <StatCard label="Total Perks" value={total} />
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', alignSelf: 'center', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => setShowAddBenefit(true)}
            style={{
              padding: '0.6rem 1.25rem', borderRadius: 9, border: '1px solid rgba(0,230,118,0.3)',
              background: 'rgba(0,230,118,0.1)', color: '#00E676',
              fontWeight: 600, fontSize: '0.82rem', cursor: 'pointer',
              whiteSpace: 'nowrap', transition: 'all 0.15s',
            }}
          >
            + Add Benefit
          </button>
          <button
            type="button"
            onClick={syncPerks}
            disabled={syncing || loading}
            style={{
              padding: '0.6rem 1.25rem', borderRadius: 9, border: '1px solid rgba(0,212,255,0.3)',
              background: syncing ? 'rgba(0,212,255,0.08)' : 'rgba(0,212,255,0.12)',
              color: syncing ? 'rgba(0,212,255,0.5)' : '#00D4FF',
              fontWeight: 600, fontSize: '0.82rem', cursor: syncing ? 'not-allowed' : 'pointer',
              whiteSpace: 'nowrap', transition: 'all 0.15s',
            }}
          >
            {syncing ? 'Syncing…' : 'Sync Perks to All Cards'}
          </button>
        </div>
      </div>

      {syncResult && !syncResult.error && (
        <div style={{ background: '#00E67622', border: '1px solid #00E676', borderRadius: 10, padding: '0.75rem 1rem', color: '#00E676', fontWeight: 600, fontSize: '0.88rem' }}>
          {buildSyncSummary(syncResult)}
        </div>
      )}
      {syncResult?.error && (
        <div style={{ background: '#FF4D4D22', border: '1px solid #FF4D4D', borderRadius: 10, padding: '0.75rem 1rem', color: '#FF4D4D', fontSize: '0.88rem' }}>
          Sync failed: {syncResult.error}
        </div>
      )}

      <div style={cardStyle}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600, marginRight: 4 }}>Person</span>
            <PillBtn active={personFilter === 'All'} onClick={() => setPersonFilter('All')}>All</PillBtn>
            {Object.values(PEOPLE).map(name => (
              <PillBtn key={name} active={personFilter === name} onClick={() => setPersonFilter(name)}>{name}</PillBtn>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600, marginRight: 4 }}>Cycle</span>
            <PillBtn active={cycleFilter === 'All'} onClick={() => setCycleFilter('All')}>All</PillBtn>
            {RESET_CYCLES.map(c => (
              <PillBtn key={c} active={cycleFilter === c} onClick={() => setCycleFilter(c)}>{c}</PillBtn>
            ))}
          </div>
          {creditTypes.length > 1 && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600, marginRight: 4 }}>Credit Type</span>
              {creditTypes.map(t => (
                <PillBtn key={t} active={creditTypeFilter === t} onClick={() => setCreditTypeFilter(t)}>{t}</PillBtn>
              ))}
            </div>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>Show</span>
            <button type="button" onClick={() => setShowAll(false)} style={{
              padding: '5px 16px', borderRadius: 20, border: '1px solid rgba(255,255,255,0.12)',
              background: !showAll ? '#00D4FF' : 'rgba(255,255,255,0.06)',
              color: !showAll ? '#0B1220' : 'rgba(255,255,255,0.6)',
              fontWeight: !showAll ? 700 : 400, cursor: 'pointer', fontSize: '0.82rem',
            }}>Available Only</button>
            <button type="button" onClick={() => setShowAll(true)} style={{
              padding: '5px 16px', borderRadius: 20, border: '1px solid rgba(255,255,255,0.12)',
              background: showAll ? '#00D4FF' : 'rgba(255,255,255,0.06)',
              color: showAll ? '#0B1220' : 'rgba(255,255,255,0.6)',
              fontWeight: showAll ? 700 : 400, cursor: 'pointer', fontSize: '0.82rem',
            }}>Show All</button>
          </div>
        </div>
      </div>

      {sorted.length === 0 ? (
        <div style={{ ...cardStyle, color: 'rgba(255,255,255,0.35)', textAlign: 'center', padding: '3rem' }}>
          No perks match the current filters.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: '2fr 2fr 65px 1fr 1fr 100px 1fr 1.2fr 60px',
            gap: '0.75rem',
            padding: '0.5rem 1rem',
            fontSize: '0.68rem',
            color: 'rgba(255,255,255,0.3)',
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            fontWeight: 600,
          }}>
            <span>Perk</span>
            <span>Card</span>
            <span>Last 4/5</span>
            <span>Person</span>
            <span>Amount</span>
            <span>Priority</span>
            <span>Cycle</span>
            <span>Next Reset</span>
            <span style={{ textAlign: 'center' }}>Used</span>
          </div>

          {sorted.map(row => {
            const soon = isResettingSoon(row.nextResetDate);
            const dimmed = showAll && row.used;
            return (
              <div key={row.id} style={{
                display: 'grid',
                gridTemplateColumns: '2fr 2fr 65px 1fr 1fr 100px 1fr 1.2fr 60px',
                gap: '0.75rem',
                alignItems: 'center',
                padding: '1.1rem 1rem',
                borderRadius: 10,
                background: soon ? 'rgba(255,215,0,0.06)' : '#172033',
                border: soon ? '1px solid rgba(255,215,0,0.25)' : '1px solid rgba(255,255,255,0.06)',
                opacity: dimmed ? 0.4 : 1,
                transition: 'opacity 0.15s',
              }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <span style={{ fontWeight: 600, color: '#fff', fontSize: '0.88rem' }}>
                    {soon && <span style={{ marginRight: 6, fontSize: '0.75rem', color: '#FFD700', fontWeight: 700 }}>⚡</span>}
                    {row.perkName}
                  </span>
                  {row.creditType && (
                    <span style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.35)', fontWeight: 500 }}>
                      {row.creditType}
                    </span>
                  )}
                </div>
                <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.85rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {row.cardName}
                </span>
                <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.82rem' }}>
                  {row.lastDigits != null ? `···${row.lastDigits}` : '—'}
                </span>
                <span style={{ color: 'rgba(255,255,255,0.55)', fontSize: '0.85rem' }}>{row.personName}</span>
                <span style={{ color: '#00D4FF', fontWeight: 700, fontSize: '0.88rem' }}>
                  {row.creditAmount != null ? `$${row.creditAmount}` : '—'}
                </span>
                <div style={{ display: 'flex', gap: 3 }}>
                  {[1,2,3,4,5].map(n => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => savePriority(row.id, n)}
                      style={{
                        width: 16, height: 16, borderRadius: '50%', border: 'none',
                        background: n <= row.priorityScore ? '#00D4FF' : 'rgba(255,255,255,0.12)',
                        cursor: 'pointer', padding: 0, flexShrink: 0,
                        transition: 'background 0.1s',
                      }}
                    />
                  ))}
                </div>
                <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.82rem' }}>{row.resetCycle || '—'}</span>
                <span style={{ fontSize: '0.82rem', color: soon ? '#FFD700' : 'rgba(255,255,255,0.5)', fontWeight: soon ? 700 : 400 }}>
                  {fmt(row.nextResetDate)}
                </span>
                <div style={{ display: 'flex', justifyContent: 'center' }}>
                  <input
                    type="checkbox"
                    checked={row.used}
                    disabled={!!toggling[row.id]}
                    onChange={() => {
                      const orig = instances.find(r => r.id === row.id);
                      if (orig) toggleUsed(orig, row.used);
                    }}
                    style={{ width: 18, height: 18, accentColor: '#00D4FF', cursor: 'pointer' }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
