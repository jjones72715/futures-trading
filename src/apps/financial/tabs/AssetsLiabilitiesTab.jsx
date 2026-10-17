import { useState } from 'react';
import { useTables, useFieldToggle } from '../hooks/useTables.js';
import { T, CHOICES } from '../config/airtable.js';
import PillFilter, { ALL } from '../components/PillFilter.jsx';
import SectionHeader from '../components/SectionHeader.jsx';
import BalanceCard from '../components/BalanceCard.jsx';
import StatCard from '../components/StatCard.jsx';
import { useRecordEditor } from '../components/Modal.jsx';
import { Chip, EmptyState, ErrorBanner, SkeletonGrid, SkeletonStats, ShowInactiveToggle } from '../components/ui.jsx';
import { formatCurrency, distinct, isActive, sumField, num } from '../utils/formatters.js';

const KEYS = [T.ASSETS, T.LIABILITIES];
const UNCATEGORIZED = 'Uncategorized';

function formatRate(rate) {
  return `${Number(rate).toFixed(2)}% APR`;
}

/**
 * One pill-filtered section (Assets or Liabilities), with cards grouped into
 * collapsible category headers. `invert` flips delta colors for debts.
 */
function CategorySection({
  title, table, noun, records, reload, categories, valueField, prevField, invert,
  emptyIcon, emptyMessage, renderExtra,
}) {
  const [owner, setOwner] = useState(ALL);
  const [showInactive, setShowInactive] = useState(false);
  const [collapsed, setCollapsed] = useState({});
  const [open, setOpen] = useState(true);

  const owners = distinct(records, 'Owner');
  const editor = useRecordEditor({ table, noun, reload, suggestions: { Owner: owners } });
  const { toggle, pending, error } = useFieldToggle(table, reload);

  const byOwner = records.filter(r => owner === ALL || r.fields.Owner === owner);
  const inactiveCount = byOwner.filter(r => !isActive(r)).length;
  const visible = byOwner.filter(r => showInactive || isActive(r));

  const allCategories = [...categories, ...distinct(visible, 'Category').filter(c => !categories.includes(c)), UNCATEGORIZED];
  const groups = allCategories
    .map(cat => ({
      cat,
      items: visible
        .filter(r => (r.fields.Category || UNCATEGORIZED) === cat)
        .sort((a, b) => (isActive(b) - isActive(a)) || num(b.fields[valueField]) - num(a.fields[valueField])),
    }))
    .filter(g => g.items.length);

  return (
    <div className="fin-section">
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
          {groups.length === 0 ? (
            <EmptyState icon={emptyIcon} message={records.length ? 'Nothing matches this filter.' : emptyMessage}
              actionLabel={`Add ${noun.toLowerCase()}`} onAction={() => editor.open()} />
          ) : groups.map(g => {
            const isCollapsed = !!collapsed[g.cat];
            const groupTotal = sumField(g.items.filter(isActive), valueField);
            return (
              <div key={g.cat} className="fin-group">
                <button type="button" className="fin-group-head" onClick={() => setCollapsed(c => ({ ...c, [g.cat]: !c[g.cat] }))}>
                  <span>
                    <span className={`fin-sh-caret${isCollapsed ? ' closed' : ''}`} style={{ marginRight: 8 }}>▼</span>
                    {g.cat} <span className="fin-faint" style={{ fontWeight: 400 }}>({g.items.length})</span>
                  </span>
                  <span>{formatCurrency(groupTotal)}</span>
                </button>
                {!isCollapsed && (
                  <div className="fin-grid">
                    {g.items.map(r => {
                      const f = r.fields;
                      return (
                        <BalanceCard
                          key={r.id}
                          title={f.Name || 'Untitled'}
                          chips={<>
                            {f.Category && <Chip color="#00D4FF">{f.Category}</Chip>}
                            {f.Owner && <Chip>{f.Owner}</Chip>}
                          </>}
                          current={f[valueField]}
                          previous={f[prevField]}
                          invert={invert}
                          extra={renderExtra?.(f)}
                          notes={f.Notes}
                          active={isActive(r)}
                          toggling={pending === r.id}
                          onToggleActive={v => toggle(r, 'Active', v)}
                          onEdit={() => editor.open(r)}
                        />
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </>
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
          <div className="fin-section"><SectionHeader title="Assets" /><SkeletonGrid count={3} /></div>
          <div className="fin-section"><SectionHeader title="Liabilities" /><SkeletonGrid count={3} /></div>
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
            emptyIcon="🏠"
            emptyMessage="No assets yet — add your home, vehicles and other property."
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
            invert
            emptyIcon="🧾"
            emptyMessage="No liabilities yet — add your mortgage, auto loans and other debts."
            renderExtra={f => (f['Interest Rate'] != null || f['Original Amount'] != null) && (
              <div style={{ fontSize: '0.78rem', display: 'flex', gap: 10, flexWrap: 'wrap' }} className="fin-muted">
                {f['Interest Rate'] != null && <span style={{ color: 'var(--text)', fontWeight: 600 }}>{formatRate(f['Interest Rate'])}</span>}
                {f['Original Amount'] != null && <span>Original {formatCurrency(f['Original Amount'])}</span>}
              </div>
            )}
          />
        </>
      )}
    </div>
  );
}
