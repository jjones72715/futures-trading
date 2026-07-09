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

// FM has no bank/issuer text on this page — cards are identified only by
// name, so issuer is inferred from known bank names appearing in it.
// Co-brand cards that don't include the issuing bank in their name (e.g.
// "United Explorer Card" is a Chase product) will resolve to "Unknown" here;
// the frontend improves on this by cross-referencing our own Card Products
// table when a card matches a known product.
const ISSUER_KEYWORDS = [
  'American Express', 'Capital One', 'Wells Fargo', 'Bank of America',
  'U.S. Bank', 'US Bank', 'Morgan Stanley', 'Barclays', 'Citizens',
  'Chase', 'Citi', 'Discover', 'UBS', 'HSBC', 'PNC', 'BECU', 'PenFed',
  'Synchrony', 'USAA', 'Huntington', 'First Tech', 'Fairwinds', 'Brex',
  'Robinhood', 'SoFi', 'Bilt', 'Venmo', 'Paypal', 'FNBO', 'Schwab', 'Amex',
];

function detectIssuer(name) {
  const lower = name.toLowerCase();
  const found = ISSUER_KEYWORDS.find(k => lower.includes(k.toLowerCase()));
  if (!found) return 'Unknown';
  return found === 'US Bank' ? 'U.S. Bank' : found;
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

// The 178/56-row comparison tables use a compact per-card layout: name
// wrapped in <strong><a>, a short bonus blurb, then a <br>, then the value
// estimate somewhere after. (A separate, richer "BObox" widget with Annual
// Fee/review text/earning-rate tables exists elsewhere on the page for
// individual card spotlights, but it is not what populates these tables —
// Annual Fee genuinely isn't present here, hence null; the frontend
// backfills it from our own Card Products table when a card matches one
// we already track.) Name capture tolerates embedded tags (a few card
// names span lines with a stray <br>).
const NAME_BONUS_VALUE_RE = /<strong[^>]*>\s*<a[^>]*>([\s\S]*?)<\/a>\s*<\/strong>\s*<br\s*\/?>\s*([\s\S]*?)<br\s*\/?>[\s\S]*?\$(-?[\d,]+)\s*1st Yr Value Estimate/i;
const ROW_RE = /<tr\b[^>]*>[\s\S]*?<\/tr>/gi;

function parseCards(html) {
  const consumer = [];
  const business = [];
  const sections = [];

  let sectionMatch;
  SECTION_RE.lastIndex = 0;
  while ((sectionMatch = SECTION_RE.exec(html)) !== null) {
    const type = sectionMatch[1].toLowerCase();
    const tableHtml = sectionMatch[2];
    const target = type === 'business' ? business : consumer;

    const rows = tableHtml.match(ROW_RE) || [];
    let matchedRows = 0;
    rows.forEach(rowHtml => {
      const match = NAME_BONUS_VALUE_RE.exec(rowHtml);
      if (!match) return;
      const name = stripTags(match[1]);
      if (!name) return;
      matchedRows += 1;

      const welcomeBonus = stripTags(match[2]);
      const fmValue = parseInt(match[3].replace(/,/g, ''), 10);

      target.push({
        name,
        issuer: detectIssuer(name),
        fm_value: Number.isFinite(fmValue) ? fmValue : null,
        annual_fee: null,
        welcome_bonus: welcomeBonus,
        type,
      });
    });

    sections.push({
      type,
      rowCount: rows.length,
      matchedRows,
      sampleRow: matchedRows === 0 && rows[0] ? rows[0].slice(0, 800) : undefined,
    });
  }

  return { consumer, business, sections };
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

  let consumer, business, sections;
  try {
    ({ consumer, business, sections } = parseCards(html));
  } catch (e) {
    consumer = [];
    business = [];
    sections = [];
  }

  if (consumer.length === 0 && business.length === 0) {
    // Diagnostics so the app itself can show what the server actually sent
    // back, instead of guessing again from a browser DevTools snapshot
    // (which showed post-JavaScript markup that never matches the raw HTML).
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
