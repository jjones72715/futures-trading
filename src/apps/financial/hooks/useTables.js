import { useState, useEffect, useCallback } from 'react';
import { fetchRecords, updateRecord } from '../services/financialService.js';

// Loads one or more tables in parallel. `data` is keyed by table key.
// reload() refreshes without flipping back to the skeleton state.
export function useTables(keys) {
  const keyStr = keys.join(',');
  const [data, setData] = useState(() => Object.fromEntries(keys.map(k => [k, []])));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const reload = useCallback(async () => {
    const list = keyStr.split(',');
    const results = await Promise.allSettled(list.map(k => fetchRecords(k)));
    const next = {};
    const errors = [];
    results.forEach((r, i) => {
      if (r.status === 'fulfilled') next[list[i]] = r.value;
      else { next[list[i]] = []; errors.push(`${list[i]}: ${r.reason?.message}`); }
    });
    setData(next);
    setError(errors.length ? errors.join(' · ') : null);
    setLoading(false);
  }, [keyStr]);

  useEffect(() => { reload(); }, [reload]);

  return { data, loading, error, reload };
}

// Inline boolean-field toggles (Active, Auto Pay). Tracks the in-flight record id.
export function useFieldToggle(table, reload) {
  const [pending, setPending] = useState(null);
  const [error, setError] = useState(null);
  const toggle = useCallback(async (record, field, value) => {
    setPending(record.id);
    setError(null);
    try {
      await updateRecord(table, record.id, { [field]: value });
      await reload();
    } catch (e) {
      setError(e.message);
    } finally {
      setPending(null);
    }
  }, [table, reload]);
  return { toggle, pending, error };
}
