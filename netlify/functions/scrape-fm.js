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

function parseAnnualFee(text) {
  if (!text) return null;
  if (/no annual fee|no fee/i.test(text)) return 0;
  const m = text.replace(/,/g, '').match(/\$(\d+(?:\.\d+)?)/);
  return m ? parseFloat(m[1]) : null;
}

// Live-DOM inspection (post-JavaScript) shows a "Mini" card layout, but the
// actual HTML the server sends uses a richer "BObox" layout — this parser
// targets the real server-rendered markup. Attribute quoting on the real
// page is inconsistent (single or double), so quotes are matched loosely.
const Q = `["']`;

// Each "Best Consumer/Business Card Offers" heading is immediately followed
// by one big table listing every card for that type, one card per row.
const SECTION_RE = new RegExp(
  `<div\\s+class=${Q}BOlegacy${Q}>\\s*<strong>\\s*Best\\s+(Consumer|Business)\\s+Card Offers\\s*<\\/strong>[\\s\\S]*?<table[^>]*>([\\s\\S]*?)<\\/table>`,
  'gi'
);

const NAME_RE = new RegExp(`<div\\s+class=${Q}BOhd${Q}>\\s*<a[^>]*>([\\s\\S]*?)<\\/a>`, 'i');
const BONUS_RE = new RegExp(`<div\\s+class=${Q}BObon${Q}>([\\s\\S]*?)(?:<span|<\\/div>)`, 'i');
const FEE_RE = new RegExp(`<div\\s+class=${Q}BOmo${Q}>[\\s\\S]*<strong>([^<]*)<\\/strong>\\s*<\\/div>`, 'i');
const VALUE_RE = /\$(-?[\d,]+)\s*1st Yr Value Estimate/i;
const ROW_RE = /<tr\b[^>]*>[\s\S]*?<\/tr>/gi;

function parseCards(html) {
  const consumer = [];
  const business = [];

  let sectionMatch;
  SECTION_RE.lastIndex = 0;
  while ((sectionMatch = SECTION_RE.exec(html)) !== null) {
    const type = sectionMatch[1].toLowerCase();
    const tableHtml = sectionMatch[2];
    const target = type === 'business' ? business : consumer;

    const rows = tableHtml.match(ROW_RE) || [];
    rows.forEach(rowHtml => {
      const nameMatch = NAME_RE.exec(rowHtml);
      if (!nameMatch) return;
      const name = stripTags(nameMatch[1]);
      if (!name) return;

      const bonusMatch = BONUS_RE.exec(rowHtml);
      const welcomeBonus = bonusMatch ? stripTags(bonusMatch[1]) : '';

      const feeMatch = FEE_RE.exec(rowHtml);
      const annualFee = feeMatch ? parseAnnualFee(stripTags(feeMatch[1])) : null;

      const valueMatch = VALUE_RE.exec(rowHtml);
      const fmValue = valueMatch ? parseInt(valueMatch[1].replace(/,/g, ''), 10) : null;

      target.push({
        name,
        issuer: detectIssuer(name),
        fm_value: Number.isFinite(fmValue) ? fmValue : null,
        annual_fee: annualFee,
        welcome_bonus: welcomeBonus,
        type,
      });
    });
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
