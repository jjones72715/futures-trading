import React from "react";
import { $$ } from "../utils/format.js";
import { updateRecord, createRecord, fetchTable } from "../services/airtable.js";
import { EVAL_TABLE, PURCHASE_TABLE, EVAL_TYPE_TABLE } from "../config/tables.js";
import { EvalTypePricingPanel } from "./EvalTypePricingPanel.jsx";

export function BreachModal({ account, evalTypeList, traders = [], onClose, onBreached }) {
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
  const [accountWeightOverride, setAccountWeightOverride] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [err, setErr] = React.useState(null);
  const [evalPriceEdits, setEvalPriceEdits] = React.useState({});
  const [allowedTraderEdits, setAllowedTraderEdits] = React.useState([]);
  const [localEvalTypeList, setLocalEvalTypeList] = React.useState(evalTypeList);

  const selectedEvalTypePricing = localEvalTypeList.find(t => t.id === evalTypeId) ?? null;

  React.useEffect(() => {
    setEvalPriceEdits({});
    setAllowedTraderEdits(selectedEvalTypePricing?.allowedTraders ?? []);
  }, [evalTypeId]);

  async function handleSaveEvalTypeChanges() {
    if (!selectedEvalTypePricing) return;
    await fetch("/.netlify/functions/airtable?action=updateEvalType", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        recordId: selectedEvalTypePricing.id,
        ...evalPriceEdits,
        allowedTraders: allowedTraderEdits,
      }),
    });
    setEvalPriceEdits({});
    // Refresh eval types locally
    const rows = await fetchTable(EVAL_TYPE_TABLE, ["Name", "Account Size", "Profit Target", "Drawdown Limit", "Daily Loss Limit", "Max Contracts", "Account Weight (Calc)", "Consistency %", "New Eval Cost", "Reset Eval Cost", "Activation Cost", "Value Score", "Allowed Traders"]);
    setLocalEvalTypeList(rows.map(r => ({
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
    })).sort((a, b) => a.name.localeCompare(b.name)));
  }

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
    const evalType = localEvalTypeList.find(t => t.id === evalTypeId);
    if (!evalType || !costPer || !date) { setErr("Fill in all required fields."); return; }
    setSubmitting(true); setErr(null);
    try {
      // Save any pricing/trader edits back to the eval type record
      const hasPriceEdits = Object.keys(evalPriceEdits).length > 0;
      const hasTraderEdits = JSON.stringify([...allowedTraderEdits].sort()) !== JSON.stringify([...(evalType.allowedTraders ?? [])].sort());
      if (hasPriceEdits || hasTraderEdits) {
        await fetch("/.netlify/functions/airtable?action=updateEvalType", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ recordId: evalTypeId, ...evalPriceEdits, allowedTraders: allowedTraderEdits }),
        });
      }
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
      if (accountWeightOverride) newEvalFields["Account Weight Override"] = parseFloat(accountWeightOverride);
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

  const evalType = localEvalTypeList.find(t => t.id === evalTypeId);
  const totalCost = (parseFloat(costPer) || 0) * numAccounts;
  const inp = { background: "#0f172a", border: "1px solid #374151", borderRadius: 6, color: "#fff", fontSize: 13, padding: "7px 10px", width: "100%", outline: "none", boxSizing: "border-box" };
  const lbl = text => <div style={{ fontSize: 11, fontWeight: 600, color: "#9ca3af", marginBottom: 5, textTransform: "uppercase", letterSpacing: 0.5 }}>{text}</div>;

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }} onClick={onClose}>
      <div style={{ background: "#1f2a37", border: "1px solid #374151", borderRadius: 12, padding: 24, width: step === "reset" ? 860 : 440, maxWidth: "97vw", maxHeight: "92vh", overflowY: "auto" }} onClick={e => e.stopPropagation()}>
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
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, alignItems: "start" }}>
              {/* Left: eval type selector + pricing panel */}
              <div>
                <div style={{ marginBottom: 14 }}>
                  {lbl("Evaluation Type")}
                  <select value={evalTypeId} onChange={e => { setEvalTypeId(e.target.value); const et = localEvalTypeList.find(t => t.id === e.target.value); if (et) setCostPer(et.resetEvalCost != null ? et.resetEvalCost.toString() : et.cost.toString()); }} style={{ ...inp, cursor: "pointer" }}>
                    <option value="">Choose type...</option>
                    {localEvalTypeList.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                </div>
                {selectedEvalTypePricing && (
                  <EvalTypePricingPanel
                    evalType={selectedEvalTypePricing}
                    traders={traders}
                    evalPriceEdits={evalPriceEdits}
                    setEvalPriceEdits={setEvalPriceEdits}
                    allowedTraderEdits={allowedTraderEdits}
                    setAllowedTraderEdits={setAllowedTraderEdits}
                    onSave={handleSaveEvalTypeChanges}
                    showSave={false}
                  />
                )}
              </div>
              {/* Right: reset form fields */}
              <div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
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
                  <div style={{ gridColumn: "1 / -1" }}>
                    {lbl("Account Number (optional)")}
                    <input type="text" placeholder="e.g. ABC123" value={newAccountNumber} onChange={e => setNewAccountNumber(e.target.value)} style={inp} />
                  </div>
                  <div style={{ gridColumn: "1 / -1" }}>
                    {lbl("Account Weight Override (optional)")}
                    {(() => {
                      const et = localEvalTypeList.find(t => t.id === evalTypeId);
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
                  <div style={{ gridColumn: "1 / -1" }}>
                    {lbl("Notes (optional)")}
                    <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} style={{ ...inp, resize: "vertical", fontFamily: "inherit" }} />
                  </div>
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
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
