import React, { useState, useEffect } from "react";
import { getRecord } from "../services/airtable.js";
import { FIRMS_TABLE } from "../config/tables.js";

const RISK_COLORS = {
  Clean: { bg: "#1f2937", text: "#9ca3af" },
  Watch: { bg: "#3b2a0a", text: "#fbbf24" },
  Caution: { bg: "#4a2607", text: "#fb923c" },
  Critical: { bg: "#450a0a", text: "#f87171" },
};

function RiskBadge({ status }) {
  const c = RISK_COLORS[status] || RISK_COLORS.Clean;
  return (
    <span style={{
      background: c.bg, color: c.text, fontSize: 11, fontWeight: 700,
      padding: "3px 10px", borderRadius: 99, whiteSpace: "nowrap",
      textTransform: "uppercase", letterSpacing: 0.5,
    }}>
      {status || "Unknown"}
    </span>
  );
}

function fmtDate(dateStr) {
  if (!dateStr) return null;
  const [y, m, d] = dateStr.split("-");
  if (!y || !m || !d) return dateStr;
  return `${parseInt(m)}/${parseInt(d)}/${y}`;
}

function AccordionSection({ title, content }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ border: "1px solid #1f2937", borderRadius: 8, overflow: "hidden" }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center",
          background: "#111827", border: "none", padding: "10px 14px", cursor: "pointer",
          color: "#e5e7eb", fontSize: 13, fontWeight: 600, textAlign: "left",
        }}
      >
        {title}
        <span style={{ color: "#6b7280", fontSize: 11, transform: open ? "rotate(180deg)" : "none", transition: "transform 0.15s" }}>▼</span>
      </button>
      {open && (
        <div style={{
          padding: "12px 14px", background: "#0b1220", fontSize: 13,
          color: content ? "#d1d5db" : "#6b7280", whiteSpace: "pre-wrap", lineHeight: 1.5,
        }}>
          {content || "No entries logged yet."}
        </div>
      )}
    </div>
  );
}

export function FirmDetailPanel({ firmId, firmName, onClose }) {
  const [mounted, setMounted] = useState(false);
  const [record, setRecord] = useState(null);
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

  function handleClose() {
    setMounted(false);
    setTimeout(onClose, 200);
  }

  const f = record?.fields || {};
  const riskStatus = f["Risk Status"];
  const lastUpdate = fmtDate(f["Last Intel Update"]);
  const summary = (f["Firm Summary"] || "").trim();
  const hasIntel = summary.length > 0;

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
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <div style={{ fontSize: 20, fontWeight: 700, color: "#fff" }}>{firmName}</div>
              {!loading && !error && riskStatus && <RiskBadge status={riskStatus} />}
            </div>
            {!loading && lastUpdate && (
              <div style={{ fontSize: 11, color: "#6b7280" }}>Last updated: {lastUpdate}</div>
            )}
          </div>
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
          ) : !hasIntel ? (
            <div style={{ color: "#6b7280", fontSize: 13, fontStyle: "italic" }}>No intel logged for this firm yet.</div>
          ) : (
            <>
              <div style={{ fontSize: 14, color: "#e5e7eb", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
                {summary}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <AccordionSection title="Reputation History" content={f["Reputation Log"]} />
                <AccordionSection title="Payout Speed History" content={f["Payout Speed Log"]} />
                <AccordionSection title="Enforcement Pattern History" content={f["Enforcement Pattern Log"]} />
                <AccordionSection title="KYC & Country Restrictions History" content={f["KYC & Country Restrictions Log"]} />
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
