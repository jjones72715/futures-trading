import { useState } from 'react';
import { useSort, sortRows, SortTh } from './SortableTable.jsx';
import { StatusDot } from './Status.jsx';
import { staleFirst } from '../hooks/useCycle.jsx';
import { formatCurrency, num } from '../utils/formatters.js';

/**
 * Compact, sortable record table (Credit Cards style). Clicking a row calls onRowClick.
 *
 * columns:  [{ key, label, render(r), sort?(r) → value, numeric?, interactive? }]
 *           `interactive` cells (toggles) don't trigger the row click.
 * statusOf: optional (r) → 'current' | 'stale' | null — adds the Up to Date dot column and
 *           sorts Needs Update rows first (the column sort applies within each group).
 * group:    optional { by(r) → name, order?: [names], totalKey?, total?(items) → node }
 *           renders collapsible group header rows, with the subtotal under column `totalKey`.
 * footer:   optional { label, cells: { [colKey]: node } } — a total row at the bottom.
 */
export default function RecordTable({
  columns, rows, statusOf, selectedId, onRowClick, rowClassName, defaultSort, group, footer,
}) {
  const { sort, onSort } = useSort(defaultSort?.key ?? null, defaultSort?.dir ?? 'asc');
  const [collapsed, setCollapsed] = useState({});

  const getters = Object.fromEntries(columns.filter(c => c.sort).map(c => [c.key, c.sort]));
  let ordered = sort.key ? sortRows(rows, getters, sort) : rows;
  if (statusOf) ordered = staleFirst(ordered, statusOf);

  const lead = statusOf ? 1 : 0;
  const colCount = lead + columns.length;

  function renderRow(r) {
    return (
      <tr key={r.id} className={`row${r.id === selectedId ? ' selected' : ''}${rowClassName ? ` ${rowClassName(r) || ''}` : ''}`}
        onClick={() => onRowClick?.(r)}>
        {statusOf && <td className="status-col"><StatusDot status={statusOf(r)} /></td>}
        {columns.map(c => (
          <td key={c.key} className={[c.numeric && 'num', c.className].filter(Boolean).join(' ') || undefined}
            onClick={c.interactive ? e => e.stopPropagation() : undefined}>
            {c.render(r)}
          </td>
        ))}
      </tr>
    );
  }

  let body;
  if (group) {
    const names = [...new Set(ordered.map(group.by))];
    const order = [...(group.order || []).filter(n => names.includes(n)), ...names.filter(n => !(group.order || []).includes(n)).sort()];
    const totalIdx = group.totalKey ? columns.findIndex(c => c.key === group.totalKey) : -1;
    body = order.map(name => {
      const items = ordered.filter(r => group.by(r) === name);
      const isCollapsed = !!collapsed[name];
      const label = (
        <>
          <span className={`fin-sh-caret${isCollapsed ? ' closed' : ''}`} style={{ marginRight: 8 }}>▼</span>
          {name} <span className="fin-faint" style={{ fontWeight: 400 }}>({items.length})</span>
        </>
      );
      return [
        <tr key={`g-${name}`} className="group-row" onClick={() => setCollapsed(c => ({ ...c, [name]: !c[name] }))}>
          {totalIdx >= 0 ? (
            <>
              <td colSpan={lead + totalIdx}>{label}</td>
              <td className="num">{group.total(items)}</td>
              {colCount - lead - totalIdx - 1 > 0 && <td colSpan={colCount - lead - totalIdx - 1} />}
            </>
          ) : <td colSpan={colCount}>{label}</td>}
        </tr>,
        ...(isCollapsed ? [] : items.map(renderRow)),
      ];
    });
  } else {
    body = ordered.map(renderRow);
  }

  return (
    <div className="fin-table-wrap scroll">
      <table className="fin-table compact">
        <thead>
          <tr>
            {statusOf && <th className="status-col">Up to Date</th>}
            {columns.map(c => (c.sort
              ? <SortTh key={c.key} label={c.label} k={c.key} sort={sort} onSort={onSort} numeric={c.numeric} />
              : <th key={c.key} className={c.numeric ? 'num' : undefined}>{c.label}</th>))}
          </tr>
        </thead>
        <tbody>
          {body}
          {footer && (
            <tr className="total-row">
              {statusOf && <td />}
              {columns.map((c, i) => (
                <td key={c.key} className={c.numeric ? 'num' : undefined}>
                  {footer.cells[c.key] ?? (i === 0 ? footer.label || 'Total' : null)}
                </td>
              ))}
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

// Change column cell: colored amount with arrow, or a muted dash when unchanged.
// `invert` for debts (a rising balance is bad).
export function ChangeCell({ current, previous, invert = false }) {
  const diff = Math.round((num(current) - num(previous)) * 100) / 100;
  if (diff === 0) return <span className="fin-faint">—</span>;
  const up = diff > 0;
  const good = invert ? !up : up;
  return <span className={`fin-delta ${good ? 'up' : 'down'}`}>{up ? '↑' : '↓'} {formatCurrency(Math.abs(diff))}</span>;
}
