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

// Each "Best Consumer/Business Card Offers" heading is immediately followed
// by one big table listing every card for that type, one card per row.
const SECTION_RE = /<div class="BOlegacy">\s*<strong>\s*Best\s+(Consumer|Business)\s+Card Offers\s*<\/strong>[\s\S]*?<table[^>]*>([\s\S]*?)<\/table>/gi;

// Per row: name link, then a short bonus blurb, then the "$X 1st Yr Value
// Estimate" text. Name capture allows embedded tags (a few card names span
// lines with a stray <br>) and gets stripped afterward.
const ROW_RE = /<strong>\s*<a[^>]*href="[^"]*"[^>]*>([\s\S]*?)<\/a>\s*<\/strong>\s*<br\s*\/?>\s*([\s\S]*?)<br\s*\/?>[\s\S]*?\$(-?[\d,]+)\s*1st Yr Value Estimate/gi;

function parseCards(html) {
  const consumer = [];
  const business = [];

  let sectionMatch;
  SECTION_RE.lastIndex = 0;
  while ((sectionMatch = SECTION_RE.exec(html)) !== null) {
    const type = sectionMatch[1].toLowerCase();
    const tableHtml = sectionMatch[2];
    const target = type === 'business' ? business : consumer;

    let rowMatch;
    ROW_RE.lastIndex = 0;
    while ((rowMatch = ROW_RE.exec(tableHtml)) !== null) {
      const name = stripTags(rowMatch[1]);
      if (!name) continue;
      const welcomeBonus = stripTags(rowMatch[2]);
      const fmValue = parseInt(rowMatch[3].replace(/,/g, ''), 10);

      target.push({
        name,
        issuer: detectIssuer(name),
        fm_value: Number.isFinite(fmValue) ? fmValue : null,
        annual_fee: null,
        welcome_bonus: welcomeBonus,
        type,
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
