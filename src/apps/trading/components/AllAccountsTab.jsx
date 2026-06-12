import React from "react";
import { $$, $$target, lpColor } from "../utils/format.js";
import { fetchTable, updateRecord } from "../services/airtable.js";
import { BASE, EVAL_TYPE_TABLE, PERF_TABLE, EVAL_TABLE, PAYOUT_TABLE, PAYOUT_STRATEGIES_TABLE, TRADERS_TABLE } from "../config/tables.js";
import { BreachModal } from "./BreachModal.jsx";

export function AllAccountsTab({ evalAccounts, perfAccounts, dones, onDone, onClearDones }) {
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
  const [traders, setTraders] = React.useState([]);
  React.useEffect(() => {
    Promise.all([
      fetchTable(EVAL_TYPE_TABLE, ["Name", "Account Size", "Profit Target", "Drawdown Limit", "Daily Loss Limit", "Max Contracts", "Account Weight", "Consistency %", "New Eval Cost", "Reset Eval Cost", "Activation Cost", "Value Score", "Allowed Traders"]),
      fetchTable(TRADERS_TABLE, ["Name", "Preferred Name"]),
    ]).then(([rows, traderRows]) => {
      setEvalTypeList(rows.map(r => ({
        id: r.id,
        name: r.fields["Name"],
        accountSize: r.fields["Account Size"] || 0,
        cost: r.fields["Cost Per Account"] || 0,
        drawdownLimit: r.fields["Drawdown Limit"] || 0,
        accountWeight: r.fields["Account Weight"] || null,
        consistencyPct: r.fields["Consistency %"] ?? null,
        newEvalCost: r.fields["New Eval Cost"] ?? null,
        resetEvalCost: r.fields["Reset Eval Cost"] ?? null,
        activationCost: r.fields["Activation Cost"] ?? null,
        valueScore: r.fields["Value Score"] ?? null,
        allowedTraders: (r.fields["Allowed Traders"] ?? []).map(t => typeof t === "object" ? t.id : t),
      })).sort((a, b) => a.name.localeCompare(b.name)));
      setTraders(traderRows.map(r => ({
        id: r.id,
        name: r.fields["Name"] ?? r.fields["Preferred Name"] ?? "Unknown",
      })));
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
      fetchTable(PAYOUT_STRATEGIES_TABLE, ["Name", "Account Type", "Stage Number", "Stage Target"]),
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
      const perfUpdate = {
        "Status": "Active",
        "Current Balance": parseFloat(fi.newBalance),
        "High Water Mark": parseFloat(fi.newBalance),
        "Cycle Start Balance": parseFloat(fi.newBalance),
        "Current Stage": [fi.stageId],
        "Trading Days this Cycle": 0,
        "Number of Payouts Recieved": a.numPayoutsReceived + 1,
      };
      if (fi.stageTargetOverride) perfUpdate["Stage Target Override"] = parseFloat(fi.stageTargetOverride);
      await updateRecord(PERF_TABLE, a.id, perfUpdate);
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
      const balanceUpdates = allShown.filter(a => {
        const v = newBalanceInputs[a.id];
        return v !== "" && v !== undefined && !isNaN(parseFloat(v));
      });
      const tdUpdates = allShown.filter(a => countTradingDays[a.id]);
      await Promise.all([
        ...scoreUpdates.map(a => saveScore(a, scoreInputs[a.id])),
        ...balanceUpdates.map(a => saveBalance(a, newBalanceInputs[a.id])),
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

  const [dayCompleting, setDayCompleting] = React.useState(false);
  const [dayCompleted, setDayCompleted] = React.useState(false);

  async function completeDay() {
    setDayCompleting(true);
    await submitAllScores();
    if (onClearDones) onClearDones();
    setScoreInputs({});
    setNewBalanceInputs({});
    setCountTradingDays({});
    setDayCompleted(true);
    setTimeout(() => setDayCompleted(false), 3000);
    setDayCompleting(false);
  }
  const FEED_ORDER = ["DX Feed", "Rithmic", "Tradovate", "Project X"];
  const sortFeeds = names => [...names].sort((a, b) => {
    const ia = FEED_ORDER.indexOf(a), ib = FEED_ORDER.indexOf(b);
    if (ia === -1 && ib === -1) return a.localeCompare(b);
    if (ia === -1) return 1;
    if (ib === -1) return -1;
    return ia - ib;
  });
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

    const typeCardBg = isBlown ? "#1a0505" : isDone ? "#111827" : a.status === "Waiting on Payout" ? "#160d1f" : a.status === "Live" ? "#051a0e" : a.payoutAccount ? "#1c0e05" : a.type === "perf" ? "#011418" : "#1a0614";
    const typeCardBorder = isBlown ? "#7f1d1d" : isDone ? "#1f2937" : a.status === "Waiting on Payout" ? "#a855f755" : a.status === "Live" ? "#22c55e55" : a.payoutAccount ? "#f9731655" : a.type === "perf" ? "#06b6d455" : "#ec489955";

    if (a.status === "Waiting on Payout") {
      const payoutRecord = payoutData[a.id];
      const action = payoutActionState[a.id] || null;
      const fi = payoutFormInputs[a.id] || {};
      const isSubmitting = !!payoutSubmitting[a.id];
      const availableStages = payoutStrategies.filter(s => s.perfTypeId === a.accountTypeId).sort((x, y) => x.stage - y.stage);
      const setFI = (field, value) => setPayoutFormInputs(prev => ({ ...prev, [a.id]: { ...(prev[a.id] || {}), [field]: value } }));
      return (
        <div key={a.id} style={{ background: typeCardBg, border: `1px solid ${typeCardBorder}`, borderRadius: 8, padding: "8px 10px", marginBottom: 4 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 7 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>{header}</span>
            <span style={{ fontSize: 9, fontWeight: 700, background: "#1c3a1c", color: "#4ade80", padding: "1px 5px", borderRadius: 4, flexShrink: 0 }}>WAITING</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4, marginBottom: 7 }}>
            {[["Trade Target", $$target(a.limit)], ["Profit Target", a.stageTarget ? $$(a.stageTarget) : "—"], ["Daily Loss", a.dailyLossLimit ? $$(a.dailyLossLimit) : "—"], ["Acct #", a.accountNumber ?? "—"], ["Trading Days", a.tradingDays ?? 0], ["Days Left", a.tradingDaysLeft ?? "—"], ["Multiplier", a.contractMultiplier ?? 1]].map(([lbl, val]) => (
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
                {fi.stageId && (() => {
                  const sel = availableStages.find(s => s.id === fi.stageId);
                  return sel ? (
                    <div style={{ gridColumn: "1/-1" }}>
                      <div style={{ fontSize: 9, color: "#6b7280", textTransform: "uppercase", marginBottom: 2 }}>Stage Target Override (optional)</div>
                      <input type="number" placeholder={`Default: ${$$(sel.target)}`} value={fi.stageTargetOverride || ""} onChange={e => setFI("stageTargetOverride", e.target.value)}
                        style={{ background: "#111827", border: "1px solid #2d3f50", borderRadius: 4, color: "#fff", fontSize: 9, width: "100%", padding: "3px 4px", outline: "none", boxSizing: "border-box" }} />
                      <div style={{ fontSize: 9, color: "#6b7280", marginTop: 2 }}>Default: <strong style={{ color: "#9ca3af" }}>{$$(sel.target)}</strong></div>
                    </div>
                  ) : null;
                })()}
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
        <div key={a.id} style={{ background: typeCardBg, border: `1px solid ${typeCardBorder}`, borderRadius: 8, padding: "8px 10px", marginBottom: 4, opacity: isDone ? 0.45 : 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 7 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: isDone ? "#4b5563" : "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>{header}</span>
            {a.status === "Live" && !isDone && <span style={{ fontSize: 9, fontWeight: 700, background: "#7f1d1d", color: "#fca5a5", padding: "1px 5px", borderRadius: 4, flexShrink: 0 }}>LIVE</span>}
            <span style={{ fontSize: 12, fontWeight: 800, background: `${psColor}22`, color: psColor, padding: "1px 7px", borderRadius: 99, flexShrink: 0, border: `1px solid ${psColor}` }}>{payoutScore ?? "—"}</span>
            <span style={{ fontSize: 12, fontWeight: 800, background: `${dsColor}22`, color: dsColor, padding: "1px 7px", borderRadius: 99, flexShrink: 0, border: `1px solid ${dsColor}` }}>{daysScore ?? "—"}</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 4, marginBottom: 7 }}>
            {[
              ["Trade Target", $$target(a.limit)],
              ["Profit Target", a.stageTarget ? $$(a.stageTarget) : "—"],
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
      <div key={a.id} style={{ background: typeCardBg, border: `1px solid ${typeCardBorder}`, borderRadius: 8, padding: "8px 10px", marginBottom: 4, opacity: isDone ? 0.45 : 1 }}>
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
          {a.type === "eval" && a.purchases30 != null && (
            <span style={{ fontSize: 11, fontWeight: 800, background: "#1e3a5f", color: "#93c5fd", padding: "1px 8px", borderRadius: 99, border: "1px solid #3b82f6", flexShrink: 0, whiteSpace: "nowrap" }} title="Purchases last 30 days">
              {a.purchases30}
            </span>
          )}
          <span style={(() => { const sc = a.score; const c = sc == null ? null : sc >= 8 ? "#22c55e" : sc >= 5 ? "#eab308" : "#ef4444"; return { fontSize: 12, fontWeight: 800, background: c ? `${c}22` : "#1f2937", color: c ?? "#4b5563", padding: "1px 8px", borderRadius: 99, flexShrink: 0, border: `1px solid ${c ?? "#374151"}` }; })()}>
            {a.score != null ? a.score : "—"}
          </span>
          {a.status === "Live" && !isDone && <span style={{ fontSize: 9, fontWeight: 700, background: "#7f1d1d", color: "#fca5a5", padding: "1px 5px", borderRadius: 4, flexShrink: 0 }}>LIVE</span>}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4, marginBottom: 7 }}>
          {[
            ["Trade Target", $$target(a.limit)],
            ["Profit Target", a.type === "eval" ? (a.profitTarget ? $$(a.profitTarget) : "—") : (a.stageTarget ? $$(a.stageTarget) : "—")],
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
    const feedNames = sortFeeds(Object.keys(feeds));
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
  function TraderFeedSection({ accounts, color, title, sortFn }) {
    if (accounts.length === 0) return null;
    const allFeeds = sortFeeds([...new Set(accounts.map(a => a.dataProvider || "Other"))]);
    const traderOrder = [];
    const traderGroups = {};
    accounts.forEach(a => {
      const key = a.trader || "__unknown__";
      if (!traderGroups[key]) { traderGroups[key] = { name: a.traderName || "Unknown", accts: [] }; traderOrder.push(key); }
      traderGroups[key].accts.push(a);
    });
    traderOrder.sort((a, b) => (traderGroups[a].name || "").localeCompare(traderGroups[b].name || ""));
    return (
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
          <div style={{ width: 3, height: 16, background: color, borderRadius: 99 }} />
          <span style={{ fontSize: 13, fontWeight: 700, color: "#e5e7eb" }}>{title}</span>
          <span style={{ background: "#1f2937", color: "#9ca3af", fontSize: 10, padding: "1px 6px", borderRadius: 99 }}>{accounts.filter(a => !dones[a.id]).length}</span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: `repeat(${allFeeds.length}, 1fr)`, gap: 8, marginBottom: 4 }}>
          {allFeeds.map(feed => (
            <div key={feed} style={{ fontSize: 10, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: 1, paddingBottom: 3, borderBottom: `1px solid ${color}55`, textAlign: "center" }}>{feed}</div>
          ))}
        </div>
        {traderOrder.map(traderId => {
          const { name, accts } = traderGroups[traderId];
          const feeds = getFeeds(accts, sortFn);
          return (
            <div key={traderId} style={{ marginBottom: 12 }}>
              <div style={{ textAlign: "center", fontSize: 13, fontWeight: 800, color: "#fff", marginBottom: 6, letterSpacing: 0.5 }}>
                {name}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: `repeat(${allFeeds.length}, 1fr)`, gap: 8 }}>
                {allFeeds.map(feed => (
                  <div key={feed}>
                    {(feeds[feed] || []).map(a => AccountMiniCard(a))}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    );
  }
  return (
    <div>
      {breachModalAccount && (
        <BreachModal
          account={breachModalAccount}
          evalTypeList={evalTypeList}
          traders={traders}
          onClose={() => setBreachModalAccount(null)}
          onBreached={id => { setBlowns(prev => ({ ...prev, [id]: true })); setTimeout(() => window.location.reload(), 30000); }}
        />
      )}
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
        <button onClick={submitAllScores} disabled={scoreSaving || dayCompleting}
          style={{ background: scoreSaved ? "#166534" : "#15803d", border: "1px solid #22c55e", borderRadius: 8, padding: "8px 18px", fontSize: 13, fontWeight: 700, color: "#fff", cursor: (scoreSaving || dayCompleting) ? "not-allowed" : "pointer" }}>
          {scoreSaving ? "Saving..." : scoreSaved ? "✓ Saved" : "Submit Scores"}
        </button>
      </div>
      {TraderFeedSection({ accounts: evalAccounts, color: "#ec4899", title: "Evaluation Accounts" })}
      {TraderFeedSection({ accounts: standardPerf, color: "#06b6d4", title: "Performance Accounts" })}
      {TraderFeedSection({ accounts: livePerf, color: "#22c55e", title: "Live & Payout Accounts", sortFn: (a, b) => {
        const lpMax = acc => {
          const amt = acc.stageTarget != null ? acc.stageTarget - acc.bal : null;
          const ps = amt == null ? 0 : amt <= 0 ? 0 : Math.min(10, Math.ceil(amt / 500));
          const ds = acc.tradingDaysLeft == null ? 0 : acc.tradingDaysLeft <= 0 ? 0 : acc.tradingDaysLeft;
          return Math.max(ps, ds);
        };
        return lpMax(a) - lpMax(b);
      } })}
      {FeedGrid({ accounts: waitingPerf, color: "#a855f7", title: "Waiting on Payout" })}
      {doneAccounts.length > 0 && (
        <div style={{ marginTop: 32, borderTop: "1px solid #1f2937", paddingTop: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <div style={{ width: 3, height: 16, background: "#374151", borderRadius: 99 }} />
            <span style={{ fontSize: 13, fontWeight: 700, color: "#4b5563" }}>Done Today</span>
            <span style={{ background: "#1f2937", color: "#4b5563", fontSize: 10, padding: "1px 6px", borderRadius: 99 }}>{doneAccounts.length}</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 6 }}>
            {doneAccounts.map(a => {
              const header = [a.traderName || a.name, a.firmName || a.dataProvider || "—"].filter(Boolean).join(" — ");
              return (
                <div key={a.id} style={{ background: "#111827", border: "1px solid #1f2937", borderRadius: 8, padding: "7px 10px", display: "flex", alignItems: "center", gap: 8 }}>
                  <input type="checkbox" checked onChange={() => onDone && onDone(a.id)} style={{ width: 14, height: 14, cursor: "pointer", flexShrink: 0, accentColor: "#4b5563" }} />
                  <span style={{ fontSize: 11, fontWeight: 600, color: "#4b5563", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{header}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 20 }}>
        <button onClick={completeDay} disabled={scoreSaving || dayCompleting}
          style={{ background: dayCompleted ? "#1e3a5f" : "#1d4ed8", border: "1px solid #3b82f6", borderRadius: 8, padding: "8px 18px", fontSize: 13, fontWeight: 700, color: "#fff", cursor: (scoreSaving || dayCompleting) ? "not-allowed" : "pointer" }}>
          {dayCompleting ? "Completing..." : dayCompleted ? "✓ Day Complete" : "Complete Day"}
        </button>
      </div>
    </div>
  );
}
