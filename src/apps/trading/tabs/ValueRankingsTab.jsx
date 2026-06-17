import React, { useState, useEffect } from "react";
import { loadValueRankingsData } from "../services/valueRankingsService.js";

const PROVIDER_ORDER = ["DX Feed", "Rithmic", "Tradovate", "Project X"];

function groupByProvider(items, bestPerFirm = false) {
  const byProvider = {};
  items.forEach(item => {
    const dp = item.dataProvider || "Other";
    if (!byProvider[dp]) byProvider[dp] = [];
    byProvider[dp].push(item);
  });
  Object.values(byProvider).forEach(arr => arr.sort((a, b) => b.score - a.score));
  if (bestPerFirm) {
    Object.keys(byProvider).forEach(dp => {
      const seen = new Set();
      byProvider[dp] = byProvider[dp].filter(item => {
        const key = item.firmId || item.name;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    });
  }
  const providers = Object.keys(byProvider).sort((a, b) => {
    const ia = PROVIDER_ORDER.indexOf(a), ib = PROVIDER_ORDER.indexOf(b);
    if (ia === -1 && ib === -1) return a.localeCompare(b);
    if (ia === -1) return 1;
    if (ib === -1) return -1;
    return ia - ib;
  });
  return { byProvider, providers };
}

export function ValueRankingsTab() {
  const C = { bg: "#0d1117", card: "#1f2a37", border: "#2d3f50" };
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedTrader, setSelectedTrader] = useState(null);

  useEffect(() => {
    loadValueRankingsData()
      .then(setData)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div style={{ color: "#6b7280", fontSize: 13, padding: 16 }}>Loading value rankings...</div>;
  if (error) return <div style={{ background: "#450a0a", border: "1px solid #7f1d1d", color: "#fca5a5", padding: "10px 14px", borderRadius: 8, fontSize: 13, marginBottom: 12 }}>⚠ {error}</div>;
  if (!data) return null;

  const { evalTypes, traders, traderFirmExclusions } = data;

  const displayItems = selectedTrader === null
    ? evalTypes
    : evalTypes.filter(e => {
        const tradersAllowed = e.allowedTraders.length === 0 || e.allowedTraders.includes(selectedTrader);
        if (!tradersAllowed) return false;
        const excluded = traderFirmExclusions[selectedTrader];
        if (excluded && e.firmId && excluded.has(e.firmId)) return false;
        return true;
      });

  const { byProvider, providers } = groupByProvider(displayItems, selectedTrader === null);
  const topLimit = selectedTrader === null ? 20 : 5;
  const topN = [...displayItems].sort((a, b) => b.score - a.score).slice(0, topLimit);

  const allFirmsActive = selectedTrader === null;
  const allFirmsBtnStyle = {
    background: allFirmsActive ? "#ffd700" : "#e5e5e5",
    color: "#000",
    border: `1px solid ${allFirmsActive ? "#d4a800" : "#c8c8c8"}`,
    borderRadius: 999,
    padding: "4px 14px",
    fontSize: 12,
    fontWeight: allFirmsActive ? 800 : 600,
    cursor: "pointer",
    whiteSpace: "nowrap",
  };
  const traderPillStyle = (active) => ({
    background: active ? "#1f3a5f" : "#18222f",
    color: active ? "#7dd3fc" : "#888",
    border: `1px solid ${active ? "#3b82f6" : "#2a3442"}`,
    borderRadius: 999,
    padding: "4px 12px",
    fontSize: 12,
    fontWeight: 600,
    cursor: "pointer",
    whiteSpace: "nowrap",
  });

  const sectionLabel = (text) => (
    <div style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 10 }}>
      {text}
    </div>
  );

  return (
    <div>
      {/* Button bar */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 20 }}>
        <button onClick={() => setSelectedTrader(null)} style={allFirmsBtnStyle}>
          All Firms
        </button>
        {traders.map(t => (
          <button
            key={t.id}
            onClick={() => setSelectedTrader(selectedTrader === t.id ? null : t.id)}
            style={traderPillStyle(selectedTrader === t.id)}
          >
            {t.preferredName}
          </button>
        ))}
      </div>

      {/* Section A: Accounts by Data Provider */}
      <div style={{ marginBottom: 28 }}>
        {sectionLabel(selectedTrader === null ? "Accounts by Data Provider" : "Eligible Accounts by Data Provider")}
        {providers.length === 0 ? (
          <div style={{ color: "#6b7280", fontSize: 13 }}>No accounts with value scores available.</div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: `repeat(${Math.min(providers.length, 4)}, 1fr)`, gap: 12 }}>
            {providers.map(dp => (
              <div key={dp}>
                <div style={{ fontSize: 9, fontWeight: 700, color: "#374151", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 4, paddingBottom: 2, borderBottom: "1px solid #1f2937" }}>
                  {dp}
                </div>
                {byProvider[dp].map(item => (
                  <div key={item.id} style={{ background: "#111827", border: "1px solid #1f2937", borderRadius: 6, padding: "6px 8px", marginBottom: 3 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: "#d1d5db", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginBottom: 2 }}>
                      {item.name}
                    </div>
                    <div style={{ fontSize: 12, fontWeight: 800, color: "#fbbf24" }}>
                      {item.score.toFixed(2)}
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Section B: Ranked list */}
      <div>
        {sectionLabel(selectedTrader === null ? "Top 20 Overall" : "Top 5 for This Trader")}
        {topN.length === 0 ? (
          <div style={{ color: "#6b7280", fontSize: 13 }}>No ranked accounts.</div>
        ) : (
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, overflow: "hidden", maxWidth: 600 }}>
            {/* Header */}
            <div style={{ display: "grid", gridTemplateColumns: "44px 1fr 140px 90px", borderBottom: `1px solid ${C.border}`, background: "#111827" }}>
              {["#", "Account Name", "Data Provider", "Value Score"].map((h, i) => (
                <div key={h} style={{ padding: "8px 12px", fontSize: 10, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: 0.5, textAlign: i === 3 ? "right" : "left" }}>
                  {h}
                </div>
              ))}
            </div>
            {/* Rows */}
            {topN.map((item, idx) => (
              <div key={item.id} style={{ display: "grid", gridTemplateColumns: "44px 1fr 140px 90px", borderBottom: idx < topN.length - 1 ? "1px solid #1f2937" : "none" }}>
                <div style={{ padding: "8px 12px", fontSize: 12, fontWeight: 700, color: "#4b5563" }}>{idx + 1}</div>
                <div style={{ padding: "8px 12px", fontSize: 12, fontWeight: 600, color: "#e5e7eb" }}>{item.name}</div>
                <div style={{ padding: "8px 12px", fontSize: 11, color: "#9ca3af" }}>{item.dataProvider}</div>
                <div style={{ padding: "8px 12px", fontSize: 13, fontWeight: 800, color: "#fbbf24", textAlign: "right" }}>{item.score.toFixed(2)}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
