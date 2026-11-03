import React, { useState, useEffect } from "react";
import { fetchTable } from "../services/airtable.js";
import { DISCORD_SOURCES_TABLE } from "../config/tables.js";

const VALUE_ORDER = { High: 0, Medium: 1, Low: 2, "": 3 };

// Extract YYYY-MM-DD from either "YYYY-MM-DD" or "YYYY-MM-DDTHH:mm:ss.sssZ"
function toDateStr(raw) {
  if (!raw) return "";
  return typeof raw === "string" ? raw.slice(0, 10) : "";
}

function fmtDate(dateStr) {
  if (!dateStr) return null;
  const [y, m, d] = dateStr.split("-");
  return `${parseInt(m)}/${parseInt(d)}/${y}`;
}

function daysDiff(dateStr) {
  if (!dateStr) return null;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  // Parse as local date by splitting to avoid UTC-shift
  const [y, m, d] = dateStr.split("-").map(Number);
  const due = new Date(y, m - 1, d);
  return Math.round((due - today) / 86400000);
}

// Single-select fields come back as plain strings in this base
function sel(raw) {
  if (!raw) return "";
  if (typeof raw === "object" && raw !== null) return raw.name || "";
  return String(raw);
}

function computeStatus(row) {
  if (row.frequency === "Skip") return { key: "skip",    label: "Skip",          color: "#4b5563", bg: "#1f293788" };
  if (!row.coveredThru && !row.lastPulled) return { key: "never", label: "Never pulled", color: "#9ca3af", bg: "#1f2937" };
  if (!row.nextDue)     return { key: "never",   label: "Never pulled",  color: "#9ca3af", bg: "#1f2937" };
  const diff = daysDiff(row.nextDue);
  if (diff === null)    return { key: "never",   label: "Never pulled",  color: "#9ca3af", bg: "#1f2937" };
  if (diff < 0)         return { key: "overdue", label: `${Math.abs(diff)}d overdue`, color: "#f87171", bg: "#450a0a" };
  if (diff <= 3)        return { key: "soon",    label: `Due in ${diff}d`,            color: "#fb923c", bg: "#431407" };
  return                       { key: "ok",      label: `Due in ${diff}d`,            color: "#4ade80", bg: "#052e16" };
}

const STATUS_SORT = { overdue: 0, never: 1, soon: 2, ok: 3, skip: 4 };

function StatCard({ label, value, color }) {
  return (
    <div style={{ background: "#111827", border: "1px solid #1f2937", borderRadius: 10, padding: "14px 18px", minWidth: 100 }}>
      <div style={{ fontSize: 22, fontWeight: 800, color: color || "#fff" }}>{value}</div>
      <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 600, marginTop: 2 }}>{label}</div>
    </div>
  );
}

function ValueBadge({ value }) {
  const colors = { High: "#22c55e", Medium: "#fbbf24", Low: "#f87171" };
  const c = colors[value] || "#6b7280";
  return value ? (
    <span style={{ fontSize: 10, fontWeight: 700, color: c, background: c + "20", border: `1px solid ${c}55`, borderRadius: 99, padding: "1px 7px", whiteSpace: "nowrap" }}>
      {value}
    </span>
  ) : null;
}

