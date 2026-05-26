const TOKEN = process.env.AIRTABLE_API_KEY;
const BASE_URL = "https://api.airtable.com/v0";

async function fetchAllAirtableRecords(baseId, tableId, rawQuery) {
  const params = new URLSearchParams(rawQuery || '');
  params.set('pageSize', '100');
  params.delete('maxRecords');

  const allRecords = [];
  let offset = null;

  do {
    if (offset) params.set('offset', offset);
    else params.delete('offset');

    const res = await fetch(`${BASE_URL}/${baseId}/${tableId}?${params.toString()}`, {
      headers: { Authorization: `Bearer ${TOKEN}` },
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Airtable ${res.status}: ${err}`);
    }

    const data = await res.json();
    allRecords.push(...(data.records ?? []));
    offset = data.offset ?? null;
  } while (offset);

  return allRecords;
}

exports.handler = async (event) => {
  const path = event.path.replace('/.netlify/functions/cc-airtable', '');
  const method = event.httpMethod;
  const pathParts = path.split('/').filter(Boolean);

  if (method === 'GET' && pathParts.length === 2) {
    const [baseId, tableId] = pathParts;
    try {
      const records = await fetchAllAirtableRecords(baseId, tableId, event.rawQuery);
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ records }),
      };
    } catch (e) {
      return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
    }
  }

  const url = `${BASE_URL}${path}${event.rawQuery ? '?' + event.rawQuery : ''}`;
  try {
    const response = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: ['POST', 'PATCH', 'PUT'].includes(method) ? event.body : undefined,
    });
    const data = await response.json();
    return {
      statusCode: response.status,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    };
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
  }
};
