import React, { useState, useEffect } from "react";
import { loadValueRankingsData } from "../services/valueRankingsService.js";

const PROVIDER_ORDER = ["DX Feed", "Rithmic", "Tradovate", "Project X"];

const METRICS = [
  { key: "roiUnlimited",    label: "ROI Unlimited" },
  { key: "roiSinglePayout", label: "ROI Single Payout" },
  { key: "roiReset",        label: "ROI Reset" },
];

function roiColor(v) {
  if (v == null) return "#4b5563";
  if (v >= 1.5) return "#22c55e";
  if (v >= 1.0) return "#fbbf24";
  return "#f87171";
}

function sortedProviders(byProvider) {
  return Object.keys(byProvider).sort((a, b) => {
    const ia = PROVIDER_ORDER.indexOf(a), ib = PROVIDER_ORDER.indexOf(b);
    if (ia === -1 && ib === -1) return a.localeCompare(b);
    if (ia === -1) return 1;
    if (ib === -1) return -1;
    return ia - ib;
  });
}

// Within a provider's sorted item list, group consecutive items by firmId
function buildFirmGroups(items) {
  const groups = [];
  const seen = {};
  items.forEach(item => {
    const key = item.firmId || `solo:${item.id}`;
    if (!seen[key]) {
      seen[key] = { key, items: [] };
      groups.push(seen[key]);
    }
    seen[key].items.push(item);
  });
  return groups;
}

function ROIBadge({ val }) {
  const color = roiColor(val);
  return (
    <div style={{ fontSize: 13, fontWeight: 800, color }}>
      {val != null ? val.toFixed(2) + "×" : "—"}
    </div>
  );
}

