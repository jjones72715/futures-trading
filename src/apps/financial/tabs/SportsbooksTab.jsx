import BalanceTabView from '../components/BalanceTabView.jsx';
import { T } from '../config/airtable.js';

export default function SportsbooksTab() {
  return (
    <BalanceTabView
      table={T.SPORTSBOOKS}
      noun="Sportsbook"
      titleField="Book Name"
      ownerField="User"
      chipField="Book Name"
      totalLabel="Total in Sportsbooks"
      emptyIcon="🎲"
      emptyMessage="No sportsbook balances tracked yet."
      addLabel="+ Add Sportsbook"
    />
  );
}
