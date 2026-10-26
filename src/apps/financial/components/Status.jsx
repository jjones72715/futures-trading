const LABEL = { current: 'Up to Date', stale: 'Needs Update' };

export function StatusDot({ status }) {
  const label = LABEL[status] || 'Checking…';
  return <span className={`fin-dot ${status || 'pending'}`} title={label} aria-label={label} role="img" />;
}

export function StatusPill({ status }) {
  return (
    <span className={`fin-status-pill ${status || 'pending'}`}>
      <StatusDot status={status} />
      {LABEL[status] || 'Checking…'}
    </span>
  );
}
