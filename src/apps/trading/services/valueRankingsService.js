import { fetchTable } from "./airtable.js";
import { PERF_TYPES_TABLE, EVAL_TYPE_TABLE, EVAL_TABLE, PERF_TABLE, TRADERS_TABLE } from "../config/tables.js";

function linkedId(val) {
  if (!val) return null;
  const first = Array.isArray(val) ? val[0] : val;
  return typeof first === "string" ? first : first?.id || null;
}

function linkedIds(val) {
  if (!Array.isArray(val)) return [];
  return val.map(v => typeof v === "string" ? v : v?.id).filter(Boolean);
}

export async function loadValueRankingsData() {
  const [perfTypeRecs, evalTypeRecs, evalAccountRecs, perfAccountRecs, traderRecs] = await Promise.all([
    fetchTable(PERF_TYPES_TABLE, [
      "Name", "Firm", "Data Provider", "Data Provider Override",
      "Evaluation Account Type",
      "ROI Ratio (Unlimited)", "ROI Ratio (Single Payout)", "ROI Ratio (Account Reset)",
      "Profitable?", "Account Size", "Total Cost to Funded",
    ]),
    fetchTable(EVAL_TYPE_TABLE, ["Firm", "Allowed Traders"]),
    fetchTable(EVAL_TABLE, ["Trader", "Evaluation Account Type"]),   // netlify auto-filters Active
    fetchTable(PERF_TABLE, ["Trader", "Performance Account Type"]),  // netlify auto-filters Active/Live/WoP
    fetchTable(TRADERS_TABLE, ["Name", "Preferred Name"]),
  ]);

  // evalType → firmId
  const evalTypeFirmMap = {};
  // evalType → Set<traderId> (allowed traders; empty set = unrestricted)
  const evalTypeAllowedMap = {};
  evalTypeRecs.forEach(r => {
    const firmId = linkedId(r.fields["Firm"]);
    if (firmId) evalTypeFirmMap[r.id] = firmId;
    evalTypeAllowedMap[r.id] = new Set(linkedIds(r.fields["Allowed Traders"]));
  });

  // perfType → firmId
  const perfTypeFirmMap = {};
  perfTypeRecs.forEach(r => {
    const firmId = linkedId(r.fields["Firm"]);
    if (firmId) perfTypeFirmMap[r.id] = firmId;
  });

  // Build firm exclusions per trader from active accounts
  // traderFirmExclusions[traderId] = Set<firmId>
  const traderFirmExclusions = {};
  function addExclusion(traderId, firmId) {
    if (!traderFirmExclusions[traderId]) traderFirmExclusions[traderId] = new Set();
    traderFirmExclusions[traderId].add(firmId);
  }
  evalAccountRecs.forEach(r => {
    const firmId = evalTypeFirmMap[linkedId(r.fields["Evaluation Account Type"])];
    if (!firmId) return;
    linkedIds(r.fields["Trader"]).forEach(tid => addExclusion(tid, firmId));
  });
  perfAccountRecs.forEach(r => {
    const firmId = perfTypeFirmMap[linkedId(r.fields["Performance Account Type"])];
    if (!firmId) return;
    linkedIds(r.fields["Trader"]).forEach(tid => addExclusion(tid, firmId));
  });

  const toNum = v => (typeof v === "number" ? v : null);

  const perfTypes = perfTypeRecs.map(r => {
    const f = r.fields;
    const dpOverride = f["Data Provider Override"] || null;
    const dpLookup = Array.isArray(f["Data Provider"]) ? f["Data Provider"][0] : (f["Data Provider"] || null);
    const dataProvider = dpOverride || dpLookup || "Other";
    const firmId = linkedId(f["Firm"]);
    // Gather allowed traders across all linked eval types
    // If ANY linked eval type is unrestricted (empty set), treat the perf type as unrestricted
    const evalTypeIds = linkedIds(f["Evaluation Account Type"]);
    let allowedTraders = null; // null = unrestricted
    for (const etId of evalTypeIds) {
      const allowed = evalTypeAllowedMap[etId];
      if (!allowed || allowed.size === 0) { allowedTraders = null; break; }
      if (allowedTraders === null) allowedTraders = new Set(allowed);
      else allowed.forEach(t => allowedTraders.add(t));
    }

    return {
      id: r.id,
      name: f["Name"] || "?",
      dataProvider,
      firmId,
      allowedTraders, // null = open to all, Set = restricted to these trader IDs
      roiUnlimited: toNum(f["ROI Ratio (Unlimited)"]),
      roiSinglePayout: toNum(f["ROI Ratio (Single Payout)"]),
      roiReset: toNum(f["ROI Ratio (Account Reset)"]),
      profitable: f["Profitable?"] || null,
      accountSize: f["Account Size"] || null,
      totalCost: f["Total Cost to Funded"] || null,
    };
  });

  const traders = traderRecs.map(r => ({
    id: r.id,
    name: r.fields["Name"] || "",
    preferredName: r.fields["Preferred Name"] || (r.fields["Name"] || "").split(" ")[0],
  }));

  return { perfTypes, traders, traderFirmExclusions };
}
