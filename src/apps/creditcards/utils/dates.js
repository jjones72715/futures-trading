export function calculateNextResetDate(cycle, fromDate = new Date()) {
  const d = new Date(fromDate);
  switch (cycle) {
    case 'Monthly':
      d.setMonth(d.getMonth() + 1);
      d.setDate(1);
      return d;
    case 'Quarterly': {
      const quarterStarts = [0, 3, 6, 9];
      const nextQuarter = quarterStarts.find(m => m > d.getMonth()) ?? 12;
      if (nextQuarter === 12) { d.setFullYear(d.getFullYear() + 1); d.setMonth(0); }
      else d.setMonth(nextQuarter);
      d.setDate(1);
      return d;
    }
    case 'Semi-Annual': {
      const nextHalf = d.getMonth() < 6 ? 6 : 12;
      if (nextHalf === 12) { d.setFullYear(d.getFullYear() + 1); d.setMonth(0); }
      else d.setMonth(nextHalf);
      d.setDate(1);
      return d;
    }
    case 'Annual':
      d.setFullYear(d.getFullYear() + 1);
      d.setMonth(0);
      d.setDate(1);
      return d;
    default:
      return null;
  }
}

export function toAirtableDate(d) {
  return d.toISOString().split('T')[0];
}

export function isStale(dateStr, months = 4) {
  if (!dateStr) return true;
  const threshold = new Date();
  threshold.setHours(0, 0, 0, 0);
  threshold.setMonth(threshold.getMonth() - months);
  const d = new Date(dateStr + 'T00:00:00');
  return d < threshold;
}

export function advanceUntilFuture(cycle, fromDateStr) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  let d = new Date(fromDateStr + 'T00:00:00');
  let safety = 0;
  while (d <= today && safety < 200) {
    const next = calculateNextResetDate(cycle, d);
    if (!next) return null;
    d = next;
    safety++;
  }
  return toAirtableDate(d);
}
