import { useState, useEffect } from 'react';
import { updateRecord } from '../services/airtable.js';
import { PORTFOLIO_TABLE } from '../config/tables.js';
import { PEOPLE } from '../config/constants.js';
import { stripOwnerPrefix } from '../utils/format.js';

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

const cardStyle = {
  background: '#111a2b', borderRadius: 12, border: '1px solid rgba(255,255,255,0.08)',
  padding: '1.25rem 1.5rem',
};

export function AddAuthorizedUserPanel({ cards, personNameById, onClose, onSaved }) {
  const [mounted, setMounted] = useState(false);
  const [ownerId, setOwnerId] = useState('');
  const [cardId, setCardId] = useState('');
  const [auId, setAuId] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    const frame = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  function handleClose() {
    setMounted(false);
    setTimeout(onClose, 200);
  }

  function selectOwner(id) {
    setOwnerId(prev => (prev === id ? '' : id));
    setCardId('');
    setAuId('');
    setError(null);
  }

  function selectCard(id) {
    setCardId(prev => (prev === id ? '' : id));
    setAuId('');
    setError(null);
  }

  const ownerCards = ownerId
    ? cards
        .filter(c => (c.fields['Owner'] || []).includes(ownerId))
        .sort((a, b) => (a.fields['Card Name'] || '').localeCompare(b.fields['Card Name'] || ''))
    : [];

  const selectedCard = cards.find(c => c.id === cardId) || null;
  const existingAUIds = selectedCard ? (selectedCard.fields['Authorized Users'] || []) : [];
  const auCandidates = Object.entries(PEOPLE).filter(([id]) => id !== ownerId && !existingAUIds.includes(id));

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    if (!ownerId) { setError('Select the card owner.'); return; }
    if (!cardId) { setError('Select a card.'); return; }
    if (!auId) { setError('Select the person to add as an Authorized User.'); return; }

    setSaving(true);
    try {
      const updatedAUs = [...existingAUIds, auId];
      await updateRecord(PORTFOLIO_TABLE, cardId, { 'Authorized Users': updatedAUs });
      const cardLabel = stripOwnerPrefix(selectedCard.fields['Card Name'], PEOPLE[ownerId]) || 'this card';
      setSuccessMsg(`${PEOPLE[auId]} added as an Authorized User on ${cardLabel}.`);
      setTimeout(() => onSaved(), 1100);
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
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
          <div style={{ fontSize: '1.3rem', fontWeight: 700, color: '#fff' }}>Add Authorized User</div>
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

        <form onSubmit={handleSubmit} style={{ flex: 1, overflowY: 'auto', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
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
              {/* Step 1 — Owner */}
              <div style={cardStyle}>
                <div style={{ fontWeight: 700, color: '#fff', marginBottom: '0.85rem', fontSize: '0.9rem' }}>
                  Card Owner <span style={{ color: '#FF4D4D' }}>*</span>
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {Object.entries(PEOPLE).map(([id, name]) => (
                    <PillBtn key={id} active={ownerId === id} onClick={() => selectOwner(id)}>{name}</PillBtn>
                  ))}
                </div>
              </div>

              {/* Step 2 — Card */}
              {ownerId && (
                <div style={cardStyle}>
                  <div style={{ fontWeight: 700, color: '#fff', marginBottom: '0.85rem', fontSize: '0.9rem' }}>
                    Card <span style={{ color: '#FF4D4D' }}>*</span>
                  </div>
                  {ownerCards.length === 0 ? (
                    <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.85rem' }}>
                      No active cards found for {PEOPLE[ownerId]}.
                    </div>
                  ) : (
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {ownerCards.map(c => (
                        <PillBtn key={c.id} active={cardId === c.id} onClick={() => selectCard(c.id)}>
                          {stripOwnerPrefix(c.fields['Card Name'], PEOPLE[ownerId]) || c.id}
                        </PillBtn>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Step 3 — Authorized User */}
              {cardId && (
                <div style={cardStyle}>
                  <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)', marginBottom: '0.85rem' }}>
                    Current Authorized Users: {existingAUIds.length
                      ? existingAUIds.map(id => personNameById[id] || PEOPLE[id] || id).join(', ')
                      : 'None'}
                  </div>
                  <div style={{ fontWeight: 700, color: '#fff', marginBottom: '0.85rem', fontSize: '0.9rem' }}>
                    Authorized User to Add <span style={{ color: '#FF4D4D' }}>*</span>
                  </div>
                  {auCandidates.length === 0 ? (
                    <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.85rem' }}>
                      Everyone is already an Authorized User on this card.
                    </div>
                  ) : (
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {auCandidates.map(([id, name]) => (
                        <PillBtn key={id} active={auId === id} onClick={() => setAuId(prev => (prev === id ? '' : id))}>
                          {name}
                        </PillBtn>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <button type="submit" disabled={saving || !ownerId || !cardId || !auId} style={{
                padding: '0.85rem 2rem', borderRadius: 10, border: 'none',
                background: saving || !ownerId || !cardId || !auId ? 'rgba(0,212,255,0.4)' : '#00D4FF',
                color: '#0B1220', fontWeight: 700, fontSize: '0.95rem',
                cursor: saving || !ownerId || !cardId || !auId ? 'not-allowed' : 'pointer', alignSelf: 'flex-start',
              }}>
                {saving ? 'Saving…' : 'Add Authorized User'}
              </button>
            </>
          )}
        </form>
      </div>
    </>
  );
}
