import { Skel } from './ui.jsx';

// Compact one-row summary (~64px) used in place of a grid of large stat cards.
// items: [{ label, value, color, sub }]
export default function SummaryStrip({ items, loading }) {
  if (loading) {
    return (
      <div className="fin-strip">
        {[0, 1, 2, 3].map(i => (
          <div key={i} className="fin-strip-item"><Skel w="45%" h={10} /><Skel w="70%" h={18} style={{ marginTop: 6 }} /></div>
        ))}
      </div>
    );
  }
  return (
    <div className="fin-strip">
      {items.map(it => (
        <div key={it.label} className="fin-strip-item">
          <div className="fin-strip-label">{it.label}</div>
          <div className="fin-strip-row">
            <span className="fin-strip-value" style={it.color ? { color: it.color } : undefined}>{it.value}</span>
            {it.sub && <span className="fin-strip-sub">{it.sub}</span>}
          </div>
        </div>
      ))}
    </div>
  );
}
