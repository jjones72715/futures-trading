import React, { useState, useEffect } from "react";
import { getRecord } from "../services/airtable.js";
import { FIRMS_TABLE, EVAL_TYPE_TABLE } from "../config/tables.js";
import { $$ } from "../utils/format.js";

const RISK_COLORS = {
  Trusted: { bg: "#052e1a", text: "#4ade80" },
  Clean: { bg: "#1f2937", text: "#9ca3af" },
  Watch: { bg: "#3b2a0a", text: "#fbbf24" },
  Caution: { bg: "#4a2607", text: "#fb923c" },
  Critical: { bg: "#450a0a", text: "#f87171" },
  Scam: { bg: "#0a0a0a", text: "#ef4444", border: "#7f1d1d" },
};

function ScoreBadge({ score, status }) {
  const c = RISK_COLORS[status] || RISK_COLORS.Clean;
  return (
    <span style={{
      background: c.bg, color: c.text, fontSize: 14, fontWeight: 700,
      padding: "6px 14px", borderRadius: 8, whiteSpace: "nowrap",
      border: c.border ? `1px solid ${c.border}` : "none",
    }}>
      Score: {score} - {status}
    </span>
  );
}

function PayoutBadge({ text }) {
  return (
    <span style={{
      background: "#1d4ed822", border: "1px solid #1d4ed8", color: "#93c5fd",
      fontSize: 12, fontWeight: 600, padding: "5px 12px", borderRadius: 8, whiteSpace: "nowrap",
    }}>
      Payout: {text}
    </span>
  );
}

function StatCard({ label, children }) {
  return (
    <div style={{ background: "#0b1220", border: "1px solid #1f2937", borderRadius: 8, padding: "10px 14px" }}>
      <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>
        {label}
      </div>
      <div style={{ fontSize: 13, color: "#e5e7eb" }}>{children}</div>
    </div>
  );
}

function fmtDate(dateStr) {
  if (!dateStr) return null;
  const [y, m, d] = dateStr.split("-");
  if (!y || !m || !d) return dateStr;
  return `${parseInt(m)}/${parseInt(d)}/${y}`;
}

export function FirmDetailPanel({ firmId, firmName, onClose }) {
  const [mounted, setMounted] = useState(false);
  const [record, setRecord] = useState(null);
  const [evalTypes, setEvalTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const panelRef = React.useRef(null);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    function handleDocClick(e) {
      if (panelRef.current?.contains(e.target)) return;
      // A firm row's own click handler swaps the selected firm — don't fight it by closing.
      if (e.target.closest("[data-firm-link]")) return;
      handleClose();
    }
    document.addEventListener("click", handleDocClick);
    return () => document.removeEventListener("click", handleDocClick);
  }, []);

  useEffect(() => {
    if (!firmId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    getRecord(FIRMS_TABLE, firmId)
      .then(r => { if (!cancelled) setRecord(r); })
      .catch(e => { if (!cancelled) setError(e.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [firmId]);

  useEffect(() => {
    const ids = record?.fields?.["Evaluation Account Types"] || [];
    if (ids.length === 0) { setEvalTypes([]); return; }
    let cancelled = false;
    Promise.all(ids.map(id => getRecord(EVAL_TYPE_TABLE, id)))
      .then(records => { if (!cancelled) setEvalTypes(records); })
      .catch(() => { if (!cancelled) setEvalTypes([]); });
    return () => { cancelled = true; };
  }, [record]);

  function handleClose() {
    setMounted(false);
    setTimeout(onClose, 200);
  }

  const f = record?.fields || {};
  const riskStatus = f["Risk Status"]?.name || f["Risk Status"];
  const reputationScore = f["Reputation Score"];
  const payoutSpeed = f["Payout Speed Estimate"];
  const lastUpdate = fmtDate(f["Last Intel Update"]);
  const summary = (f["Firm Summary"] || "").trim();
  const hasIntel = summary.length > 0;
  const totalPaidOut = f["Total Paid Out"] || 0;

  const bestAccount = evalTypes.reduce((best, r) => {
    const vs = r.fields?.["Value Score"];
    if (vs == null) return best;
    if (!best || vs > best.valueScore) return { name: r.fields["Name"], valueScore: vs };
    return best;
  }, null);

  return (
    <>
      <div
        style={{
          position: "fixed", inset: 0, background: "#000", pointerEvents: "none",
          opacity: mounted ? 0.5 : 0, transition: "opacity 0.2s ease", zIndex: 1000,
        }}
      />
      <div ref={panelRef} style={{
        position: "fixed", top: 0, right: 0, bottom: 0, width: "36%", minWidth: 380, maxWidth: "92vw",
        background: "#111827", borderLeft: "1px solid #1f2937", zIndex: 1001,
        transform: mounted ? "translateX(0)" : "translateX(100%)",
        transition: "transform 0.22s ease", boxShadow: "-12px 0 32px rgba(0,0,0,0.5)",
        display: "flex", flexDirection: "column",
      }}>
        <div style={{
          padding: "20px 22px", borderBottom: "1px solid #1f2937",
          display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12,
        }}>
          <div style={{ fontSize: 20, fontWeight: 700, color: "#fff" }}>{firmName}</div>
          <button
            onClick={handleClose}
            aria-label="Close"
            style={{
              background: "none", border: "none", color: "#6b7280", fontSize: 22,
              cursor: "pointer", lineHeight: 1, padding: "0 2px", flexShrink: 0,
            }}
          >
            ×
          </button>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: 22, display: "flex", flexDirection: "column", gap: 18 }}>
          {loading ? (
            <div style={{ color: "#6b7280", fontSize: 13 }}>Loading firm intel...</div>
          ) : error ? (
            <div style={{ color: "#f87171", fontSize: 13 }}>Error: {error}</div>
          ) : (
            <>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                  {riskStatus && <ScoreBadge score={reputationScore} status={riskStatus} />}
                  {payoutSpeed && <PayoutBadge text={payoutSpeed} />}
                </div>
                {lastUpdate && (
                  <div style={{ fontSize: 11, color: "#6b7280" }}>Last updated: {lastUpdate}</div>
                )}
              </div>

              {hasIntel ? (
                <div style={{ fontSize: 14, color: "#e5e7eb", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
                  {summary}
                </div>
              ) : (
                <div style={{ color: "#6b7280", fontSize: 13, fontStyle: "italic" }}>No intel logged for this firm yet.</div>
              )}

              {bestAccount && (
                <StatCard label="Best Account">
                  {bestAccount.name} — Value Score: {typeof bestAccount.valueScore === "number" ? bestAccount.valueScore.toFixed(1) : bestAccount.valueScore}
                </StatCard>
              )}

              {totalPaidOut > 0 && (
                <StatCard label="Total Paid Out">
                  <span style={{ fontSize: 15, fontWeight: 700, color: "#4ade80" }}>{$$(totalPaidOut)}</span>
                </StatCard>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}
