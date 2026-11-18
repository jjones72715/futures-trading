export function InfoIcon({ note }) {
  if (!note) return null;
  return (
    <span
      title={note}
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        width: 14, height: 14, borderRadius: '50%', border: '1px solid rgba(255,255,255,0.35)',
        color: 'rgba(255,255,255,0.45)', fontSize: '0.64rem', fontWeight: 700,
        fontStyle: 'italic', fontFamily: 'Georgia, serif', cursor: 'help',
        flexShrink: 0, lineHeight: 1,
      }}
    >
      i
    </span>
  );
}
