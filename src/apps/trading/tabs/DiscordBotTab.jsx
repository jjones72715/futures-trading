import React, { useState, useEffect, useRef } from "react";
import { fetchTable, updateRecord } from "../services/airtable.js";
import { DISCORD_SOURCES_TABLE, BOT_CONFIG_TABLE } from "../config/tables.js";

const VALUE_ORDER = { High: 0, Medium: 1, Low: 2, "": 3 };
const STATUS_SORT = { overdue: 0, never: 1, soon: 2, ok: 3, skip: 4 };

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
  const [y, m, d] = dateStr.split("-").map(Number);
  const due = new Date(y, m - 1, d);
  return Math.round((due - today) / 86400000);
}

function sel(raw) {
  if (!raw) return "";
  if (typeof raw === "object" && raw !== null) return raw.name || "";
  return String(raw);
}

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function computeStatus(row) {
  if (row.frequency === "Skip") return { key: "skip",    label: "Skip",                       color: "#4b5563", bg: "#1f293788" };
  if (!row.coveredThru && !row.lastPulled) return { key: "never", label: "Never pulled",      color: "#9ca3af", bg: "#1f2937" };
  if (!row.nextDue)                        return { key: "never", label: "Never pulled",      color: "#9ca3af", bg: "#1f2937" };
  const diff = daysDiff(row.nextDue);
  if (diff === null)  return { key: "never",   label: "Never pulled",                         color: "#9ca3af", bg: "#1f2937" };
  if (diff < 0)       return { key: "overdue", label: `${Math.abs(diff)}d overdue`,           color: "#f87171", bg: "#450a0a" };
  if (diff <= 3)      return { key: "soon",    label: `Due in ${diff}d`,                      color: "#fb923c", bg: "#431407" };
  return                     { key: "ok",      label: `Due in ${diff}d`,                      color: "#4ade80", bg: "#052e16" };
}

function mapRecord(r) {
  const f = r.fields;
  return {
    id:          r.id,
    server:      f["Server"]             || "",
    type:        sel(f["Type"]),
    firms:       f["Firm(s)"]            || "",
    value:       sel(f["Value"]),
    checkNext:   sel(f["Check Next"]),
    frequency:   sel(f["Check Frequency"]),
    coveredThru: toDateStr(f["Covered Through"]),
    lastPulled:  toDateStr(f["Last Pulled"]),
    nextDue:     toDateStr(f["Next Due"]),
    whyValuable: f["Why It's Valuable"]  || "",
    pullNotes:   f["Pull Notes"]          || "",
    gptRules:    f["GPT Server Rules"]    || "",
  };
}

// ── Shared drawer shell ──────────────────────────────────────────────────────

