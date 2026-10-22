import { T } from '../config/airtable.js';
import { sumField, isActive, countsTowardNetWorth } from './formatters.js';

const round2 = (n) => Math.round(n * 100) / 100;

// Shared net worth building blocks, so Home and Net Worth always agree.
// `data` is keyed by table key, as returned by useTables().
export const totals = {
  // Active banking accounts not flagged "Exclude from Net Worth" + active sportsbooks.
  cash: (data) => round2(
    sumField((data[T.BANKING_ACCOUNTS] || []).filter(r => isActive(r) && countsTowardNetWorth(r)), 'Current Balance')
    + sumField((data[T.SPORTSBOOKS] || []).filter(isActive), 'Current Balance')
  ),
  investments: (data) => round2(sumField((data[T.INVESTMENTS] || []).filter(isActive), 'Current Balance')),
  // Trading Platforms has no Active field, so every platform counts.
  trading: (data) => round2(
    sumField(data[T.TRADING_PLATFORMS] || [], 'Current Balance')
    + sumField(data[T.TRADING_LIQUIDATION] || [], 'Current Balance')
  ),
  ccDebt: (data) => round2(sumField(data[T.CREDIT_CARD_LOGINS] || [], 'Current Balance')),
  owedToMe: (data) => round2(sumField(data[T.OWED_TO_ME] || [], 'Current Amount')),
  assets: (data) => round2(sumField((data[T.ASSETS] || []).filter(isActive), 'Current Value')),
  liabilities: (data) => round2(sumField((data[T.LIABILITIES] || []).filter(isActive), 'Current Balance')),
};
