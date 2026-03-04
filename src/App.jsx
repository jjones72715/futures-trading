import { useState, useEffect, useCallback } from "react";

const BASE = "app5RPYcCy7hqCu41";
const PERF_TABLE = "tblhM1DWRiWXnhSKb";
const EVAL_TABLE = "tblWeri8TXWPQY9Dc";
const PURCHASE_TABLE = "tblaBys956srO5pca";
const TRADERS_TABLE = "tbla0lbJ9z1PAhNy7";
const EVAL_TYPE_TABLE = "tbleHzHF5FgskLxs3";

const TRADERS = [
  { id: "rec0jB7J1Ir1ZspvM", name: "Amanda Seratt" },
  { id: "rec4l8EM9peAdyin4", name: "Judy Jones" },
  { id: "recG04aHVI38R6HnR", name: "Cherelyn Jones" },
  { id: "reccHyxv7emOGQJsQ", name: "Jefferies Parker" },
  { id: "recmziqSnANAPjtuH", name: "Jonathan Jones" },
];

const EVAL_TYPES = [
  { id: "rec5O8lSTqB4fXPsP", name: "Day Traders 150K Static", cost: 1750, accountSize: 150000 },
  { id: "rec8HfoHBk5m9oscj", name: "Top Step 150K", cost: 4500, accountSize: 150000 },
  { id: "rec8lBqRQBKOtFljx", name: "Tradeify 150K Select", cost: 4500, accountSize: 150000 },
  { id: "recCAYjMChppH9u8K", name: "Tradeify 100K Select", cost: 3000, accountSize: 100000 },
  { id: "recCePd3gcQGGiMe6", name: "Bulenox 50K EOD", cost: 2500, accountSize: 50000 },
  { id: "recD4IfxYzFKOxWGU", name: "TPT 150K", cost: 4500, accountSize: 150000 },
  { id: "recMLV7McrX0yqfd1", name: "FFN 100K Standard", cost: 3600, accountSize: 100000 },
  { id: "recMeH14HcTVOTABK", name: "Phidias Fundamental 100K", cost: 3000, accountSize: 100000 },
  { id: "recXHjiUdh5YzWpds", name: "FFN 150K Standard", cost: 5000, accountSize: 150000 },
  { id: "rece3sSv032SWiy8H", name: "TPT 100K", cost: 3000, accountSize: 100000 },
  { id: "recf85p2PhQs3O4Qx", name: "Funded Next 50K Legacy", cost: 2000, accountSize: 50000 },
  { id: "recjSpqACE1VGGL9l", name: "LucidFlex 100K", cost: 3000, accountSize: 100000 },
  { id: "reckab8EkDpFCco4e", name: "Day Traders 100K Static", cost: 1500, accountSize: 100000 },
  { id: "reclSB5U37mNwP5yE", name: "Funded Next 100K Legacy", cost: 3000, accountSize: 100000 },
  { id: "recldNrpc0Uw2iy0Q", name: "Trade Day 100K", cost: 3000, accountSize: 100000 },
  { id: "recmK6e815Mus0M4r", name: "TOF 50k Elite", cost: 2000, accountSize: 50000 },
  { id: "recmXkCwRhX8CwdHA", name: "BluSky 300k Blu+", cost: 5000, accountSize: 300000 },
  { id: "recnMxSRnwffHQqGf", name: "MFFU 50K Flex", cost: 2000, accountSize: 50000 },
  { id: "recpznnL6QT5BGnBL", name: "LucidFlex 150K", cost: 4500, accountSize: 150000 },
  { id: "recrwjjhAEaj98I29", name: "Phidias Static", cost: 500, accountSize: 25000 },
  { id: "recsMsMF8YosOvAKr", name: "Legends Elite 150K", cost: 4500, accountSize: 150000 },
  { id: "recx9L2t4eHPFzPAi", name: "Legends Elite 100K", cost: 3000, accountSize: 100000 },
];

// Baked-in eval accounts by trader
const EVAL_ACCOUNTS_BY_TRADER = {
  "rec0jB7J1Ir1ZspvM": [
    { id: "rec1o0gbCgJMAHOHp", name: "Amanda - Tradeify", typeId: "rec8lBqRQBKOtFljx", n: 5 },
    { id: "rec4iewCWsu43jRXH", name: "Amanda - Funded Next", typeId: "reclSB5U37mNwP5yE", n: 5 },
    { id: "recXo7TAj6XgXXCj6", name: "Amanda - Legends", typeId: "recx9L2t4eHPFzPAi", n: 5 },
    { id: "recvGwW6T4EYuj2GN", name: "Amanda - MFFU", typeId: "recnMxSRnwffHQqGf", n: 5 },
  ],
  "recG04aHVI38R6HnR": [
    { id: "recqH2ARYGbvj3Yia", name: "Sherry - Top Step", typeId: "rec8HfoHBk5m9oscj", n: 5 },
  ],
  "reccHyxv7emOGQJsQ": [],
  "recmziqSnANAPjtuH": [
    { id: "recXTsYpvLkG9a8eE", name: "Jonathan - Top Step 150k", typeId: "rec8HfoHBk5m9oscj", n: 5 },
    { id: "rec3ZFfrL58OLjzzT", name: "Jonathan - Trade Day", typeId: "recldNrpc0Uw2iy0Q", n: 3 },
    { id: "recE8B15AuEndvT4Z", name: "Jonathan - Phidias 100K", typeId: "recMeH14HcTVOTABK", n: 5 },
    { id: "recGHYkcYl5PoTU4s", name: "Jonathan - Bulenox", typeId: "recCePd3gcQGGiMe6", n: 3 },
    { id: "recNVPFz9cEsPqV5l", name: "Jonathan - DayTraders", typeId: "reckab8EkDpFCco4e", n: 5 },
    { id: "recgXgdKgKZPiNqnA", name: "Jonathan - Tradeify", typeId: "rec8lBqRQBKOtFljx", n: 5 },
  ],
  "rec4l8EM9peAdyin4": [],
};

async function fetchTable(tableId, fields) {
  const params = fields.map(f => `fields[]=${encodeURIComponent(f)}`).join("&");
  const res = await fetch(`/.netlify/functions/airtable/${BASE}/${tableId}?${params}&maxRecords=100`);
  const data = await res.json();
  return data.records || [];
}

async function createRecord(tableId, fields) {
  const res = await fetch(`/.netlify/functions/airtable/${BASE}/${tableId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fields }),
  });
  return res.json();
}

async function updateRecord(tableId, recordId, fields) {
  await fetch(`/.netlify/functions/airtable/${BASE}/${tableId}/${recordId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fields }),
  });
}

