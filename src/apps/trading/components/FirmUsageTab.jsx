import React, { useState, useEffect, useMemo } from "react";
import { fetchTable } from "../services/airtable.js";
import { FIRMS_TABLE, EVAL_TABLE, PERF_TABLE, TRADERS_TABLE } from "../config/tables.js";

export function FirmUsageTab() {
  const C = { bg: "#030712", card: "#111827", border: "#1f2937" };
  const [firms, setFirms] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [restrictions, setRestrictions] = useState({}); // traderName → [firmName]
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        // Load firms first so fMap is available for account name resolution
        const firmRecords = await fetchTable(FIRMS_TABLE, [
          "Name", "Data Provider", "Rank", "Max Accounts"
        ]);
        const fMap = {};
        firmRecords.forEach(r => { fMap[r.id] = r; });
        const sortedFirms = firmRecords
          .filter(r => r.fields["Rank"])
          .sort((a, b) => a.fields["Rank"] - b.fields["Rank"])
          .map(r => ({
            id: r.id,
            name: r.fields["Name"],
            provider: r.fields["Data Provider"]?.name || r.fields["Data Provider"] || "Unknown",
            rank: r.fields["Rank"],
            maxAccounts: r.fields["Max Accounts"] || 0,
          }));

        // Load eval accounts with firm lookup
        const evalRecords = await fetchTable(EVAL_TABLE, [
          "Name", "Status", "Trader", "Number of Accounts", "Firm Name"
        ]);

        // Load perf accounts with firm lookup
        const perfRecords = await fetchTable(PERF_TABLE, [
          "Name", "Status", "Trader", "Number of Accounts", "Firm Name", "Payout Account"
        ]);

        // Load traders with restricted firms
        const traderRecords = await fetchTable(TRADERS_TABLE, [
          "Name", "Restricted Firms"
        ]);
        const traderIdMap = {};
        const restrictMap = {};
        traderRecords.forEach(r => {
          traderIdMap[r.id] = r.fields["Name"];
          const restricted = r.fields["Restricted Firms"] || [];
          if (restricted.length > 0) {
            // Could be [{id, name}] objects OR plain ID strings
            restrictMap[r.fields["Name"]] = restricted.map(f => {
              if (typeof f === "object") return f.name;
              return fMap[f]?.fields?.["Name"] || f;
            }).filter(Boolean);
          }
        });

        const allAccounts = [
          ...evalRecords
            .filter(r => !["Failed", "Passed"].includes(r.fields["Status"]?.name || r.fields["Status"]))
            .map(r => ({
              type: "eval",
              name: r.fields["Name"],
              status: r.fields["Status"]?.name || r.fields["Status"],
              trader: traderIdMap[r.fields["Trader"]?.[0]] || r.fields["Trader"]?.[0] || "",
              n: r.fields["Number of Accounts"] || 1,
              firmName: fMap[r.fields["Firm Name"]?.[0]]?.fields["Name"] || null,
              payoutAccount: false,
            })),
          ...perfRecords
            .filter(r => !["Failed", "Passed"].includes(r.fields["Status"]?.name || r.fields["Status"]))
            .map(r => ({
              type: "perf",
              name: r.fields["Name"],
              status: r.fields["Status"]?.name || r.fields["Status"],
              trader: traderIdMap[r.fields["Trader"]?.[0]] || r.fields["Trader"]?.[0] || "",
              n: r.fields["Number of Accounts"] || 1,
              firmName: fMap[r.fields["Firm Name"]?.[0]]?.fields["Name"] || null,
              payoutAccount: r.fields["Payout Account"] || false,
            })),
        ];

        console.log("firm sample:", JSON.stringify(sortedFirms[0]));
        console.log("accounts sample:", JSON.stringify(allAccounts[0]));
        setFirms(sortedFirms);
        setAccounts(allAccounts);
        setRestrictions(restrictMap);
      } catch(e) { console.error("FirmUsageTab error:", e); }
      setLoading(false);
    }
    loadData();
  }, []);

  const traders = [
    { key: "Jonathan Jones", label: "Jonathan" },
    { key: "Cherelyn Jones", label: "Sherry" },
    { key: "Amanda Seratt", label: "Amanda" },
    { key: "Jefferies Parker", label: "Troy" },
    { key: "Judy Jones", label: "Judy" },
    { key: "Rolly Omas Obial", label: "Rolly" },
  ];

  // Build usageMap: firmName → traderLabel → [label]
  const usageMap = useMemo(() => {
    const map = {};
    accounts.forEach(a => {
      if (!a.firmName) return;
      const traderObj = traders.find(t => t.key === a.trader);
      if (!traderObj) return;
      const tLabel = traderObj.label;
      if (!map[a.firmName]) map[a.firmName] = {};
      if (!map[a.firmName][tLabel]) map[a.firmName][tLabel] = [];
      const isLive = a.status === "Live";
      const isPayout = a.payoutAccount;
      const isPerf = a.type === "perf";
      const label = isLive ? "L" : isPayout ? "F" : isPerf ? "P" : "E";
      if (!map[a.firmName][tLabel].includes(label)) {
        map[a.firmName][tLabel].push(label);
      }
    });
    return map;
  }, [accounts]);

  const providers = ["Project X", "Rithmic", "Tradovate", "DX Feed"];
  const providerColors = {
    "Project X":  { header: "#1d4ed8", border: "#1e3a5f", bg: "#0c1a2e", text: "#93c5fd" },
    "Rithmic":    { header: "#15803d", border: "#1a3a1a", bg: "#0f1a0f", text: "#86efac" },
    "Tradovate":  { header: "#7e22ce", border: "#3a1a3a", bg: "#1a0f1a", text: "#d8b4fe" },
    "DX Feed":    { header: "#a16207", border: "#3a3a1a", bg: "#1a1a0f", text: "#fde047" },
  };
  const labelColors = {
    "E": { bg: "#7c3aed22", border: "#7c3aed", color: "#c4b5fd" },
    "P": { bg: "#15803d22", border: "#15803d", color: "#86efac" },
    "F": { bg: "#1d4ed822", border: "#1d4ed8", color: "#93c5fd" },
    "L": { bg: "#b4521822", border: "#b45218", color: "#fdba74" },
  };

  if (loading) return (
    <div style={{ textAlign: "center", padding: 60, color: "#6b7280" }}>Loading firms...</div>
  );

  const traderLabels = traders.map(t => t.label);
  const gridCols = `40px 1fr 50px ${traderLabels.map(() => "1fr").join(" ")}`;

  console.log("rendering providers - firms by provider:", providers.map(p => p + ": " + firms.filter(f => f.provider === p).length));

  return (
    <div>
      {/* Legend */}
      <div style={{ display: "flex", gap: 16, marginBottom: 20, flexWrap: "wrap" }}>
        {[["E","EVAL","#c4b5fd"], ["P","PERFORMANCE","#86efac"], ["F","FUNDED/PAYOUT","#93c5fd"], ["L","LIVE","#fdba74"]].map(([k, v, c]) => (
          <span key={k} style={{ fontSize: 12, color: c, fontWeight: 600 }}>{k} = {v}</span>
        ))}
      </div>

      {providers.map(provider => {
        const pFirms = firms.filter(f => f.provider === provider);
        if (!pFirms.length) return null;
        const pc = providerColors[provider] || providerColors["Rithmic"];

        return (
          <div key={provider} style={{ marginBottom: 28 }}>
            <div style={{ background: pc.header, borderRadius: "10px 10px 0 0", padding: "8px 16px", fontSize: 14, fontWeight: 800, color: "#fff", letterSpacing: 1 }}>
              {provider.toUpperCase()}
            </div>
            <div style={{ background: pc.bg, border: `1px solid ${pc.border}`, borderTop: "none", borderRadius: "0 0 10px 10px", overflow: "hidden" }}>
              {/* Header */}
              <div style={{ display: "grid", gridTemplateColumns: gridCols, padding: "8px 12px", borderBottom: `1px solid ${pc.border}`, background: "#0a0a0a" }}>
                <div style={{ fontSize: 11, color: "#4b5563", fontWeight: 700 }}>Rank</div>
                <div style={{ fontSize: 11, color: "#4b5563", fontWeight: 700 }}>Firm</div>
                <div style={{ fontSize: 11, color: "#4b5563", fontWeight: 700, textAlign: "center" }}>Max</div>
                {traderLabels.map(t => (
                  <div key={t} style={{ fontSize: 11, color: pc.text, fontWeight: 700, textAlign: "center" }}>{t}</div>
                ))}
              </div>

              {pFirms.map((f, i) => {
                const traderUsage = usageMap[f.name] || {};
                const hasAny = Object.keys(traderUsage).length > 0;

                return (
                  <div key={f.id} style={{
                    display: "grid", gridTemplateColumns: gridCols,
                    padding: "8px 12px",
                    borderBottom: i < pFirms.length - 1 ? `1px solid ${pc.border}` : "none",
                    background: hasAny ? pc.bg : "#0a0a0a",
                    alignItems: "center",
                  }}>
                    <div style={{ fontSize: 12, color: "#6b7280" }}>{f.rank}</div>
                    <div style={{ fontSize: 13, color: hasAny ? "#fff" : "#374151", fontWeight: hasAny ? 600 : 400 }}>{f.name}</div>
                    <div style={{ fontSize: 12, color: "#6b7280", textAlign: "center" }}>{f.maxAccounts}</div>
                    {traderLabels.map(tLabel => {
                      const labels = traderUsage[tLabel] || [];
                      const traderKey = traders.find(t => t.label === tLabel)?.key;
                      const isRestricted = restrictions[traderKey]?.includes(f.name);
                      return (
                        <div key={tLabel} style={{ display: "flex", gap: 3, justifyContent: "center", flexWrap: "wrap" }}>
                          {isRestricted && labels.length === 0 && (
                            <span title="Restricted" style={{ fontSize: 13 }}>⛔</span>
                          )}
                          {labels.map((lbl, j) => {
                            const lc = labelColors[lbl];
                            return (
                              <span key={j} style={{
                                background: lc.bg, border: `1px solid ${lc.border}`,
                                color: lc.color, borderRadius: 4,
                                padding: "2px 6px", fontSize: 11, fontWeight: 700,
                              }}>{lbl}</span>
                            );
                          })}
                          {!isRestricted && labels.length === 0 && (
                            <span style={{ fontSize: 11, color: "#1f2937" }}>—</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
