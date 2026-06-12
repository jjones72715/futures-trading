import React from "react";

export function EvalTypePricingPanel({ evalType, traders, evalPriceEdits, setEvalPriceEdits, allowedTraderEdits, setAllowedTraderEdits, onSave, showSave = true }) {
  const inp = { background: "#111827", border: "1px solid #374151", borderRadius: 6, padding: "6px 10px", fontSize: 13, color: "#fff", width: "100%", outline: "none", boxSizing: "border-box" };
  const valueScoreColor = evalType.valueScore >= 10 ? "#4ade80" : evalType.valueScore >= 5 ? "#fbbf24" : evalType.valueScore ? "#f87171" : "#6b7280";
  const hasPriceEdits = Object.keys(evalPriceEdits).length > 0;
  const hasTraderEdits = JSON.stringify([...allowedTraderEdits].sort()) !== JSON.stringify([...(evalType.allowedTraders ?? [])].sort());
  const isDirty = hasPriceEdits || hasTraderEdits;

  return (
    <div style={{ background: "#111827", border: "1px solid #374151", borderRadius: 10, padding: 16, marginBottom: 16 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: "#fff", marginBottom: 12 }}>
        {evalType.name} — Pricing &amp; Settings
      </div>

      {/* Read-only stats */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 14 }}>
        {[
          { label: "Drawdown", value: `$${(evalType.drawdownLimit ?? 0).toLocaleString()}` },
          { label: "Consistency", value: evalType.consistencyPct != null ? `${Math.round(evalType.consistencyPct * 100)}%` : "100%" },
          { label: "Value Score", value: evalType.valueScore ?? "—", color: valueScoreColor },
        ].map(({ label, value, color }) => (
          <div key={label} style={{ background: "#1f2937", borderRadius: 6, padding: "8px 6px", textAlign: "center" }}>
            <div style={{ fontSize: 10, color: "#9ca3af", marginBottom: 3 }}>{label}</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: color ?? "#fff" }}>{value}</div>
          </div>
        ))}
      </div>

      {/* Editable price fields */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 14 }}>
        {[
          { label: "New Eval Cost", key: "newEvalCost" },
          { label: "Reset Eval Cost", key: "resetEvalCost" },
          { label: "Activation Cost", key: "activationCost" },
        ].map(({ label, key }) => (
          <div key={key}>
            <div style={{ fontSize: 10, color: "#9ca3af", marginBottom: 4 }}>{label}</div>
            <input
              type="number"
              value={evalPriceEdits[key] !== undefined ? evalPriceEdits[key] : (evalType[key] ?? "")}
              onChange={e => setEvalPriceEdits(prev => ({ ...prev, [key]: e.target.value === "" ? null : Number(e.target.value) }))}
              style={inp}
              placeholder="$0"
            />
          </div>
        ))}
      </div>

      {/* Allowed Traders */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>Allowed Traders</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
          {traders.map(trader => (
            <label key={trader.id} style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={allowedTraderEdits.includes(trader.id)}
                onChange={e => setAllowedTraderEdits(prev =>
                  e.target.checked ? [...prev, trader.id] : prev.filter(id => id !== trader.id)
                )}
                style={{ accentColor: "#3b82f6", width: 14, height: 14 }}
              />
              <span style={{ fontSize: 12, color: "#e5e7eb" }}>{trader.name}</span>
            </label>
          ))}
        </div>
      </div>

      {isDirty && showSave && (
        <button
          onClick={onSave}
          style={{ width: "100%", padding: "8px", background: "#2563eb", color: "#fff", border: "none", borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: "pointer" }}
        >
          Save Eval Type Changes
        </button>
      )}
    </div>
  );
}
