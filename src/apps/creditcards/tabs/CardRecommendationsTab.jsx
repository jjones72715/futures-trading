import { useState, useEffect, useCallback, useMemo } from 'react';
import { fetchTable, createRecord } from '../services/airtable.js';
import { PORTFOLIO_TABLE, CARD_PRODUCTS_TABLE, CARD_INELIGIBILITY_TABLE, BANKS_TABLE } from '../config/tables.js';
import { PEOPLE } from '../config/constants.js';
import { $$ } from '../utils/format.js';

const ACCENT = '#00D4FF';
const CARD_BG = '#172033';
const ALL_LABEL = 'All';
const RELEVANT_NAMES = ['Jonathan', 'Sherry', 'Judy', 'Wade', 'Amanda'];

const idByName = Object.fromEntries(Object.entries(PEOPLE).map(([id, name]) => [name, id]));
const RELEVANT_PEOPLE = RELEVANT_NAMES
  .filter(name => idByName[name])
  .map(name => ({ id: idByName[name], name }));

const PRODUCT_FIELDS = ['Product Name', 'Issuer', 'Personal/Business', 'Annual Fee', 'FM Value Estimate', 'FM Last Updated'];
const PORTFOLIO_FIELDS = ['Owner', 'Current Product', 'Status', 'Open Date', 'Personal/Business'];
const INELIGIBILITY_FIELDS = ['Person', 'Card Product', 'Eligible Again Date'];
const BANK_FIELDS = ['Bank Name'];

const cardStyle = {
  background: CARD_BG, borderRadius: 12, border: '1px solid rgba(255,255,255,0.08)',
  padding: '0.85rem 1rem',
};

const inp = {
  width: '100%', background: '#0B1220', border: '1px solid rgba(255,255,255,0.12)',
  borderRadius: 8, padding: '0.5rem 0.7rem', color: '#fff', fontSize: '0.85rem',
  outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit',
};

const lbl = {
  display: 'block', fontSize: '0.68rem', fontWeight: 600,
  color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase',
  letterSpacing: '0.05em', marginBottom: 4,
};

function todayStr() {
  return new Date().toISOString().split('T')[0];
}

function monthsAgoStr(n) {
  const d = new Date();
  d.setMonth(d.getMonth() - n);
  return d.toISOString().split('T')[0];
}

function fmtDateStr(s) {
  if (!s) return '—';
  const [y, m, d] = s.split('-');
  return `${parseInt(m)}/${parseInt(d)}/${y}`;
}

function firstOf(val) {
  return Array.isArray(val) ? val[0] : val;
}

function PersonPills({ selected, onChange }) {
  const names = [ALL_LABEL, ...RELEVANT_NAMES];
  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      {names.map(name => {
        const active = selected === name;
        return (
          <button
            key={name}
            onClick={() => onChange(name)}
            style={{
              padding: '6px 16px', borderRadius: 20, border: '1px solid rgba(255,255,255,0.12)',
              background: active ? ACCENT : 'rgba(255,255,255,0.06)',
              color: active ? '#0B1220' : 'rgba(255,255,255,0.6)',
              fontWeight: active ? 700 : 400, fontSize: '0.85rem', cursor: 'pointer', transition: 'all 0.15s',
            }}
          >
            {name}
          </button>
        );
      })}
    </div>
  );
}

function IssuerPills({ issuers, hidden, onToggle, onReset }) {
  if (issuers.length === 0) return null;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
      <span style={{ fontSize: '0.7rem', fontWeight: 600, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        Issuer
      </span>
      {issuers.map(issuer => {
        const active = !hidden.has(issuer);
        return (
          <button
            key={issuer}
            type="button"
            onClick={() => onToggle(issuer)}
            style={{
              padding: '5px 14px', borderRadius: 20, border: '1px solid rgba(255,255,255,0.12)',
              background: active ? 'rgba(0,212,255,0.12)' : 'rgba(255,255,255,0.04)',
              color: active ? ACCENT : 'rgba(255,255,255,0.35)',
              fontWeight: active ? 600 : 400, fontSize: '0.8rem', cursor: 'pointer',
              transition: 'all 0.15s', textDecoration: active ? 'none' : 'line-through',
            }}
          >
            {issuer}
          </button>
        );
      })}
      {hidden.size > 0 && (
        <button type="button" onClick={onReset} style={{
          background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)',
          fontSize: '0.78rem', cursor: 'pointer', textDecoration: 'underline',
        }}>
          Show All
        </button>
      )}
    </div>
  );
}

