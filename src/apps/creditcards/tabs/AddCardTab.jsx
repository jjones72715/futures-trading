import { useState, useEffect } from 'react';
import { createRecord, fetchTable } from '../services/airtable.js';
import { PORTFOLIO_TABLE, CARD_PRODUCTS_TABLE, BANKS_TABLE, REWARDS_TABLE, PERK_DEFINITIONS_TABLE, PERK_INSTANCES_TABLE } from '../config/tables.js';
import { PEOPLE } from '../config/constants.js';
import { calculateNextResetDate, toAirtableDate } from '../utils/dates.js';
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const RISK_LEVELS = ['Low', 'Medium', 'High'];

const EMPTY = {
  ownerIds: [], issuer: '', currentProductId: '', cardName: '',
  personalBusiness: 'Personal', openDate: '', annualFee: '',
  annualFeeMonth: '', statementCloseDay: '', last4: '',
  rewardsProgramId: '', cancelRisk: 'Low', status: 'Active',
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
const card = {
  background: '#172033', borderRadius: 12, border: '1px solid rgba(255,255,255,0.08)',
  padding: '1.25rem 1.5rem',
};
const grid2 = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' };

function pillBtn(active, onClick, children) {
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

export function AddCardTab() {
  const [products, setProducts] = useState([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [form, setForm] = useState(EMPTY);
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [error, setError] = useState(null);

  useEffect(() => {
    Promise.all([
      fetchTable(CARD_PRODUCTS_TABLE, ['Product Name', 'Annual Fee', 'Issuer', 'Rewards Program']),
      fetchTable(BANKS_TABLE, ['Bank Name']),
      fetchTable(REWARDS_TABLE, ['Name']),
    ]).then(([productRecords, bankRecords, rewardRecords]) => {
      const bankMap = {};
      bankRecords.forEach(r => { bankMap[r.id] = r.fields['Bank Name']; });
      const rewardsMap = {};
      rewardRecords.forEach(r => { rewardsMap[r.id] = r.fields['Name']; });

      const mapped = productRecords
        .map(r => {
          const issuerId = r.fields['Issuer']?.[0];
          const rpId = r.fields['Rewards Program']?.[0];
          return {
            id: r.id,
            name: r.fields['Product Name'] || '',
            fee: r.fields['Annual Fee'] ?? 0,
            bank: bankMap[issuerId] || '',
            bankId: issuerId || '',
            rpId: rpId || '',
            rpName: rewardsMap[rpId] || '',
          };
        })
        .filter(p => p.name && p.bank)
        .sort((a, b) => a.name.localeCompare(b.name));
      setProducts(mapped);
    })
    .catch(() => {})
    .finally(() => setLoadingProducts(false));
  }, []);

  const allBanks = [...new Set(products.map(p => p.bank))].sort();
  const rewardsPrograms = [...new Map(
    products.filter(p => p.rpId).map(p => [p.rpId, { id: p.rpId, name: p.rpName }])
  ).values()].sort((a, b) => a.name.localeCompare(b.name));

  function autoCardName(ownerIds, productId) {
    const nickname = ownerIds.length > 0 ? PEOPLE[ownerIds[0]] : '';
    const product = products.find(p => p.id === productId);
    if (!nickname && !product) return '';
    if (!nickname) return product.name;
    if (!product) return '';
    return `${nickname} - ${product.name}`;
  }

  const filteredProducts = form.issuer
    ? products.filter(p => p.bank === form.issuer)
    : [];

  function toggleOwner(id) {
    setForm(prev => {
      const newIds = prev.ownerIds.includes(id)
        ? prev.ownerIds.filter(i => i !== id)
        : [...prev.ownerIds, id];
      return { ...prev, ownerIds: newIds, cardName: autoCardName(newIds, prev.currentProductId) };
    });
  }

  function selectIssuer(bank) {
    const newIssuer = bank === form.issuer ? '' : bank;
    setForm(prev => ({
      ...prev,
      issuer: newIssuer,
      currentProductId: '',
      annualFee: '',
      rewardsProgramId: '',
      cardName: autoCardName(prev.ownerIds, ''),
    }));
  }

  function selectProduct(productId) {
    const product = products.find(p => p.id === productId);
    setForm(prev => ({
      ...prev,
      currentProductId: productId,
      annualFee: product ? String(product.fee) : '',
      rewardsProgramId: product?.rpId || '',
      cardName: autoCardName(prev.ownerIds, productId),
    }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    if (!form.cardName.trim()) { setError('Card Name is required.'); return; }
    if (form.ownerIds.length === 0) { setError('Select at least one Owner.'); return; }

    setSubmitting(true);
    const fields = {
      'Card Name': form.cardName.trim(),
      'Status': form.status,
      'Owner': form.ownerIds,
    };
    const selectedProduct = products.find(p => p.id === form.currentProductId);
    if (selectedProduct?.bankId) fields['Issuer'] = [selectedProduct.bankId];
    if (form.personalBusiness)   fields['Personal/Business'] = form.personalBusiness;
    if (form.currentProductId)   fields['Current Product'] = [form.currentProductId];
    if (form.openDate)           fields['Open Date'] = form.openDate;
    if (form.annualFee !== '')   fields['Annual Fee Amount'] = parseFloat(form.annualFee);
    if (form.annualFeeMonth)     fields['Annual Fee Post Month'] = parseInt(form.annualFeeMonth);
    if (form.statementCloseDay)  fields['Statement Close Day'] = parseInt(form.statementCloseDay);
    if (form.last4)              fields['Last 4/Last 5 (AMEX)'] = form.last4;
    if (form.rewardsProgramId)   fields['Rewards Program'] = [form.rewardsProgramId];
    if (form.cancelRisk)         fields['Cancel Risk Level'] = form.cancelRisk;

    try {
      const newCard = await createRecord(PORTFOLIO_TABLE, fields);
      const newCardId = newCard.id;

      // Auto-generate perk instances for this card product
      let perksAdded = 0;
      if (form.currentProductId) {
        const filter = `FIND("${form.currentProductId}",ARRAYJOIN({Card Product}))`;
        const matchingDefs = await fetchTable(
          PERK_DEFINITIONS_TABLE,
          ['Perk Name', 'Card Product', 'Reset Cycle', 'Credit Amount', 'Priority Score', 'Benefit Type'],
          { filterByFormula: filter }
        );

        if (matchingDefs.length > 0) {

          const today = new Date();
          const instancePromises = [];
          for (const def of matchingDefs) {
            const cycle = def.fields['Reset Cycle'];
            const nextDate = cycle ? calculateNextResetDate(cycle, today) : null;
            const nextDateStr = nextDate ? toAirtableDate(nextDate) : null;
            const perkType = def.fields['Benefit Type'] === 'Value Only' ? 'Value Only' : 'Trackable';

            for (const personId of form.ownerIds) {
              const instanceFields = {
                'Perk Definition': [def.id],
                'Card': [newCardId],
                'Person': [personId],
                'Used': false,
                'Label': def.fields['Perk Name'] || '',
                'Perk Type': perkType,
              };
              if (nextDateStr) instanceFields['Next Reset Date'] = nextDateStr;
              if (def.fields['Credit Amount'] != null) instanceFields['Credit Amount'] = def.fields['Credit Amount'];
              if (def.fields['Priority Score'] != null) instanceFields['Priority Score'] = def.fields['Priority Score'];
              instancePromises.push(createRecord(PERK_INSTANCES_TABLE, instanceFields));
            }
          }
          const results = await Promise.allSettled(instancePromises);
          perksAdded = results.filter(r => r.status === 'fulfilled').length;
        }
      }

      const msg = perksAdded > 0
        ? `Card added successfully! ${perksAdded} perk${perksAdded > 1 ? 's' : ''} added automatically.`
        : 'Card added successfully!';
      setSuccessMsg(msg);
      setForm(EMPTY);
      setTimeout(() => setSuccessMsg(''), 7000);
    } catch (e) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (loadingProducts) {
    return <div style={{ color: '#9ca3af', padding: '2rem', fontSize: '0.9rem' }}>Loading card products…</div>;
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', maxWidth: 780 }}>

      {successMsg && (
        <div style={{ background: '#00E67622', border: '1px solid #00E676', borderRadius: 10, padding: '0.85rem 1rem', color: '#00E676', fontWeight: 600 }}>
          {successMsg}
        </div>
      )}
      {error && (
        <div style={{ background: '#FF4D4D22', border: '1px solid #FF4D4D', borderRadius: 10, padding: '0.85rem 1rem', color: '#FF4D4D' }}>
          {error}
        </div>
      )}

      {/* Step 1 — Owner */}
      <div style={card}>
        <div style={{ fontWeight: 700, color: '#fff', marginBottom: '0.85rem', fontSize: '0.9rem' }}>
          Owner <span style={{ color: '#FF4D4D' }}>*</span>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {Object.entries(PEOPLE).map(([id, name]) =>
            pillBtn(form.ownerIds.includes(id), () => toggleOwner(id), name)
          )}
        </div>
      </div>

      {/* Step 2 — Issuer */}
      <div style={card}>
        <div style={{ fontWeight: 700, color: '#fff', marginBottom: '0.85rem', fontSize: '0.9rem' }}>Issuer</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {allBanks.map(bank =>
            pillBtn(form.issuer === bank, () => selectIssuer(bank), bank)
          )}
        </div>
      </div>

      {/* Step 3 — Product (only shown after issuer selected) */}
      {form.issuer && (
        <div style={card}>
          <div style={{ fontWeight: 700, color: '#fff', marginBottom: '0.85rem', fontSize: '0.9rem' }}>
            {form.issuer} Card Product
          </div>
          <select style={inp} value={form.currentProductId} onChange={e => selectProduct(e.target.value)}>
            <option value="">— Select product —</option>
            {filteredProducts.map(p => (
              <option key={p.id} value={p.id}>{p.name} {p.fee > 0 ? `($${p.fee})` : '(No AF)'}</option>
            ))}
          </select>
        </div>
      )}

      {/* Card details — shown once product is selected */}
      {form.currentProductId && (
        <>
          {/* Card Name */}
          <div style={card}>
            <div style={{ fontWeight: 700, color: '#fff', marginBottom: '0.85rem', fontSize: '0.9rem' }}>
              Card Name <span style={{ color: '#FF4D4D' }}>*</span>
            </div>
            <input
              style={inp}
              value={form.cardName}
              onChange={e => setForm(prev => ({ ...prev, cardName: e.target.value }))}
              placeholder="Auto-generated — edit if needed"
            />
          </div>

          {/* Account details */}
          <div style={card}>
            <div style={{ fontWeight: 700, color: '#fff', marginBottom: '1rem', fontSize: '0.9rem' }}>Account Details</div>
            <div style={grid2}>
              <div>
                <label style={lbl}>Personal / Business</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  {['Personal', 'Business'].map(opt =>
                    pillBtn(form.personalBusiness === opt, () => setForm(p => ({ ...p, personalBusiness: opt })), opt)
                  )}
                </div>
              </div>
              <div>
                <label style={lbl}>Open Date</label>
                <input style={inp} type="date" value={form.openDate} onChange={e => setForm(p => ({ ...p, openDate: e.target.value }))} />
              </div>
              <div>
                <label style={lbl}>Last 4 Digits (Last 5 for Amex)</label>
                <input style={inp} type="number" value={form.last4} onChange={e => setForm(p => ({ ...p, last4: e.target.value }))} placeholder="1234" />
              </div>
              <div>
                <label style={lbl}>Statement Close Day</label>
                <input style={inp} type="number" value={form.statementCloseDay} onChange={e => setForm(p => ({ ...p, statementCloseDay: e.target.value }))} placeholder="1–31" min={1} max={31} />
              </div>
            </div>
          </div>

          {/* Annual Fee */}
          <div style={card}>
            <div style={{ fontWeight: 700, color: '#fff', marginBottom: '1rem', fontSize: '0.9rem' }}>Annual Fee</div>
            <div style={grid2}>
              <div>
                <label style={lbl}>Annual Fee Amount ($)</label>
                <input style={inp} type="number" value={form.annualFee} onChange={e => setForm(p => ({ ...p, annualFee: e.target.value }))} placeholder="0" min={0} />
              </div>
              <div>
                <label style={lbl}>Annual Fee Post Month</label>
                <select style={inp} value={form.annualFeeMonth} onChange={e => setForm(p => ({ ...p, annualFeeMonth: e.target.value }))}>
                  <option value="">— Select month —</option>
                  {MONTHS.map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* Rewards & Risk */}
          <div style={card}>
            <div style={{ fontWeight: 700, color: '#fff', marginBottom: '1rem', fontSize: '0.9rem' }}>Rewards & Risk</div>
            <div style={grid2}>
              <div>
                <label style={lbl}>Rewards Program</label>
                <select style={inp} value={form.rewardsProgramId} onChange={e => setForm(p => ({ ...p, rewardsProgramId: e.target.value }))}>
                  <option value="">— None —</option>
                  {rewardsPrograms.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
              </div>
              <div>
                <label style={lbl}>Cancel Risk Level</label>
                <select style={inp} value={form.cancelRisk} onChange={e => setForm(p => ({ ...p, cancelRisk: e.target.value }))}>
                  {RISK_LEVELS.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div>
                <label style={lbl}>Status</label>
                <select style={inp} value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value }))}>
                  <option value="Active">Active</option>
                  <option value="Closed">Closed</option>
                </select>
              </div>
            </div>
          </div>

          <button type="submit" disabled={submitting} style={{
            padding: '0.85rem 2rem', borderRadius: 10, border: 'none',
            background: submitting ? 'rgba(0,212,255,0.4)' : '#00D4FF',
            color: '#0B1220', fontWeight: 700, fontSize: '0.95rem',
            cursor: submitting ? 'not-allowed' : 'pointer', alignSelf: 'flex-start',
          }}>
            {submitting ? 'Saving…' : 'Add Card'}
          </button>
        </>
      )}

    </form>
  );
}
