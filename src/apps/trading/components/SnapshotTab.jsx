import React from "react";
import { $$, $$target, lpColor } from "../utils/format.js";

export function SnapshotTab({ evalAccounts = [], perfAccounts = [], dones = {} }) {
  const standardPerf = perfAccounts.filter(a => !a.payoutAccount && a.status === "Active");
  const livePerf = perfAccounts.filter(a => a.status === "Live" || (a.payoutAccount && a.status === "Active"));
  const waitingPerf = perfAccounts.filter(a => a.status === "Waiting on Payout");

  function groupByProvider(accounts, sortFn) {
    const defaultSort = (a, b) => {
      const va = a.score != null ? a.score : 99;
      const vb = b.score != null ? b.score : 99;
      return va - vb;
    };
    const active = accounts.filter(a => !dones[a.id]).slice().sort(sortFn || defaultSort);
    const done = accounts.filter(a => dones[a.id]);
    const all = [...active, ...done];
    const byProvider = {};
    all.forEach(a => {
      const dp = a.dataProvider || "Other";
      if (!byProvider[dp]) byProvider[dp] = [];
      byProvider[dp].push(a);
    });
    return byProvider;
  }

  function SnapCard(a) {
    const isDone = !!dones[a.id];
    const header = [a.traderName || a.name, a.firmName || a.dataProvider || "—"].filter(Boolean).join(" — ");
    const snapBg = isDone ? "#0d1117" : a.status === "Waiting on Payout" ? "#160d1f" : a.status === "Live" ? "#051a0e" : a.payoutAccount ? "#1c0e05" : a.type === "perf" ? "#011418" : "#1a0614";
    const snapBorder = isDone ? "#1f2937" : a.status === "Waiting on Payout" ? "#a855f755" : a.status === "Live" ? "#22c55e55" : a.payoutAccount ? "#f9731655" : a.type === "perf" ? "#06b6d455" : "#ec489955";

    if (a.status === "Waiting on Payout") {
      return (
        <div key={a.id} style={{ background: snapBg, border: `1px solid ${snapBorder}`, borderRadius: 6, padding: "6px 8px", marginBottom: 3, opacity: isDone ? 0.4 : 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: isDone ? "#4b5563" : "#d1d5db", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>{header}</span>
            <span style={{ fontSize: 8, fontWeight: 700, background: "#2d1545", color: "#d8b4fe", padding: "1px 4px", borderRadius: 3, flexShrink: 0 }}>WAITING</span>
          </div>
        </div>
      );
    }

    const isLivePayout = a.status === "Live" || (a.payoutAccount && a.status === "Active");

    if (isLivePayout) {
      const profitPerAcct = a.ddLeft ?? null;
      const amtForPayout = a.stageTarget != null && a.bal != null ? a.stageTarget - a.bal : null;
      const acctValue = a.contractMultiplier > 0 && a.ddLeft != null ? a.ddLeft * (a.n || 1) / a.contractMultiplier : null;
      const payoutScore = amtForPayout == null ? null : amtForPayout <= 0 ? "✓" : Math.min(10, Math.ceil(amtForPayout / 500));
      const daysScore = a.tradingDaysLeft == null ? null : a.tradingDaysLeft <= 0 ? "✓" : a.tradingDaysLeft;
      const psColor = payoutScore === "✓" ? "#22c55e" : payoutScore != null ? lpColor(payoutScore) : "#4b5563";
      const dsColor = daysScore === "✓" ? "#22c55e" : daysScore != null ? lpColor(Math.min(daysScore, 10)) : "#4b5563";
      const stats = [
        ["Trade Target", $$target(a.limit)],
        ["Profit Target", a.stageTarget ? $$(a.stageTarget) : "—"],
        ["Daily Loss", a.dailyLossLimit ? $$(a.dailyLossLimit) : "—"],
        ["Acct #", a.accountNumber ?? "—"],
        ["Days Left", a.tradingDaysLeft ?? "—"],
        ["Multiplier", a.contractMultiplier ?? 1],
        ["Profit/Acct", profitPerAcct != null ? $$(profitPerAcct) : "—"],
        ["Amt for Payout", amtForPayout == null ? "—" : amtForPayout <= 0 ? "✓ Met" : $$(amtForPayout)],
        ["Acct Value", acctValue != null ? $$(acctValue) : "—"],
      ];
      return (
        <div key={a.id} style={{ background: snapBg, border: `1px solid ${snapBorder}`, borderRadius: 6, padding: "6px 8px", marginBottom: 3, opacity: isDone ? 0.4 : 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 5 }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: isDone ? "#4b5563" : "#d1d5db", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>{header}</span>
            {a.status === "Live" && <span style={{ fontSize: 8, fontWeight: 700, background: "#7f1d1d", color: "#fca5a5", padding: "1px 4px", borderRadius: 3, flexShrink: 0 }}>LIVE</span>}
            <span style={{ fontSize: 10, fontWeight: 800, background: `${psColor}22`, color: psColor, padding: "0px 5px", borderRadius: 99, flexShrink: 0, border: `1px solid ${psColor}` }}>{payoutScore ?? "—"}</span>
            <span style={{ fontSize: 10, fontWeight: 800, background: `${dsColor}22`, color: dsColor, padding: "0px 5px", borderRadius: 99, flexShrink: 0, border: `1px solid ${dsColor}` }}>{daysScore ?? "—"}</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 3 }}>
            {stats.map(([lbl, val]) => (
              <div key={lbl} style={{ textAlign: "center" }}>
                <div style={{ fontSize: 8, color: "#4b5563", textTransform: "uppercase", letterSpacing: 0.3, marginBottom: 1 }}>{lbl}</div>
                <div style={{ fontSize: 10, fontWeight: 700, color: isDone ? "#4b5563" : "#fbbf24" }}>{val}</div>
              </div>
            ))}
          </div>
        </div>
      );
    }

    const sc = a.score;
    const scoreColor = sc == null ? null : sc >= 8 ? "#22c55e" : sc >= 5 ? "#eab308" : "#ef4444";
    return (
      <div key={a.id} style={{ background: snapBg, border: `1px solid ${snapBorder}`, borderRadius: 6, padding: "6px 8px", marginBottom: 3, opacity: isDone ? 0.4 : 1 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 5 }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: isDone ? "#4b5563" : "#d1d5db", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>{header}</span>
          {a.type === "eval" && a.purchases30 != null && (
            <span style={{ fontSize: 10, fontWeight: 800, background: "#1e3a5f", color: "#93c5fd", padding: "0px 7px", borderRadius: 99, border: "1px solid #3b82f6", flexShrink: 0, whiteSpace: "nowrap" }} title="Purchases last 30 days">
              {a.purchases30}
            </span>
          )}
          <span style={{ fontSize: 11, fontWeight: 800, background: scoreColor ? `${scoreColor}22` : "#1f2937", color: scoreColor ?? "#4b5563", padding: "0px 6px", borderRadius: 99, flexShrink: 0, border: `1px solid ${scoreColor ?? "#374151"}` }}>
            {sc != null ? sc : "—"}
          </span>
          {a.status === "Live" && !isDone && <span style={{ fontSize: 8, fontWeight: 700, background: "#7f1d1d", color: "#fca5a5", padding: "1px 4px", borderRadius: 3, flexShrink: 0 }}>LIVE</span>}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 3 }}>
          {[["Trade Target", $$target(a.limit)], ["Profit Target", a.type === "eval" ? (a.profitTarget ? $$(a.profitTarget) : "—") : (a.stageTarget ? $$(a.stageTarget) : "—")], ["Daily Loss", a.dailyLossLimit ? $$(a.dailyLossLimit) : "—"], ["Acct #", a.accountNumber ?? "—"], ["Days Left", a.tradingDaysLeft ?? "—"], a.type === "eval" ? ["Weight", a.accountWeight ?? "—"] : ["Multiplier", a.contractMultiplier ?? 1]].map(([lbl, val]) => (
            <div key={lbl} style={{ textAlign: "center" }}>
              <div style={{ fontSize: 8, color: "#4b5563", textTransform: "uppercase", letterSpacing: 0.3, marginBottom: 1 }}>{lbl}</div>
              <div style={{ fontSize: 10, fontWeight: 700, color: isDone ? "#4b5563" : "#4ade80" }}>{val}</div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  function SnapSection({ title, color, accounts, sortFn }) {
    if (accounts.length === 0) return null;
    const byProvider = groupByProvider(accounts, sortFn);
    const feedOrder = ["DX Feed", "Rithmic", "Tradovate", "Project X"];
    const providers = [...Object.keys(byProvider)].sort((a, b) => { const ia = feedOrder.indexOf(a), ib = feedOrder.indexOf(b); if (ia === -1 && ib === -1) return a.localeCompare(b); if (ia === -1) return 1; if (ib === -1) return -1; return ia - ib; });
    const activeCount = accounts.filter(a => !dones[a.id]).length;
    return (
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
          <div style={{ width: 3, height: 14, background: color, borderRadius: 99 }} />
          <span style={{ fontSize: 12, fontWeight: 700, color: "#e5e7eb" }}>{title}</span>
          <span style={{ background: "#1f2937", color: "#9ca3af", fontSize: 9, padding: "1px 5px", borderRadius: 99 }}>{activeCount}</span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: `repeat(${Math.min(providers.length, 4)}, 1fr)`, gap: 6 }}>
          {providers.map(dp => (
            <div key={dp}>
              <div style={{ fontSize: 9, fontWeight: 700, color: "#374151", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 4, paddingBottom: 2, borderBottom: "1px solid #1f2937" }}>{dp}</div>
              {byProvider[dp].map(a => SnapCard(a))}
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      {SnapSection({ title: "Evaluation Accounts", color: "#ec4899", accounts: evalAccounts })}
      {SnapSection({ title: "Performance Accounts", color: "#06b6d4", accounts: standardPerf })}
      {SnapSection({ title: "Live & Payout Accounts", color: "#22c55e", accounts: livePerf, sortFn: (a, b) => {
  const lpMax = acc => {
    const amt = acc.stageTarget != null ? acc.stageTarget - acc.bal : null;
    const ps = amt == null ? 0 : amt <= 0 ? 0 : Math.min(10, Math.ceil(amt / 500));
    const ds = acc.tradingDaysLeft == null ? 0 : acc.tradingDaysLeft <= 0 ? 0 : acc.tradingDaysLeft;
    return Math.max(ps, ds);
  };
  return lpMax(a) - lpMax(b);
} })}
      {SnapSection({ title: "Waiting on Payout", color: "#a855f7", accounts: waitingPerf })}
    </div>
  );
}
