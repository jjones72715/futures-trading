import { useState, useEffect, useCallback, useMemo } from 'react';
import { fetchTable, createRecord } from '../services/airtable.js';
import { PORTFOLIO_TABLE, CARD_PRODUCTS_TABLE, CARD_INELIGIBILITY_TABLE } from '../config/tables.js';
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

const PORTFOLIO_FIELDS = ['Owner', 'Current Product', 'Status', 'Open Date', 'Personal/Business'];
const PRODUCT_FIELDS = ['Product Name'];
const INELIGIBILITY_FIELDS = ['Person', 'Card Product', 'Ineligible From', 'Months Until Eligible', 'Eligible Again Date', 'Notes'];

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

function firstOf(val) {
  return Array.isArray(val) ? val[0] : val;
}

function normalizeName(s) {
  return (s || '')
    .toLowerCase()
    .replace(/[®℠™]/g, '')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function fuzzyMatchProduct(fmName, products) {
  const normFm = normalizeName(fmName);
  if (!normFm) return null;

  let match = products.find(p => normalizeName(p.name) === normFm);
  if (match) return match;

  match = products.find(p => {
    const np = normalizeName(p.name);
    return np && (normFm.includes(np) || np.includes(normFm));
  });
  if (match) return match;

  const fmTokens = new Set(normFm.split(' ').filter(Boolean));
  let best = null, bestScore = 0;
  products.forEach(p => {
    const pTokens = normalizeName(p.name).split(' ').filter(Boolean);
    if (pTokens.length === 0) return;
    const overlap = pTokens.filter(t => fmTokens.has(t)).length;
    const score = overlap / pTokens.length;
    if (score > bestScore) { bestScore = score; best = p; }
  });
  return bestScore >= 0.6 ? best : null;
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

function CantGetForm({ card, personFilter, onSave, onCancel, saving, error }) {
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

function CardRow({ card, cardKey, isOpen, onToggleForm, personFilter, onSave, saving, error }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div>
      <div
        style={{ ...cardStyle, display: 'flex', flexDirection: 'column', gap: 6 }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
          <div>
            <div style={{ fontWeight: 700, color: '#fff', fontSize: '0.92rem' }}>{card.name}</div>
            <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.45)', marginTop: 2 }}>{card.issuer}</div>
          </div>
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <div style={{ fontSize: '1.2rem', fontWeight: 800, color: ACCENT }}>{$$(card.fm_value)}</div>
            <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.45)' }}>{$$(card.annual_fee)} AF</div>
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 10 }}>
          <div style={{
            fontSize: '0.8rem', color: '#fff', flex: 1,
            whiteSpace: hovered ? 'normal' : 'nowrap',
            overflow: hovered ? 'visible' : 'hidden',
            textOverflow: 'ellipsis',
          }}>
            {card.welcome_bonus || '—'}
          </div>
          <button
            type="button"
            onClick={() => onToggleForm(cardKey)}
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
          card={card}
          personFilter={personFilter}
          onSave={draft => onSave(cardKey, draft)}
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
            No {title.replace(' Cards', '')} recommendations available for {personFilter} right now
          </div>
        ) : (
          cards.map(card => (
            <CardRow
              key={card.key}
              card={card}
              cardKey={card.key}
              isOpen={openFormKey === card.key}
              onToggleForm={onToggleForm}
              personFilter={personFilter}
              onSave={onSave}
              saving={savingKey === card.key}
              error={savingKey === card.key ? saveError : null}
            />
          ))
        )}
      </div>
    </div>
  );
}

