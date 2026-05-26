import React, { useState } from "react";

export function AdvanceDayModal({ accounts, onConfirm, onCancel }) {
  const [overrides, setOverrides] = useState(() =>
    Object.fromEntries(accounts.map(a => [a.id, a.override]))
  );

  function toggle(id) {
    setOverrides(prev => ({ ...prev, [id]: !prev[id] }));
  }

  const confirmed = accounts.map(a => ({ ...a, override: overrides[a.id] }));

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ background: "#111827", border: "1px solid #374151", borderRadius: 14, padding: 24, width: 480, maxWidth: "95vw", maxHeight: "80vh", display: "flex", flexDirection: "column" }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: "#f59e0b", marginBottom: 6 }}>⏭ Advance to Next Day</div>
        <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 16 }}>Review which accounts will have their trading day count incremented. Toggle to override.</div>
        <div style={{ overflowY: "auto", flex: 1, marginBottom: 16 }}>
          {accounts.length === 0 && (
            <div style={{ color: "#6b7280", fontSize: 13, textAlign: "center", padding: "20px 0" }}>No accounts with balance entered.</div>
          )}
          {accounts.map(a => (
            <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderBottom: "1px solid #1f2937" }}>
              <input type="checkbox" checked={!!overrides[a.id]} onChange={() => toggle(a.id)} style={{ width: 16, height: 16, accentColor: "#f59e0b", cursor: "pointer" }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#e5e7eb" }}>{a.name}</div>
                <div style={{ fontSize: 11, color: a.accountType === "perf" ? "#6366f1" : "#f59e0b", marginTop: 1, textTransform: "uppercase", letterSpacing: 1 }}>
                  {a.accountType === "perf" ? "Performance" : "Evaluation"}
                </div>
                <div style={{ fontSize: 11, color: overrides[a.id] ? "#4ade80" : "#6b7280", marginTop: 2 }}>{a.reason}</div>
              </div>
              <div style={{ fontSize: 11, color: "#6b7280" }}>Day {(a.tradingDays || 0) + (overrides[a.id] ? 1 : 0)}</div>
            </div>
          ))}
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={onCancel} style={{ flex: 1, background: "#1f2937", border: "1px solid #374151", borderRadius: 8, padding: "9px", fontSize: 13, color: "#9ca3af", cursor: "pointer" }}>Cancel</button>
          <button onClick={() => onConfirm(confirmed)} style={{ flex: 1, background: "#d97706", border: "none", borderRadius: 8, padding: "9px", fontSize: 13, fontWeight: 700, color: "#fff", cursor: "pointer" }}>
            Confirm & Advance
          </button>
        </div>
      </div>
    </div>
  );
}
