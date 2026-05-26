export function $$(v) {
  if (v === null || v === undefined || v === "") return "—";
  const n = parseFloat(v);
  if (isNaN(n)) return "—";
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

export function $$target(v) {
  if (!v || v === 0) return "Max";
  const n = parseFloat(v);
  if (isNaN(n) || n > 4501) return "Max";
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

export function lpColor(n) {
  if (n <= 1) return "#22c55e";
  if (n >= 10) return "#ef4444";
  if (n <= 5) {
    const t = (n - 1) / 4;
    return `rgb(${Math.round(34 + 200 * t)},${Math.round(197 - 18 * t)},${Math.round(94 - 86 * t)})`;
  }
  const t = (n - 5) / 5;
  return `rgb(${Math.round(234 + 5 * t)},${Math.round(179 - 111 * t)},${Math.round(8 + 60 * t)})`;
}

export function toScore(p) {
  if (!p && p !== 0) return 0;
  return Math.max(1, Math.min(10, Math.round(p * 10)));
}
