// Seed script for Perk Definitions table in Airtable.
// Checks for existing records by Perk Name + Credit Amount before creating.
// Run via: node scripts/seed-perk-definitions.js
// Note: Requires AIRTABLE_TOKEN env var or edit the token below.

const BASE = 'apph7JP85hB5dLyob';
const PERK_DEFINITIONS_TABLE = 'tblA2XdVpJoLGDNMd';
const TOKEN = process.env.AIRTABLE_TOKEN || 'patIocMMJeO1lbzlm.c34342b06deba92090aacdb92686c8bc1479be242f03adf24cc9d0c32f1dfb60';

const PERKS = [
  { name: 'Admiral Club',    credit: 4,      cycle: 'Annual',      priority: 3 },
  { name: 'Airline Fee',     credit: 200,    cycle: 'Annual',      priority: 5 },
  { name: 'Blacklane',       credit: 100,    cycle: 'Semi-Annual', priority: 3 },
  { name: 'Citi Travel',     credit: 300,    cycle: 'Annual',      priority: 4 },
  { name: 'CLEAR',           credit: 209,    cycle: 'Annual',      priority: 4 },
  { name: 'CSRTables',       credit: 150,    cycle: 'Semi-Annual', priority: 3 },
  { name: 'CSRTravel',       credit: 300,    cycle: 'Annual',      priority: 5 },
  { name: 'CSRTravelMini',   credit: 50,     cycle: 'Annual',      priority: 4 },
  { name: 'Dell',            credit: 150,    cycle: 'Semi-Annual', priority: 4 },
  { name: 'Dunkin',          credit: 7,      cycle: 'Monthly',     priority: 2 },
  { name: 'Edit',            credit: 250,    cycle: 'Semi-Annual', priority: 3 },
  { name: 'Equinox',         credit: 300,    cycle: 'Annual',      priority: 2 },
  { name: 'FHR300',          credit: 300,    cycle: 'Semi-Annual', priority: 4 },
  { name: 'FlexBusiness',    credit: 20,     cycle: 'Monthly',     priority: 3 },
  { name: 'GETSA',           credit: 120,    cycle: 'Annual',      priority: 5 },
  { name: 'GiftCards.com',   credit: 50,     cycle: 'Semi-Annual', priority: 3 },
  { name: 'GoldDining',      credit: 10,     cycle: 'Monthly',     priority: 4 },
  { name: 'Google Workspace',credit: 200,    cycle: 'Annual',      priority: 3 },
  { name: 'HiltonBiz',       credit: 60,     cycle: 'Quarterly',   priority: 3 },
  { name: 'HiltonBP',        credit: 50,     cycle: 'Quarterly',   priority: 3 },
  { name: 'HiltonFlight',    credit: 50,     cycle: 'Quarterly',   priority: 3 },
  { name: 'HiltonResort',    credit: 200,    cycle: 'Semi-Annual', priority: 4 },
  { name: 'Hotel Free Night',credit: 200,    cycle: 'Annual',      priority: 5 },
  { name: 'Indeed',          credit: 90,     cycle: 'Quarterly',   priority: 3 },
  { name: 'Resy50',          credit: 50,     cycle: 'Semi-Annual', priority: 3 },
  { name: 'Saks',            credit: 50,     cycle: 'Semi-Annual', priority: 4 },
  { name: 'Splurge Credit',  credit: 200,    cycle: 'Annual',      priority: 3 },
  { name: 'SquareSpace',     credit: 150,    cycle: 'Annual',      priority: 2 },
  { name: 'StubHub',         credit: 150,    cycle: 'Semi-Annual', priority: 3 },
  { name: 'TSA',             credit: 120,    cycle: 'Annual',      priority: 5 },
  { name: 'Uber (Gold)',     credit: 10,     cycle: 'Monthly',     priority: 3 },
  { name: 'Walmart+',        credit: 12.95,  cycle: 'Monthly',     priority: 3 },
  { name: 'Wireless',        credit: 10,     cycle: 'Monthly',     priority: 4 },
  { name: 'ZipRecruiter',    credit: 200,    cycle: 'Semi-Annual', priority: 3 },
];

async function airtable(path, opts = {}) {
  const res = await fetch(`https://api.airtable.com/v0/${path}`, {
    ...opts,
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json', ...(opts.headers || {}) },
  });
  return res.json();
}

async function main() {
  const existing = await airtable(`${BASE}/${PERK_DEFINITIONS_TABLE}?fields[]=Perk+Name&fields[]=Credit+Amount`);
  const existingSet = new Set(
    (existing.records || []).map(r => `${r.fields['Perk Name']}::${r.fields['Credit Amount']}`)
  );

  for (const p of PERKS) {
    const key = `${p.name}::${p.credit}`;
    if (existingSet.has(key)) {
      console.log(`Skipped (exists): ${p.name}`);
      continue;
    }
    const res = await airtable(`${BASE}/${PERK_DEFINITIONS_TABLE}`, {
      method: 'POST',
      body: JSON.stringify({ fields: {
        'Perk Name': p.name,
        'Credit Amount': p.credit,
        'Reset Cycle': p.cycle,
        'Priority Score': p.priority,
      }}),
    });
    if (res.error) {
      console.error(`Error creating ${p.name}:`, res.error);
    } else {
      console.log(`Created: ${p.name}`);
    }
  }
}

main().catch(console.error);
