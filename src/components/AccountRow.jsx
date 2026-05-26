import React from "react";
import { $$, $$target } from "../utils/format.js";
import { Bar } from "./Bar.jsx";
import { SafetyBar } from "./SafetyBar.jsx";

export function WaitingSection({ accounts, inputs, noChanges, dones, onInput, onNoChange, onDone, onBreach }) {
  const active = accounts.filter(a => !dones[a.id]);
  if (active.length === 0) return null;
  const sorted = active.slice().sort((a, b) => a.name.localeCompare(b.name));
  return (
    <div style={{ marginBottom: 28 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <div style={{ width: 3, height: 18, background: "#6b7280", borderRadius: 99 }} />
        <span style={{ fontSize: 14, fontWeight: 700, color: "#e5e7eb" }}>Waiting on Payout</span>
        <span style={{ background: "#1f2937", color: "#9ca3af", fontSize: 11, padding: "1px 7px", borderRadius: 99 }}>{sorted.length}</span>
      </div>
      {sorted.map((a, i) => (
        <AccountRow key={a.id} a={a} i={i} inputVal={inputs[a.id] || ""} noChange={!!noChanges[a.id]} done={!!dones[a.id]} onInput={val => onInput(a.id, val)} onNoChange={() => onNoChange(a.id)} onDone={() => onDone(a.id)} onBreach={() => onBreach(a)} />
      ))}
    </div>
  );
}

export const AccountRow = React.memo(function AccountRow({ a, i, inputVal, noChange, done, onInput, onNoChange, onDone, onBreach }) {
  const [localVal, setLocalVal] = React.useState(inputVal);
  React.useEffect(() => { setLocalVal(inputVal); }, [inputVal]);
  const v = parseFloat(localVal);
  const hasV = localVal !== "" && !isNaN(v);
  const diff = noChange ? 0 : hasV ? (v - a.bal) * a.n : null;
  const pos = diff > 0;
  const zero = diff === 0;
  const tradeDownHit = a.tradeDown && hasV && !noChange && diff !== null && diff < 0 && Math.abs(diff / a.n) >= (a.ddToFloor || a.ddLeft);

  return (
    <div style={{
      background: done ? "#0a0f1a" : "#111827",
      border: `1px solid ${tradeDownHit ? "#dc2626" : done ? "#1a2030" : noChange ? "#1f4f1f" : hasV ? (pos ? "#166534" : "#7f1d1d") : "#1f2937"}`,
      borderRadius: 10, padding: "10px 14px", marginBottom: 5,
      display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap",
      opacity: done ? 0.45 : 1,
      boxShadow: tradeDownHit ? "0 0 12px rgba(220,38,38,0.4)" : "none",
    }}>
      <div style={{ width: 22, height: 22, background: "#1f2937", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, color: "#9ca3af", flexShrink: 0 }}>{i + 1}</div>

      <div style={{ width: 185, flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 2 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: done ? "#4b5563" : "#fff" }}>{a.name}</span>
          {a.tradeDown && <span style={{ fontSize: 9, fontWeight: 700, background: "#7f1d1d", color: "#fca5a5", padding: "1px 5px", borderRadius: 4 }}>TD</span>}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <span style={{ fontSize: 11, color: "#6b7280" }}>{a.trader}</span>
          {a.n > 1 && <span style={{ fontSize: 10, color: "#6b7280" }}>×{a.n}</span>}
          {a.contractMultiplier > 1 && <span style={{ fontSize: 10, background: "#1e3a5f", color: "#93c5fd", padding: "1px 5px", borderRadius: 4 }}>{a.contractMultiplier}x</span>}
        </div>
      </div>

      {a.prog > 0 && (
        <div style={{ width: 105, flexShrink: 0 }}>
          <div style={{ fontSize: 10, color: "#6b7280", marginBottom: 3 }}>Progress</div>
          <Bar prog={a.prog} />
        </div>
      )}

      <div style={{ width: 95, flexShrink: 0 }}>
        <div style={{ fontSize: 10, color: "#6b7280", marginBottom: 2 }}>Balance</div>
        <div style={{ fontSize: 13, fontWeight: 600, color: done ? "#4b5563" : "#fff" }}>{$$(a.bal)}</div>
      </div>

      <div style={{ width: 80, flexShrink: 0 }}>
        <div style={{ fontSize: 10, color: "#6b7280", marginBottom: 2 }}>Daily Target</div>
        <div style={{ fontSize: 13, fontWeight: 600, color: done ? "#4b5563" : "#4ade80" }}>{$$(a.dailyTarget)}</div>
      </div>

      <div style={{ width: 80, flexShrink: 0 }}>
        <div style={{ fontSize: 10, color: "#6b7280", marginBottom: 2 }}>{a.tradeDown ? "DD to Floor" : "DD Left"}</div>
        <div style={{ fontSize: 13, fontWeight: 600, color: done ? "#4b5563" : a.tradeDown ? "#f87171" : "#fde68a" }}>{$$(a.tradeDown ? a.ddToFloor : a.ddLeft)}</div>
      </div>

      <div style={{ width: 75, flexShrink: 0 }}>
        <div style={{ fontSize: 10, color: "#6b7280", marginBottom: 2 }}>DD Safety</div>
        <SafetyBar safety={a.ddSafety} />
      </div>

      <div style={{ width: 75, flexShrink: 0 }}>
        <div style={{ fontSize: 10, color: "#6b7280", marginBottom: 2 }}>Invested</div>
        <div style={{ fontSize: 13, fontWeight: 600, color: done ? "#4b5563" : "#c4b5fd" }}>{$$(a.invested)}</div>
      </div>

      {tradeDownHit && (
        <div style={{ width: "100%", background: "#450a0a", border: "1px solid #dc2626", borderRadius: 8, padding: "8px 12px", display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 16 }}>⚠️</span>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#fca5a5" }}>TRADE DOWN TRIGGERED — Recovery trade required</div>
            <div style={{ fontSize: 11, color: "#f87171" }}>Target: get back to {$$(a.bal)} or breach. {a.invested > 0 && `Pull ${$$(Math.abs(diff / a.ddLeft) * a.invested)} from this account's investment.`}</div>
          </div>
        </div>
      )}

      <div style={{ flex: 1, minWidth: 220 }}>
        <div style={{ fontSize: 10, color: "#6b7280", marginBottom: 3 }}>Today's Ending Balance</div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          <button onClick={onNoChange} disabled={done}
            style={{ background: noChange ? "#166534" : "#1f2937", border: `1px solid ${noChange ? "#22c55e" : "#374151"}`, borderRadius: 7, padding: "6px 10px", fontSize: 11, color: noChange ? "#4ade80" : "#9ca3af", cursor: done ? "default" : "pointer", fontWeight: 600, whiteSpace: "nowrap", opacity: done ? 0.4 : 1 }}>
            {noChange ? "✓ No Change" : "No Change"}
          </button>
          <input type="number" placeholder={String(a.bal)} value={localVal} onChange={e => setLocalVal(e.target.value)} onBlur={e => {
              onInput(e.target.value);
            }} disabled={noChange}
            style={{ background: noChange ? "#0d1117" : "#1f2937", border: "1px solid #1f2937", borderRadius: 7, padding: "6px 10px", fontSize: 13, color: noChange ? "#4b5563" : "#fff", width: 125, outline: "none", MozAppearance: "textfield", WebkitAppearance: "none" }} />
          {diff !== null && !done && (
            <span style={{ fontSize: 13, fontWeight: 600, color: zero ? "#6b7280" : pos ? "#4ade80" : "#f87171" }}>
              {zero ? "±$0" : (pos ? "+" : "") + $$(diff)}
            </span>
          )}
          <button onClick={e => { e.stopPropagation(); onBreach(); }} title="Log a breach"
            style={{ background: "#450a0a", border: "1px solid #7f1d1d", borderRadius: 7, width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", fontSize: 15, flexShrink: 0 }}>
            💥
          </button>
          <button onClick={e => { e.stopPropagation(); onDone(); }} title={done ? "Mark as active" : "Done for today"}
            style={{ background: done ? "#166534" : "#1f2937", border: `1px solid ${done ? "#22c55e" : "#374151"}`, borderRadius: 7, width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", fontSize: 15, flexShrink: 0 }}>
            {done ? "✓" : "☐"}
          </button>
          {a.status === "Live" && (
            <span style={{ fontSize: 10, fontWeight: 700, background: "#7f1d1d", color: "#fca5a5", padding: "3px 8px", borderRadius: 6 }}>LIVE</span>
          )}
          {a.status === "Waiting on Payout" && (
            <span style={{ fontSize: 10, fontWeight: 700, background: "#1c3a1c", color: "#4ade80", padding: "3px 8px", borderRadius: 6 }}>WAITING</span>
          )}
        </div>
      </div>
    </div>
  );
});

export function SectionGroup({ title, accounts, inputs, noChanges, dones, onInput, onNoChange, onDone, onBreach, startIndex }) {
  if (accounts.length === 0) return null;
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0", borderBottom: "1px solid #1f2937", marginBottom: 8 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: 1 }}>{title}</span>
        <span style={{ background: "#1f2937", color: "#6b7280", fontSize: 10, padding: "1px 6px", borderRadius: 99 }}>{accounts.length}</span>
      </div>
      {accounts.map((a, i) => (
        <AccountRow key={a.id} a={a} i={startIndex + i} inputVal={inputs[a.id] || ""} noChange={!!noChanges[a.id]} done={!!dones[a.id]} onInput={val => onInput(a.id, val)} onNoChange={() => onNoChange(a.id)} onDone={() => onDone(a.id)} onBreach={() => onBreach(a)} />
      ))}
    </div>
  );
}

export function Section({ title, accounts, inputs, noChanges, dones, onInput, onNoChange, onDone, onBreach, color }) {
  if (accounts.length === 0) return null;
  const active = accounts.filter(a => !dones[a.id]);
  if (active.length === 0) return null;

  const groups = {};
  active.forEach(a => {
    const dp = a.dataProvider || "Other";
    if (!groups[dp]) groups[dp] = [];
    groups[dp].push(a);
  });
  const sorted = Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));

  let idx = 0;
  return (
    <div style={{ marginBottom: 28 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <div style={{ width: 3, height: 18, background: color, borderRadius: 99 }} />
        <span style={{ fontSize: 14, fontWeight: 700, color: "#e5e7eb" }}>{title}</span>
        <span style={{ background: "#1f2937", color: "#9ca3af", fontSize: 11, padding: "1px 7px", borderRadius: 99 }}>{active.length}</span>
      </div>
      {sorted.map(([dp, accs]) => {
        const start = idx;
        idx += accs.length;
      return <SectionGroup key={dp} title={dp} accounts={accs} inputs={inputs} noChanges={noChanges} dones={dones} onInput={onInput} onNoChange={onNoChange} onDone={onDone} onBreach={onBreach} startIndex={start} />;
      })}
    </div>
  );
}

export function DoneSection({ accounts, inputs, noChanges, dones, onInput, onNoChange, onDone }) {
  const done = accounts.filter(a => dones[a.id]);
  if (done.length === 0) return null;
  return (
    <div style={{ marginTop: 32 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, borderTop: "1px solid #1f2937", paddingTop: 20 }}>
        <div style={{ width: 3, height: 18, background: "#374151", borderRadius: 99 }} />
        <span style={{ fontSize: 14, fontWeight: 700, color: "#4b5563" }}>Done for Today</span>
        <span style={{ background: "#1f2937", color: "#4b5563", fontSize: 11, padding: "1px 7px", borderRadius: 99 }}>{done.length}</span>
      </div>
      {done.map((a, i) => (
        <AccountRow key={a.id} a={a} i={i} inputVal={inputs[a.id] || ""} noChange={!!noChanges[a.id]} done={true} onInput={val => onInput(a.id, val)} onNoChange={() => onNoChange(a.id)} onDone={() => onDone(a.id)} onBreach={() => onBreach(a)}/>
      ))}
    </div>
  );
}
