export const ALL = 'All';

// Pills are built from `options` (distinct values found in the data); "All" is always first.
export default function PillFilter({ options, value, onChange }) {
  return (
    <div className="fin-pills">
      {[ALL, ...options].map(name => (
        <button
          key={name}
          className={`fin-pill${value === name ? ' active' : ''}`}
          onClick={() => onChange(name)}
        >
          {name}
        </button>
      ))}
    </div>
  );
}
