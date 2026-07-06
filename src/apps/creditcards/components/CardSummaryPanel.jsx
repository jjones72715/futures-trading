import { useState, useEffect } from 'react';
import { fetchTable, getRecord } from '../services/airtable.js';
import {
  PORTFOLIO_TABLE, CARD_PRODUCTS_TABLE, PEOPLE_TABLE, PERK_DEFINITIONS_TABLE,
  PERK_INSTANCES_TABLE, HOTELS_TABLE, SIGNUP_BONUSES_TABLE, SPEND_BONUSES_TABLE,
} from '../config/tables.js';
import { $$ } from '../utils/format.js';
import { calculateNextResetDate, toAirtableDate } from '../utils/dates.js';
import { annualizedCreditAmount, sumPerkValue } from '../utils/perks.js';

const BANK_NAMES = {
  'recmOSLhOAYVqi09z': 'American Express',
  'recirpPT41J9yWOso': 'Barclays',
  'recUwpGOntDp5O9Pn': 'Bank of America',
  'reci7K7HYue3nEx7e': 'Capital One',
  'recuAO5OVmsDNWW6D': 'Cardless',
  'recgw2ngVEO8gBpoq': 'Chase',
  'rec9ePERLvVM24fqx': 'Citi',
  'rec2BUeHI8gDyNcya': 'Discover',
  'rec8clRqXmQ4EjDEI': 'Mercury',
  'recRyPOXcDNKrWK53': 'U.S. Bank',
  'recRKg9TA1IQpRkmH': 'Wells Fargo',
};

const DECISION_COLORS = {
  Keep: '#00C853',
  Cancel: '#FF3D00',
  'Product Change': '#2979FF',
  Downgrade: '#FF6D00',
  Upgrade: '#00D4FF',
};

const PERK_FIELDS = ['Label', 'Perk Definition', 'Credit Amount', 'Reset Cycle', 'Next Reset Date', 'Priority Score', 'Used', 'Perk Type', 'Value', 'Previous Value'];
const HOTEL_FIELDS = ['Name', 'Record Type', 'Benefit Type', 'Estimated Value', 'Expiration Date', 'Days Until Expiration'];
const SIGNUP_FIELDS = ['Bonus Description', 'Spend Target', 'Current Spend', 'Remaining Spend', 'Effective Deadline', 'Days Remaining', 'Achieved'];
const SPEND_FIELDS = ['Bonus Description', 'Annual Spend Target', 'Current Spend', 'Remaining Spend', 'Reset Date', 'Days Until Reset', 'Bonus Earned', 'Value'];
const PERK_DEF_FIELDS = ['Perk Name', 'Card Product', 'Credit Amount', 'Reset Cycle', 'Priority Score', 'Benefit Type'];

const dataCache = new Map();
let peopleNamesPromise = null;
let productsPromise = null;
let perkDefinitionsPromise = null;

function loadPeopleNames() {
  if (!peopleNamesPromise) {
    peopleNamesPromise = fetchTable(PEOPLE_TABLE, ['Name']).then(rows =>
      Object.fromEntries(rows.map(r => [r.id, r.fields['Name'] || r.id]))
    );
  }
  return peopleNamesPromise;
}

function loadProducts() {
  if (!productsPromise) {
    productsPromise = fetchTable(CARD_PRODUCTS_TABLE, ['Product Name', 'Can Upgrade To', 'Can Downgrade To']).then(rows =>
      Object.fromEntries(rows.map(r => [r.id, r.fields]))
    );
  }
  return productsPromise;
}

function loadPerkDefinitions() {
  if (!perkDefinitionsPromise) {
    perkDefinitionsPromise = fetchTable(PERK_DEFINITIONS_TABLE, PERK_DEF_FIELDS);
  }
  return perkDefinitionsPromise;
}

export function clearCardSummaryCache() {
  dataCache.clear();
  peopleNamesPromise = null;
  productsPromise = null;
  perkDefinitionsPromise = null;
}

function resolveIssuer(raw) {
  if (!raw) return 'Unknown';
  const key = Array.isArray(raw) ? raw[0] : raw;
  return BANK_NAMES[key] || key || 'Unknown';
}

