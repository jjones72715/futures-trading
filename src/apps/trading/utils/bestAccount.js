// Given a firm's linked Performance Account Type records, find the one with
// the highest ROI Ratio (Unlimited). Shared by the Firm Usage grid (ratio only)
// and the firm detail pullout (name + ratio).
export function bestAccountByRoiRatio(perfTypeRecords) {
  return (perfTypeRecords || []).reduce((best, r) => {
    const roi = r.fields?.["ROI Ratio (Unlimited)"];
    if (roi == null) return best;
    if (!best || roi > best.roiRatio) return { name: r.fields["Name"], roiRatio: roi };
    return best;
  }, null);
}
