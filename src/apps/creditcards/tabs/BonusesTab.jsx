import { useState, useEffect, useCallback } from 'react';
import { fetchTable, updateRecord } from '../services/airtable.js';
import { SIGNUP_BONUSES_TABLE, SPEND_BONUSES_TABLE, PORTFOLIO_TABLE } from '../config/tables.js';
import { PEOPLE, ALL_PEOPLE } from '../config/constants.js';
import { PersonFilter } from '../components/PersonFilter.jsx';
import { StatCard } from '../components/StatCard.jsx';
import { $$ } from '../utils/format.js';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const SIGNUP_FIELDS = [
  'Bonus Description', 'Card', 'Person', 'Spend Target', 'Card Approval Date',
  'Bonus Window', 'Calculated Deadline', 'Deadline Override', 'Effective Deadline',
  'Days Remaining', 'Month 1', 'Month 2', 'Month 3', 'Month 4', 'Month 5', 'Month 6',
  'Current Spend', 'Remaining Spend', 'Achieved',
];

const SPEND_FIELDS = [
  'Bonus Description', 'Card', 'Person', 'Annual Spend Target',
  ...MONTH_NAMES, 'Current Spend', 'Remaining Spend', 'Reset Date',
  'Days Until Reset', 'Bonus Earned',
];

const cardStyle = {
  background: '#172033', borderRadius: 12, border: '1px solid rgba(255,255,255,0.08)',
  padding: '1.25rem 1.5rem',
};

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

function Stat({ label, value, color }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <span style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
        {label}
      </span>
      <span style={{ fontSize: '1rem', fontWeight: 700, color: color || '#fff' }}>{value}</span>
    </div>
  );
}

function MonthInputRow({ label, value, onChange, onSave, saving }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ width: 90, fontSize: '0.82rem', color: 'rgba(255,255,255,0.6)' }}>{label}</span>
      <input
        type="number"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder="$0.00"
        style={{
          background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)',
          borderRadius: 6, padding: '6px 10px', color: '#fff', fontSize: '0.85rem', width: 110,
        }}
      />
      <button
        type="button"
        onClick={onSave}
        disabled={saving || value === ''}
        style={{
          padding: '5px 14px', borderRadius: 8, border: '1px solid rgba(0,212,255,0.3)',
          background: saving ? 'rgba(0,212,255,0.08)' : 'rgba(0,212,255,0.15)',
          color: '#00D4FF', fontWeight: 600, fontSize: '0.78rem',
          cursor: saving || value === '' ? 'not-allowed' : 'pointer',
        }}
      >
        {saving ? 'Saving…' : 'Save'}
      </button>
    </div>
  );
}

function fmtDate(dateStr) {
  if (!dateStr) return '—';
  const [y, m, d] = dateStr.split('-');
  return `${parseInt(m)}/${parseInt(d)}/${y}`;
}

function deadlineColor(days) {
  return days != null && days < 14 ? '#FFD700' : 'rgba(255,255,255,0.5)';
}

function isPastOrToday(dateStr) {
  if (!dateStr) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(dateStr + 'T00:00:00');
  return d <= today;
}

function addYears(dateStr, years) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCFullYear(dt.getUTCFullYear() + years);
  return dt.toISOString().split('T')[0];
}

function signupMonthLabel(approvalDateStr, n) {
  if (!approvalDateStr) return `Month ${n}`;
  const [, m] = approvalDateStr.split('-').map(Number);
  const idx = (m - 1 + (n - 1)) % 12;
  return MONTH_NAMES[idx];
}

