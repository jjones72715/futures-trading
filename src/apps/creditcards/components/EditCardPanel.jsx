import { useState, useEffect } from 'react';
import { getRecord, updateRecord, fetchTable } from '../services/airtable.js';
import { PORTFOLIO_TABLE, CARD_PRODUCTS_TABLE, BANKS_TABLE } from '../config/tables.js';
import { PEOPLE } from '../config/constants.js';

const RISK_LEVELS = ['Low', 'Medium', 'High'];

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
const cardStyle = {
  background: '#111a2b', borderRadius: 12, border: '1px solid rgba(255,255,255,0.08)',
  padding: '1.25rem 1.5rem',
};
const grid2 = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' };

function PillBtn({ active, onClick, children }) {
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

export function EditCardPanel({ cardId, onClose, onSaved }) {
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState([]);
  const [form, setForm] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [error, setError] = useState(null);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    Promise.all([
      getRecord(PORTFOLIO_TABLE, cardId),
      fetchTable(CARD_PRODUCTS_TABLE, ['Product Name', 'Annual Fee', 'Issuer']),
      fetchTable(BANKS_TABLE, ['Bank Name']),
    ]).then(([card, productRecords, bankRecords]) => {
      if (cancelled) return;
      const bankMap = {};
      bankRecords.forEach(r => { bankMap[r.id] = r.fields['Bank Name']; });

      const mapped = productRecords
        .map(r => {
          const issuerId = r.fields['Issuer']?.[0];
          return {
            id: r.id,
            name: r.fields['Product Name'] || '',
            fee: r.fields['Annual Fee'] ?? 0,
            bank: bankMap[issuerId] || '',
            bankId: issuerId || '',
          };
        })
        .filter(p => p.name && p.bank)
        .sort((a, b) => a.name.localeCompare(b.name));
      setProducts(mapped);

      const f = card.fields;
      const issuerId = (f['Issuer'] || [])[0] || '';
      setForm({
        ownerIds: f['Owner'] || [],
        issuer: bankMap[issuerId] || '',
        currentProductId: (f['Current Product'] || [])[0] || '',
        cardName: f['Card Name'] || '',
        openDate: f['Open Date'] || '',
        annualFee: f['Annual Fee Amount'] != null ? String(f['Annual Fee Amount']) : '',
        statementCloseDay: f['Statement Close Day'] != null ? String(f['Statement Close Day']) : '',
        last4: f['Last 4/Last 5 (AMEX)'] || '',
        cancelRisk: f['Cancel Risk Level'] || 'Low',
        status: f['Status'] || 'Active',
      });
    })
      .catch(e => { if (!cancelled) setError(e.message); })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [cardId]);

  function handleClose() {
    setMounted(false);
    setTimeout(onClose, 200);
  }

  const allBanks = [...new Set(products.map(p => p.bank))].sort();
  const filteredProducts = form?.issuer ? products.filter(p => p.bank === form.issuer) : [];

  function toggleOwner(id) {
    setForm(prev => ({
      ...prev,
      ownerIds: prev.ownerIds.includes(id) ? prev.ownerIds.filter(i => i !== id) : [...prev.ownerIds, id],
    }));
  }

  function selectIssuer(bank) {
    setForm(prev => ({
      ...prev,
      issuer: bank === prev.issuer ? '' : bank,
      currentProductId: '',
    }));
  }

  function selectProduct(productId) {
    const product = products.find(p => p.id === productId);
    setForm(prev => ({
      ...prev,
      currentProductId: productId,
      annualFee: product ? String(product.fee) : prev.annualFee,
    }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    if (!form.cardName.trim()) { setError('Card Name is required.'); return; }
    if (form.ownerIds.length === 0) { setError('Select at least one Owner.'); return; }

    setSubmitting(true);
    const selectedProduct = products.find(p => p.id === form.currentProductId);
    const fields = {
      'Card Name': form.cardName.trim(),
      'Status': form.status,
      'Owner': form.ownerIds,
      'Issuer': selectedProduct?.bankId ? [selectedProduct.bankId] : [],
      'Current Product': form.currentProductId ? [form.currentProductId] : [],
      'Annual Fee Amount': form.annualFee !== '' ? parseFloat(form.annualFee) : 0,
      'Statement Close Day': form.statementCloseDay ? parseInt(form.statementCloseDay, 10) : null,
      'Last 4/Last 5 (AMEX)': form.last4 || '',
      'Cancel Risk Level': form.cancelRisk,
    };
    if (form.openDate) {
      fields['Open Date'] = form.openDate;
      fields['Annual Fee Post Month'] = parseInt(form.openDate.split('-')[1], 10);
    }

    try {
      await updateRecord(PORTFOLIO_TABLE, cardId, fields);
      setSuccessMsg('Card updated successfully!');
      setTimeout(() => onSaved(), 900);
    } catch (e) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  }

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
        position: 'fixed', top: 0, right: 0, bottom: 0, width: '40%', minWidth: 440, maxWidth: '90vw',
        background: '#172033', borderLeft: '1px solid #1E2D45', zIndex: 41,
        transform: mounted ? 'translateX(0)' : 'translateX(100%)',
        transition: 'transform 0.22s ease', boxShadow: '-12px 0 32px rgba(0,0,0,0.4)',
        display: 'flex', flexDirection: 'column',
      }}>
        <div style={{
          padding: '1.25rem 1.5rem', borderBottom: '1px solid #1E2D45',
          display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem',
        }}>
          <div style={{ fontSize: '1.3rem', fontWeight: 700, color: '#fff' }}>Edit Card</div>
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

        <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem' }}>
          {loading || !form ? (
            <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.9rem' }}>Loading card…</div>
          ) : (
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

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

              {!successMsg && (
                <>
                  <div style={cardStyle}>
                    <div style={{ fontWeight: 700, color: '#fff', marginBottom: '0.85rem', fontSize: '0.9rem' }}>
                      Owner <span style={{ color: '#FF4D4D' }}>*</span>
                    </div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {Object.entries(PEOPLE).map(([id, name]) => (
                        <PillBtn key={id} active={form.ownerIds.includes(id)} onClick={() => toggleOwner(id)}>{name}</PillBtn>
                      ))}
                    </div>
                  </div>

                  <div style={cardStyle}>
                    <div style={{ fontWeight: 700, color: '#fff', marginBottom: '0.85rem', fontSize: '0.9rem' }}>Issuer</div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {allBanks.map(bank => (
                        <PillBtn key={bank} active={form.issuer === bank} onClick={() => selectIssuer(bank)}>{bank}</PillBtn>
                      ))}
                    </div>
                  </div>

                  {form.issuer && (
                    <div style={cardStyle}>
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

                  <div style={cardStyle}>
                    <div style={{ fontWeight: 700, color: '#fff', marginBottom: '0.85rem', fontSize: '0.9rem' }}>
                      Card Name <span style={{ color: '#FF4D4D' }}>*</span>
                    </div>
                    <input
                      style={inp}
                      value={form.cardName}
                      onChange={e => setForm(prev => ({ ...prev, cardName: e.target.value }))}
                    />
                  </div>

                  <div style={cardStyle}>
                    <div style={{ fontWeight: 700, color: '#fff', marginBottom: '1rem', fontSize: '0.9rem' }}>Account Details</div>
                    <div style={grid2}>
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
                    <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.35)', marginTop: 12 }}>
                      Personal / Business is pulled automatically from the card product and can't be edited here.
                    </div>
                  </div>

                  <div style={cardStyle}>
                    <div style={{ fontWeight: 700, color: '#fff', marginBottom: '1rem', fontSize: '0.9rem' }}>Annual Fee</div>
                    <div>
                      <label style={lbl}>Annual Fee Amount ($)</label>
                      <input style={inp} type="number" value={form.annualFee} onChange={e => setForm(p => ({ ...p, annualFee: e.target.value }))} placeholder="0" min={0} />
                      {form.openDate && (
                        <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.35)', marginTop: 6 }}>
                          Posts every {new Date(form.openDate + 'T00:00:00').toLocaleString('en-US', { month: 'long' })}, based on the Open Date above.
                        </div>
                      )}
                    </div>
                  </div>

                  <div style={cardStyle}>
                    <div style={{ fontWeight: 700, color: '#fff', marginBottom: '1rem', fontSize: '0.9rem' }}>Risk & Status</div>
                    <div style={grid2}>
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
                    {submitting ? 'Saving…' : 'Save Changes'}
                  </button>
                </>
              )}
            </form>
          )}
        </div>
      </div>
    </>
  );
}
