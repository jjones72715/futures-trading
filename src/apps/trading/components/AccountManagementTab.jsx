import React, { useState, useEffect } from "react";
import { $$ } from "../utils/format.js";
import { fetchTable, createRecord, updateRecord } from "../services/airtable.js";
import { BASE, EVAL_TABLE, PERF_TABLE, PURCHASE_TABLE, TRADERS_TABLE, EVAL_TYPE_TABLE, PAYOUT_TABLE, PERF_TYPES_TABLE, PAYOUT_STRATEGIES_TABLE } from "../config/tables.js";
import { PAYOUT_STATUSES } from "../config/constants.js";
import { EvalTypePricingPanel } from "./EvalTypePricingPanel.jsx";

export function AccountManagementTab() {
  const [evalToPerfMap, setEvalToPerfMap] = useState({});
  const [evalTypePricingMap, setEvalTypePricingMap] = useState({});
  const [perfTypes, setPerfTypes] = useState([]);
  const [payoutStrategies, setPayoutStrategies] = useState([]);
  const [traders, setTraders] = useState([]);
  const [evalPriceEdits, setEvalPriceEdits] = useState({});
  const [allowedTraderEdits, setAllowedTraderEdits] = useState([]);

  useEffect(() => {
    Promise.all([
      fetchTable(EVAL_TYPE_TABLE, ["Name", "Performance Account Type", "Drawdown Limit", "Consistency %", "New Eval Cost", "Reset Eval Cost", "Activation Cost", "Value Score", "Allowed Traders"]),
      fetchTable(PERF_TYPES_TABLE, ["Name", "Account Size"]),
      fetchTable(PAYOUT_STRATEGIES_TABLE, ["Name", "Account Type", "Stage Number", "Stage Target", "On Completion Go To"]),
      fetchTable(TRADERS_TABLE, ["Name", "Preferred Name"]),
    ]).then(([evalTypeRecords, perfTypeRecords, strategyRecords, traderRecords]) => {
      const map = {};
      const pricingMap = {};
      evalTypeRecords.forEach(r => {
        const pt = r.fields["Performance Account Type"];
        if (Array.isArray(pt) && pt.length > 0) map[r.id] = pt[0].id || pt[0];
        pricingMap[r.id] = {
          id: r.id,
          name: r.fields["Name"] ?? "",
          drawdownLimit: r.fields["Drawdown Limit"] ?? 0,
          consistencyPct: r.fields["Consistency %"] ?? null,
          newEvalCost: r.fields["New Eval Cost"] ?? null,
          resetEvalCost: r.fields["Reset Eval Cost"] ?? null,
          activationCost: r.fields["Activation Cost"] ?? null,
          valueScore: r.fields["Value Score"] ?? null,
          allowedTraders: (r.fields["Allowed Traders"] ?? []).map(t => typeof t === "object" ? t.id : t),
        };
      });
      setEvalToPerfMap(map);
      setEvalTypePricingMap(pricingMap);
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
      setTraders(traderRecords.map(r => ({
        id: r.id,
        name: r.fields["Name"] ?? r.fields["Preferred Name"] ?? "Unknown",
      })));
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
  const [allPerfRecords, setAllPerfRecords] = useState([]);
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
  const [resetTradingDays, setResetTradingDays] = useState(true);
  const [advancePayoutAmount, setAdvancePayoutAmount] = useState("");
  const [stageTargetOverride, setStageTargetOverride] = useState("");
  const [payoutDateRequested, setPayoutDateRequested] = useState(today);
  const [payoutNumAccounts, setPayoutNumAccounts] = useState("");

  // Payout Management state
  const [selectedPayoutId, setSelectedPayoutId] = useState("");
  const [payoutAction, setPayoutAction] = useState(""); // "status" or "receive"
  const [newPayoutStatus, setNewPayoutStatus] = useState("");
  const [receivedAmount, setReceivedAmount] = useState("");
  const [receivedDate, setReceivedDate] = useState(today);
  const [postPayoutBalance, setPostPayoutBalance] = useState("");
  const [postPayoutStageId, setPostPayoutStageId] = useState("");
  const [postPayoutStageOverride, setPostPayoutStageOverride] = useState("");
  const [postPayoutMultiplier, setPostPayoutMultiplier] = useState("");
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

  useEffect(() => {
    const etId = selectedEvalId
      ? evalAccounts.find(r => r.id === selectedEvalId)?.fields["Evaluation Account Type"]?.[0]
      : null;
    const pricing = etId ? evalTypePricingMap[etId] : null;
    setEvalPriceEdits({});
    setAllowedTraderEdits(pricing?.allowedTraders ?? []);
  }, [selectedEvalId]);

  async function handleSaveEvalTypeChanges(evalTypeId) {
    await fetch("/.netlify/functions/airtable?action=updateEvalType", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        recordId: evalTypeId,
        ...evalPriceEdits,
        allowedTraders: allowedTraderEdits,
      }),
    });
    setEvalPriceEdits({});
    // Refresh pricing map
    const updated = await fetchTable(EVAL_TYPE_TABLE, ["Name", "Performance Account Type", "Drawdown Limit", "Consistency %", "New Eval Cost", "Reset Eval Cost", "Activation Cost", "Value Score", "Allowed Traders"]);
    const pricingMap = {};
    updated.forEach(r => {
      pricingMap[r.id] = {
        id: r.id,
        name: r.fields["Name"] ?? "",
        drawdownLimit: r.fields["Drawdown Limit"] ?? 0,
        consistencyPct: r.fields["Consistency %"] ?? null,
        newEvalCost: r.fields["New Eval Cost"] ?? null,
        resetEvalCost: r.fields["Reset Eval Cost"] ?? null,
        activationCost: r.fields["Activation Cost"] ?? null,
        valueScore: r.fields["Value Score"] ?? null,
        allowedTraders: (r.fields["Allowed Traders"] ?? []).map(t => typeof t === "object" ? t.id : t),
      };
    });
    setEvalTypePricingMap(pricingMap);
  }

  async function loadData() {
    setLoading(true);
    try {
      const [evalRecords, pr, payr] = await Promise.all([
        fetchTable(EVAL_TABLE, ["Name", "Status", "Trader", "Evaluation Account Type", "Number of Accounts", "Current Balance", "Current Drawdown Left"]),
        fetch(`/.netlify/functions/airtable/${BASE}/${PERF_TABLE}?maxRecords=200`).then(r => r.json()),
        fetch(`/.netlify/functions/airtable/${BASE}/${PAYOUT_TABLE}?maxRecords=200`).then(r => r.json()),
      ]);

      const filterByTrader = (records, field = "Trader") =>
        !traderId ? [] : (records || []).filter(r => {
          const t = r.fields[field];
          return Array.isArray(t) && t.includes(traderId);
        });

      const activeEvalRecords = evalRecords.filter(r => {
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
      setAllPerfRecords(activePerfRecords);
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

  // Separate state
  const [sepSelectedId, setSepSelectedId] = useState("");
  const [sepAccountNumbers, setSepAccountNumbers] = useState([]);
  const [sepSubmitting, setSepSubmitting] = useState(false);

  const sepSelected = evalAccounts.find(r => r.id === sepSelectedId);
  const sepN = sepSelected ? (sepSelected.fields["Number of Accounts"] || 1) : 0;

  function resetForm() {
    setSelectedEvalId(""); setStartingBalance(""); setDateActivated(today);
    setNumAccounts(1); setActivationFee(""); setContractMultiplier(1); setPerfAccountNumber("");
    setSelectedPerfId(""); setStageAction(""); setNewBalance("");
    setTradingDays(""); setResetTradingDays(true);
    setAdvancePayoutAmount(""); setStageTargetOverride("");
    setSelectedPayoutId(""); setPayoutAction(""); setNewPayoutStatus("");
    setReceivedAmount(""); setReceivedDate(today); setPostPayoutBalance("");
    setPostPayoutStageId(""); setPostPayoutStageOverride(""); setPostPayoutMultiplier(""); setPayoutTierInput("50"); setPayoutDateRequested(today); setPayoutNumAccounts("");
    setCpTrader(""); setCpPerfTypeId(""); setCpDateRequested(today); setCpDateReceived("");
    setCpAmountPerAccount(""); setCpNumAccounts("1"); setCpStatus("Requested"); setCpTier("50");
    setCpStageId(""); setCpNotes("");
    setSepSelectedId(""); setSepAccountNumbers([]);
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
  const payoutPerf = payoutPerfId ? [...allPerfRecords].find(r => r.id === payoutPerfId) : null;
  const payoutPerfTypeId = payoutPerf
    ? (() => { const v = (payoutPerf.fields["Performance Account Type"] || [])[0]; return typeof v === "string" ? v : v?.id || null; })()
    : null;
  const payoutAvailableStages = payoutStrategies.filter(s => s.perfTypeId === payoutPerfTypeId).sort((a, b) => a.stage - b.stage);

  async function handleConvertEval() {
    if (!perfTypeId) {
      alert("Performance account type not found. Please wait a moment and try again.");
      return;
    }
    if (!selectedEvalId || !perfTypeId || !dateActivated) return;
    setSubmitting(true); setErr(null);
    try {
      const trader = traderList.find(t => t.id === traderId);
      const pt = perfTypes.find(t => t.id === perfTypeId);
      const firstStage = payoutStrategies.find(s => s.perfTypeId === perfTypeId && s.stage === 1);
      await updateRecord(EVAL_TABLE, selectedEvalId, { "Status": "Passed" });
      const perfFields = {
        "Name": `${trader?.name?.split(" ")[0]} - ${pt?.name}`,
        "Status": "Active",
        "Current Balance": 0,
        "High Water Mark": 0,
        "Cycle Start Balance": 0,
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
      if (stageTargetOverride) fields["Stage Target Override"] = parseFloat(stageTargetOverride);
      if (nextStage.stage >= 2) {
        fields["Payout Account"] = true;
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

  async function handleConvertTradeDown() {
    if (!selectedPerfId || !newBalance) return;
    setSubmitting(true); setErr(null);
    try {
      const fields = {
        "Payout Account": true,
        "Current Balance": parseFloat(newBalance),
        "High Water Mark": parseFloat(newBalance),
        "Cycle Start Balance": parseFloat(newBalance),
      };
      if (contractMultiplier) fields["Contract Multiplier"] = parseFloat(contractMultiplier);
      if (stageTargetOverride) fields["Stage Target Override"] = parseFloat(stageTargetOverride);
      if (resetTradingDays) {
        fields["Trading Days this Cycle"] = tradingDays ? parseInt(tradingDays) : 0;
      } else if (tradingDays) {
        fields["Trading Days this Cycle"] = parseInt(tradingDays);
      }
      await updateRecord(PERF_TABLE, selectedPerfId, fields);
      setSuccess("✓ Account converted to Payout Account!");
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
      const perfUpdate = { "Status": "Waiting on Payout", "Payout Account": true };
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

  async function handleSeparate() {
    if (!sepSelected || sepN < 2) return;
    setSepSubmitting(true); setErr(null);
    try {
      const f = sepSelected.fields;
      const baseFields = {
        "Status": "Active",
        "Number of Accounts": 1,
        "Evaluation Account Type": f["Evaluation Account Type"] || [],
        "Trader": f["Trader"] || [],
        "Data Provider": f["Data Provider"] || [],
        "Firm Name": f["Firm Name"] || [],
        "Trading Day Definition": f["Trading Day Definition"] || null,
        "Daily Loss Limit": f["Daily Loss Limit"] || null,
        "Account Weight": f["Account Weight"] || null,
        "Account Weight Override": f["Account Weight Override"] || null,
        "Max Trade Size": f["Max Trade Size"] || null,
        "Drawdown Safety": f["Drawdown Safety"] || null,
        "Current Balance": f["Current Balance"] || null,
        "High Water Mark": f["High Water Mark"] || null,
        "Current Drawdown Left": f["Current Drawdown Left"] || null,
        "Profit Target": f["Profit Target"] || null,
        "Date Started": f["Date Started"] || null,
      };
      await Promise.all(
        sepAccountNumbers.map((acctNum, i) =>
          createRecord(EVAL_TABLE, {
            ...baseFields,
            "Name": `${f["Name"] || "Account"} #${i + 1}`,
            "Account Number": acctNum || null,
          })
        )
      );
      await updateRecord(EVAL_TABLE, sepSelected.id, { "Status": "Inactive" });
      setSuccess(`✓ Separated into ${sepN} individual accounts!`);
      setTimeout(() => setSuccess(""), 4000);
      resetForm(); loadData();
    } catch (e) { setErr("Failed: " + e.message); }
    setSepSubmitting(false);
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
        const perfUpdate = {
          "Status": "Active",
          "Current Balance": parseFloat(postPayoutBalance),
          "High Water Mark": parseFloat(postPayoutBalance),
          "Cycle Start Balance": parseFloat(postPayoutBalance),
          "Current Stage": [postPayoutStageId],
          "Trading Days this Cycle": 0,
          "Number of Payouts Recieved": (payoutPerf?.fields["Number of Payouts Recieved"] || 0) + 1,
        };
        if (postPayoutStageOverride) perfUpdate["Stage Target Override"] = parseFloat(postPayoutStageOverride);
        if (postPayoutMultiplier) perfUpdate["Contract Multiplier"] = parseFloat(postPayoutMultiplier);
        await updateRecord(PERF_TABLE, payoutPerfId, perfUpdate);
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
          <TabBtn id="separate">✂️ Separate</TabBtn>
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
          const countMap = activeTab === "passed_evals" || activeTab === "separate" ? evalCountsByTrader : activeTab === "stage_mgmt" ? perfCountsByTrader : payoutCountsByTrader;
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

                <button onClick={handleConvertEval} disabled={submitting}
                  style={{ width: "100%", background: "#7c3aed", color: "#fff", border: "none", borderRadius: 8, padding: "10px", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
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
                {!(selectedPerf?.fields["Number of Payouts Recieved"] > 0) && (
                  <div onClick={() => setStageAction("tradedown")}
                    style={{ background: "#111827", border: "1px solid #2d3f50", borderRadius: 10, padding: "12px 16px", cursor: "pointer", display: "flex", alignItems: "center", gap: 12 }}>
                    <span style={{ fontSize: 22 }}>⬇️</span>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "#a78bfa" }}>Convert to Payout Account</div>
                      <div style={{ fontSize: 11, color: "#6b7280" }}>Move to payout account without requesting payout</div>
                    </div>
                  </div>
                )}
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
                    {label("Stage Target Override (optional)")}
                    <input type="number" placeholder={nextStage ? `Default: ${$$(nextStage.target)}` : "Enter override..."} value={stageTargetOverride} onChange={e => setStageTargetOverride(e.target.value)} style={inp} />
                    {nextStage && <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 4 }}>Stage {nextStage.stage} default target: <strong style={{ color: "#e5e7eb" }}>{$$(nextStage.target)}</strong></div>}
                  </div>
                  <div style={{ gridColumn: "1/-1" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                      <input type="checkbox" id="resetDays" checked={resetTradingDays} onChange={e => setResetTradingDays(e.target.checked)} style={{ width: 16, height: 16, cursor: "pointer" }} />
                      <label htmlFor="resetDays" style={{ fontSize: 12, color: "#9ca3af", cursor: "pointer" }}>Reset Trading Days</label>
                    </div>
                    <input type="number" placeholder={resetTradingDays ? "Starting days (0 if blank)" : "Days to carry over..."} value={tradingDays} onChange={e => setTradingDays(e.target.value)} style={inp} />
                  </div>
                </div>
                <button onClick={handleStageAdvance} disabled={!newBalance || submitting}
                  style={{ width: "100%", background: newBalance ? "#16a34a" : "#111827", color: newBalance ? "#fff" : "#4b5563", border: "none", borderRadius: 8, padding: "10px", fontSize: 14, fontWeight: 700, cursor: newBalance ? "pointer" : "not-allowed" }}>
                  {submitting ? "Saving..." : `Advance to Stage ${nextStage.stage}`}
                </button>
              </>
            )}

            {selectedPerfId && stageAction === "tradedown" && (
              <>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
                  <button onClick={() => setStageAction("")} style={{ background: "none", border: "none", color: "#6b7280", cursor: "pointer", fontSize: 18, padding: 0 }}>←</button>
                  <span style={{ fontSize: 13, fontWeight: 600, color: "#a78bfa" }}>Convert to Payout Account</span>
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
                    {label("Stage Target Override (optional)")}
                    <input type="number" placeholder={currentStage ? `Default: ${$$(currentStage.target)}` : "Enter override..."} value={stageTargetOverride} onChange={e => setStageTargetOverride(e.target.value)} style={inp} />
                    {currentStage && <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 4 }}>Current stage default target: <strong style={{ color: "#e5e7eb" }}>{$$(currentStage.target)}</strong></div>}
                  </div>
                  <div style={{ gridColumn: "1/-1" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                      <input type="checkbox" id="resetDaysTD" checked={resetTradingDays} onChange={e => setResetTradingDays(e.target.checked)} style={{ width: 16, height: 16, cursor: "pointer" }} />
                      <label htmlFor="resetDaysTD" style={{ fontSize: 12, color: "#9ca3af", cursor: "pointer" }}>Reset Trading Days</label>
                    </div>
                    <input type="number" placeholder={resetTradingDays ? "Starting days (0 if blank)" : "Days to carry over..."} value={tradingDays} onChange={e => setTradingDays(e.target.value)} style={inp} />
                  </div>
                </div>
                <button onClick={handleConvertTradeDown} disabled={!newBalance || submitting}
                  style={{ width: "100%", background: newBalance ? "#6d28d9" : "#111827", color: newBalance ? "#fff" : "#4b5563", border: "none", borderRadius: 8, padding: "10px", fontSize: 14, fontWeight: 700, cursor: newBalance ? "pointer" : "not-allowed" }}>
                  {submitting ? "Saving..." : "⬇️ Convert to Payout Account"}
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
                    <div onClick={() => { setPayoutAction("receive"); setPostPayoutMultiplier((payoutPerf?.fields["Contract Multiplier"] ?? "").toString()); }}
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
                      <div>
                        {label("Contract Multiplier")}
                        <input type="number" min="1" placeholder="1" value={postPayoutMultiplier} onChange={e => setPostPayoutMultiplier(e.target.value)} style={inp} />
                        {payoutPerf?.fields["Contract Multiplier"] != null && <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 4 }}>Current: <strong style={{ color: "#e5e7eb" }}>{payoutPerf.fields["Contract Multiplier"]}</strong></div>}
                      </div>
                      <div style={{ gridColumn: "1/-1" }}>
                        {label("New Account Balance After Payout")}
                        <input type="number" placeholder="e.g. 101200" value={postPayoutBalance} onChange={e => setPostPayoutBalance(e.target.value)} style={inp} />
                      </div>
                      <div style={{ gridColumn: "1/-1" }}>
                        {label("Advance to Stage")}
                        <select value={postPayoutStageId} onChange={e => { setPostPayoutStageId(e.target.value); setPostPayoutStageOverride(""); }} style={sel}>
                          <option value="">Select next stage...</option>
                          {payoutAvailableStages.map(s => (
                            <option key={s.id} value={s.id}>Stage {s.stage} (Target: {$$(s.target)})</option>
                          ))}
                        </select>
                      </div>
                      {postPayoutStageId && (() => {
                        const sel2 = payoutAvailableStages.find(s => s.id === postPayoutStageId);
                        return sel2 ? (
                          <div style={{ gridColumn: "1/-1" }}>
                            {label("Stage Target Override (optional)")}
                            <input type="number" placeholder={`Default: ${$$(sel2.target)}`} value={postPayoutStageOverride} onChange={e => setPostPayoutStageOverride(e.target.value)} style={inp} />
                            <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 4 }}>Default target: <strong style={{ color: "#e5e7eb" }}>{$$(sel2.target)}</strong></div>
                          </div>
                        ) : null;
                      })()}
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

        {/* ── SEPARATE ── */}
        {activeTab === "separate" && (
          <>
            {label("Select Account to Separate")}
            {loading ? <div style={{ color: "#6b7280", fontSize: 12, marginBottom: 16 }}>Loading...</div> : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
                {evalAccounts.filter(r => (r.fields["Number of Accounts"] || 1) > 1).length === 0
                  ? <div style={{ color: "#6b7280", fontSize: 12 }}>No multi-account eval records{traderId ? " for this trader" : ""}.</div>
                  : evalAccounts.filter(r => (r.fields["Number of Accounts"] || 1) > 1).map(r => (
                    <div key={r.id} onClick={() => { setSepSelectedId(r.id); setSepAccountNumbers(Array(r.fields["Number of Accounts"] || 1).fill("")); }}
                      style={{ background: sepSelectedId === r.id ? "#1a2a1a" : "#111827", border: `1px solid ${sepSelectedId === r.id ? "#22c55e" : "#2d3f50"}`, borderRadius: 8, padding: "10px 14px", cursor: "pointer" }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "#fff" }}>{r.fields["Name"]}</div>
                      <div style={{ fontSize: 11, color: "#6b7280", marginTop: 2 }}>×{r.fields["Number of Accounts"]} accounts</div>
                    </div>
                  ))
                }
              </div>
            )}
          </>
        )}
      </div>
      </div>

      {/* Right info panel */}
      <div>
        {activeTab === "passed_evals" && selectedEval && (() => {
          const etId = Array.isArray(selectedEval.fields["Evaluation Account Type"])
            ? selectedEval.fields["Evaluation Account Type"][0]
            : null;
          const evalTypePricing = etId ? evalTypePricingMap[etId] : null;
          return (
            <>
              <div style={{ background: C.card, border: "1px solid #8b5cf6", borderRadius: 12, padding: 20, marginBottom: 16 }}>
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
              {evalTypePricing && (
                <EvalTypePricingPanel
                  evalType={evalTypePricing}
                  traders={traders}
                  evalPriceEdits={evalPriceEdits}
                  setEvalPriceEdits={setEvalPriceEdits}
                  allowedTraderEdits={allowedTraderEdits}
                  setAllowedTraderEdits={setAllowedTraderEdits}
                  onSave={() => handleSaveEvalTypeChanges(evalTypePricing.id)}
                />
              )}
            </>
          );
        })()}

        {activeTab === "stage_mgmt" && selectedPerf && (
          <div style={{ background: C.card, border: "1px solid #3b82f6", borderRadius: 12, padding: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#60a5fa", marginBottom: 12 }}>Performance Account</div>
            {[
              ["Name", selectedPerf.fields["Name"]],
              ["Account #", selectedPerf.fields["Account Number"] || "—"],
              ["Score", selectedPerf.fields["Score"] ?? "—"],
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

        {activeTab === "separate" && sepSelected && (
          <div style={{ background: C.card, border: "1px solid #22c55e", borderRadius: 12, padding: 20 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#22c55e", marginBottom: 4 }}>Separate: {sepSelected.fields["Name"]}</div>
            <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 16 }}>Enter an account number for each of the {sepN} accounts. The original will be marked inactive.</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 20 }}>
              {sepAccountNumbers.map((val, i) => (
                <div key={i}>
                  {label(`Account ${i + 1} Number`)}
                  <input
                    type="text"
                    placeholder={`e.g. ABC${i + 1}`}
                    value={val}
                    onChange={e => setSepAccountNumbers(prev => { const next = [...prev]; next[i] = e.target.value; return next; })}
                    style={inp}
                  />
                </div>
              ))}
            </div>
            {err && <div style={{ color: "#ef4444", fontSize: 12, marginBottom: 10 }}>{err}</div>}
            {success && <div style={{ color: "#22c55e", fontSize: 12, marginBottom: 10 }}>{success}</div>}
            <button onClick={handleSeparate} disabled={sepSubmitting}
              style={{ width: "100%", background: "#15803d", border: "1px solid #22c55e", borderRadius: 8, padding: "10px 0", fontSize: 13, fontWeight: 700, color: "#fff", cursor: "pointer" }}>
              {sepSubmitting ? "Separating..." : `✂️ Separate into ${sepN} Accounts`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
