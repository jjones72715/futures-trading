import { useState, useEffect, useCallback, useMemo } from 'react';
import { fetchTable, createRecord, updateRecord } from '../services/airtable.js';
import {
  CARD_PRODUCTS_TABLE, PERK_DEFINITIONS_TABLE, CARD_POTENTIAL_VALUES_TABLE, BANKS_TABLE,
} from '../config/tables.js';
import { StatCard } from '../components/StatCard.jsx';
import { $$ } from '../utils/format.js';

const PERSONS = ['Jonathan', 'Cherelyn', 'Business'];
const PERSON_COLORS = { Jonathan: '#00D4FF', Cherelyn: '#B388FF', Business: '#FFD60A' };
const TYPE_OPTIONS = ['All', 'Personal', 'Business'];

const CARD_PRODUCT_FIELDS = ['Product Name', 'Issuer', 'Personal/Business', 'Annual Fee'];
const PERK_DEF_FIELDS = ['Perk Name', 'Card Product', 'Credit Amount', 'Notes'];
const CPV_FIELDS = ['Name', 'Card Product', 'Person', 'Perk Definition', 'Estimated Value', 'Realization %', 'Notes', 'Last Audited'];
const BANK_FIELDS = ['Bank Name'];

const cardStyle = {
  background: '#172033', borderRadius: 12, border: '1px solid rgba(255,255,255,0.08)',
  padding: '1.25rem 1.5rem',
};

const inp = {
  width: '100%', background: '#0B1220', border: '1px solid rgba(255,255,255,0.12)',
  borderRadius: 8, padding: '0.6rem 0.75rem', color: '#fff', fontSize: '0.88rem',
  outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit',
};

const lbl = {
  display: 'block', fontSize: '0.7rem', fontWeight: 600,
  color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase',
  letterSpacing: '0.05em', marginBottom: 5,
};

function todayStr() {
  return new Date().toISOString().split('T')[0];
}

function fmtDateStr(s) {
  if (!s) return '—';
  const [y, m, d] = s.split('-');
  return `${parseInt(m)}/${parseInt(d)}/${y}`;
}

function PillBtn({ active, onClick, children }) {
  return (
    <button type="button" onClick={onClick} style={{
      padding: '6px 16px', borderRadius: 20, border: '1px solid rgba(255,255,255,0.12)',
      background: active ? '#00D4FF' : 'rgba(255,255,255,0.06)',
      color: active ? '#0B1220' : 'rgba(255,255,255,0.6)',
      fontWeight: active ? 700 : 400, cursor: 'pointer', fontSize: '0.85rem',
      transition: 'all 0.15s', whiteSpace: 'nowrap',
    }}>
      {children}
    </button>
  );
}

function PersonPillBtn({ active, person, onClick }) {
  const color = PERSON_COLORS[person];
  return (
    <button type="button" onClick={onClick} style={{
      padding: '6px 16px', borderRadius: 20, border: `1px solid ${active ? color : 'rgba(255,255,255,0.12)'}`,
      background: active ? color : 'rgba(255,255,255,0.06)',
      color: active ? '#0B1220' : 'rgba(255,255,255,0.6)',
      fontWeight: active ? 700 : 400, cursor: 'pointer', fontSize: '0.85rem',
      transition: 'all 0.15s', whiteSpace: 'nowrap',
    }}>
      {person}
    </button>
  );
}

function FilterRow({ label, children }) {
  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
      <span style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600, marginRight: 4 }}>
        {label}
      </span>
      {children}
    </div>
  );
}

function SlideOver({ onClose, width = 640, children }) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000 }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)' }} />
      <div style={{
        position: 'absolute', top: 0, right: 0, height: '100%', width, maxWidth: '92vw',
        background: '#0B1220', borderLeft: '1px solid rgba(255,255,255,0.1)',
        boxShadow: '-8px 0 24px rgba(0,0,0,0.4)', overflowY: 'auto', padding: '1.5rem',
        animation: 'cpvPanelSlideIn 0.2s ease-out',
      }}>
        <style>{'@keyframes cpvPanelSlideIn { from { transform: translateX(100%); } to { transform: translateX(0); } }'}</style>
        {children}
      </div>
    </div>
  );
}

function SlideOverHeader({ title, onClose }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
      <div style={{ fontWeight: 700, fontSize: '1.05rem', color: '#fff', paddingRight: '1rem' }}>{title}</div>
      <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', fontSize: '1.4rem', cursor: 'pointer', lineHeight: 1, flexShrink: 0 }}>
        ×
      </button>
    </div>
  );
}

