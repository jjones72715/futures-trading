const BASE_URL = "https://api.airtable.com/v0";
const BASE_ID = "appXzBgVF931cJ0vf";

// Mirrors src/apps/financial/config/airtable.js — only these tables are reachable.
const TABLES = {
  BANKING_ACCOUNTS:    'tblvkonONzL2PzGLN',
  BANK_BONUSES:        'tblgDb6DG8mnr5fJD',
  OWED_TO_ME:          'tblk3hdM5yrRqRUpL',
  CREDIT_CARD_LOGINS:  'tblnHB5U7BDVainx7',
  BALANCE_TRANSFERS:   'tblPhOcELURM19dVh',
  TRADING_PLATFORMS:   'tbltwSwawAa8sZRfa',
  TRADING_LIQUIDATION: 'tbl6B2CVnNScr7WuQ',
  SPECIAL_PROJECTS:    'tblXYstGQiLwsgivm',
  PENDING_PAYOUTS:     'tblPemNYCNDkqo27w',
  INVESTMENTS:         'tbloQcjOOz4taiXjV',
  SPORTSBOOKS:         'tblP4LwZvvD1UaGOr',
  SUBSCRIPTIONS:       'tblJH6wcALfOIXicg',
  MONTHLY_NET_WORTH:   'tblcoEHMi7RhWkwsz',
};

const RECORD_ID = /^rec[A-Za-z0-9]{14}$/;

// Tolerate common paste mistakes: whitespace, wrapping quotes, a "Bearer " prefix.
function readToken() {
  const raw = process.env.AIRTABLE_API_KEY;
  if (!raw) return null;
  return raw.trim().replace(/^["']|["']$/g, '').replace(/^Bearer\s+/i, '').trim();
}

// Describes an obviously malformed token without revealing it; null when it looks plausible.
function describeBadToken(token) {
  if (!token.startsWith('pat')) return 'does not start with "pat"';
  if (!token.includes('.')) return 'is only the token ID — the secret part after the "." is missing (Airtable shows the full token only once, at creation)';
  return null;
}

function respond(statusCode, body) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    body: JSON.stringify(body),
  };
}

async function fetchAllAirtableRecords(token, tableId) {
  const params = new URLSearchParams();
  params.set('pageSize', '100');

  const allRecords = [];
  let offset = null;

  do {
    if (offset) params.set('offset', offset);
    else params.delete('offset');

    const res = await fetch(`${BASE_URL}/${BASE_ID}/${tableId}?${params.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
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
  const TOKEN = readToken();
  if (!TOKEN) return respond(500, { error: 'AIRTABLE_API_KEY is not configured' });
  const badToken = describeBadToken(TOKEN);
  if (badToken) return respond(500, { error: `AIRTABLE_API_KEY doesn't look like a full Airtable token: it ${badToken}` });

  const method = event.httpMethod;
  const params = new URLSearchParams(event.rawQuery || '');

  let body = {};
  if (event.body) {
    try {
      const raw = event.isBase64Encoded ? Buffer.from(event.body, 'base64').toString('utf8') : event.body;
      body = JSON.parse(raw);
    } catch {
      return respond(400, { error: 'Invalid JSON body' });
    }
  }

  const tableKey = params.get('table') || body.table;
  const tableId = TABLES[tableKey];
  if (!tableId) return respond(400, { error: `Unknown table: ${tableKey}` });

  const recordId = params.get('id') || body.id;
  if (recordId && !RECORD_ID.test(recordId)) return respond(400, { error: 'Invalid record id' });

  // Table-level GET — paginate server-side
  if (method === 'GET' && !recordId) {
    try {
      const records = await fetchAllAirtableRecords(TOKEN, tableId);
      return respond(200, { records });
    } catch (e) {
      return respond(500, { error: e.message });
    }
  }

  let url;
  let payload;
  if (method === 'GET' || method === 'DELETE') {
    if (!recordId) return respond(400, { error: 'Record id required' });
    url = `${BASE_URL}/${BASE_ID}/${tableId}/${recordId}`;
  } else if (method === 'POST') {
    url = `${BASE_URL}/${BASE_ID}/${tableId}`;
    payload = { fields: body.fields || {}, typecast: true };
  } else if (method === 'PATCH') {
    if (!recordId) return respond(400, { error: 'Record id required' });
    url = `${BASE_URL}/${BASE_ID}/${tableId}/${recordId}`;
    payload = { fields: body.fields || {}, typecast: true };
  } else {
    return respond(405, { error: `Method ${method} not allowed` });
  }

  try {
    const response = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: payload ? JSON.stringify(payload) : undefined,
    });
    const data = await response.json();
    return respond(response.status, data);
  } catch (e) {
    return respond(500, { error: e.message });
  }
};
