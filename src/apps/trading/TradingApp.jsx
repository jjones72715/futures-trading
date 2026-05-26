import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { fetchTable, updateRecord } from "./services/airtable.js";
import { BASE, PERF_TABLE, EVAL_TABLE, PURCHASE_TABLE, TRADERS_TABLE, FIRMS_TABLE, PAYOUT_TABLE, PAYOUT_STRATEGIES_TABLE } from "./config/tables.js";
import { SnapshotTab } from "./components/SnapshotTab.jsx";
import { PurchaseTab } from "./components/PurchaseTab.jsx";
import { AccountManagementTab } from "./components/AccountManagementTab.jsx";
import { AllAccountsTab } from "./components/AllAccountsTab.jsx";
import { PLTab } from "./components/PLTab.jsx";
import { TraderPLTab } from "./components/TraderPLTab.jsx";
import { FirmUsageTab } from "./components/FirmUsageTab.jsx";
import { TradeLogTab } from "./components/TradeLogTab.jsx";
import { AdvanceDayModal } from "./components/AdvanceDayModal.jsx";

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
        traderRecs = await fetchTable(TRADERS_TABLE, ["Name", "Preferred Name"]);
      } catch(e) {}
      const traderMap = {};
      traderRecs.forEach(r => {
        traderMap[r.id] = r.fields["Preferred Name"] || (r.fields["Name"] || "").split(" ")[0] || "";
      });

      try {
        firmRecs = await fetchTable(FIRMS_TABLE, ["Name"]);
      } catch(e) {}
      const firmMap = {};
      firmRecs.forEach(r => { firmMap[r.id] = r.fields["Name"] || ""; });

      try {
        pr = await fetchTable(PERF_TABLE, ["Name", "Status", "Number of Accounts", "Current Balance", "High Water Mark", "Current Drawdown Left", "Drawdown Safety", "Max Trade Size", "Drawdown to Floor", "Contract Multiplier", "Data Provider", "Data Provider Override", "Payout Account", "Performance Account Type", "Trading Day Type", "Min Profitable Day Amount", "Trading Days this Cycle", "Trading Days Left", "Cycle Start Balance", "Trader", "Score", "Firm Name", "Account Number", "Trading Day Definition", "Number of Payouts Recieved", "Daily Loss Limit", "Current Stage", "Stage Target Override"]);
        console.log("raw perf records:", pr?.length, pr?.[0]);
      } catch(perfErr) {
        console.error("PERF FETCH ERROR:", perfErr);
      }
      try {
        er = await fetchTable(EVAL_TABLE, ["Name", "Status", "Number of Accounts", "Current Balance", "High Water Mark", "Current Drawdown Left", "Drawdown Safety", "Max Trade Size", "Progress to Target", "Profit Target", "Data Provider", "Account Weight", "Account Weight Override", "Evaluation Account Type", "Trading Days Completed", "Trading Days Left", "Trader", "Score", "Firm Name", "Account Number", "Trading Day Definition", "Date Started", "Daily Loss Limit"]);
        console.log("raw eval records:", er?.length, er?.[0]);
      } catch(evalErr) {
        console.error("EVAL FETCH ERROR:", evalErr);
      }

      // Map evalTypeId → firmId so purchases can be matched by trader + firm
      const evalTypeFirmMap = {};
      (er || []).forEach(r => {
        const typeArr = r.fields["Evaluation Account Type"];
        const typeId = Array.isArray(typeArr) ? (typeof typeArr[0] === "string" ? typeArr[0] : typeArr[0]?.id) : null;
        const firmArr = r.fields["Firm Name"];
        const firmId = Array.isArray(firmArr) ? firmArr[0] : (firmArr || null);
        if (typeId && firmId) evalTypeFirmMap[typeId] = firmId;
      });

      let purchaseRecs = [];
      try { purchaseRecs = await fetchTable(PURCHASE_TABLE, ["Trader", "Date Purchased", "Evaluation Account Type", "Number of Accounts"]); } catch(e) {}
      const now = Date.now();
      const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
      const purchaseLast30ByTraderFirm = {};
      purchaseRecs.forEach(r => {
        const f = r.fields;
        const dateStr = f["Date Purchased"];
        if (!dateStr) return;
        if (now - new Date(dateStr).getTime() > thirtyDaysMs) return;
        const typeArr = f["Evaluation Account Type"];
        const typeId = Array.isArray(typeArr) ? (typeof typeArr[0] === "string" ? typeArr[0] : typeArr[0]?.id) : null;
        const firmId = typeId ? evalTypeFirmMap[typeId] : null;
        if (!firmId) return;
        const traderArr = Array.isArray(f["Trader"]) ? f["Trader"] : (f["Trader"] ? [f["Trader"]] : []);
        traderArr.forEach(tid => {
          const key = `${tid}::${firmId}`;
          purchaseLast30ByTraderFirm[key] = (purchaseLast30ByTraderFirm[key] || 0) + (f["Number of Accounts"] || 1);
        });
      });

      let stratRecs = [];
      try { stratRecs = await fetchTable(PAYOUT_STRATEGIES_TABLE, ["Stage Target"]); } catch(e) {}
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
        const dpOverride = f["Data Provider Override"] ? (Array.isArray(f["Data Provider Override"]) ? f["Data Provider Override"][0] : f["Data Provider Override"]) : null;
        const dp = dpOverride || (Array.isArray(f["Data Provider"]) ? f["Data Provider"][0] : (f["Data Provider"] || "Other"));
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
          tradeDown: f["Payout Account"] || false,
          contractMultiplier: f["Contract Multiplier"] || 1,
          payoutAccount: f["Payout Account"] || false,
          dataProvider: dp,
          dailyTarget: 0,
          hwm: f["High Water Mark"] || 0,
          accountTypeId: (() => { const v = (f["Performance Account Type"] || [])[0]; return typeof v === "string" ? v : v?.id || null; })(),
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
          stageTarget: (() => { if (f["Stage Target Override"] != null) return f["Stage Target Override"]; const v = (f["Current Stage"] || [])[0]; const sid = typeof v === "string" ? v : v?.id || null; return sid ? (stratMap[sid] || null) : null; })(),
        };
      };

      const mapEval = r => {
        const f = r.fields;
        const dp = Array.isArray(f["Data Provider"]) ? f["Data Provider"][0] : (f["Data Provider"] || "Other");
        const traderId = Array.isArray(f["Trader"]) ? f["Trader"][0] : (f["Trader"] || "");
        const firmId = Array.isArray(f["Firm Name"]) ? f["Firm Name"][0] : (f["Firm Name"] || null);
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
          accountWeight: f["Account Weight Override"] != null ? f["Account Weight Override"] : (Array.isArray(f["Account Weight"]) ? f["Account Weight"][0] : (f["Account Weight"] || null)),
          accountTypeId: (() => { const v = (f["Evaluation Account Type"] || [])[0]; return typeof v === "string" ? v : v?.id || null; })(),
          accountTypeName: (() => { const v = (f["Evaluation Account Type"] || [])[0]; return typeof v === "object" ? v?.name || null : null; })(),
          tradingDays: f["Trading Days Completed"] || 0,
          tradingDaysLeft: f["Trading Days Left"] ?? null,
          score: f["Score"] ?? null,
          accountNumber: f["Account Number"] || null,
          tradingDayDefinition: f["Trading Day Definition"] || null,
          datePurchased: f["Date Started"] || null,
          dailyLossLimit: f["Daily Loss Limit"] || null,
          profitTarget: (() => { const v = f["Profit Target"]; return Array.isArray(v) ? (v[0] || null) : (v || null); })(),
          purchases30: firmId ? (purchaseLast30ByTraderFirm[`${traderId}::${firmId}`] ?? null) : null,
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
            ["tradelog", "📓 Trade Log"],
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
              {tab === "accounts" && <AllAccountsTab evalAccounts={evalAccounts} perfAccounts={perfAccounts} dones={dones} onDone={onDone} onClearDones={() => { setDones({}); localStorage.removeItem("tradingDones"); }} />}
              {tab === "reconcile" && <PLTab evalAccounts={evalAccounts} perfAccounts={perfAccounts} />}
              {tab === "traderpl" && <TraderPLTab />}
              {tab === "firms" && <FirmUsageTab evalAccounts={evalAccounts} perfAccounts={perfAccounts} />}
              {tab === "tradelog" && <TradeLogTab />}
            </div>
            </div>
        );
      }