function CantGetForm({ personFilter, onSave, onCancel, saving, error }) {
  const locked = personFilter !== ALL_LABEL;
  const [personId, setPersonId] = useState(locked ? idByName[personFilter] : '');
  const [months, setMonths] = useState('');
  const [notes, setNotes] = useState('');
  const [validationError, setValidationError] = useState(null);

  function handleSave() {
    setValidationError(null);
    if (!personId) { setValidationError('Select a person.'); return; }
    if (months === '' || Number.isNaN(Number(months))) { setValidationError('Enter months until eligible.'); return; }
    onSave({ personId, months: parseInt(months, 10), notes });
  }

  return (
    <div style={{ ...cardStyle, marginTop: 6, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <div>
          <label style={lbl}>Person</label>
          {locked ? (
            <input style={{ ...inp, opacity: 0.6, cursor: 'not-allowed' }} value={personFilter} readOnly disabled />
          ) : (
            <select style={inp} value={personId} onChange={e => setPersonId(e.target.value)}>
              <option value="">— Select person —</option>
              {RELEVANT_PEOPLE.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          )}
        </div>
        <div>
          <label style={lbl}>Months Until Eligible</label>
          <input style={inp} type="number" value={months} onChange={e => setMonths(e.target.value)} placeholder="e.g. 24" />
        </div>
      </div>
      <div>
        <label style={lbl}>Notes (optional)</label>
        <input style={inp} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Any context…" />
      </div>
      {(validationError || error) && (
        <div style={{ background: '#FF4D4D22', border: '1px solid #FF4D4D', borderRadius: 8, padding: '0.4rem 0.7rem', color: '#FF4D4D', fontSize: '0.78rem' }}>
          {validationError || error}
        </div>
      )}
      <div style={{ display: 'flex', gap: 8 }}>
        <button type="button" disabled={saving} onClick={handleSave} style={{
          padding: '0.45rem 1.1rem', borderRadius: 8, border: 'none',
          background: saving ? 'rgba(0,212,255,0.4)' : ACCENT,
          color: '#0B1220', fontWeight: 700, fontSize: '0.8rem', cursor: saving ? 'not-allowed' : 'pointer',
        }}>
          {saving ? 'Saving…' : 'Save'}
        </button>
        <button type="button" onClick={onCancel} style={{
          padding: '0.45rem 1.1rem', borderRadius: 8, border: '1px solid rgba(255,255,255,0.15)',
          background: 'none', color: 'rgba(255,255,255,0.6)', fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer',
        }}>
          Cancel
        </button>
      </div>
    </div>
  );
}

function PersonalBusinessBadge({ value }) {
  if (!value) return null;
  const isBusiness = value === 'Business';
  return (
    <span style={{
      display: 'inline-block', padding: '1px 8px', borderRadius: 20, fontSize: '0.65rem', fontWeight: 700,
      background: isBusiness ? 'rgba(179,136,255,0.12)' : 'rgba(0,230,118,0.12)',
      color: isBusiness ? '#B388FF' : '#00E676',
      border: `1px solid ${isBusiness ? 'rgba(179,136,255,0.3)' : 'rgba(0,230,118,0.3)'}`,
    }}>
      {value}
    </span>
  );
}

function CardRow({ card, isOpen, onToggleForm, personFilter, onSave, saving, error }) {
  return (
    <div>
      <div style={{ ...cardStyle, display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
          <div>
            <div style={{ fontWeight: 700, color: '#fff', fontSize: '0.92rem' }}>{card.name}</div>
            <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.45)', marginTop: 2 }}>{card.issuer}</div>
          </div>
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <div style={{ fontSize: '1.2rem', fontWeight: 800, color: ACCENT }}>{$$(card.fmValue)}</div>
            <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.45)' }}>{$$(card.annualFee)} AF</div>
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
          <PersonalBusinessBadge value={card.personalBusiness} />
          <button
            type="button"
            onClick={() => onToggleForm(card.id)}
            style={{
              padding: '3px 10px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.1)',
              background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.4)',
              fontSize: '0.7rem', cursor: 'pointer', flexShrink: 0,
            }}
          >
            Can't Get
          </button>
        </div>
      </div>
      {isOpen && (
        <CantGetForm
          personFilter={personFilter}
          onSave={draft => onSave(card.id, draft)}
          onCancel={() => onToggleForm(null)}
          saving={saving}
          error={error}
        />
      )}
    </div>
  );
}

function Column({ title, cards, personFilter, openFormKey, onToggleForm, onSave, savingKey, saveError }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', minWidth: 0 }}>
      <div style={{
        fontWeight: 700, color: ACCENT, fontSize: '0.95rem',
        borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: 8,
      }}>
        {title} <span style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.4)', fontWeight: 400 }}>({cards.length})</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', maxHeight: 'calc(100vh - 320px)', overflowY: 'auto', paddingRight: 4 }}>
        {cards.length === 0 ? (
          <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.35)', padding: '2rem 1rem' }}>
            No {title.replace(' Cards', '')} recommendations available for {personFilter}
          </div>
        ) : (
          cards.map(card => (
            <CardRow
              key={card.id}
              card={card}
              isOpen={openFormKey === card.id}
              onToggleForm={onToggleForm}
              personFilter={personFilter}
              onSave={onSave}
              saving={savingKey === card.id}
              error={savingKey === card.id ? saveError : null}
            />
          ))
        )}
      </div>
    </div>
  );
}

