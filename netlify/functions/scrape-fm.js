const FM_URL = 'https://frequentmiler.com/best-credit-card-offers/';

const TOKEN = "patIocMMJeO1lbzlm.c34342b06deba92090aacdb92686c8bc1479be242f03adf24cc9d0c32f1dfb60";
const AIRTABLE_BASE_URL = 'https://api.airtable.com/v0';
const BASE = 'apph7JP85hB5dLyob';
const CARD_PRODUCTS_TABLE = 'tbloTLQR2DwcqR2Vq';

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

function extractSlug(href) {
  if (!href) return null;
  const slug = href.split('#')[0].replace(/^\//, '').replace(/\/$/, '');
  return slug || null;
}

// Real-page tags carry extra classes/attributes beyond the one we care
// about (e.g. class="BOhd some-other-class"), so match the class as one
// token among possibly several rather than requiring an exact attribute
// value. Quote style on the page is inconsistent (single or double).
// Non-capturing throughout — this gets composed into larger regexes whose
// own capture-group indices must stay stable regardless of how many times
// this is used.
function classAttr(className) {
  return `<[a-zA-Z][a-zA-Z0-9]*[^>]*\\bclass=(?:"[^"]*\\b${className}\\b[^"]*"|'[^']*\\b${className}\\b[^']*')[^>]*>`;
}

// Each "Best Consumer/Business Card Offers" heading is immediately followed
// by one big table listing every card for that type, one card per row.
const SECTION_RE = new RegExp(
  `${classAttr('BOlegacy')}\\s*<strong[^>]*>\\s*Best\\s+(Consumer|Business)\\s+Card Offers\\s*<\\/strong>[\\s\\S]*?<table[^>]*>([\\s\\S]*?)<\\/table>`,
  'gi'
);

// Per card: name + href wrapped in <strong><a>, a short bonus blurb, then
// the value estimate somewhere after. Name capture tolerates embedded tags
// (a few card names span lines with a stray <br>).
const NAME_HREF_VALUE_RE = /<strong[^>]*>\s*<a[^>]*\bhref=(["'])([^"']*)\1[^>]*>([\s\S]*?)<\/a>\s*<\/strong>\s*<br\s*\/?>\s*([\s\S]*?)<br\s*\/?>[\s\S]*?\$(-?[\d,]+)\s*1st Yr Value Estimate/i;
const ROW_RE = /<tr\b[^>]*>[\s\S]*?<\/tr>/gi;

function parseCards(html) {
  const cards = [];
  const sections = [];

  let sectionMatch;
  SECTION_RE.lastIndex = 0;
  while ((sectionMatch = SECTION_RE.exec(html)) !== null) {
    const type = sectionMatch[1].toLowerCase();
    const tableHtml = sectionMatch[2];

    const rows = tableHtml.match(ROW_RE) || [];
    let matchedRows = 0;
    rows.forEach(rowHtml => {
      const match = NAME_HREF_VALUE_RE.exec(rowHtml);
      if (!match) return;
      const slug = extractSlug(match[2]);
      const name = stripTags(match[3]);
      if (!slug || !name) return;

      const fmValue = parseInt(match[5].replace(/,/g, ''), 10);
      if (!Number.isFinite(fmValue)) return;

      matchedRows += 1;
      cards.push({ slug, name, fmValue });
    });

    sections.push({
      type,
      rowCount: rows.length,
      matchedRows,
      sampleRow: matchedRows === 0 && rows[0] ? rows[0].slice(0, 800) : undefined,
    });
  }

  return { cards, sections };
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchAllCardProducts() {
  const slugMap = new Map();
  const missingSlugProducts = [];
  let offset;
  do {
    const params = new URLSearchParams();
    params.set('fields[]', 'FM Slug');
    params.append('fields[]', 'Product Name');
    params.set('pageSize', '100');
    if (offset) params.set('offset', offset);
    const res = await fetch(`${AIRTABLE_BASE_URL}/${BASE}/${CARD_PRODUCTS_TABLE}?${params.toString()}`, {
      headers: { Authorization: `Bearer ${TOKEN}` },
    });
    if (!res.ok) throw new Error(`Airtable list failed: ${res.status}`);
    const data = await res.json();
    (data.records || []).forEach(r => {
      const slug = (r.fields['FM Slug'] || '').trim();
      if (slug) {
        slugMap.set(slug.toLowerCase(), r.id);
      } else {
        missingSlugProducts.push(r.fields['Product Name'] || r.id);
      }
    });
    offset = data.offset;
  } while (offset);
  missingSlugProducts.sort((a, b) => a.localeCompare(b));
  return { slugMap, missingSlugProducts };
}

async function patchCardProducts(updates) {
  for (let i = 0; i < updates.length; i += 10) {
    const batch = updates.slice(i, i + 10);
    const res = await fetch(`${AIRTABLE_BASE_URL}/${BASE}/${CARD_PRODUCTS_TABLE}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ records: batch, typecast: true }),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Airtable patch failed: ${res.status} ${text}`);
    }
    if (i + 10 < updates.length) await sleep(220);
  }
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

  let cards, sections;
  try {
    ({ cards, sections } = parseCards(html));
  } catch (e) {
    cards = [];
    sections = [];
  }

  if (cards.length === 0) {
    const debug = {
      htmlLength: html.length,
      markers: {
        BOlegacy: html.includes('BOlegacy'),
        BOtinfo: html.includes('BOtinfo'),
        tablepress: html.includes('tablepress'),
        consumerHeading: /Best\s+Consumer\s+Card Offers/i.test(html),
        businessHeading: /Best\s+Business\s+Card Offers/i.test(html),
        cloudflareChallenge: /Just a moment|cf-browser-verification|Enable JavaScript and cookies to continue|cf_chl_opt/i.test(html),
        accessDenied: /Access Denied|403 Forbidden/i.test(html),
      },
      sectionsMatched: sections.length,
      sections,
    };
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Parse failed — FM page structure may have changed', debug }),
    };
  }

  let slugMap, missingSlugProducts;
  try {
    ({ slugMap, missingSlugProducts } = await fetchAllCardProducts());
  } catch (e) {
    return {
      statusCode: 502,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Failed to read Card Products from Airtable' }),
    };
  }

  const today = new Date().toISOString().split('T')[0];
  const updates = [];
  const unmatchedSlugs = [];
  const seenSlugs = new Set();

  cards.forEach(card => {
    if (seenSlugs.has(card.slug)) return;
    seenSlugs.add(card.slug);

    const recordId = slugMap.get(card.slug.toLowerCase());
    if (recordId) {
      updates.push({
        id: recordId,
        fields: { 'FM Value Estimate': card.fmValue, 'FM Last Updated': today },
      });
    } else {
      console.log(`No Card Products match for slug: ${card.slug}`);
      unmatchedSlugs.push(card.slug);
    }
  });

  try {
    await patchCardProducts(updates);
  } catch (e) {
    return {
      statusCode: 502,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Failed to update Card Products in Airtable' }),
    };
  }

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      updated: updates.length,
      unmatched: unmatchedSlugs.length,
      unmatched_slugs: unmatchedSlugs,
      missing_slug_count: missingSlugProducts.length,
      missing_slug_names: missingSlugProducts,
    }),
  };
};
