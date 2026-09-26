// All Personal Finances data flows through the /api/financial Netlify Function.
// Records come back in Airtable shape: { id, createdTime, fields: { ... } }.

const ENDPOINT = '/api/financial';
const JSON_HEADERS = { 'Content-Type': 'application/json' };

async function request(url, options) {
  const res = await fetch(url, options);
  let data = null;
  try { data = await res.json(); } catch { /* empty body */ }
  if (!res.ok || data?.error) {
    const err = data?.error;
    const msg = typeof err === 'string' ? err : err?.message || err?.type || `Request failed (${res.status})`;
    throw new Error(msg);
  }
  return data;
}

export const fetchRecords = (table) =>
  request(`${ENDPOINT}?table=${encodeURIComponent(table)}`).then(d => d?.records || []);

export const createRecord = (table, fields) =>
  request(ENDPOINT, { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify({ table, fields }) });

export const updateRecord = (table, id, fields) =>
  request(ENDPOINT, { method: 'PATCH', headers: JSON_HEADERS, body: JSON.stringify({ table, id, fields }) });

export const deleteRecord = (table, id) =>
  request(`${ENDPOINT}?table=${encodeURIComponent(table)}&id=${encodeURIComponent(id)}`, { method: 'DELETE' });

// ---- Per-table helpers ----

export const fetchBankingAccounts = () => fetchRecords('BANKING_ACCOUNTS');
export const createBankingAccount = (data) => createRecord('BANKING_ACCOUNTS', data);
export const updateBankingAccount = (id, data) => updateRecord('BANKING_ACCOUNTS', id, data);
export const deleteBankingAccount = (id) => deleteRecord('BANKING_ACCOUNTS', id);

export const fetchBankBonuses = () => fetchRecords('BANK_BONUSES');
export const createBankBonus = (data) => createRecord('BANK_BONUSES', data);
export const updateBankBonus = (id, data) => updateRecord('BANK_BONUSES', id, data);
export const deleteBankBonus = (id) => deleteRecord('BANK_BONUSES', id);

export const fetchOwedToMe = () => fetchRecords('OWED_TO_ME');
export const createOwedToMe = (data) => createRecord('OWED_TO_ME', data);
export const updateOwedToMe = (id, data) => updateRecord('OWED_TO_ME', id, data);
export const deleteOwedToMe = (id) => deleteRecord('OWED_TO_ME', id);

export const fetchCreditCardLogins = () => fetchRecords('CREDIT_CARD_LOGINS');
export const createCreditCardLogin = (data) => createRecord('CREDIT_CARD_LOGINS', data);
export const updateCreditCardLogin = (id, data) => updateRecord('CREDIT_CARD_LOGINS', id, data);
export const deleteCreditCardLogin = (id) => deleteRecord('CREDIT_CARD_LOGINS', id);

export const fetchBalanceTransfers = () => fetchRecords('BALANCE_TRANSFERS');
export const createBalanceTransfer = (data) => createRecord('BALANCE_TRANSFERS', data);
export const updateBalanceTransfer = (id, data) => updateRecord('BALANCE_TRANSFERS', id, data);
export const deleteBalanceTransfer = (id) => deleteRecord('BALANCE_TRANSFERS', id);

export const fetchTradingPlatforms = () => fetchRecords('TRADING_PLATFORMS');
export const createTradingPlatform = (data) => createRecord('TRADING_PLATFORMS', data);
export const updateTradingPlatform = (id, data) => updateRecord('TRADING_PLATFORMS', id, data);
export const deleteTradingPlatform = (id) => deleteRecord('TRADING_PLATFORMS', id);

export const fetchTradingLiquidation = () => fetchRecords('TRADING_LIQUIDATION');
export const createTradingLiquidation = (data) => createRecord('TRADING_LIQUIDATION', data);
export const updateTradingLiquidation = (id, data) => updateRecord('TRADING_LIQUIDATION', id, data);
export const deleteTradingLiquidation = (id) => deleteRecord('TRADING_LIQUIDATION', id);

export const fetchSpecialProjects = () => fetchRecords('SPECIAL_PROJECTS');
export const createSpecialProject = (data) => createRecord('SPECIAL_PROJECTS', data);
export const updateSpecialProject = (id, data) => updateRecord('SPECIAL_PROJECTS', id, data);
export const deleteSpecialProject = (id) => deleteRecord('SPECIAL_PROJECTS', id);

export const fetchPendingPayouts = () => fetchRecords('PENDING_PAYOUTS');
export const createPendingPayout = (data) => createRecord('PENDING_PAYOUTS', data);
export const updatePendingPayout = (id, data) => updateRecord('PENDING_PAYOUTS', id, data);
export const deletePendingPayout = (id) => deleteRecord('PENDING_PAYOUTS', id);

export const fetchInvestments = () => fetchRecords('INVESTMENTS');
export const createInvestment = (data) => createRecord('INVESTMENTS', data);
export const updateInvestment = (id, data) => updateRecord('INVESTMENTS', id, data);
export const deleteInvestment = (id) => deleteRecord('INVESTMENTS', id);

export const fetchSportsbooks = () => fetchRecords('SPORTSBOOKS');
export const createSportsbook = (data) => createRecord('SPORTSBOOKS', data);
export const updateSportsbook = (id, data) => updateRecord('SPORTSBOOKS', id, data);
export const deleteSportsbook = (id) => deleteRecord('SPORTSBOOKS', id);

export const fetchSubscriptions = () => fetchRecords('SUBSCRIPTIONS');
export const createSubscription = (data) => createRecord('SUBSCRIPTIONS', data);
export const updateSubscription = (id, data) => updateRecord('SUBSCRIPTIONS', id, data);
export const deleteSubscription = (id) => deleteRecord('SUBSCRIPTIONS', id);

export const fetchMonthlyNetWorth = () => fetchRecords('MONTHLY_NET_WORTH');
export const createMonthlyNetWorth = (data) => createRecord('MONTHLY_NET_WORTH', data);
export const updateMonthlyNetWorth = (id, data) => updateRecord('MONTHLY_NET_WORTH', id, data);
export const deleteMonthlyNetWorth = (id) => deleteRecord('MONTHLY_NET_WORTH', id);
