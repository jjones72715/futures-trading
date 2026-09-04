// Given a firm's linked Evaluation Account Type records, find the one with
// the highest Value Score. Shared by the Firm Usage grid (score only) and
// the firm detail pullout (name + score).
export function bestAccountFromEvalTypes(evalTypeRecords) {
  return (evalTypeRecords || []).reduce((best, r) => {
    const vs = r.fields?.["Value Score"];
    if (vs == null) return best;
    if (!best || vs > best.valueScore) return { name: r.fields["Name"], valueScore: vs };
    return best;
  }, null);
}