export function CardRecommendationsTab() {
  const [products, setProducts] = useState([]);
  const [portfolio, setPortfolio] = useState([]);
  const [ineligibility, setIneligibility] = useState([]);
  const [banks, setBanks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  const [personFilter, setPersonFilter] = useState(ALL_LABEL);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState(null);
  const [refreshDebug, setRefreshDebug] = useState(null);

  const [openFormKey, setOpenFormKey] = useState(null);
  const [savingKey, setSavingKey] = useState(null);
  const [saveError, setSaveError] = useState(null);
  const [localOverrides, setLocalOverrides] = useState(new Set());
  const [hiddenIssuers, setHiddenIssuers] = useState(new Set());

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [productRows, portfolioRows, ineligRows, bankRows] = await Promise.all([
        fetchTable(CARD_PRODUCTS_TABLE, PRODUCT_FIELDS, { filterByFormula: '{FM Value Estimate} > 0' }),
        fetchTable(PORTFOLIO_TABLE, PORTFOLIO_FIELDS),
        fetchTable(CARD_INELIGIBILITY_TABLE, INELIGIBILITY_FIELDS),
        fetchTable(BANKS_TABLE, BANK_FIELDS),
      ]);
      setProducts(productRows);
      setPortfolio(portfolioRows);
      setIneligibility(ineligRows);
      setBanks(bankRows);
    } catch (e) {
      setLoadError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const banksById = useMemo(
    () => new Map(banks.map(b => [b.id, b.fields['Bank Name'] || ''])),
    [banks]
  );

  const enrichedProducts = useMemo(() => products.map(p => ({
    id: p.id,
    name: p.fields['Product Name'] || '',
    issuer: banksById.get(firstOf(p.fields['Issuer'])) || 'Unknown',
    personalBusiness: p.fields['Personal/Business'] || null,
    annualFee: p.fields['Annual Fee'] ?? null,
    fmValue: p.fields['FM Value Estimate'] ?? null,
    fmLastUpdated: p.fields['FM Last Updated'] || null,
  })), [products, banksById]);

  const lastUpdated = useMemo(() => {
    const dates = enrichedProducts.map(p => p.fmLastUpdated).filter(Boolean).sort();
    return dates.length ? dates[dates.length - 1] : null;
  }, [enrichedProducts]);

  const availableIssuers = useMemo(
    () => [...new Set(enrichedProducts.map(p => p.issuer))].sort(),
    [enrichedProducts]
  );

  const activeProductIdsByPerson = useMemo(() => {
    const map = new Map();
    portfolio.forEach(row => {
      if (row.fields['Status'] !== 'Active') return;
      const productId = firstOf(row.fields['Current Product']);
      if (!productId) return;
      (row.fields['Owner'] || []).forEach(ownerId => {
        if (!map.has(ownerId)) map.set(ownerId, new Set());
        map.get(ownerId).add(productId);
      });
    });
    return map;
  }, [portfolio]);

  const is524ByPerson = useMemo(() => {
    const cutoff = monthsAgoStr(24);
    const counts = new Map();
    portfolio.forEach(row => {
      const personalBusiness = firstOf(row.fields['Personal/Business']);
      if (personalBusiness !== 'Personal') return;
      const openDate = row.fields['Open Date'];
      if (!openDate || openDate < cutoff) return;
      (row.fields['Owner'] || []).forEach(ownerId => {
        counts.set(ownerId, (counts.get(ownerId) || 0) + 1);
      });
    });
    const result = new Map();
    RELEVANT_PEOPLE.forEach(p => result.set(p.id, (counts.get(p.id) || 0) >= 5));
    return result;
  }, [portfolio]);

  const ineligibleUntilByPersonProduct = useMemo(() => {
    const today = todayStr();
    const map = new Map();
    ineligibility.forEach(row => {
      const eligibleAgain = row.fields['Eligible Again Date'];
      if (!eligibleAgain || eligibleAgain <= today) return;
      const productId = firstOf(row.fields['Card Product']);
      if (!productId) return;
      (row.fields['Person'] || []).forEach(personId => {
        map.set(`${personId}|${productId}`, true);
      });
    });
    return map;
  }, [ineligibility]);

  function hiddenForPerson(card, personId) {
    if (localOverrides.has(`${personId}|${card.id}`)) return true;
    if (activeProductIdsByPerson.get(personId)?.has(card.id)) return true;
    if (ineligibleUntilByPersonProduct.has(`${personId}|${card.id}`)) return true;
    if (card.personalBusiness === 'Personal' && card.issuer === 'Chase' && is524ByPerson.get(personId)) return true;
    return false;
  }

  function isVisible(card) {
    if (personFilter === ALL_LABEL) {
      return RELEVANT_PEOPLE.some(p => !hiddenForPerson(card, p.id));
    }
    const personId = idByName[personFilter];
    return !hiddenForPerson(card, personId);
  }

  function filterAndSort(cards) {
    return cards
      .filter(isVisible)
      .filter(card => !hiddenIssuers.has(card.issuer))
      .sort((a, b) => (b.fmValue ?? -Infinity) - (a.fmValue ?? -Infinity));
  }

  const consumerCards = useMemo(
    () => filterAndSort(enrichedProducts.filter(c => c.personalBusiness === 'Personal')),
    [enrichedProducts, activeProductIdsByPerson, ineligibleUntilByPersonProduct, is524ByPerson, personFilter, localOverrides, hiddenIssuers]
  );
  const businessCards = useMemo(
    () => filterAndSort(enrichedProducts.filter(c => c.personalBusiness === 'Business')),
    [enrichedProducts, activeProductIdsByPerson, ineligibleUntilByPersonProduct, is524ByPerson, personFilter, localOverrides, hiddenIssuers]
  );

  function toggleIssuer(issuer) {
    setHiddenIssuers(prev => {
      const next = new Set(prev);
      if (next.has(issuer)) next.delete(issuer);
      else next.add(issuer);
      return next;
    });
  }

  async function handleRefresh() {
    setRefreshing(true);
    setRefreshError(null);
    setRefreshDebug(null);
    try {
      const res = await fetch('/.netlify/functions/scrape-fm');
      const data = await res.json();
      if (data.error) {
        setRefreshError('Could not reach Frequent Miler — try again later');
        setRefreshDebug(data.debug || null);
      } else {
        await load();
      }
    } catch (e) {
      setRefreshError('Could not reach Frequent Miler — try again later');
    } finally {
      setRefreshing(false);
    }
  }

  async function handleSaveIneligibility(cardId, { personId, months, notes }) {
    setSavingKey(cardId);
    setSaveError(null);
    const card = enrichedProducts.find(c => c.id === cardId);
    const personName = RELEVANT_PEOPLE.find(p => p.id === personId)?.name || personId;
    try {
      const fields = {
        'Label': `${personName} — ${card?.name || 'Card'}`,
        'Person': [personId],
        'Card Product': [cardId],
        'Ineligible From': todayStr(),
        'Months Until Eligible': months,
      };
      if (notes) fields['Notes'] = notes;
      const created = await createRecord(CARD_INELIGIBILITY_TABLE, fields);
      setIneligibility(prev => [...prev, created]);
      setLocalOverrides(prev => new Set(prev).add(`${personId}|${cardId}`));
      setOpenFormKey(null);
    } catch (e) {
      setSaveError(e.message);
    } finally {
      setSavingKey(null);
    }
  }

  function toggleForm(key) {
    setOpenFormKey(prev => (prev === key ? null : key));
    setSaveError(null);
  }

  if (loading) {
    return (
      <div style={{ padding: '3rem', textAlign: 'center', color: 'rgba(255,255,255,0.4)' }}>
        Loading…
      </div>
    );
  }

  if (loadError) {
    return (
      <div style={{ padding: '2rem', color: '#FF4D4D' }}>
        Error: {loadError}
      </div>
    );
  }

  const hasFmData = enrichedProducts.length > 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <PersonPills selected={personFilter} onChange={setPersonFilter} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {lastUpdated && (
            <span style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.4)' }}>
              Last Updated: {fmtDateStr(lastUpdated)}
            </span>
          )}
          <button
            type="button"
            onClick={handleRefresh}
            disabled={refreshing}
            style={{
              padding: '0.55rem 1.2rem', borderRadius: 8, border: 'none',
              background: refreshing ? 'rgba(0,212,255,0.4)' : ACCENT,
              color: '#0B1220', fontWeight: 700, fontSize: '0.85rem',
              cursor: refreshing ? 'not-allowed' : 'pointer',
              animation: refreshing ? 'ccRecPulse 1.2s ease-in-out infinite' : 'none',
            }}
          >
            {refreshing ? 'Updating from Frequent Miler...' : 'Refresh FM Data'}
          </button>
        </div>
        <style>{'@keyframes ccRecPulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.55; } }'}</style>
      </div>

      {hasFmData && (
        <IssuerPills
          issuers={availableIssuers}
          hidden={hiddenIssuers}
          onToggle={toggleIssuer}
          onReset={() => setHiddenIssuers(new Set())}
        />
      )}

      {refreshError && (
        <div style={{ textAlign: 'center', color: '#FF4D4D', padding: '0.75rem 1rem' }}>
          {refreshError}
          {refreshDebug && (
            <pre style={{
              ...cardStyle, marginTop: '0.75rem', textAlign: 'left', whiteSpace: 'pre-wrap', wordBreak: 'break-word',
              fontSize: '0.72rem', color: 'rgba(255,255,255,0.6)', maxHeight: 300, overflowY: 'auto',
            }}>
              {JSON.stringify(refreshDebug, null, 2)}
            </pre>
          )}
        </div>
      )}

      {!hasFmData ? (
        <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.35)', padding: '4rem 1rem' }}>
          Hit Refresh to load current FM recommendations
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
          <Column
            title="Consumer Cards"
            cards={consumerCards}
            personFilter={personFilter}
            openFormKey={openFormKey}
            onToggleForm={toggleForm}
            onSave={handleSaveIneligibility}
            savingKey={savingKey}
            saveError={saveError}
          />
          <Column
            title="Business Cards"
            cards={businessCards}
            personFilter={personFilter}
            openFormKey={openFormKey}
            onToggleForm={toggleForm}
            onSave={handleSaveIneligibility}
            savingKey={savingKey}
            saveError={saveError}
          />
        </div>
      )}
    </div>
  );
}
