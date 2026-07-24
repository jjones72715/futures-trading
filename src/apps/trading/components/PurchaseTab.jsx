import React, { useState, useEffect } from "react";
import { $$ } from "../utils/format.js";
import { fetchTable, createRecord, updateRecord } from "../services/airtable.js";
import { PURCHASE_TABLE, EVAL_TABLE, EVAL_TYPE_TABLE, TRADERS_TABLE, PERF_TABLE, PERF_TYPES_TABLE, FIRMS_TABLE } from "../config/tables.js";
import { EvalTypePricingPanel } from "./EvalTypePricingPanel.jsx";


export function PurchaseTab() {
  const C = { bg: "#0d1117", card: "#1f2a37", border: "#2d3f50" };
  const sel = { background: "#111827", border: "1px solid #2d3f50", borderRadius: 8, padding: "8px 12px", fontSize: 13, color: "#fff", width: "100%", outline: "none" };
  const inp = { background: "#111827", border: "1px solid #2d3f50", borderRadius: 8, padding: "8px 12px", fontSize: 13, color: "#fff", width: "100%", outline: "none", boxSizing: "border-box" };
  const subTabStyle = (active) => ({ background: active ? "#2563eb" : "#1f2a37", color: active ? "#fff" : "#aaa", border: `1px solid ${active ? "#3b82f6" : "#2f3b4a"}`, borderRadius: 8, padding: "8px 18px", fontSize: 13, fontWeight: 600, cursor: "pointer" });
  const pillStyle = (active) => ({ background: active ? "#1f3a5f" : "#18222f", color: active ? "#7dd3fc" : "#888", border: `1px solid ${active ? "#3b82f6" : "#2a3442"}`, borderRadius: 999, padding: "4px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" });

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
  const [accountWeightOverride, setAccountWeightOverride] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [err, setErr] = useState(null);
  const [recentPurchases, setRecentPurchases] = useState([]);
  const [loadingRecent, setLoadingRecent] = useState(true);
  const [traderId, setTraderId] = useState("");
  const [showAllRecent, setShowAllRecent] = useState(false);
  const [evalTypeList, setEvalTypeList] = useState([]);
  const [perfTypeListForPurchase, setPerfTypeListForPurchase] = useState([]);
  const [traderList, setTraderList] = useState([]);
  const [traders, setTraders] = useState([]);
  const [purchaseCountsByTrader, setPurchaseCountsByTrader] = useState({});
  const [evalPriceEdits, setEvalPriceEdits] = useState({});
  const [allowedTraderEdits, setAllowedTraderEdits] = useState([]);
  const [firmList, setFirmList] = useState([]);
  const [selectedDataProvider, setSelectedDataProvider] = useState("");
  const [selectedFirmId, setSelectedFirmId] = useState("");
  const [perfAccounts, setPerfAccounts] = useState([]);
  const [perfTypeFirmMap, setPerfTypeFirmMap] = useState({});

  useEffect(() => {
    loadActivePurchases();
    loadEvalAccounts();
    loadRecent();
    loadEvalTypes();
    loadTraders();
    loadStraightToFundedTypes();
    loadFirms();
    loadPerfAccounts();
    loadPerfTypeFirms();
  }, []);

  const selectedEvalTypeForPanel = evalTypeList.find(t => t.id === evalTypeId && !evalTypeId.startsWith("perf:"));

  useEffect(() => {
    setEvalPriceEdits({});
    setAllowedTraderEdits(selectedEvalTypeForPanel?.allowedTraders ?? []);
  }, [evalTypeId]);

  async function handleSaveEvalTypeChanges() {
    await fetch("/.netlify/functions/airtable?action=updateEvalType", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        recordId: selectedEvalTypeForPanel.id,
        ...evalPriceEdits,
        allowedTraders: allowedTraderEdits,
      }),
    });
    setEvalPriceEdits({});
    await loadEvalTypes();
  }

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
      const records = await fetchTable(EVAL_TABLE, ["Name", "Status", "Evaluation Account Type", "Number of Accounts", "Date Started", "Trader"]);
      setEvalAccounts(records.filter(r => r.fields["Status"] === "Active"));
    } catch (e) {}
  }

  async function loadPerfAccounts() {
    try {
      const records = await fetchTable(PERF_TABLE, ["Trader", "Performance Account Type", "Status"]);
      setPerfAccounts(records);
    } catch (e) {}
  }

  async function loadPerfTypeFirms() {
    try {
      const records = await fetchTable(PERF_TYPES_TABLE, ["Firm"]);
      const map = {};
      records.forEach(r => { map[r.id] = r.fields["Firm"] || []; });
      setPerfTypeFirmMap(map);
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
      const evalTypes = await fetchTable(EVAL_TYPE_TABLE, ["Name", "Account Size", "Profit Target", "Drawdown Limit", "Daily Loss Limit", "Max Contracts", "Account Weight (Calc)", "Consistency %", "New Eval Cost", "Reset Eval Cost", "Activation Cost", "Value Score", "Allowed Traders", "Firm"]);
      setEvalTypeList(evalTypes.map(r => ({
        id: r.id,
        name: r.fields["Name"],
        accountSize: r.fields["Account Size"] || 0,
        cost: r.fields["Cost Per Account"] || 0,
        drawdownLimit: r.fields["Drawdown Limit"] || 0,
        accountWeight: r.fields["Account Weight (Calc)"] || null,
        consistencyPct: r.fields["Consistency %"] ?? null,
        newEvalCost: r.fields["New Eval Cost"] ?? null,
        resetEvalCost: r.fields["Reset Eval Cost"] ?? null,
        activationCost: r.fields["Activation Cost"] ?? null,
        valueScore: r.fields["Value Score"] ?? null,
        allowedTraders: (r.fields["Allowed Traders"] ?? []).map(t => typeof t === "object" ? t.id : t),
        firmIds: r.fields["Firm"] || [],
      })).sort((a, b) => a.name.localeCompare(b.name)));
    } catch (e) {}
  }

  async function loadStraightToFundedTypes() {
    try {
      const recs = await fetchTable(PERF_TYPES_TABLE, ["Name", "Account Size", "Activation Fee", "Firm"]);
      const filtered = recs.filter(r => {
        const name = (r.fields["Name"] || "").toLowerCase();
        return name.includes("yrm") || name.includes("savius");
      }).map(r => ({
        id: r.id,
        name: r.fields["Name"],
        accountSize: r.fields["Account Size"] || 0,
        cost: r.fields["Activation Fee"] || 0,
        firmIds: r.fields["Firm"] || [],
      })).sort((a, b) => a.name.localeCompare(b.name));
      setPerfTypeListForPurchase(filtered);
    } catch (e) {}
  }

  async function loadFirms() {
    try {
      const records = await fetchTable(FIRMS_TABLE, ["Name", "Data Provider"]);
      setFirmList(records.map(r => ({
        id: r.id,
        name: r.fields["Name"] || "Unknown",
        dataProvider: r.fields["Data Provider"] || "",
      })));
    } catch (e) {}
  }

  async function loadTraders() {
    try {
      const records = await fetchTable(TRADERS_TABLE, ["Name", "Preferred Name"]);
      setTraders(records.map(r => ({
        id: r.id,
        name: r.fields["Name"] ?? r.fields["Preferred Name"] ?? "Unknown",
      })));
      setTraderList(records.map(r => ({
        id: r.id,
        name: r.fields["Name"] ?? "Unknown",
        preferredName: r.fields["Preferred Name"] ?? (r.fields["Name"] ?? "Unknown").split(" ")[0],
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
    if (typeId.startsWith("perf:")) {
      const pt = perfTypeListForPurchase.find(t => t.id === typeId.slice(5));
      if (pt) setCostPer(pt.cost ? pt.cost.toString() : "");
    } else {
      const et = evalTypeList.find(t => t.id === typeId);
      if (et) setCostPer(et.cost.toString());
    }
  }

  function resetForm(keepMode) {
    if (!keepMode) { setMode("reset"); setShowAllRecent(false); }
    setSelectedPurchaseId("");
    setSelectedEvalId("");
    setEvalTypeId("");
    setCostPer("");
    setNotes("");
    setAccountNumber("");
    setAccountWeightOverride("");
    setNumAccounts(1);
    setDate(today);
    setDateStarted(today);
    setSelectedDataProvider("");
    setSelectedFirmId("");
  }

  const firmById = Object.fromEntries(firmList.map(f => [f.id, f]));
  const purchasableTypes = [...evalTypeList, ...perfTypeListForPurchase];
  const evalTypeFirmMap = Object.fromEntries(evalTypeList.map(t => [t.id, t.firmIds || []]));

  const openFirmIdsForTrader = (() => {
    const s = new Set();
    if (!traderId) return s;
    evalAccounts.forEach(r => {
      const tid = Array.isArray(r.fields["Trader"]) ? r.fields["Trader"][0] : null;
      if (tid !== traderId) return;
      const typeArr = r.fields["Evaluation Account Type"];
      const typeId = Array.isArray(typeArr) ? (typeof typeArr[0] === "string" ? typeArr[0] : typeArr[0]?.id) : null;
      (evalTypeFirmMap[typeId] || []).forEach(fid => s.add(fid));
    });
    perfAccounts.forEach(r => {
      const tid = Array.isArray(r.fields["Trader"]) ? r.fields["Trader"][0] : null;
      if (tid !== traderId) return;
      const typeArr = r.fields["Performance Account Type"];
      const typeId = Array.isArray(typeArr) ? (typeof typeArr[0] === "string" ? typeArr[0] : typeArr[0]?.id) : null;
      (perfTypeFirmMap[typeId] || []).forEach(fid => s.add(fid));
    });
    return s;
  })();

  const dataProviders = Array.from(new Set(
    purchasableTypes.flatMap(t => (t.firmIds || []).map(fid => firmById[fid]?.dataProvider).filter(Boolean))
  )).sort();
  const allFirmsForSelectedProvider = selectedDataProvider
    ? Array.from(new Set(
        purchasableTypes
          .filter(t => (t.firmIds || []).some(fid => firmById[fid]?.dataProvider === selectedDataProvider))
          .flatMap(t => t.firmIds)
      ))
        .map(fid => firmById[fid])
        .filter(f => f && f.dataProvider === selectedDataProvider)
        .sort((a, b) => a.name.localeCompare(b.name))
    : [];
  const firmsForProvider = allFirmsForSelectedProvider.filter(f => !openFirmIdsForTrader.has(f.id));
  const filteredEvalTypes = selectedFirmId ? evalTypeList.filter(t => (t.firmIds || []).includes(selectedFirmId)) : [];
  const filteredPerfTypes = selectedFirmId ? perfTypeListForPurchase.filter(t => (t.firmIds || []).includes(selectedFirmId)) : [];

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
          if (accountWeightOverride) resetFields["Account Weight Override"] = parseFloat(accountWeightOverride);
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
      } else if (evalTypeId.startsWith("perf:")) {
        // Straight to Funded: create perf account directly
        const actualPerfTypeId = evalTypeId.slice(5);
        const pt = perfTypeListForPurchase.find(t => t.id === actualPerfTypeId);
        const perfAccountSize = pt ? pt.accountSize : 0;
        const traderObj = traderList.find(t => t.id === traderId);
        const traderFirst = traderObj?.name?.split(" ")[0] || "Unknown";
        const perfAccountFields = {
          "Name": `${traderFirst} - ${pt?.name}`,
          "Status": "Active",
          "Current Balance": perfAccountSize,
          "Date Activated": date,
          "Number of Accounts": parseInt(numAccounts),
          "Performance Account Type": [actualPerfTypeId],
          "Trader": [traderId],
        };
        if (accountNumber) perfAccountFields["Account Number"] = accountNumber;
        const newPerfRecord = await createRecord(PERF_TABLE, perfAccountFields);
        const newPerfId = newPerfRecord?.id;
        const purchaseFields = {
          "Name": `${traderObj?.name || "Unknown"} - ${pt?.name} - ${date}`,
          "Date Purchased": date,
          "Number of Accounts": parseInt(numAccounts),
          "Cost Per Account": parseFloat(costPer) || 0,
          "Purchase Type": "New",
          "Status": "Active",
          "Performance Account Type": [actualPerfTypeId],
          "Trader": [traderId],
        };
        if (newPerfId) purchaseFields["Performance Account"] = [newPerfId];
        if (notes) purchaseFields["Notes"] = notes;
        await createRecord(PURCHASE_TABLE, purchaseFields);
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
        if (accountWeightOverride) evalAccountFields["Account Weight Override"] = parseFloat(accountWeightOverride);

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
                {selectedEvalTypeForPanel && <EvalTypePricingPanel
                  evalType={selectedEvalTypeForPanel}
                  traders={traders}
                  evalPriceEdits={evalPriceEdits}
                  setEvalPriceEdits={setEvalPriceEdits}
                  allowedTraderEdits={allowedTraderEdits}
                  setAllowedTraderEdits={setAllowedTraderEdits}
                  onSave={handleSaveEvalTypeChanges}
                />}
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
                  <div style={{ gridColumn: "1/-1" }}>
                    {label("Account Weight Override (optional)")}
                    {(() => {
                      const et = evalTypeList.find(t => t.id === evalTypeId);
                      const dd = et?.drawdownLimit || 0;
                      const suggested = dd > 0 && totalCost > 0 ? Math.round((5 * totalCost / dd) * 100) / 100 : null;
                      return (
                        <>
                          <input type="number" placeholder="Optional" value={accountWeightOverride} onChange={e => setAccountWeightOverride(e.target.value)} style={inp} />
                          <div style={{ fontSize: 11, marginTop: 4, display: "flex", gap: 12 }}>
                            {et?.accountWeight != null && <span style={{ color: "#9ca3af" }}>Current: <strong style={{ color: "#e5e7eb" }}>{et.accountWeight}</strong></span>}
                            {suggested != null && <span style={{ color: "#60a5fa" }}>Suggested: <strong>{suggested}</strong></span>}
                          </div>
                        </>
                      );
                    })()}
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
            {traderId && <>
            <div style={{ marginBottom: 12 }}>
              {label("Data Provider")}
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {dataProviders.map(dp => {
                  const active = selectedDataProvider === dp;
                  return (
                    <button key={dp}
                      onClick={() => { setSelectedDataProvider(active ? "" : dp); setSelectedFirmId(""); setEvalTypeId(""); setCostPer(""); }}
                      style={pillStyle(active)}>
                      {dp}
                    </button>
                  );
                })}
              </div>
            </div>

            {selectedDataProvider && (
              <div style={{ marginBottom: 12 }}>
                {label("Firm")}
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {firmsForProvider.length === 0 && (
                    <div style={{ color: "#6b7280", fontSize: 12 }}>
                      {allFirmsForSelectedProvider.length > 0
                        ? "This trader already has an open account at every firm on this data provider."
                        : "No firms found for this data provider."}
                    </div>
                  )}
                  {firmsForProvider.map(f => {
                    const active = selectedFirmId === f.id;
                    return (
                      <button key={f.id}
                        onClick={() => { setSelectedFirmId(active ? "" : f.id); setEvalTypeId(""); setCostPer(""); }}
                        style={pillStyle(active)}>
                        {f.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div style={{ marginBottom: 16 }}>
              {label("Account Type")}
              <select value={evalTypeId} onChange={e => handleEvalTypeChange(e.target.value)} style={sel} disabled={!selectedFirmId}>
                <option value="">{selectedFirmId ? "Choose type..." : "Select a data provider and firm first"}</option>
                {filteredEvalTypes.length > 0 && (
                  <optgroup label="Evaluation Accounts">
                    {filteredEvalTypes.map(t => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </optgroup>
                )}
                {filteredPerfTypes.length > 0 && (
                  <optgroup label="Straight to Funded">
                    {filteredPerfTypes.map(t => (
                      <option key={t.id} value={`perf:${t.id}`}>{t.name}</option>
                    ))}
                  </optgroup>
                )}
              </select>
            </div>

            {selectedEvalTypeForPanel && <EvalTypePricingPanel
              evalType={selectedEvalTypeForPanel}
              traders={traders}
              evalPriceEdits={evalPriceEdits}
              setEvalPriceEdits={setEvalPriceEdits}
              allowedTraderEdits={allowedTraderEdits}
              setAllowedTraderEdits={setAllowedTraderEdits}
              onSave={handleSaveEvalTypeChanges}
            />}

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
              <div>
                {label("Account Number")}
                <input type="text" placeholder="Optional" value={accountNumber} onChange={e => setAccountNumber(e.target.value)} style={inp} />
              </div>
              <div>
                {label("Account Weight Override")}
                {(() => {
                  const et = evalTypeList.find(t => t.id === evalTypeId);
                  const dd = et?.drawdownLimit || 0;
                  const suggested = dd > 0 && totalCost > 0 ? Math.round((5 * totalCost / dd) * 100) / 100 : null;
                  return (
                    <>
                      <input type="number" placeholder="Optional" value={accountWeightOverride} onChange={e => setAccountWeightOverride(e.target.value)} style={inp} />
                      <div style={{ fontSize: 11, marginTop: 4, display: "flex", gap: 12 }}>
                        {et?.accountWeight != null && <span style={{ color: "#9ca3af" }}>Current: <strong style={{ color: "#e5e7eb" }}>{et.accountWeight}</strong></span>}
                        {suggested != null && <span style={{ color: "#60a5fa" }}>Suggested: <strong>{suggested}</strong></span>}
                      </div>
                    </>
                  );
                })()}
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
