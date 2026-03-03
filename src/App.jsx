import { useState, useEffect, useCallback } from "react";

const AIRTABLE_TOKEN = "patIocMMJeO1lbzlm.d9ea1e76994175893ff166925528aed82f3caea1eb9126a096b16cebade88cd5";
const BASE = "app5RPYcCy7hqCu41";
const PERF_TABLE = "tblhM1DWRiWXnhSKb";
const EVAL_TABLE = "tblWeri8TXWPQY9Dc";

const PF = {
  name: "fldfyrSV2RPcv1jU1",
  currentBalance: "fldenQrAmWXxAC5Qv",
  ddLeft: "fldLM0EQzoGJDgnvZ",
  ddToFloor: "fldkETMCEwIf4ir6y",
  progress: "fldf76ADXNFihKn8O",
  tradeLimit: "fld2mleAdDsy4E3Q3",
  invested: "fldAWWar1WK3I9BVi",
  numAccounts: "fldiJ3GD2NLLc3YIi",
  status: "fld7UANxkXuwL90xT",
  trader: "fldi7WIXgdknUa1rw",
  tradeDown: "fldUi9sc4S0KlzVDh",
  tradeDownFloor: "fldXIDdvlZcpqQO2r",
  ddSafety: "fldR93EIPYMSVdlhT",
  contractMultiplier: "fld4zROk0IUc3hC0R",
};

const EF = {
  name: "fldmzqIB76bjvJF3L",
  currentBalance: "fldahVnKHFGz3wnnR",
  ddLeft: "fldBdBEe7WxX5VwQE",
  progress: "fldiKug0vOztdoJ9h",
  tradeLimit: "fldOkYBx1xHuqO8Ld",
  status: "fldWV8bPpsFkWpYux",
  trader: "fld44diXukpSDXv3Y",
  numAccounts: "fldXpePekEYHk8YCs",
  ddSafety: "fld4HXGSfB4ZtRyaL",
};

async function fetchTable(tableId, fieldIds) {
  const params = fieldIds.map(f => `fields[]=${f}`).join("&");
  const res = await fetch(
    `/.netlify/functions/airtable/${BASE}/${tableId}?${params}&maxRecords=100`
  );
  const data = await res.json();
  return data.records || [];
}

