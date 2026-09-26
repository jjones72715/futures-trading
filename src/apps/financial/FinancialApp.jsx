import { useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import HomeTab from './tabs/HomeTab.jsx';
import BankingTab from './tabs/BankingTab.jsx';
import CreditCardsTab from './tabs/CreditCardsTab.jsx';
import TradingTab from './tabs/TradingTab.jsx';
import InvestmentsTab from './tabs/InvestmentsTab.jsx';
import SportsbooksTab from './tabs/SportsbooksTab.jsx';
import SubscriptionsTab from './tabs/SubscriptionsTab.jsx';
import NetWorthTab from './tabs/NetWorthTab.jsx';
import './financial.css';

const TABS = [
  { id: 'home', label: 'Home' },
  { id: 'banking', label: 'Banking Accounts' },
  { id: 'creditcards', label: 'Credit Cards' },
  { id: 'trading', label: 'Trading' },
  { id: 'investments', label: 'Investments' },
  { id: 'sportsbooks', label: 'Sportsbooks' },
  { id: 'subscriptions', label: 'Subscriptions' },
  { id: 'networth', label: 'Net Worth' },
];

const DEFAULT_SUBTAB = { banking: 'accounts', creditcards: 'balances' };

export default function FinancialApp() {
  const [tab, setTab] = useState('home');
  const [subtab, setSubtab] = useState(DEFAULT_SUBTAB);

  const navigate = useCallback((nextTab, nextSubtab) => {
    setTab(nextTab);
    if (nextSubtab) setSubtab(prev => ({ ...prev, [nextTab]: nextSubtab }));
    window.scrollTo({ top: 0 });
  }, []);

  const setSub = (key) => (value) => setSubtab(prev => ({ ...prev, [key]: value }));

  return (
    <div className="fin-app">
      <div className="fin-header">
        <div className="fin-title-row">
          <Link to="/" className="fin-back" title="All apps">←</Link>
          <h1 className="fin-title">Personal Finances</h1>
        </div>
        <div className="fin-tabs">
          {TABS.map(t => (
            <button key={t.id} className={`fin-tab${tab === t.id ? ' active' : ''}`} onClick={() => navigate(t.id)}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="fin-body">
        {tab === 'home' && <HomeTab onNavigate={navigate} />}
        {tab === 'banking' && <BankingTab subtab={subtab.banking} onSubtab={setSub('banking')} />}
        {tab === 'creditcards' && <CreditCardsTab subtab={subtab.creditcards} onSubtab={setSub('creditcards')} />}
        {tab === 'trading' && <TradingTab />}
        {tab === 'investments' && <InvestmentsTab />}
        {tab === 'sportsbooks' && <SportsbooksTab />}
        {tab === 'subscriptions' && <SubscriptionsTab />}
        {tab === 'networth' && <NetWorthTab />}
      </div>
    </div>
  );
}
