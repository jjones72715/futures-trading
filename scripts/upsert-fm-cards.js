#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { BASE, CARD_PRODUCTS_TABLE, BANKS_TABLE } from '../src/apps/creditcards/config/tables.js';

// Same PAT already hardcoded throughout netlify/functions/*.cjs — matching
// existing repo convention rather than introducing an env-var-only path.
const TOKEN = "patIocMMJeO1lbzlm.c34342b06deba92090aacdb92686c8bc1479be242f03adf24cc9d0c32f1dfb60";
const AIRTABLE_BASE_URL = 'https://api.airtable.com/v0';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CSV_PATH = join(__dirname, 'fm_cards.csv');

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function parseCSV(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } else { inQuotes = false; }
      } else {
        field += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ',') {
      row.push(field);
      field = '';
    } else if (char === '\r') {
      // skip
    } else if (char === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += char;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter(r => r.some(c => c.trim() !== ''));
}

// Slug/name-based issuer detection per the household's mapping rules.
// Order matters — first matching rule wins.
function detectIssuer(name, slug) {
  if (name.includes('American Express') || slug.startsWith('Amx')) return 'American Express';
  if (name.includes('Chase') || ['CSP', 'CSR', 'CFU', 'CFF', 'WOH', 'UA', 'BA', 'IB', 'EI', 'CIBU', 'CIC', 'CIBP', 'InkBizPremier', 'ChaseSapphireReserveBusiness', 'WOHBiz', 'UABizCard', 'UAclubbiz', 'UACI'].includes(slug)) return 'Chase';
  if (name.includes('Capital One') || slug.startsWith('C1') || slug.startsWith('CapitalOne') || slug.startsWith('Venture')) return 'Capital One';
  if (name.includes('Citi') || slug.startsWith('AA') || slug.startsWith('TY') || slug.startsWith('Citi')) return 'Citi';
  if (name.includes('Bank of America') || slug.startsWith('boa') || slug.startsWith('BOA') || ['boaPR', 'boaTR', 'boaUR', 'boaCR', 'boaTRbiz', 'boaURBiz', 'boaPLbiz', 'boacustomcashbusiness', 'BOAPremiumRewardsElite', 'BOHHA', 'RoyalCaribbeanRoyalOne', 'RoyalCaribbeanRoyalOnePlus'].includes(slug)) return 'Bank of America';
  if (name.includes('Wells Fargo') || slug.startsWith('WellsFargo') || slug.startsWith('OneKey') || slug.startsWith('WFAC')) return 'Wells Fargo';
  if (name.includes('Barclays') || ['LH', 'B6', 'B6plus', 'B6biz', 'JetBluePremier', 'Upromise', 'HAbiz', 'NCL', 'HollandAmerica', 'PrincessCruises', 'Carnival', 'Emirates', 'EmiratesPremium', 'Turkish', 'VirginRed'].includes(slug)) return 'Barclays';
  if (name.includes('Discover') || slug.startsWith('DI')) return 'Discover';
  if (name.includes('U.S. Bank') || slug.startsWith('USB') || slug.startsWith('USBCP') || slug.startsWith('USBCO') || slug.startsWith('USBGO') || slug.startsWith('USBankBiz') || ['KE', 'KESelect', 'KEBlue', 'KEbiz'].includes(slug)) return 'U.S. Bank';
  if (name.includes('Bilt') || slug.startsWith('Bilt')) return 'Cardless';
  if (name.includes('USAA')) return 'USAA';
  if (name.includes('UBS') || slug.startsWith('UBS')) return 'UBS';
  if (name.includes('HSBC') || slug.startsWith('HSBC')) return 'HSBC';
  if (name.includes('TD ') || slug.startsWith('TD')) return 'TD Bank';
  if (name.includes('PNC') || slug.startsWith('PNC')) return 'PNC';
  if (name.includes('Brex') || slug.startsWith('Brex')) return 'Brex';
  if (name.includes('Intuit') || slug.startsWith('Intuit')) return 'Intuit';
  if (name.includes('SoFi') || slug.startsWith('SoFi')) return 'SoFi';
  if (name.includes('Synchrony') || slug.startsWith('Synchrony')) return 'Synchrony';
  if (name.includes('Huntington') || slug.startsWith('Voice')) return 'Huntington';
  if (name.includes('PenFed') || slug.startsWith('PENFED')) return 'PenFed';
  if (name.includes('FNBO') || slug.startsWith('FNBO')) return 'FNBO';
  if (name.includes('First Tech') || slug.startsWith('FirstTech')) return 'First Tech';
  if (name.includes('BECU') || slug.startsWith('BECU')) return 'BECU';
  if (name.includes('Fairwinds') || slug.startsWith('Fairwinds')) return 'Fairwinds';
  if (name.includes('Atmos') || slug.startsWith('Atmos')) return 'Other';
  if (name.includes('Affinity')) return 'Other';
  if (name.includes('Amazon')) return 'Other';
  return 'Other';
}

