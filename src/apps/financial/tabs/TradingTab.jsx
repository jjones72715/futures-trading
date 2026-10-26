import { useEffect, useState } from 'react';
import { useTables } from '../hooks/useTables.js';
import { T } from '../config/airtable.js';
import SectionHeader from '../components/SectionHeader.jsx';
import StatCard from '../components/StatCard.jsx';
import { useRecordEditor } from '../components/Modal.jsx';
import BalanceUpdatePanel, { PanelNotes } from '../components/BalanceUpdatePanel.jsx';
import SidePanel, { PanelSection, PanelRow } from '../components/SidePanel.jsx';
import CurrencyInput from '../components/CurrencyInput.jsx';
import { StatusDot, StatusPill } from '../components/Status.jsx';
import { updateRecord } from '../services/financialService.js';
import { useCycle, cycleStatus, useRecordStatus, staleFirst, LAST_UPDATED } from '../hooks/useCycle.jsx';
import {
  Chip, Delta, EmptyState, ErrorBanner, Skel, SkeletonGrid, SkeletonStats, SkeletonTable,
} from '../components/ui.jsx';
import { formatCurrency, formatDate, distinct, sumField, num, localIsoDate, parseAmount } from '../utils/formatters.js';

const KEYS = [T.TRADING_PLATFORMS, T.TRADING_LIQUIDATION, T.SPECIAL_PROJECTS];

const round2 = (n) => Math.round(n * 100) / 100;
const toInput = (v) => (v == null ? '' : String(v));

// Available Balance = Total Earned − Total Spent. Until a project's running totals are set,
// fall back to the Available Balance value stored on the record.
const hasTotals = (f) => f['Total Earned'] != null || f['Total Spent'] != null;
const projectAvailable = (f) => (hasTotals(f) ? num(f['Total Earned']) - num(f['Total Spent']) : f['Available Balance']);

const PROJECT_FIELDS = [
  ['This Month Earned', 'var(--positive)'],
  ['Last Month Earned', null],
  ['This Month Spent', 'var(--negative)'],
  ['Last Month Spent', null],
];

