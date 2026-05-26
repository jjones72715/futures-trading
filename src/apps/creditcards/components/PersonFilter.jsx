import { ALL_PEOPLE } from '../config/constants.js';

const PILLS = ['All', 'Jonathan', 'Sherry', 'Judy', 'Wade', 'Amanda'];

export function PersonFilter({ selected, onChange }) {
  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      {PILLS.map(name => {
        const active = selected === name || (name === 'All' && selected === ALL_PEOPLE);
        return (
          <button
            key={name}
            onClick={() => onChange(name === 'All' ? ALL_PEOPLE : name)}
            style={{
              padding: '6px 16px',
              borderRadius: 20,
              border: '1px solid rgba(255,255,255,0.12)',
              background: active ? '#00D4FF' : 'rgba(255,255,255,0.06)',
              color: active ? '#0B1220' : 'rgba(255,255,255,0.6)',
              fontWeight: active ? 700 : 400,
              fontSize: '0.85rem',
              cursor: 'pointer',
              transition: 'all 0.15s',
            }}
          >
            {name}
          </button>
        );
      })}
    </div>
  );
}
