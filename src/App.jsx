import React, { useState, useEffect, useCallback, useMemo } from "react";

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
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message || `Airtable error ${res.status}`);
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

      <div style={{ width: 105, flexShrink: 0 }}>
        <div style={{ fontSize: 10, color: "#6b7280", marginBottom: 3 }}>Progress</div>
        <Bar prog={a.prog} />
      </div>

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
  const [traderId, setTraderId] = useState("");
  const [evalTypeList, setEvalTypeList] = useState([]);
  const [traderList, setTraderList] = useState([]);

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

  async function loadEvalTypes() {
    try {
      const evalTypes = await fetchTable(EVAL_TYPE_TABLE, ["Name", "Account Size", "Profit Target", "Drawdown Limit", "Daily Loss Limit", "Max Contracts"]);
      setEvalTypeList(evalTypes.map(r => ({ id: r.id, name: r.fields["Name"], accountSize: r.fields["Account Size"] || 0, cost: r.fields["Cost Per Account"] || 0 })).sort((a, b) => a.name.localeCompare(b.name)));
    } catch (e) {}
  }

  async function loadTraders() {
    console.log("[PurchaseTab] loadTraders called");
    try {
      const traders = await fetchTable(TRADERS_TABLE, ["Name"]);
      console.log("[PurchaseTab] traders fetched:", traders.length, traders.map(r => r.fields["Name"]));
      setTraderList(traders.map(r => ({ id: r.id, name: r.fields["Name"] })).sort((a, b) => a.name.localeCompare(b.name)));
    } catch (e) { console.error("[PurchaseTab] loadTraders error:", e); }
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
      if (Array.isArray(evalArr)) setSelectedEvalId(typeof evalArr[0] === "string" ? evalArr[0] : evalArr[0]?.id || "");
      setNumAccounts(p.fields["Number of Accounts"] || 1);
    }
  }

  function handleEvalTypeChange(typeId) {
    setEvalTypeId(typeId);
    const et = evalTypeList.find(t => t.id === typeId);
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
    setTraderId("");
  }

  const selectedPurchase = activePurchases.find(r => r.id === selectedPurchaseId);
  const selectedEvalType = evalTypeList.find(t => t.id === evalTypeId);
  const trader = selectedPurchase ? traderList.find(t => t.id === selectedPurchase.fields["Trader"]?.[0]?.id) : null;
  const totalCost = (parseFloat(costPer) || 0) * numAccounts;
  const canSubmit = mode && evalTypeId && costPer && date && numAccounts > 0 && (mode === "reset" ? selectedPurchaseId : traderId);
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
                {activePurchases.filter(r => {
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
              {label("Select Trader")}
              <select value={traderId} onChange={e => setTraderId(e.target.value)} style={sel}>
                <option value="">Choose trader...</option>
                {traderList.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>

            <div style={{ marginBottom: 16 }}>
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
function AllAccountsTab({ evalAccounts, perfAccounts, dones }) {
  const C = { bg: "#030712", card: "#111827", border: "#1f2937" };
  const standardPerf = perfAccounts.filter(a => !a.payoutAccount && a.status !== "Live");
  const livePerf = perfAccounts.filter(a => a.status === "Live" || a.payoutAccount);
  function getFeeds(accounts) {
    const feeds = {};
    accounts.slice().sort((a, b) => a.prog - b.prog).forEach(a => {
      const dp = a.dataProvider || "Other";
      if (!feeds[dp]) feeds[dp] = [];
      feeds[dp].push(a);
    });
    return feeds;
  }
  function AccountMiniCard({ a }) {
    return (
      <div style={{ background: C.card, border: `1px solid ${dones[a.id] ? "#1a2030" : "#1f2937"}`, borderRadius: 7, padding: "5px 8px", marginBottom: 4, opacity: dones[a.id] ? 0.5 : 1 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: "#fff", marginBottom: 3, display: "flex", alignItems: "center", gap: 4 }}>
          <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{a.name}</span>
          {a.status === "Live" && <span style={{ fontSize: 9, fontWeight: 700, background: "#7f1d1d", color: "#fca5a5", padding: "1px 5px", borderRadius: 4, flexShrink: 0 }}>LIVE</span>}
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <span style={{ fontSize: 10, color: "#6b7280" }}>Bal <span style={{ color: "#fff" }}>{$$(a.bal)}</span></span>
          <span style={{ fontSize: 10, color: "#6b7280" }}>DD <span style={{ color: "#fde68a" }}>{$$(a.tradeDown ? a.ddToFloor : a.ddLeft)}</span></span>
          <span style={{ fontSize: 10, color: "#6b7280" }}>Prog <span style={{ color: "#a78bfa" }}>{(a.prog * 100).toFixed(0)}%</span></span>
          <span style={{ fontSize: 10, color: "#6b7280" }}>Tgt <span style={{ color: "#4ade80" }}>{$$(a.dailyTarget)}</span></span>
          {a.type === "eval" && a.accountWeight && <span style={{ fontSize: 10, color: "#6b7280" }}>Wt <span style={{ color: "#9ca3af" }}>{a.accountWeight}</span></span>}
          {a.contractMultiplier > 1 && <span style={{ fontSize: 10, color: "#6b7280" }}>Mx <span style={{ color: "#93c5fd" }}>{a.contractMultiplier}x</span></span>}
        </div>
      </div>
    );
  }
  function FeedGrid({ accounts, color, title }) {
    if (accounts.length === 0) return null;
    const feeds = getFeeds(accounts);
    const feedNames = Object.keys(feeds).sort();
    return (
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
          <div style={{ width: 3, height: 16, background: color, borderRadius: 99 }} />
          <span style={{ fontSize: 13, fontWeight: 700, color: "#e5e7eb" }}>{title}</span>
          <span style={{ background: "#1f2937", color: "#9ca3af", fontSize: 10, padding: "1px 6px", borderRadius: 99 }}>{accounts.length}</span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: `repeat(${Math.min(feedNames.length, 4)}, 1fr)`, gap: 8 }}>
          {feedNames.map(feed => (
            <div key={feed}>
              <div style={{ fontSize: 10, fontWeight: 700, color: "#4b5563", textTransform: "uppercase", letterSpacing: 1, marginBottom: 5, paddingBottom: 3, borderBottom: "1px solid #1f2937" }}>{feed}</div>
              {feeds[feed].map(a => <AccountMiniCard key={a.id} a={a} />)}
            </div>
          ))}
        </div>
      </div>
    );
  }
  return (
    <div>
      <FeedGrid accounts={evalAccounts} color="#8b5cf6" title="Evaluation Accounts" />
      <FeedGrid accounts={standardPerf} color="#3b82f6" title="Performance Accounts" />
      <FeedGrid accounts={livePerf} color="#f59e0b" title="Live & Payout Accounts" />
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
            .filter(r => !["Failed", "Passed"].includes(r.fields["Status"]))
            .map(r => ({
              type: "eval",
              name: r.fields["Name"],
              status: r.fields["Status"],
              trader: traderIdMap[r.fields["Trader"]?.[0]] || r.fields["Trader"]?.[0] || "",
              n: r.fields["Number of Accounts"] || 1,
              firmName: fMap[r.fields["Firm Name"]?.[0]]?.fields["Name"] || null,
              payoutAccount: false,
            })),
          ...perfRecords
            .filter(r => !["Failed", "Passed"].includes(r.fields["Status"]))
            .map(r => ({
              type: "perf",
              name: r.fields["Name"],
              status: r.fields["Status"],
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

function PLTab({ evalAccounts, perfAccounts }) {
  const C = { bg: "#030712", card: "#111827", border: "#1f2937" };
  const [startingLiq, setStartingLiq] = useState("");
  const [purchases, setPurchases] = useState([]);
  const [payouts, setPayouts] = useState([]);
  const [loading, setLoading] = useState(true);

  const localToday = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };
  const [selectedDate, setSelectedDate] = useState(localToday());

  const OTHER_TRADERS = ["rec0jB7J1Ir1ZspvM", "rec4l8EM9peAdyin4", "reccHyxv7emOGQJsQ", "recvSEg1nPtZCKujB"];
  const RITHMIC_DX = ["Rithmic", "DX Feed"];

  useEffect(() => { loadPLData(); }, [selectedDate]);

  async function loadPLData() {
    setLoading(true);
    try {
      const [purchaseRes, payoutRes] = await Promise.all([
        fetch(`/.netlify/functions/airtable/${BASE}/${PURCHASE_TABLE}?maxRecords=500`),
        fetch(`/.netlify/functions/airtable/${BASE}/${PAYOUT_TABLE}?maxRecords=500`),
      ]);
      const purchaseData = await purchaseRes.json();
      const payoutData = await payoutRes.json();
      setPurchases((purchaseData.records || []).filter(r => r.fields["Date Purchased"] === selectedDate));
      setPayouts((payoutData.records || []).filter(r => r.fields["Date Received"] === selectedDate));
    } catch (e) {}
    setLoading(false);
  }

  const activeEvals = evalAccounts;
  const nonPayoutPerf = perfAccounts.filter(a => !a.payoutAccount);
  const payoutPerf = perfAccounts.filter(a => a.payoutAccount);

  const rmcEvals = activeEvals.filter(a => RITHMIC_DX.includes(a.dataProvider)).reduce((s, a) => s + a.n, 0);
  const tdvEvals = activeEvals.filter(a => a.dataProvider === "Tradovate").reduce((s, a) => s + a.n, 0);
  const xEvals = activeEvals.filter(a => a.dataProvider === "Project X").reduce((s, a) => s + a.n, 0);
  const totalActiveEvals = rmcEvals + tdvEvals + xEvals;
  const investedEvals = activeEvals.reduce((s, a) => s + (a.invested * a.n || 0), 0);

  const rmcPerf = nonPayoutPerf.filter(a => RITHMIC_DX.includes(a.dataProvider)).reduce((s, a) => s + a.n, 0);
  const tdvPerf = nonPayoutPerf.filter(a => a.dataProvider === "Tradovate").reduce((s, a) => s + a.n, 0);
  const xPerf = nonPayoutPerf.filter(a => a.dataProvider === "Project X").reduce((s, a) => s + a.n, 0);
  const totalActivePerf = rmcPerf + tdvPerf + xPerf;
  const investedPerf = nonPayoutPerf.reduce((s, a) => s + (a.invested * a.n || 0), 0);

  const rmcLive = payoutPerf.filter(a => RITHMIC_DX.includes(a.dataProvider)).reduce((s, a) => s + a.n, 0);
  const tdvLive = payoutPerf.filter(a => a.dataProvider === "Tradovate").reduce((s, a) => s + a.n, 0);
  const xLive = payoutPerf.filter(a => a.dataProvider === "Project X").reduce((s, a) => s + a.n, 0);
  const totalActiveLive = rmcLive + tdvLive + xLive;
  const profitInActive = payoutPerf.reduce((s, a) => s + (a.invested * a.n || 0), 0);

  const cashedOut = payouts.reduce((s, r) => s + (r.fields["Total Amount"] || 0), 0);

  const profitFromOthers = payouts
    .filter(r => {
      const trader = Array.isArray(r.fields["Trader"]) ? r.fields["Trader"][0] : null;
      return trader && OTHER_TRADERS.includes(trader);
    })
    .reduce((s, r) => {
      const total = r.fields["Total Amount"] || 0;
      const investedPerAcct = r.fields["$ Invested Per Account before Payout"] || 0;
      const n = r.fields["Number of Accounts"] || 1;
      const invested = investedPerAcct * n;
      return s + Math.max(0, total - invested) * 0.5;
    }, 0);

  const todayEvalSpend = purchases
    .filter(r => ["New", "Reset", "Monthly Billing"].includes(r.fields["Purchase Type"]?.name || r.fields["Purchase Type"]))
    .reduce((s, r) => s + (r.fields["Total Cost"] || 0), 0);

  const startLiq = parseFloat(startingLiq) || 0;
  const payoutProfits50 = payouts.reduce((s, r) => {
    const total = r.fields["Total Amount"] || 0;
    const investedPerAcct = r.fields["$ Invested Per Account before Payout"] || 0;
    const n = r.fields["Number of Accounts"] || 1;
    const invested = investedPerAcct * n;
    const profit = Math.max(0, total - invested);
    return s + (profit * 0.5);
  }, 0);
  const endLiq = startLiq + todayEvalSpend - payoutProfits50;

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
          <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)}
            style={{ background: "#1f2937", border: "1px solid #374151", borderRadius: 8, padding: "8px 12px", fontSize: 14, color: "#fff", outline: "none", colorScheme: "dark" }} />
        </div>
        <div>
          <div style={{ fontSize: 10, color: "#6b7280", marginBottom: 4, textTransform: "uppercase", letterSpacing: 1 }}>Starting Liquidation $</div>
          <input type="number" placeholder="Enter yesterday's ending Liq $..." value={startingLiq} onChange={e => setStartingLiq(e.target.value)}
            style={{ background: "#1f2937", border: "1px solid #374151", borderRadius: 8, padding: "8px 12px", fontSize: 14, color: "#fff", width: 260, outline: "none" }} />
        </div>
        <button onClick={loadPLData} style={{ background: "#1f2937", border: "1px solid #374151", borderRadius: 8, padding: "8px 14px", fontSize: 12, color: "#9ca3af", cursor: "pointer", marginTop: 18 }}>
          🔄 Refresh
        </button>
      </div>

      <SectionHeader title="Evaluation Accounts" color="#8b5cf6" />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 8 }}>
        <StatBox label="RMC Evals" value={rmcEvals} color="#a78bfa" />
        <StatBox label="TDV Evals" value={tdvEvals} color="#a78bfa" />
        <StatBox label="X Evals" value={xEvals} color="#a78bfa" />
        <StatBox label="Active Evals" value={totalActiveEvals} color="#fff" />
        <StatBox label="$ Invested Evals" value={$$(investedEvals)} color="#c4b5fd" />
      </div>

      <SectionHeader title="Performance Accounts" color="#3b82f6" />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 8 }}>
        <StatBox label="RMC Perf" value={rmcPerf} color="#93c5fd" />
        <StatBox label="TDV Perf" value={tdvPerf} color="#93c5fd" />
        <StatBox label="X Perf" value={xPerf} color="#93c5fd" />
        <StatBox label="Active Perf" value={totalActivePerf} color="#fff" />
        <StatBox label="$ Invested Perf" value={$$(investedPerf)} color="#93c5fd" />
      </div>

      <SectionHeader title="Live & Payout Accounts" color="#f59e0b" />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
        <StatBox label="RMC Live" value={rmcLive} color="#fcd34d" />
        <StatBox label="TDV Live" value={tdvLive} color="#fcd34d" />
        <StatBox label="X Live" value={xLive} color="#fcd34d" />
        <StatBox label="Active Live" value={totalActiveLive} color="#fff" />
      </div>

      <SectionHeader title="Financials" color="#10b981" />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
        <StatBox label="Profit in Active" value={$$(profitInActive)} color="#4ade80" />
        <StatBox label="Liquidation $" value={$$(endLiq)} color="#f87171" sub={`Start: ${$$(startLiq)} + Spend: ${$$(todayEvalSpend)} − Profits: ${$$(payoutProfits50)}`} />
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
  const C = { bg: "#030712", card: "#111827", border: "#1f2937" };
  const sel = { background: "#1f2937", border: "1px solid #374151", borderRadius: 8, padding: "8px 12px", fontSize: 13, color: "#fff", width: "100%", outline: "none" };
  const inp = { background: "#1f2937", border: "1px solid #374151", borderRadius: 8, padding: "8px 12px", fontSize: 13, color: "#fff", width: "100%", outline: "none", boxSizing: "border-box" };
  const today = new Date().toISOString().split("T")[0];

  const [activeTab, setActiveTab] = useState("passed_evals");
  const [traderId, setTraderId] = useState("");
  const [evalAccounts, setEvalAccounts] = useState([]);
  const [perfAccounts, setPerfAccounts] = useState([]);
  const [payouts, setPayouts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [traderList, setTraderList] = useState([]);

  // Passed Evals state
  const [selectedEvalId, setSelectedEvalId] = useState("");
  const [startingBalance, setStartingBalance] = useState("");
  const [dateActivated, setDateActivated] = useState(today);
  const [numAccounts, setNumAccounts] = useState(1);
  const [investedPerAccount, setInvestedPerAccount] = useState("");
  const [activationFee, setActivationFee] = useState("");
  const [contractMultiplier, setContractMultiplier] = useState(1);

  // Stage Management state
  const [selectedPerfId, setSelectedPerfId] = useState("");
  const [stageAction, setStageAction] = useState("");
  const [newBalance, setNewBalance] = useState("");
  const [tradingDays, setTradingDays] = useState("");
  const [tradeDown, setTradeDown] = useState(false);
  const [resetTradingDays, setResetTradingDays] = useState(true);
  const [advancePayoutAmount, setAdvancePayoutAmount] = useState("");

  // Payout Management state
  const [selectedPayoutId, setSelectedPayoutId] = useState("");
  const [payoutAction, setPayoutAction] = useState(""); // "status" or "receive"
  const [newPayoutStatus, setNewPayoutStatus] = useState("");
  const [receivedAmount, setReceivedAmount] = useState("");
  const [receivedDate, setReceivedDate] = useState(today);
  const [postPayoutBalance, setPostPayoutBalance] = useState("");
  const [postPayoutStageId, setPostPayoutStageId] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState("");
  const [err, setErr] = useState(null);

  useEffect(() => {
    console.log("[AccountManagementTab] fetching traders");
    fetchTable(TRADERS_TABLE, ["Name"]).then(traders => {
      console.log("[AccountManagementTab] traders fetched:", traders.length, traders.map(r => r.fields["Name"]));
      setTraderList(traders.map(r => ({ id: r.id, name: r.fields["Name"] })).sort((a, b) => a.name.localeCompare(b.name)));
    }).catch(e => { console.error("[AccountManagementTab] traders error:", e); });
  }, []);
  useEffect(() => { if (traderId || activeTab === "payouts") loadData(); }, [traderId, activeTab]);

  async function loadData() {
    setLoading(true);
    try {
      const [er, pr, payr] = await Promise.all([
        fetch(`/.netlify/functions/airtable/${BASE}/${EVAL_TABLE}?maxRecords=200`).then(r => r.json()),
        fetch(`/.netlify/functions/airtable/${BASE}/${PERF_TABLE}?maxRecords=200`).then(r => r.json()),
        fetch(`/.netlify/functions/airtable/${BASE}/${PAYOUT_TABLE}?maxRecords=200`).then(r => r.json()),
      ]);

      const filterByTrader = (records, field = "Trader") =>
        !traderId ? records : (records || []).filter(r => {
          const t = r.fields[field];
          return Array.isArray(t) && t.includes(traderId);
        });

      setEvalAccounts(filterByTrader(er.records || []).filter(r => {
        const status = r.fields["Status"]?.name || r.fields["Status"];
        return status === "Active";
      }));
      setPerfAccounts(filterByTrader(pr.records || []).filter(r => {
        const status = r.fields["Status"]?.name || r.fields["Status"];
        return ["Active", "Live", "Waiting on Payout"].includes(status);
      }));

      // Payouts: filter by trader if selected, show non-Received by default
      const allPayouts = payr.records || [];
      const filteredPayouts = traderId
        ? allPayouts.filter(r => {
            const t = r.fields["Trader"];
            return Array.isArray(t) && t.includes(traderId);
          })
        : allPayouts;
      setPayouts(filteredPayouts.filter(r => r.fields["Status"] !== "Received"));
    } catch (e) {}
    setLoading(false);
  }

  function resetForm() {
    setSelectedEvalId(""); setStartingBalance(""); setDateActivated(today);
    setNumAccounts(1); setInvestedPerAccount(""); setActivationFee(""); setContractMultiplier(1);
    setSelectedPerfId(""); setStageAction(""); setNewBalance("");
    setTradingDays(""); setResetTradingDays(true);
    setTradeDown(false); setTradeDownFloor(""); setAdvancePayoutAmount("");
    setSelectedPayoutId(""); setPayoutAction(""); setNewPayoutStatus("");
    setReceivedAmount(""); setReceivedDate(today); setPostPayoutBalance("");
    setPostPayoutStageId(""); setErr(null);
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
      if (investedPerAccount) perfFields["Invested Per Account"] = parseFloat(investedPerAccount);
      if (contractMultiplier) perfFields["Contract Multiplier"] = parseFloat(contractMultiplier);
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
      await updateRecord(PERF_TABLE, selectedPerfId, { "Status": "Waiting on Payout" });
      // Create payout record
      const payoutFields = {
        "Name": `${trader?.name?.split(" ")[0] ?? "Unknown"} - ${perf?.fields["Name"]} - ${today}`,
        "Performance Account": [selectedPerfId],
        "Date Requested": today,
        "Status": "Requested",
        "Number of Accounts": perf?.fields["Number of Accounts"] || 1,
      };
      if (traderId) payoutFields["Trader"] = [traderId];
      await createRecord(PAYOUT_TABLE, payoutFields);
      setSuccess("✓ Payout requested and logged!");
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
      await updateRecord(PAYOUT_TABLE, selectedPayoutId, {
        "Status": "Received",
        "Date Received": receivedDate,
        "Amount Per Account": amtPerAcct,
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

  const TabBtn = ({ id, color, children }) => (
    <button onClick={() => { setActiveTab(id); resetForm(); }}
      style={{ background: "none", border: "none", borderBottom: activeTab === id ? `2px solid ${color}` : "2px solid transparent", color: activeTab === id ? color : "#6b7280", padding: "8px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer", marginBottom: -1, whiteSpace: "nowrap" }}>
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
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 20 }}>

        {/* Sub tabs */}
        <div style={{ display: "flex", borderBottom: `1px solid ${C.border}`, marginBottom: 18, gap: 0 }}>
          <TabBtn id="passed_evals" color="#8b5cf6">📈 Passed Evals</TabBtn>
          <TabBtn id="stage_mgmt" color="#3b82f6">🎯 Stages</TabBtn>
          <TabBtn id="payouts" color="#f59e0b">💰 Payouts</TabBtn>
        </div>

        {err && <div style={{ background: "#450a0a", border: "1px solid #7f1d1d", color: "#fca5a5", padding: "8px 12px", borderRadius: 8, fontSize: 12, marginBottom: 14 }}>{err}</div>}
        {success && <div style={{ background: "#052e16", border: "1px solid #166534", color: "#4ade80", padding: "8px 12px", borderRadius: 8, fontSize: 12, marginBottom: 14 }}>{success}</div>}

        {/* Trader selector */}
        <div style={{ marginBottom: 16 }}>
          {label("Trader")}
          <select value={traderId} onChange={e => { setTraderId(e.target.value); resetForm(); }} style={sel}>
            <option value="">All Traders</option>
            {traderList.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>

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
                          style={{ background: selectedEvalId === r.id ? "#2d1b69" : "#1f2937", border: `1px solid ${selectedEvalId === r.id ? "#8b5cf6" : "#374151"}`, borderRadius: 8, padding: "10px 14px", cursor: "pointer" }}>
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
                <div style={{ background: "#1a1a2e", border: "1px solid #8b5cf6", borderRadius: 8, padding: "10px 14px", marginBottom: 16 }}>
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
                    {label("Invested Per Account")}
                    <input type="number" placeholder="Optional" value={investedPerAccount} onChange={e => setInvestedPerAccount(e.target.value)} style={inp} />
                  </div>
                  <div>
                    {label("Activation Fee Per Account")}
                    <input type="number" placeholder="0.00" value={activationFee} onChange={e => setActivationFee(e.target.value)} style={inp} />
                  </div>
                  <div>
                    {label("Contract Multiplier")}
                    <input type="number" min="1" placeholder="1" value={contractMultiplier} onChange={e => setContractMultiplier(e.target.value)} style={inp} />
                  </div>
                </div>

                <button onClick={handleConvertEval} disabled={!startingBalance || submitting}
                  style={{ width: "100%", background: startingBalance ? "#7c3aed" : "#1f2937", color: startingBalance ? "#fff" : "#4b5563", border: "none", borderRadius: 8, padding: "10px", fontSize: 14, fontWeight: 700, cursor: startingBalance ? "pointer" : "not-allowed" }}>
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
                          style={{ background: selectedPerfId === r.id ? "#1e3a5f" : "#1f2937", border: `1px solid ${selectedPerfId === r.id ? "#3b82f6" : "#374151"}`, borderRadius: 8, padding: "10px 14px", cursor: "pointer" }}>
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
                    style={{ background: "#1f2937", border: "1px solid #374151", borderRadius: 10, padding: "12px 16px", cursor: "pointer", display: "flex", alignItems: "center", gap: 12 }}>
                    <span style={{ fontSize: 22 }}>⬆️</span>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "#4ade80" }}>Advance to Stage {nextStage.stage}</div>
                      <div style={{ fontSize: 11, color: "#6b7280" }}>Target: {$$(nextStage.target)}</div>
                    </div>
                  </div>
                )}
                <div onClick={() => setStageAction("payout")}
                  style={{ background: "#1f2937", border: "1px solid #374151", borderRadius: 10, padding: "12px 16px", cursor: "pointer", display: "flex", alignItems: "center", gap: 12 }}>
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
                  style={{ width: "100%", background: newBalance ? "#16a34a" : "#1f2937", color: newBalance ? "#fff" : "#4b5563", border: "none", borderRadius: 8, padding: "10px", fontSize: 14, fontWeight: 700, cursor: newBalance ? "pointer" : "not-allowed" }}>
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
                <div style={{ background: "#2d1f00", border: "1px solid #f59e0b", borderRadius: 8, padding: "12px 14px", marginBottom: 16 }}>
                  <div style={{ fontSize: 12, color: "#fde68a" }}>• Sets account to "Waiting on Payout"</div>
                  <div style={{ fontSize: 12, color: "#fde68a" }}>• Creates a Payout record with status "Requested"</div>
                  <div style={{ fontSize: 11, color: "#92400e", marginTop: 6 }}>When received, go to Payout Management to log the amount and advance the stage.</div>
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
                          style={{ background: selectedPayoutId === p.id ? "#1c1c2e" : "#1f2937", border: `1px solid ${selectedPayoutId === p.id ? statusColor[status] : "#374151"}`, borderRadius: 8, padding: "10px 14px", cursor: "pointer", marginBottom: 8 }}>
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
                      style={{ background: "#1f2937", border: "1px solid #374151", borderRadius: 10, padding: "12px 16px", cursor: "pointer", display: "flex", alignItems: "center", gap: 12 }}>
                      <span style={{ fontSize: 20 }}>🔄</span>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: "#93c5fd" }}>Update Status</div>
                        <div style={{ fontSize: 11, color: "#6b7280" }}>Move between Requested / Processing / Approved</div>
                      </div>
                    </div>
                    <div onClick={() => setPayoutAction("receive")}
                      style={{ background: "#1f2937", border: "1px solid #374151", borderRadius: 10, padding: "12px 16px", cursor: "pointer", display: "flex", alignItems: "center", gap: 12 }}>
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
                          style={{ background: newPayoutStatus === s ? statusColor[s] : "#1f2937", color: newPayoutStatus === s ? "#fff" : "#9ca3af", border: `1px solid ${newPayoutStatus === s ? statusColor[s] : "#374151"}`, borderRadius: 6, padding: "6px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                          {s}
                        </button>
                      ))}
                    </div>
                    <button onClick={handleUpdatePayoutStatus} disabled={!newPayoutStatus || submitting}
                      style={{ width: "100%", background: newPayoutStatus ? "#1d4ed8" : "#1f2937", color: newPayoutStatus ? "#fff" : "#4b5563", border: "none", borderRadius: 8, padding: "10px", fontSize: 14, fontWeight: 700, cursor: newPayoutStatus ? "pointer" : "not-allowed" }}>
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
                      style={{ width: "100%", background: (receivedAmount && postPayoutBalance && postPayoutStageId) ? "#16a34a" : "#1f2937", color: (receivedAmount && postPayoutBalance && postPayoutStageId) ? "#fff" : "#4b5563", border: "none", borderRadius: 8, padding: "10px", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
                      {submitting ? "Saving..." : "✓ Mark Received & Advance Stage"}
                    </button>
                  </>
                )}
              </>
            )}
          </>
        )}
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
              <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid #1f2937" }}>
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
              <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid #1f2937" }}>
                <span style={{ fontSize: 12, color: "#6b7280" }}>{k}</span>
                <span style={{ fontSize: 12, fontWeight: 600, color: "#fff" }}>{v}</span>
              </div>
            ))}
          </div>
        )}

        {activeTab === "payouts" && selectedPayout && (
          <div style={{ background: C.card, border: `1px solid ${statusColor[selectedPayout.fields["Status"]] || "#374151"}`, borderRadius: 12, padding: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: statusColor[selectedPayout.fields["Status"]] || "#fff", marginBottom: 12 }}>Payout Details</div>
            {[
              ["Name", selectedPayout.fields["Name"]],
              ["Status", selectedPayout.fields["Status"]],
              ["Date Requested", selectedPayout.fields["Date Requested"] || "—"],
              ["Accounts", `×${selectedPayout.fields["Number of Accounts"] || 1}`],
              ["Perf Account", payoutPerf?.fields["Name"] || "—"],
              ["Current Balance", payoutPerf ? $$(payoutPerf.fields["Current Balance"]) : "—"],
            ].map(([k, v]) => (
              <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid #1f2937" }}>
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
  const [tab, setTab] = useState("gameplan");

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
      const [pr, er] = await Promise.all([
        fetchTable(PERF_TABLE, ["Name", "Status", "Number of Accounts", "Current Balance", "High Water Mark", "Current Drawdown Left", "Drawdown Safety", "Max Trade Size", "Progress to Stage Target", "Invested Per Account", "Trade Down Account", "Drawdown to Floor", "Contract Multiplier", "Data Provider", "Payout Account", "Daily Target", "Performance Account Type", "Trading Day Type", "Min Profitable Day Amount", "Trading Days this Cycle", "Cycle Start Balance", "Trader"]),
        fetchTable(EVAL_TABLE, ["Name", "Status", "Number of Accounts", "Current Balance", "High Water Mark", "Current Drawdown Left", "Drawdown Safety", "Max Trade Size", "Progress to Target", "Data Provider", "Daily Target", "Account Weight", "Evaluation Account Type", "Trading Days Completed"]),
      ]);

      const activeStatuses = ["Active", "Live", "Waiting on Payout"];

      const mapPerf = r => {
        const f = r.fields;
        const dp = Array.isArray(f["Data Provider"]) ? f["Data Provider"][0] : (f["Data Provider"] || "Other");
        return {
          id: r.id, type: "perf",
          name: f["Name"] || "?",
          trader: (Array.isArray(f["Trader"]) ? f["Trader"][0] : f["Trader"]) || "",
          status: f["Status"] || "",
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
          dailyTarget: f["Daily Target"] || 0,
          hwm: f["High Water Mark"] || 0,
          accountTypeId: (f["Performance Account Type"] || [])[0] || null,
          tradingDayType: (f["Trading Day Type"] || [])[0] || null,
          minProfitDay: (f["Min Profitable Day Amount"] || [])[0] || 0,
          tradingDays: f["Trading Days this Cycle"] || 0,
          cycleStartBal: f["Cycle Start Balance"] || 0,
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
          n: f["Number of Accounts"] || 1,
          ddSafety: f["Drawdown Safety"] || 0,
          hwm: f["High Water Mark"] || 0,
          tradeDown: false,
          contractMultiplier: 1,
          payoutAccount: false,
          dataProvider: dp,
          dailyTarget: f["Daily Target"] || 0,
          accountWeight: Array.isArray(f["Account Weight"]) ? f["Account Weight"][0] : (f["Account Weight"] || null),
          dailyTarget: f["Daily Target"] || 0,
          accountTypeId: (f["Evaluation Account Type"] || [])[0] || null,
          tradingDays: f["Trading Days Completed"] || 0,
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

      <div style={{ background: C.card, borderBottom: `1px solid ${C.border}`, padding: "13px 20px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
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
                setDones({});
                setNoChanges({});
                setInputs({});
                localStorage.removeItem("tradingDones");
                localStorage.removeItem("tradingNoChanges");
                await load();
              }}
            />
          )}
        {tab === "gameplan" && (
            <button onClick={save} disabled={saving || filledCount === 0}
              style={{ background: saved ? "#065f46" : "#2563eb", color: "#fff", border: "none", borderRadius: 8, padding: "8px 16px", fontSize: 13, fontWeight: 600, cursor: filledCount === 0 ? "not-allowed" : "pointer", opacity: filledCount === 0 ? 0.4 : 1 }}>
              {saving ? "Saving..." : saved ? "✓ Saved!" : `Save (${filledCount}) to Airtable`}
            </button>
          )}
          {tab === "gameplan" && <button onClick={load} style={{ background: "transparent", color: "#9ca3af", border: `1px solid ${C.border}`, borderRadius: 8, padding: "8px 12px", fontSize: 13, cursor: "pointer" }}>↻ Refresh</button>}
          {tab === "gameplan" && <button onClick={advanceDay} style={{ background: "#1f2937", border: "1px solid #374151", borderRadius: 8, padding: "6px 14px", fontSize: 12, color: "#f59e0b", cursor: "pointer", fontWeight: 600 }}>⏭ Next Day</button>}
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
                ["accounts", "📋 All Accounts"],
                ["purchases", "🛒 Purchases"],
                ["mgmt", "🔄 Account Management"],
                ["pl", "📈 P&L"],
                ["firms", "🏢 Firm Usage"],
              ].map(([key, label]) => (
            <button key={key} onClick={() => setTab(key)}
              style={{ background: "none", border: "none", borderBottom: tab === key ? "2px solid #3b82f6" : "2px solid transparent", color: tab === key ? "#60a5fa" : "#6b7280", padding: "8px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer", marginBottom: -1 }}>
              {label}
            </button>
          ))}
        </div>

              {tab === "purchases" && <PurchaseTab />}
              {tab === "mgmt" && <AccountManagementTab />}
              {tab === "accounts" && <AllAccountsTab evalAccounts={evalAccounts} perfAccounts={perfAccounts} dones={dones} />}
              {tab === "pl" && <PLTab evalAccounts={evalAccounts} perfAccounts={perfAccounts} />}
              {tab === "firms" && <FirmUsageTab evalAccounts={evalAccounts} perfAccounts={perfAccounts} />}
            </div>
            </div>
        );
      }     