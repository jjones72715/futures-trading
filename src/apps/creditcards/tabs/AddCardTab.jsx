import { useState, useEffect } from 'react';
import { fetchTable, createRecord } from '../services/airtable.js';
import { PORTFOLIO_TABLE, REWARDS_TABLE, CARD_PRODUCTS_TABLE } from '../config/tables.js';
import { PEOPLE } from '../config/constants.js';

const ISSUERS = ['American Express', 'Barclays', 'Capital One', 'Chase', 'Citi'];
const RISK_LEVELS = ['Low', 'Medium', 'High'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const EMPTY = {
  cardName: '', issuer: '', personalBusiness: 'Personal',
  openDate: '', annualFee: '', annualFeeMonth: '', statementCloseDay: '',
  last4: '', rewardsProgramId: '', currentProductId: '',
  cancelRisk: 'Low', status: 'Active', ownerIds: [],
};

const input = {
  width: '100%', background: '#0B1220', border: '1px solid rgba(255,255,255,0.12)',
  borderRadius: 8, padding: '0.6rem 0.75rem', color: '#fff', fontSize: '0.88rem',
  outline: 'none', boxSizing: 'border-box',
};
const label = {
  display: 'block', fontSize: '0.7rem', fontWeight: 600,
  color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase',
  letterSpacing: '0.05em', marginBottom: 5,
};
const section = {
  background: '#172033', borderRadius: 12, border: '1px solid rgba(255,255,255,0.08)',
  padding: '1.25rem 1.5rem',
};
const grid2 = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' };

export function AddCardTab() {
  const [form, setForm] = useState(EMPTY);
  const [rewards, setRewards] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    Promise.all([
      fetchTable(REWARDS_TABLE, ['Name']),
      fetchTable(CARD_PRODUCTS_TABLE, ['Product Name']),
    ])
      .then(([recs, prods]) => {
        setRewards(
          recs.map(r => ({ id: r.id, name: r.fields['Name'] }))
              .sort((a, b) => a.name.localeCompare(b.name))
        );
        setProducts(
          prods.map(p => ({ id: p.id, name: p.fields['Product Name'] }))
               .sort((a, b) => a.name.localeCompare(b.name))
        );
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  function set(field, value) {
    setForm(prev => ({ ...prev, [field]: value }));
  }

  function toggleOwner(id) {
    setForm(prev => ({
      ...prev,
      ownerIds: prev.ownerIds.includes(id)
        ? prev.ownerIds.filter(i => i !== id)
        : [...prev.ownerIds, id],
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
    if (form.issuer)              fields['Issuer'] = form.issuer;
    if (form.personalBusiness)    fields['Personal/Business'] = form.personalBusiness;
    if (form.openDate)            fields['Open Date'] = form.openDate;
    if (form.annualFee !== '')    fields['Annual Fee Amount'] = parseFloat(form.annualFee);
    if (form.annualFeeMonth)      fields['Annual Fee Post Month'] = parseInt(form.annualFeeMonth);
    if (form.statementCloseDay)   fields['Statement Close Day'] = parseInt(form.statementCloseDay);
    if (form.last4)               fields['Last 4/Last 5 (AMEX)'] = parseInt(form.last4);
    if (form.rewardsProgramId)    fields['Rewards Program'] = [form.rewardsProgramId];
    if (form.currentProductId)    fields['Current Product'] = [form.currentProductId];
    if (form.cancelRisk)          fields['Cancel Risk Level'] = form.cancelRisk;

    try {
      await createRecord(PORTFOLIO_TABLE, fields);
      setSuccess(true);
      setForm(EMPTY);
      setTimeout(() => setSuccess(false), 5000);
    } catch (e) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div style={{ padding: '3rem', textAlign: 'center', color: 'rgba(255,255,255,0.4)' }}>
        Loading form data…
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', maxWidth: 760 }}>

      {success && (
        <div style={{ background: '#00E67622', border: '1px solid #00E676', borderRadius: 10, padding: '0.85rem 1rem', color: '#00E676', fontWeight: 600 }}>
          Card added successfully!
        </div>
      )}
      {error && (
        <div style={{ background: '#FF4D4D22', border: '1px solid #FF4D4D', borderRadius: 10, padding: '0.85rem 1rem', color: '#FF4D4D' }}>
          {error}
        </div>
      )}

      {/* Card Identity */}
      <div style={section}>
        <div style={{ fontWeight: 700, color: '#fff', marginBottom: '1rem', fontSize: '0.9rem' }}>Card Identity</div>
        <div style={{ marginBottom: '1rem' }}>
          <label style={label}>Card Name <span style={{ color: '#FF4D4D' }}>*</span></label>
          <input style={input} value={form.cardName} onChange={e => set('cardName', e.target.value)} placeholder="e.g. Chase Sapphire Preferred" />
        </div>
        <div style={grid2}>
          <div>
            <label style={label}>Current Product</label>
            <select style={input} value={form.currentProductId} onChange={e => set('currentProductId', e.target.value)}>
              <option value="">— Select product —</option>
              {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div>
            <label style={label}>Issuer</label>
            <select style={input} value={form.issuer} onChange={e => set('issuer', e.target.value)}>
              <option value="">— Select issuer —</option>
              {ISSUERS.map(i => <option key={i} value={i}>{i}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label style={label}>Personal / Business</label>
          <div style={{ display: 'flex', gap: 10 }}>
            {['Personal', 'Business'].map(opt => (
              <button key={opt} type="button" onClick={() => set('personalBusiness', opt)} style={{
                padding: '6px 20px', borderRadius: 20, border: '1px solid rgba(255,255,255,0.12)',
                background: form.personalBusiness === opt ? '#00D4FF' : 'rgba(255,255,255,0.06)',
                color: form.personalBusiness === opt ? '#0B1220' : 'rgba(255,255,255,0.6)',
                fontWeight: form.personalBusiness === opt ? 700 : 400, cursor: 'pointer', fontSize: '0.85rem',
              }}>
                {opt}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Account Details */}
      <div style={section}>
        <div style={{ fontWeight: 700, color: '#fff', marginBottom: '1rem', fontSize: '0.9rem' }}>Account Details</div>
        <div style={grid2}>
          <div>
            <label style={label}>Open Date</label>
            <input style={input} type="date" value={form.openDate} onChange={e => set('openDate', e.target.value)} />
          </div>
          <div>
            <label style={label}>Last 4 Digits (Last 5 for Amex)</label>
            <input style={input} type="number" value={form.last4} onChange={e => set('last4', e.target.value)} placeholder="1234" maxLength={5} />
          </div>
          <div>
            <label style={label}>Statement Close Day</label>
            <input style={input} type="number" value={form.statementCloseDay} onChange={e => set('statementCloseDay', e.target.value)} placeholder="1–31" min={1} max={31} />
          </div>
        </div>
      </div>

      {/* Annual Fee */}
      <div style={section}>
        <div style={{ fontWeight: 700, color: '#fff', marginBottom: '1rem', fontSize: '0.9rem' }}>Annual Fee</div>
        <div style={grid2}>
          <div>
            <label style={label}>Annual Fee Amount ($)</label>
            <input style={input} type="number" value={form.annualFee} onChange={e => set('annualFee', e.target.value)} placeholder="0" min={0} step={1} />
          </div>
          <div>
            <label style={label}>Annual Fee Post Month</label>
            <select style={input} value={form.annualFeeMonth} onChange={e => set('annualFeeMonth', e.target.value)}>
              <option value="">— Select month —</option>
              {MONTHS.map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Rewards & Risk */}
      <div style={section}>
        <div style={{ fontWeight: 700, color: '#fff', marginBottom: '1rem', fontSize: '0.9rem' }}>Rewards & Risk</div>
        <div style={grid2}>
          <div>
            <label style={label}>Rewards Program</label>
            <select style={input} value={form.rewardsProgramId} onChange={e => set('rewardsProgramId', e.target.value)}>
              <option value="">— Select program —</option>
              {rewards.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </div>
          <div>
            <label style={label}>Cancel Risk Level</label>
            <select style={input} value={form.cancelRisk} onChange={e => set('cancelRisk', e.target.value)}>
              {RISK_LEVELS.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div>
            <label style={label}>Status</label>
            <select style={input} value={form.status} onChange={e => set('status', e.target.value)}>
              <option value="Active">Active</option>
              <option value="Closed">Closed</option>
            </select>
          </div>
        </div>
      </div>

      {/* Owner */}
      <div style={section}>
        <div style={{ fontWeight: 700, color: '#fff', marginBottom: '1rem', fontSize: '0.9rem' }}>
          Owner <span style={{ color: '#FF4D4D' }}>*</span>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {Object.entries(PEOPLE).map(([id, name]) => {
            const active = form.ownerIds.includes(id);
            return (
              <button key={id} type="button" onClick={() => toggleOwner(id)} style={{
                padding: '6px 20px', borderRadius: 20, border: '1px solid rgba(255,255,255,0.12)',
                background: active ? '#00D4FF' : 'rgba(255,255,255,0.06)',
                color: active ? '#0B1220' : 'rgba(255,255,255,0.6)',
                fontWeight: active ? 700 : 400, cursor: 'pointer', fontSize: '0.85rem',
              }}>
                {name}
              </button>
            );
          })}
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

    </form>
  );
}