export default function TradingTab() {
  const { data, loading, error, reload } = useTables(KEYS);
  const [showClosed, setShowClosed] = useState(false);
  const [selected, setSelected] = useState(null); // { kind: 'platform' | 'project', id }
  const statusOf = useRecordStatus();

  const platforms = data[T.TRADING_PLATFORMS];
  const liquidation = data[T.TRADING_LIQUIDATION][0];
  const projects = data[T.SPECIAL_PROJECTS];

  const platformEditor = useRecordEditor({ table: T.TRADING_PLATFORMS, noun: 'Platform', reload, suggestions: { Owner: distinct(platforms, 'Owner') } });
  const liquidationEditor = useRecordEditor({ table: T.TRADING_LIQUIDATION, noun: 'Liquidation Invested', reload, allowDelete: false });
  const projectEditor = useRecordEditor({ table: T.SPECIAL_PROJECTS, noun: 'Special Project', reload });

  const platformTotal = sumField(platforms, 'Current Balance');
  const platformPrev = sumField(platforms, 'Previous Balance');
  const liqCurrent = num(liquidation?.fields['Current Balance']);

  const closedCount = projects.filter(p => p.fields.Status === 'Closed').length;
  const visibleProjects = staleFirst(projects
    .filter(p => showClosed || p.fields.Status !== 'Closed')
    .sort((a, b) => (a.fields.Status === 'Closed') - (b.fields.Status === 'Closed')), statusOf);
  const sortedPlatforms = staleFirst(
    [...platforms].sort((a, b) => num(b.fields['Current Balance']) - num(a.fields['Current Balance'])), statusOf);

  const selectedPlatform = selected?.kind === 'platform' ? platforms.find(r => r.id === selected.id) : null;
  const selectedProject = selected?.kind === 'project' ? projects.find(r => r.id === selected.id) : null;
  const isSel = (kind, id) => selected?.kind === kind && selected.id === id;

  return (
    <div className={selectedPlatform || selectedProject ? 'fin-has-panel' : undefined}>
      <ErrorBanner error={error} />

      {loading ? <SkeletonStats count={3} /> : (
        <div className="fin-stats">
          <StatCard label="Platform Balances" value={formatCurrency(platformTotal)} accent="var(--text)" />
          <StatCard label="Liquidation Invested" value={formatCurrency(liqCurrent)} accent="var(--text)" />
          <StatCard label="Trading Total" value={formatCurrency(platformTotal + liqCurrent)} accent="var(--accent)" />
        </div>
      )}

      {/* ---- Platform Balances ---- */}
      <div className="fin-section">
        <SectionHeader title="Platform Balances" count={loading ? null : platforms.length} onAdd={() => platformEditor.open()} />
        {loading ? <SkeletonTable rows={3} /> : platforms.length === 0 ? (
          <EmptyState icon="📊" message="No trading platforms yet." actionLabel="Add platform" onAction={() => platformEditor.open()} />
        ) : (
          <div className="fin-table-wrap">
            <table className="fin-table compact">
              <thead>
                <tr><th className="status-col">Up to Date</th><th>Platform</th><th>Owner</th><th className="num">Current Balance</th><th className="num">Previous Balance</th><th>Delta</th><th /></tr>
              </thead>
              <tbody>
                {sortedPlatforms.map(r => (
                  <tr key={r.id} className={`row${isSel('platform', r.id) ? ' selected' : ''}`} onClick={() => setSelected({ kind: 'platform', id: r.id })}>
                    <td className="status-col"><StatusDot status={statusOf(r)} /></td>
                    <td style={{ fontWeight: 600 }}>
                      {r.fields['Platform Name']}
                      {r.fields.Notes && <div className="fin-faint" style={{ fontSize: '0.72rem', fontWeight: 400, whiteSpace: 'normal' }}>{r.fields.Notes}</div>}
                    </td>
                    <td>{r.fields.Owner ? <Chip>{r.fields.Owner}</Chip> : '—'}</td>
                    <td className="num" style={{ fontWeight: 700, fontSize: '0.95rem' }}>{formatCurrency(r.fields['Current Balance'])}</td>
                    <td className="num fin-muted">{formatCurrency(r.fields['Previous Balance'])}</td>
                    <td><Delta current={r.fields['Current Balance']} previous={r.fields['Previous Balance']} /></td>
                    <td onClick={e => e.stopPropagation()}><button className="fin-btn sm" onClick={() => platformEditor.open(r)}>Edit</button></td>
                  </tr>
                ))}
                <tr>
                  <td /><td style={{ fontWeight: 700 }}>Total</td><td />
                  <td className="num" style={{ fontWeight: 800, color: 'var(--accent)' }}>{formatCurrency(platformTotal)}</td>
                  <td className="num fin-muted">{formatCurrency(platformPrev)}</td>
                  <td><Delta current={platformTotal} previous={platformPrev} /></td><td />
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ---- Liquidation Invested ---- */}
      <div className="fin-section">
        <SectionHeader title="Liquidation Invested" />
        {loading ? <div className="fin-card"><Skel w="30%" /><Skel w="45%" h={40} /><Skel w="35%" /></div> : !liquidation ? (
          <EmptyState icon="💧" message="Liquidation balance hasn’t been set up yet."
            actionLabel="Set balance" onAction={() => liquidationEditor.open()} />
        ) : (
          <div className="fin-card" style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
            <div>
              <div className="fin-mini-label">{liquidation.fields.Label || 'Liquidation Invested'}</div>
              <div style={{ fontSize: '2.6rem', fontWeight: 800, lineHeight: 1.1, marginTop: 4 }}>{formatCurrency(liquidation.fields['Current Balance'])}</div>
              <div style={{ display: 'flex', gap: 10, marginTop: 6, flexWrap: 'wrap' }}>
                <span className="fin-prev">Prev {formatCurrency(liquidation.fields['Previous Balance'])}</span>
                <Delta current={liquidation.fields['Current Balance']} previous={liquidation.fields['Previous Balance']} />
              </div>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 8, flexWrap: 'wrap' }}>
                <span className="fin-muted" style={{ fontSize: '0.8rem' }}>
                  Last Updated: {liquidation.fields[LAST_UPDATED] ? formatDate(liquidation.fields[LAST_UPDATED]) : 'Never'}
                </span>
                <StatusPill status={statusOf(liquidation)} />
              </div>
              {liquidation.fields.Notes && <div className="fin-notes" style={{ marginTop: 8 }}>{liquidation.fields.Notes}</div>}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'flex-end' }}>
              <LiquidationUpdate record={liquidation} reload={reload} />
              <button className="fin-btn sm" onClick={() => liquidationEditor.open(liquidation)}>Edit all fields</button>
            </div>
          </div>
        )}
      </div>

      {/* ---- Special Projects ---- */}
      <div className="fin-section">
        <SectionHeader
          title="Special Projects"
          count={loading ? null : visibleProjects.length}
          onAdd={() => projectEditor.open()}
          right={closedCount > 0 && (
            <label className="fin-link" style={{ cursor: 'pointer' }}>
              <input type="checkbox" className="fin-inline-check" checked={showClosed} onChange={e => setShowClosed(e.target.checked)} />
              Show closed ({closedCount})
            </label>
          )}
        />
        {loading ? <SkeletonGrid count={2} /> : visibleProjects.length === 0 ? (
          <EmptyState icon="🧪" message={projects.length ? 'All projects are closed.' : 'No special projects yet.'}
            actionLabel="Add project" onAction={() => projectEditor.open()} />
        ) : (
          <div className="fin-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))' }}>
            {visibleProjects.map(r => {
              const f = r.fields;
              const net = num(f['This Month Earned']) - num(f['This Month Spent']);
              return (
                <div key={r.id} className={`fin-card clickable${f.Status === 'Closed' ? ' inactive' : ''}${isSel('project', r.id) ? ' selected' : ''}`}
                  onClick={() => setSelected({ kind: 'project', id: r.id })}>
                  <div className="fin-card-top">
                    <div className="fin-card-title-row">
                      <StatusDot status={statusOf(r)} />
                      <div className="fin-card-title">{f['Project Name'] || 'Untitled'}</div>
                    </div>
                    {f.Status && <Chip color={f.Status === 'Active' ? '#00E676' : undefined}>{f.Status}</Chip>}
                  </div>
                  <div className="fin-mini-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
                    {PROJECT_FIELDS.map(([name, color]) => (
                      <div key={name} className="fin-mini">
                        <div className="fin-mini-label">{name}</div>
                        <div className="fin-mini-value" style={color ? { color } : { color: 'var(--text-muted)' }}>{formatCurrency(f[name])}</div>
                      </div>
                    ))}
                    <div className="fin-mini" style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div className="fin-mini-label">Available Balance</div>
                        <div className="fin-mini-value" style={{ fontSize: '1.3rem', color: 'var(--accent)' }}>{formatCurrency(projectAvailable(f))}</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div className="fin-mini-label">Net this month</div>
                        <div style={{ fontWeight: 700, color: net >= 0 ? 'var(--positive)' : 'var(--negative)' }}>{formatCurrency(net)}</div>
                      </div>
                    </div>
                  </div>
                  {f.Notes && <div className="fin-notes">{f.Notes}</div>}
                  <div className="fin-card-actions" onClick={e => e.stopPropagation()}><button className="fin-btn sm" onClick={() => projectEditor.open(r)}>Edit</button></div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {selectedPlatform && (
        <BalanceUpdatePanel
          table={T.TRADING_PLATFORMS}
          record={selectedPlatform}
          reload={reload}
          onClose={() => setSelected(null)}
          onEdit={() => platformEditor.open(selectedPlatform)}
          title={selectedPlatform.fields['Platform Name'] || 'Untitled'}
          subtitle={selectedPlatform.fields.Owner || null}
          chips={selectedPlatform.fields.Owner && <Chip>{selectedPlatform.fields.Owner}</Chip>}
        >
          <PanelNotes notes={selectedPlatform.fields.Notes} />
        </BalanceUpdatePanel>
      )}
      {selectedProject && (
        <ProjectPanel record={selectedProject} reload={reload} onClose={() => setSelected(null)}
          onEdit={() => projectEditor.open(selectedProject)} />
      )}
      {platformEditor.modal}
      {liquidationEditor.modal}
      {projectEditor.modal}
    </div>
  );
}

/* ---- Trading Liquidation: one number, so an inline update form instead of a side panel ---- */

function LiquidationUpdate({ record, reload }) {
  const current = record.fields['Current Balance'];
  const [prev, setPrev] = useState(toInput(current));
  const [next, setNext] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => { setPrev(toInput(current)); setNext(''); }, [record.id, current, record.fields[LAST_UPDATED]]);

  async function save(e) {
    e.preventDefault();
    const p = parseAmount(prev);
    const n = parseAmount(next);
    if (n == null) { setError('Enter the new value.'); return; }
    if (Number.isNaN(n) || Number.isNaN(p)) { setError('Amounts must be numbers, e.g. 1,234.56'); return; }
    setSaving(true);
    setError(null);
    try {
      await updateRecord(T.TRADING_LIQUIDATION, record.id, {
        'Previous Balance': p, 'Current Balance': n, [LAST_UPDATED]: localIsoDate(),
      });
      await reload();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="fin-inline-update" onSubmit={save}>
      <CurrencyInput label="Previous" value={prev} onChange={setPrev} />
      <CurrencyInput label="New Value" value={next} onChange={setNext} placeholder="New amount" />
      <button type="submit" className="fin-btn primary" disabled={saving} style={{ marginBottom: 2 }}>{saving ? 'Saving…' : 'Save'}</button>
      {error && <div className="fin-error" style={{ margin: 0, width: '100%' }}>{error}</div>}
    </form>
  );
}

/* ---- Special Projects side panel: monthly roll-over update ---- */

function ProjectPanel({ record, reload, onClose, onEdit }) {
  const cycle = useCycle();
  const f = record.fields;
  const status = cycleStatus(f[LAST_UPDATED], cycle);
  const [earned, setEarned] = useState('');
  const [spent, setSpent] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setEarned(toInput(f['This Month Earned']));
    setSpent(toInput(f['This Month Spent']));
    setNotes(f.Notes || '');
    setError(null);
  }, [record.id, f[LAST_UPDATED], f['This Month Earned'], f['This Month Spent'], f.Notes]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { setSaved(false); }, [record.id]);

  async function save(e) {
    e.preventDefault();
    const newEarned = parseAmount(earned);
    const newSpent = parseAmount(spent);
    if (Number.isNaN(newEarned) || Number.isNaN(newSpent)) { setError('Amounts must be numbers, e.g. 1,234.56'); return; }
    const totalEarned = round2(num(f['Total Earned']) + num(newEarned));
    const totalSpent = round2(num(f['Total Spent']) + num(newSpent));
    setSaving(true);
    setError(null);
    try {
      await updateRecord(T.SPECIAL_PROJECTS, record.id, {
        'Last Month Earned': f['This Month Earned'] ?? null,   // 1. this month → last month
        'Last Month Spent': f['This Month Spent'] ?? null,     // 2.
        'This Month Earned': newEarned,                        // 3. new this month
        'This Month Spent': newSpent,                          // 4.
        'Total Earned': totalEarned,                           // 5. running totals
        'Total Spent': totalSpent,                             // 6.
        'Available Balance': round2(totalEarned - totalSpent), // keep the stored copy in sync
        Notes: notes.trim() || null,                           // 7.
        [LAST_UPDATED]: localIsoDate(),                        // 8.
      });
      await reload();                                          // 9.
      setSaved(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <SidePanel title={f['Project Name'] || 'Untitled'} subtitle={null} onClose={onClose}
      footer={<button className="fin-btn" onClick={onEdit}>Edit all fields</button>}>
      {f.Status && (
        <PanelSection><div className="fin-card-chips"><Chip color={f.Status === 'Active' ? '#00E676' : undefined}>{f.Status}</Chip></div></PanelSection>
      )}
      <PanelSection label="Project Summary">
        <PanelRow label="This Month Earned">{formatCurrency(f['This Month Earned'])}</PanelRow>
        <PanelRow label="Last Month Earned">{formatCurrency(f['Last Month Earned'])}</PanelRow>
        <PanelRow label="This Month Spent">{formatCurrency(f['This Month Spent'])}</PanelRow>
        <PanelRow label="Last Month Spent">{formatCurrency(f['Last Month Spent'])}</PanelRow>
        <PanelRow label="Total Earned">{f['Total Earned'] != null ? formatCurrency(f['Total Earned']) : '—'}</PanelRow>
        <PanelRow label="Total Spent">{f['Total Spent'] != null ? formatCurrency(f['Total Spent']) : '—'}</PanelRow>
        <PanelRow label="Available Balance"><strong style={{ color: 'var(--accent)' }}>{formatCurrency(projectAvailable(f))}</strong></PanelRow>
        {!hasTotals(f) && <span className="fin-hint">Total Earned / Total Spent aren’t set yet, so this shows the stored Available Balance. Set the totals via Edit all fields to include past months.</span>}
        <PanelRow label="Last Updated">{f[LAST_UPDATED] ? formatDate(f[LAST_UPDATED]) : 'Never'}</PanelRow>
        <div className="fin-panel-row" style={{ alignItems: 'center' }}>
          <span className="fin-muted">Status</span>
          <StatusPill status={status} />
        </div>
      </PanelSection>
      <PanelSection label="Update This Month">
        <form className="fin-panel-form" onSubmit={save}>
          <CurrencyInput label="This Month Earned" value={earned} onChange={setEarned} />
          <CurrencyInput label="This Month Spent" value={spent} onChange={setSpent} />
          <label className="fin-field">
            <span className="fin-label">Notes</span>
            <textarea className="fin-input" rows={3} value={notes} onChange={e => setNotes(e.target.value)} />
          </label>
          <span className="fin-hint">Saving moves the current This Month figures to Last Month and adds these amounts to the running totals, so save once per month.</span>
          {error && <div className="fin-error" style={{ margin: 0 }}>{error}</div>}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button type="submit" className="fin-btn primary" disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
            {saved && !saving && <span className="fin-hint" style={{ color: 'var(--positive)' }}>✓ Saved · Last Updated set to today</span>}
          </div>
        </form>
      </PanelSection>
    </SidePanel>
  );
}