export function ValueRankingsTab() {
  const C = { card: "#1f2a37", border: "#2d3f50" };
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [metric, setMetric] = useState("roiUnlimited");
  const [selectedTrader, setSelectedTrader] = useState(null);
  const [expandedKey, setExpandedKey] = useState(null); // "dp::firmKey" — only one at a time

  useEffect(() => {
    loadValueRankingsData()
      .then(setData)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  // Collapse expansion when metric or trader changes
  useEffect(() => { setExpandedKey(null); }, [metric, selectedTrader]);

  if (loading) return <div style={{ color: "#6b7280", fontSize: 13, padding: 16 }}>Loading ROI rankings...</div>;
  if (error) return <div style={{ background: "#450a0a", border: "1px solid #7f1d1d", color: "#fca5a5", padding: "10px 14px", borderRadius: 8, fontSize: 13 }}>⚠ {error}</div>;
  if (!data) return null;

  const { perfTypes, traders, traderFirmExclusions } = data;

  const displayItems = selectedTrader === null
    ? perfTypes
    : perfTypes.filter(p => {
        if (p.allowedTraders !== null && !p.allowedTraders.has(selectedTrader)) return false;
        const excluded = traderFirmExclusions[selectedTrader];
        if (excluded && p.firmId && excluded.has(p.firmId)) return false;
        return true;
      });

  const scored = displayItems
    .filter(p => p[metric] !== null)
    .sort((a, b) => b[metric] - a[metric]);

  const byProvider = {};
  scored.forEach(p => {
    const dp = p.dataProvider || "Other";
    if (!byProvider[dp]) byProvider[dp] = [];
    byProvider[dp].push(p);
  });
  const providers = sortedProviders(byProvider);

  const topN = selectedTrader === null ? 20 : 5;
  const topList = scored.slice(0, topN);

  const metricPillStyle = (active) => ({
    background: active ? "#ffd700" : "#e5e5e5",
    color: "#000",
    border: `1px solid ${active ? "#d4a800" : "#c8c8c8"}`,
    borderRadius: 999,
    padding: "4px 14px",
    fontSize: 12,
    fontWeight: active ? 800 : 600,
    cursor: "pointer",
    whiteSpace: "nowrap",
  });

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

  function ProviderColumn({ dp }) {
    const firmGroups = buildFirmGroups(byProvider[dp]);
    return (
      <div>
        <div style={{ fontSize: 9, fontWeight: 700, color: "#374151", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 4, paddingBottom: 2, borderBottom: "1px solid #1f2937" }}>
          {dp}
        </div>
        {firmGroups.map(group => {
          const best = group.items[0];
          const hasMore = group.items.length > 1;
          const expandKey = `${dp}::${group.key}`;
          const isExpanded = expandedKey === expandKey;
          const bestVal = best[metric];
          const bestColor = roiColor(bestVal);

          return (
            <div key={group.key} style={{ marginBottom: 3 }}>
              {/* Best card for this firm */}
              <div style={{ background: "#111827", border: `1px solid ${bestVal != null && bestVal >= 1.0 ? bestColor + "44" : "#1f2937"}`, borderRadius: 6, padding: "6px 8px" }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: "#d1d5db", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginBottom: 2 }}>
                  {best.name}
                </div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 4 }}>
                  <ROIBadge val={bestVal} />
                  <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    {best.profitable === "Yes" && (
                      <div style={{ fontSize: 8, fontWeight: 700, background: "#052e16", color: "#4ade80", padding: "1px 5px", borderRadius: 99, border: "1px solid #166534" }}>+EV</div>
                    )}
                    {hasMore && (
                      <button
                        onClick={() => setExpandedKey(isExpanded ? null : expandKey)}
                        style={{ background: isExpanded ? "#374151" : "#1f2937", border: "1px solid #374151", borderRadius: 4, color: "#9ca3af", fontSize: 11, fontWeight: 700, lineHeight: 1, padding: "1px 5px", cursor: "pointer" }}
                      >
                        {isExpanded ? "−" : `+${group.items.length - 1}`}
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Expanded: remaining accounts for this firm */}
              {isExpanded && group.items.slice(1).map(item => {
                const val = item[metric];
                const color = roiColor(val);
                return (
                  <div key={item.id} style={{ background: "#0d1117", border: `1px solid ${val != null && val >= 1.0 ? color + "33" : "#1f2937"}`, borderRadius: 6, padding: "5px 8px", marginTop: 2, marginLeft: 10, borderLeft: "2px solid #374151" }}>
                    <div style={{ fontSize: 10, fontWeight: 600, color: "#9ca3af", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginBottom: 2 }}>
                      {item.name}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <ROIBadge val={val} />
                      {item.profitable === "Yes" && (
                        <div style={{ fontSize: 8, fontWeight: 700, background: "#052e16", color: "#4ade80", padding: "1px 5px", borderRadius: 99, border: "1px solid #166534" }}>+EV</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div>
      {/* Row 1: Metric toggle */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
        {METRICS.map(m => (
          <button key={m.key} onClick={() => setMetric(m.key)} style={metricPillStyle(metric === m.key)}>
            {m.label}
          </button>
        ))}
      </div>

      {/* Row 2: Trader filter */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 20 }}>
        <button onClick={() => setSelectedTrader(null)} style={metricPillStyle(selectedTrader === null)}>
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

      {/* Section A: Cards by Data Provider */}
      <div style={{ marginBottom: 28 }}>
        {sectionLabel(selectedTrader === null ? "By Data Provider" : "Eligible Accounts by Data Provider")}
        {providers.length === 0 ? (
          <div style={{ color: "#6b7280", fontSize: 13 }}>No accounts with ROI data available.</div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: `repeat(${Math.min(providers.length, 4)}, 1fr)`, gap: 12 }}>
            {providers.map(dp => <ProviderColumn key={dp} dp={dp} />)}
          </div>
        )}
      </div>

      {/* Section B: Ranked list */}
      <div>
        {sectionLabel(selectedTrader === null ? "Top 20 Overall" : "Top 5 for This Trader")}
        {topList.length === 0 ? (
          <div style={{ color: "#6b7280", fontSize: 13 }}>No ranked accounts.</div>
        ) : (
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, overflow: "hidden", maxWidth: 640 }}>
            <div style={{ display: "grid", gridTemplateColumns: "44px 1fr 140px 90px", borderBottom: `1px solid ${C.border}`, background: "#111827" }}>
              {["#", "Account Name", "Data Provider", "ROI"].map((h, i) => (
                <div key={h} style={{ padding: "8px 12px", fontSize: 10, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: 0.5, textAlign: i === 3 ? "right" : "left" }}>
                  {h}
                </div>
              ))}
            </div>
            {topList.map((item, idx) => {
              const val = item[metric];
              const color = roiColor(val);
              return (
                <div key={item.id} style={{ display: "grid", gridTemplateColumns: "44px 1fr 140px 90px", borderBottom: idx < topList.length - 1 ? "1px solid #1f2937" : "none" }}>
                  <div style={{ padding: "8px 12px", fontSize: 12, fontWeight: 700, color: "#4b5563" }}>{idx + 1}</div>
                  <div style={{ padding: "8px 12px", fontSize: 12, fontWeight: 600, color: "#e5e7eb" }}>{item.name}</div>
                  <div style={{ padding: "8px 12px", fontSize: 11, color: "#9ca3af" }}>{item.dataProvider}</div>
                  <div style={{ padding: "8px 12px", fontSize: 13, fontWeight: 800, color, textAlign: "right" }}>
                    {val != null ? val.toFixed(2) + "×" : "—"}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
