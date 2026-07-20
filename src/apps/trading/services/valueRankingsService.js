import { fetchTable } from "./airtable.js";
import { PERF_TYPES_TABLE } from "../config/tables.js";

export async function loadValueRankingsData() {
  const recs = await fetchTable(PERF_TYPES_TABLE, [
    "Name",
    "Data Provider",
    "Data Provider Override",
    "ROI Ratio (Unlimited)",
    "ROI Ratio (Single Payout)",
    "ROI Ratio (Account Reset)",
    "Profitable?",
    "Account Size",
    "Total Cost to Funded",
  ]);

  const perfTypes = recs.map(r => {
    const f = r.fields;
    const dpOverride = f["Data Provider Override"] || null;
    const dpLookup = Array.isArray(f["Data Provider"]) ? f["Data Provider"][0] : (f["Data Provider"] || null);
    const dataProvider = dpOverride || dpLookup || "Other";
    const toNum = v => (typeof v === "number" ? v : null);
    return {
      id: r.id,
      name: f["Name"] || "?",
      dataProvider,
      roiUnlimited: toNum(f["ROI Ratio (Unlimited)"]),
      roiSinglePayout: toNum(f["ROI Ratio (Single Payout)"]),
      roiReset: toNum(f["ROI Ratio (Account Reset)"]),
      profitable: f["Profitable?"] || null,
      accountSize: f["Account Size"] || null,
      totalCost: f["Total Cost to Funded"] || null,
    };
  });

  return { perfTypes };
}