export function DiscordBotTab() {
  const [rows, setRows]             = useState([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState(null);
  const [typeFilter, setTypeFilter] = useState("All");
  const [hideSkip, setHideSkip]     = useState(true);
  const [expandedId, setExpandedId] = useState(null);

  useEffect(() => {
    fetchTable(DISCORD_SOURCES_TABLE, [
      "Server", "Type", "Firm(s)", "Value", "Check Next", "Check Frequency",
      "Covered Through", "Last Pulled", "Next Due", "Why It's Valuable", "Pull Notes",
    ])
      .then(recs => {
        if (recs.length > 0) console.log("[DiscordBotTab] raw record sample:", JSON.stringify(recs[0]));
        setRows(recs.map(r => {
          const f = r.fields;
          return {
            id:          r.id,
            server:      f["Server"]           || "",
            type:        sel(f["Type"]),
            firms:       f["Firm(s)"]          || "",
            value:       sel(f["Value"]),
            checkNext:   sel(f["Check Next"]),
            frequency:   sel(f["Check Frequency"]),
            coveredThru: toDateStr(f["Covered Through"]),
            lastPulled:  toDateStr(f["Last Pulled"]),
            nextDue:     toDateStr(f["Next Due"]),
            whyValuable: f["Why It's Valuable"] || "",
            pullNotes:   f["Pull Notes"]         || "",
          };
        }));
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div style={{ color: "#6b7280", fontSize: 13, padding: 16 }}>Loading Discord sources...</div>;
  if (error)   return <div style={{ background: "#450a0a", border: "1px solid #7f1d1d", color: "#fca5a5", padding: "10px 14px", borderRadius: 8, fontSize: 13 }}>⚠ {error}</div>;

  const withStatus = rows.map(r => ({ ...r, status: computeStatus(r) }));

  // Stats always over the full set
  const overdue = withStatus.filter(r => r.status.key === "overdue").length;
  const soon    = withStatus.filter(r => r.status.key === "soon").length;
  const never   = withStatus.filter(r => r.status.key === "never").length;
  const total   = rows.length;

  const filtered = withStatus
    .filter(r => typeFilter === "All" || r.type === typeFilter)
    .filter(r => !hideSkip || r.status.key !== "skip");

  const sorted = [...filtered].sort((a, b) => {
    const sd = STATUS_SORT[a.status.key] - STATUS_SORT[b.status.key];
    if (sd !== 0) return sd;
    if (a.status.key === "overdue") return daysDiff(a.nextDue) - daysDiff(b.nextDue); // most overdue first
    return (VALUE_ORDER[a.value] ?? 3) - (VALUE_ORDER[b.value] ?? 3);
  });

  const pillBase = { borderRadius: 999, padding: "4px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer", border: "1px solid", whiteSpace: "nowrap" };
  const goldPill = active => ({ ...pillBase, background: active ? "#ffd700" : "#e5e5e5", color: "#000", borderColor: active ? "#d4a800" : "#c8c8c8", fontWeight: active ? 800 : 600 });
  const bluePill = active => ({ ...pillBase, background: active ? "#1f3a5f" : "#18222f", color: active ? "#7dd3fc" : "#888", borderColor: active ? "#3b82f6" : "#2a3442" });

  return (
    <div>
      {/* Stat cards */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 20 }}>
        <StatCard label="Overdue"      value={overdue} color="#f87171" />
        <StatCard label="Due soon"     value={soon}    color="#fb923c" />
        <StatCard label="Never pulled" value={never}   color="#9ca3af" />
        <StatCard label="Total servers" value={total}  color="#e5e7eb" />
      </div>

      {/* Filters */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 16, alignItems: "center" }}>
        {[
          ["All", "All"],
          ["Multi-firm community", "Multi-firm"],
          ["Firm's own server", "Firm's own"],
        ].map(([val, label]) => (
          <button key={val} onClick={() => setTypeFilter(val)} style={goldPill(typeFilter === val)}>{label}</button>
        ))}
        <div style={{ width: 1, height: 20, background: "#374151", margin: "0 4px" }} />
        <button onClick={() => setHideSkip(v => !v)} style={bluePill(!hideSkip)}>
          {hideSkip ? "Show Skip" : "Hide Skip"}
        </button>
      </div>

      {/* List */}
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {sorted.length === 0 && (
          <div style={{ color: "#6b7280", fontSize: 13 }}>No servers match the current filters.</div>
        )}
        {sorted.map(row => {
          const isExpanded = expandedId === row.id;
          const st = row.status;
          const startFrom = row.coveredThru
            ? `Start next pull from: ${fmtDate(row.coveredThru)}`
            : "Start: last 2–3 weeks";

          return (
            <div key={row.id} style={{ background: "#111827", border: "1px solid #1f2937", borderRadius: 10, overflow: "hidden" }}>
              <button
                onClick={() => setExpandedId(isExpanded ? null : row.id)}
                style={{ width: "100%", background: "none", border: "none", cursor: "pointer", textAlign: "left", padding: "10px 14px" }}
              >
                <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, marginBottom: 6 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: "#e5e7eb", flex: "1 1 160px" }}>{row.server || "—"}</span>
                  <ValueBadge value={row.value} />
                  <span style={{ fontSize: 10, fontWeight: 700, background: st.bg, color: st.color, border: `1px solid ${st.color}55`, borderRadius: 99, padding: "2px 8px", whiteSpace: "nowrap" }}>
                    {st.label}
                  </span>
                  {row.frequency && row.status.key !== "skip" && (
                    <span style={{ fontSize: 10, color: "#6b7280", whiteSpace: "nowrap" }}>{row.frequency}</span>
                  )}
                  <span style={{ fontSize: 10, color: "#374151", marginLeft: "auto" }}>{isExpanded ? "▲" : "▼"}</span>
                </div>

                {row.status.key !== "skip" && (
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#60a5fa", marginBottom: 4 }}>
                    {startFrom}
                  </div>
                )}

                <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
                  {row.coveredThru && (
                    <span style={{ fontSize: 11, color: "#4b5563" }}>Covered through: <span style={{ color: "#9ca3af" }}>{fmtDate(row.coveredThru)}</span></span>
                  )}
                  {row.lastPulled && (
                    <span style={{ fontSize: 11, color: "#4b5563" }}>Last pulled: <span style={{ color: "#9ca3af" }}>{fmtDate(row.lastPulled)}</span></span>
                  )}
                  {row.nextDue && row.status.key !== "skip" && (
                    <span style={{ fontSize: 11, color: "#4b5563" }}>Next due: <span style={{ color: "#9ca3af" }}>{fmtDate(row.nextDue)}</span></span>
                  )}
                  {row.firms && (
                    <span style={{ fontSize: 11, color: "#4b5563" }}>Firms: <span style={{ color: "#9ca3af" }}>{row.firms}</span></span>
                  )}
                </div>
              </button>

              {isExpanded && (
                <div style={{ borderTop: "1px solid #1f2937", padding: "10px 14px", display: "flex", flexDirection: "column", gap: 10 }}>
                  {row.whyValuable && (
                    <div>
                      <div style={{ fontSize: 10, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>Why It's Valuable</div>
                      <div style={{ fontSize: 13, color: "#d1d5db", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{row.whyValuable}</div>
                    </div>
                  )}
                  {row.pullNotes && (
                    <div>
                      <div style={{ fontSize: 10, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>Pull Notes</div>
                      <div style={{ fontSize: 13, color: "#d1d5db", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{row.pullNotes}</div>
                    </div>
                  )}
                  {!row.whyValuable && !row.pullNotes && (
                    <div style={{ fontSize: 12, color: "#4b5563" }}>No notes.</div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