function $$(v) {
  if (v === null || v === undefined || v === "") return "—";
  const n = parseFloat(v);
  if (isNaN(n)) return "—";
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

function toScore(p) {
  if (!p && p !== 0) return 0;
  return Math.max(1, Math.min(10, Math.round(p * 10)));
}

function Bar({ prog }) {
  const n = toScore(prog);
  const c = n <= 3 ? "#ef4444" : n <= 6 ? "#f59e0b" : n <= 8 ? "#3b82f6" : "#22c55e";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
      <div style={{ width: 55, background: "#374151", borderRadius: 99, height: 5 }}>
        <div style={{ height: 5, borderRadius: 99, width: `${Math.min(100, (prog || 0) * 100)}%`, background: c }} />
      </div>
      <span style={{ fontSize: 11, fontWeight: 700, color: c }}>{n}/10</span>
    </div>
  );
}

function StatusPill({ status }) {
  const map = {
    "Active": ["#134e4a", "#2dd4bf"],
    "Live": ["#1e3a5f", "#60a5fa"],
    "Waiting on Payout": ["#3b2a0a", "#fbbf24"],
    "Inactive": ["#1f2937", "#6b7280"],
    "Failed": ["#450a0a", "#f87171"],
  };
  const [bg, text] = map[status] || ["#1f2937", "#9ca3af"];
  return <span style={{ background: bg, color: text, fontSize: 10, fontWeight: 600, padding: "2px 7px", borderRadius: 99, whiteSpace: "nowrap" }}>{status}</span>;
}

function SafetyBar({ safety }) {
  if (safety === null || safety === undefined) return <span style={{ color: "#6b7280" }}>—</span>;
  const pctVal = Math.min(1, safety);
  const color = pctVal < 0.2 ? "#ef4444" : pctVal < 0.5 ? "#f59e0b" : "#22c55e";
  return (
    <div>
      <div style={{ width: 55, background: "#374151", borderRadius: 99, height: 5, marginBottom: 2 }}>
        <div style={{ height: 5, borderRadius: 99, width: `${pctVal * 100}%`, background: color }} />
      </div>
      <span style={{ fontSize: 10, color, fontWeight: 600 }}>{Math.round(safety * 100)}%</span>
    </div>
  );
}

