import { useState } from 'react';
import { useTables, useFieldToggle } from '../hooks/useTables.js';
import { T, CHOICES } from '../config/airtable.js';
import PillFilter, { ALL } from '../components/PillFilter.jsx';
import SectionHeader from '../components/SectionHeader.jsx';
import StatCard from '../components/StatCard.jsx';
import { useRecordEditor } from '../components/Modal.jsx';
import RecordTable, { ChangeCell } from '../components/RecordTable.jsx';
import BalanceUpdatePanel from '../components/BalanceUpdatePanel.jsx';
import { PanelRow } from '../components/SidePanel.jsx';
import { useRecordStatus } from '../hooks/useCycle.jsx';
import { Chip, EmptyState, ErrorBanner, SkeletonStats, SkeletonTable, ShowInactiveToggle, Switch } from '../components/ui.jsx';
import { formatCurrency, distinct, isActive, sumField, num } from '../utils/formatters.js';

const KEYS = [T.ASSETS, T.LIABILITIES];
const UNCATEGORIZED = 'Uncategorized';

function formatRate(rate) {
  return `${Number(rate).toFixed(2)}% APR`;
}

/**
 * One section (Assets or Liabilities): owner pills, then a compact table grouped by
 * category with a subtotal per category and a section total. Clicking a row opens the
 * side panel, where all editing happens. `invert` flips change colors for debts.
 */
function CategorySection({
  title, table, noun, records, reload, categories, valueField, prevField, valueLabel, prevLabel, invert,
  emptyIcon, emptyMessage, panelRows, detailFields,
}) {
  const [owner, setOwner] = useState(ALL);
  const [showInactive, setShowInactive] = useState(false);
  const [open, setOpen] = useState(true);
  const [selectedId, setSelectedId] = useState(null);
  const statusOf = useRecordStatus();
  const selected = records.find(r => r.id === selectedId) || null;

  const owners = distinct(records, 'Owner');
  const editor = useRecordEditor({ table, noun, reload, suggestions: { Owner: owners } });
  const { toggle, pending, error } = useFieldToggle(table, reload);

  const byOwner = records.filter(r => owner === ALL || r.fields.Owner === owner);
  const inactiveCount = byOwner.filter(r => !isActive(r)).length;
  const visible = byOwner
    .filter(r => showInactive || isActive(r))
    .sort((a, b) => (isActive(b) - isActive(a)) || num(b.fields[valueField]) - num(a.fields[valueField]));
  const activeVisible = visible.filter(isActive);
  const debt = invert ? { color: 'var(--negative)' } : undefined;

  const columns = [
    { key: 'name', label: 'Name', sort: r => r.fields.Name || '', className: 'cell-name', render: r => r.fields.Name || 'Untitled' },
    { key: 'category', label: 'Category', sort: r => r.fields.Category || '',
      render: r => (r.fields.Category ? <Chip color="#00D4FF">{r.fields.Category}</Chip> : <span className="fin-faint">—</span>) },
    { key: 'owner', label: 'Owner', sort: r => r.fields.Owner || '', render: r => r.fields.Owner || <span className="fin-faint">—</span> },
    { key: 'current', label: valueLabel, numeric: true, sort: r => num(r.fields[valueField]),
      render: r => <strong style={debt}>{formatCurrency(r.fields[valueField])}</strong> },
    { key: 'previous', label: prevLabel, numeric: true, sort: r => num(r.fields[prevField]),
      render: r => <span className="fin-muted">{formatCurrency(r.fields[prevField])}</span> },
    { key: 'change', label: 'Change', numeric: true, sort: r => num(r.fields[valueField]) - num(r.fields[prevField]),
      render: r => <ChangeCell current={r.fields[valueField]} previous={r.fields[prevField]} invert={invert} /> },
    { key: 'active', label: 'Active', interactive: true,
      render: r => <Switch on={isActive(r)} onChange={v => toggle(r, 'Active', v)} disabled={pending === r.id} /> },
  ];

  return (
    <div className={`fin-section${selected ? ' fin-has-panel' : ''}`}>
      <ErrorBanner error={error} />
      <SectionHeader
        title={title}
        count={visible.length}
        collapsed={!open}
        onToggle={() => setOpen(o => !o)}
        onAdd={() => editor.open(null, owner !== ALL ? { Owner: owner } : null)}
        right={<ShowInactiveToggle value={showInactive} onChange={setShowInactive} count={inactiveCount} />}
      />
      {open && (
        <>
          {owners.length > 0 && (
            <div className="fin-toolbar" style={{ marginBottom: '0.75rem' }}>
              <PillFilter options={owners} value={owner} onChange={setOwner} />
            </div>
          )}
          {visible.length === 0 ? (
            <EmptyState icon={emptyIcon} message={records.length ? 'Nothing matches this filter.' : emptyMessage}
              actionLabel={`Add ${noun.toLowerCase()}`} onAction={() => editor.open()} />
          ) : (
            <RecordTable
              columns={columns}
              rows={visible}
              statusOf={statusOf}
              selectedId={selectedId}
              onRowClick={r => setSelectedId(r.id)}
              rowClassName={r => (isActive(r) ? '' : 'inactive')}
              group={{
                by: r => r.fields.Category || UNCATEGORIZED,
                order: [...categories, UNCATEGORIZED],
                totalKey: 'current',
                total: items => <span style={debt}>{formatCurrency(sumField(items.filter(isActive), valueField))}</span>,
              }}
              footer={{
                label: `Total ${title}`,
                cells: {
                  current: <span style={debt}>{formatCurrency(sumField(activeVisible, valueField))}</span>,
                  previous: <span className="fin-muted">{formatCurrency(sumField(activeVisible, prevField))}</span>,
                  change: <ChangeCell current={sumField(activeVisible, valueField)} previous={sumField(activeVisible, prevField)} invert={invert} />,
                },
              }}
            />
          )}
        </>
      )}

      {selected && (
        <BalanceUpdatePanel
          table={table}
          record={selected}
          reload={reload}
          onClose={() => setSelectedId(null)}
          title={selected.fields.Name || 'Untitled'}
          subtitle={[selected.fields.Category, selected.fields.Owner].filter(Boolean).join(' · ') || null}
          chips={<>
            {selected.fields.Category && <Chip color="#00D4FF">{selected.fields.Category}</Chip>}
            {selected.fields.Owner && <Chip>{selected.fields.Owner}</Chip>}
          </>}
          currentField={valueField}
          previousField={prevField}
          currentLabel={valueLabel}
          previousLabel={prevLabel}
          invert={invert}
          historyRows={panelRows?.(selected.fields)}
          detailFields={detailFields}
          suggestions={{ Owner: owners }}
        />
      )}
      {editor.modal}
    </div>
  );
}

