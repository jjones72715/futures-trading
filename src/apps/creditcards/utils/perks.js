export function annualizedCreditAmount(creditAmount, resetCycle) {
  if (!creditAmount) return null;
  switch (resetCycle) {
    case 'Monthly': return creditAmount * 12;
    case 'Quarterly': return creditAmount * 4;
    case 'Semi-Annual': return creditAmount * 2;
    case 'Annual': return creditAmount * 1;
    default: return null; // Value Only — no cycle
  }
}

export function sumPerkValue(instances) {
  const withValue = (instances || []).filter(i => i.fields?.['Value'] != null);
  const netValue = withValue.reduce((sum, i) => sum + (i.fields['Value'] || 0), 0);
  return { netValue, hasAnyValue: withValue.length > 0 };
}
