import React, { useState, useEffect } from "react";
import { $$ } from "../utils/format.js";
import { fetchTable } from "../services/airtable.js";
import { TRADERS_TABLE, PURCHASE_TABLE, PAYOUT_TABLE } from "../config/tables.js";

export function TraderPLTab() {
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
          fetchTable(TRADERS_TABLE, ["Name", "Preferred Name", "Tax Account"]),
          fetchTable(PURCHASE_TABLE, ["Trader", "Total Cost", "Purchase Type", "Status", "Date Purchased"]),
          fetchTable(PAYOUT_TABLE, ["Name", "Trader", "Total Amount", "Payout Tier", "Status", "Date Received"]),
        ]);
        setTraders(traderRecs.map(r => ({
          id: r.id,
          name: r.fields["Name"] || "",
          preferredName: r.fields["Preferred Name"] || r.fields["Name"]?.split(" ")[0] || "?",
          taxAccount: r.fields["Tax Account"] || null,
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
            {SummaryCard({ label: "Taxes (10%)", value: $$(totalTaxes), color: "#fbbf24", sub: traders.find(t => t.id === traderId)?.taxAccount ? `Tax Account: ${traders.find(t => t.id === traderId).taxAccount}` : null })}
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
