import BalanceTabView from '../components/BalanceTabView.jsx';
import { T } from '../config/airtable.js';

export default function InvestmentsTab() {
  return (
    <BalanceTabView
      table={T.INVESTMENTS}
      noun="Investment Account"
      titleField="Account Name"
      ownerField="Owner"
      totalLabel="Total Invested"
      emptyIcon="📈"
      emptyMessage="No investment accounts yet."
      addLabel="+ Add Account"
      accent="var(--warning)"
    />
  );
}
