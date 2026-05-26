import React, { useState } from "react";
import { createRecord } from "../services/airtable.js";
import { TRADE_ANALYTICS_TABLE } from "../config/tables.js";

export function TradeLogTab() {
  const today = new Date().toISOString().slice(0, 10);

  const [subTab, setSubTab] = useState("logentry");

  // Form state
  const [date, setDate] = useState(today);
  const [symbol, setSymbol] = useState("NQ");
  const [session, setSession] = useState("NY (6AM-Close)");
  const [vwapPosition, setVwapPosition] = useState("");
  const [nyRangePosition, setNyRangePosition] = useState("");
  const [ticksLong, setTicksLong] = useState("");
  const [ticksShort, setTicksShort] = useState("");
  const [winner, setWinner] = useState("");
  const [notes, setNotes] = useState("");

  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState(null); // { type: "success"|"error", msg }

  const longN = parseFloat(ticksLong);
  const shortN = parseFloat(ticksShort);
  const total = longN + shortN;
  const beLong = (!isNaN(longN) && !isNaN(shortN) && total > 0)
    ? ((shortN / total) * 100).toFixed(1) + "%"
    : "—";
  const beShort = (!isNaN(longN) && !isNaN(shortN) && total > 0)
    ? ((longN / total) * 100).toFixed(1) + "%"
    : "—";

  async function handleSubmit(e) {
    e.preventDefault();
    if (!vwapPosition || !nyRangePosition || !winner || ticksLong === "" || ticksShort === "") {
      setFeedback({ type: "error", msg: "Please fill in all required fields." });
      return;
    }
    setSaving(true);
    setFeedback(null);
    try {
      const name = `${date} — ${symbol} — ${session}`;
      await createRecord(TRADE_ANALYTICS_TABLE, {
        "fldlIFGxrx2q2l3S5": name,
        "fldQz4mK492CtSOHO": date,
        "fldquwGnmZC9CV3Ep": symbol,
        "fldLGP19dICWXfPYi": session,
        "fldlGE46PdQ1v2V5O": vwapPosition,
        "fldMWdTgjlLWUWrIf": nyRangePosition,
        "flda91eFvs8nyHS7a": parseInt(ticksLong, 10),
        "fldnyv10JNGSBn47r": parseInt(ticksShort, 10),
        "fldHDUZUdPiyOBUoG": winner,
        "fldLvdaXTvQFb0NT0": notes || undefined,
      });
      setFeedback({ type: "success", msg: "Trade logged successfully!" });
      // Clear per-trade fields, keep date/symbol/session
      setVwapPosition("");
      setNyRangePosition("");
      setTicksLong("");
      setTicksShort("");
      setWinner("");
      setNotes("");
    } catch (err) {
      setFeedback({ type: "error", msg: err.message || "Failed to save record." });
    } finally {
      setSaving(false);
    }
  }

  const inputStyle = {
    background: "#111827",
    border: "1px solid #374151",
    borderRadius: 8,
    color: "#e5e7eb",
    padding: "9px 12px",
    fontSize: 14,
    width: "100%",
    boxSizing: "border-box",
    outline: "none",
  };
  const labelStyle = { fontSize: 12, color: "#9ca3af", fontWeight: 600, marginBottom: 4, display: "block", textTransform: "uppercase", letterSpacing: "0.05em" };
  const readonlyStyle = { ...inputStyle, background: "#0d1117", color: "#6b7280", cursor: "default" };

  return (
    <div>
      {/* Sub-tab nav */}
      <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
        {[["logentry", "📝 Log Entry"], ["analytics", "📊 Analytics"]].map(([key, label]) => (
          <button key={key} onClick={() => setSubTab(key)}
            style={{ background: subTab === key ? "#ffd700" : "#1f2937", color: subTab === key ? "#000" : "#e5e7eb", border: `1px solid ${subTab === key ? "#d4a800" : "#374151"}`, borderRadius: 8, padding: "7px 18px", fontSize: 13, fontWeight: subTab === key ? 800 : 600, cursor: "pointer" }}>
            {label}
          </button>
        ))}
      </div>

      {subTab === "analytics" && (
        <div style={{ textAlign: "center", padding: "60px 20px", color: "#6b7280", fontSize: 15 }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>📊</div>
          Analytics coming soon
        </div>
      )}

      {subTab === "logentry" && (
        <div style={{ maxWidth: 540 }}>
          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>

            {/* Date */}
            <div>
              <label style={labelStyle}>Date</label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)} style={inputStyle} required />
            </div>

            {/* Symbol */}
            <div>
              <label style={labelStyle}>Symbol</label>
              <select value={symbol} onChange={e => setSymbol(e.target.value)} style={inputStyle}>
                <option>NQ</option>
                <option>GC</option>
              </select>
            </div>

            {/* Session */}
            <div>
              <label style={labelStyle}>Session</label>
              <select value={session} onChange={e => setSession(e.target.value)} style={inputStyle}>
                <option>Asia (6PM-6AM)</option>
                <option>NY (6AM-Close)</option>
              </select>
            </div>

            {/* VWAP Position */}
            <div>
              <label style={labelStyle}>VWAP Position</label>
              <select value={vwapPosition} onChange={e => setVwapPosition(e.target.value)} style={inputStyle} required>
                <option value="">— Select —</option>
                <option>2+ Above</option>
                <option>1-2 Above</option>
                <option>0-1 Above</option>
                <option>0-1 Below</option>
                <option>1-2 Below</option>
                <option>2+ Below</option>
              </select>
            </div>

            {/* NY Range Position */}
            <div>
              <label style={labelStyle}>NY Range Position</label>
              <select value={nyRangePosition} onChange={e => setNyRangePosition(e.target.value)} style={inputStyle} required>
                <option value="">— Select —</option>
                <option>Outside Above</option>
                <option>Inside</option>
                <option>Outside Below</option>
              </select>
            </div>

            {/* Ticks row */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <label style={labelStyle}>Ticks Long to Win</label>
                <input type="number" min="0" step="1" value={ticksLong} onChange={e => setTicksLong(e.target.value)} style={inputStyle} placeholder="0" required />
              </div>
              <div>
                <label style={labelStyle}>Ticks Short to Win</label>
                <input type="number" min="0" step="1" value={ticksShort} onChange={e => setTicksShort(e.target.value)} style={inputStyle} placeholder="0" required />
              </div>
            </div>

            {/* Break-Even display row */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <label style={labelStyle}>Break-Even % Long</label>
                <div style={readonlyStyle}>{beLong}</div>
              </div>
              <div>
                <label style={labelStyle}>Break-Even % Short</label>
                <div style={readonlyStyle}>{beShort}</div>
              </div>
            </div>

            {/* Winner */}
            <div>
              <label style={labelStyle}>Winner</label>
              <select value={winner} onChange={e => setWinner(e.target.value)} style={inputStyle} required>
                <option value="">— Select —</option>
                <option>Long</option>
                <option>Short</option>
              </select>
            </div>

            {/* Notes */}
            <div>
              <label style={labelStyle}>Notes <span style={{ color: "#4b5563", fontWeight: 400 }}>(optional)</span></label>
              <textarea value={notes} onChange={e => setNotes(e.target.value)} style={{ ...inputStyle, minHeight: 80, resize: "vertical" }} placeholder="Optional notes..." />
            </div>

            {/* Feedback */}
            {feedback && (
              <div style={{
                background: feedback.type === "success" ? "#052e16" : "#450a0a",
                border: `1px solid ${feedback.type === "success" ? "#166534" : "#7f1d1d"}`,
                color: feedback.type === "success" ? "#86efac" : "#fca5a5",
                padding: "10px 14px", borderRadius: 8, fontSize: 13,
              }}>
                {feedback.type === "success" ? "✓ " : "⚠ "}{feedback.msg}
              </div>
            )}

            <button type="submit" disabled={saving}
              style={{ background: saving ? "#374151" : "#ffd700", color: "#000", border: "none", borderRadius: 8, padding: "11px 0", fontSize: 14, fontWeight: 800, cursor: saving ? "not-allowed" : "pointer", transition: "background 0.15s" }}>
              {saving ? "Saving…" : "Log Trade"}
            </button>

          </form>
        </div>
      )}
    </div>
  );
}
