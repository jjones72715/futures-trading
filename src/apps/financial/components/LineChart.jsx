import { useEffect, useRef, useState } from 'react';
import { formatCompactCurrency, formatCurrency } from '../utils/formatters.js';

function useWidth() {
  const ref = useRef(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  return [ref, width];
}

/**
 * Minimal SVG line chart. points: [{ label, value }] in chronological order.
 * `sparkline` hides axes and labels.
 */
export default function LineChart({ points, height = 260, sparkline = false, color = '#00D4FF' }) {
  const [ref, width] = useWidth();
  const [hover, setHover] = useState(null);

  const pad = sparkline ? { t: 8, r: 8, b: 8, l: 8 } : { t: 16, r: 20, b: 32, l: 64 };
  const innerW = Math.max(0, width - pad.l - pad.r);
  const innerH = height - pad.t - pad.b;

  const values = points.map(p => p.value);
  let min = Math.min(...values);
  let max = Math.max(...values);
  if (min === max) { min -= Math.abs(min) * 0.1 || 1; max += Math.abs(max) * 0.1 || 1; }
  const span = max - min;
  min -= span * 0.08;
  max += span * 0.08;

  const x = (i) => pad.l + (points.length === 1 ? innerW / 2 : (i / (points.length - 1)) * innerW);
  const y = (v) => pad.t + innerH - ((v - min) / (max - min)) * innerH;

  const line = points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ');
  const area = points.length > 1
    ? `${line} L${x(points.length - 1).toFixed(1)},${pad.t + innerH} L${x(0).toFixed(1)},${pad.t + innerH} Z`
    : '';

  const ticks = sparkline ? [] : Array.from({ length: 5 }, (_, i) => min + ((max - min) * i) / 4);
  const labelEvery = Math.max(1, Math.ceil(points.length / Math.max(1, Math.floor(innerW / 70))));
  const gradId = `fin-grad-${sparkline ? 's' : 'f'}`;

  function onMove(e) {
    if (!points.length || !innerW) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - rect.left - pad.l;
    const i = points.length === 1 ? 0 : Math.round((px / innerW) * (points.length - 1));
    setHover(Math.max(0, Math.min(points.length - 1, i)));
  }

  return (
    <div ref={ref} style={{ width: '100%', position: 'relative' }}>
      {width > 0 && points.length > 0 && (
        <svg width={width} height={height} onMouseMove={onMove} onMouseLeave={() => setHover(null)} style={{ display: 'block' }}>
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity="0.28" />
              <stop offset="100%" stopColor={color} stopOpacity="0" />
            </linearGradient>
          </defs>
          {ticks.map((t, i) => (
            <g key={i}>
              <line x1={pad.l} x2={pad.l + innerW} y1={y(t)} y2={y(t)} stroke="rgba(255,255,255,0.07)" />
              <text x={pad.l - 8} y={y(t)} textAnchor="end" dominantBaseline="middle" fill="rgba(255,255,255,0.45)" fontSize="11">
                {formatCompactCurrency(t)}
              </text>
            </g>
          ))}
          {!sparkline && points.map((p, i) => (i % labelEvery === 0 || i === points.length - 1) && (
            <text key={i} x={x(i)} y={height - 10} textAnchor="middle" fill="rgba(255,255,255,0.45)" fontSize="11">{p.label}</text>
          ))}
          {area && <path d={area} fill={`url(#${gradId})`} />}
          <path d={line} fill="none" stroke={color} strokeWidth={sparkline ? 2 : 2.5} strokeLinejoin="round" strokeLinecap="round" />
          {points.map((p, i) => (
            <circle key={i} cx={x(i)} cy={y(p.value)} r={hover === i ? 5 : sparkline ? 2.5 : 3.5}
              fill={hover === i ? color : '#0B1220'} stroke={color} strokeWidth="2" />
          ))}
          {hover != null && (
            <line x1={x(hover)} x2={x(hover)} y1={pad.t} y2={pad.t + innerH} stroke="rgba(255,255,255,0.15)" strokeDasharray="3 3" />
          )}
        </svg>
      )}
      {hover != null && points[hover] && (
        <div style={{
          position: 'absolute', top: 0, left: Math.min(Math.max(x(hover) - 70, 0), Math.max(0, width - 140)),
          width: 140, pointerEvents: 'none', background: '#0B1220', border: '1px solid rgba(255,255,255,0.12)',
          borderRadius: 8, padding: '5px 8px', fontSize: '0.75rem', textAlign: 'center',
        }}>
          <div style={{ color: 'rgba(255,255,255,0.5)' }}>{points[hover].label}</div>
          <div style={{ fontWeight: 700 }}>{formatCurrency(points[hover].value)}</div>
        </div>
      )}
    </div>
  );
}
