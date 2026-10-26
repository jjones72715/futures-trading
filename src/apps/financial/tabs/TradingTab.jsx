import { useEffect, useState } from 'react';
import { useTables } from '../hooks/useTables.js';
import { T } from '../config/airtable.js';
import SectionHeader from '../components/SectionHeader.jsx';
import StatCard from '../components/StatCard.jsx';
import { useRecordEditor } from '../components/Modal.jsx';
import BalanceUpdatePanel, { PanelNotes } from '../components/BalanceUpdatePanel.jsx';
import EditDetailsSection, { RecordDetailsPanel } from '../components/EditDetailsSection.jsx';
import RecordTable from '../components/RecordTable.jsx';
import { useFieldToggle } from '../hooks/useTables.js';
import SidePanel, { PanelSection, PanelRow } from '../components/SidePanel.jsx';
import CurrencyInput from '../components/CurrencyInput.jsx';
import { StatusDot, StatusPill } from '../components/Status.jsx';
import { updateRecord } from '../services/financialService.js';
import { useCycle, cycleStatus, useRecordStatus, staleFirst, LAST_UPDATED } from '../hooks/useCycle.jsx';
import { Switch } from '../components/ui.jsx';
import {
  Chip, Delta, EmptyState, ErrorBanner, Skel, SkeletonStats, SkeletonTable,
} from '../components/ui.jsx';
import { formatCurrency, formatDate, distinct, sumField, num, localIsoDate, parseAmount } from '../utils/formatters.js';

const KEYS = [T.TRADING_PLATFORMS, T.TRADING_LIQUIDATION, T.SPECIAL_PROJECTS];

const round2 = (n) => Math.round(n * 100) / 100;
const toInput = (v) => (v == null ? '' : String(v));

// Available Balance = Total Earned − Total Spent. Until a project's running totals are set,
// fall back to the Available Balance value stored on the record.
const hasTotals = (f) => f['Total Earned'] != null || f['Total Spent'] != null;
const projectAvailable = (f) => (hasTotals(f) ? num(f['Total Earned']) - num(f['Total Spent']) : f['Available Balance']);

