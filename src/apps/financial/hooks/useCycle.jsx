import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { fetchRecords } from '../services/financialService.js';
import { T } from '../config/airtable.js';

// Monthly reconciliation cycle. The cutoff is the Date of the most recent Monthly Net Worth
// snapshot, fetched once per page load. A record is "Up to Date" when its Last Updated date
// is on or after the cutoff (or, before any snapshot exists, when it has been updated at all).

export const LAST_UPDATED = 'Last Updated';

const CycleContext = createContext({ cutoff: null, loading: true, error: null, refresh: () => {} });

export function CycleProvider({ children }) {
  const [state, setState] = useState({ cutoff: null, loading: true, error: null });

  const refresh = useCallback(async () => {
    try {
      const records = await fetchRecords(T.MONTHLY_NET_WORTH);
      const dates = records.map(r => r.fields.Date).filter(Boolean).map(d => String(d).slice(0, 10)).sort();
      setState({ cutoff: dates[dates.length - 1] || null, loading: false, error: null });
    } catch (e) {
      setState({ cutoff: null, loading: false, error: e.message });
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  return <CycleContext.Provider value={{ ...state, refresh }}>{children}</CycleContext.Provider>;
}

export const useCycle = () => useContext(CycleContext);

// 'current' | 'stale' | null (null while the cutoff is still loading).
export function cycleStatus(lastUpdated, { cutoff, loading }) {
  if (loading) return null;
  if (!lastUpdated) return 'stale';
  if (!cutoff) return 'current';
  return String(lastUpdated).slice(0, 10) >= cutoff ? 'current' : 'stale';
}

// Hook form: returns (record) => status, using the record's Last Updated field.
export function useRecordStatus() {
  const cycle = useCycle();
  return useCallback((record) => cycleStatus(record?.fields?.[LAST_UPDATED], cycle), [cycle]);
}

// Stable partition: "Needs Update" rows first, everything else keeps its existing order.
export function staleFirst(rows, statusOf) {
  return [...rows.filter(r => statusOf(r) === 'stale'), ...rows.filter(r => statusOf(r) !== 'stale')];
}
