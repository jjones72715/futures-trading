import { BASE } from '../config/tables.js';

export async function fetchTable(tableId, fields) {
  const params = fields.map(f => `fields[]=${encodeURIComponent(f)}`).join('&');
  const allRecords = [];
  let offset = null;
  do {
    const url = `/.netlify/functions/cc-airtable/${BASE}/${tableId}?${params}${offset ? `&offset=${offset}` : ''}`;
    const res = await fetch(url);
    const data = await res.json();
    allRecords.push(...(data.records || []));
    offset = data.offset || null;
  } while (offset);
  return allRecords;
}

export async function createRecord(tableId, fields) {
  const res = await fetch(`/.netlify/functions/cc-airtable/${BASE}/${tableId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields }),
  });
  const data = await res.json();
  if (!res.ok || data?.error) throw new Error(data?.error?.message || `Airtable error ${res.status}`);
  return data;
}
