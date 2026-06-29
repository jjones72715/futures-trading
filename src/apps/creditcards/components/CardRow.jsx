import { $$ } from '../utils/format.js';
import { StatusBadge } from './StatusBadge.jsx';
import { AnnualFeeBadge } from './AnnualFeeBadge.jsx';

const BANK_NAMES = {
  'recmOSLhOAYVqi09z': 'American Express',
  'recirpPT41J9yWOso': 'Barclays',
  'recUwpGOntDp5O9Pn': 'Bank of America',
  'reci7K7HYue3nEx7e': 'Capital One',
  'recuAO5OVmsDNWW6D': 'Cardless',
  'recgw2ngVEO8gBpoq': 'Chase',
  'rec9ePERLvVM24fqx': 'Citi',
  'rec2BUeHI8gDyNcya': 'Discover',
  'rec8clRqXmQ4EjDEI': 'Mercury',
  'recRyPOXcDNKrWK53': 'U.S. Bank',
  'recRKg9TA1IQpRkmH': 'Wells Fargo',
};

const RISK_COLORS = {
  Low: '#00E676',
  Medium: '#FFD60A',
  High: '#FF4D4D',
};

function extractProgramName(field) {
  if (!field) return '—';
  if (Array.isArray(field)) return field[0] || '—';
  if (typeof field === 'string') return field;
  return '—';
}

export function CardRow({ card }) {
  const f = card.fields;
  const issuerRaw = f['Issuer'];
  const issuerKey = Array.isArray(issuerRaw) ? issuerRaw[0] : issuerRaw;
  const issuer = (issuerKey && BANK_NAMES[issuerKey]) || issuerKey || '—';
  const cardType = f['Personal/Business'];
  const cancelRisk = f['Cancel Risk Level'];
  const riskColor = RISK_COLORS[cancelRisk] ?? 'rgba(255,255,255,0.4)';

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '2fr 1fr 90px 1fr 80px 70px 110px 80px',
      alignItems: 'center',
      gap: '0.75rem',
      padding: '0.75rem 1rem',
      borderBottom: '1px solid rgba(255,255,255,0.05)',
    }}>
      <div>
        <div style={{ fontWeight: 600, color: '#fff', fontSize: '0.9rem' }}>
          {f['Card Name'] || '—'}
        </div>
        <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.45)', marginTop: 2 }}>
          {issuer}
        </div>
      </div>

      <div>
        {cardType && (
          <span style={{
            padding: '2px 10px',
            borderRadius: 20,
            fontSize: '0.72rem',
            fontWeight: 600,
            background: cardType === 'Business' ? 'rgba(0,212,255,0.12)' : 'rgba(255,255,255,0.08)',
            color: cardType === 'Business' ? '#00D4FF' : 'rgba(255,255,255,0.6)',
            border: `1px solid ${cardType === 'Business' ? '#00D4FF44' : 'rgba(255,255,255,0.12)'}`,
          }}>
            {cardType}
          </span>
        )}
      </div>

      <div style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.6)' }}>
        {extractProgramName(f['Program Name (from Rewards Program)'])}
      </div>

      <div style={{ fontSize: '0.85rem', color: '#fff' }}>
        {$$(f['Annual Fee Amount'])}
      </div>

      <div>
        <AnnualFeeBadge days={f['Days Until Annual Fee']} />
      </div>

      <div>
        <StatusBadge status={f['Annual Fee Status']} />
      </div>

      <div>
        {cancelRisk && (
          <span style={{
            padding: '2px 10px',
            borderRadius: 20,
            fontSize: '0.72rem',
            fontWeight: 600,
            background: riskColor + '22',
            color: riskColor,
            border: `1px solid ${riskColor}55`,
          }}>
            {cancelRisk}
          </span>
        )}
      </div>
    </div>
  );
}