export default function TradingTab() {
  const { data, loading, error, reload } = useTables(KEYS);
  const [selected, setSelected] = useState(null); // { kind: 'platform' | 'project', id }
  const statusOf = useRecordStatus();

  const platforms = data[T.TRADING_PLATFORMS];
  const liquidation = data[T.TRADING_LIQUIDATION][0];
  const projects = data[T.SPECIAL_PROJECTS];

  const platformEditor = useRecordEditor({ table: T.TRADING_PLATFORMS, noun: 'Platform', reload, suggestions: { Owner: distinct(platforms, 'Owner') } });
  const liquidationEditor = useRecordEditor({ table: T.TRADING_LIQUIDATION, noun: 'Liquidation Invested', reload, allowDelete: false });
  const projectEditor = useRecordEditor({ table: T.SPECIAL_PROJECTS, noun: 'Special Project', reload });
  const { toggle: toggleProject, pending: projectPending, error: projectError } = useFieldToggle(T.SPECIAL_PROJECTS, reload);

  const platformTotal = sumField(platforms, 'Current Balance');
  const platformPrev = sumField(platforms, 'Previous Balance');
  const liqCurrent = num(liquidation?.fields['Current Balance']);

  const isProjectActive = (r) => r.fields.Status !== 'Closed';
  const activeProjects = projects.filter(isProjectActive);
  const inactiveProjects = projects.filter(r => !isProjectActive(r));
  const sortedPlatforms = staleFirst(
    [...platforms].sort((a, b) => num(b.fields['Current Balance']) - num(a.fields['Current Balance'])), statusOf);

  const selectedPlatform = selected?.kind === 'platform' ? platforms.find(r => r.id === selected.id) : null;
  const selectedProject = selected?.kind === 'project' ? projects.find(r => r.id === selected.id) : null;
  const isSel = (kind, id) => selected?.kind === kind && selected.id === id;

  return (
    <div className={selectedPlatform || selectedProject ? 'fin-has-panel' : undefined}>
      <ErrorBanner error={error || projectError} />

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
                <tr><th className="status-col">Up to Date</th><th>Platform</th><th>Owner</th><th className="num">Current Balance</th><th className="num">Previous Balance</th><th>Delta</th></tr>
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
                  </tr>
                ))}
                <tr>
                  <td /><td style={{ fontWeight: 700 }}>Total</td><td />
                  <td className="num" style={{ fontWeight: 800, color: 'var(--accent)' }}>{formatCurrency(platformTotal)}</td>
                  <td className="num fin-muted">{formatCurrency(platformPrev)}</td>
                  <td><Delta current={platformTotal} previous={platformPrev} /></td>
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
            <LiquidationUpdate record={liquidation} reload={reload} />
          </div>
        )}
      </div>

      {/* ---- Special Projects ---- */}
      <div className="fin-section">
        <SectionHeader title="Special Projects" count={loading ? null : projects.length} onAdd={() => projectEditor.open()} />
        {loading ? <SkeletonTable rows={3} /> : projects.length === 0 ? (
          <EmptyState icon="🧪" message="No special projects yet." actionLabel="Add project" onAction={() => projectEditor.open()} />
        ) : (
          <>
            {activeProjects.length > 0 && (
              <RecordTable
                rows={activeProjects}
                statusOf={statusOf}
                selectedId={selected?.kind === 'project' ? selected.id : null}
                onRowClick={r => setSelected({ kind: 'project', id: r.id })}
                columns={[
                  { key: 'status', label: 'Status', interactive: true, render: r => (
                    <Switch on title="Active — click to close" disabled={projectPending === r.id}
                      onChange={() => toggleProject(r, 'Status', 'Closed')} />) },
                  { key: 'name', label: 'Project Name', className: 'cell-name', sort: r => r.fields['Project Name'] || '',
                    render: r => r.fields['Project Name'] || 'Untitled' },
                  { key: 'earned', label: 'This Month Earned', numeric: true, sort: r => num(r.fields['This Month Earned']),
                    render: r => <span style={{ color: 'var(--positive)' }}>{formatCurrency(r.fields['This Month Earned'])}</span> },
                  { key: 'spent', label: 'This Month Spent', numeric: true, sort: r => num(r.fields['This Month Spent']),
                    render: r => <span style={{ color: 'var(--negative)' }}>{formatCurrency(r.fields['This Month Spent'])}</span> },
                  { key: 'available', label: 'Available Balance', numeric: true, sort: r => num(projectAvailable(r.fields)),
                    render: r => <strong style={{ color: 'var(--accent)' }}>{formatCurrency(projectAvailable(r.fields))}</strong> },
                ]}
              />
            )}
            {inactiveProjects.length > 0 && (
              <>
                <div className="fin-panel-label" style={{ margin: '1rem 0 0.5rem', color: 'var(--text-muted)' }}>Inactive</div>
                <RecordTable
                  rows={inactiveProjects}
                  selectedId={selected?.kind === 'project' ? selected.id : null}
                  onRowClick={r => setSelected({ kind: 'project', id: r.id })}
                  rowClassName={() => 'inactive'}
                  columns={[
                    { key: 'status', label: 'Status', interactive: true, render: r => (
                      <Switch on={false} title="Closed — click to reactivate" disabled={projectPending === r.id}
                        onChange={() => toggleProject(r, 'Status', 'Active')} />) },
                    { key: 'name', label: 'Project Name', className: 'cell-name', sort: r => r.fields['Project Name'] || '',
                      render: r => r.fields['Project Name'] || 'Untitled' },
                    { key: 'totalEarned', label: 'Total Earned', numeric: true, sort: r => num(r.fields['Total Earned']),
                      render: r => formatCurrency(r.fields['Total Earned']) },
                    { key: 'totalSpent', label: 'Total Spent', numeric: true, sort: r => num(r.fields['Total Spent']),
                      render: r => formatCurrency(r.fields['Total Spent']) },
                    { key: 'available', label: 'Available Balance', numeric: true, sort: r => num(projectAvailable(r.fields)),
                      render: r => (Math.round(num(projectAvailable(r.fields)) * 100) === 0 ? '' : formatCurrency(projectAvailable(r.fields))) },
                  ]}
                />
              </>
            )}
          </>
        )}
      </div>

      {selectedPlatform && (
        <BalanceUpdatePanel
          table={T.TRADING_PLATFORMS}
          record={selectedPlatform}
          reload={reload}
          onClose={() => setSelected(null)}
          title={selectedPlatform.fields['Platform Name'] || 'Untitled'}
          detailFields={['Platform Name', 'Owner', 'Notes']}
          suggestions={{ Owner: distinct(platforms, 'Owner') }}
          subtitle={selectedPlatform.fields.Owner || null}
          chips={selectedPlatform.fields.Owner && <Chip>{selectedPlatform.fields.Owner}</Chip>}
        >
          <PanelNotes notes={selectedPlatform.fields.Notes} />
        </BalanceUpdatePanel>
      )}
      {selectedProject && isProjectActive(selectedProject) && (
        <ProjectPanel record={selectedProject} reload={reload} onClose={() => setSelected(null)} />
      )}
      {selectedProject && !isProjectActive(selectedProject) && (
        <RecordDetailsPanel
          table={T.SPECIAL_PROJECTS}
          record={selectedProject}
          reload={reload}
          onClose={() => setSelected(null)}
          title={selectedProject.fields['Project Name'] || 'Untitled'}
          chips={<Chip>{selectedProject.fields.Status || 'Closed'}</Chip>}
          fields={['Project Name', 'Status', 'Notes']}
        >
          <PanelSection label="Summary">
            <PanelRow label="Total Earned">{formatCurrency(selectedProject.fields['Total Earned'])}</PanelRow>
            <PanelRow label="Total Spent">{formatCurrency(selectedProject.fields['Total Spent'])}</PanelRow>
            <PanelRow label="Available Balance"><strong style={{ color: 'var(--accent)' }}>{formatCurrency(projectAvailable(selectedProject.fields))}</strong></PanelRow>
            <PanelRow label="Last Updated">{selectedProject.fields[LAST_UPDATED] ? formatDate(selectedProject.fields[LAST_UPDATED]) : 'Never'}</PanelRow>
          </PanelSection>
        </RecordDetailsPanel>
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

function ProjectPanel({ record, reload, onClose }) {
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
    <SidePanel title={f['Project Name'] || 'Untitled'} subtitle={null} onClose={onClose}>
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
        {!hasTotals(f) && <span className="fin-hint">Total Earned / Total Spent aren’t set yet, so this shows the stored Available Balance. Set the totals in Edit Details below to include past months.</span>}
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
      {/* Total Earned / Total Spent are here so the running totals can be seeded or corrected. */}
      <EditDetailsSection table={T.SPECIAL_PROJECTS} record={record} reload={reload} onDeleted={onClose}
        fields={['Project Name', 'Status', 'Notes', 'Total Earned', 'Total Spent']} />
    </SidePanel>
  );
}
