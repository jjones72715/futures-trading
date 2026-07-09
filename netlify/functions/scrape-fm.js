const FM_URL = 'https://frequentmiler.com/best-credit-card-offers/';

const ENTITY_MAP = {
  '&nbsp;': ' ', '&amp;': '&', '&quot;': '"', '&#039;': "'",
  '&#8217;': '’', '&rsquo;': '’', '&#8216;': '‘', '&lsquo;': '‘',
  '&#8220;': '“', '&ldquo;': '“', '&#8221;': '”', '&rdquo;': '”',
  '&#8211;': '–', '&ndash;': '–', '&#8212;': '—', '&mdash;': '—',
};

function decodeEntities(text) {
  return text.replace(/&#8217;|&rsquo;|&#8216;|&lsquo;|&#8220;|&ldquo;|&#8221;|&rdquo;|&#8211;|&ndash;|&#8212;|&mdash;|&nbsp;|&amp;|&quot;|&#039;/g, m => ENTITY_MAP[m] || m);
}

function stripTags(html) {
  return decodeEntities(html.replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();
}

function parseMoney(text) {
  if (!text) return null;
  const match = text.replace(/,/g, '').match(/\$?\s*(\d+(?:\.\d+)?)/);
  if (!match) return null;
  const n = parseFloat(match[1]);
  return Number.isFinite(n) ? n : null;
}

// Column roles are resolved from each table's own header row (keyword match)
// rather than assumed positions, since FM's column order isn't guaranteed.
function resolveColumnRoles(headerCells) {
  const roles = {};
  headerCells.forEach((text, i) => {
    const t = text.toLowerCase();
    if (roles.value === undefined && /(value|worth|estimate)/.test(t)) roles.value = i;
    else if (roles.fee === undefined && /fee/.test(t)) roles.fee = i;
    else if (roles.bonus === undefined && /(bonus|offer|welcome)/.test(t)) roles.bonus = i;
    else if (roles.name === undefined && /(card|name)/.test(t)) roles.name = i;
  });
  if (roles.name === undefined) roles.name = 0;
  return roles;
}

function extractRows(tableHtml) {
  return (tableHtml.match(/<tr[^>]*>[\s\S]*?<\/tr>/gi) || []).map(rowHtml => {
    const isHeaderRow = /<th[\s>]/i.test(rowHtml);
    const cells = (rowHtml.match(/<t[dh][^>]*>[\s\S]*?<\/t[dh]>/gi) || []).map(stripTags);
    return { cells, isHeaderRow };
  });
}

function issuerAndTypeFromHeading(headingText) {
  const isBusiness = /business/i.test(headingText);
  const type = isBusiness ? 'business' : 'consumer';
  const issuer = headingText
    .replace(/(personal|consumer|business)/gi, '')
    .replace(/cards?/gi, '')
    .replace(/best|offers?|top/gi, '')
    .trim();
  return { issuer: issuer || 'Unknown', type };
}

function parseCards(html) {
  const consumer = [];
  const business = [];

  const sectionRe = /<h[2-4][^>]*>([\s\S]*?)<\/h[2-4]>([\s\S]*?)(?=<h[2-4][^>]*>|$)/gi;
  let sectionMatch;
  while ((sectionMatch = sectionRe.exec(html)) !== null) {
    const headingText = stripTags(sectionMatch[1]);
    const sectionHtml = sectionMatch[2];
    if (!headingText || !/card/i.test(headingText)) continue;

    const { issuer, type } = issuerAndTypeFromHeading(headingText);

    const tableRe = /<table[^>]*>([\s\S]*?)<\/table>/gi;
    let tableMatch;
    while ((tableMatch = tableRe.exec(sectionHtml)) !== null) {
      const rows = extractRows(tableMatch[1]);
      if (rows.length === 0) continue;

      const headerRow = rows.find(r => r.isHeaderRow) || rows[0];
      const roles = resolveColumnRoles(headerRow.cells);

      rows.forEach(row => {
        if (row === headerRow || row.isHeaderRow) return;
        const { cells } = row;
        if (cells.length < 2) return;

        const name = cells[roles.name];
        if (!name || /^(card|name)$/i.test(name)) return;

        const fmValue = roles.value !== undefined ? parseMoney(cells[roles.value]) : null;
        const annualFee = roles.fee !== undefined ? parseMoney(cells[roles.fee]) : null;
        const welcomeBonus = roles.bonus !== undefined ? (cells[roles.bonus] || '') : '';

        const target = type === 'business' ? business : consumer;
        target.push({
          name,
          issuer,
          fm_value: fmValue,
          annual_fee: annualFee,
          welcome_bonus: welcomeBonus,
          type,
        });
      });
    }
  }

  return { consumer, business };
}

export const handler = async () => {
  let html;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);
    const res = await fetch(FM_URL, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; CardRecommendationsBot/1.0)' },
    });
    clearTimeout(timeout);
    if (!res.ok) throw new Error(`FM responded ${res.status}`);
    html = await res.text();
  } catch (e) {
    return {
      statusCode: 502,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Failed to fetch FM data' }),
    };
  }

  let consumer, business;
  try {
    ({ consumer, business } = parseCards(html));
  } catch (e) {
    consumer = [];
    business = [];
  }

  if (consumer.length === 0 && business.length === 0) {
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Parse failed — FM page structure may have changed' }),
    };
  }

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      scraped_at: new Date().toISOString(),
      consumer,
      business,
    }),
  };
};