function DrawerShell({ title, subtitle, children, onClose }) {
  const [mounted, setMounted] = useState(false);
  const panelRef = useRef(null);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    function onDown(e) {
      if (panelRef.current?.contains(e.target)) return;
      close();
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  function close() {
    setMounted(false);
    setTimeout(onClose, 200);
  }

  return (
    <>
      <div style={{ position: "fixed", inset: 0, background: "#000", pointerEvents: "none", opacity: mounted ? 0.5 : 0, transition: "opacity 0.2s ease", zIndex: 1000 }} />
      <div ref={panelRef} style={{
        position: "fixed", top: 0, right: 0, bottom: 0,
        width: "min(480px, 100vw)", background: "#111827",
        borderLeft: "1px solid #1f2937", zIndex: 1001,
        transform: mounted ? "translateX(0)" : "translateX(100%)",
        transition: "transform 0.22s ease", boxShadow: "-12px 0 32px rgba(0,0,0,0.5)",
        display: "flex", flexDirection: "column",
      }}>
        <div style={{ padding: "18px 20px", borderBottom: "1px solid #1f2937", display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
          <div>
            <div style={{ fontSize: 17, fontWeight: 700, color: "#fff", marginBottom: subtitle ? 5 : 0 }}>{title}</div>
            {subtitle}
          </div>
          <button onClick={close} style={{ background: "none", border: "none", color: "#6b7280", fontSize: 22, cursor: "pointer", lineHeight: 1, padding: "0 2px", flexShrink: 0 }}>×</button>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: "18px 20px" }}>
          {children}
        </div>
      </div>
    </>
  );
}

// ── Source edit drawer ───────────────────────────────────────────────────────

function SourceDrawer({ row, basePrompt, onClose, onSaved }) {
  const [value,       setValue]       = useState(row.value);
  const [frequency,   setFrequency]   = useState(row.frequency);
  const [coveredThru, setCoveredThru] = useState(row.coveredThru);
  const [lastPulled,  setLastPulled]  = useState(row.lastPulled);
  const [whyVal,      setWhyVal]      = useState(row.whyValuable);
  const [notes,       setNotes]       = useState(row.pullNotes);
  const [gptRules,    setGptRules]    = useState(row.gptRules);
  const [saveState,   setSaveState]   = useState("idle");
  const [saveErr,     setSaveErr]     = useState("");
  const [copied,      setCopied]      = useState(false);

  // Recompute live status for the start-from banner
  const liveRow = { ...row, value, frequency, coveredThru, lastPulled };
  const st = computeStatus(liveRow);
  const startFrom = coveredThru ? `Start next pull from: ${fmtDate(coveredThru)}` : "Start: last 2–3 weeks";
  const fullPrompt = (gptRules ? gptRules + "\n\n" : "") + (basePrompt || "");

  async function handleSave() {
    setSaveState("saving"); setSaveErr("");
    try {
      await updateRecord(DISCORD_SOURCES_TABLE, row.id, {
        "Value":            value      || null,
        "Check Frequency":  frequency  || null,
        "Covered Through":  coveredThru || null,
        "Last Pulled":      lastPulled  || null,
        "Why It's Valuable": whyVal    || null,
        "Pull Notes":       notes       || null,
        "GPT Server Rules": gptRules    || null,
      });
      setSaveState("saved");
      onSaved({ ...row, value, frequency, coveredThru, lastPulled, whyValuable: whyVal, pullNotes: notes, gptRules });
      setTimeout(() => setSaveState("idle"), 2500);
    } catch (e) {
      setSaveState("error"); setSaveErr(e.message);
    }
  }

  function copyPrompt() {
    navigator.clipboard.writeText(fullPrompt).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  }

  const inp = { background: "#0f172a", border: "1px solid #374151", borderRadius: 6, color: "#fff", fontSize: 13, padding: "7px 9px", width: "100%", outline: "none", boxSizing: "border-box" };
  const lbl = { fontSize: 10, color: "#9ca3af", marginBottom: 3, textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 600, display: "block" };
  const saveBg = saveState === "saved" ? "#052e16" : saveState === "saving" ? "#1f2937" : "#2563eb";
  const saveBorder = saveState === "saved" ? "1px solid #166534" : "none";
  const saveColor = saveState === "saved" ? "#4ade80" : "#fff";

  const subtitle = (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
      {row.type  && <span style={{ fontSize: 11, color: "#6b7280" }}>{row.type}</span>}
      {row.firms && <span style={{ fontSize: 11, color: "#6b7280" }}>· {row.firms}</span>}
      <span style={{ fontSize: 10, fontWeight: 700, background: st.bg, color: st.color, border: `1px solid ${st.color}55`, borderRadius: 99, padding: "2px 8px" }}>{st.label}</span>
    </div>
  );

  return (
    <DrawerShell title={row.server || "—"} subtitle={subtitle} onClose={onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        {/* Start-from banner */}
        {st.key !== "skip" && (
          <div style={{ background: "#1e3a5f", border: "1px solid #2563eb", borderRadius: 8, padding: "10px 14px", fontSize: 13, fontWeight: 700, color: "#60a5fa" }}>
            {startFrom}
          </div>
        )}

        {/* Edit fields */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: 0.5 }}>Edit</div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div>
              <label style={lbl}>Priority (Value)</label>
              <select value={value} onChange={e => setValue(e.target.value)} style={inp}>
                <option value="">—</option>
                <option>High</option>
                <option>Medium</option>
                <option>Low</option>
              </select>
            </div>
            <div>
              <label style={lbl}>Check Frequency</label>
              <select value={frequency} onChange={e => setFrequency(e.target.value)} style={inp}>
                <option value="">—</option>
                <option>Weekly</option>
                <option>Every 2 weeks</option>
                <option>Monthly</option>
                <option>Skip</option>
              </select>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div>
              <label style={lbl}>Covered Through</label>
              <input type="date" value={coveredThru} onChange={e => setCoveredThru(e.target.value)} style={inp} />
            </div>
            <div>
              <label style={lbl}>Last Pulled</label>
              <div style={{ display: "flex", gap: 6 }}>
                <input type="date" value={lastPulled} onChange={e => setLastPulled(e.target.value)} style={{ ...inp, flex: 1 }} />
                <button onClick={() => setLastPulled(todayStr())}
                  style={{ background: "#1f2937", border: "1px solid #374151", borderRadius: 6, color: "#9ca3af", fontSize: 11, fontWeight: 600, padding: "0 8px", cursor: "pointer", whiteSpace: "nowrap" }}>
                  Today
                </button>
              </div>
            </div>
          </div>

          <div>
            <label style={lbl}>Why It's Valuable</label>
            <textarea value={whyVal} onChange={e => setWhyVal(e.target.value)} rows={3} style={{ ...inp, resize: "vertical" }} />
          </div>

          <div>
            <label style={lbl}>Pull Notes</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} style={{ ...inp, resize: "vertical" }} />
          </div>

          <div>
            <label style={lbl}>GPT Server Rules</label>
            <textarea value={gptRules} onChange={e => setGptRules(e.target.value)} rows={6}
              style={{ ...inp, fontFamily: "monospace", fontSize: 12, resize: "vertical" }} />
          </div>

          {saveState === "error" && <div style={{ color: "#f87171", fontSize: 12 }}>{saveErr}</div>}
          <button onClick={handleSave} disabled={saveState === "saving"}
            style={{ background: saveBg, border: saveBorder, color: saveColor, borderRadius: 7, padding: "9px 18px", fontSize: 13, fontWeight: 700, cursor: saveState === "saving" ? "not-allowed" : "pointer", alignSelf: "flex-start" }}>
            {saveState === "saving" ? "Saving..." : saveState === "saved" ? "Saved ✓" : "Save"}
          </button>
        </div>

        {/* GPT prompt */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: 0.5 }}>GPT Prompt</div>
            <button onClick={copyPrompt}
              style={{ background: copied ? "#052e16" : "#1f2937", border: `1px solid ${copied ? "#166534" : "#374151"}`, color: copied ? "#4ade80" : "#9ca3af", borderRadius: 6, padding: "4px 12px", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
              {copied ? "Copied!" : "Copy prompt"}
            </button>
          </div>
          <div style={{ background: "#0b1220", border: "1px solid #1f2937", borderRadius: 8, padding: "12px", fontSize: 12, fontFamily: "monospace", color: "#9ca3af", maxHeight: 260, overflowY: "auto", whiteSpace: "pre-wrap", lineHeight: 1.5 }}>
            {fullPrompt || <span style={{ color: "#4b5563" }}>No prompt configured.</span>}
          </div>
        </div>
      </div>
    </DrawerShell>
  );
}

// ── Base prompt drawer ───────────────────────────────────────────────────────

function BasePromptDrawer({ record, onClose, onSaved }) {
  const [val,       setVal]       = useState(record?.fields?.["Value"] || "");
  const [saveState, setSaveState] = useState("idle");
  const [saveErr,   setSaveErr]   = useState("");

  async function handleSave() {
    if (!record?.id) return;
    setSaveState("saving"); setSaveErr("");
    try {
      await updateRecord(BOT_CONFIG_TABLE, record.id, { "Value": val });
      setSaveState("saved");
      onSaved(val);
      setTimeout(() => setSaveState("idle"), 2500);
    } catch (e) {
      setSaveState("error"); setSaveErr(e.message);
    }
  }

  const saveBg = saveState === "saved" ? "#052e16" : saveState === "saving" ? "#1f2937" : "#2563eb";
  const saveBorder = saveState === "saved" ? "1px solid #166534" : "none";
  const saveColor = saveState === "saved" ? "#4ade80" : "#fff";

  return (
    <DrawerShell title="Base GPT Prompt" onClose={onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ fontSize: 12, color: "#6b7280" }}>Shared base prompt appended to every server's GPT prompt.</div>
        <textarea value={val} onChange={e => { setVal(e.target.value); setSaveState("idle"); }} rows={22}
          style={{ background: "#0f172a", border: "1px solid #374151", borderRadius: 6, color: "#fff", fontSize: 12, fontFamily: "monospace", padding: "10px", width: "100%", outline: "none", boxSizing: "border-box", resize: "vertical", lineHeight: 1.5 }} />
        {saveState === "error" && <div style={{ color: "#f87171", fontSize: 12 }}>{saveErr}</div>}
        <button onClick={handleSave} disabled={saveState === "saving"}
          style={{ background: saveBg, border: saveBorder, color: saveColor, borderRadius: 7, padding: "9px 18px", fontSize: 13, fontWeight: 700, cursor: saveState === "saving" ? "not-allowed" : "pointer", alignSelf: "flex-start" }}>
          {saveState === "saving" ? "Saving..." : saveState === "saved" ? "Saved ✓" : "Save"}
        </button>
      </div>
    </DrawerShell>
  );
}