function extractSelectName(v) {
  if (!v) return null;
  if (Array.isArray(v)) return v[0]?.name || v[0] || null;
  if (typeof v === 'object') return v.name || null;
  return v;
}

function fmtDate(dateStr) {
  if (!dateStr) return '—';
  const [y, m, d] = dateStr.split('-');
  return `${parseInt(m)}/${parseInt(d)}/${y}`;
}

function daysUntilFeeColor(days) {
  if (days == null) return 'rgba(255,255,255,0.45)';
  if (days < 30) return '#FF4D4D';
  if (days < 60) return '#FFD60A';
  if (days < 90) return 'rgba(255,255,255,0.45)';
  return '#fff';
}

function Badge({ color, children }) {
  return (
    <span style={{
      display: 'inline-block', padding: '2px 10px', borderRadius: 20,
      fontSize: '0.72rem', fontWeight: 700, background: color + '22', color,
      border: `1px solid ${color}55`, whiteSpace: 'nowrap',
    }}>
      {children}
    </span>
  );
}

function ProgressBar({ ratio }) {
  const pct = Math.max(0, Math.min(1, ratio || 0)) * 100;
  return (
    <div style={{ height: 8, borderRadius: 4, background: '#1E2D45', overflow: 'hidden' }}>
      <div style={{ height: '100%', width: `${pct}%`, background: '#00D4FF', borderRadius: 4, transition: 'width 0.3s ease' }} />
    </div>
  );
}

function SectionTitle({ title, count }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.92rem', fontWeight: 700, color: '#fff' }}>
      {title}
      {count != null && (
        <span style={{
          fontSize: '0.72rem', fontWeight: 600, color: 'rgba(255,255,255,0.4)',
          background: 'rgba(255,255,255,0.06)', borderRadius: 20, padding: '1px 8px',
        }}>
          {count}
        </span>
      )}
    </div>
  );
}

function EmptyNote({ children }) {
  return <div style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.35)' }}>{children}</div>;
}

function Divider() {
  return <div style={{ borderTop: '1px solid #1E2D45' }} />;
}

function MiniStat({ label, value, color }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 1, alignItems: 'flex-end' }}>
      <span style={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
        {label}
      </span>
      <span style={{ fontSize: '0.82rem', color: color || 'rgba(255,255,255,0.75)', fontWeight: 700 }}>{value}</span>
    </div>
  );
}

function Skeleton() {
  const block = (h, w = '100%') => (
    <div style={{ height: h, width: w, borderRadius: 6, background: 'rgba(255,255,255,0.06)' }} />
  );
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {block(28, '60%')}
        {block(16, '40%')}
        {block(16, '50%')}
      </div>
      <Divider />
      {[1, 2, 3].map(i => (
        <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {block(18, '30%')}
          {block(40)}
          {block(40)}
        </div>
      ))}
    </div>
  );
}

