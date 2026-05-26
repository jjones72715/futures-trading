import { BrowserRouter, Routes, Route } from 'react-router-dom';
import DashboardPage from './apps/dashboard/DashboardPage.jsx';
import TradingApp from './apps/trading/index.jsx';
import FinancialApp from './apps/financial/index.jsx';
import CreditCardsApp from './apps/creditcards/index.jsx';
import ComingSoonApp from './apps/comingsoon/index.jsx';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/trading" element={<TradingApp />} />
        <Route path="/financial" element={<FinancialApp />} />
        <Route path="/creditcards" element={<CreditCardsApp />} />
        <Route path="/comingsoon" element={<ComingSoonApp />} />
      </Routes>
    </BrowserRouter>
  );
}