function netValueColor(net) {
  if (net == null) return 'rgba(255,255,255,0.35)';
  return net > 0 ? '#22c55e' : '#ef4444';
}

function CardTile({ product, onOpen }) {
  const { name, issuerName, annualFee, isAudited, displayPerson, displayTotal, displayNet, auditedPersons } = product;
  return (
    <div
      onClick={() => onOpen(product)}
      style={{
        ...cardStyle, cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 10,
        border: isAudited ? '1px solid rgba(255,255,255,0.08)' : '1px dashed rgba(255,255,255,0.18)',
        transition: 'border-color 0.15s',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
        <div>
          <div style={{ fontWeight: 700, color: '#fff', fontSize: '0.95rem' }}>{name}</div>
          <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.45)', marginTop: 2 }}>{issuerName}</div>
        </div>
        {!isAudited && (
          <span style={{
            padding: '2px 10px', borderRadius: 20, fontSize: '0.68rem', fontWeight: 700,
            background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.4)', whiteSpace: 'nowrap',
          }}>
            Not yet audited
          </span>
        )}
      </div>

      {auditedPersons.length > 0 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {auditedPersons.map(p => (
            <span key={p} style={{
              padding: '2px 9px', borderRadius: 20, fontSize: '0.68rem', fontWeight: 700,
              background: PERSON_COLORS[p] + '22', color: PERSON_COLORS[p], border: `1px solid ${PERSON_COLORS[p]}55`,
            }}>
              {p}
            </span>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem' }}>
        <span style={{ color: 'rgba(255,255,255,0.5)' }}>Annual Fee</span>
        <span style={{ color: '#fff', fontWeight: 600 }}>{$$(annualFee)}</span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem' }}>
        <span style={{ color: 'rgba(255,255,255,0.5)' }}>
          Total Est. Value{displayPerson ? ` (${displayPerson})` : ''}
        </span>
        <span style={{ color: '#fff', fontWeight: 600 }}>{isAudited ? $$(displayTotal) : '—'}</span>
      </div>

      <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <span style={{ color: 'rgba(255,255,255,0.6)', fontWeight: 600, fontSize: '0.85rem' }}>Net Value</span>
        <span style={{ color: netValueColor(displayNet), fontWeight: 800, fontSize: '1.3rem' }}>
          {isAudited ? `${displayNet > 0 ? '+' : ''}${$$(displayNet)}` : '—'}
        </span>
      </div>

      {!isAudited && (
        <button type="button" onClick={(e) => { e.stopPropagation(); onOpen(product); }} style={{
          padding: '0.5rem 1rem', borderRadius: 8, border: '1px solid rgba(0,212,255,0.3)',
          background: 'rgba(0,212,255,0.12)', color: '#00D4FF', fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer',
        }}>
          Run Audit
        </button>
      )}
    </div>
  );
}

function PerkRow({ perk, cpvRow, onSave }) {
  const existingValue = cpvRow?.fields?.['Estimated Value'];
  const existingPct = cpvRow?.fields?.['Realization %'];
  const existingNotes = cpvRow?.fields?.['Notes'];

  const [value, setValue] = useState(existingValue != null ? String(existingValue) : '');
  const [pct, setPct] = useState(existingPct != null ? String(Math.round(existingPct * 100)) : '');
  const [notes, setNotes] = useState(existingNotes || '');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setValue(existingValue != null ? String(existingValue) : '');
    setPct(existingPct != null ? String(Math.round(existingPct * 100)) : '');
    setNotes(existingNotes || '');
  }, [cpvRow?.id, existingValue, existingPct, existingNotes]);

  const hasRow = !!cpvRow;
  const faceValue = perk.fields['Credit Amount'];

  async function commit(field, raw) {
    let patchValue;
    if (field === 'Estimated Value') {
      patchValue = raw === '' ? null : parseFloat(raw);
      if (patchValue === existingValue || (patchValue == null && existingValue == null)) return;
    } else if (field === 'Realization %') {
      patchValue = raw === '' ? null : parseFloat(raw) / 100;
      if (patchValue === existingPct || (patchValue == null && existingPct == null)) return;
    } else {
      patchValue = raw;
      if (patchValue === (existingNotes || '')) return;
    }
    setSaving(true);
    try {
      await onSave(perk, cpvRow, { [field]: patchValue });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '1.5fr 100px 110px 80px 1.4fr', gap: 10, alignItems: 'center',
      padding: '0.6rem 0.75rem', borderRadius: 8, background: '#172033',
      border: hasRow ? '1px solid rgba(255,255,255,0.06)' : '1px dashed rgba(255,255,255,0.15)',
    }}>
      <span style={{ color: '#fff', fontSize: '0.85rem', fontWeight: 600 }}>{perk.fields['Perk Name'] || '—'}</span>
      <div>
        <div style={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', fontWeight: 600 }}>FM Face</div>
        <div style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.4)' }}>{faceValue != null ? $$(faceValue) : '—'}</div>
      </div>
      <input
        type="number"
        value={value}
        onChange={e => setValue(e.target.value)}
        onBlur={e => commit('Estimated Value', e.target.value)}
        placeholder="Add value"
        disabled={saving}
        style={{
          ...inp, padding: '5px 8px', fontSize: '0.85rem', fontWeight: hasRow ? 700 : 400,
          color: hasRow ? '#fff' : 'rgba(255,255,255,0.5)',
        }}
      />
      <input
        type="number"
        value={pct}
        onChange={e => setPct(e.target.value)}
        onBlur={e => commit('Realization %', e.target.value)}
        placeholder="%"
        disabled={saving}
        style={{ ...inp, padding: '5px 6px', fontSize: '0.8rem' }}
        title="Realization % (optional, informational only)"
      />
      <input
        type="text"
        value={notes}
        onChange={e => setNotes(e.target.value)}
        onBlur={e => commit('Notes', e.target.value)}
        placeholder="Notes…"
        disabled={saving}
        style={{ ...inp, padding: '5px 8px', fontSize: '0.8rem' }}
      />
    </div>
  );
}

function ExpandedPanel({ product, person, perkDefs, cpvByKey, onClose, onPersonChange, onSaveRow }) {
  const defs = perkDefs || [];
  let totalFace = 0;
  let totalEst = 0;
  let lastAudited = null;
  defs.forEach(def => {
    if (def.fields['Credit Amount'] != null) totalFace += def.fields['Credit Amount'];
    const row = cpvByKey[`${product.id}::${person}::${def.id}`];
    if (row?.fields?.['Estimated Value'] != null) totalEst += row.fields['Estimated Value'];
    const audited = row?.fields?.['Last Audited'];
    if (audited && (!lastAudited || audited > lastAudited)) lastAudited = audited;
  });
  const netValue = totalEst - (product.annualFee || 0);

  return (
    <SlideOver onClose={onClose}>
      <SlideOverHeader title={`${product.name} — Potential Value Audit`} onClose={onClose} />

      <div style={{ marginBottom: '1.25rem' }}>
        <label style={lbl}>Person</label>
        <div style={{ display: 'flex', gap: 8 }}>
          {PERSONS.map(p => (
            <PersonPillBtn key={p} person={p} active={person === p} onClick={() => onPersonChange(p)} />
          ))}
        </div>
      </div>

      {defs.length === 0 ? (
        <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: '0.85rem', marginBottom: '1.25rem' }}>
          No perks defined for this card product yet.
        </div>
      ) : (
        <>
          <div style={{
            display: 'grid', gridTemplateColumns: '1.5fr 100px 110px 80px 1.4fr', gap: 10,
            padding: '0.25rem 0.75rem', fontSize: '0.64rem', color: 'rgba(255,255,255,0.3)',
            textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600, marginBottom: 6,
          }}>
            <span>Perk</span>
            <span>FM Face</span>
            <span>Your Value</span>
            <span>Realize %</span>
            <span>Notes</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: '1.25rem' }}>
            {defs.map(def => (
              <PerkRow
                key={def.id}
                perk={def}
                cpvRow={cpvByKey[`${product.id}::${person}::${def.id}`]}
                onSave={onSaveRow}
              />
            ))}
          </div>
        </>
      )}

      <div style={{ ...cardStyle, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
          <span style={{ color: 'rgba(255,255,255,0.6)' }}>Total FM Face Value</span>
          <span style={{ color: 'rgba(255,255,255,0.5)', fontWeight: 600 }}>{$$(totalFace)}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
          <span style={{ color: 'rgba(255,255,255,0.6)' }}>Total Estimated Value</span>
          <span style={{ color: '#fff', fontWeight: 700 }}>{$$(totalEst)}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
          <span style={{ color: 'rgba(255,255,255,0.6)' }}>Annual Fee</span>
          <span style={{ color: '#fff', fontWeight: 700 }}>−{$$(product.annualFee)}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.95rem', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 8 }}>
          <span style={{ color: 'rgba(255,255,255,0.7)', fontWeight: 700 }}>Net Value</span>
          <span style={{ color: netValueColor(netValue), fontWeight: 800 }}>
            {netValue > 0 ? '+' : ''}{$$(netValue)}
          </span>
        </div>
      </div>
      <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.35)', marginTop: 8 }}>
        Last audited: {fmtDateStr(lastAudited)}
      </div>
    </SlideOver>
  );
}