export function CardSummaryPanel({ cardId, onClose }) {
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [bundle, setBundle] = useState(null);
  const [showAllPerks, setShowAllPerks] = useState(false);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (!cardId) return;
    let cancelled = false;

    const cached = dataCache.get(cardId);
    if (cached) {
      setBundle(cached);
      setError(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    const filter = `FIND("${cardId}",ARRAYJOIN({Card}))`;

    Promise.all([
      getRecord(PORTFOLIO_TABLE, cardId),
      fetchTable(PERK_INSTANCES_TABLE, PERK_FIELDS, { filterByFormula: filter }),
      fetchTable(HOTELS_TABLE, HOTEL_FIELDS, { filterByFormula: filter }),
      fetchTable(SIGNUP_BONUSES_TABLE, SIGNUP_FIELDS, { filterByFormula: filter }),
      fetchTable(SPEND_BONUSES_TABLE, SPEND_FIELDS, { filterByFormula: filter }),
      loadPeopleNames(),
      loadProducts(),
      loadPerkDefinitions(),
    ])
      .then(([card, perks, hotels, signup, spend, peopleNames, products, perkDefs]) => {
        if (cancelled) return;
        const result = { card, perks, hotels, signup, spend, peopleNames, products, perkDefs };
        dataCache.set(cardId, result);
        setBundle(result);
      })
      .catch(e => { if (!cancelled) setError(e.message); })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [cardId]);

  function handleClose() {
    setMounted(false);
    setTimeout(onClose, 200);
  }

  const f = bundle?.card?.fields || {};
  const peopleNames = bundle?.peopleNames || {};
  const products = bundle?.products || {};

  const ownerIds = f['Owner'] || [];
  const auIds = f['Authorized Users'] || [];
  const annualFee = f['Annual Fee Amount'] || 0;
  const daysUntilFee = f['Days Until Annual Fee'];
  const currentProductId = (f['Current Product'] || [])[0];
  const currentProduct = currentProductId ? products[currentProductId] : null;
  const upgradeIds = currentProduct?.['Can Upgrade To'] || [];
  const downgradeIds = currentProduct?.['Can Downgrade To'] || [];

  const instanceByDefId = {};
  (bundle?.perks || []).forEach(r => {
    const defId = (r.fields['Perk Definition'] || [])[0];
    if (defId) instanceByDefId[defId] = r;
  });

  const perkDefsForProduct = (bundle?.perkDefs || []).filter(d =>
    (d.fields['Card Product'] || []).includes(currentProductId)
  );

  const today = new Date();
  const allPerkRows = perkDefsForProduct.map(def => {
    const inst = instanceByDefId[def.id];
    const cycle = extractSelectName(def.fields['Reset Cycle']) || '';
    const nextReset = inst
      ? (inst.fields['Next Reset Date'] || '')
      : (cycle ? toAirtableDate(calculateNextResetDate(cycle, today)) : '');
    return {
      id: inst?.id || def.id,
      label: def.fields['Perk Name'] || inst?.fields['Label'] || '—',
      creditAmount: inst?.fields['Credit Amount'] ?? def.fields['Credit Amount'] ?? null,
      resetCycle: cycle,
      nextReset,
      priority: inst?.fields['Priority Score'] ?? def.fields['Priority Score'] ?? 0,
      used: inst ? !!inst.fields['Used'] : false,
      benefitType: extractSelectName(def.fields['Benefit Type']),
      value: inst?.fields['Value'] ?? null,
    };
  });

  const perksEnriched = allPerkRows.filter(p => p.benefitType !== 'Hotel Credit').sort((a, b) => b.priority - a.priority);
  const perksAvailableCount = perksEnriched.filter(p => !p.used).length;
  const perksVisible = showAllPerks ? perksEnriched : perksEnriched.filter(p => !p.used);

  const hotelCreditRows = allPerkRows.filter(p => p.benefitType === 'Hotel Credit').sort((a, b) => b.priority - a.priority);

  const hotelsEnriched = (bundle?.hotels || []).map(r => ({
    id: r.id,
    name: r.fields['Name'] || '—',
    recordType: extractSelectName(r.fields['Record Type']),
    benefitType: r.fields['Benefit Type'] || '—',
    value: r.fields['Estimated Value'] ?? null,
    expiration: r.fields['Expiration Date'] || '',
    daysUntil: r.fields['Days Until Expiration'] ?? null,
  }));

  const hotelSectionCount = hotelsEnriched.length + hotelCreditRows.length;

  const signupRows = bundle?.signup || [];
  const spendRows = bundle?.spend || [];

  // Value Only perks are card-specific and aren't tied to a Perk Definition, so they
  // never appear in perkDefsForProduct — surface them straight from the raw instances.
  const valueOnlyRows = (bundle?.perks || [])
    .filter(r => r.fields['Perk Type'] === 'Value Only')
    .map(r => ({ id: r.id, label: r.fields['Label'] || '—', value: r.fields['Value'] ?? null }));

  const { netValue } = sumPerkValue([...(bundle?.perks || []), ...(bundle?.spend || [])]);
  const valueDifference = netValue - annualFee;
  const valueDiffColor = netValue === 0 ? 'rgba(255,255,255,0.5)' : valueDifference >= 0 ? '#00E676' : '#FF4D4D';

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
          {loading || !bundle ? (
            <div style={{ height: 28, width: '60%', borderRadius: 6, background: 'rgba(255,255,255,0.06)' }} />
          ) : (
            <div style={{ fontSize: '1.3rem', fontWeight: 700, color: '#fff' }}>
              {f['Card Name'] || '—'}
            </div>
          )}
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

        <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {loading || !bundle ? (
            <Skeleton />
          ) : error ? (
            <div style={{ color: '#FF4D4D' }}>Error: {error}</div>
          ) : (
            <>
              {/* Header details */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', fontSize: '0.85rem', color: 'rgba(255,255,255,0.6)' }}>
                  <span>{resolveIssuer(f['Issuer'])}</span>
                  {f['Personal/Business'] && (
                    <span style={{
                      padding: '2px 10px', borderRadius: 20, fontSize: '0.72rem', fontWeight: 600,
                      background: f['Personal/Business'] === 'Business' ? 'rgba(0,212,255,0.12)' : 'rgba(255,255,255,0.08)',
                      color: f['Personal/Business'] === 'Business' ? '#00D4FF' : 'rgba(255,255,255,0.6)',
                      border: `1px solid ${f['Personal/Business'] === 'Business' ? '#00D4FF44' : 'rgba(255,255,255,0.12)'}`,
                    }}>
                      {f['Personal/Business']}
                    </span>
                  )}
                  <span>{ownerIds.map(id => peopleNames[id] || id).join(', ') || '—'}</span>
                  <Badge color={f['Status'] === 'Active' ? '#00E676' : 'rgba(255,255,255,0.4)'}>
                    {f['Status'] || '—'}
                  </Badge>
                </div>

                <div style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.55)' }}>
                  Open Date: {fmtDate(f['Open Date'])}
                </div>

                <div style={{ display: 'flex', gap: 12, alignItems: 'center', fontSize: '0.9rem' }}>
                  <span style={{ color: '#fff', fontWeight: 600 }}>
                    {annualFee > 0 ? $$(annualFee) : <span style={{ color: 'rgba(255,255,255,0.4)' }}>No Fee</span>}
                  </span>
                  {annualFee > 0 && daysUntilFee != null && (
                    <span style={{ color: daysUntilFeeColor(daysUntilFee), fontWeight: 700, fontSize: '0.82rem' }}>
                      {daysUntilFee}d until fee
                    </span>
                  )}
                </div>

                <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                  {f['Decision']
                    ? <Badge color={DECISION_COLORS[f['Decision']] || 'rgba(255,255,255,0.4)'}>{f['Decision']}</Badge>
                    : <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.82rem' }}>No decision</span>}
                  {f['Willing to Upgrade'] && (
                    <span style={{ fontSize: '0.78rem', color: '#00D4FF', fontWeight: 600 }}>Willing to Upgrade</span>
                  )}
                </div>

                <div style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.5)' }}>
                  Authorized Users: {auIds.length ? auIds.map(id => peopleNames[id] || id).join(', ') : '—'}
                </div>
              </div>

              {/* Value Summary */}
              <div style={{
                display: 'flex', justifyContent: 'space-between', padding: '0.85rem 1rem',
                borderRadius: 10, background: '#111a2b', border: '1px solid rgba(255,255,255,0.06)',
              }}>
                <div>
                  <div style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.05em' }}>Net Value</div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#fff' }}>{$$(netValue)}</div>
                </div>
                <div>
                  <div style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.05em' }}>Annual Fee</div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#fff' }}>{$$(annualFee)}</div>
                </div>
                <div>
                  <div style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.05em' }}>Difference</div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 700, color: valueDiffColor }}>
                    {valueDifference > 0 ? '+' : ''}{$$(valueDifference)}
                  </div>
                </div>
              </div>

              <Divider />

              {/* Perks */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <SectionTitle title="Benefits" count={perksAvailableCount} />
                  {perksEnriched.some(p => p.used) && (
                    <button
                      type="button"
                      onClick={() => setShowAllPerks(v => !v)}
                      style={{
                        background: 'none', border: 'none', color: '#00D4FF', fontSize: '0.75rem',
                        fontWeight: 600, cursor: 'pointer', padding: 0,
                      }}
                    >
                      {showAllPerks ? 'Show Available Only' : 'Show All'}
                    </button>
                  )}
                </div>
                {perksVisible.length === 0 && valueOnlyRows.length === 0 ? (
                  <EmptyNote>No perks tracked for this card.</EmptyNote>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {perksVisible.map(p => (
                      <div key={p.id} style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        padding: '0.6rem 0.85rem', borderRadius: 8, background: '#111a2b',
                        border: '1px solid rgba(255,255,255,0.06)', opacity: p.used ? 0.45 : 1,
                      }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                          <span style={{ fontWeight: 600, color: '#fff', fontSize: '0.85rem' }}>{p.label}</span>
                          <span style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.45)' }}>
                            {p.resetCycle || '—'} · Resets {fmtDate(p.nextReset)}
                          </span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                          <MiniStat label="Annualized" value={(() => { const a = annualizedCreditAmount(p.creditAmount, p.resetCycle); return a != null ? $$(a) : '—'; })()} />
                          <MiniStat label="Your Value" value={p.value != null ? $$(p.value) : '—'} color="#00D4FF" />
                          <input type="checkbox" checked={p.used} readOnly disabled style={{ width: 16, height: 16, accentColor: '#00D4FF' }} />
                        </div>
                      </div>
                    ))}
                    {valueOnlyRows.map(v => (
                      <div key={v.id} style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        padding: '0.6rem 0.85rem', borderRadius: 8, background: '#111a2b',
                        border: '1px solid rgba(255,255,255,0.06)',
                      }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                          <span style={{ fontWeight: 600, color: '#fff', fontSize: '0.85rem' }}>{v.label}</span>
                          <span style={{
                            width: 'fit-content', fontSize: '0.65rem', fontWeight: 700, color: '#B388FF',
                            background: 'rgba(179,136,255,0.12)', border: '1px solid rgba(179,136,255,0.35)',
                            borderRadius: 20, padding: '1px 8px',
                          }}>
                            Value Only
                          </span>
                        </div>
                        <MiniStat label="Your Value" value={v.value != null ? $$(v.value) : '—'} color="#00D4FF" />
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <Divider />

              {/* Hotel Benefits */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <SectionTitle title="Hotel Benefits" count={hotelSectionCount} />
                {hotelSectionCount === 0 ? (
                  <EmptyNote>No hotel benefits tracked for this card.</EmptyNote>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {hotelsEnriched.map(h => {
                      const expiring = h.daysUntil != null && h.daysUntil <= 60;
                      return (
                        <div key={h.id} style={{
                          display: 'flex', flexDirection: 'column', gap: 4,
                          padding: '0.6rem 0.85rem', borderRadius: 8,
                          background: expiring ? 'rgba(255,215,0,0.08)' : '#111a2b',
                          border: expiring ? '1px solid rgba(255,215,0,0.35)' : '1px solid rgba(255,255,255,0.06)',
                        }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Badge color={h.recordType === 'Free Night' ? '#00D4FF' : '#00E676'}>
                              {h.recordType || 'Benefit'}
                            </Badge>
                            <span style={{ color: '#00E676', fontWeight: 700, fontSize: '0.85rem' }}>
                              {h.value != null ? $$(h.value) : '—'}
                            </span>
                          </div>
                          <div style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.6)' }}>{h.benefitType}</div>
                          <div style={{ fontSize: '0.78rem', color: expiring ? '#FFD700' : 'rgba(255,255,255,0.45)', fontWeight: expiring ? 700 : 400 }}>
                            Expires {fmtDate(h.expiration)}{h.daysUntil != null && ` (${h.daysUntil}d)`}
                          </div>
                        </div>
                      );
                    })}
                    {hotelCreditRows.map(p => (
                      <div key={p.id} style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        padding: '0.6rem 0.85rem', borderRadius: 8, background: '#111a2b',
                        border: '1px solid rgba(255,255,255,0.06)', opacity: p.used ? 0.45 : 1,
                      }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <Badge color="#00E676">Hotel Credit</Badge>
                            <span style={{ fontWeight: 600, color: '#fff', fontSize: '0.85rem' }}>{p.label}</span>
                          </div>
                          <span style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.45)' }}>
                            {p.resetCycle || '—'} · Resets {fmtDate(p.nextReset)}
                          </span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <span style={{ color: '#00D4FF', fontWeight: 700, fontSize: '0.85rem' }}>
                            {p.creditAmount != null ? `$${p.creditAmount}` : '—'}
                          </span>
                          <input type="checkbox" checked={p.used} readOnly disabled style={{ width: 16, height: 16, accentColor: '#00D4FF' }} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Sign-Up Bonus */}
              {signupRows.length > 0 && (
                <>
                  <Divider />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    <SectionTitle title="Sign-Up Bonus" />
                    {signupRows.map(r => {
                      const fr = r.fields;
                      const achieved = !!fr['Achieved'];
                      const target = fr['Spend Target'] ?? 0;
                      const current = fr['Current Spend'] ?? 0;
                      return (
                        <div key={r.id} style={{
                          display: 'flex', flexDirection: 'column', gap: 8,
                          padding: '0.75rem 0.85rem', borderRadius: 8,
                          background: '#111a2b', border: '1px solid rgba(255,255,255,0.06)',
                        }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <span style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.7)' }}>{fr['Bonus Description'] || '—'}</span>
                            {achieved && <Badge color="#00E676">Bonus Achieved</Badge>}
                          </div>
                          {!achieved && (
                            <>
                              <ProgressBar ratio={target > 0 ? current / target : 0} />
                              <div style={{ display: 'flex', gap: '1.25rem', flexWrap: 'wrap', fontSize: '0.78rem', color: 'rgba(255,255,255,0.55)' }}>
                                <span>Target {$$(target)}</span>
                                <span>Current {$$(current)}</span>
                                <span>Remaining {$$(fr['Remaining Spend'])}</span>
                              </div>
                              <div style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.5)' }}>
                                Deadline {fmtDate(fr['Effective Deadline'])}{fr['Days Remaining'] != null && ` (${fr['Days Remaining']}d remaining)`}
                              </div>
                            </>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </>
              )}

              {/* Spend Bonus */}
              {spendRows.length > 0 && (
                <>
                  <Divider />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    <SectionTitle title="Spend Bonus" />
                    {spendRows.map(r => {
                      const fr = r.fields;
                      const earned = !!fr['Bonus Earned'];
                      const target = fr['Annual Spend Target'] ?? 0;
                      const current = fr['Current Spend'] ?? 0;
                      return (
                        <div key={r.id} style={{
                          display: 'flex', flexDirection: 'column', gap: 8,
                          padding: '0.75rem 0.85rem', borderRadius: 8,
                          background: '#111a2b', border: '1px solid rgba(255,255,255,0.06)',
                        }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <span style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.7)' }}>{fr['Bonus Description'] || '—'}</span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              <MiniStat label="Your Value" value={fr['Value'] != null ? $$(fr['Value']) : '—'} color="#00D4FF" />
                              {earned && <Badge color="#00E676">Bonus Earned</Badge>}
                            </div>
                          </div>
                          {!earned && (
                            <>
                              <ProgressBar ratio={target > 0 ? current / target : 0} />
                              <div style={{ display: 'flex', gap: '1.25rem', flexWrap: 'wrap', fontSize: '0.78rem', color: 'rgba(255,255,255,0.55)' }}>
                                <span>Target {$$(target)}</span>
                                <span>Current {$$(current)}</span>
                                <span>Remaining {$$(fr['Remaining Spend'])}</span>
                              </div>
                              <div style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.5)' }}>
                                Resets {fmtDate(fr['Reset Date'])}{fr['Days Until Reset'] != null && ` (${fr['Days Until Reset']}d)`}
                              </div>
                            </>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </>
              )}

              <Divider />

              {/* Product Change Options */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <SectionTitle title="Product Change Options" />
                {upgradeIds.length === 0 && downgradeIds.length === 0 ? (
                  <EmptyNote>No product change paths available.</EmptyNote>
                ) : (
                  <>
                    {upgradeIds.length > 0 && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                          Can Upgrade To
                        </span>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          {upgradeIds.map(id => (
                            <span key={id} style={{
                              padding: '3px 10px', borderRadius: 20, fontSize: '0.78rem',
                              background: 'rgba(0,212,255,0.1)', color: '#00D4FF', border: '1px solid rgba(0,212,255,0.25)',
                            }}>
                              {products[id]?.['Product Name'] || id}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    {downgradeIds.length > 0 && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                          Can Downgrade To
                        </span>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          {downgradeIds.map(id => (
                            <span key={id} style={{
                              padding: '3px 10px', borderRadius: 20, fontSize: '0.78rem',
                              background: 'rgba(255,109,0,0.1)', color: '#FF6D00', border: '1px solid rgba(255,109,0,0.25)',
                            }}>
                              {products[id]?.['Product Name'] || id}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
