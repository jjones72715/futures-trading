import React, { useState, useEffect, useRef } from "react";
import { $$ } from "../utils/format.js";
import { fetchTable } from "../services/airtable.js";
import { PURCHASE_TABLE, PAYOUT_TABLE } from "../config/tables.js";
import { OTHER_TRADERS, TRADER_NAMES } from "../config/constants.js";

export function PLTab({ evalAccounts, perfAccounts }) {
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

  const RITHMIC_DX = ["Rithmic", "DX Feed"];

  useEffect(() => { loadPLData(); }, []);

  const handleDateSubmit = () => {
    const m = dateM.replace(/\D/g, "").padStart(2, "0");
    const d = dateD.replace(/\D/g, "").padStart(2, "0");
    if (dateM.length >= 1 && dateD.length >= 1 && dateY.length === 4) {
      setSelectedDate(`${dateY}-${m}-${d}`);
    }
  };

  async function loadPLData() {
    setLoading(true);
    try {
      const [purchaseRecords, payoutRecords] = await Promise.all([
        fetchTable(PURCHASE_TABLE, ["Date Purchased", "Status", "Total Cost", "Purchase Type"]),
        fetchTable(PAYOUT_TABLE, ["Name", "Total Amount", "Date Received", "Trader", "Performance Account", "Status", "Number of Accounts", "Payout Tier"]),
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
        payoutTierPct: r.fields["Payout Tier"] != null ? r.fields["Payout Tier"] : null,
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
  const fallbackTier = totalLiq <= 5000 ? 0.40 : totalLiq <= 10000 ? 0.50 : totalLiq <= 20000 ? 0.60 : 0.70;
  const liqReduction = dayPayouts.reduce((sum, p) => {
    const t = p.payoutTierPct != null ? p.payoutTierPct : fallbackTier;
    return sum + (p.totalAmount || 0) * t;
  }, 0);
  const endingLiq = totalLiq - liqReduction;

  const payoutRows = dayPayouts.map(p => {
    const traderId = typeof p.trader === "object" ? p.trader?.id : p.trader;
    const traderName = TRADER_NAMES[traderId] ?? p.trader ?? "—";
    const t = p.payoutTierPct != null ? p.payoutTierPct : fallbackTier;
    const totalPayout  = Math.round(p.totalAmount || 0);
    const liqRepayment = Math.round(totalPayout * t);
    const afterLiq     = Math.round(totalPayout - liqRepayment);
    const taxSet       = Math.round(totalPayout * 0.10);
    const traderProfit = Math.round(afterLiq * 0.65 - taxSet);
    return { traderName, totalPayout, liqRepayment, afterLiq, taxSet, traderProfit, tierPct: Math.round(t * 100) };
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

  const payoutAccountsValue = perfAccounts
    .filter(a => a.status === "Live" || (a.payoutAccount && a.status === "Active") || a.status === "Waiting on Payout")
    .reduce((s, a) => {
      const acctValue = a.contractMultiplier > 0 ? a.ddLeft * a.n / a.contractMultiplier : a.ddLeft;
      return s + acctValue;
    }, 0);

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
              {Math.round(fallbackTier * 100)}%
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
                <span style={{ color: "#9ca3af" }}>× {p.payoutTierPct != null ? Math.round(p.payoutTierPct * 100) : Math.round(fallbackTier * 100)}% = <span style={{ color: "#f87171" }}>-${((p.totalAmount || 0) * (p.payoutTierPct != null ? p.payoutTierPct : fallbackTier)).toLocaleString("en-US", { minimumFractionDigits: 2 })}</span></span>
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
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
        <StatBox label="Cashed Out Today" value={$$(cashedOut)} color="#4ade80" />
        <StatBox label="Profit from Others" value={$$(profitFromOthers)} color="#4ade80" />
        <StatBox label="$ in Payout Accounts" value={$$(payoutAccountsValue / 2)} color="#a78bfa" />
      </div>
    </div>
  );
}