async function fetchAllRecords(tableId, fields) {
  const records = [];
  let offset;
  do {
    const params = new URLSearchParams();
    fields.forEach(f => params.append('fields[]', f));
    params.set('pageSize', '100');
    if (offset) params.set('offset', offset);
    const res = await fetch(`${AIRTABLE_BASE_URL}/${BASE}/${tableId}?${params.toString()}`, {
      headers: { Authorization: `Bearer ${TOKEN}` },
    });
    if (!res.ok) throw new Error(`Airtable list failed for ${tableId}: ${res.status} ${await res.text()}`);
    const data = await res.json();
    records.push(...(data.records || []));
    offset = data.offset;
  } while (offset);
  return records;
}

async function patchRecord(tableId, id, fields) {
  const res = await fetch(`${AIRTABLE_BASE_URL}/${BASE}/${tableId}/${id}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields, typecast: true }),
  });
  if (!res.ok) throw new Error(`PATCH ${id} failed: ${res.status} ${await res.text()}`);
  return res.json();
}

async function createRecord(tableId, fields) {
  const res = await fetch(`${AIRTABLE_BASE_URL}/${BASE}/${tableId}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields, typecast: true }),
  });
  if (!res.ok) throw new Error(`POST failed: ${res.status} ${await res.text()}`);
  return res.json();
}

async function main() {
  console.log(`Reading CSV from ${CSV_PATH}`);
  const csvText = readFileSync(CSV_PATH, 'utf8');
  const rows = parseCSV(csvText);
  const header = rows[0].map(h => h.trim());
  const records = rows.slice(1).map(r => {
    const obj = {};
    header.forEach((h, i) => { obj[h] = (r[i] || '').trim(); });
    return obj;
  });
  console.log(`Parsed ${records.length} rows from CSV`);

  console.log('Fetching Banks...');
  const bankRecords = await fetchAllRecords(BANKS_TABLE, ['Bank Name']);
  const banksByName = new Map(bankRecords.map(r => [r.fields['Bank Name'], r.id]));
  console.log(`Loaded ${banksByName.size} banks`);

  console.log('Fetching Card Products...');
  const productRecords = await fetchAllRecords(CARD_PRODUCTS_TABLE, ['FM Slug']);
  const productsBySlug = new Map();
  productRecords.forEach(r => {
    const slug = (r.fields['FM Slug'] || '').trim();
    if (slug) productsBySlug.set(slug, r.id);
  });
  console.log(`Loaded ${productsBySlug.size} existing Card Products with an FM Slug`);

  const today = new Date().toISOString().split('T')[0];
  let updated = 0;
  let created = 0;
  let fellThroughToOther = 0;
  const errors = [];

  for (const row of records) {
    const cardName = row['Card Name'];
    const slug = row['FM Slug'];
    if (!cardName || !slug) {
      console.log(`SKIP (missing Card Name or FM Slug): ${JSON.stringify(row)}`);
      continue;
    }

    const fmValueRaw = parseInt(row['FM Value Estimate'], 10);
    const fmValue = Number.isFinite(fmValueRaw) ? fmValueRaw : null;
    const welcomeBonus = row['Welcome Bonus'] || '';
    const type = row['Type'] || '';

    const issuerName = detectIssuer(cardName, slug);
    if (issuerName === 'Other') fellThroughToOther++;
    const bankId = banksByName.get(issuerName);
    if (!bankId) {
      console.log(`WARNING: no Banks record for issuer "${issuerName}" (card: ${cardName}, slug: ${slug}) — Issuer left unset`);
    }

    const existingId = productsBySlug.get(slug);
    try {
      if (existingId) {
        await patchRecord(CARD_PRODUCTS_TABLE, existingId, {
          'FM Value Estimate': fmValue,
          'FM Last Updated': today,
          'Welcome Bonus': welcomeBonus,
          'Personal/Business': type,
        });
        updated++;
        console.log(`UPDATED  [${issuerName}] ${cardName} (${slug})`);
      } else {
        const fields = {
          'Product Name': cardName,
          'FM Slug': slug,
          'FM Value Estimate': fmValue,
          'FM Last Updated': today,
          'Welcome Bonus': welcomeBonus,
          'Personal/Business': type,
        };
        if (bankId) fields['Issuer'] = [bankId];
        const result = await createRecord(CARD_PRODUCTS_TABLE, fields);
        productsBySlug.set(slug, result.id);
        created++;
        console.log(`CREATED  [${issuerName}] ${cardName} (${slug})`);
      }
    } catch (e) {
      console.error(`ERROR    ${cardName} (${slug}): ${e.message}`);
      errors.push({ cardName, slug, error: e.message });
    }

    await sleep(250);
  }

  console.log('\n=== Summary ===');
  console.log(`Updated: ${updated}`);
  console.log(`Created: ${created}`);
  console.log(`Issuer fell through to Other: ${fellThroughToOther}`);
  if (errors.length > 0) {
    console.log(`Errors: ${errors.length}`);
    errors.forEach(e => console.log(`  - ${e.cardName} (${e.slug}): ${e.error}`));
  }
}

main().catch(e => {
  console.error('Fatal error:', e);
  process.exit(1);
});