function AccountRow({ a, i, inputVal, noChange, done, onInput, onNoChange, onDone }) {
  const v = parseFloat(inputVal);
  const hasV = inputVal !== "" && !isNaN(v);
  const diff = noChange ? 0 : hasV ? (v - a.bal) * a.n : null;
  const pos = diff > 0;
  const zero = diff === 0;
  const tradeDownHit = a.tradeDown && hasV && !noChange && diff !== null && diff < 0 && Math.abs(diff / a.n) >= (a.ddToFloor || a.ddLeft);

  return (
    <div style={{
      background: done ? "#0a0f1a" : "#111827",
      border: `1px solid ${tradeDownHit ? "#dc2626" : done ? "#1a2030" : noChange ? "#1f4f1f" : hasV ? (pos ? "#166534" : "#7f1d1d") : "#1f2937"}`,
      borderRadius: 10, padding: "10px 14px", marginBottom: 5,
      display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap",
      opacity: done ? 0.45 : 1,
      boxShadow: tradeDownHit ? "0 0 12px rgba(220,38,38,0.4)" : "none",
    }}>
      <div style={{ width: 22, height: 22, background: "#1f2937", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, color: "#9ca3af", flexShrink: 0 }}>{i + 1}</div>

      <div style={{ width: 185, flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 2 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: done ? "#4b5563" : "#fff" }}>{a.name}</span>
          {a.tradeDown && <span style={{ fontSize: 9, fontWeight: 700, background: "#7f1d1d", color: "#fca5a5", padding: "1px 5px", borderRadius: 4 }}>TD</span>}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <span style={{ fontSize: 11, color: "#6b7280" }}>{a.trader}</span>
          {a.n > 1 && <span style={{ fontSize: 10, color: "#6b7280" }}>×{a.n}</span>}
          {a.contractMultiplier > 1 && <span style={{ fontSize: 10, background: "#1e3a5f", color: "#93c5fd", padding: "1px 5px", borderRadius: 4 }}>{a.contractMultiplier}x</span>}
        </div>
      </div>

      <div style={{ width: 80, flexShrink: 0 }}><StatusPill status={a.status} /></div>

      <div style={{ width: 105, flexShrink: 0 }}>
        <div style={{ fontSize: 10, color: "#6b7280", marginBottom: 3 }}>Progress</div>
        <Bar prog={a.prog} />
      </div>

      <div style={{ width: 95, flexShrink: 0 }}>
        <div style={{ fontSize: 10, color: "#6b7280", marginBottom: 2 }}>Balance</div>
        <div style={{ fontSize: 13, fontWeight: 600, color: done ? "#4b5563" : "#fff" }}>{$$(a.bal)}</div>
      </div>

      <div style={{ width: 80, flexShrink: 0 }}>
        <div style={{ fontSize: 10, color: "#6b7280", marginBottom: 2 }}>Trade Limit</div>
        <div style={{ fontSize: 13, fontWeight: 600, color: done ? "#4b5563" : "#93c5fd" }}>{$$(a.limit)}</div>
      </div>

      <div style={{ width: 80, flexShrink: 0 }}>
        <div style={{ fontSize: 10, color: "#6b7280", marginBottom: 2 }}>{a.tradeDown ? "DD to Floor" : "DD Left"}</div>
        <div style={{ fontSize: 13, fontWeight: 600, color: done ? "#4b5563" : a.tradeDown ? "#f87171" : "#fde68a" }}>{$$(a.tradeDown ? a.ddToFloor : a.ddLeft)}</div>
      </div>

      <div style={{ width: 75, flexShrink: 0 }}>
        <div style={{ fontSize: 10, color: "#6b7280", marginBottom: 2 }}>DD Safety</div>
        <SafetyBar safety={a.ddSafety} />
      </div>

      <div style={{ width: 75, flexShrink: 0 }}>
        <div style={{ fontSize: 10, color: "#6b7280", marginBottom: 2 }}>Invested</div>
        <div style={{ fontSize: 13, fontWeight: 600, color: done ? "#4b5563" : "#c4b5fd" }}>{$$(a.invested)}</div>
      </div>

      {tradeDownHit && (
        <div style={{ width: "100%", background: "#450a0a", border: "1px solid #dc2626", borderRadius: 8, padding: "8px 12px", display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 16 }}>⚠️</span>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#fca5a5" }}>TRADE DOWN TRIGGERED — Recovery trade required</div>
            <div style={{ fontSize: 11, color: "#f87171" }}>Target: get back to {$$(a.bal)} or breach. {a.invested > 0 && `Pull ${$$(Math.abs(diff / a.ddLeft) * a.invested)} from this account's investment.`}</div>
          </div>
        </div>
      )}

      <div style={{ flex: 1, minWidth: 220 }}>
        <div style={{ fontSize: 10, color: "#6b7280", marginBottom: 3 }}>Today's Ending Balance</div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <input type="number" placeholder="Enter balance..." value={inputVal} onChange={e => onInput(e.target.value)} disabled={noChange || done}
            style={{ background: (noChange || done) ? "#0d1117" : "#1f2937", border: "1px solid #1f2937", borderRadius: 7, padding: "6px 10px", fontSize: 13, color: (noChange || done) ? "#4b5563" : "#fff", width: 125, outline: "none" }} />
          <button onClick={onNoChange} disabled={done}
            style={{ background: noChange ? "#166534" : "#1f2937", border: `1px solid ${noChange ? "#22c55e" : "#374151"}`, borderRadius: 7, padding: "6px 10px", fontSize: 11, color: noChange ? "#4ade80" : "#9ca3af", cursor: done ? "default" : "pointer", fontWeight: 600, whiteSpace: "nowrap", opacity: done ? 0.4 : 1 }}>
            {noChange ? "✓ No Change" : "No Change"}
          </button>
          {diff !== null && !done && (
            <span style={{ fontSize: 13, fontWeight: 600, color: zero ? "#6b7280" : pos ? "#4ade80" : "#f87171" }}>
              {zero ? "±$0" : (pos ? "+" : "") + $$(diff)}
            </span>
          )}
          <button onClick={onDone} title={done ? "Mark as active" : "Done for today"}
            style={{ background: done ? "#166534" : "#1f2937", border: `1px solid ${done ? "#22c55e" : "#374151"}`, borderRadius: 7, width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", fontSize: 15, flexShrink: 0 }}>
            {done ? "✓" : "○"}
          </button>
        </div>
      </div>
    </div>
  );
}

function SectionGroup({ title, accounts, inputs, noChanges, dones, onInput, onNoChange, onDone, startIndex }) {
  if (accounts.length === 0) return null;
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0", borderBottom: "1px solid #1f2937", marginBottom: 8 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: 1 }}>{title}</span>
        <span style={{ background: "#1f2937", color: "#6b7280", fontSize: 10, padding: "1px 6px", borderRadius: 99 }}>{accounts.length}</span>
      </div>
      {accounts.map((a, i) => (
        <AccountRow key={a.id} a={a} i={startIndex + i} inputVal={inputs[a.id] || ""} noChange={!!noChanges[a.id]} done={!!dones[a.id]} onInput={val => onInput(a.id, val)} onNoChange={() => onNoChange(a.id)} onDone={() => onDone(a.id)} />
      ))}
    </div>
  );
}

function Section({ title, accounts, inputs, noChanges, dones, onInput, onNoChange, onDone, color }) {
  if (accounts.length === 0) return null;
  const active = accounts.filter(a => !dones[a.id]);
  if (active.length === 0) return null;

  const groups = {};
  active.forEach(a => {
    const dp = a.dataProvider || "Other";
    if (!groups[dp]) groups[dp] = [];
    groups[dp].push(a);
  });
  const sorted = Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));

  let idx = 0;
  return (
    <div style={{ marginBottom: 28 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <div style={{ width: 3, height: 18, background: color, borderRadius: 99 }} />
        <span style={{ fontSize: 14, fontWeight: 700, color: "#e5e7eb" }}>{title}</span>
        <span style={{ background: "#1f2937", color: "#9ca3af", fontSize: 11, padding: "1px 7px", borderRadius: 99 }}>{active.length}</span>
      </div>
      {sorted.map(([dp, accs]) => {
        const start = idx;
        idx += accs.length;
        return <SectionGroup key={dp} title={dp} accounts={accs} inputs={inputs} noChanges={noChanges} dones={dones} onInput={onInput} onNoChange={onNoChange} onDone={onDone} startIndex={start} />;
      })}
    </div>
  );
}

function DoneSection({ accounts, inputs, noChanges, dones, onInput, onNoChange, onDone }) {
  const done = accounts.filter(a => dones[a.id]);
  if (done.length === 0) return null;
  return (
    <div style={{ marginTop: 32 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, borderTop: "1px solid #1f2937", paddingTop: 20 }}>
        <div style={{ width: 3, height: 18, background: "#374151", borderRadius: 99 }} />
        <span style={{ fontSize: 14, fontWeight: 700, color: "#4b5563" }}>Done for Today</span>
        <span style={{ background: "#1f2937", color: "#4b5563", fontSize: 11, padding: "1px 7px", borderRadius: 99 }}>{done.length}</span>
      </div>
      {done.map((a, i) => (
        <AccountRow key={a.id} a={a} i={i} inputVal={inputs[a.id] || ""} noChange={!!noChanges[a.id]} done={true} onInput={val => onInput(a.id, val)} onNoChange={() => onNoChange(a.id)} onDone={() => onDone(a.id)} />
      ))}
    </div>
  );
}

// ── Purchase Tab ──────────────────────────────────────────────────────────────

function PurchaseTab() {
  const C = { bg: "#030712", card: "#111827", border: "#1f2937" };
  const sel = { background: "#1f2937", border: "1px solid #374151", borderRadius: 8, padding: "8px 12px", fontSize: 13, color: "#fff", width: "100%", outline: "none" };
  const inp = { background: "#1f2937", border: "1px solid #374151", borderRadius: 8, padding: "8px 12px", fontSize: 13, color: "#fff", width: "100%", outline: "none", boxSizing: "border-box" };

  const today = new Date().toISOString().split("T")[0];

  const [mode, setMode] = useState("");
  const [activePurchases, setActivePurchases] = useState([]);
  const [loadingActive, setLoadingActive] = useState(true);
  const [selectedPurchaseId, setSelectedPurchaseId] = useState("");
  const [evalAccounts, setEvalAccounts] = useState([]);
  const [selectedEvalId, setSelectedEvalId] = useState("");
  const [evalTypeId, setEvalTypeId] = useState("");
  const [date, setDate] = useState(today);
  const [numAccounts, setNumAccounts] = useState(1);
  const [costPer, setCostPer] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [err, setErr] = useState(null);
  const [recentPurchases, setRecentPurchases] = useState([]);
  const [loadingRecent, setLoadingRecent] = useState(true);

  useEffect(() => {
    loadActivePurchases();
    loadEvalAccounts();
    loadRecent();
  }, []);

  async function loadActivePurchases() {
    setLoadingActive(true);
    try {
      const records = await fetchTable(PURCHASE_TABLE, ["Name", "Status", "Evaluation Account Type", "Evaluation Account", "Trader", "Number of Accounts", "Cost Per Account", "Date Purchased", "Purchase Type"]);
      const active = records.filter(r => r.fields["Status"] === "Active");
      setActivePurchases(active);
    } catch (e) {}
    setLoadingActive(false);
  }

  async function loadEvalAccounts() {
    try {
      const records = await fetchTable(EVAL_TABLE, ["Name", "Status", "Evaluation Account Type", "Number of Accounts"]);
      setEvalAccounts(records.filter(r => r.fields["Status"] === "Active"));
    } catch (e) {}
  }

  async function loadRecent() {
    setLoadingRecent(true);
    try {
      const records = await fetchTable(PURCHASE_TABLE, ["Name", "Date Purchased", "Number of Accounts", "Cost Per Account", "Total Cost", "Purchase Type", "Status"]);
      const sorted = records.sort((a, b) => new Date(b.fields["Date Purchased"] || 0) - new Date(a.fields["Date Purchased"] || 0)).slice(0, 20);
      setRecentPurchases(sorted);
    } catch (e) {}
    setLoadingRecent(false);
  }

  function handleSelectPurchase(purchaseId) {
    setSelectedPurchaseId(purchaseId);
    const p = activePurchases.find(r => r.id === purchaseId);
    if (p) {
      const typeArr = p.fields["Evaluation Account Type"];
      const typeId = Array.isArray(typeArr) ? typeArr[0]?.id : null;
      if (typeId) {
        setEvalTypeId(typeId);
        const et = EVAL_TYPES.find(t => t.id === typeId);
        if (et) setCostPer(et.cost.toString());
      }
      const evalArr = p.fields["Evaluation Account"];
      if (Array.isArray(evalArr)) setSelectedEvalId(evalArr[0]?.id || "");
      setNumAccounts(p.fields["Number of Accounts"] || 1);
    }
  }

  function handleEvalTypeChange(typeId) {
    setEvalTypeId(typeId);
    const et = EVAL_TYPES.find(t => t.id === typeId);
    if (et) setCostPer(et.cost.toString());
  }

  function resetForm() {
    setMode("");
    setSelectedPurchaseId("");
    setSelectedEvalId("");
    setEvalTypeId("");
    setCostPer("");
    setNotes("");
    setNumAccounts(1);
    setDate(today);
  }

  const selectedPurchase = activePurchases.find(r => r.id === selectedPurchaseId);
  const selectedEvalType = EVAL_TYPES.find(t => t.id === evalTypeId);
  const trader = selectedPurchase ? TRADERS.find(t => t.id === selectedPurchase.fields["Trader"]?.[0]?.id) : null;
  const totalCost = (parseFloat(costPer) || 0) * numAccounts;
  const canSubmit = mode && evalTypeId && costPer && date && numAccounts > 0 && (mode === "new" ? selectedEvalId : selectedPurchaseId);

  async function handleSubmit() {
    if (!canSubmit) return;
    setSubmitting(true); setErr(null);
    try {
      const evalType = EVAL_TYPES.find(t => t.id === evalTypeId);
      const accountSize = evalType ? evalType.accountSize : 0;
      if (mode === "reset") {
        await updateRecord(PURCHASE_TABLE, selectedPurchaseId, { "Status": "Failed" });
        if (selectedEvalId) {
          await updateRecord(EVAL_TABLE, selectedEvalId, {
            "Current Balance": accountSize,
            "High Water Mark": accountSize,
            "Date Started": date,
            "Date Purchased": date,
          });
        }
        const purchaseName = `${selectedPurchase?.fields["Name"]?.split(" - ")[0]} - ${evalType?.name} - ${date}`;
        const fields = {
          "Name": purchaseName,
          "Date Purchased": date,
          "Number of Accounts": parseInt(numAccounts),
          "Cost Per Account": parseFloat(costPer),
          "Purchase Type": "Reset",
          "Status": "Active",
          "Notes": notes || undefined,
        };
        if (evalTypeId) fields["Evaluation Account Type"] = [evalTypeId];
        if (selectedEvalId) fields["Evaluation Account"] = [selectedEvalId];
        const traderArr = selectedPurchase?.fields["Trader"];
        if (traderArr) fields["Trader"] = [traderArr[0]?.id];
        await createRecord(PURCHASE_TABLE, fields);
      } else {
        const selectedEval = evalAccounts.find(r => r.id === selectedEvalId);
        const traderArr = selectedEval?.fields["Trader"];
        const traderId = Array.isArray(traderArr) ? traderArr[0]?.id : null;
        const purchaseName = `${TRADERS.find(t => t.id === traderId)?.name || "Unknown"} - ${evalType?.name} - ${date}`;
        const fields = {
          "Name": purchaseName,
          "Date Purchased": date,
          "Number of Accounts": parseInt(numAccounts),
          "Cost Per Account": parseFloat(costPer),
          "Purchase Type": "New",
          "Status": "Active",
          "Notes": notes || undefined,
        };
        if (evalTypeId) fields["Evaluation Account Type"] = [evalTypeId];
        if (selectedEvalId) fields["Evaluation Account"] = [selectedEvalId];
        if (traderId) fields["Trader"] = [traderId];
        await createRecord(PURCHASE_TABLE, fields);
      }
      setSuccess(true);
      setTimeout(() => setSuccess(false), 4000);
      resetForm();
      loadActivePurchases();
      loadRecent();
    } catch (e) {
      setErr("Failed to save: " + e.message);
    }
    setSubmitting(false);
  }

  const label = (text) => <div style={{ fontSize: 11, fontWeight: 600, color: "#9ca3af", marginBottom: 5, textTransform: "uppercase", letterSpacing: 0.5 }}>{text}</div>;

  return (
    <div style={{ display: "grid", gridTemplateColumns: "420px 1fr", gap: 20, alignItems: "start" }}>

      {/* Form */}
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 20 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: "#fff", marginBottom: 18 }}>Log a Purchase</div>

        {err && <div style={{ background: "#450a0a", border: "1px solid #7f1d1d", color: "#fca5a5", padding: "8px 12px", borderRadius: 8, fontSize: 12, marginBottom: 14 }}>{err}</div>}
        {success && <div style={{ background: "#052e16", border: "1px solid #166534", color: "#4ade80", padding: "8px 12px", borderRadius: 8, fontSize: 12, marginBottom: 14 }}>✓ Purchase logged successfully!</div>}

        {/* Step 1 - Mode */}
        {!mode && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {label("What type of purchase?")}
            <div onClick={() => setMode("reset")}
              style={{ background: "#1f2937", border: "1px solid #374151", borderRadius: 10, padding: "14px 16px", cursor: "pointer", display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ fontSize: 24 }}>🔄</span>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#f59e0b" }}>Reset an Account</div>
                <div style={{ fontSize: 11, color: "#6b7280" }}>An existing account breached — reset it</div>
              </div>
            </div>
            <div onClick={() => setMode("new")}
              style={{ background: "#1f2937", border: "1px solid #374151", borderRadius: 10, padding: "14px 16px", cursor: "pointer", display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ fontSize: 24 }}>➕</span>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#22c55e" }}>New Account</div>
                <div style={{ fontSize: 11, color: "#6b7280" }}>Purchase a brand new eval account</div>
              </div>
            </div>
            <div onClick={() => setMode("monthly")}
              style={{ background: "#1f2937", border: "1px solid #374151", borderRadius: 10, padding: "14px 16px", cursor: "pointer", display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ fontSize: 24 }}>📅</span>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#60a5fa" }}>Monthly Billing</div>
                <div style={{ fontSize: 11, color: "#6b7280" }}>Log a recurring monthly charge</div>
              </div>
            </div>
          </div>
        )}

        {/* Reset Flow */}
        {mode === "reset" && (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
              <button onClick={resetForm} style={{ background: "none", border: "none", color: "#6b7280", cursor: "pointer", fontSize: 18, padding: 0 }}>←</button>
              <span style={{ fontSize: 13, fontWeight: 600, color: "#f59e0b" }}>Reset an Account</span>
            </div>

            {label("Select the breached account")}
            {loadingActive ? (
              <div style={{ color: "#6b7280", fontSize: 12, marginBottom: 16 }}>Loading active accounts...</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
                {activePurchases.map(p => {
                  const f = p.fields;
                  const isSelected = selectedPurchaseId === p.id;
                  return (
                    <div key={p.id} onClick={() => handleSelectPurchase(p.id)}
                      style={{ background: isSelected ? "#2d1f00" : "#1f2937", border: `1px solid ${isSelected ? "#f59e0b" : "#374151"}`, borderRadius: 8, padding: "10px 14px", cursor: "pointer" }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "#fff" }}>{f["Name"]}</div>
                      <div style={{ fontSize: 11, color: "#6b7280", marginTop: 2 }}>
                        {f["Evaluation Account Type"]?.[0]?.name} · ×{f["Number of Accounts"]} · {f["Date Purchased"]}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {selectedPurchaseId && (
              <>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
                  <div>
                    {label("Date")}
                    <input type="date" value={date} onChange={e => setDate(e.target.value)} style={inp} />
                  </div>
                  <div>
                    {label("# of Accounts")}
                    <input type="number" min="1" value={numAccounts} onChange={e => setNumAccounts(e.target.value)} style={inp} />
                  </div>
                  <div>
                    {label("Cost Per Account")}
                    <input type="number" value={costPer} onChange={e => setCostPer(e.target.value)} style={inp} />
                  </div>
                </div>

                <div style={{ marginBottom: 16 }}>
                  {label("Notes (optional)")}
                  <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Any notes..." rows={2}
                    style={{ ...inp, resize: "vertical", fontFamily: "inherit" }} />
                </div>

                {selectedEvalType && (
                  <div style={{ background: "#1f2937", borderRadius: 8, padding: "10px 14px", marginBottom: 16 }}>
                    <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 4 }}>On submit:</div>
                    <div style={{ fontSize: 12, color: "#fca5a5" }}>• Old purchase → <strong>Failed</strong></div>
                    <div style={{ fontSize: 12, color: "#4ade80" }}>• New Reset purchase → <strong>Active</strong></div>
                    <div style={{ fontSize: 12, color: "#93c5fd" }}>• Eval account balance & HWM reset to <strong>{$$(selectedEvalType.accountSize)}</strong></div>
                  </div>
                )}

                {totalCost > 0 && (
                  <div style={{ background: "#1f2937", borderRadius: 8, padding: "10px 14px", marginBottom: 16, display: "flex", justifyContent: "space-between" }}>
                    <span style={{ fontSize: 12, color: "#9ca3af" }}>Total Cost</span>
                    <span style={{ fontSize: 16, fontWeight: 700, color: "#f87171" }}>{$$(totalCost)}</span>
                  </div>
                )}

                <button onClick={handleSubmit} disabled={!canSubmit || submitting}
                  style={{ width: "100%", background: canSubmit ? "#d97706" : "#1f2937", color: canSubmit ? "#fff" : "#4b5563", border: "none", borderRadius: 8, padding: "10px", fontSize: 14, fontWeight: 700, cursor: canSubmit ? "pointer" : "not-allowed" }}>
                  {submitting ? "Saving..." : `Reset Account — ${$$(totalCost)}`}
                </button>
              </>
            )}
          </>
        )}

        {/* New Account Flow */}
        {mode === "new" && (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
              <button onClick={resetForm} style={{ background: "none", border: "none", color: "#6b7280", cursor: "pointer", fontSize: 18, padding: 0 }}>←</button>
              <span style={{ fontSize: 13, fontWeight: 600, color: "#22c55e" }}>New Account</span>
            </div>

            <div style={{ marginBottom: 16 }}>
              {label("Link to Evaluation Account")}
              <select value={selectedEvalId} onChange={e => setSelectedEvalId(e.target.value)} style={sel}>
                <option value="">Choose eval account...</option>
                {evalAccounts.sort((a, b) => (a.fields["Name"] || "").localeCompare(b.fields["Name"] || "")).map(r => (
                  <option key={r.id} value={r.id}>{r.fields["Name"]}</option>
                ))}
              </select>
            </div>

            <div style={{ marginBottom: 16 }}>
              {label("Evaluation Account Type")}
              <select value={evalTypeId} onChange={e => handleEvalTypeChange(e.target.value)} style={sel}>
                <option value="">Choose type...</option>
                {EVAL_TYPES.sort((a, b) => a.name.localeCompare(b.name)).map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
              <div>
                {label("Date")}
                <input type="date" value={date} onChange={e => setDate(e.target.value)} style={inp} />
              </div>
              <div>
                {label("# of Accounts")}
                <input type="number" min="1" value={numAccounts} onChange={e => setNumAccounts(e.target.value)} style={inp} />
              </div>
              <div>
                {label("Cost Per Account")}
                <input type="number" placeholder="0.00" value={costPer} onChange={e => setCostPer(e.target.value)} style={inp} />
              </div>
            </div>

            <div style={{ marginBottom: 16 }}>
              {label("Notes (optional)")}
              <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Any notes..." rows={2}
                style={{ ...inp, resize: "vertical", fontFamily: "inherit" }} />
            </div>

            {totalCost > 0 && (
              <div style={{ background: "#1f2937", borderRadius: 8, padding: "10px 14px", marginBottom: 16, display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontSize: 12, color: "#9ca3af" }}>Total Cost</span>
                <span style={{ fontSize: 16, fontWeight: 700, color: "#f87171" }}>{$$(totalCost)}</span>
              </div>
            )}

            <button onClick={handleSubmit} disabled={!canSubmit || submitting}
              style={{ width: "100%", background: canSubmit ? "#2563eb" : "#1f2937", color: canSubmit ? "#fff" : "#4b5563", border: "none", borderRadius: 8, padding: "10px", fontSize: 14, fontWeight: 700, cursor: canSubmit ? "pointer" : "not-allowed" }}>
              {submitting ? "Saving..." : `Log Purchase — ${$$(totalCost)}`}
            </button>
          </>
        )}

        {/* Monthly Billing Flow */}
        {mode === "monthly" && (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
              <button onClick={resetForm} style={{ background: "none", border: "none", color: "#6b7280", cursor: "pointer", fontSize: 18, padding: 0 }}>←</button>
              <span style={{ fontSize: 13, fontWeight: 600, color: "#60a5fa" }}>Monthly Billing</span>
            </div>

            <div style={{ marginBottom: 16 }}>
              {label("Link to Evaluation Account")}
              <select value={selectedEvalId} onChange={e => setSelectedEvalId(e.target.value)} style={sel}>
                <option value="">Choose eval account...</option>
                {evalAccounts.sort((a, b) => (a.fields["Name"] || "").localeCompare(b.fields["Name"] || "")).map(r => (
                  <option key={r.id} value={r.id}>{r.fields["Name"]}</option>
                ))}
              </select>
            </div>

            <div style={{ marginBottom: 16 }}>
              {label("Evaluation Account Type")}
              <select value={evalTypeId} onChange={e => handleEvalTypeChange(e.target.value)} style={sel}>
                <option value="">Choose type...</option>
                {EVAL_TYPES.sort((a, b) => a.name.localeCompare(b.name)).map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
              <div>
                {label("Date")}
                <input type="date" value={date} onChange={e => setDate(e.target.value)} style={inp} />
              </div>
              <div>
                {label("# of Accounts")}
                <input type="number" min="1" value={numAccounts} onChange={e => setNumAccounts(e.target.value)} style={inp} />
              </div>
              <div>
                {label("Cost Per Account")}
                <input type="number" placeholder="0.00" value={costPer} onChange={e => setCostPer(e.target.value)} style={inp} />
              </div>
            </div>

            <div style={{ marginBottom: 16 }}>
              {label("Notes (optional)")}
              <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Any notes..." rows={2}
                style={{ ...inp, resize: "vertical", fontFamily: "inherit" }} />
            </div>

            {totalCost > 0 && (
              <div style={{ background: "#1f2937", borderRadius: 8, padding: "10px 14px", marginBottom: 16, display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontSize: 12, color: "#9ca3af" }}>Total Cost</span>
                <span style={{ fontSize: 16, fontWeight: 700, color: "#f87171" }}>{$$(totalCost)}</span>
              </div>
            )}

            <button onClick={handleSubmit} disabled={!canSubmit || submitting}
              style={{ width: "100%", background: canSubmit ? "#1d4ed8" : "#1f2937", color: canSubmit ? "#fff" : "#4b5563", border: "none", borderRadius: 8, padding: "10px", fontSize: 14, fontWeight: 700, cursor: canSubmit ? "pointer" : "not-allowed" }}>
              {submitting ? "Saving..." : `Log Billing — ${$$(totalCost)}`}
            </button>
          </>
        )}
      </div>

      {/* Recent Purchases */}
      <div>
        <div style={{ fontSize: 15, fontWeight: 700, color: "#fff", marginBottom: 14 }}>Recent Purchases</div>
        {loadingRecent ? (
          <div style={{ color: "#6b7280", fontSize: 13 }}>Loading...</div>
        ) : recentPurchases.length === 0 ? (
          <div style={{ color: "#6b7280", fontSize: 13 }}>No purchases logged yet.</div>
        ) : (
          recentPurchases.map(r => {
            const f = r.fields;
            const pt = f["Purchase Type"];
            const st = f["Status"];
            const ptColor = pt === "New" ? "#22c55e" : pt === "Reset" ? "#f59e0b" : "#60a5fa";
            const stColor = st === "Active" ? "#22c55e" : st === "Failed" ? "#ef4444" : "#f59e0b";
            return (
              <div key={r.id} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: "12px 16px", marginBottom: 8, display: "flex", alignItems: "center", gap: 14 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#fff", marginBottom: 3 }}>{f["Name"]}</div>
                  <div style={{ fontSize: 11, color: "#6b7280" }}>{f["Date Purchased"]} · ×{f["Number of Accounts"]} accounts</div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
                  <span style={{ fontSize: 10, fontWeight: 700, background: `${ptColor}20`, color: ptColor, padding: "2px 8px", borderRadius: 99 }}>{pt}</span>
                  <span style={{ fontSize: 10, fontWeight: 700, background: `${stColor}20`, color: stColor, padding: "2px 8px", borderRadius: 99 }}>{st}</span>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#f87171" }}>{$$(f["Total Cost"])}</div>
                  <div style={{ fontSize: 10, color: "#6b7280" }}>{$$(f["Cost Per Account"])} each</div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

// ── Main App ──────────────────────────────────────────────────────────────────

export default function App() {
  const [perfAccounts, setPerfAccounts] = useState([]);
  const [evalAccounts, setEvalAccounts] = useState([]);
  const [inputs, setInputs] = useState({});
  const [noChanges, setNoChanges] = useState({});
  const [dones, setDones] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState(null);
  const [tab, setTab] = useState("gameplan");

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true); setErr(null); setSaved(false);
    try {
      const [pr, er] = await Promise.all([
        fetchTable(PERF_TABLE, ["Name", "Status", "Number of Accounts", "Current Balance", "Current Drawdown Left", "Drawdown Safety", "Max Trade Size", "Progress to Stage Target", "Invested Per Account", "Trade Down Account", "Trade Down Floor", "Drawdown to Floor", "Contract Multiplier", "Data Provider", "Payout Account"]),
        fetchTable(EVAL_TABLE, ["Name", "Status", "Number of Accounts", "Current Balance", "Current Drawdown Left", "Drawdown Safety", "Max Trade Size", "Progress to Target", "Data Provider"]),
      ]);

      const activeStatuses = ["Active", "Live", "Waiting on Payout"];

      const mapPerf = r => {
        const f = r.fields;
        const dp = Array.isArray(f["Data Provider"]) ? f["Data Provider"][0] : (f["Data Provider"] || "Other");
        return {
          id: r.id, type: "perf",
          name: f["Name"] || "?",
          trader: "",
          status: f["Status"] || "",
          bal: f["Current Balance"] || 0,
          ddLeft: f["Current Drawdown Left"] || 0,
          ddToFloor: f["Drawdown to Floor"] || 0,
          prog: f["Progress to Stage Target"] || 0,
          limit: f["Max Trade Size"] || 0,
          invested: f["Invested Per Account"] || 0,
          n: f["Number of Accounts"] || 1,
          ddSafety: f["Drawdown Safety"] || 0,
          tradeDown: f["Trade Down Account"] || false,
          tradeDownFloor: f["Trade Down Floor"] || 0,
          contractMultiplier: f["Contract Multiplier"] || 1,
          payoutAccount: f["Payout Account"] || false,
          dataProvider: dp,
        };
      };

      const mapEval = r => {
        const f = r.fields;
        const dp = Array.isArray(f["Data Provider"]) ? f["Data Provider"][0] : (f["Data Provider"] || "Other");
        return {
          id: r.id, type: "eval",
          name: f["Name"] || "?",
          trader: "",
          status: f["Status"] || "",
          bal: f["Current Balance"] || 0,
          ddLeft: f["Current Drawdown Left"] || 0,
          ddToFloor: 0,
          prog: f["Progress to Target"] || 0,
          limit: f["Max Trade Size"] || 0,
          invested: 0,
          n: f["Number of Accounts"] || 1,
          ddSafety: f["Drawdown Safety"] || 0,
          tradeDown: false,
          tradeDownFloor: 0,
          contractMultiplier: 1,
          payoutAccount: false,
          dataProvider: dp,
        };
      };

      const perfs = pr.filter(r => activeStatuses.includes(r.fields["Status"])).map(mapPerf).sort((a, b) => a.prog - b.prog);
      const evals = er.filter(r => r.fields["Status"] === "Active").map(mapEval).sort((a, b) => a.prog - b.prog);

      setPerfAccounts(perfs);
      setEvalAccounts(evals);

      const inp = {};
      [...perfs, ...evals].forEach(a => { inp[a.id] = ""; });
      setInputs(inp);
      setNoChanges({});
    } catch (e) {
      setErr("Failed to load: " + e.message);
    }
    setLoading(false);
  }

  const onInput = useCallback((id, val) => {
    setInputs(prev => ({ ...prev, [id]: val }));
    setNoChanges(prev => ({ ...prev, [id]: false }));
  }, []);

  const onNoChange = useCallback((id) => {
    setNoChanges(prev => {
      const next = !prev[id];
      if (next) setInputs(p => ({ ...p, [id]: "" }));
      return { ...prev, [id]: next };
    });
  }, []);

  const onDone = useCallback((id) => {
    setDones(prev => ({ ...prev, [id]: !prev[id] }));
  }, []);

  async function save() {
    setSaving(true); setErr(null);
    try {
      const perfUpdates = perfAccounts.filter(a => inputs[a.id] !== "" && !isNaN(parseFloat(inputs[a.id])));
      const evalUpdates = evalAccounts.filter(a => inputs[a.id] !== "" && !isNaN(parseFloat(inputs[a.id])));
      await Promise.all([
        ...perfUpdates.map(a => updateRecord(PERF_TABLE, a.id, { "Current Balance": parseFloat(inputs[a.id]) })),
        ...evalUpdates.map(a => updateRecord(EVAL_TABLE, a.id, { "Current Balance": parseFloat(inputs[a.id]) })),
      ]);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      await load();
    } catch (e) {
      setErr("Save failed: " + e.message);
    }
    setSaving(false);
  }

  const liveOrPayout = perfAccounts.filter(a => a.status === "Live" || a.payoutAccount || a.status === "Waiting on Payout");
  const standardPerf = perfAccounts.filter(a => !liveOrPayout.includes(a));
  const allAccounts = [...evalAccounts, ...perfAccounts];

  const gain = allAccounts.reduce((s, a) => { const v = parseFloat(inputs[a.id]); if (noChanges[a.id] || isNaN(v) || !inputs[a.id]) return s; const d = (v - a.bal) * a.n; return d > 0 ? s + d : s; }, 0);
  const loss = allAccounts.reduce((s, a) => { const v = parseFloat(inputs[a.id]); if (noChanges[a.id] || isNaN(v) || !inputs[a.id]) return s; const d = (v - a.bal) * a.n; return d < 0 ? s + d : s; }, 0);
  const net = gain + loss;
  const filledCount = Object.entries(inputs).filter(([, v]) => v !== "" && !isNaN(parseFloat(v))).length + Object.values(noChanges).filter(Boolean).length;

  const losers = allAccounts.filter(a => !noChanges[a.id] && !dones[a.id] && inputs[a.id] && parseFloat(inputs[a.id]) < a.bal).map(a => {
    const ddRef = a.tradeDown ? a.ddToFloor : a.ddLeft;
    const pctLost = ddRef > 0 ? Math.abs(parseFloat(inputs[a.id]) - a.bal) / ddRef : 0;
    return { ...a, pctLost, move: pctLost * a.invested };
  }).filter(a => a.move > 0.5);

  const gainers = allAccounts.filter(a => !noChanges[a.id] && !dones[a.id] && inputs[a.id] && parseFloat(inputs[a.id]) > a.bal);
  const redists = losers.map(l => {
    const match = [...gainers].sort((a, b) => Math.abs(a.prog - l.prog) - Math.abs(b.prog - l.prog))[0];
    return { from: l.name, to: match?.name || "best gainer", amt: l.move, pct: l.pctLost };
  });

  const C = { bg: "#030712", card: "#111827", border: "#1f2937" };

  if (loading) return (
    <div style={{ minHeight: "100vh", background: C.bg, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "system-ui,sans-serif" }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <div style={{ textAlign: "center", color: "#9ca3af" }}>
        <div style={{ width: 36, height: 36, border: "3px solid #3b82f6", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto 12px" }} />
        <p>Loading your accounts...</p>
      </div>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: "#f3f4f6", fontFamily: "system-ui,sans-serif" }}>
      <style>{`input[type=number]::-webkit-inner-spin-button{opacity:1} input[type=number]{-moz-appearance:textfield}`}</style>

      <div style={{ background: C.card, borderBottom: `1px solid ${C.border}`, padding: "13px 20px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 700, color: "#fff" }}>📈 Daily Trading Dashboard</div>
          <div style={{ fontSize: 11, color: "#6b7280", marginTop: 1 }}>{new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}</div>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          {tab === "gameplan" && filledCount > 0 && <span style={{ fontSize: 12, color: "#60a5fa" }}>{filledCount} updated</span>}
          {tab === "gameplan" && (
            <button onClick={save} disabled={saving || filledCount === 0}
              style={{ background: saved ? "#065f46" : "#2563eb", color: "#fff", border: "none", borderRadius: 8, padding: "8px 16px", fontSize: 13, fontWeight: 600, cursor: filledCount === 0 ? "not-allowed" : "pointer", opacity: filledCount === 0 ? 0.4 : 1 }}>
              {saving ? "Saving..." : saved ? "✓ Saved!" : `Save (${filledCount}) to Airtable`}
            </button>
          )}
          {tab === "gameplan" && <button onClick={load} style={{ background: "transparent", color: "#9ca3af", border: `1px solid ${C.border}`, borderRadius: 8, padding: "8px 12px", fontSize: 13, cursor: "pointer" }}>↻ Refresh</button>}
        </div>
      </div>

      <div style={{ maxWidth: 1400, margin: "0 auto", padding: "16px 20px" }}>
        {err && <div style={{ background: "#450a0a", border: "1px solid #7f1d1d", color: "#fca5a5", padding: "10px 14px", borderRadius: 8, fontSize: 13, marginBottom: 12 }}>⚠ {err}</div>}

        {tab === "gameplan" && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 18 }}>
            {[["Profit Today", gain, "#22c55e"], ["Loss Today", loss, "#ef4444"], ["Net P&L", net, net >= 0 ? "#3b82f6" : "#f97316"]].map(([label, val, color]) => (
              <div key={label} style={{ background: `${color}15`, border: `1px solid ${color}40`, borderRadius: 10, padding: "11px 14px" }}>
                <div style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, color, marginBottom: 3 }}>{label}</div>
                <div style={{ fontSize: 22, fontWeight: 800, color }}>{$$(val)}</div>
              </div>
            ))}
          </div>
        )}

        <div style={{ display: "flex", borderBottom: `1px solid ${C.border}`, marginBottom: 16 }}>
          {[
            ["gameplan", "📊 Daily Gameplan"],
            ["redist", `💸 Redistribution${redists.length > 0 ? ` (${redists.length})` : ""}`],
            ["purchases", "🛒 Purchases"],
          ].map(([key, label]) => (
            <button key={key} onClick={() => setTab(key)}
              style={{ background: "none", border: "none", borderBottom: tab === key ? "2px solid #3b82f6" : "2px solid transparent", color: tab === key ? "#60a5fa" : "#6b7280", padding: "8px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer", marginBottom: -1 }}>
              {label}
            </button>
          ))}
        </div>

        {tab === "gameplan" && (
          <>
            <Section title="Evaluation Accounts" accounts={evalAccounts} inputs={inputs} noChanges={noChanges} dones={dones} onInput={onInput} onNoChange={onNoChange} onDone={onDone} color="#8b5cf6" />
            <Section title="Performance Accounts" accounts={standardPerf} inputs={inputs} noChanges={noChanges} dones={dones} onInput={onInput} onNoChange={onNoChange} onDone={onDone} color="#3b82f6" />
            <Section title="Live & Payout Accounts" accounts={liveOrPayout} inputs={inputs} noChanges={noChanges} dones={dones} onInput={onInput} onNoChange={onDone} onDone={onDone} color="#f59e0b" />
            <DoneSection accounts={allAccounts} inputs={inputs} noChanges={noChanges} dones={dones} onInput={onInput} onNoChange={onNoChange} onDone={onDone} />
          </>
        )}

        {tab === "redist" && (
          <div>
            {redists.length === 0
              ? <div style={{ textAlign: "center", padding: "50px 0", color: "#6b7280" }}>
                  <p style={{ fontSize: 15, marginBottom: 6 }}>No redistributions yet</p>
                  <p style={{ fontSize: 13 }}>Enter today's balances on the Gameplan tab to see suggestions</p>
                </div>
              : <>
                  <p style={{ fontSize: 13, color: "#9ca3af", marginBottom: 14 }}>Based on today's drawdown losses, suggested investment moves:</p>
                  {redists.map((r, i) => (
                    <div key={i} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: "13px 16px", display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
                      <div style={{ width: 26, height: 26, background: "#431407", border: "1px solid #9a3412", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", color: "#fb923c", fontWeight: 700, fontSize: 11, flexShrink: 0 }}>{i + 1}</div>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
                          <span style={{ color: "#f87171", fontWeight: 600 }}>{r.from}</span>
                          <span style={{ color: "#6b7280" }}>→</span>
                          <span style={{ color: "#4ade80", fontWeight: 600 }}>{r.to}</span>
                        </div>
                        <div style={{ fontSize: 11, color: "#6b7280", marginTop: 2 }}>{(r.pct * 100).toFixed(0)}% of drawdown lost</div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: 15, fontWeight: 700, color: "#fff" }}>{$$(r.amt)}</div>
                        <div style={{ fontSize: 11, color: "#6b7280" }}>to move</div>
                      </div>
                    </div>
                  ))}
                </>
            }
          </div>
        )}

        {tab === "purchases" && <PurchaseTab />}
      </div>
    </div>
  );
}