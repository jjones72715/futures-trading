import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";

const BASE = "app5RPYcCy7hqCu41";
const PERF_TABLE = "tblhM1DWRiWXnhSKb";
const EVAL_TABLE = "tblWeri8TXWPQY9Dc";
const PURCHASE_TABLE = "tblaBys956srO5pca";
const TRADERS_TABLE = "tbla0lbJ9z1PAhNy7";
const EVAL_TYPE_TABLE = "tbleHzHF5FgskLxs3";
const PAYOUT_TABLE = "tblIEpLE5eIV7k6B7";
const PAYOUT_STATUSES = ["Requested", "Processing", "Approved", "Received"];

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
  const allRecords = [];
  let offset = null;
  do {
    const url = `/.netlify/functions/airtable/${BASE}/${tableId}?${params}${offset ? `&offset=${offset}` : ""}`;
    const res = await fetch(url);
    const data = await res.json();
    allRecords.push(...(data.records || []));
    offset = data.offset || null;
  } while (offset);
  return allRecords;
}

async function createRecord(tableId, fields) {
  const res = await fetch(`/.netlify/functions/airtable/${BASE}/${tableId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fields }),
  });
  const data = await res.json();
  if (!res.ok || data?.error) throw new Error(data?.error?.message || `Airtable error ${res.status}`);
  return data;
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

function $$target(v) {
  if (!v || v === 0) return "Max";
  const n = parseFloat(v);
  if (isNaN(n) || n > 4501) return "Max";
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

function lpColor(n) {
  if (n <= 1) return "#22c55e";
  if (n >= 10) return "#ef4444";
  if (n <= 5) {
    const t = (n - 1) / 4;
    return `rgb(${Math.round(34 + 200 * t)},${Math.round(197 - 18 * t)},${Math.round(94 - 86 * t)})`;
  }
  const t = (n - 5) / 5;
  return `rgb(${Math.round(234 + 5 * t)},${Math.round(179 - 111 * t)},${Math.round(8 + 60 * t)})`;
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

function WaitingSection({ accounts, inputs, noChanges, dones, onInput, onNoChange, onDone, onBreach }) {
  const active = accounts.filter(a => !dones[a.id]);
  if (active.length === 0) return null;
  const sorted = active.slice().sort((a, b) => a.name.localeCompare(b.name));
  return (
    <div style={{ marginBottom: 28 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <div style={{ width: 3, height: 18, background: "#6b7280", borderRadius: 99 }} />
        <span style={{ fontSize: 14, fontWeight: 700, color: "#e5e7eb" }}>Waiting on Payout</span>
        <span style={{ background: "#1f2937", color: "#9ca3af", fontSize: 11, padding: "1px 7px", borderRadius: 99 }}>{sorted.length}</span>
      </div>
      {sorted.map((a, i) => (
        <AccountRow key={a.id} a={a} i={i} inputVal={inputs[a.id] || ""} noChange={!!noChanges[a.id]} done={!!dones[a.id]} onInput={val => onInput(a.id, val)} onNoChange={() => onNoChange(a.id)} onDone={() => onDone(a.id)} onBreach={() => onBreach(a)} />
      ))}
    </div>
  );
}
const AccountRow = React.memo(function AccountRow({ a, i, inputVal, noChange, done, onInput, onNoChange, onDone, onBreach }) {
  const [localVal, setLocalVal] = React.useState(inputVal);
  React.useEffect(() => { setLocalVal(inputVal); }, [inputVal]);
  const v = parseFloat(localVal);
  const hasV = localVal !== "" && !isNaN(v);
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

      {a.prog > 0 && (
        <div style={{ width: 105, flexShrink: 0 }}>
          <div style={{ fontSize: 10, color: "#6b7280", marginBottom: 3 }}>Progress</div>
          <Bar prog={a.prog} />
        </div>
      )}

      <div style={{ width: 95, flexShrink: 0 }}>
        <div style={{ fontSize: 10, color: "#6b7280", marginBottom: 2 }}>Balance</div>
        <div style={{ fontSize: 13, fontWeight: 600, color: done ? "#4b5563" : "#fff" }}>{$$(a.bal)}</div>
      </div>

      <div style={{ width: 80, flexShrink: 0 }}>
        <div style={{ fontSize: 10, color: "#6b7280", marginBottom: 2 }}>Daily Target</div>
        <div style={{ fontSize: 13, fontWeight: 600, color: done ? "#4b5563" : "#4ade80" }}>{$$(a.dailyTarget)}</div>
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
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          <button onClick={onNoChange} disabled={done}
            style={{ background: noChange ? "#166534" : "#1f2937", border: `1px solid ${noChange ? "#22c55e" : "#374151"}`, borderRadius: 7, padding: "6px 10px", fontSize: 11, color: noChange ? "#4ade80" : "#9ca3af", cursor: done ? "default" : "pointer", fontWeight: 600, whiteSpace: "nowrap", opacity: done ? 0.4 : 1 }}>
            {noChange ? "✓ No Change" : "No Change"}
          </button>
          <input type="number" placeholder={String(a.bal)} value={localVal} onChange={e => setLocalVal(e.target.value)} onBlur={e => {
              onInput(e.target.value);
            }} disabled={noChange}
            style={{ background: noChange ? "#0d1117" : "#1f2937", border: "1px solid #1f2937", borderRadius: 7, padding: "6px 10px", fontSize: 13, color: noChange ? "#4b5563" : "#fff", width: 125, outline: "none", MozAppearance: "textfield", WebkitAppearance: "none" }} />
          {diff !== null && !done && (
            <span style={{ fontSize: 13, fontWeight: 600, color: zero ? "#6b7280" : pos ? "#4ade80" : "#f87171" }}>
              {zero ? "±$0" : (pos ? "+" : "") + $$(diff)}
            </span>
          )}
          <button onClick={e => { e.stopPropagation(); onBreach(); }} title="Log a breach"
            style={{ background: "#450a0a", border: "1px solid #7f1d1d", borderRadius: 7, width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", fontSize: 15, flexShrink: 0 }}>
            💥
          </button>
          <button onClick={e => { e.stopPropagation(); onDone(); }} title={done ? "Mark as active" : "Done for today"}
            style={{ background: done ? "#166534" : "#1f2937", border: `1px solid ${done ? "#22c55e" : "#374151"}`, borderRadius: 7, width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", fontSize: 15, flexShrink: 0 }}>
            {done ? "✓" : "☐"}
          </button>
          {a.status === "Live" && (
            <span style={{ fontSize: 10, fontWeight: 700, background: "#7f1d1d", color: "#fca5a5", padding: "3px 8px", borderRadius: 6 }}>LIVE</span>
          )}
          {a.status === "Waiting on Payout" && (
            <span style={{ fontSize: 10, fontWeight: 700, background: "#1c3a1c", color: "#4ade80", padding: "3px 8px", borderRadius: 6 }}>WAITING</span>
          )}
        </div>
      </div>
    </div>
  );
});

function SectionGroup({ title, accounts, inputs, noChanges, dones, onInput, onNoChange, onDone, onBreach, startIndex }) {
  if (accounts.length === 0) return null;
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0", borderBottom: "1px solid #1f2937", marginBottom: 8 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: 1 }}>{title}</span>
        <span style={{ background: "#1f2937", color: "#6b7280", fontSize: 10, padding: "1px 6px", borderRadius: 99 }}>{accounts.length}</span>
      </div>
      {accounts.map((a, i) => (
        <AccountRow key={a.id} a={a} i={startIndex + i} inputVal={inputs[a.id] || ""} noChange={!!noChanges[a.id]} done={!!dones[a.id]} onInput={val => onInput(a.id, val)} onNoChange={() => onNoChange(a.id)} onDone={() => onDone(a.id)} onBreach={() => onBreach(a)} />
      ))}
    </div>
  );
}

function Section({ title, accounts, inputs, noChanges, dones, onInput, onNoChange, onDone, onBreach, color }) {
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
      return <SectionGroup key={dp} title={dp} accounts={accs} inputs={inputs} noChanges={noChanges} dones={dones} onInput={onInput} onNoChange={onNoChange} onDone={onDone} onBreach={onBreach} startIndex={start} />;
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
        <AccountRow key={a.id} a={a} i={i} inputVal={inputs[a.id] || ""} noChange={!!noChanges[a.id]} done={true} onInput={val => onInput(a.id, val)} onNoChange={() => onNoChange(a.id)} onDone={() => onDone(a.id)} onBreach={() => onBreach(a)}/>
      ))}
    </div>
  );
}

// ── Purchase Tab ──────────────────────────────────────────────────────────────

function PurchaseTab() {
  const C = { bg: "#0d1117", card: "#1f2a37", border: "#2d3f50" };
  const sel = { background: "#111827", border: "1px solid #2d3f50", borderRadius: 8, padding: "8px 12px", fontSize: 13, color: "#fff", width: "100%", outline: "none" };
  const inp = { background: "#111827", border: "1px solid #2d3f50", borderRadius: 8, padding: "8px 12px", fontSize: 13, color: "#fff", width: "100%", outline: "none", boxSizing: "border-box" };
  const subTabStyle = (active) => ({ background: active ? "#2563eb" : "#1f2a37", color: active ? "#fff" : "#aaa", border: `1px solid ${active ? "#3b82f6" : "#2f3b4a"}`, borderRadius: 8, padding: "8px 18px", fontSize: 13, fontWeight: 600, cursor: "pointer" });

  const today = new Date().toISOString().split("T")[0];

  const [mode, setMode] = useState("reset");
  const [activePurchases, setActivePurchases] = useState([]);
  const [loadingActive, setLoadingActive] = useState(true);
  const [selectedPurchaseId, setSelectedPurchaseId] = useState("");
  const [evalAccounts, setEvalAccounts] = useState([]);
  const [selectedEvalId, setSelectedEvalId] = useState("");
  const [evalTypeId, setEvalTypeId] = useState("");
  const [date, setDate] = useState(today);
  const [dateStarted, setDateStarted] = useState(today);
  const [numAccounts, setNumAccounts] = useState(1);
  const [costPer, setCostPer] = useState("");
  const [notes, setNotes] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [err, setErr] = useState(null);
  const [recentPurchases, setRecentPurchases] = useState([]);
  const [loadingRecent, setLoadingRecent] = useState(true);
  const [traderId, setTraderId] = useState("");
  const [showAllRecent, setShowAllRecent] = useState(false);
  const [evalTypeList, setEvalTypeList] = useState([]);
  const [traderList, setTraderList] = useState([]);
  const [purchaseCountsByTrader, setPurchaseCountsByTrader] = useState({});

  useEffect(() => {
    loadActivePurchases();
    loadEvalAccounts();
    loadRecent();
    loadEvalTypes();
    loadTraders();
  }, []);

  async function loadActivePurchases() {
    setLoadingActive(true);
    try {
      const records = await fetchTable(PURCHASE_TABLE, ["Name", "Status", "Trader", "Evaluation Account Type", "Evaluation Account", "Date Purchased", "Cost Per Account", "Number of Accounts", "Purchase Type"]);
      const active = records.filter(r => r.fields["Status"] === "Active");
      const counts = {};
      active.forEach(r => {
        const tid = Array.isArray(r.fields["Trader"]) ? r.fields["Trader"][0] : null;
        if (tid) counts[tid] = (counts[tid] || 0) + 1;
      });
      setPurchaseCountsByTrader(counts);
      setActivePurchases(active);
    } catch (e) {}
    setLoadingActive(false);
  }

  async function loadEvalAccounts() {
    try {
      const records = await fetchTable(EVAL_TABLE, ["Name", "Status", "Evaluation Account Type", "Number of Accounts", "Date Started"]);
      setEvalAccounts(records.filter(r => r.fields["Status"] === "Active"));
    } catch (e) {}
  }

  async function loadRecent() {
    setLoadingRecent(true);
    try {
      const records = await fetchTable(PURCHASE_TABLE, ["Name", "Date Purchased", "Number of Accounts", "Cost Per Account", "Total Cost", "Purchase Type", "Status", "Trader"]);
      const sorted = records.sort((a, b) => new Date(b.fields["Date Purchased"] || 0) - new Date(a.fields["Date Purchased"] || 0));
      setRecentPurchases(sorted);
    } catch (e) {}
    setLoadingRecent(false);
  }

  async function loadEvalTypes() {
    try {
      const evalTypes = await fetchTable(EVAL_TYPE_TABLE, ["Name", "Account Size", "Profit Target", "Drawdown Limit", "Daily Loss Limit", "Max Contracts"]);
      setEvalTypeList(evalTypes.map(r => ({ id: r.id, name: r.fields["Name"], accountSize: r.fields["Account Size"] || 0, cost: r.fields["Cost Per Account"] || 0 })).sort((a, b) => a.name.localeCompare(b.name)));
    } catch (e) {}
  }

  async function loadTraders() {
    try {
      const traders = await fetchTable(TRADERS_TABLE, ["Name", "Preferred Name"]);
      setTraderList(traders.map(r => ({
        id: r.id,
        name: r.fields["Name"],
        preferredName: r.fields["Preferred Name"] || r.fields["Name"].split(" ")[0],
      })).sort((a, b) => a.preferredName.localeCompare(b.preferredName)));
    } catch (e) {}
  }

  function handleSelectPurchase(purchaseId) {
    setSelectedPurchaseId(purchaseId);
    const p = activePurchases.find(r => r.id === purchaseId);
    if (p) {
      console.log("selected purchase fields:", JSON.stringify(p.fields));
      const typeArr = p.fields["Evaluation Account Type"];
      const typeId = Array.isArray(typeArr) ? (typeof typeArr[0] === "string" ? typeArr[0] : typeArr[0]?.id) : null;
      console.log("typeId found:", typeId);
      if (typeId) {
        setEvalTypeId(typeId);
        const et = evalTypeList.find(t => t.id === typeId);
        if (et) setCostPer(et.cost.toString());
      }
      const evalArr = p.fields["Evaluation Account"];
      if (Array.isArray(evalArr)) {
        const evalId = typeof evalArr[0] === "string" ? evalArr[0] : evalArr[0]?.id || "";
        setSelectedEvalId(evalId);
        const evalRec = evalAccounts.find(r => r.id === evalId);
        if (evalRec?.fields?.["Date Started"]) setDateStarted(evalRec.fields["Date Started"]);
      }
      setNumAccounts(p.fields["Number of Accounts"] || 1);
    }
  }

  function handleEvalTypeChange(typeId) {
    setEvalTypeId(typeId);
    const et = evalTypeList.find(t => t.id === typeId);
    if (et) setCostPer(et.cost.toString());
  }

  function resetForm(keepMode) {
    if (!keepMode) { setMode("reset"); setShowAllRecent(false); }
    setSelectedPurchaseId("");
    setSelectedEvalId("");
    setEvalTypeId("");
    setCostPer("");
    setNotes("");
    setAccountNumber("");
    setNumAccounts(1);
    setDate(today);
    setDateStarted(today);
  }

  const selectedPurchase = activePurchases.find(r => r.id === selectedPurchaseId);
  const selectedEvalType = evalTypeList.find(t => t.id === evalTypeId);
  const trader = selectedPurchase ? traderList.find(t => t.id === selectedPurchase.fields["Trader"]?.[0]?.id) : null;
  const totalCost = (parseFloat(costPer) || 0) * numAccounts;
  const canSubmit = evalTypeId && costPer && date && numAccounts > 0 && (mode === "reset" ? selectedPurchaseId : traderId);
  console.log("canSubmit check:", { mode, evalTypeId, costPer, date, numAccounts, selectedPurchaseId, traderId });

  async function handleSubmit() {
    if (!canSubmit) return;
    setSubmitting(true); setErr(null);
    try {
      const evalType = evalTypeList.find(t => t.id === evalTypeId);
      const accountSize = evalType ? evalType.accountSize : 0;
      if (mode === "reset") {
        await updateRecord(PURCHASE_TABLE, selectedPurchaseId, { "Status": "Failed" });
        if (selectedEvalId) {
          const resetFields = {
            "Current Balance": accountSize,
            "High Water Mark": accountSize,
            "Date Purchased": date,
            "Date Started": dateStarted,
            "Trading Days Completed": 0,
          };
          if (accountNumber) resetFields["Account Number"] = accountNumber;
          await updateRecord(EVAL_TABLE, selectedEvalId, resetFields);
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
        if (traderArr && traderArr.length > 0) {
          fields["Trader"] = [typeof traderArr[0] === "string" ? traderArr[0] : traderArr[0]?.id];
        }
        await createRecord(PURCHASE_TABLE, fields);
      } else {
        const traderObj = traderList.find(t => t.id === traderId);
        const purchaseName = `${traderObj?.name || "Unknown"} - ${evalType?.name} - ${date}`;

        // Create the eval account record first
        const evalAccountFields = {
          "Name": `${traderObj?.name?.split(" ")[0]} - ${evalType?.name}`,
          "Status": "Active",
          "Current Balance": accountSize,
          "High Water Mark": accountSize,
          "Date Purchased": date,
          "Date Started": date,
          "Number of Accounts": parseInt(numAccounts),
        };
        if (evalTypeId) evalAccountFields["Evaluation Account Type"] = [evalTypeId];
        if (traderId) evalAccountFields["Trader"] = [traderId];
        if (accountNumber) evalAccountFields["Account Number"] = accountNumber;

        const newEvalRecord = await createRecord(EVAL_TABLE, evalAccountFields);
        const newEvalId = newEvalRecord?.id;

        // Create purchase log linked to new eval account
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
        if (newEvalId) fields["Evaluation Account"] = [newEvalId];
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
    <div style={{ maxWidth: 560 }}>
      {/* Subtabs */}
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        {[["reset", "🔄 Reset Account"], ["new", "➕ New Account"], ["recent", "🕐 Recent Purchases"]].map(([m, lbl]) => (
          <button key={m} onClick={() => { setMode(m); setShowAllRecent(false); resetForm(true); }} style={subTabStyle(mode === m)}>{lbl}</button>
        ))}
      </div>

      {/* Trader pills */}
      {(() => {
        // Per-mode count maps
        const resetCounts = (() => {
          const c = {};
          activePurchases.filter(r => {
            const ea = r.fields["Evaluation Account"];
            if (!ea?.length) return false;
            const eid = typeof ea[0] === "string" ? ea[0] : ea[0]?.id;
            return evalAccounts.some(a => a.id === eid);
          }).forEach(r => {
            const tid = Array.isArray(r.fields["Trader"]) ? r.fields["Trader"][0] : null;
            if (tid) c[tid] = (c[tid] || 0) + 1;
          });
          return c;
        })();
        const recentCounts = (() => {
          const c = {};
          recentPurchases.forEach(r => {
            const tid = Array.isArray(r.fields["Trader"]) ? r.fields["Trader"][0] : null;
            if (tid) c[tid] = Math.min((c[tid] || 0) + 1, 10);
          });
          return c;
        })();
        const countMap = mode === "reset" ? resetCounts : mode === "recent" ? recentCounts : {};
        const visibleTraders = traderList.filter(t => mode === "new" || (countMap[t.id] || 0) > 0);
        return (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
            {visibleTraders.map(t => {
              const active = traderId === t.id;
              const count = countMap[t.id];
              return (
                <button key={t.id}
                  onClick={() => { setTraderId(active ? "" : t.id); setShowAllRecent(false); resetForm(true); }}
                  style={{ background: active ? "#1f3a5f" : "#18222f", color: active ? "#7dd3fc" : "#888", border: `1px solid ${active ? "#3b82f6" : "#2a3442"}`, borderRadius: 999, padding: "4px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}>
                  {t.preferredName}{mode !== "new" && count ? ` (${count})` : ""}
                </button>
              );
            })}
            {mode === "recent" && (
              <button
                onClick={() => { setTraderId(""); setShowAllRecent(v => !v); }}
                style={{ background: showAllRecent ? "#1f3a5f" : "#18222f", color: showAllRecent ? "#7dd3fc" : "#888", border: `1px solid ${showAllRecent ? "#3b82f6" : "#2a3442"}`, borderRadius: 999, padding: "4px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}>
                📋 All Purchases
              </button>
            )}
          </div>
        );
      })()}

      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 20 }}>
        {err && <div style={{ background: "#450a0a", border: "1px solid #7f1d1d", color: "#fca5a5", padding: "8px 12px", borderRadius: 8, fontSize: 12, marginBottom: 14 }}>{err}</div>}
        {success && <div style={{ background: "#052e16", border: "1px solid #166534", color: "#4ade80", padding: "8px 12px", borderRadius: 8, fontSize: 12, marginBottom: 14 }}>✓ Purchase logged successfully!</div>}

        {/* Reset Flow */}
        {mode === "reset" && (
          <>
            {!traderId ? (
              <div style={{ color: "#6b7280", fontSize: 12 }}>Select a trader above to see their active accounts.</div>
            ) : <>
            {label("Select the breached account")}
            {loadingActive ? (
              <div style={{ color: "#6b7280", fontSize: 12, marginBottom: 16 }}>Loading active accounts...</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
                {activePurchases.filter(r => {
                  const traderArr = r.fields["Trader"];
                  if (traderId && !(Array.isArray(traderArr) && traderArr.includes(traderId))) return false;
                  const evalArr = r.fields["Evaluation Account"];
                  if (!evalArr || !evalArr.length) return false;
                  const evalId = typeof evalArr[0] === "string" ? evalArr[0] : evalArr[0]?.id;
                  return evalAccounts.some(ea => ea.id === evalId);
                }).map(p => {
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
                    {label("Purchase Date")}
                    <input type="date" value={date} onChange={e => setDate(e.target.value)} style={inp} />
                  </div>
                  <div>
                    {label("Date Started")}
                    <input type="date" value={dateStarted} onChange={e => setDateStarted(e.target.value)} style={inp} />
                  </div>
                  <div>
                    {label("# of Accounts")}
                    <input type="number" min="1" value={numAccounts} onChange={e => setNumAccounts(e.target.value)} style={inp} />
                  </div>
                  <div>
                    {label("Cost Per Account")}
                    <input type="number" value={costPer} onChange={e => setCostPer(e.target.value)} style={inp} />
                  </div>
                  <div style={{ gridColumn: "1/-1" }}>
                    {label("Account Number")}
                    <input type="text" placeholder="Optional" value={accountNumber} onChange={e => setAccountNumber(e.target.value)} style={inp} />
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
                    <div style={{ fontSize: 12, color: "#93c5fd" }}>• Balance & HWM reset to <strong>{$$(selectedEvalType.accountSize)}</strong></div>
                    <div style={{ fontSize: 12, color: "#93c5fd" }}>• Trading days reset to <strong>0</strong></div>
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
            </>}
          </>
        )}

        {/* New Account Flow */}
        {mode === "new" && (
          <>
            {!traderId && <div style={{ color: "#6b7280", fontSize: 12, marginBottom: 16 }}>Select a trader above to continue.</div>}
            {traderId && <><div style={{ marginBottom: 16 }}>
              {label("Evaluation Account Type")}
              <select value={evalTypeId} onChange={e => handleEvalTypeChange(e.target.value)} style={sel}>
                <option value="">Choose type...</option>
                {evalTypeList.map(t => (
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
              <div style={{ gridColumn: "1/-1" }}>
                {label("Account Number")}
                <input type="text" placeholder="Optional" value={accountNumber} onChange={e => setAccountNumber(e.target.value)} style={inp} />
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
            </>}
          </>
        )}

        {/* Recent Purchases */}
        {mode === "recent" && (() => {
          const list = showAllRecent
            ? recentPurchases.slice(0, 10)
            : traderId
              ? recentPurchases.filter(r => (r.fields["Trader"] || []).includes(traderId)).slice(0, 10)
              : [];
          if (loadingRecent) return <div style={{ color: "#6b7280", fontSize: 13 }}>Loading...</div>;
          if (!showAllRecent && !traderId) return <div style={{ color: "#6b7280", fontSize: 13 }}>Select a trader or "All Purchases" above.</div>;
          if (list.length === 0) return <div style={{ color: "#6b7280", fontSize: 13 }}>No purchases found.</div>;
          return list.map(r => {
            const f = r.fields;
            const pt = f["Purchase Type"];
            const st = f["Status"];
            const ptColor = pt === "New" ? "#22c55e" : pt === "Reset" ? "#f59e0b" : "#60a5fa";
            const stColor = st === "Active" ? "#22c55e" : st === "Failed" ? "#ef4444" : "#f59e0b";
            return (
              <div key={r.id} style={{ background: "#111827", border: `1px solid ${C.border}`, borderRadius: 10, padding: "12px 16px", marginBottom: 8, display: "flex", alignItems: "center", gap: 14 }}>
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
          });
        })()}
      </div>
    </div>
  );
}

function BreachModal({ account, evalTypeList, onClose, onBreached }) {
  const today = new Date().toISOString().slice(0, 10);
  const [step, setStep] = React.useState("choice");
  const [evalTypeId, setEvalTypeId] = React.useState(account.accountTypeId || "");
  const [date, setDate] = React.useState(today);
  const [dateStarted, setDateStarted] = React.useState(account.datePurchased || today);
  const [numAccounts, setNumAccounts] = React.useState(1);
  const [costPer, setCostPer] = React.useState(() => {
    const pre = evalTypeList.find(t => t.id === (account.accountTypeId || ""));
    return pre ? pre.cost.toString() : "";
  });
  const [notes, setNotes] = React.useState("");
  const [newAccountNumber, setNewAccountNumber] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [err, setErr] = React.useState(null);

  async function handleBreach() {
    setSubmitting(true); setErr(null);
    try {
      await updateRecord(EVAL_TABLE, account.id, { "Status": "Failed" });
      onBreached(account.id);
      onClose();
    } catch (e) { setErr("Failed: " + e.message); }
    setSubmitting(false);
  }

  async function handleReset() {
    const evalType = evalTypeList.find(t => t.id === evalTypeId);
    if (!evalType || !costPer || !date) { setErr("Fill in all required fields."); return; }
    setSubmitting(true); setErr(null);
    try {
      // Fail the current eval account
      await updateRecord(EVAL_TABLE, account.id, { "Status": "Failed" });
      // Create new eval account
      const traderName = account.traderName || account.name || "Unknown";
      const newEvalFields = {
        "Name": `${traderName.split(" ")[0]} - ${evalType.name}`,
        "Status": "Active",
        "Current Balance": evalType.accountSize,
        "High Water Mark": evalType.accountSize,
        "Date Purchased": date,
        "Date Started": dateStarted,
        "Trading Days Completed": 0,
        "Number of Accounts": parseInt(numAccounts),
      };
      if (evalTypeId) newEvalFields["Evaluation Account Type"] = [evalTypeId];
      if (account.trader) newEvalFields["Trader"] = [account.trader];
      if (newAccountNumber) newEvalFields["Account Number"] = newAccountNumber;
      const newEvalRecord = await createRecord(EVAL_TABLE, newEvalFields);
      const newEvalId = newEvalRecord?.id;
      // Create purchase log
      const purchaseFields = {
        "Name": `${traderName.split(" ")[0]} - ${evalType.name} - ${date}`,
        "Date Purchased": date,
        "Number of Accounts": parseInt(numAccounts),
        "Cost Per Account": parseFloat(costPer),
        "Purchase Type": "Reset",
        "Status": "Active",
        "Notes": notes || undefined,
      };
      if (evalTypeId) purchaseFields["Evaluation Account Type"] = [evalTypeId];
      if (newEvalId) purchaseFields["Evaluation Account"] = [newEvalId];
      if (account.trader) purchaseFields["Trader"] = [account.trader];
      await createRecord(PURCHASE_TABLE, purchaseFields);
      onBreached(account.id);
      onClose();
    } catch (e) { setErr("Failed: " + e.message); }
    setSubmitting(false);
  }

  const evalType = evalTypeList.find(t => t.id === evalTypeId);
  const totalCost = (parseFloat(costPer) || 0) * numAccounts;
  const inp = { background: "#0f172a", border: "1px solid #374151", borderRadius: 6, color: "#fff", fontSize: 13, padding: "7px 10px", width: "100%", outline: "none", boxSizing: "border-box" };
  const lbl = text => <div style={{ fontSize: 11, fontWeight: 600, color: "#9ca3af", marginBottom: 5, textTransform: "uppercase", letterSpacing: 0.5 }}>{text}</div>;

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }} onClick={onClose}>
      <div style={{ background: "#1f2a37", border: "1px solid #374151", borderRadius: 12, padding: 24, width: 400, maxWidth: "90vw" }} onClick={e => e.stopPropagation()}>
        <div style={{ fontSize: 14, fontWeight: 700, color: "#fff", marginBottom: 4 }}>
          Account Breached — {account.traderName || account.name}
        </div>
        <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 20 }}>{account.firmName} · {account.accountNumber || ""}</div>

        {err && <div style={{ background: "#450a0a", border: "1px solid #7f1d1d", color: "#fca5a5", padding: "8px 12px", borderRadius: 8, fontSize: 12, marginBottom: 14 }}>{err}</div>}

        {step === "choice" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div onClick={() => setStep("reset")} style={{ background: "#1f2937", border: "1px solid #374151", borderRadius: 10, padding: "14px 16px", cursor: "pointer", display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ fontSize: 22 }}>🔄</span>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#f59e0b" }}>Reset Account</div>
                <div style={{ fontSize: 11, color: "#6b7280" }}>Fail this account and create a new one</div>
              </div>
            </div>
            <div onClick={handleBreach} style={{ background: "#1f2937", border: "1px solid #374151", borderRadius: 10, padding: "14px 16px", cursor: submitting ? "not-allowed" : "pointer", display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ fontSize: 22 }}>❌</span>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#ef4444" }}>Breach Account</div>
                <div style={{ fontSize: 11, color: "#6b7280" }}>Mark as Failed, no new account</div>
              </div>
            </div>
            <button onClick={onClose} style={{ background: "none", border: "1px solid #374151", borderRadius: 8, color: "#6b7280", fontSize: 12, padding: "8px", cursor: "pointer", marginTop: 4 }}>Cancel</button>
          </div>
        )}

        {step === "reset" && (
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
              <button onClick={() => setStep("choice")} style={{ background: "none", border: "none", color: "#6b7280", cursor: "pointer", fontSize: 18, padding: 0 }}>←</button>
              <span style={{ fontSize: 13, fontWeight: 600, color: "#f59e0b" }}>Reset Account</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
              <div style={{ gridColumn: "1 / -1" }}>
                {lbl("Evaluation Type")}
                <select value={evalTypeId} onChange={e => { setEvalTypeId(e.target.value); const et = evalTypeList.find(t => t.id === e.target.value); if (et) setCostPer(et.cost.toString()); }} style={{ ...inp, cursor: "pointer" }}>
                  <option value="">Choose type...</option>
                  {evalTypeList.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
              <div>
                {lbl("Purchase Date")}
                <input type="date" value={date} onChange={e => setDate(e.target.value)} style={inp} />
              </div>
              <div>
                {lbl("Date Started")}
                <input type="date" value={dateStarted} onChange={e => setDateStarted(e.target.value)} style={inp} />
              </div>
              <div>
                {lbl("# of Accounts")}
                <input type="number" min="1" value={numAccounts} onChange={e => setNumAccounts(e.target.value)} style={inp} />
              </div>
              <div>
                {lbl("Cost Per Account")}
                <input type="number" value={costPer} onChange={e => setCostPer(e.target.value)} style={inp} />
              </div>
              <div>
                {lbl("Account Number (optional)")}
                <input type="text" placeholder="e.g. ABC123" value={newAccountNumber} onChange={e => setNewAccountNumber(e.target.value)} style={inp} />
              </div>
            </div>
            <div style={{ marginBottom: 14 }}>
              {lbl("Notes (optional)")}
              <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} style={{ ...inp, resize: "vertical", fontFamily: "inherit" }} />
            </div>
            {evalType && (
              <div style={{ background: "#0f172a", borderRadius: 8, padding: "10px 14px", marginBottom: 14, fontSize: 12 }}>
                <div style={{ color: "#fca5a5" }}>• This account → <strong>Failed</strong></div>
                <div style={{ color: "#4ade80" }}>• New eval account → <strong>Active</strong> at {evalType ? `$${evalType.accountSize.toLocaleString()}` : "—"}</div>
                <div style={{ color: "#93c5fd" }}>• Trading days → <strong>0</strong></div>
              </div>
            )}
            {totalCost > 0 && (
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 14 }}>
                <span style={{ fontSize: 12, color: "#9ca3af" }}>Total Cost</span>
                <span style={{ fontSize: 15, fontWeight: 700, color: "#f87171" }}>${totalCost.toLocaleString()}</span>
              </div>
            )}
            <button onClick={handleReset} disabled={submitting || !evalTypeId || !costPer || !date}
              style={{ width: "100%", background: evalTypeId && costPer && date ? "#d97706" : "#1f2937", color: "#fff", border: "none", borderRadius: 8, padding: "10px", fontSize: 14, fontWeight: 700, cursor: submitting ? "not-allowed" : "pointer" }}>
              {submitting ? "Saving..." : `Reset Account${totalCost > 0 ? ` — $${totalCost.toLocaleString()}` : ""}`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function AllAccountsTab({ evalAccounts, perfAccounts, dones, onDone }) {
  const C = { bg: "#030712", card: "#111827", border: "#1f2937" };
  const standardPerf = perfAccounts.filter(a => !a.payoutAccount && a.status === "Active");
  const livePerf = perfAccounts.filter(a => a.status === "Live" || (a.payoutAccount && a.status === "Active"));
  const waitingPerf = perfAccounts.filter(a => a.status === "Waiting on Payout");
  const allShown = [...evalAccounts, ...standardPerf, ...livePerf, ...waitingPerf];
  const doneAccounts = allShown.filter(a => dones[a.id]);
  const [scoreInputs, setScoreInputs] = React.useState(() => {
    const init = {};
    allShown.forEach(a => { init[a.id] = ""; });
    return init;
  });
  const [blowns, setBlowns] = React.useState({});
  const [newBalanceInputs, setNewBalanceInputs] = React.useState({});
  const [countTradingDays, setCountTradingDays] = React.useState({});
  const [breachModalAccount, setBreachModalAccount] = React.useState(null);
  const [evalTypeList, setEvalTypeList] = React.useState([]);
  React.useEffect(() => {
    fetchTable(EVAL_TYPE_TABLE, ["Name", "Account Size", "Profit Target", "Drawdown Limit", "Daily Loss Limit", "Max Contracts"]).then(rows => {
      setEvalTypeList(rows.map(r => ({ id: r.id, name: r.fields["Name"], accountSize: r.fields["Account Size"] || 0, cost: r.fields["Cost Per Account"] || 0 })).sort((a, b) => a.name.localeCompare(b.name)));
    }).catch(() => {});
  }, []);
  const [scoreSaving, setScoreSaving] = React.useState(false);
  const [scoreSaved, setScoreSaved] = React.useState(false);
  const [payoutData, setPayoutData] = React.useState({});
  const [payoutStrategies, setPayoutStrategies] = React.useState([]);
  const [payoutActionState, setPayoutActionState] = React.useState({});
  const [payoutFormInputs, setPayoutFormInputs] = React.useState({});
  const [payoutSubmitting, setPayoutSubmitting] = React.useState({});
  const today = new Date().toISOString().split("T")[0];
  React.useEffect(() => {
    if (waitingPerf.length === 0) return;
    Promise.all([
      fetchTable("tbljLby6v0o6fydOw", ["Name", "Account Type", "Stage Number", "Stage Target"]),
      fetch(`/.netlify/functions/airtable/${BASE}/${PAYOUT_TABLE}?maxRecords=200`).then(r => r.json()),
    ]).then(([stratRows, pr]) => {
      setPayoutStrategies(stratRows.map(r => {
        const at = r.fields["Account Type"];
        return { id: r.id, name: r.fields["Name"] || "", perfTypeId: Array.isArray(at) && at.length > 0 ? (at[0].id || at[0]) : null, stage: r.fields["Stage Number"] || 1, target: r.fields["Stage Target"] || 0 };
      }));
      const map = {};
      (pr.records || []).filter(r => r.fields["Status"] !== "Received").forEach(r => {
        (r.fields["Performance Account"] || []).forEach(pid => { map[pid] = r; });
      });
      setPayoutData(map);
    }).catch(() => {});
  }, [waitingPerf.length]);
  async function handlePayoutStatusUpdate(accountId, payoutRecordId, newStatus) {
    setPayoutSubmitting(prev => ({ ...prev, [accountId]: true }));
    try {
      await updateRecord(PAYOUT_TABLE, payoutRecordId, { "Status": newStatus });
      setPayoutActionState(prev => ({ ...prev, [accountId]: null }));
      setPayoutFormInputs(prev => ({ ...prev, [accountId]: {} }));
    } catch (e) {}
    setPayoutSubmitting(prev => ({ ...prev, [accountId]: false }));
  }
  async function handlePayoutReceive(a, payoutRecord, fi) {
    if (!fi.amount || !fi.newBalance || !fi.stageId || !payoutRecord) return;
    setPayoutSubmitting(prev => ({ ...prev, [a.id]: true }));
    try {
      const numAccts = payoutRecord.fields["Number of Accounts"] || 1;
      const tierPct = parseFloat(fi.tier ?? "50") || 50;
      await updateRecord(PAYOUT_TABLE, payoutRecord.id, {
        "Status": "Received",
        "Date Received": fi.date || today,
        "Amount Per Account": parseFloat(fi.amount) / numAccts,
        "Payout Tier": tierPct / 100,
      });
      await updateRecord(PERF_TABLE, a.id, {
        "Status": "Active",
        "Current Balance": parseFloat(fi.newBalance),
        "High Water Mark": parseFloat(fi.newBalance),
        "Cycle Start Balance": parseFloat(fi.newBalance),
        "Current Stage": [fi.stageId],
        "Trading Days this Cycle": 0,
        "Number of Payouts Recieved": a.numPayoutsReceived + 1,
      });
      setPayoutActionState(prev => ({ ...prev, [a.id]: null }));
      setPayoutFormInputs(prev => ({ ...prev, [a.id]: {} }));
    } catch (e) {}
    setPayoutSubmitting(prev => ({ ...prev, [a.id]: false }));
  }
  async function saveScore(a, val) {
    const num = parseFloat(val);
    if (isNaN(num)) return;
    const tableId = a.type === "perf" ? PERF_TABLE : EVAL_TABLE;
    await updateRecord(tableId, a.id, { "Score": num });
  }
  async function saveBalance(a, val) {
    const num = parseFloat(val);
    if (isNaN(num)) return;
    await updateRecord(PERF_TABLE, a.id, { "Current Balance": num });
  }
  async function submitAllScores() {
    setScoreSaving(true);
    try {
      const scoreUpdates = allShown.filter(a => {
        const v = scoreInputs[a.id];
        return v !== "" && v !== undefined && !isNaN(parseFloat(v));
      });
      const tdUpdates = allShown.filter(a => countTradingDays[a.id]);
      await Promise.all([
        ...scoreUpdates.map(a => saveScore(a, scoreInputs[a.id])),
        ...tdUpdates.map(a => {
          const table = a.type === "perf" ? PERF_TABLE : EVAL_TABLE;
          const field = a.type === "perf" ? "Trading Days this Cycle" : "Trading Days Completed";
          return updateRecord(table, a.id, { [field]: (a.tradingDays || 0) + 1 });
        }),
      ]);
      setScoreSaved(true);
      setTimeout(() => setScoreSaved(false), 3000);
    } catch (e) {}
    setScoreSaving(false);
  }
  function getFeeds(accounts, sortFn) {
    const feeds = {};
    const defaultSort = (a, b) => {
      const va = a.score != null ? a.score : 99;
      const vb = b.score != null ? b.score : 99;
      return va - vb;
    };
    accounts.filter(a => !dones[a.id]).slice().sort(sortFn || defaultSort).forEach(a => {
      const dp = a.dataProvider || "Other";
      if (!feeds[dp]) feeds[dp] = [];
      feeds[dp].push(a);
    });
    return feeds;
  }
  const payoutStatusColor = { "Requested": "#f59e0b", "Processing": "#3b82f6", "Approved": "#8b5cf6", "Received": "#22c55e" };
  function AccountMiniCard(a) {
    const isDone = !!dones[a.id];
    const isBlown = !!blowns[a.id];
    const isCountTD = !!countTradingDays[a.id];
    const header = [a.traderName || a.name, a.firmName || a.dataProvider || "—"].filter(Boolean).join(" — ");

    if (a.status === "Waiting on Payout") {
      const payoutRecord = payoutData[a.id];
      const action = payoutActionState[a.id] || null;
      const fi = payoutFormInputs[a.id] || {};
      const isSubmitting = !!payoutSubmitting[a.id];
      const availableStages = payoutStrategies.filter(s => s.perfTypeId === a.accountTypeId).sort((x, y) => x.stage - y.stage);
      const setFI = (field, value) => setPayoutFormInputs(prev => ({ ...prev, [a.id]: { ...(prev[a.id] || {}), [field]: value } }));
      return (
        <div key={a.id} style={{ background: "#1f2a37", border: "1px solid #2d3f50", borderRadius: 8, padding: "8px 10px", marginBottom: 4 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 7 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>{header}</span>
            <span style={{ fontSize: 9, fontWeight: 700, background: "#1c3a1c", color: "#4ade80", padding: "1px 5px", borderRadius: 4, flexShrink: 0 }}>WAITING</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr 1fr 1fr", gap: 4, marginBottom: 7 }}>
            {[["Target", $$target(a.limit)], ["Daily Loss", a.dailyLossLimit ? $$(a.dailyLossLimit) : "—"], ["Acct #", a.accountNumber ?? "—"], ["Trading Days", a.tradingDays ?? 0], ["Days Left", a.tradingDaysLeft ?? "—"], ["Multiplier", a.contractMultiplier ?? 1]].map(([lbl, val]) => (
              <div key={lbl} style={{ textAlign: "center" }}>
                <div style={{ fontSize: 9, color: "#6b7280", textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 2 }}>{lbl}</div>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#4ade80" }}>{val}</div>
              </div>
            ))}
          </div>
          {!action && (
            <button onClick={() => setPayoutActionState(prev => ({ ...prev, [a.id]: "choice" }))}
              style={{ width: "100%", background: "#1e3a5f", border: "1px solid #3b82f6", borderRadius: 5, padding: "5px 8px", fontSize: 10, cursor: "pointer", color: "#93c5fd", fontWeight: 700 }}>
              💰 Update Status
            </button>
          )}
          {action === "choice" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              <div onClick={() => setPayoutActionState(prev => ({ ...prev, [a.id]: "status" }))}
                style={{ background: "#111827", border: "1px solid #2d3f50", borderRadius: 6, padding: "7px 10px", cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 14 }}>🔄</span>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#93c5fd" }}>Update Status</div>
                  <div style={{ fontSize: 10, color: "#6b7280" }}>Requested / Processing / Approved</div>
                </div>
              </div>
              <div onClick={() => setPayoutActionState(prev => ({ ...prev, [a.id]: "receive" }))}
                style={{ background: "#111827", border: "1px solid #2d3f50", borderRadius: 6, padding: "7px 10px", cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 14 }}>✅</span>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#4ade80" }}>Mark as Received</div>
                  <div style={{ fontSize: 10, color: "#6b7280" }}>Log amount, set new balance, advance stage</div>
                </div>
              </div>
              <button onClick={() => setPayoutActionState(prev => ({ ...prev, [a.id]: null }))}
                style={{ background: "none", border: "none", color: "#6b7280", fontSize: 10, cursor: "pointer", padding: "2px 0", textAlign: "left" }}>← Back</button>
            </div>
          )}
          {action === "status" && (
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 7 }}>
                <button onClick={() => setPayoutActionState(prev => ({ ...prev, [a.id]: "choice" }))} style={{ background: "none", border: "none", color: "#6b7280", cursor: "pointer", fontSize: 14, padding: 0 }}>←</button>
                <span style={{ fontSize: 11, fontWeight: 600, color: "#93c5fd" }}>Update Status</span>
              </div>
              <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 7 }}>
                {["Requested", "Processing", "Approved"].map(s => (
                  <button key={s} onClick={() => setFI("newStatus", s)}
                    style={{ background: fi.newStatus === s ? payoutStatusColor[s] : "#111827", color: fi.newStatus === s ? "#fff" : "#9ca3af", border: `1px solid ${fi.newStatus === s ? payoutStatusColor[s] : "#2d3f50"}`, borderRadius: 5, padding: "4px 8px", fontSize: 10, fontWeight: 600, cursor: "pointer" }}>
                    {s}
                  </button>
                ))}
              </div>
              <button onClick={() => fi.newStatus && payoutRecord && handlePayoutStatusUpdate(a.id, payoutRecord.id, fi.newStatus)}
                disabled={!fi.newStatus || !payoutRecord || isSubmitting}
                style={{ width: "100%", background: fi.newStatus && payoutRecord ? "#1d4ed8" : "#111827", color: fi.newStatus && payoutRecord ? "#fff" : "#4b5563", border: "none", borderRadius: 5, padding: "5px", fontSize: 10, fontWeight: 700, cursor: fi.newStatus ? "pointer" : "not-allowed" }}>
                {isSubmitting ? "Saving..." : "Update Status"}
              </button>
            </div>
          )}
          {action === "receive" && (
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 7 }}>
                <button onClick={() => setPayoutActionState(prev => ({ ...prev, [a.id]: "choice" }))} style={{ background: "none", border: "none", color: "#6b7280", cursor: "pointer", fontSize: 14, padding: 0 }}>←</button>
                <span style={{ fontSize: 11, fontWeight: 600, color: "#4ade80" }}>Mark as Received</span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 5, marginBottom: 7 }}>
                <div>
                  <div style={{ fontSize: 9, color: "#6b7280", textTransform: "uppercase", marginBottom: 2 }}>Date Received</div>
                  <input type="date" value={fi.date || today} onChange={e => setFI("date", e.target.value)}
                    style={{ background: "#111827", border: "1px solid #2d3f50", borderRadius: 4, color: "#fff", fontSize: 9, width: "100%", padding: "3px 4px", outline: "none", boxSizing: "border-box" }} />
                </div>
                <div>
                  <div style={{ fontSize: 9, color: "#6b7280", textTransform: "uppercase", marginBottom: 2 }}>Total Amount</div>
                  <input type="number" placeholder="e.g. 4500" value={fi.amount || ""} onChange={e => setFI("amount", e.target.value)}
                    style={{ background: "#111827", border: "1px solid #2d3f50", borderRadius: 4, color: "#fff", fontSize: 9, width: "100%", padding: "3px 4px", outline: "none", boxSizing: "border-box" }} />
                </div>
                <div>
                  <div style={{ fontSize: 9, color: "#6b7280", textTransform: "uppercase", marginBottom: 2 }}>Payout Tier %</div>
                  <input type="number" min="0" max="100" placeholder="50" value={fi.tier ?? "50"} onChange={e => setFI("tier", e.target.value)}
                    style={{ background: "#111827", border: "1px solid #2d3f50", borderRadius: 4, color: "#fff", fontSize: 9, width: "100%", padding: "3px 4px", outline: "none", boxSizing: "border-box" }} />
                </div>
                <div style={{ gridColumn: "1/-1" }}>
                  <div style={{ fontSize: 9, color: "#6b7280", textTransform: "uppercase", marginBottom: 2 }}>New Balance</div>
                  <input type="number" placeholder="e.g. 101200" value={fi.newBalance || ""} onChange={e => setFI("newBalance", e.target.value)}
                    style={{ background: "#111827", border: "1px solid #2d3f50", borderRadius: 4, color: "#fff", fontSize: 9, width: "100%", padding: "3px 4px", outline: "none", boxSizing: "border-box" }} />
                </div>
                <div style={{ gridColumn: "1/-1" }}>
                  <div style={{ fontSize: 9, color: "#6b7280", textTransform: "uppercase", marginBottom: 2 }}>Advance to Stage</div>
                  <select value={fi.stageId || ""} onChange={e => setFI("stageId", e.target.value)}
                    style={{ background: "#111827", border: "1px solid #2d3f50", borderRadius: 4, color: "#fff", fontSize: 9, width: "100%", padding: "3px 4px", outline: "none" }}>
                    <option value="">Select stage...</option>
                    {availableStages.map(s => <option key={s.id} value={s.id}>Stage {s.stage} (Target: {$$(s.target)})</option>)}
                  </select>
                </div>
              </div>
              <button onClick={() => handlePayoutReceive(a, payoutRecord, fi)}
                disabled={!fi.amount || !fi.newBalance || !fi.stageId || !payoutRecord || isSubmitting}
                style={{ width: "100%", background: (fi.amount && fi.newBalance && fi.stageId && payoutRecord) ? "#16a34a" : "#111827", color: (fi.amount && fi.newBalance && fi.stageId && payoutRecord) ? "#fff" : "#4b5563", border: "none", borderRadius: 5, padding: "5px", fontSize: 10, fontWeight: 700, cursor: "pointer" }}>
                {isSubmitting ? "Saving..." : "✓ Mark Received & Advance Stage"}
              </button>
            </div>
          )}
        </div>
      );
    }

    const isLivePayout = a.status === "Live" || (a.payoutAccount && a.status === "Active");

    if (isLivePayout) {
      const profitPerAcct = a.ddLeft;
      const amtForPayout = a.stageTarget != null ? a.stageTarget - a.bal : null;
      const acctValue = a.contractMultiplier > 0 ? a.ddLeft * a.n / a.contractMultiplier : a.ddLeft;
      const payoutScore = amtForPayout == null ? null : amtForPayout <= 0 ? "✓" : Math.min(10, Math.ceil(amtForPayout / 500));
      const daysScore = a.tradingDaysLeft == null ? null : a.tradingDaysLeft <= 0 ? "✓" : a.tradingDaysLeft;
      const psColor = payoutScore === "✓" ? "#22c55e" : payoutScore != null ? lpColor(payoutScore) : "#4b5563";
      const dsColor = daysScore === "✓" ? "#22c55e" : daysScore != null ? lpColor(Math.min(daysScore, 10)) : "#4b5563";
      return (
        <div key={a.id} style={{ background: "#1f2a37", border: `1px solid ${isDone ? "#1a2030" : "#2d3f50"}`, borderRadius: 8, padding: "8px 10px", marginBottom: 4, opacity: isDone ? 0.45 : 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 7 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: isDone ? "#4b5563" : "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>{header}</span>
            {a.status === "Live" && !isDone && <span style={{ fontSize: 9, fontWeight: 700, background: "#7f1d1d", color: "#fca5a5", padding: "1px 5px", borderRadius: 4, flexShrink: 0 }}>LIVE</span>}
            <span style={{ fontSize: 12, fontWeight: 800, background: `${psColor}22`, color: psColor, padding: "1px 7px", borderRadius: 99, flexShrink: 0, border: `1px solid ${psColor}` }}>{payoutScore ?? "—"}</span>
            <span style={{ fontSize: 12, fontWeight: 800, background: `${dsColor}22`, color: dsColor, padding: "1px 7px", borderRadius: 99, flexShrink: 0, border: `1px solid ${dsColor}` }}>{daysScore ?? "—"}</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 4, marginBottom: 7 }}>
            {[
              ["Target", $$target(a.limit)],
              ["Daily Loss", a.dailyLossLimit ? $$(a.dailyLossLimit) : "—"],
              ["Acct #", a.accountNumber ?? "—"],
              ["Days Left", a.tradingDaysLeft ?? "—"],
              ["Multiplier", a.contractMultiplier ?? 1],
              ["Profit/Acct", $$(profitPerAcct)],
              ["Amt for Payout", amtForPayout == null ? "—" : amtForPayout <= 0 ? "✓ Met" : $$(amtForPayout)],
              ["Acct Value", $$(acctValue)],
            ].map(([label, val]) => (
              <div key={label} style={{ textAlign: "center" }}>
                <div style={{ fontSize: 9, color: "#6b7280", textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 2 }}>{label}</div>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#4ade80" }}>{val}</div>
              </div>
            ))}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 5 }}>
            {onDone ? (
              <button onClick={() => onDone(a.id)}
                style={{ background: "#15803d", border: "1px solid #22c55e", borderRadius: 5, padding: "4px 6px", fontSize: 10, cursor: "pointer", color: "#fff", fontWeight: 700 }}>
                {isDone ? "✓ Done Today" : "☐ Done Today"}
              </button>
            ) : <div />}
            <button onClick={() => isBlown ? setBlowns(prev => ({ ...prev, [a.id]: false })) : setBreachModalAccount(a)}
              style={{ background: "#7f1d1d", border: "1px solid #dc2626", borderRadius: 5, padding: "4px 6px", fontSize: 10, cursor: "pointer", color: "#fff", fontWeight: 700 }}>
              {isBlown ? "✓ Breached" : "☐ Breached"}
            </button>
            <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
              {a.tradingDayDefinition && (
                <div style={{ fontSize: 11, fontWeight: 700, color: "#fff", textAlign: "center", textTransform: "uppercase", lineHeight: 1.3 }}>{a.tradingDayDefinition}</div>
              )}
              <button onClick={() => setCountTradingDays(prev => ({ ...prev, [a.id]: !prev[a.id] }))}
                style={{ background: isCountTD ? "#1d4ed8" : "#1e3a5f", border: `1px solid ${isCountTD ? "#60a5fa" : "#2563eb"}`, borderRadius: 5, padding: "4px 6px", fontSize: 10, cursor: "pointer", color: "#fff", fontWeight: 700 }}>
                {isCountTD ? "✓ Count Trading Day" : "☐ Count Trading Day"}
              </button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", justifyContent: "center" }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#fff", textTransform: "uppercase", textAlign: "center", marginBottom: 2 }}>New Balance</div>
              <input
                type="number"
                value={newBalanceInputs[a.id] ?? ""}
                onChange={e => setNewBalanceInputs(prev => ({ ...prev, [a.id]: e.target.value }))}
                onBlur={e => saveBalance(a, e.target.value)}
                placeholder={$$(a.bal)}
                style={{ background: "#0f172a", border: "1px solid #374151", borderRadius: 4, color: "#fff", fontSize: 10, width: "100%", padding: "2px 4px", outline: "none", textAlign: "center", boxSizing: "border-box" }}
              />
            </div>
          </div>
        </div>
      );
    }

    return (
      <div key={a.id} style={{ background: "#1f2a37", border: `1px solid ${isBlown ? "#7f1d1d" : isDone ? "#1a2030" : "#2d3f50"}`, borderRadius: 8, padding: "8px 10px", marginBottom: 4, opacity: isDone ? 0.45 : 1 }}>
        {/* Trader — Firm — Renewal warning — Score badge */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 7 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: isDone ? "#4b5563" : "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>
            {header}
          </span>
          {a.type === "eval" && a.datePurchased && (() => {
            const daysSince = Math.floor((Date.now() - new Date(a.datePurchased)) / 86400000);
            const daysLeft = 30 - daysSince;
            if (daysSince >= 30) return <span style={{ fontSize: 10, fontWeight: 700, color: "#ef4444", background: "#450a0a", border: "1px solid #dc2626", borderRadius: 4, padding: "1px 6px", flexShrink: 0 }}>⚠ Past Renewal</span>;
            if (daysLeft <= 7) return <span style={{ fontSize: 10, fontWeight: 700, color: "#ef4444", background: "#450a0a", border: "1px solid #dc2626", borderRadius: 4, padding: "1px 6px", flexShrink: 0 }}>⚠ {daysLeft}d to renewal</span>;
            return null;
          })()}
          <span style={(() => { const sc = a.score; const c = sc == null ? null : sc >= 8 ? "#22c55e" : sc >= 5 ? "#eab308" : "#ef4444"; return { fontSize: 12, fontWeight: 800, background: c ? `${c}22` : "#1f2937", color: c ?? "#4b5563", padding: "1px 8px", borderRadius: 99, flexShrink: 0, border: `1px solid ${c ?? "#374151"}` }; })()}>
            {a.score != null ? a.score : "—"}
          </span>
          {a.status === "Live" && !isDone && <span style={{ fontSize: 9, fontWeight: 700, background: "#7f1d1d", color: "#fca5a5", padding: "1px 5px", borderRadius: 4, flexShrink: 0 }}>LIVE</span>}
        </div>
        {/* Stats row */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr 1fr 1fr", gap: 4, marginBottom: 7 }}>
          {[
            ["Target", $$target(a.limit)],
            ["Daily Loss", a.dailyLossLimit ? $$(a.dailyLossLimit) : "—"],
            ["Acct #", a.accountNumber ?? "—"],
            ["Trading Days", a.tradingDays ?? 0],
            ["Days Left", a.tradingDaysLeft ?? "—"],
            a.type === "eval" ? ["Weight", a.accountWeight ?? "—"] : ["Multiplier", a.contractMultiplier ?? 1],
          ].map(([label, val]) => (
            <div key={label} style={{ textAlign: "center" }}>
              <div style={{ fontSize: 9, color: "#6b7280", textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 2 }}>{label}</div>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#4ade80" }}>{val}</div>
            </div>
          ))}
        </div>
        {/* 2x2 action grid */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 5 }}>
          {/* Row 1: Done Today | Blown */}
          {onDone ? (
            <button onClick={() => onDone(a.id)}
              style={{ background: "#15803d", border: "1px solid #22c55e", borderRadius: 5, padding: "4px 6px", fontSize: 10, cursor: "pointer", color: "#fff", fontWeight: 700 }}>
              {isDone ? "✓ Done Today" : "☐ Done Today"}
            </button>
          ) : <div />}
          <button onClick={() => isBlown ? setBlowns(prev => ({ ...prev, [a.id]: false })) : setBreachModalAccount(a)}
            style={{ background: "#7f1d1d", border: "1px solid #dc2626", borderRadius: 5, padding: "4px 6px", fontSize: 10, cursor: "pointer", color: "#fff", fontWeight: 700 }}>
            {isBlown ? "✓ Breached" : "☐ Breached"}
          </button>
          {/* Row 2: Count as Trading Day | New Score */}
          <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
            {a.tradingDayDefinition && (
              <div style={{ fontSize: 11, fontWeight: 700, color: "#fff", textAlign: "center", textTransform: "uppercase", lineHeight: 1.3 }}>{a.tradingDayDefinition}</div>
            )}
            <button onClick={() => setCountTradingDays(prev => ({ ...prev, [a.id]: !prev[a.id] }))}
              style={{ background: isCountTD ? "#1d4ed8" : "#1e3a5f", border: `1px solid ${isCountTD ? "#60a5fa" : "#2563eb"}`, borderRadius: 5, padding: "4px 6px", fontSize: 10, cursor: "pointer", color: "#fff", fontWeight: 700 }}>
              {isCountTD ? "✓ Count Trading Day" : "☐ Count Trading Day"}
            </button>
          </div>
          <div style={{ display: "flex", flexDirection: "column", justifyContent: "center" }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#fff", textTransform: "uppercase", textAlign: "center", marginBottom: 2 }}>New Score</div>
            <input
              type="number"
              value={scoreInputs[a.id] ?? ""}
              onChange={e => { const v = e.target.value; setScoreInputs(prev => ({ ...prev, [a.id]: v })); }}
              onBlur={e => saveScore(a, e.target.value)}
              placeholder="—"
              style={{ background: "#0f172a", border: "1px solid #374151", borderRadius: 4, color: "#fff", fontSize: 10, width: "100%", padding: "2px 4px", outline: "none", textAlign: "center", boxSizing: "border-box" }}
            />
          </div>
        </div>
      </div>
    );
  }
  function FeedGrid({ accounts, color, title, sortFn }) {
    if (accounts.length === 0) return null;
    const feeds = getFeeds(accounts, sortFn);
    const feedNames = Object.keys(feeds).sort();
    if (feedNames.length === 0) return null;
    return (
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
          <div style={{ width: 3, height: 16, background: color, borderRadius: 99 }} />
          <span style={{ fontSize: 13, fontWeight: 700, color: "#e5e7eb" }}>{title}</span>
          <span style={{ background: "#1f2937", color: "#9ca3af", fontSize: 10, padding: "1px 6px", borderRadius: 99 }}>{accounts.filter(a => !dones[a.id]).length}</span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: `repeat(${Math.min(feedNames.length, 4)}, 1fr)`, gap: 8 }}>
          {feedNames.map(feed => (
            <div key={feed}>
              <div style={{ fontSize: 10, fontWeight: 700, color: "#4b5563", textTransform: "uppercase", letterSpacing: 1, marginBottom: 5, paddingBottom: 3, borderBottom: "1px solid #1f2937" }}>{feed}</div>
              {feeds[feed].map(a => AccountMiniCard(a))}
            </div>
          ))}
        </div>
      </div>
    );
  }
  return (
    <div>
      {breachModalAccount && (
        <BreachModal
          account={breachModalAccount}
          evalTypeList={evalTypeList}
          onClose={() => setBreachModalAccount(null)}
          onBreached={id => setBlowns(prev => ({ ...prev, [id]: true }))}
        />
      )}
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
        <button onClick={submitAllScores} disabled={scoreSaving}
          style={{ background: scoreSaved ? "#166534" : "#15803d", border: "1px solid #22c55e", borderRadius: 8, padding: "8px 18px", fontSize: 13, fontWeight: 700, color: "#fff", cursor: scoreSaving ? "not-allowed" : "pointer" }}>
          {scoreSaving ? "Saving..." : scoreSaved ? "✓ Saved" : "Submit Scores"}
        </button>
      </div>
      {FeedGrid({ accounts: evalAccounts, color: "#8b5cf6", title: "Evaluation Accounts" })}
      {FeedGrid({ accounts: standardPerf, color: "#3b82f6", title: "Performance Accounts" })}
      {FeedGrid({ accounts: livePerf, color: "#f59e0b", title: "Live & Payout Accounts", sortFn: (a, b) => {
  const lpMax = acc => {
    const amt = acc.stageTarget != null ? acc.stageTarget - acc.bal : null;
    const ps = amt == null ? 0 : amt <= 0 ? 0 : Math.min(10, Math.ceil(amt / 500));
    const ds = acc.tradingDaysLeft == null ? 0 : acc.tradingDaysLeft <= 0 ? 0 : acc.tradingDaysLeft;
    return Math.max(ps, ds);
  };
  return lpMax(a) - lpMax(b);
} })}
      {FeedGrid({ accounts: waitingPerf, color: "#6b7280", title: "Waiting on Payout" })}
      {doneAccounts.length > 0 && (
        <div style={{ marginTop: 32, borderTop: "1px solid #1f2937", paddingTop: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <div style={{ width: 3, height: 16, background: "#374151", borderRadius: 99 }} />
            <span style={{ fontSize: 13, fontWeight: 700, color: "#4b5563" }}>Done Today</span>
            <span style={{ background: "#1f2937", color: "#4b5563", fontSize: 10, padding: "1px 6px", borderRadius: 99 }}>{doneAccounts.length}</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 6 }}>
            {doneAccounts.map(a => AccountMiniCard(a))}
          </div>
        </div>
      )}
    </div>
  );
}
function FirmUsageTab() {
  const C = { bg: "#030712", card: "#111827", border: "#1f2937" };
  const [firms, setFirms] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [restrictions, setRestrictions] = useState({}); // traderName → [firmName]
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        // Load firms first so fMap is available for account name resolution
        const firmRecords = await fetchTable("tblR0iLSQZI1xXYa6", [
          "Name", "Data Provider", "Rank", "Max Accounts"
        ]);
        const fMap = {};
        firmRecords.forEach(r => { fMap[r.id] = r; });
        const sortedFirms = firmRecords
          .filter(r => r.fields["Rank"])
          .sort((a, b) => a.fields["Rank"] - b.fields["Rank"])
          .map(r => ({
            id: r.id,
            name: r.fields["Name"],
            provider: r.fields["Data Provider"]?.name || r.fields["Data Provider"] || "Unknown",
            rank: r.fields["Rank"],
            maxAccounts: r.fields["Max Accounts"] || 0,
          }));

        // Load eval accounts with firm lookup
        const evalRecords = await fetchTable("tblWeri8TXWPQY9Dc", [
          "Name", "Status", "Trader", "Number of Accounts", "Firm Name"
        ]);

        // Load perf accounts with firm lookup
        const perfRecords = await fetchTable("tblhM1DWRiWXnhSKb", [
          "Name", "Status", "Trader", "Number of Accounts", "Firm Name", "Payout Account"
        ]);

        // Load traders with restricted firms
        const traderRecords = await fetchTable("tbla0lbJ9z1PAhNy7", [
          "Name", "Restricted Firms"
        ]);
        const traderIdMap = {};
        const restrictMap = {};
        traderRecords.forEach(r => {
          traderIdMap[r.id] = r.fields["Name"];
          const restricted = r.fields["Restricted Firms"] || [];
          if (restricted.length > 0) {
            // Could be [{id, name}] objects OR plain ID strings
            restrictMap[r.fields["Name"]] = restricted.map(f => {
              if (typeof f === "object") return f.name;
              return fMap[f]?.fields?.["Name"] || f;
            }).filter(Boolean);
          }
        });

        const allAccounts = [
          ...evalRecords
            .filter(r => !["Failed", "Passed"].includes(r.fields["Status"]?.name || r.fields["Status"]))
            .map(r => ({
              type: "eval",
              name: r.fields["Name"],
              status: r.fields["Status"]?.name || r.fields["Status"],
              trader: traderIdMap[r.fields["Trader"]?.[0]] || r.fields["Trader"]?.[0] || "",
              n: r.fields["Number of Accounts"] || 1,
              firmName: fMap[r.fields["Firm Name"]?.[0]]?.fields["Name"] || null,
              payoutAccount: false,
            })),
          ...perfRecords
            .filter(r => !["Failed", "Passed"].includes(r.fields["Status"]?.name || r.fields["Status"]))
            .map(r => ({
              type: "perf",
              name: r.fields["Name"],
              status: r.fields["Status"]?.name || r.fields["Status"],
              trader: traderIdMap[r.fields["Trader"]?.[0]] || r.fields["Trader"]?.[0] || "",
              n: r.fields["Number of Accounts"] || 1,
              firmName: fMap[r.fields["Firm Name"]?.[0]]?.fields["Name"] || null,
              payoutAccount: r.fields["Payout Account"] || false,
            })),
        ];

        console.log("firm sample:", JSON.stringify(sortedFirms[0]));
        console.log("accounts sample:", JSON.stringify(allAccounts[0]));
        setFirms(sortedFirms);
        setAccounts(allAccounts);
        setRestrictions(restrictMap);
      } catch(e) { console.error("FirmUsageTab error:", e); }
      setLoading(false);
    }
    loadData();
  }, []);

  const traders = [
    { key: "Jonathan Jones", label: "Jonathan" },
    { key: "Cherelyn Jones", label: "Sherry" },
    { key: "Amanda Seratt", label: "Amanda" },
    { key: "Jefferies Parker", label: "Troy" },
    { key: "Judy Jones", label: "Judy" },
    { key: "Rolly Omas Obial", label: "Rolly" },
  ];

  // Build usageMap: firmName → traderLabel → [label]
  const usageMap = useMemo(() => {
    const map = {};
    accounts.forEach(a => {
      if (!a.firmName) return;
      const traderObj = traders.find(t => t.key === a.trader);
      if (!traderObj) return;
      const tLabel = traderObj.label;
      if (!map[a.firmName]) map[a.firmName] = {};
      if (!map[a.firmName][tLabel]) map[a.firmName][tLabel] = [];
      const isLive = a.status === "Live";
      const isPayout = a.payoutAccount;
      const isPerf = a.type === "perf";
      const label = isLive ? "L" : isPayout ? "F" : isPerf ? "P" : "E";
      if (!map[a.firmName][tLabel].includes(label)) {
        map[a.firmName][tLabel].push(label);
      }
    });
    return map;
  }, [accounts]);

  const providers = ["Project X", "Rithmic", "Tradovate", "DX Feed"];
  const providerColors = {
    "Project X":  { header: "#1d4ed8", border: "#1e3a5f", bg: "#0c1a2e", text: "#93c5fd" },
    "Rithmic":    { header: "#15803d", border: "#1a3a1a", bg: "#0f1a0f", text: "#86efac" },
    "Tradovate":  { header: "#7e22ce", border: "#3a1a3a", bg: "#1a0f1a", text: "#d8b4fe" },
    "DX Feed":    { header: "#a16207", border: "#3a3a1a", bg: "#1a1a0f", text: "#fde047" },
  };
  const labelColors = {
    "E": { bg: "#7c3aed22", border: "#7c3aed", color: "#c4b5fd" },
    "P": { bg: "#15803d22", border: "#15803d", color: "#86efac" },
    "F": { bg: "#1d4ed822", border: "#1d4ed8", color: "#93c5fd" },
    "L": { bg: "#b4521822", border: "#b45218", color: "#fdba74" },
  };

  if (loading) return (
    <div style={{ textAlign: "center", padding: 60, color: "#6b7280" }}>Loading firms...</div>
  );

  const traderLabels = traders.map(t => t.label);
  const gridCols = `40px 1fr 50px ${traderLabels.map(() => "1fr").join(" ")}`;

  console.log("rendering providers - firms by provider:", providers.map(p => p + ": " + firms.filter(f => f.provider === p).length));

  return (
    <div>
      {/* Legend */}
      <div style={{ display: "flex", gap: 16, marginBottom: 20, flexWrap: "wrap" }}>
        {[["E","EVAL","#c4b5fd"], ["P","PERFORMANCE","#86efac"], ["F","FUNDED/PAYOUT","#93c5fd"], ["L","LIVE","#fdba74"]].map(([k, v, c]) => (
          <span key={k} style={{ fontSize: 12, color: c, fontWeight: 600 }}>{k} = {v}</span>
        ))}
      </div>

      {providers.map(provider => {
        const pFirms = firms.filter(f => f.provider === provider);
        if (!pFirms.length) return null;
        const pc = providerColors[provider] || providerColors["Rithmic"];

        return (
          <div key={provider} style={{ marginBottom: 28 }}>
            <div style={{ background: pc.header, borderRadius: "10px 10px 0 0", padding: "8px 16px", fontSize: 14, fontWeight: 800, color: "#fff", letterSpacing: 1 }}>
              {provider.toUpperCase()}
            </div>
            <div style={{ background: pc.bg, border: `1px solid ${pc.border}`, borderTop: "none", borderRadius: "0 0 10px 10px", overflow: "hidden" }}>
              {/* Header */}
              <div style={{ display: "grid", gridTemplateColumns: gridCols, padding: "8px 12px", borderBottom: `1px solid ${pc.border}`, background: "#0a0a0a" }}>
                <div style={{ fontSize: 11, color: "#4b5563", fontWeight: 700 }}>Rank</div>
                <div style={{ fontSize: 11, color: "#4b5563", fontWeight: 700 }}>Firm</div>
                <div style={{ fontSize: 11, color: "#4b5563", fontWeight: 700, textAlign: "center" }}>Max</div>
                {traderLabels.map(t => (
                  <div key={t} style={{ fontSize: 11, color: pc.text, fontWeight: 700, textAlign: "center" }}>{t}</div>
                ))}
              </div>

              {pFirms.map((f, i) => {
                const traderUsage = usageMap[f.name] || {};
                const hasAny = Object.keys(traderUsage).length > 0;

                return (
                  <div key={f.id} style={{
                    display: "grid", gridTemplateColumns: gridCols,
                    padding: "8px 12px",
                    borderBottom: i < pFirms.length - 1 ? `1px solid ${pc.border}` : "none",
                    background: hasAny ? pc.bg : "#0a0a0a",
                    alignItems: "center",
                  }}>
                    <div style={{ fontSize: 12, color: "#6b7280" }}>{f.rank}</div>
                    <div style={{ fontSize: 13, color: hasAny ? "#fff" : "#374151", fontWeight: hasAny ? 600 : 400 }}>{f.name}</div>
                    <div style={{ fontSize: 12, color: "#6b7280", textAlign: "center" }}>{f.maxAccounts}</div>
                    {traderLabels.map(tLabel => {
                      const labels = traderUsage[tLabel] || [];
                      const traderKey = traders.find(t => t.label === tLabel)?.key;
                      const isRestricted = restrictions[traderKey]?.includes(f.name);
                      return (
                        <div key={tLabel} style={{ display: "flex", gap: 3, justifyContent: "center", flexWrap: "wrap" }}>
                          {isRestricted && labels.length === 0 && (
                            <span title="Restricted" style={{ fontSize: 13 }}>⛔</span>
                          )}
                          {labels.map((lbl, j) => {
                            const lc = labelColors[lbl];
                            return (
                              <span key={j} style={{
                                background: lc.bg, border: `1px solid ${lc.border}`,
                                color: lc.color, borderRadius: 4,
                                padding: "2px 6px", fontSize: 11, fontWeight: 700,
                              }}>{lbl}</span>
                            );
                          })}
                          {!isRestricted && labels.length === 0 && (
                            <span style={{ fontSize: 11, color: "#1f2937" }}>—</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function TraderPLTab() {
  const today = new Date().toISOString().split("T")[0];
  const [traders, setTraders] = useState([]);
  const [traderId, setTraderId] = useState("");
  const [purchases, setPurchases] = useState([]);
  const [payouts, setPayouts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const [traderRecs, purchaseRecs, payoutRecs] = await Promise.all([
          fetchTable(TRADERS_TABLE, ["Name", "Preferred Name"]),
          fetchTable(PURCHASE_TABLE, ["Trader", "Total Cost", "Purchase Type", "Status", "Date Purchased"]),
          fetchTable(PAYOUT_TABLE, ["Name", "Trader", "Total Amount", "Payout Tier", "Status", "Date Received"]),
        ]);
        setTraders(traderRecs.map(r => ({
          id: r.id,
          name: r.fields["Name"] || "",
          preferredName: r.fields["Preferred Name"] || r.fields["Name"]?.split(" ")[0] || "?",
        })));
        setPurchases(purchaseRecs.map(r => ({
          id: r.id,
          trader: Array.isArray(r.fields["Trader"]) ? r.fields["Trader"][0] : (r.fields["Trader"] || ""),
          totalCost: r.fields["Total Cost"] || 0,
          purchaseType: r.fields["Purchase Type"]?.name || r.fields["Purchase Type"] || "",
          status: r.fields["Status"]?.name || r.fields["Status"] || "",
          datePurchased: r.fields["Date Purchased"] || "",
        })));
        setPayouts(payoutRecs.map(r => {
          const tierRaw = r.fields["Payout Tier"];
          const tierNum = typeof tierRaw === "number" ? tierRaw : parseFloat(tierRaw) || 0;
          const tierPct = tierNum > 1 ? tierNum / 100 : tierNum;
          return {
            id: r.id,
            name: r.fields["Name"] || "",
            trader: Array.isArray(r.fields["Trader"]) ? r.fields["Trader"][0] : (r.fields["Trader"] || ""),
            totalAmount: r.fields["Total Amount"] || 0,
            tierPct,
            status: r.fields["Status"]?.name || r.fields["Status"] || "",
            dateReceived: r.fields["Date Received"] || "",
          };
        }));
      } catch (e) {}
      setLoading(false);
    }
    load();
  }, []);

  const traderPurchases = purchases.filter(p => {
    const tid = typeof p.trader === "object" ? p.trader?.id : p.trader;
    return tid === traderId && p.status === "Active";
  });
  const traderPayouts = payouts.filter(p => {
    const tid = typeof p.trader === "object" ? p.trader?.id : p.trader;
    return tid === traderId && p.status === "Received";
  });

  const totalSpent = traderPurchases.reduce((s, p) => s + (p.totalCost || 0), 0);

  const payoutRows = traderPayouts.map(p => {
    const gross = p.totalAmount || 0;
    const tierPct = p.tierPct || 0;
    const afterTier = gross * (1 - tierPct);
    const after65 = afterTier * 0.65;
    const tax = gross * 0.10;
    const profit = after65 - tax;
    return { ...p, gross, tierPct, afterTier, after65, tax, profit };
  }).sort((a, b) => (b.dateReceived || "").localeCompare(a.dateReceived || ""));

  const totalPayouts = payoutRows.reduce((s, r) => s + r.gross, 0);
  const totalTaxes = payoutRows.reduce((s, r) => s + r.tax, 0);
  const totalProfit = payoutRows.reduce((s, r) => s + r.profit, 0);
  const totalTraderFees = payoutRows.reduce((s, r) => s + r.afterTier * 0.35, 0);

  const C = { card: "#111827", border: "#1f2937" };
  const pill = (active) => ({
    background: active ? "#1f3a5f" : "#18222f",
    color: active ? "#7dd3fc" : "#888",
    border: `1px solid ${active ? "#3b82f6" : "#2a3442"}`,
    borderRadius: 999, padding: "5px 14px", fontSize: 12, fontWeight: 600,
    cursor: "pointer", whiteSpace: "nowrap",
  });

  function SummaryCard({ label, value, color = "#fff", sub }) {
    return (
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: "14px 18px", flex: 1 }}>
        <div style={{ fontSize: 10, color: "#6b7280", textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>{label}</div>
        <div style={{ fontSize: 20, fontWeight: 800, color }}>{value}</div>
        {sub && <div style={{ fontSize: 10, color: "#4b5563", marginTop: 3 }}>{sub}</div>}
      </div>
    );
  }

  if (loading) return <div style={{ color: "#6b7280", fontSize: 14, padding: "40px 0", textAlign: "center" }}>Loading...</div>;

  return (
    <div>
      {/* Trader pills */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 20 }}>
        {traders.map(t => (
          <button key={t.id} onClick={() => setTraderId(t.id)} style={pill(traderId === t.id)}>
            {t.preferredName}
          </button>
        ))}
      </div>

      {!traderId && (
        <div style={{ color: "#6b7280", fontSize: 13, textAlign: "center", padding: "40px 0" }}>Select a trader to view their P&L.</div>
      )}

      {traderId && (
        <>
          {/* Summary row */}
          <div style={{ display: "flex", gap: 12, marginBottom: 24, flexWrap: "wrap" }}>
            {SummaryCard({ label: "Total Spent", value: $$(totalSpent), color: "#f87171" })}
            {SummaryCard({ label: "Total Payouts Received", value: $$(totalPayouts), color: "#60a5fa" })}
            {SummaryCard({ label: "Taxes (10%)", value: $$(totalTaxes), color: "#fbbf24", sub: "Set aside from gross payouts" })}
            {SummaryCard({ label: "Net Profit", value: $$(totalProfit), color: totalProfit >= 0 ? "#4ade80" : "#f87171" })}
            {SummaryCard({ label: "Trader Fees", value: $$(totalTraderFees), color: "#a78bfa" })}
          </div>

          {/* Payouts breakdown */}
          <div style={{ marginBottom: 28 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
              <div style={{ width: 3, height: 16, background: "#3b82f6", borderRadius: 99 }} />
              <span style={{ fontSize: 13, fontWeight: 700, color: "#e5e7eb" }}>Payouts Received</span>
              <span style={{ background: "#1f2937", color: "#9ca3af", fontSize: 10, padding: "1px 6px", borderRadius: 99 }}>{payoutRows.length}</span>
            </div>
            {payoutRows.length === 0 ? (
              <div style={{ color: "#4b5563", fontSize: 12 }}>No received payouts for this trader.</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {payoutRows.map(r => (
                  <div key={r.id} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: "14px 16px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: "#e5e7eb" }}>{r.name || r.dateReceived || "Payout"}</span>
                      <span style={{ fontSize: 11, color: "#6b7280" }}>{r.dateReceived || "—"}</span>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 8 }}>
                      {[
                        ["Gross Payout", $$(r.gross), "#60a5fa"],
                        [`Tier (${Math.round(r.tierPct * 100)}%)`, `−${$$(r.gross * r.tierPct)}`, "#f87171"],
                        ["× 65%", $$(r.after65), "#a78bfa"],
                        ["Taxes (10%)", `−${$$(r.tax)}`, "#fbbf24"],
                        ["Profit", $$(r.profit), r.profit >= 0 ? "#4ade80" : "#f87171"],
                      ].map(([lbl, val, color]) => (
                        <div key={lbl} style={{ textAlign: "center", background: "#0d1117", borderRadius: 8, padding: "10px 6px" }}>
                          <div style={{ fontSize: 9, color: "#6b7280", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 5 }}>{lbl}</div>
                          <div style={{ fontSize: 13, fontWeight: 800, color }}>{val}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Purchases breakdown */}
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
              <div style={{ width: 3, height: 16, background: "#ef4444", borderRadius: 99 }} />
              <span style={{ fontSize: 13, fontWeight: 700, color: "#e5e7eb" }}>Purchases</span>
              <span style={{ background: "#1f2937", color: "#9ca3af", fontSize: 10, padding: "1px 6px", borderRadius: 99 }}>{traderPurchases.length}</span>
            </div>
            {traderPurchases.length === 0 ? (
              <div style={{ color: "#4b5563", fontSize: 12 }}>No purchases for this trader.</div>
            ) : (
              <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: "14px 18px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 13, color: "#9ca3af" }}>Purchases ({traderPurchases.length})</span>
                <span style={{ fontSize: 18, fontWeight: 800, color: "#f87171" }}>{$$(totalSpent)}</span>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function SnapshotTab({ evalAccounts = [], perfAccounts = [], dones = {} }) {
  const standardPerf = perfAccounts.filter(a => !a.payoutAccount && a.status === "Active");
  const livePerf = perfAccounts.filter(a => a.status === "Live" || (a.payoutAccount && a.status === "Active"));
  const waitingPerf = perfAccounts.filter(a => a.status === "Waiting on Payout");

  function groupByProvider(accounts, sortFn) {
    const defaultSort = (a, b) => {
      const va = a.score != null ? a.score : 99;
      const vb = b.score != null ? b.score : 99;
      return va - vb;
    };
    const active = accounts.filter(a => !dones[a.id]).slice().sort(sortFn || defaultSort);
    const done = accounts.filter(a => dones[a.id]);
    const all = [...active, ...done];
    const byProvider = {};
    all.forEach(a => {
      const dp = a.dataProvider || "Other";
      if (!byProvider[dp]) byProvider[dp] = [];
      byProvider[dp].push(a);
    });
    return byProvider;
  }

  function SnapCard(a) {
    const isDone = !!dones[a.id];
    const header = [a.traderName || a.name, a.firmName || a.dataProvider || "—"].filter(Boolean).join(" — ");

    if (a.status === "Waiting on Payout") {
      return (
        <div key={a.id} style={{ background: "#131e28", border: "1px solid #1e2e3e", borderRadius: 6, padding: "6px 8px", marginBottom: 3, opacity: isDone ? 0.4 : 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: isDone ? "#4b5563" : "#d1d5db", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>{header}</span>
            <span style={{ fontSize: 8, fontWeight: 700, background: "#3b2a0a", color: "#fbbf24", padding: "1px 4px", borderRadius: 3, flexShrink: 0 }}>WAITING</span>
          </div>
        </div>
      );
    }

    const isLivePayout = a.status === "Live" || (a.payoutAccount && a.status === "Active");

    if (isLivePayout) {
      const profitPerAcct = a.ddLeft ?? null;
      const amtForPayout = a.stageTarget != null && a.bal != null ? a.stageTarget - a.bal : null;
      const acctValue = a.contractMultiplier > 0 && a.ddLeft != null ? a.ddLeft * (a.n || 1) / a.contractMultiplier : null;
      const payoutScore = amtForPayout == null ? null : amtForPayout <= 0 ? "✓" : Math.min(10, Math.ceil(amtForPayout / 500));
      const daysScore = a.tradingDaysLeft == null ? null : a.tradingDaysLeft <= 0 ? "✓" : a.tradingDaysLeft;
      const psColor = payoutScore === "✓" ? "#22c55e" : payoutScore != null ? lpColor(payoutScore) : "#4b5563";
      const dsColor = daysScore === "✓" ? "#22c55e" : daysScore != null ? lpColor(Math.min(daysScore, 10)) : "#4b5563";
      const stats = [
        ["Target", $$target(a.limit)],
        ["Daily Loss", a.dailyLossLimit ? $$(a.dailyLossLimit) : "—"],
        ["Acct #", a.accountNumber ?? "—"],
        ["Days Left", a.tradingDaysLeft ?? "—"],
        ["Multiplier", a.contractMultiplier ?? 1],
        ["Profit/Acct", profitPerAcct != null ? $$(profitPerAcct) : "—"],
        ["Amt for Payout", amtForPayout == null ? "—" : amtForPayout <= 0 ? "✓ Met" : $$(amtForPayout)],
        ["Acct Value", acctValue != null ? $$(acctValue) : "—"],
      ];
      return (
        <div key={a.id} style={{ background: "#131e28", border: `1px solid ${isDone ? "#1a2030" : "#78350f"}`, borderRadius: 6, padding: "6px 8px", marginBottom: 3, opacity: isDone ? 0.4 : 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 5 }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: isDone ? "#4b5563" : "#d1d5db", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>{header}</span>
            {a.status === "Live" && <span style={{ fontSize: 8, fontWeight: 700, background: "#7f1d1d", color: "#fca5a5", padding: "1px 4px", borderRadius: 3, flexShrink: 0 }}>LIVE</span>}
            <span style={{ fontSize: 10, fontWeight: 800, background: `${psColor}22`, color: psColor, padding: "0px 5px", borderRadius: 99, flexShrink: 0, border: `1px solid ${psColor}` }}>{payoutScore ?? "—"}</span>
            <span style={{ fontSize: 10, fontWeight: 800, background: `${dsColor}22`, color: dsColor, padding: "0px 5px", borderRadius: 99, flexShrink: 0, border: `1px solid ${dsColor}` }}>{daysScore ?? "—"}</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 3 }}>
            {stats.map(([lbl, val]) => (
              <div key={lbl} style={{ textAlign: "center" }}>
                <div style={{ fontSize: 8, color: "#4b5563", textTransform: "uppercase", letterSpacing: 0.3, marginBottom: 1 }}>{lbl}</div>
                <div style={{ fontSize: 10, fontWeight: 700, color: isDone ? "#4b5563" : "#fbbf24" }}>{val}</div>
              </div>
            ))}
          </div>
        </div>
      );
    }

    const sc = a.score;
    const scoreColor = sc == null ? null : sc >= 8 ? "#22c55e" : sc >= 5 ? "#eab308" : "#ef4444";
    return (
      <div key={a.id} style={{ background: "#131e28", border: `1px solid ${isDone ? "#1a2030" : "#1e2e3e"}`, borderRadius: 6, padding: "6px 8px", marginBottom: 3, opacity: isDone ? 0.4 : 1 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 5 }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: isDone ? "#4b5563" : "#d1d5db", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>{header}</span>
          <span style={{ fontSize: 11, fontWeight: 800, background: scoreColor ? `${scoreColor}22` : "#1f2937", color: scoreColor ?? "#4b5563", padding: "0px 6px", borderRadius: 99, flexShrink: 0, border: `1px solid ${scoreColor ?? "#374151"}` }}>
            {sc != null ? sc : "—"}
          </span>
          {a.status === "Live" && !isDone && <span style={{ fontSize: 8, fontWeight: 700, background: "#7f1d1d", color: "#fca5a5", padding: "1px 4px", borderRadius: 3, flexShrink: 0 }}>LIVE</span>}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr 1fr", gap: 3 }}>
          {[["Target", $$target(a.limit)], ["Daily Loss", a.dailyLossLimit ? $$(a.dailyLossLimit) : "—"], ["Acct #", a.accountNumber ?? "—"], ["Days Left", a.tradingDaysLeft ?? "—"], a.type === "eval" ? ["Weight", a.accountWeight ?? "—"] : ["Multiplier", a.contractMultiplier ?? 1]].map(([lbl, val]) => (
            <div key={lbl} style={{ textAlign: "center" }}>
              <div style={{ fontSize: 8, color: "#4b5563", textTransform: "uppercase", letterSpacing: 0.3, marginBottom: 1 }}>{lbl}</div>
              <div style={{ fontSize: 10, fontWeight: 700, color: isDone ? "#4b5563" : "#4ade80" }}>{val}</div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  function SnapSection({ title, color, accounts, sortFn }) {
    if (accounts.length === 0) return null;
    const byProvider = groupByProvider(accounts, sortFn);
    const providers = Object.keys(byProvider).sort();
    const activeCount = accounts.filter(a => !dones[a.id]).length;
    return (
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
          <div style={{ width: 3, height: 14, background: color, borderRadius: 99 }} />
          <span style={{ fontSize: 12, fontWeight: 700, color: "#e5e7eb" }}>{title}</span>
          <span style={{ background: "#1f2937", color: "#9ca3af", fontSize: 9, padding: "1px 5px", borderRadius: 99 }}>{activeCount}</span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: `repeat(${Math.min(providers.length, 4)}, 1fr)`, gap: 6 }}>
          {providers.map(dp => (
            <div key={dp}>
              <div style={{ fontSize: 9, fontWeight: 700, color: "#374151", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 4, paddingBottom: 2, borderBottom: "1px solid #1f2937" }}>{dp}</div>
              {byProvider[dp].map(a => SnapCard(a))}
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      {SnapSection({ title: "Evaluation Accounts", color: "#8b5cf6", accounts: evalAccounts })}
      {SnapSection({ title: "Performance Accounts", color: "#3b82f6", accounts: standardPerf })}
      {SnapSection({ title: "Live & Payout Accounts", color: "#f59e0b", accounts: livePerf, sortFn: (a, b) => {
  const lpMax = acc => {
    const amt = acc.stageTarget != null ? acc.stageTarget - acc.bal : null;
    const ps = amt == null ? 0 : amt <= 0 ? 0 : Math.min(10, Math.ceil(amt / 500));
    const ds = acc.tradingDaysLeft == null ? 0 : acc.tradingDaysLeft <= 0 ? 0 : acc.tradingDaysLeft;
    return Math.max(ps, ds);
  };
  return lpMax(a) - lpMax(b);
} })}
      {SnapSection({ title: "Waiting on Payout", color: "#6b7280", accounts: waitingPerf })}
    </div>
  );
}

function PLTab({ evalAccounts, perfAccounts }) {
  const C = { bg: "#030712", card: "#111827", border: "#1f2937" };
  const [startingLiquidation, setStartingLiquidation] = useState("");
  const [purchases, setPurchases] = useState([]);
  const [payouts, setPayouts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dateM, setDateM] = useState("");
  const [dateD, setDateD] = useState("");
  const [dateY, setDateY] = useState("");
  const [selectedDate, setSelectedDate] = useState("");

  const mRef = useRef(null);
  const dRef = useRef(null);
  const yRef = useRef(null);

  const OTHER_TRADERS = ["rec0jB7J1Ir1ZspvM", "rec4l8EM9peAdyin4", "reccHyxv7emOGQJsQ", "recvSEg1nPtZCKujB"];
  const TRADER_NAMES = {
    "recmziqSnANAPjtuH": "Jonathan Jones",
    "recG04aHVI38R6HnR": "Cherelyn Jones",
    "rec0jB7J1Ir1ZspvM": "Amanda Seratt",
    "reccHyxv7emOGQJsQ": "Jefferies Parker (Troy)",
    "rec4l8EM9peAdyin4": "Judy Jones",
    "recvSEg1nPtZCKujB": "Rolly Omas Obial",
  };
  const RITHMIC_DX = ["Rithmic", "DX Feed"];

  useEffect(() => { loadPLData(); }, []);

  const handleDateSubmit = () => {
    if (dateM.length === 2 && dateD.length === 2 && dateY.length === 4) {
      setSelectedDate(`${dateY}-${dateM}-${dateD}`);
    }
  };

  async function loadPLData() {
    setLoading(true);
    try {
      const [purchaseRecords, payoutRecords] = await Promise.all([
        fetchTable(PURCHASE_TABLE, ["Date Purchased", "Status", "Total Cost", "Purchase Type"]),
        fetchTable(PAYOUT_TABLE, ["Name", "Total Amount", "Date Received", "Trader", "Performance Account", "Status", "Number of Accounts"]),
      ]);
      setPurchases(purchaseRecords.map(r => ({
        id: r.id,
        datePurchased: r.fields["Date Purchased"] || "",
        status: r.fields["Status"] || "",
        totalCost: r.fields["Total Cost"] || 0,
        purchaseType: r.fields["Purchase Type"]?.name || r.fields["Purchase Type"] || "",
      })));
      setPayouts(payoutRecords.map(r => ({
        id: r.id,
        name: r.fields["Name"] || "",
        totalAmount: r.fields["Total Amount"] || 0,
        dateReceived: r.fields["Date Received"] || "",
        trader: Array.isArray(r.fields["Trader"]) ? r.fields["Trader"][0] : (r.fields["Trader"] || ""),
        account: Array.isArray(r.fields["Performance Account"]) ? r.fields["Performance Account"][0] : (r.fields["Performance Account"] || null),
        status: r.fields["Status"]?.name || r.fields["Status"] || "",
        numAccounts: r.fields["Number of Accounts"] || 1,
      })));
    } catch (e) {}
    setLoading(false);
  }

  // Filter purchases by date (selectedDate is always YYYY-MM-DD)
  const dayPurchases = purchases.filter(p => p.datePurchased === selectedDate && p.status === "Active");
  const dayPurchaseCost = dayPurchases.reduce((sum, p) => sum + (p.totalCost || 0), 0);

  // Filter payouts by Date Received
  const dayPayouts = payouts.filter(p => String(p.dateReceived ?? "").trim().slice(0, 10) === selectedDate);

  // Liquidation calc
  const startLiq = parseFloat(startingLiquidation) || 0;
  const totalLiq = startLiq + dayPurchaseCost;
  const tier = totalLiq <= 5000 ? 0.40 : totalLiq <= 10000 ? 0.50 : totalLiq <= 20000 ? 0.60 : 0.70;
  const tierPct = Math.round(tier * 100);
  const liqReduction = dayPayouts.reduce((sum, p) => sum + (p.totalAmount || 0) * tier, 0);
  const endingLiq = totalLiq - liqReduction;

  const payoutRows = dayPayouts.map(p => {
    const traderId = typeof p.trader === "object" ? p.trader?.id : p.trader;
    const traderName = TRADER_NAMES[traderId] ?? p.trader ?? "—";
    const totalPayout  = Math.round(p.totalAmount || 0);
    const liqRepayment = Math.round(totalPayout * tier);
    const afterLiq     = Math.round(totalPayout - liqRepayment);
    const taxSet       = Math.round(totalPayout * 0.10);
    const traderProfit = Math.round(afterLiq * 0.65 - taxSet);
    return { traderName, totalPayout, liqRepayment, afterLiq, taxSet, traderProfit };
  });

  const activeEvals = evalAccounts;
  const nonPayoutPerf = perfAccounts.filter(a => !a.payoutAccount);
  const payoutPerf = perfAccounts.filter(a => a.payoutAccount);

  const rmcEvals = activeEvals.filter(a => RITHMIC_DX.includes(a.dataProvider)).reduce((s, a) => s + a.n, 0);
  const tdvEvals = activeEvals.filter(a => a.dataProvider === "Tradovate").reduce((s, a) => s + a.n, 0);
  const xEvals = activeEvals.filter(a => a.dataProvider === "Project X").reduce((s, a) => s + a.n, 0);
  const totalActiveEvals = rmcEvals + tdvEvals + xEvals;

  const rmcPerf = nonPayoutPerf.filter(a => RITHMIC_DX.includes(a.dataProvider)).reduce((s, a) => s + a.n, 0);
  const tdvPerf = nonPayoutPerf.filter(a => a.dataProvider === "Tradovate").reduce((s, a) => s + a.n, 0);
  const xPerf = nonPayoutPerf.filter(a => a.dataProvider === "Project X").reduce((s, a) => s + a.n, 0);
  const totalActivePerf = rmcPerf + tdvPerf + xPerf;

  const rmcLive = payoutPerf.filter(a => RITHMIC_DX.includes(a.dataProvider)).reduce((s, a) => s + a.n, 0);
  const tdvLive = payoutPerf.filter(a => a.dataProvider === "Tradovate").reduce((s, a) => s + a.n, 0);
  const xLive = payoutPerf.filter(a => a.dataProvider === "Project X").reduce((s, a) => s + a.n, 0);
  const totalActiveLive = rmcLive + tdvLive + xLive;

  const cashedOut = dayPayouts.reduce((s, p) => s + (p.totalAmount || 0), 0);

  const profitFromOthers = dayPayouts
    .filter(p => OTHER_TRADERS.includes(typeof p.trader === "object" ? p.trader?.id : p.trader))
    .reduce((s, p) => s + (p.totalAmount || 0) * 0.5, 0);

  function StatBox({ label, value, color = "#fff", sub }) {
    return (
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: "12px 16px" }}>
        <div style={{ fontSize: 10, color: "#6b7280", textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>{label}</div>
        <div style={{ fontSize: 18, fontWeight: 700, color }}>{value}</div>
        {sub && <div style={{ fontSize: 10, color: "#4b5563", marginTop: 2 }}>{sub}</div>}
      </div>
    );
  }

  function SectionHeader({ title, color }) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "20px 0 10px" }}>
        <div style={{ width: 3, height: 16, background: color, borderRadius: 99 }} />
        <span style={{ fontSize: 13, fontWeight: 700, color: "#e5e7eb" }}>{title}</span>
      </div>
    );
  }

  if (loading) return <div style={{ color: "#6b7280", padding: 40, textAlign: "center" }}>Loading P&L data...</div>;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 10, color: "#6b7280", marginBottom: 4, textTransform: "uppercase", letterSpacing: 1 }}>Date</div>
          <div style={{ display: "flex", alignItems: "center", gap: 4, background: "#1f2937", border: "1px solid #374151", borderRadius: 8, padding: "8px 12px" }}>
            <input
              ref={mRef}
              type="text"
              inputMode="numeric"
              maxLength={2}
              placeholder="MM"
              value={dateM}
              onChange={e => {
                const v = e.target.value.replace(/\D/g, "");
                setDateM(v);
                if (v.length === 2) dRef.current?.focus();
              }}
              style={{ background: "transparent", color: "#fff", fontSize: 14, width: 22, textAlign: "center", outline: "none", border: "none" }}
            />
            <span style={{ color: "#6b7280" }}>/</span>
            <input
              ref={dRef}
              type="text"
              inputMode="numeric"
              maxLength={2}
              placeholder="DD"
              value={dateD}
              onChange={e => {
                const v = e.target.value.replace(/\D/g, "");
                setDateD(v);
                if (v.length === 2) yRef.current?.focus();
              }}
              onKeyDown={e => e.key === "Backspace" && dateD === "" && mRef.current?.focus()}
              style={{ background: "transparent", color: "#fff", fontSize: 14, width: 22, textAlign: "center", outline: "none", border: "none" }}
            />
            <span style={{ color: "#6b7280" }}>/</span>
            <input
              ref={yRef}
              type="text"
              inputMode="numeric"
              maxLength={4}
              placeholder="YYYY"
              value={dateY}
              onChange={e => {
                const v = e.target.value.replace(/\D/g, "");
                setDateY(v);
              }}
              onKeyDown={e => {
                if (e.key === "Backspace" && dateY === "") dRef.current?.focus();
                if (e.key === "Enter" && dateY.length === 4) handleDateSubmit();
              }}
              style={{ background: "transparent", color: "#fff", fontSize: 14, width: 38, textAlign: "center", outline: "none", border: "none" }}
            />
          </div>
        </div>
        <button onClick={handleDateSubmit} style={{ background: "#2563eb", border: "none", borderRadius: 8, padding: "8px 16px", fontSize: 13, color: "#fff", cursor: "pointer", marginTop: 18, fontWeight: 600 }}>
          Submit
        </button>
        <button onClick={loadPLData} style={{ background: "#1f2937", border: "1px solid #374151", borderRadius: 8, padding: "8px 14px", fontSize: 12, color: "#9ca3af", cursor: "pointer", marginTop: 18 }}>
          🔄 Refresh
        </button>
      </div>

      {/* Liquidation Section */}
      <div style={{ background: "#111827", border: "1px solid #374151", borderRadius: 12, padding: 20, marginBottom: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: "#fff", marginBottom: 14 }}>💧 Liquidation</div>

        <div style={{ display: "flex", gap: 12, marginBottom: 14, alignItems: "center" }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, color: "#9ca3af", marginBottom: 4 }}>Starting Liquidation</div>
            <input type="number" value={startingLiquidation} onChange={e => setStartingLiquidation(e.target.value)}
              placeholder="0.00"
              style={{ width: "100%", background: "#1f2937", border: "1px solid #374151", borderRadius: 8, padding: "8px 12px", fontSize: 13, color: "#fff", outline: "none", boxSizing: "border-box" }} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, color: "#9ca3af", marginBottom: 4 }}>Purchases Today</div>
            <div style={{ background: "#1f2937", borderRadius: 8, padding: "9px 12px", fontSize: 13, color: "#f59e0b" }}>
              ${dayPurchaseCost.toLocaleString("en-US", { minimumFractionDigits: 2 })}
            </div>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, color: "#9ca3af", marginBottom: 4 }}>Total Liquidation</div>
            <div style={{ background: "#1f2937", borderRadius: 8, padding: "9px 12px", fontSize: 13, color: "#fff", fontWeight: 600 }}>
              ${totalLiq.toLocaleString("en-US", { minimumFractionDigits: 2 })}
            </div>
          </div>
          <div style={{ flex: 0.5 }}>
            <div style={{ fontSize: 11, color: "#9ca3af", marginBottom: 4 }}>Tier</div>
            <div style={{ background: "#1f2937", borderRadius: 8, padding: "9px 12px", fontSize: 13, color: "#6366f1", fontWeight: 700 }}>
              {tierPct}%
            </div>
          </div>
        </div>

        {dayPayouts.length > 0 && (
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 11, color: "#9ca3af", marginBottom: 8 }}>Payouts Received Today</div>
            {dayPayouts.map((p, i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", background: "#1f2937", borderRadius: 8, padding: "8px 12px", marginBottom: 6, fontSize: 12 }}>
                <span style={{ color: "#d1d5db" }}>{p.name}</span>
                <span style={{ color: "#4ade80" }}>${p.totalAmount?.toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
                <span style={{ color: "#9ca3af" }}>× {tierPct}% = <span style={{ color: "#f87171" }}>-${(p.totalAmount * tier).toLocaleString("en-US", { minimumFractionDigits: 2 })}</span></span>
              </div>
            ))}
          </div>
        )}

        {dayPayouts.length === 0 && (
          <div style={{ fontSize: 12, color: "#4b5563", marginBottom: 14 }}>No payouts received on this date.</div>
        )}

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid #1f2937", paddingTop: 12 }}>
          <div style={{ fontSize: 13, color: "#9ca3af" }}>Ending Liquidation</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: endingLiq <= 0 ? "#4ade80" : endingLiq < 5000 ? "#f59e0b" : "#f87171" }}>
            ${endingLiq.toLocaleString("en-US", { minimumFractionDigits: 2 })}
          </div>
        </div>
      </div>

      {/* Payouts Received Section */}
      <div style={{ background: "#111827", border: "1px solid #374151", borderRadius: 12, padding: 20, marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
          <span>💰</span>
          <span style={{ color: "#fff", fontWeight: 600, fontSize: 15 }}>Payouts Received</span>
        </div>

        {payoutRows.length === 0 ? (
          <div style={{ fontSize: 12, color: "#4b5563", fontStyle: "italic" }}>No payouts received on this date.</div>
        ) : (
          <>
            {/* Header Row */}
            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1.5fr 1.5fr 1.5fr", gap: 8, fontSize: 10, color: "#6b7280", textTransform: "uppercase", letterSpacing: 1, padding: "0 10px", marginBottom: 6 }}>
              <span>Trader</span>
              <span style={{ textAlign: "right" }}>Payout</span>
              <span style={{ textAlign: "right" }}>After Liq Repayment</span>
              <span style={{ textAlign: "right" }}>Put Away for Taxes</span>
              <span style={{ textAlign: "right" }}>Trader's Profit</span>
            </div>

            {payoutRows.map((row, i) => (
              <div key={i} style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1.5fr 1.5fr 1.5fr", gap: 8, background: "#1f2937", borderRadius: 8, padding: "10px", marginBottom: 6, fontSize: 13, alignItems: "center" }}>
                <span style={{ color: "#fff", fontWeight: 600 }}>{row.traderName}</span>
                <span style={{ textAlign: "right", color: "#93c5fd" }}>${row.totalPayout.toLocaleString()}</span>
                <span style={{ textAlign: "right", color: "#fcd34d" }}>${row.afterLiq.toLocaleString()}</span>
                <span style={{ textAlign: "right", color: "#f87171" }}>${row.taxSet.toLocaleString()}</span>
                <span style={{ textAlign: "right", fontWeight: 700, color: row.traderProfit >= 0 ? "#4ade80" : "#f87171" }}>${row.traderProfit.toLocaleString()}</span>
              </div>
            ))}

            {/* Totals Row */}
            {payoutRows.length > 1 && (
              <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1.5fr 1.5fr 1.5fr", gap: 8, borderTop: "1px solid #374151", paddingTop: 10, marginTop: 4, fontSize: 13, fontWeight: 600, padding: "10px" }}>
                <span style={{ color: "#9ca3af" }}>Total</span>
                <span style={{ textAlign: "right", color: "#93c5fd" }}>${payoutRows.reduce((s, r) => s + r.totalPayout, 0).toLocaleString()}</span>
                <span style={{ textAlign: "right", color: "#fcd34d" }}>${payoutRows.reduce((s, r) => s + r.afterLiq, 0).toLocaleString()}</span>
                <span style={{ textAlign: "right", color: "#f87171" }}>${payoutRows.reduce((s, r) => s + r.taxSet, 0).toLocaleString()}</span>
                <span style={{ textAlign: "right", color: "#4ade80" }}>${payoutRows.reduce((s, r) => s + r.traderProfit, 0).toLocaleString()}</span>
              </div>
            )}
          </>
        )}
      </div>

      <SectionHeader title="Evaluation Accounts" color="#8b5cf6" />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
        <StatBox label="RMC Evals" value={rmcEvals} color="#a78bfa" />
        <StatBox label="TDV Evals" value={tdvEvals} color="#a78bfa" />
        <StatBox label="X Evals" value={xEvals} color="#a78bfa" />
        <StatBox label="Active Evals" value={totalActiveEvals} color="#fff" />
      </div>

      <SectionHeader title="Performance Accounts" color="#3b82f6" />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
        <StatBox label="RMC Perf" value={rmcPerf} color="#93c5fd" />
        <StatBox label="TDV Perf" value={tdvPerf} color="#93c5fd" />
        <StatBox label="X Perf" value={xPerf} color="#93c5fd" />
        <StatBox label="Active Perf" value={totalActivePerf} color="#fff" />
      </div>

      <SectionHeader title="Live & Payout Accounts" color="#f59e0b" />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
        <StatBox label="RMC Live" value={rmcLive} color="#fcd34d" />
        <StatBox label="TDV Live" value={tdvLive} color="#fcd34d" />
        <StatBox label="X Live" value={xLive} color="#fcd34d" />
        <StatBox label="Active Live" value={totalActiveLive} color="#fff" />
      </div>

      <SectionHeader title="Financials" color="#10b981" />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8 }}>
        <StatBox label="Cashed Out Today" value={$$(cashedOut)} color="#4ade80" />
        <StatBox label="Profit from Others" value={$$(profitFromOthers)} color="#4ade80" />
      </div>
    </div>
  );
}
// Eval type → Perf type map (baked in from Airtable)
function AccountManagementTab() {
  const [evalToPerfMap, setEvalToPerfMap] = useState({});
  const [perfTypes, setPerfTypes] = useState([]);
  const [payoutStrategies, setPayoutStrategies] = useState([]);
  useEffect(() => {
    Promise.all([
      fetchTable("tbleHzHF5FgskLxs3", ["Name", "Performance Account Type"]),
      fetchTable("tbluVaCiyff48ic7L", ["Name", "Account Size"]),
      fetchTable("tbljLby6v0o6fydOw", ["Name", "Account Type", "Stage Number", "Stage Target", "On Completion Go To"]),
    ]).then(([evalTypeRecords, perfTypeRecords, strategyRecords]) => {
      const map = {};
      evalTypeRecords.forEach(r => {
        const pt = r.fields["Performance Account Type"];
        if (Array.isArray(pt) && pt.length > 0) map[r.id] = pt[0].id || pt[0];
      });
      setEvalToPerfMap(map);
      setPerfTypes(perfTypeRecords.map(r => ({
        id: r.id,
        name: r.fields["Name"] || "",
        accountSize: r.fields["Account Size"] || 0,
      })));
      setPayoutStrategies(strategyRecords.map(r => {
        const at = r.fields["Account Type"];
        return {
          id: r.id,
          name: r.fields["Name"] || "",
          perfTypeId: Array.isArray(at) && at.length > 0 ? (at[0].id || at[0]) : null,
          stage: r.fields["Stage Number"] || 1,
          target: r.fields["Stage Target"] || 0,
          next: r.fields["On Completion Go To"] || "",
        };
      }));
    });
  }, []);
  const C = { bg: "#0d1117", card: "#1f2a37", border: "#2d3f50" };
  const sel = { background: "#111827", border: "1px solid #2d3f50", borderRadius: 8, padding: "8px 12px", fontSize: 13, color: "#fff", width: "100%", outline: "none" };
  const inp = { background: "#111827", border: "1px solid #2d3f50", borderRadius: 8, padding: "8px 12px", fontSize: 13, color: "#fff", width: "100%", outline: "none", boxSizing: "border-box" };
  const subTabStyle = (active) => ({
    background: active ? "#2563eb" : "#1f2a37",
    color: active ? "#fff" : "#aaa",
    border: `1px solid ${active ? "#3b82f6" : "#2f3b4a"}`,
    borderRadius: 8, padding: "8px 18px", fontSize: 13, fontWeight: 600, cursor: "pointer",
  });
  const today = new Date().toISOString().split("T")[0];

  const [activeTab, setActiveTab] = useState("passed_evals");
  const [traderId, setTraderId] = useState("");
  const [evalAccounts, setEvalAccounts] = useState([]);
  const [perfAccounts, setPerfAccounts] = useState([]);
  const [payouts, setPayouts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [traderList, setTraderList] = useState([]);
  const [perfCountsByTrader, setPerfCountsByTrader] = useState({});
  const [evalCountsByTrader, setEvalCountsByTrader] = useState({});
  const [payoutCountsByTrader, setPayoutCountsByTrader] = useState({});

  // Passed Evals state
  const [selectedEvalId, setSelectedEvalId] = useState("");
  const [startingBalance, setStartingBalance] = useState("");
  const [dateActivated, setDateActivated] = useState(today);
  const [numAccounts, setNumAccounts] = useState(1);
  const [activationFee, setActivationFee] = useState("");
  const [contractMultiplier, setContractMultiplier] = useState(1);
  const [perfAccountNumber, setPerfAccountNumber] = useState("");

  // Stage Management state
  const [selectedPerfId, setSelectedPerfId] = useState("");
  const [stageAction, setStageAction] = useState("");
  const [newBalance, setNewBalance] = useState("");
  const [tradingDays, setTradingDays] = useState("");
  const [tradeDown, setTradeDown] = useState(false);
  const [resetTradingDays, setResetTradingDays] = useState(true);
  const [advancePayoutAmount, setAdvancePayoutAmount] = useState("");
  const [payoutDateRequested, setPayoutDateRequested] = useState(today);
  const [payoutNumAccounts, setPayoutNumAccounts] = useState("");
  const [payoutTradeDown, setPayoutTradeDown] = useState(false);

  // Payout Management state
  const [selectedPayoutId, setSelectedPayoutId] = useState("");
  const [payoutAction, setPayoutAction] = useState(""); // "status" or "receive"
  const [newPayoutStatus, setNewPayoutStatus] = useState("");
  const [receivedAmount, setReceivedAmount] = useState("");
  const [receivedDate, setReceivedDate] = useState(today);
  const [postPayoutBalance, setPostPayoutBalance] = useState("");
  const [postPayoutStageId, setPostPayoutStageId] = useState("");
  const [payoutTierInput, setPayoutTierInput] = useState("50");

  // Create New Payout form state
  const [cpTrader, setCpTrader] = useState("");
  const [cpPerfTypeId, setCpPerfTypeId] = useState("");
  const [cpDateRequested, setCpDateRequested] = useState(today);
  const [cpDateReceived, setCpDateReceived] = useState("");
  const [cpAmountPerAccount, setCpAmountPerAccount] = useState("");
  const [cpNumAccounts, setCpNumAccounts] = useState("1");
  const [cpStatus, setCpStatus] = useState("Requested");
  const [cpTier, setCpTier] = useState("50");
  const [cpStageId, setCpStageId] = useState("");
  const [cpNotes, setCpNotes] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState("");
  const [err, setErr] = useState(null);

  useEffect(() => {
    console.log("[AccountManagementTab] fetching traders");
    fetchTable(TRADERS_TABLE, ["Name", "Preferred Name"]).then(traders => {
      setTraderList(traders.map(r => ({
        id: r.id,
        name: r.fields["Name"],
        preferredName: r.fields["Preferred Name"] || r.fields["Name"].split(" ")[0],
      })).sort((a, b) => a.preferredName.localeCompare(b.preferredName)));
    }).catch(e => { console.error("[AccountManagementTab] traders error:", e); });
  }, []);
  useEffect(() => { loadData(); }, [traderId, activeTab]);

  async function loadData() {
    setLoading(true);
    try {
      const [er, pr, payr] = await Promise.all([
        fetch(`/.netlify/functions/airtable/${BASE}/${EVAL_TABLE}?maxRecords=200`).then(r => r.json()),
        fetch(`/.netlify/functions/airtable/${BASE}/${PERF_TABLE}?maxRecords=200`).then(r => r.json()),
        fetch(`/.netlify/functions/airtable/${BASE}/${PAYOUT_TABLE}?maxRecords=200`).then(r => r.json()),
      ]);

      const filterByTrader = (records, field = "Trader") =>
        !traderId ? [] : (records || []).filter(r => {
          const t = r.fields[field];
          return Array.isArray(t) && t.includes(traderId);
        });

      const activeEvalRecords = (er.records || []).filter(r => {
        const status = r.fields["Status"]?.name || r.fields["Status"];
        return status === "Active";
      });
      const eCounts = {};
      activeEvalRecords.forEach(r => {
        const tid = Array.isArray(r.fields["Trader"]) ? r.fields["Trader"][0] : null;
        if (tid) eCounts[tid] = (eCounts[tid] || 0) + 1;
      });
      setEvalCountsByTrader(eCounts);
      setEvalAccounts(filterByTrader(activeEvalRecords));

      const activePerfRecords = (pr.records || []).filter(r => {
        const status = r.fields["Status"]?.name || r.fields["Status"];
        return ["Active", "Live", "Waiting on Payout"].includes(status);
      });
      const pCounts = {};
      activePerfRecords.forEach(r => {
        const tid = Array.isArray(r.fields["Trader"]) ? r.fields["Trader"][0] : null;
        if (tid) pCounts[tid] = (pCounts[tid] || 0) + 1;
      });
      setPerfCountsByTrader(pCounts);
      setPerfAccounts(filterByTrader(activePerfRecords));

      // Payouts: filter by trader if selected, show non-Received by default
      const allPayouts = payr.records || [];
      const pendingPayouts = allPayouts.filter(r => r.fields["Status"] !== "Received");
      const payCounts = {};
      pendingPayouts.forEach(r => {
        const tid = Array.isArray(r.fields["Trader"]) ? r.fields["Trader"][0] : null;
        if (tid) payCounts[tid] = (payCounts[tid] || 0) + 1;
      });
      setPayoutCountsByTrader(payCounts);
      const filteredPayouts = traderId
        ? pendingPayouts.filter(r => {
            const t = r.fields["Trader"];
            return Array.isArray(t) && t.includes(traderId);
          })
        : pendingPayouts;
      setPayouts(filteredPayouts);
    } catch (e) {}
    setLoading(false);
  }

  function resetForm() {
    setSelectedEvalId(""); setStartingBalance(""); setDateActivated(today);
    setNumAccounts(1); setActivationFee(""); setContractMultiplier(1); setPerfAccountNumber("");
    setSelectedPerfId(""); setStageAction(""); setNewBalance("");
    setTradingDays(""); setResetTradingDays(true);
    setTradeDown(false); setAdvancePayoutAmount("");
    setSelectedPayoutId(""); setPayoutAction(""); setNewPayoutStatus("");
    setReceivedAmount(""); setReceivedDate(today); setPostPayoutBalance("");
    setPostPayoutStageId(""); setPayoutTierInput("50"); setPayoutDateRequested(today); setPayoutNumAccounts(""); setPayoutTradeDown(false);
    setCpTrader(""); setCpPerfTypeId(""); setCpDateRequested(today); setCpDateReceived("");
    setCpAmountPerAccount(""); setCpNumAccounts("1"); setCpStatus("Requested"); setCpTier("50");
    setCpStageId(""); setCpNotes("");
    setErr(null);
  }

  const selectedEval = evalAccounts.find(r => r.id === selectedEvalId);
  const selectedPerf = perfAccounts.find(r => r.id === selectedPerfId);
  const selectedPayout = payouts.find(r => r.id === selectedPayoutId);

  // Auto-derive perf type from eval type
  const evalTypeId = selectedEval
    ? (Array.isArray(selectedEval.fields["Evaluation Account Type"])
        ? selectedEval.fields["Evaluation Account Type"][0] : null)
    : null;
  const perfTypeId = evalToPerfMap?.[evalTypeId] ?? null;
  const perfType = perfTypeId ? perfTypes.find(t => t.id === perfTypeId) : null;

  // Stage info for selected perf
  const currentStageId = selectedPerf
    ? (Array.isArray(selectedPerf.fields["Current Stage"]) ? selectedPerf.fields["Current Stage"][0] : null)
    : null;
  const currentStage = payoutStrategies.find(s => s.id === currentStageId);
  const perfTypeForStages = selectedPerf
    ? (Array.isArray(selectedPerf.fields["Performance Account Type"]) ? selectedPerf.fields["Performance Account Type"][0] : null)
    : null;
  const availableStages = payoutStrategies.filter(s => s.perfTypeId === perfTypeForStages).sort((a, b) => a.stage - b.stage);
  const nextStage = currentStage ? availableStages.find(s => s.stage === currentStage.stage + 1) : availableStages[0];

  // Stage info for post-payout perf account
  const payoutPerfId = selectedPayout
    ? (Array.isArray(selectedPayout.fields["Performance Account"]) ? selectedPayout.fields["Performance Account"][0] : null)
    : null;
  const payoutPerf = payoutPerfId ? [...perfAccounts].find(r => r.id === payoutPerfId) : null;
  const payoutPerfTypeId = payoutPerf
    ? (Array.isArray(payoutPerf.fields["Performance Account Type"]) ? payoutPerf.fields["Performance Account Type"][0] : null)
    : null;
  const payoutAvailableStages = payoutStrategies.filter(s => s.perfTypeId === payoutPerfTypeId).sort((a, b) => a.stage - b.stage);

  async function handleConvertEval() {
    if (!perfTypeId) {
      alert("Performance account type not found. Please wait a moment and try again.");
      return;
    }
    if (!selectedEvalId || !perfTypeId || !startingBalance || !dateActivated) return;
    setSubmitting(true); setErr(null);
    try {
      const trader = traderList.find(t => t.id === traderId);
      const pt = perfTypes.find(t => t.id === perfTypeId);
      const firstStage = payoutStrategies.find(s => s.perfTypeId === perfTypeId && s.stage === 1);
      await updateRecord(EVAL_TABLE, selectedEvalId, { "Status": "Passed" });
      const perfFields = {
        "Name": `${trader?.name?.split(" ")[0]} - ${pt?.name}`,
        "Status": "Active",
        "Current Balance": parseFloat(startingBalance),
        "High Water Mark": parseFloat(startingBalance),
        "Cycle Start Balance": parseFloat(startingBalance),
        "Date Activated": dateActivated,
        "Number of Accounts": parseInt(numAccounts),
        "Trading Days this Cycle": 0,
        "Performance Account Type": [perfTypeId],
        "Trader": [traderId],
        "Evaluation Accounts": [selectedEvalId],
      };
      if (firstStage) perfFields["Current Stage"] = [firstStage.id];
      if (contractMultiplier) perfFields["Contract Multiplier"] = parseFloat(contractMultiplier);
      if (perfAccountNumber) perfFields["Account Number"] = perfAccountNumber;
      const newPerfRecord = await createRecord(PERF_TABLE, perfFields);
      const newPerfId = newPerfRecord?.id;
      await createRecord(PURCHASE_TABLE, {
        "Name": `${trader?.name?.split(" ")[0]} - ${pt?.name} - Activation - ${dateActivated}`,
        "Date Purchased": dateActivated,
        "Number of Accounts": parseInt(numAccounts),
        "Cost Per Account": parseFloat(activationFee) || 0,
        "Purchase Type": "Activation Fee",
        "Status": "Active",
        "Trader": [traderId],
        "Evaluation Account": [selectedEvalId],
        "Performance Account Type": [perfTypeId],
        ...(newPerfId && { "Performance Account": [newPerfId] }),
      });
      setSuccess("✓ Eval passed and Performance Account created!");
      setTimeout(() => setSuccess(""), 4000);
      resetForm(); loadData();
    } catch (e) { setErr("Failed: " + e.message); }
    setSubmitting(false);
  }

  async function handleStageAdvance() {
    if (!selectedPerfId || !nextStage || !newBalance) return;
    setSubmitting(true); setErr(null);
    try {
      const fields = {
        "Current Stage": [nextStage.id],
        "Current Balance": parseFloat(newBalance),
        "High Water Mark": parseFloat(newBalance),
        "Cycle Start Balance": parseFloat(newBalance),
        "Trading Days this Cycle": tradingDays ? parseInt(tradingDays) : 0,
      };
      if (contractMultiplier) fields["Contract Multiplier"] = parseFloat(contractMultiplier);
      // Auto-set payout account when advancing to stage 2 or higher
      if (nextStage.stage >= 2) {
        fields["Payout Account"] = true;
      }
      if (tradeDown) {
        fields["Trade Down Account"] = true;
      }
      await updateRecord(PERF_TABLE, selectedPerfId, fields);
      // Create a received payout record if an amount was entered
      if (advancePayoutAmount) {
        const perf = perfAccounts.find(r => r.id === selectedPerfId);
        const trader = traderList.find(t => t.id === traderId);
        const numAccts = perf?.fields["Number of Accounts"] || 1;
        const amtPerAcct = parseFloat(advancePayoutAmount) / numAccts;
        await createRecord(PAYOUT_TABLE, {
          "Name": `${trader?.name?.split(" ")[0]} - ${perf?.fields["Name"]} - ${today}`,
          "Performance Account": [selectedPerfId],
          "Date Requested": today,
          "Date Received": today,
          "Amount Per Account": amtPerAcct,
          "Number of Accounts": numAccts,
          "Status": "Received",
          ...(traderId ? { "Trader": [traderId] } : {}),
        });
      }
      setSuccess(`✓ Advanced to Stage ${nextStage.stage}${advancePayoutAmount ? " + payout logged!" : "!"}`);
      setTimeout(() => setSuccess(""), 4000);
      resetForm(); loadData();
    } catch (e) { setErr("Failed: " + e.message); }
    setSubmitting(false);
  }

  async function handleRequestPayout() {
    if (!selectedPerfId) return;
    setSubmitting(true); setErr(null);
    try {
      const perf = perfAccounts.find(r => r.id === selectedPerfId);
      const trader = traderList.find(t => t.id === traderId);
      const perfUpdate = { "Status": "Waiting on Payout" };
      if (payoutTradeDown) perfUpdate["Trade Down Account"] = true;
      await updateRecord(PERF_TABLE, selectedPerfId, perfUpdate);
      // Create payout record
      const dateReq = payoutDateRequested || today;
      const numAccts = payoutNumAccounts ? parseInt(payoutNumAccounts) : (perf?.fields["Number of Accounts"] || 1);
      const payoutFields = {
        "Name": `${trader?.name?.split(" ")[0] ?? "Unknown"} - ${perf?.fields["Name"]} - ${dateReq}`,
        "Performance Account": [selectedPerfId],
        "Date Requested": dateReq,
        "Status": "Requested",
        "Number of Accounts": numAccts,
      };
      if (traderId) payoutFields["Trader"] = [traderId];
      await createRecord(PAYOUT_TABLE, payoutFields);
      setSuccess("✓ Payout requested and logged!");
      setTimeout(() => setSuccess(""), 4000);
      resetForm(); loadData();
    } catch (e) { setErr("Failed: " + e.message); }
    setSubmitting(false);
  }

  async function handleCreatePayout() {
    if (!cpTrader || !cpPerfTypeId || !cpAmountPerAccount) { setErr("Trader, Account Type, and Amount are required."); return; }
    setSubmitting(true); setErr(null);
    try {
      const trader = traderList.find(t => t.id === cpTrader);
      const pt = perfTypes.find(t => t.id === cpPerfTypeId);
      const tierDecimal = (parseFloat(cpTier) || 50) / 100;
      const fields = {
        "Name": `${trader?.name?.split(" ")[0] ?? "Unknown"} - ${pt?.name ?? "Payout"} - ${cpDateRequested}`,
        "Trader": [cpTrader],
        "Date Requested": cpDateRequested,
        "Amount Per Account": parseFloat(cpAmountPerAccount),
        "Number of Accounts": parseInt(cpNumAccounts) || 1,
        "Status": cpStatus,
        "Payout Tier": tierDecimal,
      };
      if (cpDateReceived) fields["Date Received"] = cpDateReceived;
      if (cpNotes) fields["Notes"] = cpNotes;
      await createRecord(PAYOUT_TABLE, fields);
      setSuccess("✓ Payout record created!");
      setTimeout(() => setSuccess(""), 4000);
      resetForm(); loadData();
    } catch (e) { setErr("Failed: " + e.message); }
    setSubmitting(false);
  }

  async function handleUpdatePayoutStatus() {
    if (!selectedPayoutId || !newPayoutStatus) return;
    setSubmitting(true); setErr(null);
    try {
      await updateRecord(PAYOUT_TABLE, selectedPayoutId, { "Status": newPayoutStatus });
      setSuccess(`✓ Payout status updated to ${newPayoutStatus}!`);
      setTimeout(() => setSuccess(""), 4000);
      resetForm(); loadData();
    } catch (e) { setErr("Failed: " + e.message); }
    setSubmitting(false);
  }

  async function handleReceivePayout() {
    if (!selectedPayoutId || !receivedAmount || !postPayoutBalance || !postPayoutStageId) return;
    setSubmitting(true); setErr(null);
    try {
      const payout = payouts.find(r => r.id === selectedPayoutId);
      const numAccts = payout?.fields["Number of Accounts"] || 1;
      const amtPerAcct = parseFloat(receivedAmount) / numAccts;
      // Update payout record
      const tierPct = parseFloat(payoutTierInput) || 50;
      await updateRecord(PAYOUT_TABLE, selectedPayoutId, {
        "Status": "Received",
        "Date Received": receivedDate,
        "Amount Per Account": amtPerAcct,
        "Payout Tier": tierPct / 100,
      });
      // Update perf account: new balance, stage, back to Active
      if (payoutPerfId) {
        const stage = payoutStrategies.find(s => s.id === postPayoutStageId);
        await updateRecord(PERF_TABLE, payoutPerfId, {
          "Status": "Active",
          "Current Balance": parseFloat(postPayoutBalance),
          "High Water Mark": parseFloat(postPayoutBalance),
          "Cycle Start Balance": parseFloat(postPayoutBalance),
          "Current Stage": [postPayoutStageId],
          "Trading Days this Cycle": 0,
          "Number of Payouts Recieved": (payoutPerf?.fields["Number of Payouts Recieved"] || 0) + 1,
        });
      }
      setSuccess("✓ Payout received, account back to Active!");
      setTimeout(() => setSuccess(""), 4000);
      resetForm(); loadData();
    } catch (e) { setErr("Failed: " + e.message); }
    setSubmitting(false);
  }

  const label = (text) => (
    <div style={{ fontSize: 11, fontWeight: 600, color: "#9ca3af", marginBottom: 5, textTransform: "uppercase", letterSpacing: 0.5 }}>{text}</div>
  );

  const TabBtn = ({ id, children }) => (
    <button onClick={() => { setActiveTab(id); resetForm(); }} style={subTabStyle(activeTab === id)}>
      {children}
    </button>
  );

  const statusColor = { "Requested": "#f59e0b", "Processing": "#3b82f6", "Approved": "#8b5cf6", "Received": "#22c55e" };

  // Group payouts by status for display
  const payoutsByStatus = PAYOUT_STATUSES.slice(0, 3).reduce((acc, s) => {
    acc[s] = payouts.filter(p => p.fields["Status"] === s);
    return acc;
  }, {});

  return (
    <div style={{ display: "grid", gridTemplateColumns: "440px 1fr", gap: 20, alignItems: "start" }}>
      <div>
        {/* Sub tabs */}
        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          <TabBtn id="passed_evals">📈 Passed Evals</TabBtn>
          <TabBtn id="stage_mgmt">🎯 Stages</TabBtn>
          <TabBtn id="payouts">💰 Payouts</TabBtn>
          <TabBtn id="create_payout">➕ Create Payout</TabBtn>
        </div>

        {/* Trader pills — outside the card */}
        {activeTab === "create_payout" ? (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
            {traderList.map(t => {
              const active = cpTrader === t.id;
              return (
                <button key={t.id} onClick={() => setCpTrader(active ? "" : t.id)}
                  style={{ background: active ? "#1f3a5f" : "#18222f", color: active ? "#7dd3fc" : "#888", border: `1px solid ${active ? "#3b82f6" : "#2a3442"}`, borderRadius: 999, padding: "4px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}>
                  {t.preferredName}
                </button>
              );
            })}
          </div>
        ) : (() => {
          const countMap = activeTab === "passed_evals" ? evalCountsByTrader : activeTab === "stage_mgmt" ? perfCountsByTrader : payoutCountsByTrader;
          const visible = traderList.filter(t => (countMap[t.id] || 0) > 0);
          return (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
              {visible.map(t => {
                const active = traderId === t.id;
                return (
                  <button key={t.id} onClick={() => { setTraderId(active ? "" : t.id); resetForm(); }}
                    style={{ background: active ? "#1f3a5f" : "#18222f", color: active ? "#7dd3fc" : "#888", border: `1px solid ${active ? "#3b82f6" : "#2a3442"}`, borderRadius: 999, padding: "4px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}>
                    {t.preferredName} ({countMap[t.id]})
                  </button>
                );
              })}
            </div>
          );
        })()}

      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 20 }}>

        {err && <div style={{ background: "#450a0a", border: "1px solid #7f1d1d", color: "#fca5a5", padding: "8px 12px", borderRadius: 8, fontSize: 12, marginBottom: 14 }}>{err}</div>}
        {success && <div style={{ background: "#052e16", border: "1px solid #166534", color: "#4ade80", padding: "8px 12px", borderRadius: 8, fontSize: 12, marginBottom: 14 }}>{success}</div>}

        {/* ── PASSED EVALS ── */}
        {activeTab === "passed_evals" && (
          <>
            {label("Select Active Eval Account")}
            {loading ? <div style={{ color: "#6b7280", fontSize: 12, marginBottom: 16 }}>Loading...</div> : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
                {evalAccounts.length === 0
                  ? <div style={{ color: "#6b7280", fontSize: 12 }}>No active eval accounts{traderId ? " for this trader" : ""}.</div>
                  : evalAccounts.map(r => {
                      const etId = Array.isArray(r.fields["Evaluation Account Type"]) ? r.fields["Evaluation Account Type"][0] : null;
                      const ptId = etId ? evalToPerfMap?.[etId] : null;
                      const pt = ptId ? perfTypes.find(t => t.id === ptId) : null;
                      return (
                        <div key={r.id} onClick={() => { setSelectedEvalId(r.id); if (pt) setStartingBalance(pt.accountSize.toString()); setNumAccounts(r.fields["Number of Accounts"] || 1); setContractMultiplier(r.fields["Contract Multiplier"] || 1); }}
                          style={{ background: selectedEvalId === r.id ? "#2d1b69" : "#111827", border: `1px solid ${selectedEvalId === r.id ? "#8b5cf6" : "#2d3f50"}`, borderRadius: 8, padding: "10px 14px", cursor: "pointer" }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: "#fff" }}>{r.fields["Name"]}</div>
                          <div style={{ fontSize: 11, color: "#6b7280", marginTop: 2 }}>
                            → {pt?.name || "Unknown perf type"} · ×{r.fields["Number of Accounts"]}
                          </div>
                        </div>
                      );
                    })
                }
              </div>
            )}

            {selectedEvalId && perfType && (
              <>
                <div style={{ background: "#111827", border: "1px solid #8b5cf6", borderRadius: 8, padding: "10px 14px", marginBottom: 16 }}>
                  <div style={{ fontSize: 11, color: "#a78bfa", fontWeight: 700, marginBottom: 4 }}>Will create:</div>
                  <div style={{ fontSize: 12, color: "#e5e7eb" }}>{perfType.name}</div>
                  <div style={{ fontSize: 11, color: "#6b7280" }}>Account Size: {$$(perfType.accountSize)}</div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
                  <div>
                    {label("Date Activated")}
                    <input type="date" value={dateActivated} onChange={e => setDateActivated(e.target.value)} style={inp} />
                  </div>
                  <div>
                    {label("# of Accounts")}
                    <input type="number" min="1" value={numAccounts} onChange={e => setNumAccounts(e.target.value)} style={inp} />
                  </div>
                  <div>
                    {label("Starting Balance")}
                    <input type="number" value={startingBalance} onChange={e => setStartingBalance(e.target.value)} style={inp} />
                  </div>
                  <div>
                    {label("Activation Fee Per Account")}
                    <input type="number" placeholder="0.00" value={activationFee} onChange={e => setActivationFee(e.target.value)} style={inp} />
                  </div>
                  <div>
                    {label("Contract Multiplier")}
                    <input type="number" min="1" placeholder="1" value={contractMultiplier} onChange={e => setContractMultiplier(e.target.value)} style={inp} />
                  </div>
                  <div style={{ gridColumn: "1/-1" }}>
                    {label("Account Number (optional)")}
                    <input type="text" placeholder="e.g. ABC123" value={perfAccountNumber} onChange={e => setPerfAccountNumber(e.target.value)} style={inp} />
                  </div>
                </div>

                <button onClick={handleConvertEval} disabled={!startingBalance || submitting}
                  style={{ width: "100%", background: startingBalance ? "#7c3aed" : "#111827", color: startingBalance ? "#fff" : "#4b5563", border: "none", borderRadius: 8, padding: "10px", fontSize: 14, fontWeight: 700, cursor: startingBalance ? "pointer" : "not-allowed" }}>
                  {submitting ? "Converting..." : "✓ Convert to Performance Account"}
                </button>
              </>
            )}
          </>
        )}

        {/* ── STAGE MANAGEMENT ── */}
        {activeTab === "stage_mgmt" && (
          <>
            {label("Select Performance Account")}
            {loading ? <div style={{ color: "#6b7280", fontSize: 12, marginBottom: 16 }}>Loading...</div> : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
                {perfAccounts.filter(r => r.fields["Status"] !== "Waiting on Payout").length === 0
                  ? <div style={{ color: "#6b7280", fontSize: 12 }}>No active performance accounts{traderId ? " for this trader" : ""}.</div>
                  : perfAccounts.filter(r => r.fields["Status"] !== "Waiting on Payout").map(r => {
                      const stageId = Array.isArray(r.fields["Current Stage"]) ? r.fields["Current Stage"][0] : null;
                      const stage = payoutStrategies.find(s => s.id === stageId);
                      return (
                        <div key={r.id} onClick={() => { setSelectedPerfId(r.id); setStageAction(""); setContractMultiplier(r.fields["Contract Multiplier"] || 1); }}
                          style={{ background: selectedPerfId === r.id ? "#1e3a5f" : "#111827", border: `1px solid ${selectedPerfId === r.id ? "#3b82f6" : "#2d3f50"}`, borderRadius: 8, padding: "10px 14px", cursor: "pointer" }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: "#fff" }}>{r.fields["Name"]}</div>
                          <div style={{ fontSize: 11, color: "#6b7280", marginTop: 2 }}>
                            {stage ? `Stage ${stage.stage} · Target ${$$(stage.target)}` : "No stage"} · {$$(r.fields["Current Balance"])}
                          </div>
                        </div>
                      );
                    })
                }
              </div>
            )}

            {selectedPerfId && !stageAction && (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {nextStage && (
                  <div onClick={() => setStageAction("advance")}
                    style={{ background: "#111827", border: "1px solid #2d3f50", borderRadius: 10, padding: "12px 16px", cursor: "pointer", display: "flex", alignItems: "center", gap: 12 }}>
                    <span style={{ fontSize: 22 }}>⬆️</span>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "#4ade80" }}>Advance to Stage {nextStage.stage}</div>
                      <div style={{ fontSize: 11, color: "#6b7280" }}>Target: {$$(nextStage.target)}</div>
                    </div>
                  </div>
                )}
                <div onClick={() => setStageAction("payout")}
                  style={{ background: "#111827", border: "1px solid #2d3f50", borderRadius: 10, padding: "12px 16px", cursor: "pointer", display: "flex", alignItems: "center", gap: 12 }}>
                  <span style={{ fontSize: 22 }}>💰</span>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#f59e0b" }}>Request Payout</div>
                    <div style={{ fontSize: 11, color: "#6b7280" }}>Mark as Waiting on Payout + log payout record</div>
                  </div>
                </div>
              </div>
            )}

            {selectedPerfId && stageAction === "advance" && nextStage && (
              <>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
                  <button onClick={() => setStageAction("")} style={{ background: "none", border: "none", color: "#6b7280", cursor: "pointer", fontSize: 18, padding: 0 }}>←</button>
                  <span style={{ fontSize: 13, fontWeight: 600, color: "#4ade80" }}>Advance to Stage {nextStage.stage}</span>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
                  <div>
                    {label("New Balance")}
                    <input type="number" placeholder="Enter new balance..." value={newBalance} onChange={e => setNewBalance(e.target.value)} style={inp} />
                  </div>
                  <div>
                    {label("Contract Multiplier")}
                    <input type="number" min="1" placeholder="1" value={contractMultiplier} onChange={e => setContractMultiplier(e.target.value)} style={inp} />
                  </div>
                  <div style={{ gridColumn: "1/-1" }}>
                    {label("Payout Amount Received (optional)")}
                    <input type="number" placeholder="Enter total payout received..." value={advancePayoutAmount} onChange={e => setAdvancePayoutAmount(e.target.value)} style={inp} />
                  </div>
                  <div style={{ gridColumn: "1/-1" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                      <input type="checkbox" id="resetDays" checked={resetTradingDays} onChange={e => setResetTradingDays(e.target.checked)} style={{ width: 16, height: 16, cursor: "pointer" }} />
                      <label htmlFor="resetDays" style={{ fontSize: 12, color: "#9ca3af", cursor: "pointer" }}>Reset Trading Days</label>
                    </div>
                    <input type="number" placeholder={resetTradingDays ? "Starting days (0 if blank)" : "Days to carry over..."} value={tradingDays} onChange={e => setTradingDays(e.target.value)} style={inp} />
                  </div>
                </div>
                {/* Trade Down section */}
                <div style={{ marginTop: 12 }}>
                  <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                    <input type="checkbox" checked={tradeDown} onChange={e => setTradeDown(e.target.checked)}
                      style={{ width: 16, height: 16, cursor: "pointer" }} />
                    <span style={{ fontSize: 13, color: "#d1d5db" }}>Trade Down Account</span>
                  </label>
                </div>
                <button onClick={handleStageAdvance} disabled={!newBalance || submitting}
                  style={{ width: "100%", background: newBalance ? "#16a34a" : "#111827", color: newBalance ? "#fff" : "#4b5563", border: "none", borderRadius: 8, padding: "10px", fontSize: 14, fontWeight: 700, cursor: newBalance ? "pointer" : "not-allowed" }}>
                  {submitting ? "Saving..." : `Advance to Stage ${nextStage.stage}`}
                </button>
              </>
            )}

            {selectedPerfId && stageAction === "payout" && (
              <>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
                  <button onClick={() => setStageAction("")} style={{ background: "none", border: "none", color: "#6b7280", cursor: "pointer", fontSize: 18, padding: 0 }}>←</button>
                  <span style={{ fontSize: 13, fontWeight: 600, color: "#f59e0b" }}>Request Payout</span>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
                  <div>
                    {label("Date Requested")}
                    <input type="date" value={payoutDateRequested} onChange={e => setPayoutDateRequested(e.target.value)} style={inp} />
                  </div>
                  <div>
                    {label("Number of Accounts")}
                    <input type="number" min="1" placeholder="Auto" value={payoutNumAccounts} onChange={e => setPayoutNumAccounts(e.target.value)} style={inp} />
                  </div>
                </div>
                <div style={{ marginBottom: 14 }}>
                  <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                    <input type="checkbox" checked={payoutTradeDown} onChange={e => setPayoutTradeDown(e.target.checked)}
                      style={{ width: 16, height: 16, cursor: "pointer" }} />
                    <span style={{ fontSize: 13, color: "#d1d5db" }}>Trade Down Account</span>
                  </label>
                </div>
                <div style={{ background: "#2d1f00", border: "1px solid #f59e0b", borderRadius: 8, padding: "10px 12px", marginBottom: 14 }}>
                  <div style={{ fontSize: 11, color: "#fde68a" }}>• Sets account to "Waiting on Payout"</div>
                  <div style={{ fontSize: 11, color: "#fde68a" }}>• Creates a Payout record with status "Requested"</div>
                  <div style={{ fontSize: 10, color: "#92400e", marginTop: 5 }}>When received, go to Payout Management to log the amount and advance the stage.</div>
                </div>
                <button onClick={handleRequestPayout} disabled={submitting}
                  style={{ width: "100%", background: "#d97706", color: "#fff", border: "none", borderRadius: 8, padding: "10px", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
                  {submitting ? "Saving..." : "Request Payout"}
                </button>
              </>
            )}
          </>
        )}

        {/* ── PAYOUT MANAGEMENT ── */}
        {activeTab === "payouts" && (
          <>
            {loading ? <div style={{ color: "#6b7280", fontSize: 12, marginBottom: 16 }}>Loading...</div> : (
              <>
                {payouts.length === 0
                  ? <div style={{ color: "#6b7280", fontSize: 12 }}>No pending payouts{traderId ? " for this trader" : ""}.</div>
                  : Object.entries(payoutsByStatus).map(([status, items]) => items.length === 0 ? null : (
                    <div key={status} style={{ marginBottom: 20 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                        <div style={{ width: 8, height: 8, borderRadius: "50%", background: statusColor[status] }} />
                        <span style={{ fontSize: 12, fontWeight: 700, color: statusColor[status] }}>{status}</span>
                        <span style={{ fontSize: 10, color: "#4b5563" }}>({items.length})</span>
                      </div>
                      {items.map(p => (
                        <div key={p.id} onClick={() => { setSelectedPayoutId(p.id); setPayoutAction(""); setNewPayoutStatus(""); }}
                          style={{ background: selectedPayoutId === p.id ? "#1e3a5f" : "#111827", border: `1px solid ${selectedPayoutId === p.id ? statusColor[status] : "#2d3f50"}`, borderRadius: 8, padding: "10px 14px", cursor: "pointer", marginBottom: 8 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: "#fff" }}>{p.fields["Name"]}</div>
                          <div style={{ fontSize: 11, color: "#6b7280", marginTop: 2 }}>
                            Requested: {p.fields["Date Requested"] || "—"} · Accounts: ×{p.fields["Number of Accounts"] || 1}
                          </div>
                        </div>
                      ))}
                    </div>
                  ))
                }

                {selectedPayoutId && !payoutAction && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 8 }}>
                    <div onClick={() => setPayoutAction("status")}
                      style={{ background: "#111827", border: "1px solid #2d3f50", borderRadius: 10, padding: "12px 16px", cursor: "pointer", display: "flex", alignItems: "center", gap: 12 }}>
                      <span style={{ fontSize: 20 }}>🔄</span>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: "#93c5fd" }}>Update Status</div>
                        <div style={{ fontSize: 11, color: "#6b7280" }}>Move between Requested / Processing / Approved</div>
                      </div>
                    </div>
                    <div onClick={() => setPayoutAction("receive")}
                      style={{ background: "#111827", border: "1px solid #2d3f50", borderRadius: 10, padding: "12px 16px", cursor: "pointer", display: "flex", alignItems: "center", gap: 12 }}>
                      <span style={{ fontSize: 20 }}>✅</span>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: "#4ade80" }}>Mark as Received</div>
                        <div style={{ fontSize: 11, color: "#6b7280" }}>Log amount, set new balance, advance stage</div>
                      </div>
                    </div>
                  </div>
                )}

                {selectedPayoutId && payoutAction === "status" && (
                  <>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16, marginTop: 8 }}>
                      <button onClick={() => setPayoutAction("")} style={{ background: "none", border: "none", color: "#6b7280", cursor: "pointer", fontSize: 18, padding: 0 }}>←</button>
                      <span style={{ fontSize: 13, fontWeight: 600, color: "#93c5fd" }}>Update Status</span>
                    </div>
                    {label("New Status")}
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
                      {["Requested", "Processing", "Approved"].map(s => (
                        <button key={s} onClick={() => setNewPayoutStatus(s)}
                          style={{ background: newPayoutStatus === s ? statusColor[s] : "#111827", color: newPayoutStatus === s ? "#fff" : "#9ca3af", border: `1px solid ${newPayoutStatus === s ? statusColor[s] : "#2d3f50"}`, borderRadius: 6, padding: "6px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                          {s}
                        </button>
                      ))}
                    </div>
                    <button onClick={handleUpdatePayoutStatus} disabled={!newPayoutStatus || submitting}
                      style={{ width: "100%", background: newPayoutStatus ? "#1d4ed8" : "#111827", color: newPayoutStatus ? "#fff" : "#4b5563", border: "none", borderRadius: 8, padding: "10px", fontSize: 14, fontWeight: 700, cursor: newPayoutStatus ? "pointer" : "not-allowed" }}>
                      {submitting ? "Saving..." : "Update Status"}
                    </button>
                  </>
                )}

                {selectedPayoutId && payoutAction === "receive" && (
                  <>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16, marginTop: 8 }}>
                      <button onClick={() => setPayoutAction("")} style={{ background: "none", border: "none", color: "#6b7280", cursor: "pointer", fontSize: 18, padding: 0 }}>←</button>
                      <span style={{ fontSize: 13, fontWeight: 600, color: "#4ade80" }}>Mark as Received</span>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
                      <div>
                        {label("Date Received")}
                        <input type="date" value={receivedDate} onChange={e => setReceivedDate(e.target.value)} style={inp} />
                      </div>
                      <div>
                        {label("Total Amount Received")}
                        <input type="number" placeholder="e.g. 4500" value={receivedAmount} onChange={e => setReceivedAmount(e.target.value)} style={inp} />
                      </div>
                      <div>
                        {label("Payout Tier %")}
                        <input type="number" min="0" max="100" placeholder="50" value={payoutTierInput} onChange={e => setPayoutTierInput(e.target.value)} style={inp} />
                      </div>
                      <div style={{ gridColumn: "1/-1" }}>
                        {label("New Account Balance After Payout")}
                        <input type="number" placeholder="e.g. 101200" value={postPayoutBalance} onChange={e => setPostPayoutBalance(e.target.value)} style={inp} />
                      </div>
                      <div style={{ gridColumn: "1/-1" }}>
                        {label("Advance to Stage")}
                        <select value={postPayoutStageId} onChange={e => setPostPayoutStageId(e.target.value)} style={sel}>
                          <option value="">Select next stage...</option>
                          {payoutAvailableStages.map(s => (
                            <option key={s.id} value={s.id}>Stage {s.stage} (Target: {$$(s.target)})</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <button onClick={handleReceivePayout} disabled={!receivedAmount || !postPayoutBalance || !postPayoutStageId || submitting}
                      style={{ width: "100%", background: (receivedAmount && postPayoutBalance && postPayoutStageId) ? "#16a34a" : "#111827", color: (receivedAmount && postPayoutBalance && postPayoutStageId) ? "#fff" : "#4b5563", border: "none", borderRadius: 8, padding: "10px", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
                      {submitting ? "Saving..." : "✓ Mark Received & Advance Stage"}
                    </button>
                  </>
                )}
              </>
            )}
          </>
        )}
      </div>
      </div>

      {/* Right info panel */}
      <div>
        {activeTab === "passed_evals" && selectedEval && (
          <div style={{ background: C.card, border: "1px solid #8b5cf6", borderRadius: 12, padding: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#a78bfa", marginBottom: 12 }}>Eval Account</div>
            {[
              ["Name", selectedEval.fields["Name"]],
              ["Balance", $$(selectedEval.fields["Current Balance"])],
              ["DD Left", $$(selectedEval.fields["Current Drawdown Left"])],
              ["Accounts", `×${selectedEval.fields["Number of Accounts"]}`],
              ["→ Perf Type", perfType?.name || "Unknown"],
            ].map(([k, v]) => (
              <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid #2d3f50" }}>
                <span style={{ fontSize: 12, color: "#6b7280" }}>{k}</span>
                <span style={{ fontSize: 12, fontWeight: 600, color: "#fff" }}>{v}</span>
              </div>
            ))}
          </div>
        )}

        {activeTab === "stage_mgmt" && selectedPerf && (
          <div style={{ background: C.card, border: "1px solid #3b82f6", borderRadius: 12, padding: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#60a5fa", marginBottom: 12 }}>Performance Account</div>
            {[
              ["Name", selectedPerf.fields["Name"]],
              ["Status", selectedPerf.fields["Status"]],
              ["Balance", $$(selectedPerf.fields["Current Balance"])],
              ["DD Left", $$(selectedPerf.fields["Current Drawdown Left"])],
              ["Current Stage", currentStage ? `Stage ${currentStage.stage}` : "—"],
              ["Stage Target", currentStage ? $$(currentStage.target) : "—"],
              ["Next Stage", nextStage ? `Stage ${nextStage.stage} (${$$(nextStage.target)})` : "Final"],
              ["Trading Days", selectedPerf.fields["Trading Days this Cycle"] || 0],
              ["Accounts", `×${selectedPerf.fields["Number of Accounts"]}`],
            ].map(([k, v]) => (
              <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid #2d3f50" }}>
                <span style={{ fontSize: 12, color: "#6b7280" }}>{k}</span>
                <span style={{ fontSize: 12, fontWeight: 600, color: "#fff" }}>{v}</span>
              </div>
            ))}
          </div>
        )}

        {/* ── CREATE NEW PAYOUT ── */}
        {activeTab === "create_payout" && (
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 20 }}>
            {err && <div style={{ background: "#450a0a", border: "1px solid #7f1d1d", color: "#fca5a5", padding: "8px 12px", borderRadius: 8, fontSize: 12, marginBottom: 14 }}>{err}</div>}
            {success && <div style={{ background: "#052e16", border: "1px solid #166534", color: "#4ade80", padding: "8px 12px", borderRadius: 8, fontSize: 12, marginBottom: 14 }}>{success}</div>}

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
              <div style={{ gridColumn: "1/-1" }}>
                {label("Performance Account Type")}
                <select value={cpPerfTypeId} onChange={e => { setCpPerfTypeId(e.target.value); setCpStageId(""); }} style={sel}>
                  <option value="">Select type...</option>
                  {perfTypes.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
              <div>
                {label("Date Requested")}
                <input type="date" value={cpDateRequested} onChange={e => setCpDateRequested(e.target.value)} style={inp} />
              </div>
              <div>
                {label("Date Received (optional)")}
                <input type="date" value={cpDateReceived} onChange={e => setCpDateReceived(e.target.value)} style={inp} />
              </div>
              <div>
                {label("Amount Per Account")}
                <input type="number" placeholder="e.g. 1500" value={cpAmountPerAccount} onChange={e => setCpAmountPerAccount(e.target.value)} style={inp} />
              </div>
              <div>
                {label("Number of Accounts")}
                <input type="number" min="1" value={cpNumAccounts} onChange={e => setCpNumAccounts(e.target.value)} style={inp} />
              </div>
              <div>
                {label("Status")}
                <select value={cpStatus} onChange={e => setCpStatus(e.target.value)} style={sel}>
                  {PAYOUT_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                {label("Payout Tier %")}
                <input type="number" min="0" max="100" placeholder="50" value={cpTier} onChange={e => setCpTier(e.target.value)} style={inp} />
              </div>
              <div style={{ gridColumn: "1/-1" }}>
                {label("Notes (optional)")}
                <textarea value={cpNotes} onChange={e => setCpNotes(e.target.value)} rows={2}
                  style={{ ...inp, resize: "vertical", fontFamily: "inherit" }} />
              </div>
            </div>

            <button onClick={handleCreatePayout} disabled={submitting || !cpTrader || !cpPerfTypeId || !cpAmountPerAccount}
              style={{ width: "100%", background: (cpTrader && cpPerfTypeId && cpAmountPerAccount) ? "#16a34a" : "#111827", color: (cpTrader && cpPerfTypeId && cpAmountPerAccount) ? "#fff" : "#4b5563", border: "none", borderRadius: 8, padding: "10px", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
              {submitting ? "Saving..." : "✓ Create Payout Record"}
            </button>
          </div>
        )}

        {activeTab === "payouts" && selectedPayout && (
          <div style={{ background: C.card, border: `1px solid ${statusColor[selectedPayout.fields["Status"]] || "#2d3f50"}`, borderRadius: 12, padding: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: statusColor[selectedPayout.fields["Status"]] || "#fff", marginBottom: 12 }}>Payout Details</div>
            {[
              ["Name", selectedPayout.fields["Name"]],
              ["Status", selectedPayout.fields["Status"]],
              ["Date Requested", selectedPayout.fields["Date Requested"] || "—"],
              ["Accounts", `×${selectedPayout.fields["Number of Accounts"] || 1}`],
              ["Perf Account", payoutPerf?.fields["Name"] || "—"],
              ["Current Balance", payoutPerf ? $$(payoutPerf.fields["Current Balance"]) : "—"],
            ].map(([k, v]) => (
              <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid #2d3f50" }}>
                <span style={{ fontSize: 12, color: "#6b7280" }}>{k}</span>
                <span style={{ fontSize: 12, fontWeight: 600, color: "#fff" }}>{v}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
  
// ── Advance Day Modal ─────────────────────────────────────────────────────────

function AdvanceDayModal({ accounts, onConfirm, onCancel }) {
  const [overrides, setOverrides] = useState(() =>
    Object.fromEntries(accounts.map(a => [a.id, a.override]))
  );

  function toggle(id) {
    setOverrides(prev => ({ ...prev, [id]: !prev[id] }));
  }

  const confirmed = accounts.map(a => ({ ...a, override: overrides[a.id] }));

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ background: "#111827", border: "1px solid #374151", borderRadius: 14, padding: 24, width: 480, maxWidth: "95vw", maxHeight: "80vh", display: "flex", flexDirection: "column" }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: "#f59e0b", marginBottom: 6 }}>⏭ Advance to Next Day</div>
        <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 16 }}>Review which accounts will have their trading day count incremented. Toggle to override.</div>
        <div style={{ overflowY: "auto", flex: 1, marginBottom: 16 }}>
          {accounts.length === 0 && (
            <div style={{ color: "#6b7280", fontSize: 13, textAlign: "center", padding: "20px 0" }}>No accounts with balance entered.</div>
          )}
          {accounts.map(a => (
            <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderBottom: "1px solid #1f2937" }}>
              <input type="checkbox" checked={!!overrides[a.id]} onChange={() => toggle(a.id)} style={{ width: 16, height: 16, accentColor: "#f59e0b", cursor: "pointer" }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#e5e7eb" }}>{a.name}</div>
                <div style={{ fontSize: 11, color: a.accountType === "perf" ? "#6366f1" : "#f59e0b", marginTop: 1, textTransform: "uppercase", letterSpacing: 1 }}>
                  {a.accountType === "perf" ? "Performance" : "Evaluation"}
                </div>
                <div style={{ fontSize: 11, color: overrides[a.id] ? "#4ade80" : "#6b7280", marginTop: 2 }}>{a.reason}</div>
              </div>
              <div style={{ fontSize: 11, color: "#6b7280" }}>Day {(a.tradingDays || 0) + (overrides[a.id] ? 1 : 0)}</div>
            </div>
          ))}
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={onCancel} style={{ flex: 1, background: "#1f2937", border: "1px solid #374151", borderRadius: 8, padding: "9px", fontSize: 13, color: "#9ca3af", cursor: "pointer" }}>Cancel</button>
          <button onClick={() => onConfirm(confirmed)} style={{ flex: 1, background: "#d97706", border: "none", borderRadius: 8, padding: "9px", fontSize: 13, fontWeight: 700, color: "#fff", cursor: "pointer" }}>
            Confirm & Advance
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main App ──────────────────────────────────────────────────────────────────

export default function App() {
  const [perfAccounts, setPerfAccounts] = useState([]);
  const [evalAccounts, setEvalAccounts] = useState([]);
  const [inputs, setInputs] = useState({});
  const [noChanges, setNoChanges] = useState(() => {
    try {
      const saved = localStorage.getItem("tradingNoChanges");
      return saved ? JSON.parse(saved) : {};
    } catch { return {}; }
  });
  const [dones, setDones] = useState(() => {
    try {
      const saved = localStorage.getItem("tradingDones");
      return saved ? JSON.parse(saved) : {};
    } catch { return {}; }
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [breachAccount, setBreachAccount] = useState(null);
  const [breachCount, setBreachCount] = useState("");
  const [breachSubmitting, setBreachSubmitting] = useState(false);
  const [showAdvanceDayModal, setShowAdvanceDayModal] = useState(false);
  const [advanceDayAccounts, setAdvanceDayAccounts] = useState([]);
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState(null);
  const [tab, setTab] = useState("snapshot");
  useEffect(() => { load(); }, []);

  function advanceDay() {
    const perfItems = perfAccounts
      .filter(a => inputs[a.id] && !noChanges[a.id] && !["Failed", "Passed", "Waiting on Payout"].includes(a.status))
      .map(a => {
        const newBal = parseFloat(inputs[a.id]);
        const dailyChange = newBal - a.bal;
        const type = a.tradingDayType;
        const minProfit = a.minProfitDay || 0;
        let qualifies = false;
        let reason = "";
        if (type === "Profitable Day") {
          qualifies = dailyChange >= minProfit;
          reason = qualifies
            ? `+$${dailyChange.toFixed(0)} ≥ min $${minProfit} ✓`
            : `$${dailyChange.toFixed(0)} < min $${minProfit} ✗`;
        } else {
          qualifies = dailyChange !== 0;
          reason = qualifies ? `Balance changed $${dailyChange >= 0 ? "+" : ""}${dailyChange.toFixed(0)} ✓` : "No change ✗";
        }
        return { ...a, accountType: "perf", newBal, dailyChange, qualifies, reason, override: qualifies };
      });

    const evalItems = evalAccounts
      .filter(a => inputs[a.id] && !noChanges[a.id] && a.status === "Active")
      .map(a => {
        const newBal = parseFloat(inputs[a.id]);
        const dailyChange = newBal - a.bal;
        const qualifies = dailyChange !== 0;
        const reason = qualifies ? `Balance changed $${dailyChange >= 0 ? "+" : ""}${dailyChange.toFixed(0)} ✓` : "No change ✗";
        return { ...a, accountType: "eval", newBal, dailyChange, qualifies, reason, override: qualifies };
      });

    setAdvanceDayAccounts([...perfItems, ...evalItems]);
    setShowAdvanceDayModal(true);
  }

  async function load() {
    setLoading(true); setErr(null); setSaved(false);
    try {
      let pr = [], er = [], traderRecs = [], firmRecs = [];
      try {
        traderRecs = await fetchTable("tbla0lbJ9z1PAhNy7", ["Name", "Preferred Name"]);
      } catch(e) {}
      const traderMap = {};
      traderRecs.forEach(r => {
        traderMap[r.id] = r.fields["Preferred Name"] || (r.fields["Name"] || "").split(" ")[0] || "";
      });

      try {
        firmRecs = await fetchTable("tblR0iLSQZI1xXYa6", ["Name"]);
      } catch(e) {}
      const firmMap = {};
      firmRecs.forEach(r => { firmMap[r.id] = r.fields["Name"] || ""; });

      try {
        pr = await fetchTable(PERF_TABLE, ["Name", "Status", "Number of Accounts", "Current Balance", "High Water Mark", "Current Drawdown Left", "Drawdown Safety", "Max Trade Size", "Trade Down Account", "Drawdown to Floor", "Contract Multiplier", "Data Provider", "Payout Account", "Performance Account Type", "Trading Day Type", "Min Profitable Day Amount", "Trading Days this Cycle", "Trading Days Left", "Cycle Start Balance", "Trader", "Score", "Firm Name", "Account Number", "Trading Day Definition", "Number of Payouts Recieved", "Daily Loss Limit", "Current Stage"]);
        console.log("raw perf records:", pr?.length, pr?.[0]);
      } catch(perfErr) {
        console.error("PERF FETCH ERROR:", perfErr);
      }
      try {
        er = await fetchTable(EVAL_TABLE, ["Name", "Status", "Number of Accounts", "Current Balance", "High Water Mark", "Current Drawdown Left", "Drawdown Safety", "Max Trade Size", "Progress to Target", "Data Provider", "Account Weight", "Evaluation Account Type", "Trading Days Completed", "Trading Days Left", "Trader", "Score", "Firm Name", "Account Number", "Trading Day Definition", "Date Started", "Daily Loss Limit"]);
        console.log("raw eval records:", er?.length, er?.[0]);
      } catch(evalErr) {
        console.error("EVAL FETCH ERROR:", evalErr);
      }


      let stratRecs = [];
      try { stratRecs = await fetchTable("tbljLby6v0o6fydOw", ["Stage Target"]); } catch(e) {}
      const stratMap = {};
      stratRecs.forEach(r => { stratMap[r.id] = r.fields["Stage Target"] || 0; });

      const activeStatuses = ["Active", "Live", "Waiting on Payout"];

      const resolveFirm = raw => {
        const val = Array.isArray(raw) ? raw[0] : raw;
        return firmMap[val] || val || "";
      };
      const firstName = full => (full || "").split(" ")[0];

      const mapPerf = r => {
        const f = r.fields;
        const dp = Array.isArray(f["Data Provider"]) ? f["Data Provider"][0] : (f["Data Provider"] || "Other");
        const traderId = Array.isArray(f["Trader"]) ? f["Trader"][0] : (f["Trader"] || "");
        return {
          id: r.id, type: "perf",
          name: f["Name"] || "?",
          traderName: firstName(traderMap[traderId]),
          firmName: resolveFirm(f["Firm Name"]),
          trader: traderId,
          status: f["Status"]?.name || f["Status"] || "",
          bal: f["Current Balance"] || 0,
          ddLeft: f["Current Drawdown Left"] || 0,
          ddToFloor: f["Drawdown to Floor"] || 0,
          prog: f["Progress to Stage Target"] || 0,
          limit: f["Max Trade Size"] || 0,
          n: f["Number of Accounts"] || 1,
          ddSafety: f["Drawdown Safety"] || 0,
          tradeDown: f["Trade Down Account"] || false,
          contractMultiplier: f["Contract Multiplier"] || 1,
          payoutAccount: f["Payout Account"] || false,
          dataProvider: dp,
          dailyTarget: 0,
          hwm: f["High Water Mark"] || 0,
          accountTypeId: (f["Performance Account Type"] || [])[0] || null,
          tradingDayType: (f["Trading Day Type"] || [])[0] || null,
          minProfitDay: (f["Min Profitable Day Amount"] || [])[0] || 0,
          tradingDays: f["Trading Days this Cycle"] || 0,
          tradingDaysLeft: f["Trading Days Left"] ?? null,
          cycleStartBal: f["Cycle Start Balance"] || 0,
          score: f["Score"] ?? null,
          accountNumber: f["Account Number"] || null,
          tradingDayDefinition: f["Trading Day Definition"] || null,
          numPayoutsReceived: f["Number of Payouts Recieved"] || 0,
          dailyLossLimit: f["Daily Loss Limit"] || null,
          currentStageId: (() => { const v = (f["Current Stage"] || [])[0]; return typeof v === "string" ? v : v?.id || null; })(),
          stageTarget: (() => { const v = (f["Current Stage"] || [])[0]; const sid = typeof v === "string" ? v : v?.id || null; return sid ? (stratMap[sid] || null) : null; })(),
        };
      };

      const mapEval = r => {
        const f = r.fields;
        const dp = Array.isArray(f["Data Provider"]) ? f["Data Provider"][0] : (f["Data Provider"] || "Other");
        const traderId = Array.isArray(f["Trader"]) ? f["Trader"][0] : (f["Trader"] || "");
        return {
          id: r.id, type: "eval",
          name: f["Name"] || "?",
          traderName: firstName(traderMap[traderId]),
          firmName: resolveFirm(f["Firm Name"]),
          trader: traderId,
          status: f["Status"]?.name || f["Status"] || "",
          bal: f["Current Balance"] || 0,
          ddLeft: f["Current Drawdown Left"] || 0,
          ddToFloor: 0,
          prog: f["Progress to Target"] || 0,
          limit: f["Max Trade Size"] || 0,
          n: f["Number of Accounts"] || 1,
          ddSafety: f["Drawdown Safety"] || 0,
          hwm: f["High Water Mark"] || 0,
          tradeDown: false,
          contractMultiplier: 1,
          payoutAccount: false,
          dataProvider: dp,
          dailyTarget: 0,
          accountWeight: Array.isArray(f["Account Weight"]) ? f["Account Weight"][0] : (f["Account Weight"] || null),
          accountTypeId: (() => { const v = (f["Evaluation Account Type"] || [])[0]; return typeof v === "string" ? v : v?.id || null; })(),
          accountTypeName: (() => { const v = (f["Evaluation Account Type"] || [])[0]; return typeof v === "object" ? v?.name || null : null; })(),
          tradingDays: f["Trading Days Completed"] || 0,
          tradingDaysLeft: f["Trading Days Left"] ?? null,
          score: f["Score"] ?? null,
          accountNumber: f["Account Number"] || null,
          tradingDayDefinition: f["Trading Day Definition"] || null,
          datePurchased: f["Date Started"] || null,
          dailyLossLimit: f["Daily Loss Limit"] || null,
        };
      };

      const allEvals = (er || []).filter(r => {
        const status = r.fields["Status"]?.name || r.fields["Status"];
        return status === "Active";
      });
      const allPerfs = (pr || []).filter(r => {
        const status = r.fields["Status"]?.name || r.fields["Status"];
        return ["Active", "Live", "Waiting on Payout"].includes(status);
      });
      const evals = allEvals.map(mapEval);
      const perfs = allPerfs.map(mapPerf);
      console.log("perfAccounts loaded:", perfs.length, perfs[0]);
      console.log("evalAccounts loaded:", evals.length, evals[0]);
      setEvalAccounts(evals);
      setPerfAccounts(perfs);
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
      const next = { ...prev, [id]: !prev[id] };
      if (next[id]) setInputs(p => ({ ...p, [id]: "" }));
      localStorage.setItem("tradingNoChanges", JSON.stringify(next));
      return next;
    });
  }, []);

  const onDone = useCallback((id) => {
    setDones(prev => {
      const next = { ...prev, [id]: !prev[id] };
      localStorage.setItem("tradingDones", JSON.stringify(next));
      return next;
    });
  }, []);

  const onBreach = useCallback((a) => {
    setBreachAccount(a);
    setBreachCount("");
  }, []);

  async function handleBreach(a) {
    const count = parseInt(breachCount);
    if (!count || count < 1 || count > a.n) return;
    setBreachSubmitting(true);
    try {
      const remaining = a.n - count;
      const tableId = a.type === "perf" ? PERF_TABLE : EVAL_TABLE;
      if (remaining === 0) {
        await updateRecord(tableId, a.id, { "Number of Accounts": 0, "Status": "Failed" });
        if (a.type === "perf") {
          const purchaseRes = await fetch(`/.netlify/functions/airtable/${BASE}/${PURCHASE_TABLE}?maxRecords=100`);
          const purchaseData = await purchaseRes.json();
          const related = (purchaseData.records || []).filter(r => {
            const pa = r.fields["Performance Account"];
            return Array.isArray(pa) && pa.includes(a.id) && r.fields["Status"] === "Active";
          });
          await Promise.all(related.map(r => updateRecord(PURCHASE_TABLE, r.id, { "Status": "Failed" })));
        }
      } else {
        await updateRecord(tableId, a.id, { "Number of Accounts": remaining });
      }
      setBreachAccount(null);
      setBreachCount("");
      await load();
    } catch (e) {}
    setBreachSubmitting(false);
  }
  async function save() {
    setSaving(true); setErr(null);
    try {
      const perfUpdates = perfAccounts.filter(a => inputs[a.id] !== "" && !isNaN(parseFloat(inputs[a.id])));
      const evalUpdates = evalAccounts.filter(a => inputs[a.id] !== "" && !isNaN(parseFloat(inputs[a.id])));
      await Promise.all([
        ...perfUpdates.map(a => {
          const newBal = parseFloat(inputs[a.id]);
          const fields = { "Current Balance": newBal };
          if (newBal > a.bal && newBal > (a.hwm || 0)) fields["High Water Mark"] = newBal;
          return updateRecord(PERF_TABLE, a.id, fields);
        }),
        ...evalUpdates.map(a => {
          const newBal = parseFloat(inputs[a.id]);
          const fields = { "Current Balance": newBal };
          if (newBal > a.bal && newBal > (a.hwm || 0)) fields["High Water Mark"] = newBal;
          return updateRecord(EVAL_TABLE, a.id, fields);
        }),
      ]);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      await load();
    } catch (e) {
      setErr("Save failed: " + e.message);
    }
    setSaving(false);
  }

  const standardPerf = perfAccounts.filter(a => !a.payoutAccount);
  const payoutAccounts = perfAccounts.filter(a => a.payoutAccount && a.status === "Active");
  const livePerf = perfAccounts.filter(a => a.payoutAccount && a.status === "Live");
  const waitingPayout = perfAccounts.filter(a => a.payoutAccount && a.status === "Waiting on Payout");
  const liveOrPayout = [...payoutAccounts, ...livePerf];
  const allAccounts = [...evalAccounts, ...perfAccounts];

  const gain = allAccounts.reduce((s, a) => { const v = parseFloat(inputs[a.id]); if (noChanges[a.id] || isNaN(v) || !inputs[a.id]) return s; const d = (v - a.bal) * a.n; return d > 0 ? s + d : s; }, 0);
  const loss = allAccounts.reduce((s, a) => { const v = parseFloat(inputs[a.id]); if (noChanges[a.id] || isNaN(v) || !inputs[a.id]) return s; const d = (v - a.bal) * a.n; return d < 0 ? s + d : s; }, 0);
  const net = gain + loss;
  const filledCount = Object.entries(inputs).filter(([, v]) => v !== "" && !isNaN(parseFloat(v))).length + Object.values(noChanges).filter(Boolean).length;


  const C = { bg: "#030712", card: "#111827", border: "#1f2937" };

  if (loading) return (
    <div style={{ minHeight: "100vh", background: C.bg, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "system-ui,sans-serif" }}>
      <div style={{ color: "#6b7280", fontSize: 15 }}>Loading...</div>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: "#f3f4f6", fontFamily: "system-ui,sans-serif" }}>
      <style>{`input[type=number]::-webkit-inner-spin-button{display:none} input[type=number]::-webkit-outer-spin-button{display:none} input[type=number]{-moz-appearance:textfield}`}</style>
      {breachAccount && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div style={{ background: "#111827", border: "1px solid #374151", borderRadius: 12, padding: 24, width: 340 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#fff", marginBottom: 6 }}>💥 Log Breach</div>
            <div style={{ fontSize: 13, color: "#9ca3af", marginBottom: 16 }}>{breachAccount.name} · {breachAccount.n} account{breachAccount.n > 1 ? "s" : ""}</div>
            <div style={{ fontSize: 11, fontWeight: 600, color: "#9ca3af", marginBottom: 6, textTransform: "uppercase" }}>How many accounts breached?</div>
            <input type="number" min="1" max={breachAccount.n} value={breachCount} onChange={e => setBreachCount(e.target.value)}
              placeholder={`1 - ${breachAccount.n}`}
              style={{ background: "#1f2937", border: "1px solid #374151", borderRadius: 8, padding: "8px 12px", fontSize: 14, color: "#fff", width: "100%", outline: "none", boxSizing: "border-box", marginBottom: 12 }} />
            {breachCount && parseInt(breachCount) === breachAccount.n && (
              <div style={{ background: "#450a0a", border: "1px solid #7f1d1d", borderRadius: 8, padding: "8px 12px", fontSize: 12, color: "#fca5a5", marginBottom: 12 }}>
                All accounts breached — status will be set to <strong>Failed</strong>
              </div>
            )}
            {breachCount && parseInt(breachCount) < breachAccount.n && parseInt(breachCount) > 0 && (
              <div style={{ background: "#1c1f2e", border: "1px solid #374151", borderRadius: 8, padding: "8px 12px", fontSize: 12, color: "#93c5fd", marginBottom: 12 }}>
                {breachAccount.n - parseInt(breachCount)} account{breachAccount.n - parseInt(breachCount) > 1 ? "s" : ""} remaining after breach
              </div>
            )}
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => { setBreachAccount(null); setBreachCount(""); }}
                style={{ flex: 1, background: "#1f2937", border: "1px solid #374151", borderRadius: 8, padding: "9px", fontSize: 13, color: "#9ca3af", cursor: "pointer" }}>
                Cancel
              </button>
              <button onClick={() => handleBreach(breachAccount)} disabled={!breachCount || parseInt(breachCount) < 1 || parseInt(breachCount) > breachAccount.n || breachSubmitting}
                style={{ flex: 1, background: breachCount && parseInt(breachCount) >= 1 ? "#dc2626" : "#1f2937", border: "none", borderRadius: 8, padding: "9px", fontSize: 13, fontWeight: 700, color: "#fff", cursor: "pointer" }}>
                {breachSubmitting ? "Saving..." : "Confirm Breach"}
              </button>
            </div>
          </div>
        </div>
      )}

      <div style={{ background: "#1f2a37", borderBottom: "1px solid #2d3f50", padding: "13px 20px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 700, color: "#fff" }}>📈 Daily Trading Dashboard</div>
          <div style={{ fontSize: 11, color: "#6b7280", marginTop: 1 }}>{new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}</div>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          {tab === "gameplan" && filledCount > 0 && <span style={{ fontSize: 12, color: "#60a5fa" }}>{filledCount} updated</span>}
          {showAdvanceDayModal && (
            <AdvanceDayModal
              accounts={advanceDayAccounts}
              onCancel={() => setShowAdvanceDayModal(false)}
              onConfirm={async (confirmed) => {
                setShowAdvanceDayModal(false);
                const toUpdate = confirmed.filter(a => a.override);
                await Promise.all(toUpdate.map(a => {
                  if (a.accountType === "perf") {
                    return updateRecord(PERF_TABLE, a.id, {
                      "Trading Days this Cycle": (a.tradingDays || 0) + 1
                    });
                  } else {
                    return updateRecord(EVAL_TABLE, a.id, {
                      "Trading Days Completed": (a.tradingDays || 0) + 1
                    });
                  }
                }));
                setNoChanges({});
                setInputs({});
                localStorage.removeItem("tradingNoChanges");
                await load();
              }}
            />
          )}
          <button onClick={() => { setDones({}); localStorage.removeItem("tradingDones"); load(); }} style={{ background: "#15803d", color: "#fff", border: "1px solid #22c55e", borderRadius: 8, padding: "8px 18px", fontSize: 13, cursor: "pointer", fontWeight: 700 }}>↻ Refresh</button>
          <button onClick={advanceDay} style={{ background: "#1f2937", border: "1px solid #374151", borderRadius: 8, padding: "6px 14px", fontSize: 12, color: "#4ade80", cursor: "pointer", fontWeight: 600 }}>⏭ Next Day</button>
        </div>
      </div>

      <div style={{ maxWidth: 1400, margin: "0 auto", padding: "16px 20px" }}>
        {err && <div style={{ background: "#450a0a", border: "1px solid #7f1d1d", color: "#fca5a5", padding: "10px 14px", borderRadius: 8, fontSize: 13, marginBottom: 12 }}>⚠ {err}</div>}


        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 20 }}>
          {[
            ["snapshot", "📷 Snapshot"],
            ["purchases", "🛒 Purchases"],
            ["mgmt", "🔄 Lifecycle"],
            ["accounts", "📋 Manage"],
            ["reconcile", "📊 Reconcile"],
            ["firms", "🏢 Firm Usage"],
            ["traderpl", "💹 Trader P&L"],
          ].map(([key, label]) => (
            <button key={key} onClick={() => setTab(key)}
              style={{ background: tab === key ? "#ffd700" : "#e5e5e5", color: "#000", border: `1px solid ${tab === key ? "#d4a800" : "#c8c8c8"}`, borderRadius: 8, padding: "7px 16px", fontSize: 13, fontWeight: tab === key ? 800 : 600, cursor: "pointer", whiteSpace: "nowrap" }}>
              {label}
            </button>
          ))}
        </div>

              {tab === "snapshot" && <SnapshotTab evalAccounts={evalAccounts} perfAccounts={perfAccounts} dones={dones} />}
              {tab === "purchases" && <PurchaseTab />}
              {tab === "mgmt" && <AccountManagementTab />}
              {tab === "accounts" && <AllAccountsTab evalAccounts={evalAccounts} perfAccounts={perfAccounts} dones={dones} onDone={onDone} />}
              {tab === "reconcile" && <PLTab evalAccounts={evalAccounts} perfAccounts={perfAccounts} />}
              {tab === "traderpl" && <TraderPLTab />}
              {tab === "firms" && <FirmUsageTab evalAccounts={evalAccounts} perfAccounts={perfAccounts} />}
            </div>
            </div>
        );
      }     