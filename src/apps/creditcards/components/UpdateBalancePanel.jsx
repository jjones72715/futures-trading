import { useState, useEffect } from 'react';
import { updateRecord } from '../services/airtable.js';
import { POINT_BALANCES_TABLE } from '../config/tables.js';
import { PEOPLE } from '../config/constants.js';
import { toAirtableDate } from '../utils/dates.js';

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

export function UpdateBalancePanel({ balance, portfolioNameById, portfolioRecords, onClose, onSaved }) {
  const [mounted, setMounted] = useState(false);
  const [currentBalance, setCurrentBalance] = useState(String(balance.currentBalance ?? ''));
  const [expirationDate, setExpirationDate] = useState(balance.expirationDate || '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  function handleClose() {
    setMounted(false);
    setTimeout(onClose, 200);
  }

  const ownerNames = balance.ownerIds.map(id => PEOPLE[id] || id).join(', ') || '—';

  // Recomputed from current Portfolio data (not the balance's stored value) so
  // this always reflects live eligibility and gets re-saved to stay in sync.
  const ownerId = balance.ownerIds[0];
  const eligibleCards = portfolioRecords.filter(c =>
    c.fields['Status'] === 'Active' &&
    (c.fields['Owner'] || []).includes(ownerId) &&
    (c.fields['Rewards Program'] || []).includes(balance.programId)
  );
  const cardNames = eligibleCards.map(c => c.fields['Card Name'] || portfolioNameById[c.id] || c.id);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    if (currentBalance === '' || isNaN(parseFloat(currentBalance))) {
      setError('Enter a valid balance.');
      return;
    }
    setSubmitting(true);
    try {
      const fields = {
        'Current Balance': parseFloat(currentBalance),
        'Last Updated': toAirtableDate(new Date()),
        'Credit Card Portfolio': eligibleCards.map(c => c.id),
      };
      if (expirationDate) fields['Expiration Date'] = expirationDate;
      const updated = await updateRecord(POINT_BALANCES_TABLE, balance.id, fields);
      onSaved(updated);
      handleClose();
    } catch (err) {
      setError(String(err.message || err));
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
          <div>
            <div style={{ fontSize: '1.3rem', fontWeight: 700, color: '#fff' }}>{balance.programName}</div>
            <div style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.5)', marginTop: 2 }}>{ownerNames}</div>
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

        <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem' }}>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

            {error && (
              <div style={{ background: '#FF4D4D22', border: '1px solid #FF4D4D', borderRadius: 10, padding: '0.85rem 1rem', color: '#FF4D4D' }}>
                {error}
              </div>
            )}

            <div style={cardStyle}>
              <div style={{ fontWeight: 700, color: '#fff', marginBottom: '1rem', fontSize: '0.9rem' }}>Balance</div>
              <label style={lbl}>Current Balance</label>
              <input style={inp} type="number" min="0" autoFocus value={currentBalance} onChange={e => setCurrentBalance(e.target.value)} />
            </div>

            <div style={cardStyle}>
              <div style={{ fontWeight: 700, color: '#fff', marginBottom: '1rem', fontSize: '0.9rem' }}>Expiration Date</div>
              <input style={inp} type="date" value={expirationDate} onChange={e => setExpirationDate(e.target.value)} />
            </div>

            <div style={cardStyle}>
              <div style={{ fontWeight: 700, color: '#fff', marginBottom: '0.85rem', fontSize: '0.9rem' }}>Linked Cards</div>
              {cardNames.length === 0 ? (
                <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.85rem' }}>
                  No cards linked to this balance.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {cardNames.map((name, i) => (
                    <div key={i} style={{
                      padding: '0.5rem 0.75rem', borderRadius: 8, background: '#0B1220',
                      border: '1px solid rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.75)', fontSize: '0.85rem',
                    }}>
                      {name}
                    </div>
                  ))}
                </div>
              )}
              <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.35)', marginTop: '0.75rem' }}>
                Linked automatically from cards that earn this program. Not editable here.
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

          </form>
        </div>
      </div>
    </>
  );
}