async function updateRecord(tableId, recordId, fields) {
  await fetch(`/.netlify/functions/airtable/${BASE}/${tableId}/${recordId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fields }),
  });
}

function toScore(p) {
  if (!p && p !== 0) return 0;
  return Math.max(1, Math.min(10, Math.round(p * 10)));
}

function $$(v) {
  if (v === null || v === undefined || v === "") return "—";
  const n = parseFloat(v);
  if (isNaN(n)) return "—";
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

function getField(fields, key) {
  const val = fields[key];
  if (Array.isArray(val)) return val[0]?.name ?? val[0] ?? null;
  if (val && typeof val === "object" && "name" in val) return val.name;
  return val ?? null;
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

function AccountRow({ a, i, inputVal, noChange, onInput, onNoChange }) {
  const v = parseFloat(inputVal);
  const hasV = inputVal !== "" && !isNaN(v);
  const diff = noChange ? 0 : hasV ? (v - a.bal) * a.n : null;
  const pos = diff > 0;
  const zero = diff === 0;
  const C = { card: "#111827", border: "#1f2937" };
  const tradeDownHit = a.tradeDown && hasV && !noChange && diff !== null && diff < 0 && Math.abs(diff) >= (a.ddToFloor || a.ddLeft);

  return (
    <div style={{
      background: C.card,
      border: `1px solid ${tradeDownHit ? "#dc2626" : noChange ? "#1f4f1f" : hasV ? (pos ? "#166534" : "#7f1d1d") : C.border}`,
      borderRadius: 10, padding: "10px 14px", marginBottom: 5,
      display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap",
      boxShadow: tradeDownHit ? "0 0 12px rgba(220,38,38,0.4)" : "none",
    }}>
      <div style={{ width: 22, height: 22, background: "#1f2937", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, color: "#9ca3af", flexShrink: 0 }}>{i + 1}</div>

      <div style={{ width: 185, flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 2 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: "#fff" }}>{a.name}</span>
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
        <div style={{ fontSize: 13, fontWeight: 600, color: "#fff" }}>{$$(a.bal)}</div>
      </div>

      <div style={{ width: 80, flexShrink: 0 }}>
        <div style={{ fontSize: 10, color: "#6b7280", marginBottom: 2 }}>Trade Limit</div>
        <div style={{ fontSize: 13, fontWeight: 600, color: "#93c5fd" }}>{$$(a.limit)}</div>
      </div>

      <div style={{ width: 80, flexShrink: 0 }}>
        <div style={{ fontSize: 10, color: "#6b7280", marginBottom: 2 }}>{a.tradeDown ? "DD to Floor" : "DD Left"}</div>
        <div style={{ fontSize: 13, fontWeight: 600, color: a.tradeDown ? "#f87171" : "#fde68a" }}>{$$(a.tradeDown ? a.ddToFloor : a.ddLeft)}</div>
      </div>

      <div style={{ width: 75, flexShrink: 0 }}>
        <div style={{ fontSize: 10, color: "#6b7280", marginBottom: 2 }}>DD Safety</div>
        <SafetyBar safety={a.ddSafety} />
      </div>

      <div style={{ width: 75, flexShrink: 0 }}>
        <div style={{ fontSize: 10, color: "#6b7280", marginBottom: 2 }}>Invested</div>
        <div style={{ fontSize: 13, fontWeight: 600, color: "#c4b5fd" }}>{$$(a.invested)}</div>
      </div>

      {tradeDownHit && (
        <div style={{ width: "100%", background: "#450a0a", border: "1px solid #dc2626", borderRadius: 8, padding: "8px 12px", display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 16 }}>⚠️</span>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#fca5a5" }}>TRADE DOWN TRIGGERED — Recovery trade required</div>
            <div style={{ fontSize: 11, color: "#f87171" }}>
              Target: get back to {$$(a.bal)} or breach. {a.invested > 0 && `Pull ${$$(Math.abs(diff / a.ddLeft) * a.invested)} from this account's investment.`}
            </div>
          </div>
        </div>
      )}

      <div style={{ flex: 1, minWidth: 220 }}>
        <div style={{ fontSize: 10, color: "#6b7280", marginBottom: 3 }}>Today's Ending Balance</div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <input
            type="number"
            placeholder="Enter balance..."
            value={inputVal}
            onChange={e => onInput(e.target.value)}
            disabled={noChange}
            style={{ background: noChange ? "#1a2a1a" : "#1f2937", border: "1px solid #1f2937", borderRadius: 7, padding: "6px 10px", fontSize: 13, color: noChange ? "#6b7280" : "#fff", width: 125, outline: "none" }}
          />
          <button onClick={onNoChange}
            style={{ background: noChange ? "#166534" : "#1f2937", border: `1px solid ${noChange ? "#22c55e" : "#374151"}`, borderRadius: 7, padding: "6px 10px", fontSize: 11, color: noChange ? "#4ade80" : "#9ca3af", cursor: "pointer", fontWeight: 600, whiteSpace: "nowrap" }}>
            {noChange ? "✓ No Change" : "No Change"}
          </button>
          {diff !== null && (
            <span style={{ fontSize: 13, fontWeight: 600, color: zero ? "#6b7280" : pos ? "#4ade80" : "#f87171" }}>
              {zero ? "±$0" : (pos ? "+" : "") + $$(diff)}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [perfs, setPerfs] = useState([]);
  const [evals, setEvals] = useState([]);
  const [inputs, setInputs] = useState({});
  const [noChanges, setNoChanges] = useState({});
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
        fetchTable(PERF_TABLE, Object.values(PF)),
        fetchTable(EVAL_TABLE, Object.values(EF)),
      ]);

      const activeStatuses = ["Active", "Live", "Waiting on Payout"];

      const mappedPerfs = pr
        .filter(r => activeStatuses.includes(getField(r.fields, PF.status)))
        .map(r => {
          const f = r.fields;
          return {
            id: r.id, type: "perf",
            name: getField(f, PF.name) || "?",
            trader: Array.isArray(f[PF.trader]) ? (f[PF.trader][0]?.name || "") : (f[PF.trader] || ""),
            status: getField(f, PF.status) || "",
            bal: f[PF.currentBalance] || 0,
            ddLeft: f[PF.ddLeft] || 0,
            ddToFloor: f[PF.ddToFloor] || 0,
            prog: f[PF.progress] || 0,
            limit: f[PF.tradeLimit] || 0,
            invested: f[PF.invested] || 0,
            n: f[PF.numAccounts] || 1,
            ddSafety: f[PF.ddSafety] || 0,
            tradeDown: f[PF.tradeDown] || false,
            tradeDownFloor: f[PF.tradeDownFloor] || 0,
            contractMultiplier: f[PF.contractMultiplier] || 1,
          };
        })
        .sort((a, b) => a.prog - b.prog);

      const mappedEvals = er
        .filter(r => getField(r.fields, EF.status) === "Active")
        .map(r => {
          const f = r.fields;
          return {
            id: r.id, type: "eval",
            name: getField(f, EF.name) || "?",
            trader: getField(f, EF.trader) || "",
            status: getField(f, EF.status) || "",
            bal: f[EF.currentBalance] || 0,
            ddLeft: Array.isArray(f[EF.ddLeft]) ? f[EF.ddLeft][0] : f[EF.ddLeft] || 0,
            ddToFloor: 0,
            prog: f[EF.progress] || 0,
            limit: Array.isArray(f[EF.tradeLimit]) ? f[EF.tradeLimit][0] : f[EF.tradeLimit] || 0,
            n: f[EF.numAccounts] || 1,
            ddSafety: f[EF.ddSafety] || 0,
            tradeDown: false,
            tradeDownFloor: 0,
            contractMultiplier: 1,
            invested: 0,
          };
        })
        .sort((a, b) => a.prog - b.prog);

      setPerfs(mappedPerfs);
      setEvals(mappedEvals);
      const inp = {};
      [...mappedPerfs, ...mappedEvals].forEach(a => { inp[a.id] = ""; });
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

  async function save() {
    setSaving(true); setErr(null);
    try {
      const perfUpdates = perfs.filter(a => inputs[a.id] !== "" && !isNaN(parseFloat(inputs[a.id])));
      const evalUpdates = evals.filter(a => inputs[a.id] !== "" && !isNaN(parseFloat(inputs[a.id])));
      await Promise.all([
        ...perfUpdates.map(a => updateRecord(PERF_TABLE, a.id, { [PF.currentBalance]: parseFloat(inputs[a.id]) })),
        ...evalUpdates.map(a => updateRecord(EVAL_TABLE, a.id, { [EF.currentBalance]: parseFloat(inputs[a.id]) })),
      ]);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      await load();
    } catch (e) {
      setErr("Save failed: " + e.message);
    }
    setSaving(false);
  }

  const all = [...evals, ...perfs];
  const gain = all.reduce((s, a) => { const v = parseFloat(inputs[a.id]); if (noChanges[a.id] || isNaN(v) || !inputs[a.id]) return s; const d = (v - a.bal) * a.n; return d > 0 ? s + d : s; }, 0);
  const loss = all.reduce((s, a) => { const v = parseFloat(inputs[a.id]); if (noChanges[a.id] || isNaN(v) || !inputs[a.id]) return s; const d = (v - a.bal) * a.n; return d < 0 ? s + d : s; }, 0);
  const net = gain + loss;
  const filledCount = Object.entries(inputs).filter(([, v]) => v !== "" && !isNaN(parseFloat(v))).length + Object.values(noChanges).filter(Boolean).length;

  const losers = all.filter(a => !noChanges[a.id] && inputs[a.id] && parseFloat(inputs[a.id]) < a.bal).map(a => {
    const ddRef = a.tradeDown ? a.ddToFloor : a.ddLeft;
    const pctLost = ddRef > 0 ? Math.abs(parseFloat(inputs[a.id]) - a.bal) / ddRef : 0;
    return { ...a, pctLost, move: pctLost * a.invested };
  }).filter(a => a.move > 0.5);

  const gainers = all.filter(a => !noChanges[a.id] && inputs[a.id] && parseFloat(inputs[a.id]) > a.bal);
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
          {filledCount > 0 && <span style={{ fontSize: 12, color: "#60a5fa" }}>{filledCount} updated</span>}
          <button onClick={save} disabled={saving || filledCount === 0}
            style={{ background: saved ? "#065f46" : "#2563eb", color: "#fff", border: "none", borderRadius: 8, padding: "8px 16px", fontSize: 13, fontWeight: 600, cursor: filledCount === 0 ? "not-allowed" : "pointer", opacity: filledCount === 0 ? 0.4 : 1 }}>
            {saving ? "Saving..." : saved ? "✓ Saved!" : `Save (${filledCount}) to Airtable`}
          </button>
          <button onClick={load} style={{ background: "transparent", color: "#9ca3af", border: `1px solid ${C.border}`, borderRadius: 8, padding: "8px 12px", fontSize: 13, cursor: "pointer" }}>↻ Refresh</button>
        </div>
      </div>

      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "16px 20px" }}>
        {err && <div style={{ background: "#450a0a", border: "1px solid #7f1d1d", color: "#fca5a5", padding: "10px 14px", borderRadius: 8, fontSize: 13, marginBottom: 12 }}>⚠ {err}</div>}

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 18 }}>
          {[["Profit Today", gain, "#22c55e"], ["Loss Today", loss, "#ef4444"], ["Net P&L", net, net >= 0 ? "#3b82f6" : "#f97316"]].map(([label, val, color]) => (
            <div key={label} style={{ background: `${color}15`, border: `1px solid ${color}40`, borderRadius: 10, padding: "11px 14px" }}>
              <div style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, color, marginBottom: 3 }}>{label}</div>
              <div style={{ fontSize: 22, fontWeight: 800, color }}>{$$(val)}</div>
            </div>
          ))}
        </div>

        <div style={{ display: "flex", borderBottom: `1px solid ${C.border}`, marginBottom: 16 }}>
          {[["gameplan", "Daily Gameplan"], ["redist", `Redistribution${redists.length > 0 ? ` (${redists.length})` : ""}`]].map(([key, label]) => (
            <button key={key} onClick={() => setTab(key)}
              style={{ background: "none", border: "none", borderBottom: tab === key ? "2px solid #3b82f6" : "2px solid transparent", color: tab === key ? "#60a5fa" : "#6b7280", padding: "8px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer", marginBottom: -1 }}>
              {label}
            </button>
          ))}
        </div>

        {tab === "gameplan" && (
          <>
            {evals.length > 0 && (
              <div style={{ marginBottom: 28 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: "#e5e7eb" }}>Evaluation Accounts</span>
                  <span style={{ background: "#1f2937", color: "#9ca3af", fontSize: 11, padding: "1px 7px", borderRadius: 99 }}>{evals.length}</span>
                  <span style={{ fontSize: 11, color: "#6b7280" }}>Lowest score first → reset candidates</span>
                </div>
                {evals.map((a, i) => <AccountRow key={a.id} a={a} i={i} inputVal={inputs[a.id] || ""} noChange={!!noChanges[a.id]} onInput={val => onInput(a.id, val)} onNoChange={() => onNoChange(a.id)} />)}
              </div>
            )}
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: "#e5e7eb" }}>Performance Accounts</span>
                <span style={{ background: "#1f2937", color: "#9ca3af", fontSize: 11, padding: "1px 7px", borderRadius: 99 }}>{perfs.length}</span>
                <span style={{ fontSize: 11, color: "#6b7280" }}>Lowest score first → closest to payout last</span>
              </div>
              {perfs.map((a, i) => <AccountRow key={a.id} a={a} i={i} inputVal={inputs[a.id] || ""} noChange={!!noChanges[a.id]} onInput={val => onInput(a.id, val)} onNoChange={() => onNoChange(a.id)} />)}
            </div>
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
      </div>
    </div>
  );
}