export function CardPotentialValuesTab() {
  const [products, setProducts] = useState([]);
  const [perkDefs, setPerkDefs] = useState([]);
  const [cpvRows, setCpvRows] = useState([]);
  const [banksById, setBanksById] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [personFilter, setPersonFilter] = useState('All');
  const [issuerFilter, setIssuerFilter] = useState('All');
  const [typeFilter, setTypeFilter] = useState('All');
  const [expanded, setExpanded] = useState(null); // { productId, person }

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [productRows, perkDefRows, cpvRowsData, bankRows] = await Promise.all([
        fetchTable(CARD_PRODUCTS_TABLE, CARD_PRODUCT_FIELDS),
        fetchTable(PERK_DEFINITIONS_TABLE, PERK_DEF_FIELDS),
        fetchTable(CARD_POTENTIAL_VALUES_TABLE, CPV_FIELDS),
        fetchTable(BANKS_TABLE, BANK_FIELDS),
      ]);
      setProducts(productRows);
      setPerkDefs(perkDefRows);
      setCpvRows(cpvRowsData);
      setBanksById(Object.fromEntries(bankRows.map(r => [r.id, r.fields['Bank Name']])));
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const perkDefsByProduct = useMemo(() => {
    const map = {};
    perkDefs.forEach(r => {
      (r.fields['Card Product'] || []).forEach(pid => {
        if (!map[pid]) map[pid] = [];
        map[pid].push(r);
      });
    });
    return map;
  }, [perkDefs]);

  const cpvByKey = useMemo(() => {
    const map = {};
    cpvRows.forEach(r => {
      const pid = (r.fields['Card Product'] || [])[0];
      const person = r.fields['Person'];
      const perkId = (r.fields['Perk Definition'] || [])[0];
      if (!pid || !person || !perkId) return;
      map[`${pid}::${person}::${perkId}`] = r;
    });
    return map;
  }, [cpvRows]);

  const personsAuditedByProduct = useMemo(() => {
    const map = {};
    cpvRows.forEach(r => {
      const pid = (r.fields['Card Product'] || [])[0];
      const person = r.fields['Person'];
      if (!pid || !person) return;
      if (!map[pid]) map[pid] = new Set();
      map[pid].add(person);
    });
    return map;
  }, [cpvRows]);

  function totalForPersonCard(productId, person) {
    const defs = perkDefsByProduct[productId] || [];
    let total = 0;
    defs.forEach(def => {
      const row = cpvByKey[`${productId}::${person}::${def.id}`];
      if (row?.fields?.['Estimated Value'] != null) total += row.fields['Estimated Value'];
    });
    return total;
  }

  const enriched = useMemo(() => {
    return products.map(p => {
      const issuerId = (p.fields['Issuer'] || [])[0];
      const issuerName = banksById[issuerId] || 'Unknown';
      const annualFee = p.fields['Annual Fee'] ?? 0;
      const type = p.fields['Personal/Business'] || null;
      const auditedSet = personsAuditedByProduct[p.id] || new Set();
      const auditedPersons = PERSONS.filter(per => auditedSet.has(per));

      let displayPerson = null;
      let displayTotal = 0;
      let displayNet = null;
      let isAudited = false;

      if (personFilter !== 'All') {
        displayPerson = personFilter;
        isAudited = auditedSet.has(personFilter);
        if (isAudited) {
          displayTotal = totalForPersonCard(p.id, personFilter);
          displayNet = displayTotal - annualFee;
        }
      } else if (auditedPersons.length > 0) {
        let best = auditedPersons[0];
        let bestNet = totalForPersonCard(p.id, best) - annualFee;
        auditedPersons.slice(1).forEach(per => {
          const net = totalForPersonCard(p.id, per) - annualFee;
          if (net > bestNet) { best = per; bestNet = net; }
        });
        displayPerson = best;
        displayTotal = totalForPersonCard(p.id, best);
        displayNet = bestNet;
        isAudited = true;
      }

      return {
        id: p.id,
        name: p.fields['Product Name'] || '—',
        issuerName,
        annualFee,
        type,
        auditedPersons,
        isAudited,
        displayPerson,
        displayTotal,
        displayNet,
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [products, banksById, personsAuditedByProduct, perkDefsByProduct, cpvByKey, personFilter]);

  const issuerOptions = useMemo(() => {
    return ['All', ...new Set(enriched.map(p => p.issuerName))].sort((a, b) => a === 'All' ? -1 : b === 'All' ? 1 : a.localeCompare(b));
  }, [enriched]);

  const filtered = enriched.filter(p => {
    if (issuerFilter !== 'All' && p.issuerName !== issuerFilter) return false;
    if (typeFilter !== 'All' && p.type !== typeFilter) return false;
    if (personFilter !== 'All' && !p.auditedPersons.includes(personFilter)) return false;
    return true;
  });

  const sorted = [...filtered].sort((a, b) => {
    const an = a.displayNet ?? -Infinity;
    const bn = b.displayNet ?? -Infinity;
    return bn - an;
  });

  const auditedCount = filtered.filter(p => p.isAudited).length;
  const positiveCount = filtered.filter(p => p.displayNet != null && p.displayNet > 0).length;

  function openProduct(p) {
    const person = personFilter !== 'All' ? personFilter : (p.displayPerson || 'Jonathan');
    setExpanded({ productId: p.id, person });
  }

  async function handleSaveRow(perk, cpvRow, patch) {
    if (cpvRow) {
      const updated = await updateRecord(CARD_POTENTIAL_VALUES_TABLE, cpvRow.id, { ...patch, 'Last Audited': todayStr() });
      setCpvRows(prev => prev.map(r => r.id === updated.id ? updated : r));
    } else {
      const product = products.find(p => p.id === expanded.productId);
      const fields = {
        'Name': `${product?.fields?.['Product Name'] || 'Card'} — ${expanded.person} — ${perk.fields['Perk Name'] || 'Perk'}`,
        'Card Product': [expanded.productId],
        'Person': expanded.person,
        'Perk Definition': [perk.id],
        'Last Audited': todayStr(),
        ...patch,
      };
      const created = await createRecord(CARD_POTENTIAL_VALUES_TABLE, fields);
      setCpvRows(prev => [...prev, created]);
    }
  }

  if (loading) {
    return (
      <div style={{ padding: '3rem', textAlign: 'center', color: 'rgba(255,255,255,0.4)' }}>
        Loading card products…
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '2rem', color: '#FF4D4D' }}>
        Error: {error}
      </div>
    );
  }

  const expandedProduct = expanded ? enriched.find(p => p.id === expanded.productId) : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
        <StatCard label="Card Products" value={filtered.length} accent="#00D4FF" />
        <StatCard label="Audited" value={auditedCount} accent="#B388FF" />
        <StatCard label="Positive Net Value" value={positiveCount} accent="#22c55e" />
      </div>

      <div style={{ ...cardStyle, display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        <FilterRow label="Person">
          <PillBtn active={personFilter === 'All'} onClick={() => setPersonFilter('All')}>All</PillBtn>
          {PERSONS.map(p => (
            <PersonPillBtn key={p} person={p} active={personFilter === p} onClick={() => setPersonFilter(p)} />
          ))}
        </FilterRow>
        <FilterRow label="Bank">
          {issuerOptions.map(opt => (
            <PillBtn key={opt} active={issuerFilter === opt} onClick={() => setIssuerFilter(opt)}>{opt}</PillBtn>
          ))}
        </FilterRow>
        <FilterRow label="Type">
          {TYPE_OPTIONS.map(opt => (
            <PillBtn key={opt} active={typeFilter === opt} onClick={() => setTypeFilter(opt)}>{opt}</PillBtn>
          ))}
        </FilterRow>
      </div>

      {sorted.length === 0 ? (
        <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.3)', padding: '3rem' }}>
          No card products match the current filters.
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
          {sorted.map(p => (
            <CardTile key={p.id} product={p} onOpen={openProduct} />
          ))}
        </div>
      )}

      {expanded && expandedProduct && (
        <ExpandedPanel
          product={expandedProduct}
          person={expanded.person}
          perkDefs={perkDefsByProduct[expanded.productId] || []}
          cpvByKey={cpvByKey}
          onClose={() => setExpanded(null)}
          onPersonChange={person => setExpanded(e => ({ ...e, person }))}
          onSaveRow={handleSaveRow}
        />
      )}
    </div>
  );
}
