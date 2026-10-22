import { useState, useCallback } from 'react';

// Column sorting for the compact tables. Numeric columns sort descending on first click.
export function useSort(initialKey, initialDir = 'asc') {
  const [sort, setSort] = useState({ key: initialKey, dir: initialDir });
  const onSort = useCallback((key, numeric) => {
    setSort(s => (s.key === key
      ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' }
      : { key, dir: numeric ? 'desc' : 'asc' }));
  }, []);
  return { sort, onSort };
}

// getters: { [key]: (row) => string | number | null }. Empty values always sort last.
export function sortRows(rows, getters, sort) {
  const get = getters[sort.key];
  if (!get) return rows;
  const mult = sort.dir === 'asc' ? 1 : -1;
  return [...rows].sort((a, b) => {
    const va = get(a);
    const vb = get(b);
    const ea = va == null || va === '';
    const eb = vb == null || vb === '';
    if (ea || eb) return ea === eb ? 0 : ea ? 1 : -1;
    if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * mult;
    return String(va).localeCompare(String(vb), undefined, { sensitivity: 'base' }) * mult;
  });
}

export function SortTh({ label, k, sort, onSort, numeric, className = '' }) {
  const active = sort.key === k;
  return (
    <th className={`${numeric ? 'num ' : ''}${className}`} aria-sort={active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}>
      <button type="button" className={`fin-th-sort${active ? ' active' : ''}`} onClick={() => onSort(k, numeric)}>
        {label}
        <span className="fin-th-arrow">{active ? (sort.dir === 'asc' ? '▲' : '▼') : '↕'}</span>
      </button>
    </th>
  );
}

// Case-insensitive match of every whitespace-separated term against any of the given values.
export function matchesQuery(query, values) {
  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (!terms.length) return true;
  const hay = values.filter(v => v != null).join(' ').toLowerCase();
  return terms.every(t => hay.includes(t));
}

export function SearchInput({ value, onChange, placeholder = 'Search…' }) {
  return (
    <div className="fin-search">
      <span aria-hidden="true">⌕</span>
      <input className="fin-input" value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} />
      {value && <button type="button" className="fin-search-clear" onClick={() => onChange('')} aria-label="Clear search">×</button>}
    </div>
  );
}