export default function AssetsLiabilitiesTab() {
  const { data, loading, error, reload } = useTables(KEYS);
  const assets = data[T.ASSETS];
  const liabilities = data[T.LIABILITIES];

  const totalAssets = sumField(assets.filter(isActive), 'Current Value');
  const totalLiabilities = sumField(liabilities.filter(isActive), 'Current Balance');
  const net = totalAssets - totalLiabilities;

  return (
    <div>
      <ErrorBanner error={error} />
      {loading ? <SkeletonStats count={3} /> : (
        <div className="fin-stats">
          <StatCard label="Total Assets" value={formatCurrency(totalAssets)} accent="var(--positive)" />
          <StatCard label="Total Liabilities" value={formatCurrency(totalLiabilities)} accent="var(--negative)" />
          <StatCard label="Net (Assets − Liabilities)" value={formatCurrency(net)}
            accent={net > 0 ? 'var(--positive)' : net < 0 ? 'var(--negative)' : 'var(--text)'} />
        </div>
      )}

      {loading ? (
        <>
          <div className="fin-section"><SectionHeader title="Assets" /><SkeletonTable rows={4} /></div>
          <div className="fin-section"><SectionHeader title="Liabilities" /><SkeletonTable rows={4} /></div>
        </>
      ) : (
        <>
          <CategorySection
            title="Assets"
            table={T.ASSETS}
            noun="Asset"
            records={assets}
            reload={reload}
            categories={CHOICES.ASSET_CATEGORY}
            valueField="Current Value"
            prevField="Previous Value"
            valueLabel="Current Value"
            prevLabel="Previous Value"
            emptyIcon="🏠"
            emptyMessage="No assets yet — add your home, vehicles and other property."
            detailFields={['Name', 'Category', 'Owner', 'Notes', 'Active']}
          />
          <CategorySection
            title="Liabilities"
            table={T.LIABILITIES}
            noun="Liability"
            records={liabilities}
            reload={reload}
            categories={CHOICES.LIABILITY_CATEGORY}
            valueField="Current Balance"
            prevField="Previous Balance"
            valueLabel="Current Balance"
            prevLabel="Previous Balance"
            invert
            emptyIcon="🧾"
            emptyMessage="No liabilities yet — add your mortgage, auto loans and other debts."
            panelRows={f => <>
              {f['Interest Rate'] != null && <PanelRow label="Interest Rate">{formatRate(f['Interest Rate'])}</PanelRow>}
              {f['Original Amount'] != null && <PanelRow label="Original Amount">{formatCurrency(f['Original Amount'])}</PanelRow>}
            </>}
            detailFields={['Name', 'Category', 'Owner', 'Original Amount', 'Interest Rate', 'Notes', 'Active']}
          />
        </>
      )}
    </div>
  );
}
