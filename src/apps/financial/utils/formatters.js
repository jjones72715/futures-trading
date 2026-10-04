const USD = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 });
const USD_COMPACT = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', notation: 'compact', maximumFractionDigits: 1 });

export const num = (v) => (typeof v === 'number' && !Number.isNaN(v) ? v : 0);

export function formatCurrency(v) {
  return USD.format(num(v));
}

export function formatCompactCurrency(v) {
  return USD_COMPACT.format(num(v));
}

export function formatPercent(v, { signed = false, digits = 1 } = {}) {
  if (v == null || Number.isNaN(v)) return '—';
  const pct = (v * 100).toFixed(digits);
  return `${signed && v > 0 ? '+' : ''}${pct}%`;
}

// Airtable dates are "YYYY-MM-DD" — parse as local midnight to avoid TZ drift.
export function parseDate(str) {
  if (!str) return null;
  const [y, m, d] = String(str).slice(0, 10).split('-').map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

export function formatDate(str) {
  const d = parseDate(str);
  if (!d) return '—';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function formatShortDate(str) {
  const d = parseDate(str);
  if (!d) return '—';
  return `${d.getMonth() + 1}/${d.getDate()}/${String(d.getFullYear()).slice(2)}`;
}

export function today() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

// Whole days from today until the date (negative when past). null if no date.
export function daysUntil(str) {
  const d = parseDate(str);
  if (!d) return null;
  return Math.round((d - today()) / 86400000);
}

export function delta(current, previous) {
  const c = num(current);
  const p = num(previous);
  const diff = c - p;
  const pct = p !== 0 ? diff / Math.abs(p) : null;
  return { diff, pct };
}

// Household members lead the pill order; everything else (businesses, other users) follows alphabetically.
const PRIORITY = ['Jonathan', 'Cherelyn'];
const rank = (v) => { const i = PRIORITY.indexOf(v); return i < 0 ? PRIORITY.length : i; };

export function distinct(records, field) {
  const set = new Set();
  records.forEach(r => {
    const v = r.fields?.[field];
    if (typeof v === 'string' && v.trim()) set.add(v.trim());
  });
  return [...set].sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));
}

export const sumField = (records, field) => records.reduce((s, r) => s + num(r.fields?.[field]), 0);

// Checkbox fields are omitted by Airtable when unchecked.
export const isActive = (r) => r.fields?.Active === true;

// Banking accounts flagged "Exclude from Net Worth" (e.g. tax holdbacks) stay out of cash / net worth totals.
export const EXCLUDE_FROM_NET_WORTH = 'Exclude from Net Worth';
export const countsTowardNetWorth = (r) => r.fields?.[EXCLUDE_FROM_NET_WORTH] !== true;

const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];

// Sort key for Monthly Net Worth rows: Date field, else parsed "Month YYYY", else createdTime.
export function snapshotTime(r) {
  const d = parseDate(r.fields?.Date);
  if (d) return d.getTime();
  const m = String(r.fields?.Month || '').toLowerCase().match(/([a-z]+)\s+(\d{4})/);
  if (m) {
    const idx = MONTHS.findIndex(name => name.startsWith(m[1].slice(0, 3)));
    if (idx >= 0) return new Date(Number(m[2]), idx, 1).getTime();
  }
  return r.createdTime ? new Date(r.createdTime).getTime() : 0;
}

export function sortSnapshots(records) {
  return [...records].sort((a, b) => snapshotTime(a) - snapshotTime(b));
}

export function snapshotLabel(r, short = false) {
  if (r.fields?.Month) {
    if (!short) return r.fields.Month;
    const parts = r.fields.Month.split(/\s+/);
    return parts.length >= 2 ? `${parts[0].slice(0, 3)} '${parts[parts.length - 1].slice(-2)}` : r.fields.Month;
  }
  return formatShortDate(r.fields?.Date);
}