function SignupBonusCard({ row, monthInputs, setMonthInputs, savingKey, onSaveMonth, onToggleAchieved }) {
  const missingMonths = [1, 2, 3, 4, 5, 6].filter(n => row.fields[`Month ${n}`] == null);
  return (
    <div style={cardStyle}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8 }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: '1rem', color: '#fff' }}>{row.cardName}</div>
          <div style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.5)' }}>{row.personName}</div>
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8rem', color: 'rgba(255,255,255,0.6)', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={row.achieved}
            onChange={() => onToggleAchieved(row)}
            style={{ accentColor: '#00D4FF', width: 16, height: 16 }}
          />
          Achieved
        </label>
      </div>

      {row.description && (
        <div style={{ marginTop: 8, fontSize: '0.85rem', color: 'rgba(255,255,255,0.6)' }}>{row.description}</div>
      )}

      <div style={{ display: 'flex', gap: '1.5rem', marginTop: 12, flexWrap: 'wrap' }}>
        <Stat label="Spend Target" value={$$(row.spendTarget)} />
        <Stat label="Current Spend" value={$$(row.currentSpend)} color="#00D4FF" />
        <Stat label="Remaining Spend" value={$$(row.remainingSpend)} color="#00E676" />
      </div>

      <div style={{
        marginTop: 10, fontSize: '0.85rem', color: deadlineColor(row.daysRemaining),
        fontWeight: row.daysRemaining != null && row.daysRemaining < 14 ? 700 : 400,
      }}>
        Deadline: {fmtDate(row.effectiveDeadline)}{row.daysRemaining != null && ` (${row.daysRemaining} days remaining)`}
      </div>

      {!row.achieved && missingMonths.length > 0 && (
        <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {missingMonths.map(n => {
            const field = `Month ${n}`;
            const label = signupMonthLabel(row.approvalDate, n);
            const key = `${row.id}:${field}`;
            return (
              <MonthInputRow
                key={key}
                label={label}
                value={monthInputs[key] || ''}
                onChange={v => setMonthInputs(prev => ({ ...prev, [key]: v }))}
                onSave={() => onSaveMonth(SIGNUP_BONUSES_TABLE, row.id, field, true)}
                saving={savingKey === key}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

function SpendBonusCard({ row, monthInputs, setMonthInputs, savingKey, onSaveMonth, onToggleEarned }) {
  const missingMonths = MONTH_NAMES.filter(m => row.fields[m] == null);
  return (
    <div style={cardStyle}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8 }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: '1rem', color: '#fff' }}>{row.cardName}</div>
          <div style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.5)' }}>{row.personName}</div>
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8rem', color: 'rgba(255,255,255,0.6)', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={row.earned}
            onChange={() => onToggleEarned(row)}
            style={{ accentColor: '#00D4FF', width: 16, height: 16 }}
          />
          Bonus Earned
        </label>
      </div>

      {row.description && (
        <div style={{ marginTop: 8, fontSize: '0.85rem', color: 'rgba(255,255,255,0.6)' }}>{row.description}</div>
      )}

      <div style={{ display: 'flex', gap: '1.5rem', marginTop: 12, flexWrap: 'wrap' }}>
        <Stat label="Annual Spend Target" value={$$(row.annualTarget)} />
        <Stat label="Current Spend" value={$$(row.currentSpend)} color="#00D4FF" />
        <Stat label="Remaining Spend" value={$$(row.remainingSpend)} color="#00E676" />
      </div>

      <div style={{
        marginTop: 10, fontSize: '0.85rem', color: deadlineColor(row.daysUntilReset),
        fontWeight: row.daysUntilReset != null && row.daysUntilReset < 14 ? 700 : 400,
      }}>
        Reset: {fmtDate(row.resetDate)}{row.daysUntilReset != null && ` (${row.daysUntilReset} days)`}
      </div>

      {!row.earned && missingMonths.length > 0 && (
        <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {missingMonths.map(m => {
            const key = `${row.id}:${m}`;
            return (
              <MonthInputRow
                key={key}
                label={m}
                value={monthInputs[key] || ''}
                onChange={v => setMonthInputs(prev => ({ ...prev, [key]: v }))}
                onSave={() => onSaveMonth(SPEND_BONUSES_TABLE, row.id, m, false)}
                saving={savingKey === key}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

export function BonusesTab() {
  const [view, setView] = useState('signup');
  const [personFilter, setPersonFilter] = useState(ALL_PEOPLE);
  const [showActiveOnly, setShowActiveOnly] = useState(true);
  const [loading, setLoading] = useState(true);
  const [resetStatus, setResetStatus] = useState('');
  const [signupBonuses, setSignupBonuses] = useState([]);
  const [spendBonuses, setSpendBonuses] = useState([]);
  const [cardNameById, setCardNameById] = useState({});
  const [monthInputs, setMonthInputs] = useState({});
  const [savingKey, setSavingKey] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setResetStatus('');

    const [signup, spend, cards] = await Promise.all([
      fetchTable(SIGNUP_BONUSES_TABLE, SIGNUP_FIELDS),
      fetchTable(SPEND_BONUSES_TABLE, SPEND_FIELDS),
      fetchTable(PORTFOLIO_TABLE, ['Card Name']),
    ]);

    setCardNameById(Object.fromEntries(cards.map(r => [r.id, r.fields['Card Name'] || r.id])));

    const toReset = spend.filter(r => isPastOrToday(r.fields['Reset Date']));
    if (toReset.length > 0) {
      setResetStatus(`Resetting ${toReset.length} bonus${toReset.length > 1 ? 'es' : ''}...`);
      await Promise.all(toReset.map(async r => {
        const patch = {};
        MONTH_NAMES.forEach(m => { patch[m] = 0; });
        patch['Bonus Earned'] = false;
        patch['Reset Date'] = addYears(r.fields['Reset Date'], 1);
        try {
          const updated = await updateRecord(SPEND_BONUSES_TABLE, r.id, patch);
          r.fields = updated.fields;
        } catch (e) {
          console.error('Spend bonus reset failed for', r.id, e);
        }
      }));
      setResetStatus('');
    }

    setSignupBonuses(signup);
    setSpendBonuses(spend);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function saveMonth(tableId, recordId, field, isSignup) {
    const key = `${recordId}:${field}`;
    const value = parseFloat(monthInputs[key]);
    if (Number.isNaN(value)) return;
    setSavingKey(key);
    const setter = isSignup ? setSignupBonuses : setSpendBonuses;
    try {
      const updated = await updateRecord(tableId, recordId, { [field]: value });
      setter(prev => prev.map(r => r.id === recordId ? { ...r, fields: updated.fields } : r));
      setMonthInputs(prev => { const n = { ...prev }; delete n[key]; return n; });
    } catch (e) {
      console.error('Save month failed', e);
    } finally {
      setSavingKey(null);
    }
  }

  async function toggleFlag(tableId, recordId, field, currentValue, isSignup) {
    const setter = isSignup ? setSignupBonuses : setSpendBonuses;
    const newVal = !currentValue;
    setter(prev => prev.map(r => r.id === recordId ? { ...r, fields: { ...r.fields, [field]: newVal } } : r));
    try {
      await updateRecord(tableId, recordId, { [field]: newVal });
    } catch (e) {
      console.error('Toggle failed', e);
      setter(prev => prev.map(r => r.id === recordId ? { ...r, fields: { ...r.fields, [field]: currentValue } } : r));
    }
  }

  const signupEnriched = signupBonuses.map(r => {
    const f = r.fields;
    const cardId = (f['Card'] || [])[0];
    const personId = (f['Person'] || [])[0];
    return {
      id: r.id,
      cardName: cardId ? (cardNameById[cardId] || '—') : '—',
      personName: personId ? (PEOPLE[personId] || '—') : '—',
      description: f['Bonus Description'] || '',
      spendTarget: f['Spend Target'] ?? null,
      currentSpend: f['Current Spend'] ?? 0,
      remainingSpend: f['Remaining Spend'] ?? null,
      approvalDate: f['Card Approval Date'] || '',
      effectiveDeadline: f['Effective Deadline'] || '',
      daysRemaining: f['Days Remaining'] ?? null,
      achieved: !!f['Achieved'],
      fields: f,
    };
  });

  const signupVisible = signupEnriched.filter(row => personFilter === ALL_PEOPLE || row.personName === personFilter);
  const signupActive = signupVisible.filter(row => !row.achieved);
  const signupActiveCount = signupActive.length;
  const signupActiveRemaining = signupActive.reduce((s, row) => s + (row.remainingSpend ?? 0), 0);

  const signupSorted = [...signupVisible.filter(row => !showActiveOnly || !row.achieved)].sort((a, b) => {
    if (a.daysRemaining == null && b.daysRemaining == null) return 0;
    if (a.daysRemaining == null) return 1;
    if (b.daysRemaining == null) return -1;
    return a.daysRemaining - b.daysRemaining;
  });

  const spendEnriched = spendBonuses.map(r => {
    const f = r.fields;
    const cardId = (f['Card'] || [])[0];
    const personId = (f['Person'] || [])[0];
    return {
      id: r.id,
      cardName: cardId ? (cardNameById[cardId] || '—') : '—',
      personName: personId ? (PEOPLE[personId] || '—') : '—',
      description: f['Bonus Description'] || '',
      annualTarget: f['Annual Spend Target'] ?? null,
      currentSpend: f['Current Spend'] ?? 0,
      remainingSpend: f['Remaining Spend'] ?? null,
      resetDate: f['Reset Date'] || '',
      daysUntilReset: f['Days Until Reset'] ?? null,
      earned: !!f['Bonus Earned'],
      fields: f,
    };
  });

  const spendVisible = spendEnriched.filter(row => personFilter === ALL_PEOPLE || row.personName === personFilter);
  const spendActive = spendVisible.filter(row => !row.earned);
  const spendActiveCount = spendActive.length;
  const spendActiveRemaining = spendActive.reduce((s, row) => s + (row.remainingSpend ?? 0), 0);

  const spendSorted = [...spendVisible.filter(row => !showActiveOnly || !row.earned)].sort((a, b) => {
    if (a.daysUntilReset == null && b.daysUntilReset == null) return 0;
    if (a.daysUntilReset == null) return 1;
    if (b.daysUntilReset == null) return -1;
    return a.daysUntilReset - b.daysUntilReset;
  });

  if (loading) {
    return (
      <div style={{ padding: '3rem', textAlign: 'center', color: 'rgba(255,255,255,0.4)' }}>
        {resetStatus || 'Loading…'}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', maxWidth: 1100 }}>

      <div style={{ display: 'flex', gap: 8 }}>
        <PillBtn active={view === 'signup'} onClick={() => setView('signup')}>Sign-Up Bonuses</PillBtn>
        <PillBtn active={view === 'spend'} onClick={() => setView('spend')}>Spend Bonuses</PillBtn>
      </div>

      <div style={cardStyle}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600, marginRight: 4 }}>
              Person
            </span>
            <PersonFilter selected={personFilter} onChange={setPersonFilter} />
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8rem', color: 'rgba(255,255,255,0.6)', cursor: 'pointer', width: 'fit-content' }}>
            <input
              type="checkbox"
              checked={showActiveOnly}
              onChange={e => setShowActiveOnly(e.target.checked)}
              style={{ accentColor: '#00D4FF', width: 15, height: 15 }}
            />
            Show Active Only
          </label>
        </div>
      </div>

      {resetStatus && (
        <div style={{
          background: 'rgba(0,212,255,0.08)', border: '1px solid rgba(0,212,255,0.25)',
          borderRadius: 10, padding: '0.75rem 1rem', color: '#00D4FF', fontSize: '0.85rem', fontWeight: 600,
        }}>
          {resetStatus}
        </div>
      )}

      {view === 'signup' ? (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, auto)', gap: '1rem', width: 'fit-content' }}>
            <StatCard label="Active Bonuses" value={signupActiveCount} accent="#00D4FF" />
            <StatCard label="Total Remaining Spend" value={$$(signupActiveRemaining)} accent="#00E676" />
          </div>

          {signupSorted.length === 0 ? (
            <div style={{ ...cardStyle, textAlign: 'center', color: 'rgba(255,255,255,0.35)' }}>
              No sign-up bonuses match the current filters.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {signupSorted.map(row => (
                <SignupBonusCard
                  key={row.id}
                  row={row}
                  monthInputs={monthInputs}
                  setMonthInputs={setMonthInputs}
                  savingKey={savingKey}
                  onSaveMonth={saveMonth}
                  onToggleAchieved={r => toggleFlag(SIGNUP_BONUSES_TABLE, r.id, 'Achieved', r.achieved, true)}
                />
              ))}
            </div>
          )}
        </>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, auto)', gap: '1rem', width: 'fit-content' }}>
            <StatCard label="Active Bonuses" value={spendActiveCount} accent="#00D4FF" />
            <StatCard label="Total Remaining Spend" value={$$(spendActiveRemaining)} accent="#00E676" />
          </div>

          {spendSorted.length === 0 ? (
            <div style={{ ...cardStyle, textAlign: 'center', color: 'rgba(255,255,255,0.35)' }}>
              No spend bonuses match the current filters.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {spendSorted.map(row => (
                <SpendBonusCard
                  key={row.id}
                  row={row}
                  monthInputs={monthInputs}
                  setMonthInputs={setMonthInputs}
                  savingKey={savingKey}
                  onSaveMonth={saveMonth}
                  onToggleEarned={r => toggleFlag(SPEND_BONUSES_TABLE, r.id, 'Bonus Earned', r.earned, false)}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