// ── Main tab ─────────────────────────────────────────────────────────────────

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
  const [rows,        setRows]        = useState([]);
  const [basePromptRec, setBasePromptRec] = useState(null);
  const [basePrompt,  setBasePrompt]  = useState("");
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState(null);
  const [typeFilter,  setTypeFilter]  = useState("All");
  const [hideSkip,    setHideSkip]    = useState(true);
  const [openRowId,   setOpenRowId]   = useState(null);
  const [showBasePrompt, setShowBasePrompt] = useState(false);

  useEffect(() => { loadAll(); }, []);

  async function loadAll() {
    setLoading(true); setError(null);
    try {
      const [sourceRecs, configRecs] = await Promise.all([
        fetchTable(DISCORD_SOURCES_TABLE, [
          "Server", "Type", "Firm(s)", "Value", "Check Next", "Check Frequency",
          "Covered Through", "Last Pulled", "Next Due", "Why It's Valuable", "Pull Notes", "GPT Server Rules",
        ]),
        fetchTable(BOT_CONFIG_TABLE, ["Setting", "Value", "Notes"]),
      ]);
      if (sourceRecs.length > 0) console.log("[DiscordBotTab] raw record sample:", JSON.stringify(sourceRecs[0]));
      setRows(sourceRecs.map(mapRecord));
      const bpRec = configRecs.find(r => r.fields["Setting"] === "Base GPT Prompt");
      setBasePromptRec(bpRec || null);
      setBasePrompt(bpRec?.fields?.["Value"] || "");
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  }

  function handleRowSaved(updated) {
    setRows(prev => prev.map(r => r.id === updated.id ? updated : r));
  }

  if (loading) return <div style={{ color: "#6b7280", fontSize: 13, padding: 16 }}>Loading Discord sources...</div>;
  if (error)   return <div style={{ background: "#450a0a", border: "1px solid #7f1d1d", color: "#fca5a5", padding: "10px 14px", borderRadius: 8, fontSize: 13 }}>⚠ {error}</div>;

  const withStatus = rows.map(r => ({ ...r, status: computeStatus(r) }));

  // Stats over full set
  const overdue = withStatus.filter(r => r.status.key === "overdue").length;
  const soon    = withStatus.filter(r => r.status.key === "soon").length;
  const never   = withStatus.filter(r => r.status.key === "never").length;

  const filtered = withStatus
    .filter(r => typeFilter === "All" || r.type === typeFilter)
    .filter(r => !hideSkip || r.status.key !== "skip");

  const sorted = [...filtered].sort((a, b) => {
    // Primary: status group
    const sd = STATUS_SORT[a.status.key] - STATUS_SORT[b.status.key];
    if (sd !== 0) return sd;
    // Secondary: Value (High > Medium > Low)
    const vd = (VALUE_ORDER[a.value] ?? 3) - (VALUE_ORDER[b.value] ?? 3);
    if (vd !== 0) return vd;
    // Tertiary: urgency
    const da = daysDiff(a.nextDue) ?? 0;
    const db = daysDiff(b.nextDue) ?? 0;
    return da - db; // overdue: most negative first; ok/soon: soonest first
  });

  const pillBase = { borderRadius: 999, padding: "4px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer", border: "1px solid", whiteSpace: "nowrap" };
  const goldPill = active => ({ ...pillBase, background: active ? "#ffd700" : "#e5e5e5", color: "#000", borderColor: active ? "#d4a800" : "#c8c8c8", fontWeight: active ? 800 : 600 });
  const bluePill = active => ({ ...pillBase, background: active ? "#1f3a5f" : "#18222f", color: active ? "#7dd3fc" : "#888", borderColor: active ? "#3b82f6" : "#2a3442" });

  const openRow = openRowId ? withStatus.find(r => r.id === openRowId) : null;

  return (
    <div>
      {/* Stat cards */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 20 }}>
        <StatCard label="Overdue"       value={overdue} color="#f87171" />
        <StatCard label="Due soon"      value={soon}    color="#fb923c" />
        <StatCard label="Never pulled"  value={never}   color="#9ca3af" />
        <StatCard label="Total servers" value={rows.length} color="#e5e7eb" />
      </div>

      {/* Filters + base prompt button */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 16, alignItems: "center" }}>
        {[["All", "All"], ["Multi-firm community", "Multi-firm"], ["Firm's own server", "Firm's own"]].map(([val, label]) => (
          <button key={val} onClick={() => setTypeFilter(val)} style={goldPill(typeFilter === val)}>{label}</button>
        ))}
        <div style={{ width: 1, height: 20, background: "#374151", margin: "0 4px" }} />
        <button onClick={() => setHideSkip(v => !v)} style={bluePill(!hideSkip)}>
          {hideSkip ? "Show Skip" : "Hide Skip"}
        </button>
        <div style={{ flex: 1 }} />
        <button onClick={() => setShowBasePrompt(true)}
          style={{ ...pillBase, background: "#1f2937", color: "#9ca3af", borderColor: "#374151" }}>
          Edit base prompt
        </button>
      </div>

      {/* Row list */}
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {sorted.length === 0 && <div style={{ color: "#6b7280", fontSize: 13 }}>No servers match the current filters.</div>}
        {sorted.map(row => {
          const st = row.status;
          const startFrom = row.coveredThru ? `Start next pull from: ${fmtDate(row.coveredThru)}` : "Start: last 2–3 weeks";
          return (
            <button
              key={row.id}
              onClick={() => setOpenRowId(row.id)}
              style={{ width: "100%", background: "#111827", border: "1px solid #1f2937", borderRadius: 10, padding: "10px 14px", cursor: "pointer", textAlign: "left" }}
            >
              <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, marginBottom: 5 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: "#e5e7eb", flex: "1 1 160px" }}>{row.server || "—"}</span>
                <ValueBadge value={row.value} />
                <span style={{ fontSize: 10, fontWeight: 700, background: st.bg, color: st.color, border: `1px solid ${st.color}55`, borderRadius: 99, padding: "2px 8px", whiteSpace: "nowrap" }}>
                  {st.label}
                </span>
                {row.frequency && st.key !== "skip" && (
                  <span style={{ fontSize: 10, color: "#6b7280", whiteSpace: "nowrap" }}>{row.frequency}</span>
                )}
              </div>

              {st.key !== "skip" && (
                <div style={{ fontSize: 12, fontWeight: 700, color: "#60a5fa", marginBottom: 4 }}>{startFrom}</div>
              )}

              <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
                {row.coveredThru && (
                  <span style={{ fontSize: 11, color: "#4b5563" }}>Covered through: <span style={{ color: "#9ca3af" }}>{fmtDate(row.coveredThru)}</span></span>
                )}
                {row.lastPulled && (
                  <span style={{ fontSize: 11, color: "#4b5563" }}>Last pulled: <span style={{ color: "#9ca3af" }}>{fmtDate(row.lastPulled)}</span></span>
                )}
                {row.nextDue && st.key !== "skip" && (
                  <span style={{ fontSize: 11, color: "#4b5563" }}>Next due: <span style={{ color: "#9ca3af" }}>{fmtDate(row.nextDue)}</span></span>
                )}
                {row.firms && (
                  <span style={{ fontSize: 11, color: "#4b5563" }}>Firms: <span style={{ color: "#9ca3af" }}>{row.firms}</span></span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Source drawer */}
      {openRow && (
        <SourceDrawer
          key={openRow.id}
          row={openRow}
          basePrompt={basePrompt}
          onClose={() => setOpenRowId(null)}
          onSaved={updated => { handleRowSaved(updated); setOpenRowId(null); }}
        />
      )}

      {/* Base prompt drawer */}
      {showBasePrompt && (
        <BasePromptDrawer
          record={basePromptRec}
          onClose={() => setShowBasePrompt(false)}
          onSaved={newVal => { setBasePrompt(newVal); setShowBasePrompt(false); }}
        />
      )}
    </div>
  );
}
