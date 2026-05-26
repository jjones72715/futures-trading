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
