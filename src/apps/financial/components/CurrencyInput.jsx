export default function CurrencyInput({ label, value, onChange, placeholder = '0.00', autoFocus, hint }) {
  return (
    <label className="fin-field">
      <span className="fin-label">{label}</span>
      <div className="fin-input-prefix">
        <span>$</span>
        <input className="fin-input" inputMode="decimal" value={value} placeholder={placeholder}
          autoFocus={autoFocus} onChange={e => onChange(e.target.value)} />
      </div>
      {hint && <span className="fin-hint">{hint}</span>}
    </label>
  );
}
