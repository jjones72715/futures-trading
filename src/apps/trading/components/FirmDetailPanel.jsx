import React, { useState, useEffect } from "react";
import { getRecord, updateRecord } from "../services/airtable.js";
import { FIRMS_TABLE, EVAL_TYPE_TABLE } from "../config/tables.js";
import { $$ } from "../utils/format.js";

const STALE_MONTHS = 4;

function isTpStale(tpLastUpdated) {
  if (!tpLastUpdated) return true;
  const last = new Date(tpLastUpdated);
  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - STALE_MONTHS);
  return last < cutoff;
}

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

function TrustpilotBadge({ score, reviewCount, stale }) {
  const style = stale
    ? { background: "#1f2937", color: "#6b7280", border: "1px solid #374151" }
    : { background: "#05301f", color: "#34d399", border: "1px solid #065f46" };
  return (
    <span style={{
      ...style, fontSize: 12, fontWeight: 600, padding: "5px 12px", borderRadius: 8,
      whiteSpace: "nowrap", display: "inline-flex", alignItems: "center", gap: 6,
    }}>
      Trustpilot: {score}/5 ({reviewCount ?? 0} reviews)
      {stale && (
        <span style={{
          fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5,
          background: "#374151", color: "#9ca3af", padding: "1px 5px", borderRadius: 4,
        }}>
          Needs Refresh
        </span>
      )}
    </span>
  );
}

function TrustpilotEditForm({ firmId, tpScore, tpReviewCount, onSaved }) {
  const [scoreInput, setScoreInput] = useState(tpScore ?? "");
  const [countInput, setCountInput] = useState(tpReviewCount ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState(null);

  useEffect(() => {
    setScoreInput(tpScore ?? "");
    setCountInput(tpReviewCount ?? "");
    setSaved(false);
    setErr(null);
  }, [firmId]);

  async function handleSave() {
    setSaving(true); setErr(null); setSaved(false);
    try {
      const today = new Date().toISOString().slice(0, 10);
      const newScore = scoreInput === "" ? null : Math.min(5, Math.max(0, parseFloat(scoreInput)));
      const newCount = countInput === "" ? null : Math.max(0, parseInt(countInput, 10));
      await updateRecord(FIRMS_TABLE, firmId, {
        "TP Score": newScore,
        "TP Review Count": newCount,
        "TP Last Updated": today,
      });
      setSaved(true);
      onSaved({ tpScore: newScore, tpReviewCount: newCount, tpLastUpdated: today });
    } catch (e) {
      setErr(e.message);
    }
    setSaving(false);
  }

  const inputStyle = {
    background: "#0f172a", border: "1px solid #374151", borderRadius: 6, color: "#fff",
    fontSize: 13, padding: "6px 8px", width: "100%", outline: "none", boxSizing: "border-box",
  };
  const lbl = { fontSize: 10, color: "#9ca3af", marginBottom: 3, textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 600 };

  return (
    <div style={{ background: "#0b1220", border: "1px solid #1f2937", borderRadius: 8, padding: "12px 14px", display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5 }}>Update Trustpilot</div>
      <div style={{ display: "flex", gap: 10 }}>
        <div style={{ flex: 1 }}>
          <div style={lbl}>Trustpilot Score (0-5)</div>
          <input
            type="number" min="0" max="5" step="0.1" value={scoreInput}
            onChange={e => { setScoreInput(e.target.value); setSaved(false); }}
            style={inputStyle}
          />
        </div>
        <div style={{ flex: 1 }}>
          <div style={lbl}>Review Count</div>
          <input
            type="number" min="0" step="1" value={countInput}
            onChange={e => { setCountInput(e.target.value); setSaved(false); }}
            style={inputStyle}
          />
        </div>
      </div>
      {err && <div style={{ color: "#f87171", fontSize: 11 }}>{err}</div>}
      <button
        onClick={handleSave}
        disabled={saving}
        style={{
          background: saving ? "#1f2937" : "#2563eb", color: "#fff", border: "none", borderRadius: 6,
          padding: "7px 10px", fontSize: 12, fontWeight: 700, cursor: saving ? "not-allowed" : "pointer",
          alignSelf: "flex-start",
        }}
      >
        {saving ? "Saving..." : saved ? "Saved ✓" : "Save"}
      </button>
    </div>
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

  function handleTpSaved(updated) {
    setRecord(r => r ? {
      ...r,
      fields: {
        ...r.fields,
        "TP Score": updated.tpScore,
        "TP Review Count": updated.tpReviewCount,
        "TP Last Updated": updated.tpLastUpdated,
      },
    } : r);
  }

  const f = record?.fields || {};
  const riskStatus = f["Risk Status"]?.name || f["Risk Status"];
  const reputationScore = f["Reputation Score"];
  const payoutSpeed = f["Payout Speed Estimate"];
  const lastUpdate = fmtDate(f["Last Intel Update"]);
  const summary = (f["Firm Summary"] || "").trim();
  const hasIntel = summary.length > 0;
  const totalPaidOut = f["Total Paid Out"] || 0;
  const tpScore = f["TP Score"];
  const tpReviewCount = f["TP Review Count"];
  const tpStale = isTpStale(f["TP Last Updated"]);

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
                  {tpScore != null && <TrustpilotBadge score={tpScore} reviewCount={tpReviewCount} stale={tpStale} />}
                </div>
                {lastUpdate && (
                  <div style={{ fontSize: 11, color: "#6b7280" }}>Last updated: {lastUpdate}</div>
                )}
                <TrustpilotEditForm
                  firmId={firmId}
                  tpScore={tpScore}
                  tpReviewCount={tpReviewCount}
                  onSaved={handleTpSaved}
                />
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
