import { useState } from 'react';
import { PortfolioTab } from './tabs/PortfolioTab.jsx';
import { AddCardTab } from './tabs/AddCardTab.jsx';
import { HotelsTab } from './tabs/HotelsTab.jsx';
import { AddHotelBenefitTab } from './tabs/AddHotelBenefitTab.jsx';
import { HotelBenefitTemplatesTab } from './tabs/HotelBenefitTemplatesTab.jsx';
import { BenefitsTrackerTab } from './tabs/BenefitsTrackerTab.jsx';
import { PointBalancesTab } from './tabs/PointBalancesTab.jsx';

const TABS = [
  { id: 'portfolio', label: 'Portfolio' },
  { id: 'point-balances', label: 'Point Balances' },
  { id: 'hotels', label: 'Hotels' },
  { id: 'benefits', label: 'Benefits Tracker' },
  { id: 'actions', label: 'Card Actions' },
  { id: 'recommendations', label: 'Card Recommendations' },
  { id: 'add', label: 'Add Card' },
  { id: 'add-hotel', label: 'Add Hotel Benefit' },
  { id: 'hotel-templates', label: 'Hotel Templates' },
];

export default function CreditCardsApp() {
  const [tab, setTab] = useState('portfolio');

  return (
    <div style={{
      minHeight: '100vh',
      background: '#0B1220',
      color: '#fff',
      fontFamily: 'system-ui, sans-serif',
    }}>
      <div style={{
        padding: '1.25rem 2rem 0',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
        background: '#0B1220',
        position: 'sticky',
        top: 0,
        zIndex: 10,
      }}>
        <h1 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 700, color: '#00D4FF', paddingBottom: '1rem' }}>
          Credit Cards
        </h1>
        <div style={{ display: 'flex', gap: 0, overflowX: 'auto' }}>
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                padding: '0.6rem 1.1rem',
                background: 'none',
                border: 'none',
                borderBottom: tab === t.id ? '2px solid #00D4FF' : '2px solid transparent',
                color: tab === t.id ? '#00D4FF' : 'rgba(255,255,255,0.5)',
                fontWeight: tab === t.id ? 600 : 400,
                fontSize: '0.88rem',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'all 0.15s',
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ padding: '1.5rem 2rem' }}>
        {tab === 'portfolio' && <PortfolioTab />}
        {tab === 'point-balances' && <PointBalancesTab />}
        {tab === 'benefits' && <BenefitsTrackerTab />}
        {tab === 'hotels' && <HotelsTab />}
        {tab === 'add' && <AddCardTab />}
        {tab === 'add-hotel' && <AddHotelBenefitTab onNavigateTemplates={() => setTab('hotel-templates')} />}
        {tab === 'hotel-templates' && (
          <div>
            <button onClick={() => setTab('add-hotel')} style={{
              background: 'none', border: 'none', color: '#00D4FF', fontSize: '0.85rem',
              cursor: 'pointer', fontWeight: 600, padding: '0 0 1.25rem 0', display: 'block',
            }}>
              ← Back to Add Hotel Benefit
            </button>
            <HotelBenefitTemplatesTab />
          </div>
        )}
        {!['portfolio', 'point-balances', 'benefits', 'hotels', 'add', 'add-hotel', 'hotel-templates'].includes(tab) && (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            height: '40vh', color: 'rgba(255,255,255,0.25)', fontSize: '1.1rem',
          }}>
            Coming Soon
          </div>
        )}
      </div>
    </div>
  );
}
