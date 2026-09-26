export const FINANCIAL_BASE_ID = 'appXzBgVF931cJ0vf';

// Mirrored in netlify/functions/financial.cjs — keep both in sync.
export const TABLES = {
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

// Table keys — components reference these, never raw table IDs.
export const T = Object.fromEntries(Object.keys(TABLES).map(k => [k, k]));

// Single-select choices (mirrors the Airtable schema).
export const CHOICES = {
  BANK_ACCOUNT_TYPE: ['Checking', 'Savings', 'Money Market', 'High Yield Savings'],
  TARGET_TYPE: ['Minimum Balance', 'Savings Goal', 'None'],
  BUSINESS_OR_PERSONAL: ['Personal', 'Business'],
  BONUS_ACCOUNT_TYPE: ['Checking', 'Savings'],
  OWED_TYPE: ['Personal', '1099 / Freelance', 'AU Payback'],
  ISSUER: ['American Express', 'Bank of America', 'Barclays', 'Capital One', 'Chase', 'Citi', 'Discover', 'US Bank', 'Wells Fargo', 'Other'],
  RELATIONSHIP: ['Primary', 'Authorized User'],
  TRANSFER_STATUS: ['Active', 'Paid Off', 'Expired'],
  PROJECT_STATUS: ['Active', 'Closed'],
  FREQUENCY: ['Monthly', 'Quarterly', 'Annual'],
  SUB_CATEGORY: ['Insurance', 'Subscription', 'Utilities', 'Loan', 'Software', 'Other'],
};
