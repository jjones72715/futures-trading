import { $$ } from '../utils/format.js';

export function NetValueGroup({ netValue, annualFee, hasAnyValue, mode = 'portfolio' }) {
  const difference = netValue - (annualFee || 0);

  if (mode === 'audit' && !hasAnyValue) {
    return (
      <span style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.35)', fontStyle: 'italic' }}>
        Not evaluated
      </span>
    );
  }

  const diffColor = netValue === 0
    ? 'rgba(255,255,255,0.35)'
    : difference >= 0 ? '#00E676' : '#FF4D4D';

  return (
    <span style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)', whiteSpace: 'nowrap' }}>
      Net {$$(netValue)} · Diff{' '}
      <span style={{ color: diffColor, fontWeight: 600 }}>
        {difference > 0 ? '+' : ''}{$$(difference)}
      </span>
    </span>
  );
}
