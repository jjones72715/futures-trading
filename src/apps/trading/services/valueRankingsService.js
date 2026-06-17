import { fetchTable } from "./airtable.js";
import { EVAL_TABLE, EVAL_TYPE_TABLE, FIRMS_TABLE, PERF_TABLE, PERF_TYPES_TABLE, TRADERS_TABLE } from "../config/tables.js";

export async function loadValueRankingsData() {
  const [evalTypeRecs, perfTypeRecs, firmRecs, evalAccountRecs, perfAccountRecs, traderRecs] = await Promise.all([
    fetchTable(EVAL_TYPE_TABLE, ["Name", "Value Score", "Firm", "Allowed Traders"]),
    fetchTable(PERF_TYPES_TABLE, ["Name", "Firm"]),
    fetchTable(FIRMS_TABLE, ["Name", "Data Provider"]),
    fetchTable(EVAL_TABLE, ["Status", "Trader", "Evaluation Account Type"]),
    fetchTable(PERF_TABLE, ["Status", "Trader", "Performance Account Type"]),
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

  // Build eval type → firm ID map
  const evalTypeFirmMap = {};
  evalTypeRecs.forEach(r => {
    const firmArr = r.fields["Firm"];
    const firmId = Array.isArray(firmArr) ? (typeof firmArr[0] === "string" ? firmArr[0] : firmArr[0]?.id) : null;
    if (firmId) evalTypeFirmMap[r.id] = firmId;
  });

  // Build perf type → firm ID map
  const perfTypeFirmMap = {};
  perfTypeRecs.forEach(r => {
    const firmArr = r.fields["Firm"];
    const firmId = Array.isArray(firmArr) ? (typeof firmArr[0] === "string" ? firmArr[0] : firmArr[0]?.id) : null;
    if (firmId) perfTypeFirmMap[r.id] = firmId;
  });

  // Build per-trader firm exclusions from Active eval or perf accounts
  const traderFirmExclusions = {};
  function addExclusion(traderId, firmId) {
    if (!traderFirmExclusions[traderId]) traderFirmExclusions[traderId] = new Set();
    traderFirmExclusions[traderId].add(firmId);
  }

  evalAccountRecs.forEach(r => {
    if (r.fields["Status"] !== "Active") return;
    const traderArr = r.fields["Trader"];
    const traderIds = Array.isArray(traderArr) ? traderArr.map(t => typeof t === "string" ? t : t?.id).filter(Boolean) : [];
    const evalTypeArr = r.fields["Evaluation Account Type"];
    const evalTypeId = Array.isArray(evalTypeArr) ? (typeof evalTypeArr[0] === "string" ? evalTypeArr[0] : evalTypeArr[0]?.id) : null;
    const firmId = evalTypeId ? evalTypeFirmMap[evalTypeId] : null;
    if (!firmId) return;
    traderIds.forEach(tid => addExclusion(tid, firmId));
  });

  perfAccountRecs.forEach(r => {
    const status = r.fields["Status"];
    if (status !== "Active" && status !== "Live" && status !== "Waiting on Payout") return;
    const traderArr = r.fields["Trader"];
    const traderIds = Array.isArray(traderArr) ? traderArr.map(t => typeof t === "string" ? t : t?.id).filter(Boolean) : [];
    const perfTypeArr = r.fields["Performance Account Type"];
    const perfTypeId = Array.isArray(perfTypeArr) ? (typeof perfTypeArr[0] === "string" ? perfTypeArr[0] : perfTypeArr[0]?.id) : null;
    const firmId = perfTypeId ? perfTypeFirmMap[perfTypeId] : null;
    if (!firmId) return;
    traderIds.forEach(tid => addExclusion(tid, firmId));
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
