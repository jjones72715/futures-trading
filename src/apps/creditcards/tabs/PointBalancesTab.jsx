import { useState, useEffect } from 'react';
import { fetchTable, updateRecord } from '../services/airtable.js';
import { REWARDS_TABLE, CARD_PRODUCTS_TABLE, PORTFOLIO_TABLE, POINT_BALANCES_TABLE } from '../config/tables.js';
import { PEOPLE } from '../config/constants.js';
import { isStaleDays, toAirtableDate } from '../utils/dates.js';

const PERSON_ID_BY_NAME = Object.fromEntries(Object.entries(PEOPLE).map(([id, name]) => [name, id]));

function fmt(n) {
  if (n == null) return '—';
  return n.toLocaleString();
}

function fmtDollar(n) {
  if (n == null) return '—';
  return `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtVPP(n) {
  if (!n) return '—';
  return `${(n * 100).toFixed(2)}¢`;
}

function fmtDate(dateStr) {
  if (!dateStr) return '—';
  const [y, m, d] = dateStr.split('-');
  return `${parseInt(m)}/${parseInt(d)}/${y}`;
}

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

function ProgramBadge({ name }) {
  return (
    <span style={{ color: '#fff', fontWeight: 700, fontSize: '0.85rem' }}>
      {name}
    </span>
  );
}

const cardStyle = {
  background: '#172033', borderRadius: 12, border: '1px solid rgba(255,255,255,0.08)', padding: '1rem 1.5rem',
};

const inp = {
  width: '100%', background: '#0B1220', border: '1px solid rgba(255,255,255,0.12)',
  borderRadius: 6, padding: '0.35rem 0.5rem', color: '#fff', fontSize: '0.82rem',
  outline: 'none', boxSizing: 'border-box',
};

export function PointBalancesTab({ onNavigateAddBalance }) {
  const [view, setView] = useState('balances');
  const [loading, setLoading] = useState(true);
  const [programs, setPrograms] = useState([]);
  const [cardProductNameById, setCardProductNameById] = useState({});
  const [portfolioNameById, setPortfolioNameById] = useState({});
  const [portfolioRecords, setPortfolioRecords] = useState([]);
  const [balances, setBalances] = useState([]);
  const [personFilter, setPersonFilter] = useState('All');
  const [balancesOnly, setBalancesOnly] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [editBalance, setEditBalance] = useState('');
  const [editExpiration, setEditExpiration] = useState('');
  const [editCardIds, setEditCardIds] = useState([]);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);

  useEffect(() => {
    load();
  }, []);

  function load() {
    setLoading(true);
    return Promise.all([
      fetchTable(REWARDS_TABLE, ['Program Name', 'Value Per Point', 'Expiration Policy', 'Transfer Partners', 'Card Products']),
      fetchTable(CARD_PRODUCTS_TABLE, ['Product Name']),
      fetchTable(PORTFOLIO_TABLE, ['Card Name', 'Owner', 'Rewards Program', 'Status']),
      fetchTable(POINT_BALANCES_TABLE, ['Person', 'Program', 'Current Balance', 'Value Per Point', 'Program Value', 'Credit Card Portfolio', 'Last Updated', 'Expiration Date', 'Days Until Expiration']),
    ])
      .then(([programRows, cardProductRows, portfolioRows, balanceRows]) => {
        setPrograms(programRows);
        setCardProductNameById(Object.fromEntries(cardProductRows.map(r => [r.id, r.fields['Product Name'] || r.id])));
        setPortfolioNameById(Object.fromEntries(portfolioRows.map(r => [r.id, r.fields['Card Name'] || r.id])));
        setPortfolioRecords(portfolioRows);
        setBalances(balanceRows);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }

  function startEdit(row) {
    setSaveError(null);
    setEditingId(row.id);
    setEditBalance(row.currentBalance != null ? String(row.currentBalance) : '');
    setEditExpiration(row.expirationDate || '');
    setEditCardIds(row.cardIds || []);
  }

  function cancelEdit() {
    setEditingId(null);
    setSaveError(null);
  }

  function toggleEditCard(id) {
    setEditCardIds(prev => (prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]));
  }

  async function saveEdit(row) {
    setSaveError(null);
    if (editBalance === '' || isNaN(parseFloat(editBalance))) {
      setSaveError('Enter a valid balance.');
      return;
    }
    setSaving(true);
    try {
      const fields = {
        'Current Balance': parseFloat(editBalance),
        'Last Updated': toAirtableDate(new Date()),
        'Credit Card Portfolio': editCardIds,
      };
      if (editExpiration) fields['Expiration Date'] = editExpiration;
      const updated = await updateRecord(POINT_BALANCES_TABLE, row.id, fields);
      setBalances(prev => prev.map(b => (b.id === row.id ? updated : b)));
      setEditingId(null);
    } catch (err) {
      setSaveError(String(err.message || err));
    } finally {
      setSaving(false);
    }
  }

  const programById = Object.fromEntries(programs.map(p => [p.id, p]));

  const enrichedPrograms = programs
    .map((p, i) => ({
      id: p.id,
      programName: p.fields['Program Name'] || '—',
      valuePerPoint: p.fields['Value Per Point'] ?? null,
      expirationPolicy: p.fields['Expiration Policy'] || '',
      transferPartnerIds: p.fields['Transfer Partners'] || [],
      cardProductIds: p.fields['Card Products'] || [],
      colorIndex: i,
    }));

  const enrichedBalances = balances.map(b => {
    const programId = (b.fields['Program'] || [])[0];
    const program = programById[programId];
    // "Value Per Point" is an Airtable lookup field, which the REST API always
    // returns as an array even though each balance links to a single program.
    const valuePerPointLookup = b.fields['Value Per Point'];
    const valuePerPoint = Array.isArray(valuePerPointLookup) ? valuePerPointLookup[0] ?? null : valuePerPointLookup ?? null;
    const currentBalance = b.fields['Current Balance'] ?? 0;
    return {
      id: b.id,
      programId,
      programName: program?.fields['Program Name'] || '—',
      ownerIds: b.fields['Person'] || [],
      currentBalance,
      valuePerPoint,
      programValue: b.fields['Program Value'] ?? null,
      cardIds: b.fields['Credit Card Portfolio'] || [],
      lastUpdated: b.fields['Last Updated'] || '',
      expirationDate: b.fields['Expiration Date'] || '',
      daysUntilExpiration: b.fields['Days Until Expiration'] ?? null,
    };
  });

  // --- Programs view ---
  const programValueByName = {};
  for (const b of enrichedBalances) {
    programValueByName[b.programName] = (programValueByName[b.programName] ?? 0) + (b.programValue ?? 0);
  }
  const programsSorted = [...enrichedPrograms].sort(
    (a, b) => (programValueByName[b.programName] ?? 0) - (programValueByName[a.programName] ?? 0)
  );
  const totalPortfolioValue = enrichedBalances.reduce((s, r) => s + (r.programValue ?? 0), 0);
  const totalProgramsTracked = enrichedPrograms.length;

  // --- Balances view ---
  const filteredBalances = enrichedBalances.filter(r => {
    if (personFilter !== 'All') {
      const personId = PERSON_ID_BY_NAME[personFilter];
      if (!r.ownerIds.includes(personId)) return false;
    }
    if (balancesOnly && !(r.currentBalance > 0)) return false;
    return true;
  });
  const balancesSorted = [...filteredBalances].sort((a, b) => (b.programValue ?? 0) - (a.programValue ?? 0));
  const totalBalanceValue = enrichedBalances
    .filter(r => r.currentBalance > 0)
    .reduce((s, r) => s + (r.programValue ?? 0), 0);
  const programsWithBalance = enrichedBalances.filter(r => r.currentBalance > 0).length;

  if (loading) {
    return (
      <div style={{ padding: '3rem', textAlign: 'center', color: 'rgba(255,255,255,0.4)' }}>
        Loading…
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', maxWidth: 1350 }}>

      {/* View toggle */}
      <div style={{ display: 'flex', gap: 8 }}>
        <PillBtn active={view === 'programs'} onClick={() => setView('programs')}>Programs</PillBtn>
        <PillBtn active={view === 'balances'} onClick={() => setView('balances')}>Balances</PillBtn>
      </div>

      {view === 'programs' ? (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, auto)', gap: '1rem', width: 'fit-content' }}>
            <div style={cardStyle}>
              <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600, marginBottom: 4 }}>
                Total Programs Tracked
              </div>
              <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#fff', lineHeight: 1 }}>
                {totalProgramsTracked}
              </div>
            </div>
            <div style={cardStyle}>
              <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600, marginBottom: 4 }}>
                Total Portfolio Value
              </div>
              <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#00E676', lineHeight: 1 }}>
                {fmtDollar(totalPortfolioValue)}
              </div>
            </div>
          </div>

          {programsSorted.length === 0 ? (
            <div style={{ ...cardStyle, padding: '3rem', color: 'rgba(255,255,255,0.35)', textAlign: 'center' }}>
              No rewards programs found.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <div style={{
                display: 'grid', gridTemplateColumns: '1.6fr 1fr 1.8fr 1.6fr 1.8fr', gap: '0.75rem',
                padding: '0.5rem 1rem', fontSize: '0.68rem', color: 'rgba(255,255,255,0.3)',
                textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600,
              }}>
                <span>Program</span>
                <span>$/Point</span>
                <span>Expiration Policy</span>
                <span>Transfer Partners</span>
                <span>Linked Card Products</span>
              </div>
              {programsSorted.map((row) => {
                const partnerNames = row.transferPartnerIds.map(id => programById[id]?.fields['Program Name'] || id);
                const productNames = row.cardProductIds.map(id => cardProductNameById[id] || id);
                const shownProducts = productNames.slice(0, 3);
                const extraCount = productNames.length - shownProducts.length;
                return (
                  <div key={row.id} style={{
                    display: 'grid', gridTemplateColumns: '1.6fr 1fr 1.8fr 1.6fr 1.8fr', gap: '0.75rem',
                    alignItems: 'center', padding: '0.75rem 1rem', borderRadius: 10,
                    background: '#172033', border: '1px solid rgba(255,255,255,0.06)',
                  }}>
                    <span><ProgramBadge name={row.programName} /></span>
                    <span style={{ color: 'rgba(255,255,255,0.55)', fontSize: '0.85rem' }}>{fmtVPP(row.valuePerPoint)}</span>
                    <span
                      title={row.expirationPolicy}
                      style={{ color: 'rgba(255,255,255,0.45)', fontSize: '0.8rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                    >
                      {row.expirationPolicy || '—'}
                    </span>
                    <span style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {partnerNames.length === 0
                        ? <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.8rem' }}>—</span>
                        : partnerNames.map((n, idx) => <ProgramBadge key={n + idx} name={n} />)}
                    </span>
                    <span
                      title={productNames.join(', ')}
                      style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.8rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                    >
                      {productNames.length === 0 ? '—' : `${shownProducts.join(', ')}${extraCount > 0 ? ` +${extraCount} more` : ''}`}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, auto)', gap: '1rem', width: 'fit-content' }}>
            <div style={cardStyle}>
              <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600, marginBottom: 4 }}>
                Total Balance Value
              </div>
              <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#00E676', lineHeight: 1 }}>
                {fmtDollar(totalBalanceValue)}
              </div>
            </div>
            <div style={cardStyle}>
              <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600, marginBottom: 4 }}>
                Programs With Balance
              </div>
              <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#fff', lineHeight: 1 }}>
                {programsWithBalance}
              </div>
            </div>
          </div>

          <div style={cardStyle}>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                <span style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600, marginRight: 4 }}>Person</span>
                <PillBtn active={personFilter === 'All'} onClick={() => setPersonFilter('All')}>All</PillBtn>
                {Object.values(PEOPLE).map(name => (
                  <PillBtn key={name} active={personFilter === name} onClick={() => setPersonFilter(name)}>{name}</PillBtn>
                ))}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8rem', color: 'rgba(255,255,255,0.6)', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={balancesOnly}
                    onChange={e => setBalancesOnly(e.target.checked)}
                    style={{ accentColor: '#00D4FF', width: 15, height: 15 }}
                  />
                  Show Balances Only
                </label>
                {onNavigateAddBalance && (
                  <button type="button" onClick={onNavigateAddBalance} style={{
                    background: 'none', border: 'none', color: '#00D4FF', fontSize: '0.82rem',
                    cursor: 'pointer', fontWeight: 600, textDecoration: 'underline', padding: 0, whiteSpace: 'nowrap',
                  }}>
                    + Add Balance
                  </button>
                )}
              </div>
            </div>
          </div>

          {balancesSorted.length === 0 ? (
            <div style={{ ...cardStyle, padding: '3rem', color: 'rgba(255,255,255,0.35)', textAlign: 'center' }}>
              No balances found.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <div style={{
                display: 'grid', gridTemplateColumns: '1.3fr 0.85fr 0.9fr 0.8fr 1fr 1.4fr 0.9fr 0.9fr 0.7fr 90px', gap: '0.6rem',
                padding: '0.5rem 1rem', fontSize: '0.68rem', color: 'rgba(255,255,255,0.3)',
                textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600,
              }}>
                <span>Program</span>
                <span>Person</span>
                <span>Balance</span>
                <span>$/Point</span>
                <span>Value</span>
                <span>Linked Cards</span>
                <span>Last Updated</span>
                <span>Expires</span>
                <span>Days</span>
                <span></span>
              </div>
              {balancesSorted.map((row) => {
                const ownerNames = row.ownerIds.map(id => PEOPLE[id] || id).join(', ') || '—';
                const cardNames = row.cardIds.map(id => portfolioNameById[id] || id);
                const stale = isStaleDays(row.lastUpdated, 60);
                const days = row.daysUntilExpiration;
                const daysColor = days != null && days < 14 ? '#FF4D4D' : days != null && days < 60 ? '#FFD700' : 'rgba(255,255,255,0.5)';
                const isEditing = editingId === row.id;
                return (
                  <div key={row.id}>
                    <div style={{
                      display: 'grid', gridTemplateColumns: '1.3fr 0.85fr 0.9fr 0.8fr 1fr 1.4fr 0.9fr 0.9fr 0.7fr 90px', gap: '0.6rem',
                      alignItems: 'center', padding: '0.75rem 1rem', borderRadius: isEditing ? '10px 10px 0 0' : 10,
                      background: '#172033', border: '1px solid rgba(255,255,255,0.06)',
                    }}>
                      <span><ProgramBadge name={row.programName} /></span>
                      <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.85rem' }}>{ownerNames}</span>
                      <span style={{ color: '#fff', fontWeight: 600, fontSize: '0.88rem' }}>{fmt(row.currentBalance)}</span>
                      <span style={{ color: 'rgba(255,255,255,0.55)', fontSize: '0.85rem' }}>{fmtVPP(row.valuePerPoint)}</span>
                      <span style={{ color: '#00E676', fontWeight: 700, fontSize: '0.88rem' }}>{fmtDollar(row.programValue)}</span>
                      <span
                        title={cardNames.join(', ')}
                        style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.8rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                      >
                        {cardNames.length === 0 ? '—' : cardNames.join(', ')}
                      </span>
                      <span
                        title={stale ? 'No update in over 60 days' : ''}
                        style={{ fontSize: '0.82rem', color: stale ? '#FFD700' : 'rgba(255,255,255,0.5)', fontWeight: stale ? 700 : 400 }}
                      >
                        {fmtDate(row.lastUpdated)}
                      </span>
                      <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.82rem' }}>{fmtDate(row.expirationDate)}</span>
                      <span style={{ fontSize: '0.82rem', color: daysColor, fontWeight: days != null && days < 60 ? 700 : 400 }}>
                        {days != null ? days : '—'}
                      </span>
                      <span>
                        {!isEditing && (
                          <button type="button" onClick={() => startEdit(row)} style={{
                            padding: '4px 12px', borderRadius: 8, border: '1px solid rgba(0,212,255,0.4)',
                            background: 'rgba(0,212,255,0.1)', color: '#00D4FF', fontWeight: 600,
                            fontSize: '0.76rem', cursor: 'pointer', whiteSpace: 'nowrap',
                          }}>
                            Update
                          </button>
                        )}
                      </span>
                    </div>

                    {isEditing && (() => {
                      const editOwnerId = row.ownerIds[0];
                      const eligibleCards = portfolioRecords.filter(c =>
                        c.fields['Status'] === 'Active' &&
                        (c.fields['Owner'] || []).includes(editOwnerId) &&
                        (c.fields['Rewards Program'] || []).includes(row.programId)
                      );
                      return (
                        <div style={{
                          display: 'flex', flexDirection: 'column', gap: '0.75rem',
                          padding: '0.85rem 1rem', borderRadius: '0 0 10px 10px',
                          background: '#111a2b', border: '1px solid rgba(0,212,255,0.25)', borderTop: 'none',
                        }}>
                          {eligibleCards.length > 0 && (
                            <div>
                              <label style={{ display: 'block', fontSize: '0.68rem', color: 'rgba(255,255,255,0.4)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                Linked Cards
                              </label>
                              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                {eligibleCards.map(c => (
                                  <button
                                    key={c.id}
                                    type="button"
                                    onClick={() => toggleEditCard(c.id)}
                                    style={{
                                      padding: '4px 14px', borderRadius: 16, border: '1px solid rgba(255,255,255,0.12)',
                                      background: editCardIds.includes(c.id) ? '#00D4FF' : 'rgba(255,255,255,0.06)',
                                      color: editCardIds.includes(c.id) ? '#0B1220' : 'rgba(255,255,255,0.6)',
                                      fontWeight: editCardIds.includes(c.id) ? 700 : 400, cursor: 'pointer', fontSize: '0.78rem',
                                    }}
                                  >
                                    {c.fields['Card Name'] || c.id}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'flex-end' }}>
                            <div>
                              <label style={{ display: 'block', fontSize: '0.68rem', color: 'rgba(255,255,255,0.4)', marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                New Balance
                              </label>
                              <input
                                style={{ ...inp, width: 130 }}
                                type="number"
                                min="0"
                                autoFocus
                                value={editBalance}
                                onChange={e => setEditBalance(e.target.value)}
                              />
                            </div>
                            <div>
                              <label style={{ display: 'block', fontSize: '0.68rem', color: 'rgba(255,255,255,0.4)', marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                Expiration Date
                              </label>
                              <input
                                style={{ ...inp, width: 150 }}
                                type="date"
                                value={editExpiration}
                                onChange={e => setEditExpiration(e.target.value)}
                              />
                            </div>
                            <button type="button" onClick={() => saveEdit(row)} disabled={saving} style={{
                              padding: '0.5rem 1.1rem', borderRadius: 8, border: 'none',
                              background: saving ? 'rgba(0,212,255,0.4)' : '#00D4FF',
                              color: '#0B1220', fontWeight: 700, fontSize: '0.82rem',
                              cursor: saving ? 'not-allowed' : 'pointer',
                            }}>
                              {saving ? 'Saving…' : 'Save'}
                            </button>
                            <button type="button" onClick={cancelEdit} disabled={saving} style={{
                              padding: '0.5rem 1.1rem', borderRadius: 8, border: '1px solid rgba(255,255,255,0.15)',
                              background: 'transparent', color: 'rgba(255,255,255,0.6)', fontWeight: 600,
                              fontSize: '0.82rem', cursor: 'pointer',
                            }}>
                              Cancel
                            </button>
                            {saveError && (
                              <span style={{ color: '#FF4D4D', fontSize: '0.8rem' }}>{saveError}</span>
                            )}
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