export function CardRecommendationsTab() {
  const [ineligibility, setIneligibility] = useState([]);
  const [portfolio, setPortfolio] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  const [personFilter, setPersonFilter] = useState(ALL_LABEL);
  const [fmData, setFmData] = useState(null);
  const [scraping, setScraping] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);

  const [openFormKey, setOpenFormKey] = useState(null);
  const [savingKey, setSavingKey] = useState(null);
  const [saveError, setSaveError] = useState(null);
  const [localOverrides, setLocalOverrides] = useState(new Set());

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [ineligRows, portfolioRows, productRows] = await Promise.all([
        fetchTable(CARD_INELIGIBILITY_TABLE, INELIGIBILITY_FIELDS),
        fetchTable(PORTFOLIO_TABLE, PORTFOLIO_FIELDS),
        fetchTable(CARD_PRODUCTS_TABLE, PRODUCT_FIELDS),
      ]);
      setIneligibility(ineligRows);
      setPortfolio(portfolioRows);
      setProducts(productRows);
    } catch (e) {
      setLoadError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const productList = useMemo(
    () => products.map(p => ({ id: p.id, name: p.fields['Product Name'] || '' })),
    [products]
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
    const { key: cardKey, matchedProductId, type, issuer } = card;
    if (localOverrides.has(`${personId}|${cardKey}`)) return true;
    if (matchedProductId && activeProductIdsByPerson.get(personId)?.has(matchedProductId)) return true;
    if (matchedProductId && ineligibleUntilByPersonProduct.has(`${personId}|${matchedProductId}`)) return true;
    if (type === 'consumer' && issuer === 'Chase' && is524ByPerson.get(personId)) return true;
    return false;
  }

  function isVisible(card) {
    if (personFilter === ALL_LABEL) {
      return RELEVANT_PEOPLE.some(p => !hiddenForPerson(card, p.id));
    }
    const personId = idByName[personFilter];
    return !hiddenForPerson(card, personId);
  }

  function enrichAndFilter(cards) {
    return cards
      .map(card => {
        const matchedProductId = fuzzyMatchProduct(card.name, productList)?.id || null;
        return { ...card, key: `${card.type}|${card.name}`, matchedProductId };
      })
      .filter(isVisible)
      .sort((a, b) => (b.fm_value ?? -Infinity) - (a.fm_value ?? -Infinity));
  }

  const consumerCards = useMemo(
    () => (fmData && !fmData.error ? enrichAndFilter(fmData.consumer || []) : []),
    [fmData, productList, activeProductIdsByPerson, ineligibleUntilByPersonProduct, is524ByPerson, personFilter, localOverrides]
  );
  const businessCards = useMemo(
    () => (fmData && !fmData.error ? enrichAndFilter(fmData.business || []) : []),
    [fmData, productList, activeProductIdsByPerson, ineligibleUntilByPersonProduct, is524ByPerson, personFilter, localOverrides]
  );

  async function handleRefresh() {
    setScraping(true);
    try {
      const res = await fetch('/.netlify/functions/scrape-fm');
      const data = await res.json();
      setFmData(data);
      setLastUpdated(new Date());
    } catch (e) {
      setFmData({ error: 'Failed to fetch FM data' });
    } finally {
      setScraping(false);
    }
  }

  async function handleSaveIneligibility(cardKey, { personId, months, notes }) {
    setSavingKey(cardKey);
    setSaveError(null);
    const card = [...(fmData?.consumer || []), ...(fmData?.business || [])].find(
      c => `${c.type}|${c.name}` === cardKey
    );
    const matchedProductId = fuzzyMatchProduct(card?.name, productList)?.id || null;
    const personName = RELEVANT_PEOPLE.find(p => p.id === personId)?.name || personId;
    try {
      const fields = {
        'Label': `${personName} — ${card?.name || 'Card'}`,
        'Person': [personId],
        'Ineligible From': todayStr(),
        'Months Until Eligible': months,
      };
      if (matchedProductId) fields['Card Product'] = [matchedProductId];
      if (notes) fields['Notes'] = notes;
      const created = await createRecord(CARD_INELIGIBILITY_TABLE, fields);
      setIneligibility(prev => [...prev, created]);
      setLocalOverrides(prev => new Set(prev).add(`${personId}|${cardKey}`));
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <PersonPills selected={personFilter} onChange={setPersonFilter} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {lastUpdated && (
            <span style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.4)' }}>
              Last Updated: {lastUpdated.toLocaleString()}
            </span>
          )}
          <button
            type="button"
            onClick={handleRefresh}
            disabled={scraping}
            style={{
              padding: '0.55rem 1.2rem', borderRadius: 8, border: 'none',
              background: scraping ? 'rgba(0,212,255,0.4)' : ACCENT,
              color: '#0B1220', fontWeight: 700, fontSize: '0.85rem',
              cursor: scraping ? 'not-allowed' : 'pointer',
              animation: scraping ? 'ccRecPulse 1.2s ease-in-out infinite' : 'none',
            }}
          >
            {scraping ? 'Fetching from Frequent Miler...' : 'Refresh Recommendations'}
          </button>
        </div>
        <style>{'@keyframes ccRecPulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.55; } }'}</style>
      </div>

      {!fmData && (
        <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.35)', padding: '4rem 1rem' }}>
          Hit Refresh to load current recommendations from Frequent Miler
        </div>
      )}

      {fmData?.error && fmData.error.startsWith('Failed to fetch') && (
        <div style={{ textAlign: 'center', color: '#FF4D4D', padding: '3rem 1rem' }}>
          Could not fetch Frequent Miler data — check your connection and try again
        </div>
      )}

      {fmData?.error && fmData.error.startsWith('Parse failed') && (
        <div style={{ textAlign: 'center', color: '#FF4D4D', padding: '3rem 1rem' }}>
          Frequent Miler page format may have changed — contact developer to update parser
        </div>
      )}

      {fmData && !fmData.error && (
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
