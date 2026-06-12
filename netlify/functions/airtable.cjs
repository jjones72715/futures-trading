const TOKEN = "patIocMMJeO1lbzlm.c34342b06deba92090aacdb92686c8bc1479be242f03adf24cc9d0c32f1dfb60";
const BASE_URL = "https://api.airtable.com/v0";

const STATUS_FILTERS = {
  'tblWeri8TXWPQY9Dc': '{Status} = "Active"',
  'tblhM1DWRiWXnhSKb': 'OR({Status} = "Active", {Status} = "Waiting on Payout", {Status} = "Live")',
};

async function fetchAllAirtableRecords(baseId, tableId, rawQuery) {
  const params = new URLSearchParams(rawQuery || '');
  params.set('pageSize', '100');
  params.delete('maxRecords');

  if (STATUS_FILTERS[tableId] && !params.has('filterByFormula')) {
    params.set('filterByFormula', STATUS_FILTERS[tableId]);
  }

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
  const path = event.path.replace('/.netlify/functions/airtable', '');
  const method = event.httpMethod;
  const params = new URLSearchParams(event.rawQuery || '');
  const action = params.get('action');
  const pathParts = path.split('/').filter(Boolean);

  if (action === 'updateEvalType') {
    const { recordId, newEvalCost, resetEvalCost, activationCost, allowedTraders } = JSON.parse(event.body);
    const fields = {};
    if (newEvalCost    !== undefined) fields['fldUdq0uk6K02ogyZ'] = newEvalCost;
    if (resetEvalCost  !== undefined) fields['fld2lnZop14MFQPAa'] = resetEvalCost;
    if (activationCost !== undefined) fields['fldW2mpQiod4UJQwe'] = activationCost;
    if (allowedTraders !== undefined) fields['fldXy6mjxVJ53An62'] = allowedTraders;
    try {
      const res = await fetch(
        `${BASE_URL}/app5RPYcCy7hqCu41/tbleHzHF5FgskLxs3/${recordId}`,
        {
          method: 'PATCH',
          headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ fields }),
        }
      );
      const data = await res.json();
      return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) };
    } catch (e) {
      return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
    }
  }

  // Table-level GET: /{baseId}/{tableId} — paginate and filter server-side
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

  // All other requests (single-record GET, POST, PATCH, PUT) — proxy directly
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
