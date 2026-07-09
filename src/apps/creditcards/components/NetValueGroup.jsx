import { $$ } from '../utils/format.js';

export function TotalPerkValueCell({ netValue, hasAnyValue, mode = 'portfolio' }) {
  if (mode === 'audit' && !hasAnyValue) {
    return <span style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.3)' }}>—</span>;
  }
  return <span style={{ fontSize: '0.85rem', color: '#fff' }}>{$$(netValue)}</span>;
}

export function DifferenceCell({ netValue, annualFee, hasAnyValue, mode = 'portfolio' }) {
  if (mode === 'audit' && !hasAnyValue) {
    return (
      <span style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.35)', fontStyle: 'italic' }}>
        Not evaluated
      </span>
    );
  }
  const difference = netValue - (annualFee || 0);
  const color = netValue === 0 ? 'rgba(255,255,255,0.35)' : difference >= 0 ? '#00E676' : '#FF4D4D';
  return (
    <span style={{ fontSize: '0.85rem', color, fontWeight: 700 }}>
      {difference > 0 ? '+' : ''}{$$(difference)}
    </span>
  );
}
