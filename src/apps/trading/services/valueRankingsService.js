import { fetchTable } from "./airtable.js";
import { EVAL_TYPE_TABLE, FIRMS_TABLE, PURCHASE_TABLE, TRADERS_TABLE } from "../config/tables.js";

export async function loadValueRankingsData() {
  const [evalTypeRecs, firmRecs, purchaseRecs, traderRecs] = await Promise.all([
    fetchTable(EVAL_TYPE_TABLE, ["Name", "Value Score", "Firm", "Allowed Traders"]),
    fetchTable(FIRMS_TABLE, ["Name", "Data Provider"]),
    fetchTable(PURCHASE_TABLE, ["Status", "Trader", "Evaluation Account Type"]),
    fetchTable(TRADERS_TABLE, ["Name", "Preferred Name"]),
  ]);

  // Build firm lookup
  const firmMap = {};
  firmRecs.forEach(r => {
    firmMap[r.id] = {
      name: r.fields["Name"] || "",
      dataProvider: r.fields["Data Provider"] || "Other",
    };
  });

  // Build eval type → firm ID map (for purchase exclusion lookup)
  const evalTypeFirmMap = {};
  evalTypeRecs.forEach(r => {
    const firmArr = r.fields["Firm"];
    const firmId = Array.isArray(firmArr) ? (typeof firmArr[0] === "string" ? firmArr[0] : firmArr[0]?.id) : null;
    if (firmId) evalTypeFirmMap[r.id] = firmId;
  });

  // Build per-trader firm exclusions from active purchases
  // traderFirmExclusions[traderId] = Set of firmIds where trader has an active purchase
  const traderFirmExclusions = {};
  purchaseRecs.forEach(r => {
    if (r.fields["Status"] !== "Active") return;
    const traderArr = r.fields["Trader"];
    const traderIds = Array.isArray(traderArr) ? traderArr.map(t => typeof t === "string" ? t : t?.id).filter(Boolean) : [];
    const evalTypeArr = r.fields["Evaluation Account Type"];
    const evalTypeId = Array.isArray(evalTypeArr) ? (typeof evalTypeArr[0] === "string" ? evalTypeArr[0] : evalTypeArr[0]?.id) : null;
    const firmId = evalTypeId ? evalTypeFirmMap[evalTypeId] : null;
    if (!firmId) return;
    traderIds.forEach(tid => {
      if (!traderFirmExclusions[tid]) traderFirmExclusions[tid] = new Set();
      traderFirmExclusions[tid].add(firmId);
    });
  });

  // Build scored eval types
  const evalTypes = evalTypeRecs
    .map(r => {
      const scoreStr = r.fields["Value Score"];
      const score = scoreStr != null && scoreStr !== "" ? parseFloat(scoreStr) : null;
      const firmArr = r.fields["Firm"];
      const firmId = Array.isArray(firmArr) ? (typeof firmArr[0] === "string" ? firmArr[0] : firmArr[0]?.id) : null;
      const firm = firmId ? firmMap[firmId] : null;
      const allowedTraders = Array.isArray(r.fields["Allowed Traders"])
        ? r.fields["Allowed Traders"].map(t => (typeof t === "string" ? t : t?.id)).filter(Boolean)
        : [];
      return {
        id: r.id,
        name: r.fields["Name"] || "?",
        score,
        firmId,
        firmName: firm?.name || "",
        dataProvider: firm?.dataProvider || "Other",
        allowedTraders,
      };
    })
    .filter(e => e.score !== null && !isNaN(e.score));

  const traders = traderRecs.map(r => ({
    id: r.id,
    name: r.fields["Name"] || "",
    preferredName: r.fields["Preferred Name"] || (r.fields["Name"] || "").split(" ")[0],
  }));

  return { evalTypes, traders, traderFirmExclusions };
}
